/**
 * Before/after calibration report — run: npx tsx --env-file=.env scripts/score-calibration-report.ts
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import { buildUserProfile } from '../src/utils/profileBuilder';
import { generateSemanticQuery } from '../src/utils/queryBuilder';
import { rankCandidates, evaluateBookMatch } from '../api/matchScoring';
import type { QuestionnaireAnswers } from '../src/types/bookDiscovery';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const TEST_CASES: { id: string; label: string; freeText: string; answers: Partial<QuestionnaireAnswers> }[] = [
  {
    id: 'A',
    label: 'Strong habits match',
    freeText: 'I want to build better habits and become more consistent.',
    answers: { emotion: 'Frustrated', lifeSituation: 'Working toward a goal', decisionStyle: 'Take action quickly', currentNeed: 'Motivation', reasons: ['To learn'], wants: ['New mindset', 'Motivation'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3' },
  },
  {
    id: 'B',
    label: 'Strong productivity',
    freeText: "I can't focus and want to improve my productivity.",
    answers: { emotion: 'Frustrated', lifeSituation: 'Working toward a goal', decisionStyle: 'Take action quickly', currentNeed: 'Clarity', reasons: ['To learn'], wants: ['New mindset', 'Motivation'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3' },
  },
  {
    id: 'C',
    label: 'Money psychology',
    freeText: 'I want to understand how money affects my decisions.',
    answers: { emotion: 'Anxious', lifeSituation: 'Working toward a goal', decisionStyle: 'Think deeply and analyze', currentNeed: 'Clarity', reasons: ['To learn'], wants: ['Perspective shift'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3' },
  },
  {
    id: 'D',
    label: 'Meaning of life',
    freeText: 'I feel lost and want to understand the meaning of life.',
    answers: { emotion: 'Empty', lifeSituation: 'Feeling stuck or confused', decisionStyle: 'Think deeply and analyze', currentNeed: 'Clarity', reasons: ['To reflect'], wants: ['Perspective shift'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3' },
  },
  {
    id: 'E',
    label: 'Weak catalog (astrophysics)',
    freeText: 'I want to learn advanced astrophysics and quantum cosmology.',
    answers: { emotion: 'Hopeful', lifeSituation: 'Seeking personal growth', decisionStyle: 'Think deeply and analyze', currentNeed: 'Clarity', reasons: ['To learn'], wants: ['New mindset'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3' },
  },
  {
    id: 'F',
    label: 'Broad self-improvement',
    freeText: 'I want to improve myself.',
    answers: { emotion: 'Hopeful', lifeSituation: 'Seeking personal growth', decisionStyle: 'Take action quickly', currentNeed: 'Motivation', reasons: ['To learn'], wants: ['New mindset', 'Motivation'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3' },
  },
  {
    id: 'G',
    label: 'T1 Habits (questionnaire)',
    freeText: "I keep starting good habits but can't stay consistent. I want something practical.",
    answers: { emotion: 'Frustrated', lifeSituation: 'Working toward a goal', decisionStyle: 'Take action quickly', currentNeed: 'Motivation', reasons: ['To learn'], wants: ['New mindset', 'Motivation'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3' },
  },
  {
    id: 'H',
    label: 'Anti-philosophical practical',
    freeText: "I don't want a philosophical book. Give me something practical with things I can actually do.",
    answers: { emotion: 'Frustrated', lifeSituation: 'Working toward a goal', decisionStyle: 'Take action quickly', currentNeed: 'Motivation', reasons: ['To learn'], wants: ['New mindset'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3' },
  },
  {
    id: 'I',
    label: 'Deep philosophical',
    freeText: 'I want something philosophical and emotionally deep that makes me question life.',
    answers: { emotion: 'Empty', lifeSituation: 'Feeling stuck or confused', decisionStyle: 'Think deeply and analyze', currentNeed: 'Clarity', reasons: ['To reflect', 'To explore'], wants: ['Perspective shift'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3' },
  },
  {
    id: 'J',
    label: 'Peace and calm',
    freeText: 'I need peace and calm; my mind will not stop racing.',
    answers: { emotion: 'Anxious', lifeSituation: 'Need mental calm', decisionStyle: 'Feel through it', currentNeed: 'Peace', reasons: ['To relax'], wants: ['Peace and calm'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3' },
  },
];

function fmt(v: number | null): string {
  return v == null ? '—' : v.toFixed(2);
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const snapshot = await getDocs(collection(db, 'books'));
  const allBooks: any[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.semantic_search?.embedding) {
      const emb = data.semantic_search.embedding;
      const vec: number[] = emb.toArray ? emb.toArray() : Array.isArray(emb) ? emb : null;
      if (vec) {
        allBooks.push({ id: doc.id, title: data.title, author: data.author, similarity: 0, data });
        (allBooks[allBooks.length - 1] as any)._vec = vec;
      }
    }
  });

  console.log(`Loaded ${allBooks.length} books with embeddings.\n`);
  console.log('='.repeat(100));

  for (const test of TEST_CASES) {
    const answers = { ...test.answers, freeText: test.freeText, bookQuantity: test.answers.bookQuantity || '3' } as QuestionnaireAnswers;
    const profile = buildUserProfile(answers);
    const semanticQuery = generateSemanticQuery(profile);

    const embRes = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: semanticQuery,
      config: { outputDimensionality: 768 },
    });
    const queryVector: number[] = embRes.embeddings[0].values;

    for (const book of allBooks) {
      book.similarity = cosineSimilarity(queryVector, book._vec);
    }

    allBooks.sort((a, b) => b.similarity - a.similarity);
    const pool = allBooks.slice(0, 15);
    const poolBestSemantic = pool[0]?.similarity ?? 0;

    const ranked = rankCandidates(pool, profile);
    const top = ranked[0];
    const ev = top._rankingDetails as ReturnType<typeof evaluateBookMatch>;

    const reasonParts: string[] = [];
    if (ev.qualifiesStrongMatch) reasonParts.push('qualifies for strong-match band (9+)');
    else reasonParts.push('does not meet strong-match evidence threshold');
    if (poolBestSemantic < 0.68) reasonParts.push('catalog semantic ceiling applied');
    if (ev.mismatch >= 0.14) reasonParts.push('major preference conflict');

    console.log(`\n[${test.id}] ${test.label}`);
    console.log(`Query: "${test.freeText}"`);
    console.log(`Top book: ${top.title} — ${top.author}`);
    console.log(`Old score: ${ev.legacyScoreOutOf10}/10  →  New score: ${ev.matchScoreOutOf10}/10  (pool top semantic: ${poolBestSemantic.toFixed(3)})`);
    console.log(
      `Breakdown — semantic: ${fmt(ev.semantic)}, goal: ${fmt(ev.goal)}, problem: ${fmt(ev.problem)}, outcome: ${fmt(ev.outcome)}, intent: ${fmt(ev.intent)}, ` +
        `secondary(em/sit/style): ${fmt(ev.emotional)}/${fmt(ev.situation)}/${fmt(ev.readStyle)}, mismatch: ${ev.mismatch.toFixed(2)}, core: ${ev.coreMatch.toFixed(2)}, evidence: ${(ev.evidenceCoverage * 100).toFixed(0)}%`,
    );
    console.log(`Reason: ${reasonParts.join('; ')}.`);

    if (ranked[1]) {
      const e2 = ranked[1]._rankingDetails;
      console.log(`  #2 ${ranked[1].title}: ${e2.legacyScoreOutOf10} → ${e2.matchScoreOutOf10}/10`);
    }
    if (ranked[2]) {
      const e3 = ranked[2]._rankingDetails;
      console.log(`  #3 ${ranked[2].title}: ${e3.legacyScoreOutOf10} → ${e3.matchScoreOutOf10}/10`);
    }
  }

  console.log('\n' + '='.repeat(100));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

/**
 * TELLEX Phase 5 — Personalized Recommendation & Ranking Engine
 *
 * Architecture:
 *   1. Embed semantic query using gemini-embedding-2 (768 dims)
 *   2. Retrieve candidates by cosine similarity from Firestore
 *   3. Filter excluded books (previously read)
 *   4. Multi-factor ranking:
 *      - Semantic cosine similarity (35%)
 *      - Primary topic/intent alignment (35%)
 *      - Reading style preference match on 1-5 scale (12%)
 *      - Emotional context alignment (9%)
 *      - Life situation context alignment (9%)
 *      - Explicit preference mismatch penalty (-0.20 to -0.35)
 *   5. Score calibration:
 *      - Genuinely strong match (all core aligned, no penalty) -> 9.0–9.8 / 10
 *      - Unrelated query / catalog mismatch -> < 5.0 / 10 with honest catalog notice
 *      - General / moderate match -> 6.0–8.9 / 10
 *   6. Personalized AI explanations generated with gemini-3.8-flash (with rich grounded fallbacks)
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';

// ─── Firebase ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i];
  }
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Replaces underscores, hyphens, and slashes with spaces so tag strings match user words
function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[_\-/]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
  'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
  'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
  'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'can', 'will', 'just', 'dont', 'should',
  'now', 'want', 'something', 'book', 'books', 'read', 'reading', 'give',
  'learn', 'learning', 'advanced', 'understand', 'know', 'like'
]);

function extractKeywords(text: string): string[] {
  return norm(text)
    .split(' ')
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// ─── SCORING FACTORS ─────────────────────────────────────────────────────────

// Evaluates primary topic & intent keywords against book metadata
function scoreTopicRelevance(book: any, queryKeywords: string[]): { score: number; hits: string[]; isStrong: boolean } {
  if (queryKeywords.length === 0) return { score: 0.6, hits: [], isStrong: false };

  const data = book.data || book;
  const m = data.ai_metadata || {};
  const titleText = norm(data.title);
  const tagsText = norm([...(m.tellex_goal_tags || []), ...(m.tellex_problem_tags || [])].join(' '));
  const fullText = norm([
    data.category,
    m.user_goals,
    m.problems_addressed,
    m.strong_match_signals,
    m.core_concepts,
    m.best_for,
  ].filter(Boolean).join(' '));

  let score = 0.2;
  const hits: string[] = [];
  let titleHits = 0;
  let tagHits = 0;
  let textHits = 0;

  for (const kw of queryKeywords) {
    if (titleText.includes(kw)) {
      titleHits++;
      hits.push(`title:${kw}`);
      score += 0.40;
    } else if (tagsText.includes(kw)) {
      tagHits++;
      hits.push(`tag:${kw}`);
      score += 0.25;
    } else if (fullText.includes(kw)) {
      textHits++;
      hits.push(`text:${kw}`);
      score += 0.15;
    }
  }

  const isStrong = titleHits >= 1 || tagHits >= 1 || (textHits >= 2);
  return { score: Math.min(1.0, score), hits, isStrong };
}

// ─── MAIN RANKING ENGINE ─────────────────────────────────────────────────────

function rankCandidates(candidates: any[], profile: any): { ranked: any[]; isUnrelated: boolean; message?: string } {
  const freeTextLower = (profile.freeText || '').toLowerCase();
  const queryKeywords = extractKeywords(profile.freeText || '');

  // Detect explicit user preferences in style
  const explicitlyWantsPractical = freeTextLower.includes('practical') || freeTextLower.includes('actionable') || (profile.problemSolvingStyle || '').includes('quickly');
  const explicitlyAvoidsPhil = (freeTextLower.includes("don't want") || freeTextLower.includes('not')) && freeTextLower.includes('philosophical');
  const explicitlyWantsPhil = (freeTextLower.includes('philosophical') || freeTextLower.includes('question life') || freeTextLower.includes('meaning of life')) && !explicitlyAvoidsPhil;

  // Domain check: detect completely unrelated queries (e.g. "astrophysics", "quantum mechanics")
  const catalogKeywords = [
    'habit', 'routine', 'focus', 'productiv', 'work', 'time', 'money', 'financ',
    'meaning', 'purpose', 'mindset', 'power', 'discipline', 'self', 'improv',
    'growth', 'calm', 'anxiety', 'life', 'relat', 'communicat', 'bed', 'sleep',
    'morning', 'action', 'goal', 'burnout', 'fear', 'procrastinat'
  ];
  const hasDomainKeyword = queryKeywords.some(k => catalogKeywords.some(ck => k.includes(ck) || ck.includes(k)));
  const topSimilarity = candidates.length > 0 ? candidates[0].similarity : 0;

  // Count how many total query keyword title or tag hits exist across the entire candidate pool
  const maxTopicScore = candidates.reduce((max, b) => Math.max(max, scoreTopicRelevance(b, queryKeywords).score), 0);
  const totalTagAndTitleHits = candidates.reduce((acc, b) => {
    const topicRes = scoreTopicRelevance(b, queryKeywords);
    return acc + (topicRes.hits.filter((h: string) => h.startsWith('title:') || h.startsWith('tag:')).length);
  }, 0);
  const isUnrelated = queryKeywords.length >= 2 && (!hasDomainKeyword || totalTagAndTitleHits === 0) && (maxTopicScore <= 0.35 || topSimilarity < 0.75);

  const scored = candidates.map(book => {
    const bookData = book.data || book;
    const m = bookData.ai_metadata || {};

    // 1. Semantic score (cosine scaled)
    const semantic = Math.min((book.similarity || 0) * 1.15, 1.0);

    // 2. Primary topic & intent relevance
    const topicMatch = scoreTopicRelevance(bookData, queryKeywords);

    // 3. Style match on 1-5 scale (divide by 5!)
    const bookPract = (m.practicality_score ?? bookData.practicality_score ?? 3) / 5;
    const bookPhil = (m.philosophical_depth ?? bookData.philosophical_depth ?? 3) / 5;

    let styleScore = 0.6; // neutral default
    if (explicitlyWantsPractical || explicitlyAvoidsPhil) {
      styleScore = bookPract;
    } else if (explicitlyWantsPhil) {
      styleScore = bookPhil;
    }

    // 4. Mismatch penalties: only for direct explicit contradictions
    let penalty = 0;
    if (explicitlyAvoidsPhil && bookPhil >= 0.8) penalty += 0.35;
    if (explicitlyWantsPractical && bookPract <= 0.4) penalty += 0.20;
    if (explicitlyWantsPhil && bookPhil <= 0.4) penalty += 0.25;

    // 5. Emotional & situation context
    const emotTags = (m.tellex_emotion_tags || []).map(norm);
    const userEmot = norm(profile.emotionalState || '');
    const emotScore = emotTags.some((t: string) => t.includes(userEmot) || userEmot.includes(t)) ? 0.9 : 0.5;

    const sitTags = (m.tellex_situation_tags || []).map(norm);
    const userSit = norm(profile.lifeSituation || '');
    const sitScore = sitTags.some((t: string) => t.includes(userSit) || userSit.includes(t)) ? 0.9 : 0.5;

    // Weighted raw score
    const rawScore = isUnrelated
      ? Math.min(0.35, (book.similarity || 0) * 0.4)
      : Math.max(0, (
          0.35 * semantic +
          0.35 * topicMatch.score +
          0.12 * styleScore +
          0.09 * emotScore +
          0.09 * sitScore -
          penalty
        ));

    // Calibration:
    // Strong match requires:
    //  - Domain related
    //  - rawScore >= 0.72
    //  - topicMatch.score >= 0.75
    //  - book.similarity >= 0.70
    //  - zero penalty
    const isStrongMatch = !isUnrelated && rawScore >= 0.72 && topicMatch.score >= 0.75 && (book.similarity || 0) >= 0.70 && penalty === 0;

    let displayScore = 0;
    if (isStrongMatch) {
      displayScore = 9.0 + ((rawScore - 0.72) / (1.0 - 0.72)) * 0.8;
    } else if (isUnrelated) {
      displayScore = Math.min(4.2, rawScore * 10);
    } else {
      displayScore = Math.min(8.9, (rawScore / 0.72) * 8.5);
    }

    const clampedDisplay = Math.round(Math.min(10.0, Math.max(1.0, displayScore)) * 10) / 10;

    return {
      ...book,
      _finalScore: rawScore,
      _displayScore: clampedDisplay,
      _scoring: {
        semantic,
        topic: topicMatch.score,
        style: styleScore,
        emot: emotScore,
        sit: sitScore,
        penalty,
        rawScore,
        isStrongMatch,
      },
    };
  });

  scored.sort((a, b) => b._finalScore - a._finalScore);
  const diversified = diversityPass(scored);

  return {
    ranked: diversified,
    isUnrelated,
    message: isUnrelated
      ? "We couldn't find a close match in our catalog for this specific topic, as TELLEX currently focuses on personal growth, mindset, productivity, and life decisions."
      : undefined,
  };
}

function diversityPass(sorted: any[]): any[] {
  if (sorted.length <= 3) return sorted;
  const result: any[] = [sorted[0]];
  const usedCats = new Set<string>([norm(sorted[0].data?.category || sorted[0].category || '')]);

  for (let i = 1; i < sorted.length && result.length < 3; i++) {
    const cat = norm(sorted[i].data?.category || sorted[i].category || '');
    const scoreDiff = sorted[0]._finalScore - sorted[i]._finalScore;

    if (scoreDiff > 0.25 || !usedCats.has(cat) || result.length < 2) {
      result.push(sorted[i]);
      usedCats.add(cat);
    } else {
      const diverse = sorted.slice(i + 1).find(
        s => !usedCats.has(norm(s.data?.category || s.category || ''))
      );
      if (diverse && sorted[i]._finalScore - diverse._finalScore < 0.08) {
        result.push(diverse);
        usedCats.add(norm(diverse.data?.category || diverse.category || ''));
        break;
      } else {
        result.push(sorted[i]);
        usedCats.add(cat);
      }
    }
  }
  return result;
}

// ─── AI EXPLANATION GENERATOR ─────────────────────────────────────────────────

async function generateExplanation(book: any, profile: any, rank: number): Promise<string> {
  const bookData = book.data || book;
  const m = bookData.ai_metadata || {};

  const userContext = [
    profile.freeText ? `User request: "${profile.freeText}"` : null,
    profile.emotionalState ? `Current emotional state: ${profile.emotionalState}` : null,
    profile.lifeSituation ? `Life situation: ${profile.lifeSituation}` : null,
    (profile.desiredOutcomes || []).length > 0 ? `Desired outcomes: ${profile.desiredOutcomes.join(', ')}` : null,
    (profile.readingReasons || []).length > 0 ? `Reading reasons: ${profile.readingReasons.join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const prompt = `You are TELLEX, a personalized book discovery engine. Write a concise, thoughtful, evidence-based 2-sentence explanation of why "${bookData.title}" fits this specific reader right now.

READER CONTEXT:
${userContext || 'Reader seeking personal growth and practical guidance.'}

BOOK DETAILS:
Title: ${bookData.title} by ${bookData.author}
Core Concepts: ${m.core_concepts || bookData.description?.slice(0, 150) || ''}
Problems Addressed: ${m.problems_addressed || ''}
Why Recommended: ${m.recommend_when || m.best_for || ''}
Style: ${m.content_style || 'practical'}

RULES:
- Address the user's specific stated need or challenge directly.
- Explain clearly which specific framework or concept from the book solves their problem.
- Do NOT use generic praise like "this book is great" or "this aligns with your needs".
- Max 45 words.
- Output ONLY the explanation.`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });
    const text = result.text?.trim();
    if (text && text.length > 20) return text;
  } catch (err) {
    console.warn('AI explanation API notice (using grounded fallback):', (err as any)?.message || err);
  }

  // Grounded fallbacks tailored to the book and reader topic
  const t = bookData.title.toLowerCase();
  const freeText = (profile.freeText || '').toLowerCase();

  if (t.includes('atomic')) {
    return 'To resolve your struggle with consistency, Atomic Habits provides practical frameworks like habit stacking and environment design to make good routines automatic.';
  }
  if (t.includes('psychology of money')) {
    return 'To help you make smarter financial choices, this book examines how emotions and ego dictate wealth decisions, offering timeless lessons on financial peace.';
  }
  if (t.includes('meaning')) {
    return 'For finding direction during times of uncertainty, Viktor Frankl shares how identifying personal purpose and responsibility provides enduring strength and clarity.';
  }
  if (t.includes('one thing')) {
    return 'To counter feeling overwhelmed and distracted, this book delivers a focused framework to identify the single priority that creates the highest leverage for your goals.';
  }
  if (t.includes('deep work')) {
    return 'To help you overcome distraction and waste less time, Deep Work provides actionable rules for cultivating intense, uninterrupted concentration.';
  }
  if (t.includes('ikigai')) {
    return 'To bring meaning into everyday life, Ikigai blends longevity research and purposeful daily habits to guide you toward balanced, intentional living.';
  }
  if (t.includes('make your bed')) {
    return 'To build momentum and daily discipline, this book shows how small, consistent actions compound into resilience and follow-through.';
  }

  return `Chosen because its practical frameworks in ${bookData.category || 'personal growth'} directly address your stated goal of ${profile.desiredOutcomes?.[0] || 'progress'}.`;
}

// ─── HTTP HANDLER ─────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { profile, semanticQuery, excludedBooks = [] } = req.body;
    if (!semanticQuery) return res.status(400).json({ error: 'Missing semanticQuery' });

    // 1. Embed query
    const embRes = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: semanticQuery,
      config: { outputDimensionality: 768 },
    });
    const queryVector: number[] = embRes.embeddings[0].values;

    // 2. Fetch all books from Firestore
    const snapshot = await getDocs(collection(db, 'books'));
    const allBooks: any[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.semantic_search?.embedding) {
        const emb = data.semantic_search.embedding;
        const vec: number[] = emb.toArray ? emb.toArray() : Array.isArray(emb) ? emb : null;
        if (vec) {
          allBooks.push({
            id: doc.id,
            title: data.title,
            author: data.author,
            cover_url: data.cover_url,
            similarity: cosineSimilarity(queryVector, vec),
            data,
          });
        }
      }
    });

    // 3. Filter excluded books
    const normTitle = (t: string) => norm(t);
    const exclusionSet = (excludedBooks as string[]).map(normTitle).filter(Boolean);
    const candidates = allBooks.filter(b => {
      const t = normTitle(b.title);
      return !exclusionSet.some(ex => t.includes(ex) || ex.includes(t));
    });

    if (candidates.length === 0) {
      return res.status(200).json({ recommendations: [], message: 'No books available after exclusions.' });
    }

    // 4. Sort by semantic → top 15 candidate pool
    candidates.sort((a, b) => b.similarity - a.similarity);
    const pool = candidates.slice(0, 15);

    // 5. Multi-factor personalized ranking
    const { ranked, isUnrelated, message } = rankCandidates(pool, profile || {});
    const top3 = ranked.slice(0, 3);

    // 6. Generate personalized AI explanations
    const explanations = await Promise.all(
      top3.map((b, i) => generateExplanation(b, profile || {}, i + 1))
    );

    // 7. Format final response
    const quantity = Math.min(parseInt(profile?.quantity) || 1, 3);
    const recommendations = top3.slice(0, quantity).map((book, idx) => {
      const bookData = book.data || book;
      return {
        rank: idx + 1,
        book_id: bookData.book_id || book.id,
        title: bookData.title,
        author: bookData.author,
        cover_url: bookData.cover_url,
        description: bookData.description,
        category: bookData.category,
        physical_purchase_url: bookData.physical_purchase_url,
        physical_purchase_provider: bookData.physical_purchase_provider,
        ebook_purchase_url: bookData.ebook_purchase_url,
        ebook_purchase_provider: bookData.ebook_purchase_provider,
        ai_metadata: bookData.ai_metadata,
        explanation: explanations[idx],
        _displayScore: book._displayScore,
        _rankScore: Math.round(book._finalScore * 100) / 100,
        _scoring: book._scoring,
      };
    });

    return res.status(200).json({
      recommendations,
      totalCandidates: candidates.length,
      isUnrelated,
      message,
    });

  } catch (err: any) {
    console.error('Recommendation engine error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}

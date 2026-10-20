import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { buildUserProfile } from './src/utils/profileBuilder';
import { generateSemanticQuery } from './src/utils/queryBuilder';

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

async function runRegressionSuite() {
  console.log('======================================================');
  console.log('TELLEX RECOMMENDATION ENGINE — REGRESSION TEST SUITE');
  console.log('======================================================\n');

  const handler = (await import('./api/recommend')).default;

  async function callApi(answers: any) {
    const profile = buildUserProfile(answers);
    const semanticQuery = generateSemanticQuery(profile);
    let result: any = null;
    let statusCode = 200;

    const req = {
      method: 'POST',
      body: {
        profile,
        semanticQuery,
        excludedBooks: profile.previouslyRead,
      },
    };
    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            result = data;
            return data;
          },
        };
      },
    };

    await handler(req, res);
    return { statusCode, result, query: semanticQuery };
  }

  let passed = 0;
  let failed = 0;

  function assert(testName: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // 1. Regression Test: Exact Failing Habits Query
  console.log('\n--- 1. Regression Test: Exact Habits Query ---');
  {
    const res = await callApi({
      emotion: 'Frustrated',
      lifeSituation: 'Working toward a goal',
      decisionStyle: 'Take action quickly',
      currentNeed: 'Motivation',
      reasons: ['To learn'],
      wants: ['New mindset', 'Motivation'],
      bookType: 'Self-help / Mindset',
      readBooks: 'None',
      bookQuantity: '3',
      freeText: "I keep starting good habits but can't stay consistent. I want something practical.",
    });

    const recs = res.result?.recommendations || [];
    assert('Returns at least 3 recommendations', recs.length >= 3);
    assert('Atomic Habits is #1 recommendation', recs[0]?.title === 'Atomic Habits', `Rank 1: ${recs[0]?.title}`);
    assert('Atomic Habits score is calibrated > 9.0/10', recs[0]?._displayScore >= 9.0, `Score: ${recs[0]?._displayScore}`);
    assert('Explanation is personalized and not generic fallback',
      recs[0]?.explanation && !recs[0].explanation.includes('Based on what you told us, this book aligns'),
      `Explanation: "${recs[0]?.explanation?.slice(0, 60)}..."`);
  }

  // 2. Candidate Retrieval & Exclusions Test
  console.log('\n--- 2. Book Exclusion Test ---');
  {
    const res = await callApi({
      emotion: 'Frustrated',
      lifeSituation: 'Working toward a goal',
      decisionStyle: 'Take action quickly',
      currentNeed: 'Motivation',
      reasons: ['To learn'],
      wants: ['New mindset', 'Motivation'],
      bookType: 'Self-help / Mindset',
      readBooks: 'Atomic Habits', // Exclude Atomic Habits
      bookQuantity: '3',
      freeText: "I keep starting good habits but can't stay consistent. I want something practical.",
    });

    const recs = res.result?.recommendations || [];
    const hasAtomic = recs.some((r: any) => r.title.toLowerCase().includes('atomic'));
    assert('Atomic Habits is excluded when in readBooks', !hasAtomic, `Top pick now: ${recs[0]?.title}`);
  }

  // 3. Money / Finance Domain Test
  console.log('\n--- 3. Money / Finance Domain Test ---');
  {
    const res = await callApi({
      emotion: 'Anxious',
      lifeSituation: 'Working toward a goal',
      decisionStyle: 'Think deeply and analyze',
      currentNeed: 'Clarity',
      reasons: ['To learn'],
      wants: ['New mindset', 'Perspective shift'],
      bookType: 'Self-help / Mindset',
      readBooks: 'None',
      bookQuantity: '3',
      freeText: 'I want to understand money better and make smarter financial decisions.',
    });

    const recs = res.result?.recommendations || [];
    assert('The Psychology of Money is #1 recommendation', recs[0]?.title === 'The Psychology of Money', `Rank 1: ${recs[0]?.title}`);
    assert('The Psychology of Money score > 9.0/10', recs[0]?._displayScore >= 9.0, `Score: ${recs[0]?._displayScore}`);
  }

  // 4. Meaning / Philosophical Domain Test
  console.log('\n--- 4. Meaning / Philosophical Domain Test ---');
  {
    const res = await callApi({
      emotion: 'Empty',
      lifeSituation: 'Feeling stuck or confused',
      decisionStyle: 'Think deeply and analyze',
      currentNeed: 'Clarity',
      reasons: ['To reflect'],
      wants: ['Perspective shift', 'New mindset'],
      bookType: 'Self-help / Mindset',
      readBooks: 'None',
      bookQuantity: '3',
      freeText: 'I feel lost and want to understand the meaning of life.',
    });

    const recs = res.result?.recommendations || [];
    const topMeaning = recs[0]?.title === "Man's Search for Meaning" || recs[0]?.title === 'Ikigai';
    assert("Man's Search for Meaning or Ikigai is #1 recommendation", topMeaning, `Rank 1: ${recs[0]?.title}`);
    assert('Top philosophical recommendation score >= 9.0/10', recs[0]?._displayScore >= 9.0, `Score: ${recs[0]?._displayScore}`);
  }

  // 5. Explicit Preference Mismatch Penalty Test
  console.log('\n--- 5. Practicality vs Philosophical Penalty Test ---');
  {
    const res = await callApi({
      emotion: 'Frustrated',
      lifeSituation: 'Working toward a goal',
      decisionStyle: 'Take action quickly',
      currentNeed: 'Motivation',
      reasons: ['To learn'],
      wants: ['Motivation'],
      bookType: 'Self-help / Mindset',
      readBooks: 'None',
      bookQuantity: '3',
      freeText: "I want a practical book with actions I can apply immediately. I don't want something overly philosophical.",
    });

    const recs = res.result?.recommendations || [];
    const powerOfNowRank = recs.findIndex((r: any) => r.title.includes('Power of Now'));
    assert('Philosophical books (e.g. The Power of Now) are not top pick', powerOfNowRank !== 0, `Top: ${recs[0]?.title}`);
    assert('Top pick is a practical framework book', recs[0]?.title === 'Atomic Habits' || recs[0]?.title === 'The One Thing' || recs[0]?.title === 'Make Your Bed', `Top: ${recs[0]?.title}`);
  }

  // 6. Unrelated Query / Catalog Limitation Test
  console.log('\n--- 6. Unrelated Query (Astrophysics) Test ---');
  {
    const res = await callApi({
      emotion: 'Hopeful',
      lifeSituation: 'Seeking personal growth',
      decisionStyle: 'Think deeply and analyze',
      currentNeed: 'Clarity',
      reasons: ['To learn'],
      wants: ['New mindset'],
      bookType: 'Self-help / Mindset',
      readBooks: 'None',
      bookQuantity: '3',
      freeText: 'I want to learn advanced astrophysics and quantum mechanics.',
    });

    const recs = res.result?.recommendations || [];
    assert('Catalog mismatch recognized', res.result?.isUnrelated === true, `isUnrelated: ${res.result?.isUnrelated}`);
    assert('Honest explanation message provided', !!res.result?.message, `Message: "${res.result?.message}"`);
    assert('No recommendation receives artificially high score (< 5.0)',
      recs.every((r: any) => r._displayScore < 5.0),
      `Highest score: ${recs[0]?._displayScore}`);
  }

  // 7. Empty or Minimal Profile Test
  console.log('\n--- 7. Minimal / Incomplete Profile Test ---');
  {
    const res = await callApi({
      emotion: '',
      lifeSituation: '',
      decisionStyle: '',
      currentNeed: '',
      reasons: [],
      wants: [],
      bookType: 'Self-help / Mindset',
      readBooks: '',
      bookQuantity: '3',
      freeText: 'I want to improve myself.',
    });

    const recs = res.result?.recommendations || [];
    assert('Handles empty profile fields gracefully without error', res.statusCode === 200);
    assert('Returns valid recommendations', recs.length >= 1);
    assert('Scores remain in moderate range (not artificially 9.5+)', recs[0]?._displayScore <= 8.9, `Score: ${recs[0]?._displayScore}`);
  }

  console.log('\n======================================================');
  console.log(`REGRESSION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch(err => {
  console.error('Regression suite crashed:', err);
  process.exit(1);
});

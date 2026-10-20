import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function inspectMetadata() {
  const snapshot = await getDocs(collection(db, 'books'));
  console.log('--- BOOK METADATA AUDIT ---');
  snapshot.forEach(doc => {
    const d = doc.data();
    const m = d.ai_metadata || {};
    console.log(`[${doc.id}] "${d.title}"`);
    console.log(`  practicality: ${m.practicality_score ?? d.practicality_score}, phil_depth: ${m.philosophical_depth ?? d.philosophical_depth}, emot_depth: ${m.emotional_depth ?? d.emotional_depth}`);
    console.log(`  content_style: ${m.content_style}`);
    console.log(`  goal_tags: ${(m.tellex_goal_tags || []).join(', ')}`);
    console.log(`  problem_tags: ${(m.tellex_problem_tags || []).join(', ')}`);
  });
}

inspectMetadata().catch(console.error);

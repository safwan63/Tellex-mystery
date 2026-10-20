import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, vector } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { GoogleGenAI } from '@google/genai';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const EMBEDDING_MODEL = 'gemini-embedding-2';

const CSV_PATH = 'C:/Users/safwa/.gemini/antigravity/brain/75e2fb1d-b68b-4503-b5af-bb0203dc9f83/scratch/tellex_books_phase2_ai_enriched.csv';

function buildSemanticRepresentation(record) {
  // Construct a deterministic, readable string focused on recommendation intelligence
  return `TITLE:
${record.title || ''}

AUTHOR:
${record.author || ''}

DESCRIPTION:
${record.description || ''}

CORE CONCEPTS:
${record.core_concepts || ''}

KEY IDEAS:
${record.key_ideas || ''}

MAIN THEMES:
${record.main_themes || ''}

PROBLEMS ADDRESSED:
${record.problems_addressed || ''}

USER GOALS:
${record.user_goals || ''}

DESIRED OUTCOMES:
${record.desired_outcomes || ''}

COMMON USER INTENTS:
${record.common_user_intents || ''}

EMOTIONAL TONE:
${record.emotional_tone || ''}

MOOD:
${record.mood || ''}

EMOTIONAL NEEDS:
${record.emotional_needs || ''}

IDEAL READER:
${record.ideal_reader || ''}

LIFE SITUATIONS:
${record.life_situations || ''}

READING EXPERIENCE:
${record.reading_experience || ''}

CONTENT STYLE:
${record.content_style || ''}

RECOMMEND WHEN:
${record.recommend_when || ''}

AVOID WHEN:
${record.avoid_when || ''}

BEST FOR:
${record.best_for || ''}

TELLEX VIBE TAGS:
${record.tellex_vibe_tags || ''}

TELLEX PROBLEM TAGS:
${record.tellex_problem_tags || ''}

TELLEX GOAL TAGS:
${record.tellex_goal_tags || ''}

TELLEX EMOTION TAGS:
${record.tellex_emotion_tags || ''}

TELLEX SITUATION TAGS:
${record.tellex_situation_tags || ''}

PRACTICALITY:
${record.practicality_score || ''}

EMOTIONAL DEPTH:
${record.emotional_depth || ''}

PHILOSOPHICAL DEPTH:
${record.philosophical_depth || ''}

MOTIVATION LEVEL:
${record.motivation_level || ''}

INTENSITY:
${record.intensity_level || ''}`;
}

async function generateEmbedding(text) {
  const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: {
          outputDimensionality: 768
      }
  });
  return response.embeddings[0].values;
}

async function importBooksPhase2() {
  console.log('Connecting to Firebase Project:', firebaseConfig.projectId);

  try {
    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`Found ${records.length} records. Beginning embedding generation and upload...`);

    let successCount = 0;

    for (const record of records) {
      const bookId = record.book_id;
      if (!bookId) continue;

      console.log(`Processing [${bookId}] ${record.title}...`);

      const representation = buildSemanticRepresentation(record);
      
      console.log(`  Generating embedding for ${bookId}...`);
      const embeddingArray = await generateEmbedding(representation);

      const ai_metadata = {
        core_concepts: record.core_concepts || '',
        key_ideas: record.key_ideas || '',
        main_themes: record.main_themes || '',
        problems_addressed: record.problems_addressed || '',
        user_goals: record.user_goals || '',
        desired_outcomes: record.desired_outcomes || '',
        common_user_intents: record.common_user_intents || '',
        emotional_tone: record.emotional_tone || '',
        mood: record.mood || '',
        emotional_needs: record.emotional_needs || '',
        ideal_reader: record.ideal_reader || '',
        life_situations: record.life_situations || '',
        reading_experience: record.reading_experience || '',
        content_style: record.content_style || '',
        recommend_when: record.recommend_when || '',
        avoid_when: record.avoid_when || '',
        best_for: record.best_for || '',
        not_best_for: record.not_best_for || '',
        strong_match_signals: record.strong_match_signals || '',
        weak_match_signals: record.weak_match_signals || '',
        tellex_vibe_tags: record.tellex_vibe_tags ? record.tellex_vibe_tags.split(';').map(s=>s.trim()) : [],
        tellex_problem_tags: record.tellex_problem_tags ? record.tellex_problem_tags.split(';').map(s=>s.trim()) : [],
        tellex_goal_tags: record.tellex_goal_tags ? record.tellex_goal_tags.split(';').map(s=>s.trim()) : [],
        tellex_emotion_tags: record.tellex_emotion_tags ? record.tellex_emotion_tags.split(';').map(s=>s.trim()) : [],
        tellex_situation_tags: record.tellex_situation_tags ? record.tellex_situation_tags.split(';').map(s=>s.trim()) : [],
        practicality_score: Number(record.practicality_score) || 0,
        emotional_depth: Number(record.emotional_depth) || 0,
        philosophical_depth: Number(record.philosophical_depth) || 0,
        motivation_level: Number(record.motivation_level) || 0,
        intensity_level: Number(record.intensity_level) || 0
      };

      const semantic_search = {
        representation: representation,
        representation_version: 'book_semantic_v1',
        embedding_model: EMBEDDING_MODEL,
        embedding_generated_at: new Date().toISOString(),
        embedding: vector(embeddingArray)
      };

      const docRef = doc(db, 'books', bookId);
      await setDoc(docRef, { ai_metadata, semantic_search }, { merge: true });
      
      console.log(`  Uploaded ${bookId} successfully.`);
      successCount++;
    }

    console.log(`\nPhase 2 Import complete! Successfully updated ${successCount} books with vector embeddings.`);

  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    process.exit(0);
  }
}

importBooksPhase2();

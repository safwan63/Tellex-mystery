import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

dotenv.config();

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

const CSV_PATH = 'C:/Users/safwa/.gemini/antigravity/brain/75e2fb1d-b68b-4503-b5af-bb0203dc9f83/scratch/tellex_books_phase1.csv';

async function importBooks() {
  console.log('Connecting to Firebase Project:', firebaseConfig.projectId);

  try {
    console.log('Attempting to write to Firestore without auth (assuming test mode or public rules)...');

    // Read and parse CSV
    console.log('Reading CSV file from:', CSV_PATH);
    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
    
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`Found ${records.length} records to import.`);

    let successCount = 0;

    for (const record of records) {
      const bookId = record.book_id;
      if (!bookId) {
        console.warn('Skipping record without book_id:', record.title);
        continue;
      }

      // Convert array strings (separated by semicolons) into actual arrays
      const listFields = ['topics', 'themes', 'user_goals', 'problems_addressed', 'vibe_tags'];
      
      const firestoreData = { ...record };
      
      for (const field of listFields) {
        if (firestoreData[field]) {
          firestoreData[field] = firestoreData[field].split(';').map(s => s.trim()).filter(s => s);
        } else {
          firestoreData[field] = [];
        }
      }

      // Convert numeric fields
      const numericFields = ['publication_year', 'practicality_score', 'emotional_depth', 'philosophical_depth', 'motivation_level'];
      for (const field of numericFields) {
        if (firestoreData[field]) {
          firestoreData[field] = Number(firestoreData[field]);
        }
      }

      // Write to Firestore using book_id as the document ID
      const docRef = doc(db, 'books', bookId);
      await setDoc(docRef, firestoreData, { merge: true }); // Use merge to avoid deleting existing fields if updating
      
      console.log(`Successfully imported: ${bookId} - ${record.title}`);
      successCount++;
    }

    console.log(`\nImport complete! Successfully imported ${successCount} out of ${records.length} books.`);

  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    process.exit(0);
  }
}

importBooks();

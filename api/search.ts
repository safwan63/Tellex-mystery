import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Missing query string' });
    }

    // 1. Generate embedding for the search query
    const response = await ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents: query,
        config: {
            outputDimensionality: 768
        }
    });
    const queryVector = response.embeddings[0].values;

    // 2. Fetch all books
    // (Since the catalog is small, in-memory vector search is extremely fast and reliable)
    const booksRef = collection(db, 'books');
    const snapshot = await getDocs(booksRef);
    
    const results = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.semantic_search && data.semantic_search.embedding) {
        // Extract the vector values. Firebase VectorValue often has a toArray() method, 
        // or stores it as an array directly depending on the SDK version.
        const emb = data.semantic_search.embedding;
        const vectorValues = emb.toArray ? emb.toArray() : Array.isArray(emb) ? emb : null;
        
        if (vectorValues) {
          const similarity = cosineSimilarity(queryVector, vectorValues);
          results.push({
            id: doc.id,
            title: data.title,
            author: data.author,
            cover_url: data.cover_url,
            similarity,
            data: data
          });
        }
      }
    });

    // 3. Sort by descending similarity and return top 15 for Phase 4 ranking engine
    results.sort((a, b) => b.similarity - a.similarity);
    const topResults = results.slice(0, 15);

    res.status(200).json({ results: topResults });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

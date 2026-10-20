/**
 * Local API server for development.
 * Serves api/search.ts and api/recommend.ts on port 3001
 * so that Vite's proxy (port 5173 → 3001) can forward /api/* calls.
 * 
 * Run with: node api-server.mjs
 * (Requires: npm install -D express @google/genai firebase dotenv)
 */

import express from 'express';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Load env
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let env = {};
try {
  const envFile = readFileSync(path.join(__dirname, '.env'), 'utf-8');
  envFile.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
} catch {}

const app = express();
app.use(express.json());

// Dynamic import of compiled handlers
// Since api/*.ts use ESM + TS, we use ts-node via require with tsx
const require = createRequire(import.meta.url);

app.post('/api/search', async (req, res) => {
  try {
    const mod = await import('./api/search.ts?t=' + Date.now());
    return mod.default(req, res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/recommend', async (req, res) => {
  try {
    const mod = await import('./api/recommend.ts?t=' + Date.now());
    return mod.default(req, res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3001, () => console.log('API dev server running on http://localhost:3001'));

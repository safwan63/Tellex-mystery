/**
 * Local development API server
 * Serves api/search.ts and api/recommend.ts via Express + tsx
 * Vite proxies /api/* → http://localhost:3001
 *
 * Usage: npm run api:dev   (runs this file with tsx)
 */
import express from 'express';

const app = express();
app.use(express.json());

// POST /api/search
app.post('/api/search', async (req: express.Request, res: express.Response) => {
  try {
    // Dynamic import ensures .env is loaded first
    const mod = await import('./api/search');
    await mod.default(req, res);
  } catch (e: any) {
    console.error('[/api/search]', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/recommend
app.post('/api/recommend', async (req: express.Request, res: express.Response) => {
  try {
    const mod = await import('./api/recommend');
    await mod.default(req, res);
  } catch (e: any) {
    console.error('[/api/recommend]', e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 TELLEX API dev server ready at http://localhost:${PORT}`);
  console.log('   POST /api/search');
  console.log('   POST /api/recommend\n');
});

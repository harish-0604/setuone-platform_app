import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './src/server/routes.ts';
import { getDb } from './src/server/db.ts';

async function startServer() {
  // Ensure SQLite database and baseline seed data are initialized
  getDb();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Prevent stale browser/proxy caching on API and HTML routes
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Mount API routes
  app.use('/api', apiRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SetuOne server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

/**
 * VitaSync: Unified Full-Stack Server Entry Point
 * Mounts Express API routes under /api and Vite middlewares on Port 3000.
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './server/routes.js';
import { initializeSchema } from './server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // Allow the separately hosted Vercel frontend to call the API.
  app.use((req, res, next) => {
    const frontendOrigin = process.env.FRONTEND_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', frontendOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Initialize SQLite database
  initializeSchema();

  // Mount API router
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Frontend integration: Vite Middleware in dev, Static Files in prod
  if (isProduction) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Dynamic import of Vite for development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VitaSync] Server running at http://0.0.0.0:${PORT}`);
    console.log(`[VitaSync] API available at http://0.0.0.0:${PORT}/api`);
  });

  process.on('SIGTERM', () => {
    server.close(() => console.log('[VitaSync] Server terminated'));
  });
}

startServer().catch((err) => {
  console.error('[VitaSync] Fatal server error:', err);
  process.exit(1);
});

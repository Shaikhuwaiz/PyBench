import 'dotenv/config';
import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  handleEvaluateAnswer,
  handleEvaluateFollowUp,
  handleGenerateInterview,
  handleGenerateStudyPlan,
  sendJson,
} from './api/_handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  sendJson(res, 200, { ok: true });
});

app.post('/api/interview/generate', (req: Request, res: Response) =>
  handleGenerateInterview(req, res)
);

app.post('/api/interview/evaluate', (req: Request, res: Response) =>
  handleEvaluateAnswer(req, res)
);

app.post('/api/interview/followup', (req: Request, res: Response) =>
  handleEvaluateFollowUp(req, res)
);

app.post('/api/interview/study-plan', (req: Request, res: Response) =>
  handleGenerateStudyPlan(req, res)
);

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';
  if (process.env.K_SERVICE && process.env.DISABLE_HMR === undefined) {
    process.env.DISABLE_HMR = 'true';
  }
  const disableHmr = process.env.DISABLE_HMR === 'true';
  const httpServer = http.createServer(app);

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: disableHmr ? false : undefined,
      },
      appType: 'spa',
    });

    if (disableHmr) {
      app.get('/@vite/client', async (_req, res, next) => {
        try {
          const result = await vite.transformRequest('/@vite/client');
          if (!result?.code) {
            return next();
          }
          const patched = result.code.replace(
            'transport.connect(createHMRHandler(handleMessage));',
            'void 0;'
          );
          res.setHeader('Content-Type', 'application/javascript');
          res.send(patched);
        } catch {
          next();
        }
      });
    }

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`PyBench server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

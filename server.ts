import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listCases, loadApplication, loadGroundTruth, loadSidecar, loadExpectedBaselineOutput } from './src/server/repository.js';
import { verifyDocument, verifyCase } from './src/server/service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Correlation ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const cid = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
    res.setHeader('x-correlation-id', cid);
    next();
  });

  // Health checks
  app.get('/health/live', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.get('/health/ready', (_req: Request, res: Response) => {
    try {
      const cases = listCases();
      res.json({
        status: 'ready',
        offline_ocr: true,
        dataset_cases: cases.length,
      });
    } catch {
      res.status(500).json({ status: 'error', detail: 'unable to read dataset' });
    }
  });

  // v1 API
  app.get('/v1/cases', (_req: Request, res: Response) => {
    try {
      const cases = listCases().map(x => ({
        case_id: x.case_id,
        scenario: x.scenario,
        document_ids: x.document_ids,
      }));
      res.json(cases);
    } catch (err: any) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.post('/v1/documents/verify', (req: Request, res: Response) => {
    const docId = req.body?.document_id;
    if (typeof docId !== 'string' || docId.trim().length === 0) {
      return res.status(422).json({ detail: 'document_id must not be empty' });
    }
    if (docId.length < 3 || docId.length > 80) {
      return res.status(422).json({ detail: 'document_id must be between 3 and 80 characters' });
    }
    if (docId.includes('/') || docId.includes('\\') || docId.includes('..')) {
      return res.status(400).json({ detail: 'invalid identifier' });
    }

    try {
      const result = verifyDocument(docId);
      return res.json(result);
    } catch (err: any) {
      if (err.name === 'FileNotFoundError' || err.message === docId) {
        return res.status(404).json({ detail: `unknown synthetic identifier: ${docId}` });
      }
      if (err.message === 'invalid identifier') {
        return res.status(400).json({ detail: err.message });
      }
      return res.status(500).json({ detail: err.message });
    }
  });

  app.post('/v1/cases/:case_id/verify', (req: Request, res: Response) => {
    const caseId = req.params.case_id;
    if (!caseId || caseId.includes('/') || caseId.includes('\\') || caseId.includes('..')) {
      return res.status(400).json({ detail: 'invalid identifier' });
    }

    try {
      const result = verifyCase(caseId);
      return res.json(result);
    } catch (err: any) {
      if (err.name === 'FileNotFoundError' || err.message === caseId) {
        return res.status(404).json({ detail: `unknown synthetic identifier: ${caseId}` });
      }
      if (err.message === 'invalid identifier') {
        return res.status(400).json({ detail: err.message });
      }
      return res.status(500).json({ detail: err.message });
    }
  });

  // Static document images
  app.use('/data/input_documents', express.static(path.join(ROOT, 'data/input_documents')));

  // Extended API for interactive dashboard
  app.get('/api/cases', (_req: Request, res: Response) => {
    try {
      const cases = listCases().map(c => {
        const expected = loadExpectedBaselineOutput(c.case_id);
        return {
          ...c,
          expected_baseline: expected,
        };
      });
      res.json(cases);
    } catch (err: any) {
      res.status(500).json({ detail: err.message });
    }
  });

  app.get('/api/cases/:case_id', (req: Request, res: Response) => {
    const caseId = req.params.case_id;
    try {
      const appData = loadApplication(caseId);
      const expected = loadExpectedBaselineOutput(caseId);
      const docs = appData.document_ids.map(docId => {
        let sidecar = '';
        let groundTruth = null;
        try {
          sidecar = loadSidecar(docId);
        } catch {}
        try {
          groundTruth = loadGroundTruth(docId);
        } catch {}
        return {
          document_id: docId,
          sidecar,
          ground_truth: groundTruth,
          image_url: `/data/input_documents/${docId}.png`,
        };
      });
      res.json({
        ...appData,
        expected,
        documents_detail: docs,
      });
    } catch (err: any) {
      if (err.name === 'FileNotFoundError') {
        return res.status(404).json({ detail: `case not found: ${caseId}` });
      }
      res.status(500).json({ detail: err.message });
    }
  });

  app.get('/api/documents/:document_id', (req: Request, res: Response) => {
    const docId = req.params.document_id;
    try {
      const sidecar = loadSidecar(docId);
      let groundTruth = null;
      try {
        groundTruth = loadGroundTruth(docId);
      } catch {}
      res.json({
        document_id: docId,
        sidecar,
        ground_truth: groundTruth,
        image_url: `/data/input_documents/${docId}.png`,
      });
    } catch (err: any) {
      if (err.name === 'FileNotFoundError') {
        return res.status(404).json({ detail: `document not found: ${docId}` });
      }
      res.status(500).json({ detail: err.message });
    }
  });

  // In development, hook up Vite middleware; in production, serve built static assets
  const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync(path.join(ROOT, 'dist'));
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(ROOT, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(ROOT, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI FDE Brownfield KYC Service running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

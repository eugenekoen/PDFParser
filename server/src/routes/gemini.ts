import { Router, Request, Response } from 'express';
import multer from 'multer';
import { GeminiService } from '../services/geminiService';
import { parsePdfBuffer } from '../services/pdfService';

export const geminiRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
});

// Check status & whether server .env key is configured
geminiRouter.get('/status', async (_req: Request, res: Response): Promise<void> => {
  const hasServerKey = GeminiService.hasServerKey();
  if (!hasServerKey) {
    res.json({
      hasServerKey: false,
      models: [],
      recommendedModel: 'gemini-3.8-flash',
    });
    return;
  }

  try {
    const data = await GeminiService.getAvailableModels();
    res.json(data);
  } catch (err: any) {
    res.json({
      hasServerKey: true,
      models: [],
      recommendedModel: 'gemini-3.8-flash',
      error: err.message,
    });
  }
});

// Query live models for a given key or server key
geminiRouter.post('/models', async (req: Request, res: Response): Promise<void> => {
  const { apiKey } = req.body;
  try {
    const data = await GeminiService.getAvailableModels(apiKey);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test connection
geminiRouter.post('/test', async (req: Request, res: Response): Promise<void> => {
  const { apiKey, model } = req.body;
  try {
    const result = await GeminiService.testConnection(apiKey, model);
    res.json({
      status: 'connected',
      model: result.model,
      models: result.models,
      usingServerKey: result.usingServerKey,
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Direct PDF extraction
geminiRouter.post(
  '/extract-pdf',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No PDF file uploaded.' });
        return;
      }

      const apiKey = (req.headers['x-gemini-api-key'] as string) || req.body.apiKey;
      const model = req.body.model || 'gemini-3.8-flash';

      let parsedPdf: any = null;
      try {
        parsedPdf = await parsePdfBuffer(req.file.buffer, req.file.originalname);
      } catch (e) {
        console.warn('Local pdf-parse warning:', e);
      }

      const extraction = await GeminiService.extractFromPdfBuffer(
        req.file.buffer,
        apiKey,
        model
      );

      res.json({
        filename: req.file.originalname,
        transactions: extraction.transactions,
        rawModelResponse: extraction.rawResponse,
        modelUsed: extraction.modelUsed,
        parsedPdf,
      });
    } catch (err: any) {
      console.error('Error in Gemini PDF extraction:', err);
      res.status(500).json({ error: err.message || 'Gemini PDF processing failed' });
    }
  }
);

// Text extraction
geminiRouter.post('/extract-text', async (req: Request, res: Response): Promise<void> => {
  const { text, apiKey, model } = req.body;
  if (!text || text.trim().length === 0) {
    res.status(400).json({ error: 'Text content is required' });
    return;
  }

  try {
    const result = await GeminiService.extractFromText(
      text,
      apiKey,
      model || 'gemini-3.8-flash'
    );
    res.json({
      transactions: result.transactions,
      rawModelResponse: result.rawResponse,
      modelUsed: result.modelUsed,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gemini text extraction failed' });
  }
});

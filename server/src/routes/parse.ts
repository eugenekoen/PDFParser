import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parsePdfBuffer } from '../services/pdfService';

export const parseRouter = Router();

// Store uploaded files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB max
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported.'));
    }
  },
});

parseRouter.post('/parse-pdf', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No PDF file uploaded.' });
      return;
    }

    const result = await parsePdfBuffer(req.file.buffer, req.file.originalname);
    res.json(result);
  } catch (err: any) {
    console.error('Error parsing PDF:', err);
    res.status(500).json({ error: err.message || 'Failed to parse PDF.' });
  }
});

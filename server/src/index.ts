import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { parseRouter } from './routes/parse';
import { geminiRouter } from './routes/gemini';
import { exportRouter } from './routes/export';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', parseRouter);
app.use('/api/gemini', geminiRouter);
app.use('/api/export', exportRouter);

app.listen(PORT, () => {
  console.log(`[PDFParser Server] running on http://localhost:${PORT}`);
});

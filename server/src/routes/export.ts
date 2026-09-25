import { Router, Request, Response } from 'express';
import { CsvService } from '../services/csvService';
import { Transaction } from '../types/statement';

export const exportRouter = Router();

exportRouter.post('/csv', (req: Request, res: Response): void => {
  const { transactions, filename } = req.body;

  if (!Array.isArray(transactions)) {
    res.status(400).json({ error: 'Transactions array is required.' });
    return;
  }

  const csvContent = CsvService.generateCsv(transactions as Transaction[]);
  const outName = (filename || 'bank_statement').replace(/\.[^/.]+$/, '') + '.csv';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
  res.send(csvContent);
});

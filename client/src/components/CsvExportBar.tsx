import React, { useState } from 'react';
import { Download, Copy, Check, Eye, EyeOff, FileSpreadsheet } from 'lucide-react';
import type { Transaction } from '../types';
import { formatCsvLocally, triggerDownload } from '../services/api';

interface CsvExportBarProps {
  transactions: Transaction[];
  filename: string;
}

export const CsvExportBar: React.FC<CsvExportBarProps> = ({ transactions, filename }) => {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const csvContent = formatCsvLocally(transactions);

  const handleDownload = () => {
    const baseName = filename.replace(/\.[^/.]+$/, '');
    triggerDownload(csvContent, `${baseName}_converted.csv`);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(csvContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = csvContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="card export-card">
      <div className="export-header">
        <div className="export-title-wrap">
          <div className="icon-badge icon-cyan">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h3 className="card-title">3. Export Clean 5-Column CSV</h3>
            <p className="card-subtitle">
              Ready for immediate import into your processing application
            </p>
          </div>
        </div>

        <div className="csv-spec-pill">
          <span>Schema:</span>
          <code>Date, Description, Debit, Credit, Balance</code>
        </div>
      </div>

      <div className="export-actions-row">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={handleDownload}
          disabled={transactions.length === 0}
        >
          <Download size={18} />
          Download CSV File
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-lg"
          onClick={handleCopy}
          disabled={transactions.length === 0}
        >
          {copied ? <Check size={18} className="icon-emerald" /> : <Copy size={18} />}
          {copied ? 'Copied to Clipboard!' : 'Copy CSV Text'}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setShowPreview(!showPreview)}
          disabled={transactions.length === 0}
        >
          {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
          {showPreview ? 'Hide CSV Preview' : 'Preview CSV Output'}
        </button>
      </div>

      {showPreview && transactions.length > 0 && (
        <div className="csv-preview-container">
          <div className="csv-preview-header">
            <span>Standard RFC-4180 CSV Plain Text:</span>
          </div>
          <pre className="csv-preview-text">{csvContent}</pre>
        </div>
      )}
    </div>
  );
};

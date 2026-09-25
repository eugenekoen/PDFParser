import React, { useState } from 'react';
import { Loader2, StopCircle, Terminal, ChevronDown, ChevronUp, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface ProcessingProgressProps {
  currentPage: number;
  totalPages: number;
  transactionsCount: number;
  currentStatusText: string;
  logs: { page: number; status: 'pending' | 'success' | 'error'; message: string; rawResponse?: string }[];
  onAbort: () => void;
  onRetry?: () => void;
  isFinished: boolean;
  hasError?: boolean;
}

export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({
  currentPage,
  totalPages,
  transactionsCount,
  currentStatusText,
  logs,
  onAbort,
  onRetry,
  isFinished,
  hasError = false,
}) => {
  const [showLogs, setShowLogs] = useState(false);
  const percent = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  return (
    <div className={`card progress-card ${hasError ? 'border-rose' : ''}`}>
      <div className="progress-header">
        <div className="progress-info">
          {hasError ? (
            <AlertCircle size={26} className="icon-rose" />
          ) : !isFinished ? (
            <Loader2 size={24} className="spin icon-cyan" />
          ) : (
            <CheckCircle size={24} className="icon-emerald" />
          )}
          <div>
            <h3 className="progress-title">
              {hasError ? 'Extraction Interrupted' : isFinished ? 'Extraction Complete!' : 'Processing with Google Gemini...'}
            </h3>
            <p className="progress-subtitle">{currentStatusText}</p>
          </div>
        </div>

        <div className="progress-actions">
          {hasError && onRetry && (
            <button type="button" className="btn btn-primary" onClick={onRetry}>
              <RefreshCw size={16} /> Retry Extraction
            </button>
          )}

          {!isFinished && !hasError && (
            <button type="button" className="btn btn-danger-outline" onClick={onAbort}>
              <StopCircle size={16} /> Stop Processing
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {!hasError && (
        <div className="progress-bar-track">
          <div
            className={`progress-bar-fill ${isFinished ? 'complete' : ''}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {hasError ? (
        <div className="demand-retry-notice">
          <span>⚠️ If the model is experiencing high demand, clicking <strong>Retry Extraction</strong> will automatically attempt fallback models.</span>
        </div>
      ) : (
        <div className="progress-stats">
          <span>Progress: {currentPage} / {totalPages} pages ({percent}%)</span>
          <span className="highlight-emerald">Transactions Extracted: {transactionsCount}</span>
        </div>
      )}

      {/* Expandable Model Response Log */}
      {logs.length > 0 && (
        <div className="logs-accordion">
          <button
            type="button"
            className="logs-toggle-btn"
            onClick={() => setShowLogs(!showLogs)}
          >
            <div className="logs-toggle-title">
              <Terminal size={15} />
              <span>Gemini Model Logs ({logs.length})</span>
            </div>
            {showLogs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showLogs && (
            <div className="logs-content">
              {logs.map((log, idx) => (
                <div key={idx} className={`log-entry ${log.status}`}>
                  <div className="log-line">
                    {log.status === 'success' && <CheckCircle size={14} className="icon-emerald" />}
                    {log.status === 'error' && <AlertCircle size={14} className="icon-rose" />}
                    {log.status === 'pending' && <Loader2 size={14} className="spin icon-cyan" />}
                    <span className="log-page">Page {log.page}:</span>
                    <span className="log-msg">{log.message}</span>
                  </div>
                  {log.rawResponse && (
                    <pre className="log-raw-box">{log.rawResponse}</pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

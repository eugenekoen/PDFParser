import React, { useState } from 'react';
import { Loader2, StopCircle, Terminal, ChevronDown, ChevronUp, CheckCircle, AlertCircle, RefreshCw, Cpu } from 'lucide-react';

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
  currentModel?: string;
  onSelectModel?: (model: string) => void;
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
  currentModel = 'gemini-3.8-flash',
  onSelectModel,
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
              {hasError ? 'Extraction Interrupted (High Demand Spike)' : isFinished ? 'Extraction Complete!' : 'Processing with Google Gemini...'}
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
        <div className="demand-retry-notice" style={{ marginTop: '0.75rem', padding: '0.85rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.88rem', color: '#fca5a5', fontWeight: 500 }}>
                ⚠️ High traffic queue detected on {currentModel}. Switch model to bypass:
              </span>
              {onSelectModel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Cpu size={15} className="icon-cyan" />
                  <select
                    value={currentModel}
                    onChange={(e) => onSelectModel(e.target.value)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      background: '#0f172a',
                      color: '#38bdf8',
                      border: '1px solid #38bdf8',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="gemini-3.8-flash">gemini-3.8-flash (Latest)</option>
                    <option value="gemini-3.7-flash">gemini-3.7-flash (High Stability)</option>
                    <option value="gemini-3.6-flash">gemini-3.6-flash</option>
                    <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                    <option value="gemini-flash-latest">gemini-flash-latest</option>
                    <option value="gemini-pro-latest">gemini-pro-latest (Pro)</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                  </select>
                </div>
              )}
            </div>

            {onRetry && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onRetry}
                style={{ marginLeft: 'auto' }}
              >
                <RefreshCw size={14} /> Retry with {currentModel}
              </button>
            )}
          </div>
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

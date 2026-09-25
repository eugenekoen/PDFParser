import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Key,
  ExternalLink,
  Check,
} from 'lucide-react';
import type { AppSettings, GeminiModelInfo } from '../types';
import { testGeminiConnection, fetchGeminiStatus } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model || 'gemini-3.8-flash');
  const [availableModels, setAvailableModels] = useState<GeminiModelInfo[]>([]);
  const [hasServerKey, setHasServerKey] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Check server key and auto-fetch models when opened
  useEffect(() => {
    if (isOpen) {
      fetchGeminiStatus()
        .then((res) => {
          setHasServerKey(res.hasServerKey);
          if (res.models && res.models.length > 0) {
            setAvailableModels(res.models);
            if (!settings.model || settings.model.includes('2.5-flash') && !settings.model.includes('lite')) {
              setModel(res.recommendedModel || 'gemini-3.8-flash');
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, settings.model]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await testGeminiConnection(apiKey, model);
      if (res.models && res.models.length > 0) {
        setAvailableModels(res.models);
      }
      setModel(res.model);
      setTestResult({
        success: true,
        message: `Connected successfully using ${res.model}! (Found ${res.models?.length || 0} active models${res.usingServerKey ? ' via server .env key' : ''})`,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to connect to Google Gemini API',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSave({
      apiKey,
      model: model || 'gemini-3.8-flash',
    });
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title">
            <Sparkles size={20} className="icon-cyan" />
            <h3>Google Gemini Settings</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Server Key Status Badge */}
          {hasServerKey ? (
            <div className="server-key-badge">
              <Check size={16} className="icon-emerald" />
              <div>
                <strong>Company API Key Active:</strong>
                <span>Configured in <code>server/.env</code>. Staff do not need to enter an API key below unless using a personal override.</span>
              </div>
            </div>
          ) : (
            <div className="info-box">
              <Sparkles size={18} className="icon-cyan" />
              <div>
                <strong>1,000,000+ Token Context & Native OCR:</strong>
                <p>
                  Directly reads digital and scanned PDFs in seconds with zero PC memory load.
                </p>
              </div>
            </div>
          )}

          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">
                <Key size={15} /> API Key Override (Optional)
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="api-key-link"
              >
                Get Free API Key <ExternalLink size={12} />
              </a>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasServerKey ? "Using company key from server/.env" : "Paste your Google AI Studio API key"}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">
                <Sparkles size={15} /> Active Model
              </label>
              <span className="auto-detected-pill">Auto-Selected Latest</span>
            </div>

            {availableModels.length > 0 ? (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="form-select"
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gemini-3.8-flash"
                className="form-input"
              />
            )}
            <span className="form-hint">
              Current recommended Flash model for bank statements is <strong>gemini-3.8-flash</strong>.
            </span>
          </div>

          {testResult && (
            <div className={`status-banner ${testResult.success ? 'success' : 'error'}`}>
              {testResult.success ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? (
              <>
                <RefreshCw size={16} className="spin" /> Checking Models...
              </>
            ) : (
              <>
                <RefreshCw size={16} /> Test & Refresh Models
              </>
            )}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

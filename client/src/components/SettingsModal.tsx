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
  Eye,
  EyeOff,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import type { AppSettings, GeminiModelInfo } from '../types';
import { testGeminiConnection, fetchGeminiStatus, fetchGeminiModels } from '../services/api';
import { getStoredApiKey } from '../services/crypto';

export const POPULAR_GEMINI_MODELS: GeminiModelInfo[] = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Latest, Recommended)', description: 'Fastest multimodal OCR with 1M+ context' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (High Stability)', description: 'Proven stability when latest model has spikes' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', description: 'Fast Flash model' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', description: 'Reliable Flash model' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', description: 'Tracks latest stable Flash deployment' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (Low Demand Queue)', description: 'Ultra-low latency with separate queue capacity' },
  { id: 'gemini-3.8-pro', name: 'Gemini 3.8 Pro (Maximum Intelligence)', description: 'Best for highly complex or distorted statement layouts' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'High reasoning alternative' },
];

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
  const [availableModels, setAvailableModels] = useState<GeminiModelInfo[]>(POPULAR_GEMINI_MODELS);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [isPassphraseUnlocked, setIsPassphraseUnlocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const mergeModels = (incoming: GeminiModelInfo[]) => {
    setAvailableModels((prev) => {
      const map = new Map<string, GeminiModelInfo>();
      for (const m of prev) {
        map.set(m.id, m);
      }
      for (const m of incoming) {
        if (!map.has(m.id)) {
          map.set(m.id, m);
        }
      }
      return Array.from(map.values());
    });
  };

  // Synchronize unlocked key and auto-fetch models when opened
  useEffect(() => {
    if (isOpen) {
      const storedKey = getStoredApiKey();
      const effectiveKey = settings.apiKey || storedKey || '';
      setApiKey(effectiveKey);
      setIsPassphraseUnlocked(Boolean(storedKey));
      setModel(settings.model || 'gemini-3.8-flash');
      setTestResult(null);

      // Check server key status
      fetchGeminiStatus()
        .then((res) => {
          setHasServerKey(res.hasServerKey);
          if (res.models && res.models.length > 0) {
            mergeModels(res.models);
          }
        })
        .catch(() => {});

      // If active key is available, query live models
      if (effectiveKey) {
        fetchGeminiModels(effectiveKey)
          .then((res) => {
            if (res.models && res.models.length > 0) {
              mergeModels(res.models);
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, settings.apiKey, settings.model]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    const keyToTest = apiKey.trim() || getStoredApiKey();

    try {
      const res = await testGeminiConnection(keyToTest, model);
      if (res.models && res.models.length > 0) {
        mergeModels(res.models);
      }
      setTestResult({
        success: true,
        message: `Connected successfully using ${model}! Live connection verified.`,
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
    const finalKey = apiKey.trim();
    onSave({
      apiKey: finalKey,
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
            <h3>Google Gemini Settings & Model Selection</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Key Status Pill */}
          {isPassphraseUnlocked ? (
            <div className="server-key-badge" style={{ borderColor: 'rgba(52, 211, 153, 0.4)', background: 'rgba(16, 185, 129, 0.1)' }}>
              <ShieldCheck size={18} className="icon-emerald" />
              <div>
                <strong>Company Access Passphrase Unlocked:</strong>
                <span>The decrypted Gemini API key is active in your browser memory and loaded below.</span>
              </div>
            </div>
          ) : hasServerKey ? (
            <div className="server-key-badge">
              <Check size={16} className="icon-emerald" />
              <div>
                <strong>Server .env API Key Active:</strong>
                <span>Configured on local machine backend.</span>
              </div>
            </div>
          ) : (
            <div className="info-box">
              <Sparkles size={18} className="icon-cyan" />
              <div>
                <strong>Select Model or Enter API Key:</strong>
                <p>
                  Choose your preferred model below. Switch models anytime to bypass high-demand server queues.
                </p>
              </div>
            </div>
          )}

          {/* Model Selector */}
          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">
                <Cpu size={15} className="icon-cyan" /> Select Active Gemini Model
              </label>
              <span className="auto-detected-pill">Switch Anytime</span>
            </div>

            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="form-select"
              style={{ fontSize: '0.95rem', fontWeight: 500 }}
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.id})
                </option>
              ))}
            </select>
            
            <div className="model-tip-banner" style={{ marginTop: '0.5rem', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', fontSize: '0.82rem', color: '#93c5fd' }}>
              💡 <strong>High Demand Tip:</strong> If <code>gemini-3.8-flash</code> experiences high-demand spikes (HTTP 503), switch here to <strong>gemini-3.7-flash</strong> or <strong>gemini-2.5-flash-lite</strong> to bypass the queue.
            </div>
          </div>

          {/* API Key Input */}
          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <div className="form-label-row">
              <label className="form-label">
                <Key size={15} /> Google Gemini API Key
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

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasServerKey ? "Using company key from server/.env" : "Paste your Google AI Studio API key"}
                className="form-input"
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={showPassword ? 'Hide key' : 'Show key'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span className="form-hint">
              {isPassphraseUnlocked 
                ? 'Key automatically populated from your passphrase unlock. You can edit or change it if needed.' 
                : 'Leave blank to use server .env key, or paste your key here.'}
            </span>
          </div>

          {testResult && (
            <div className={`status-banner ${testResult.success ? 'success' : 'error'}`} style={{ marginTop: '1rem' }}>
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
            disabled={testing || (!apiKey.trim() && !hasServerKey && !isPassphraseUnlocked)}
          >
            {testing ? (
              <>
                <RefreshCw size={16} className="spin" /> Verifying Model...
              </>
            ) : (
              <>
                <RefreshCw size={16} /> Test Model Connection
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

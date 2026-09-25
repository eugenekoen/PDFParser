import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SettingsModal } from './components/SettingsModal';
import { PassphraseModal } from './components/PassphraseModal';
import { FileUpload } from './components/FileUpload';
import { ProcessingProgress } from './components/ProcessingProgress';
import { TransactionTable } from './components/TransactionTable';
import { CsvExportBar } from './components/CsvExportBar';
import type { AppSettings, Transaction } from './types';
import {
  fetchGeminiStatus,
  testGeminiConnection,
  extractTransactionsWithGeminiPdf,
} from './services/api';
import {
  hasEncryptedPayload,
  getStoredApiKey,
  clearUnlockedApiKey,
} from './services/crypto';
import { Sparkles, FileText, KeyRound, Cpu } from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: (import.meta.env.VITE_GEMINI_API_KEY as string) || getStoredApiKey() || '',
  model: 'gemini-3.6-flash',
};

export const App: React.FC = () => {
  // Load settings safely
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('pdfparser_app_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const key = parsed.apiKey || getStoredApiKey() || (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
          let model = parsed.model || 'gemini-3.6-flash';
          if (model.includes('2.5') || model === 'gemini-3.8-flash') {
            model = 'gemini-3.6-flash';
          }
          return { apiKey: key, model };
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  });

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isPassphraseOpen, setIsPassphraseOpen] = useState<boolean>(false);

  // Passphrase encryption status
  const hasEncrypted = hasEncryptedPayload();
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return Boolean(getStoredApiKey() || settings.apiKey);
  });

  // Active uploaded file
  const [activeFile, setActiveFile] = useState<File | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingState, setProcessingState] = useState<{
    currentPage: number;
    totalPages: number;
    statusText: string;
    isFinished: boolean;
    logs: { page: number; status: 'pending' | 'success' | 'error'; message: string; rawResponse?: string }[];
  }>({
    currentPage: 0,
    totalPages: 0,
    statusText: '',
    isFinished: false,
    logs: [],
  });

  // Extracted transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Auto-discover models and verify connection on mount or key change
  useEffect(() => {
    fetchGeminiStatus()
      .then((status) => {
        if (status.hasServerKey || settings.apiKey) {
          setIsConnected(true);
          if (status.hasServerKey) {
            setIsUnlocked(true);
          }
          if (status.recommendedModel && settings.model !== status.recommendedModel) {
            setSettings((prev) => ({
              ...prev,
              model: status.recommendedModel,
            }));
          }
        } else {
          setIsConnected(false);
        }
      })
      .catch(() => {
        if (settings.apiKey) {
          testGeminiConnection(settings.apiKey, settings.model)
            .then(() => {
              setIsConnected(true);
              setIsUnlocked(true);
            })
            .catch(() => setIsConnected(false));
        } else {
          setIsConnected(false);
        }
      });
  }, [settings.apiKey]);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('pdfparser_app_settings', JSON.stringify(newSettings));
  };

  const handleModelSelect = (newModel: string) => {
    const updated = { ...settings, model: newModel };
    setSettings(updated);
    localStorage.setItem('pdfparser_app_settings', JSON.stringify(updated));
  };

  const handlePassphraseSuccess = (unlockedKey: string) => {
    setIsUnlocked(true);
    const updated = {
      ...settings,
      apiKey: unlockedKey,
    };
    setSettings(updated);
    localStorage.setItem('pdfparser_app_settings', JSON.stringify(updated));
    testGeminiConnection(unlockedKey, settings.model)
      .then(() => setIsConnected(true))
      .catch(() => {});
  };

  const handleLockApp = () => {
    clearUnlockedApiKey();
    setIsUnlocked(false);
    setSettings((prev) => ({
      ...prev,
      apiKey: '',
    }));
    setIsConnected(false);
  };

  // Direct Extraction from File
  const handleExtractFile = async (file: File, modelOverride?: string) => {
    // If locked and encrypted payload exists, prompt for passphrase
    if (!isConnected && hasEncrypted && !isUnlocked) {
      setIsPassphraseOpen(true);
      return;
    }

    setActiveFile(file);
    setIsProcessing(true);
    setTransactions([]);
    const activeModel = modelOverride || settings.model || 'gemini-3.8-flash';
    if (modelOverride && modelOverride !== settings.model) {
      handleModelSelect(modelOverride);
    }

    setProcessingState({
      currentPage: 1,
      totalPages: 1,
      statusText: `Sending statement to Google Gemini (${activeModel}) for visual OCR and extraction...`,
      isFinished: false,
      logs: [
        {
          page: 1,
          status: 'pending',
          message: `Gemini (${activeModel}) is reading document layout, running visual OCR, and extracting transactions...`,
        },
      ],
    });

    try {
      const effectiveSettings: AppSettings = {
        ...settings,
        model: activeModel,
      };
      const res = await extractTransactionsWithGeminiPdf(file, effectiveSettings);
      setTransactions(res.transactions);

      setProcessingState({
        currentPage: 1,
        totalPages: 1,
        statusText: `Extraction complete! Extracted ${res.transactions.length} transaction(s) using ${res.modelUsed || activeModel}.`,
        isFinished: true,
        logs: [
          {
            page: 1,
            status: 'success',
            message: `Successfully extracted ${res.transactions.length} transactions via ${res.modelUsed || activeModel}.`,
            rawResponse: res.rawModelResponse,
          },
        ],
      });
    } catch (err: any) {
      setProcessingState({
        currentPage: 1,
        totalPages: 1,
        statusText: `Error: ${err.message || err}`,
        isFinished: true,
        logs: [
          {
            page: 1,
            status: 'error',
            message: err.message || 'Gemini processing failed',
          },
        ],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAbort = () => {
    setIsProcessing(false);
  };

  // Transaction table adjustments
  const handleUpdateTransaction = (id: string, field: keyof Transaction, value: any) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddTransaction = () => {
    const newTx: Transaction = {
      id: `manual_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      description: 'New Transaction',
      debit: null,
      credit: null,
      balance: null,
    };
    setTransactions((prev) => [newTx, ...prev]);
  };

  return (
    <div className="app-layout">
      <Navbar
        settings={settings}
        isConnected={isConnected}
        isUnlocked={isUnlocked}
        hasEncryptedConfig={hasEncrypted}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPassphrase={() => setIsPassphraseOpen(true)}
      />

      <main className="main-content">
        <div className="container">
          {/* Hero Instructions */}
          <div className="hero-banner">
            <h2 className="hero-title">Bank Statement to 5-Column CSV (ZAR)</h2>
            <p className="hero-desc">
              Powered by Google Gemini ({settings.model || 'gemini-3.8-flash'}) with 1,000,000+ token context and native visual OCR.
            </p>
          </div>

          {/* Quick Model Selector & Status Bar */}
          <div className="active-model-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.75rem 1.25rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <Cpu size={18} className="icon-cyan" />
              <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>Active Model:</span>
              <select
                value={settings.model || 'gemini-3.8-flash'}
                onChange={(e) => handleModelSelect(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  background: '#0f172a',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
                title="Select Gemini model to parse bank statements"
              >
                <option value="gemini-3.6-flash">gemini-3.6-flash (Fast & Immediate Capacity - Recommended)</option>
                <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Ultra Fast / Low Traffic)</option>
                <option value="gemini-3.7-flash">gemini-3.7-flash</option>
                <option value="gemini-3.8-flash">gemini-3.8-flash (High Demand Queue)</option>
                <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                <option value="gemini-flash-latest">gemini-flash-latest</option>
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                <option value="gemini-pro-latest">gemini-pro-latest</option>
              </select>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsSettingsOpen(true)}
              style={{ fontSize: '0.82rem' }}
            >
              <Sparkles size={14} className="icon-cyan" /> Settings & API Key
            </button>
          </div>

          {/* Passphrase Reminder if locked */}
          {!isConnected && hasEncrypted && !isUnlocked && (
            <div className="locked-banner" onClick={() => setIsPassphraseOpen(true)}>
              <KeyRound size={20} className="icon-cyan" />
              <div className="locked-banner-text">
                <strong>Company Access Locked:</strong>
                <span>Click here to enter the company passphrase and unlock Gemini AI on this device.</span>
              </div>
            </div>
          )}

          {/* Upload PDF */}
          <FileUpload
            onFileSelect={handleExtractFile}
            isLoading={isProcessing}
            currentFilename={activeFile?.name}
          />

          {/* Re-extract trigger if file is loaded and not processing */}
          {activeFile && !isProcessing && transactions.length > 0 && (
            <div className="file-reprocess-bar">
              <div className="file-info-badge">
                <FileText size={16} className="icon-cyan" />
                <span>Active Statement: <strong>{activeFile.name}</strong> ({(activeFile.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleExtractFile(activeFile)}
              >
                <Sparkles size={14} /> Re-Extract with {settings.model || 'gemini-3.8-flash'}
              </button>
            </div>
          )}

          {/* Processing Progress & Logs */}
          {(isProcessing || processingState.logs.length > 0) && (
            <ProcessingProgress
              currentPage={processingState.currentPage}
              totalPages={processingState.totalPages}
              transactionsCount={transactions.length}
              currentStatusText={processingState.statusText}
              logs={processingState.logs}
              onAbort={handleAbort}
              onRetry={activeFile ? () => handleExtractFile(activeFile) : undefined}
              isFinished={processingState.isFinished}
              hasError={processingState.logs.some((l) => l.status === 'error')}
              currentModel={settings.model || 'gemini-3.8-flash'}
              onSelectModel={handleModelSelect}
            />
          )}

          {/* Step 2: Editable Transaction Table */}
          {transactions.length > 0 && (
            <>
              <TransactionTable
                transactions={transactions}
                onUpdateTransaction={handleUpdateTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onAddTransaction={handleAddTransaction}
              />

              {/* Step 3: CSV Export Section */}
              <CsvExportBar
                transactions={transactions}
                filename={activeFile?.name || 'statement'}
              />
            </>
          )}
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <PassphraseModal
        isOpen={isPassphraseOpen}
        onClose={() => setIsPassphraseOpen(false)}
        onSuccess={handlePassphraseSuccess}
        isUnlocked={isUnlocked}
        onLock={handleLockApp}
      />
    </div>
  );
};
export default App;

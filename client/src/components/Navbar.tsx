import React from 'react';
import { FileSpreadsheet, Sparkles, ShieldCheck, AlertCircle, Lock, Unlock } from 'lucide-react';
import type { AppSettings } from '../types';

interface NavbarProps {
  settings: AppSettings;
  isConnected: boolean;
  isUnlocked: boolean;
  hasEncryptedConfig: boolean;
  onOpenSettings: () => void;
  onOpenPassphrase: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  isConnected,
  isUnlocked,
  hasEncryptedConfig,
  onOpenSettings,
  onOpenPassphrase,
}) => {
  return (
    <header className="navbar">
      <div className="nav-container">
        <div className="brand">
          <div className="brand-icon">
            <FileSpreadsheet className="icon" size={24} />
          </div>
          <div>
            <h1 className="brand-title">Bank Statement Parser</h1>
            <p className="brand-subtitle">
              Google Gemini 1M+ Context & Native Multimodal OCR
            </p>
          </div>
        </div>

        <div className="nav-actions">
          {hasEncryptedConfig && (
            <button
              onClick={onOpenPassphrase}
              className={`connection-pill ${isUnlocked ? 'connected' : 'disconnected'}`}
              title={isUnlocked ? 'Company access unlocked' : 'Click to unlock with company passphrase'}
            >
              {isUnlocked ? <Unlock size={14} className="icon-emerald" /> : <Lock size={14} className="text-warning" />}
              <span>{isUnlocked ? 'Unlocked' : 'Unlock App'}</span>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className={`connection-pill ${isConnected ? 'connected' : 'disconnected'}`}
            title="Click to configure Google Gemini model & API key"
          >
            <Sparkles size={16} className="icon-cyan" />
            <span className="pill-host">Google Gemini</span>
            <span className="pill-divider">•</span>
            <span className="pill-model">{settings.model || 'gemini-3.8-flash'}</span>
            <span className="status-indicator">
              {isConnected ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

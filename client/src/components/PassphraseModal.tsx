import React, { useState } from 'react';
import { Lock, Unlock, KeyRound, CheckCircle2, AlertTriangle, X, ShieldCheck } from 'lucide-react';
import { decryptApiKeyWithPassphrase } from '../services/crypto';

interface PassphraseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (unlockedKey: string) => void;
  isUnlocked: boolean;
  onLock: () => void;
}

export const PassphraseModal: React.FC<PassphraseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isUnlocked,
  onLock,
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const apiKey = await decryptApiKeyWithPassphrase(passphrase);
      setSuccessMsg('Successfully unlocked! Company Gemini access is now active on this device.');
      onSuccess(apiKey);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Incorrect passphrase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title">
            <KeyRound size={20} className="icon-cyan" />
            <h3>Company Access Passphrase</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {isUnlocked ? (
            <div className="unlocked-status-card">
              <ShieldCheck size={36} className="icon-emerald" />
              <h4>App is Currently Unlocked</h4>
              <p>
                Company Gemini credentials have been decrypted in this browser. You can freely process statements.
              </p>
              <button
                type="button"
                className="btn btn-danger-outline btn-sm"
                onClick={() => {
                  onLock();
                  onClose();
                }}
              >
                <Lock size={14} /> Relock App on this PC
              </button>
            </div>
          ) : (
            <form onSubmit={handleUnlock} className="passphrase-form">
              <div className="info-box">
                <Lock size={18} className="icon-cyan" />
                <div>
                  <strong>Zero-Leak Passphrase Protection:</strong>
                  <p>
                    Enter the company passphrase to decrypt the Gemini API key locally in your browser memory.
                  </p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Company Passphrase</label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter passphrase"
                  className="form-input"
                  autoFocus
                />
              </div>

              {error && (
                <div className="status-banner error">
                  <AlertTriangle size={18} />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="status-banner success">
                  <CheckCircle2 size={18} />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="modal-footer" style={{ padding: '1rem 0 0', background: 'transparent' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !passphrase.trim()}
                  style={{ width: '100%' }}
                >
                  {loading ? (
                    'Verifying Passphrase...'
                  ) : (
                    <>
                      <Unlock size={16} /> Unlock Company Access
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

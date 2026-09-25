import React, { useRef, useState } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  currentFilename?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  isLoading,
  currentFilename,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndProcessFile = (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please upload a PDF file (.pdf)');
      return;
    }
    if (file.size > 35 * 1024 * 1024) {
      setError('PDF file is too large (maximum 35MB)');
      return;
    }
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  return (
    <div className="upload-section">
      <div
        className={`dropzone ${isDragOver ? 'drag-over' : ''} ${isLoading ? 'loading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleChange}
          style={{ display: 'none' }}
        />

        {isLoading ? (
          <div className="dropzone-content">
            <Loader2 size={44} className="spin icon-cyan" />
            <div className="dropzone-title">Extracting Raw Text from PDF...</div>
            <p className="dropzone-desc">Reading layout and parsing pages without invoking the model yet</p>
          </div>
        ) : currentFilename ? (
          <div className="dropzone-content">
            <div className="file-badge">
              <CheckCircle2 size={24} className="icon-emerald" />
              <div>
                <span className="file-name">{currentFilename}</span>
                <span className="file-hint">Ready to inspect or re-upload another PDF</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="dropzone-content">
            <div className="icon-circle">
              <UploadCloud size={36} className="icon-cyan" />
            </div>
            <div className="dropzone-title">Upload Bank Statement PDF</div>
            <p className="dropzone-desc">
              Drag & drop any bank statement PDF here, or <span className="highlight-text">browse files</span>
            </p>
            <div className="upload-tips">
              <span className="tip-tag">Universal Bank Formats</span>
              <span className="tip-tag">Multi-Page Safe</span>
              <span className="tip-tag">Raw Preview First</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="upload-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

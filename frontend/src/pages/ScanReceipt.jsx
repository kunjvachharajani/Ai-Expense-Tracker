import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, Camera, FileText, X, Sparkles } from 'lucide-react';
import { scanReceipt, createExpense } from '../services/api';
import ConfirmExpenseModal from '../components/ConfirmExpenseModal';

async function prepareReceiptFile(rawFile) {
  if (rawFile.type === 'application/pdf' || rawFile.name.toLowerCase().endsWith('.pdf')) {
    return rawFile;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(rawFile);
              return;
            }
            const cleanName = rawFile.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressed = new File([blob], cleanName, { type: 'image/jpeg' });
            resolve(compressed);
          },
          'image/jpeg',
          0.82
        );
      };
      img.onerror = () => resolve(rawFile);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(rawFile);
    reader.readAsDataURL(rawFile);
  });
}

export default function ScanReceipt() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [extraction, setExtraction] = useState(null);
  const [ocrText, setOcrText] = useState('');
  const [showOcr, setShowOcr] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0];
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setError('');
      setExtraction(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'], 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    onDropRejected: (rejections) => {
      const err = rejections[0]?.errors[0];
      if (err?.code === 'file-too-large') setError('File too large. Maximum 10 MB.');
      else setError('Unsupported file type. Use JPG, PNG, WebP, or PDF.');
    },
  });

  const handleScan = async () => {
    if (!file) return;
    setError('');
    setExtraction(null);
    setLoading(true);
    setScanStatus('Optimizing receipt image...');

    try {
      const readyFile = await prepareReceiptFile(file);
      setScanStatus('Scanning receipt with AI...');
      const result = await scanReceipt(readyFile);
      setExtraction({
        ...(result.extraction || {}),
        warning: result.warning,
      });
      setOcrText(result.ocr_text || '');
    } catch (err) {
      setError(err.message || 'Failed to scan receipt.');
    } finally {
      setLoading(false);
      setScanStatus('');
    }
  };

  const handleConfirm = async (data) => {
    setSaving(true);
    try {
      data.ocr_text = ocrText;
      await createExpense(data);
      setSuccess('Expense saved successfully!');
      setExtraction(null);
      setFile(null);
      setPreview(null);
      setTimeout(() => navigate('/', { state: { refreshedAt: Date.now() } }), 500);
    } catch (err) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setExtraction(null);
    setOcrText('');
    setError('');
  };

  return (
    <div>
      <div className="card" style={{ maxWidth: 640 }}>
        <h3 className="card-title" style={{ marginBottom: 20 }}>Upload Receipt</h3>

        {!file ? (
          <div {...getRootProps()} className={`upload-area ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            <Upload size={40} />
            <p><strong>Drag & drop</strong> your receipt here, or <strong>click to browse</strong></p>
            <p className="upload-hint">Supports JPG, PNG, PDF — Max 5 MB</p>
          </div>
        ) : (
          <div>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              {preview && file.type.startsWith('image/') && (
                <img src={preview} alt="Receipt preview" className="image-preview" />
              )}
              {file.type === 'application/pdf' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 20, background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <FileText size={32} color="var(--text-muted)" />
                  <span>{file.name}</span>
                </div>
              )}
              <button
                onClick={clearFile}
                className="btn btn-icon btn-secondary"
                style={{ position: 'absolute', top: 8, right: 8, background: 'white', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button className="btn btn-primary btn-lg" onClick={handleScan} disabled={loading}>
                {loading ? <><span className="loading-spinner" /> {scanStatus || 'Scanning...'}</> : <><Sparkles size={18} /> Scan Receipt</>}
              </button>
              <button className="btn btn-secondary" onClick={clearFile} disabled={loading}>Change File</button>
            </div>
          </div>
        )}

        {/* Camera option hint for mobile */}
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12 }}>
          <Camera size={14} style={{ verticalAlign: 'middle' }} /> On mobile, you can use the camera to take a photo directly.
        </p>

        {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginTop: 16 }}>{success}</div>}

        {/* OCR text viewer */}
        {ocrText && (
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowOcr(!showOcr)}>
              <FileText size={14} /> {showOcr ? 'Hide' : 'View'} OCR Text
            </button>
            {showOcr && (
              <pre style={{ marginTop: 10, padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.82rem', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                {ocrText}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {extraction && (
        <ConfirmExpenseModal
          data={extraction}
          onConfirm={handleConfirm}
          onCancel={() => setExtraction(null)}
          loading={saving}
          source="receipt"
        />
      )}
    </div>
  );
}

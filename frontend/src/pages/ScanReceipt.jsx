import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, Camera, FileText, X, Sparkles, CheckCircle2, Sun, Focus, ShieldCheck } from 'lucide-react';
import { scanReceipt, createExpense } from '../services/api';
import ConfirmExpenseModal from '../components/ConfirmExpenseModal';
import MagneticButton from '../components/MagneticButton';
import { useToast } from '../components/Toast';
import './ScanReceipt.css';

const MAX_FUNCTION_UPLOAD_BYTES = 4 * 1024 * 1024;

async function prepareReceiptFile(rawFile) {
  if (rawFile.type === 'application/pdf' || rawFile.name.toLowerCase().endsWith('.pdf')) {
    if (rawFile.size > MAX_FUNCTION_UPLOAD_BYTES) {
      throw new Error('PDF files must be 4 MB or smaller. For larger receipts, export a compressed PDF or upload page images.');
    }
    return rawFile;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      if (rawFile.size <= MAX_FUNCTION_UPLOAD_BYTES) resolve(rawFile);
      else reject(new Error('This image could not be compressed below the 4 MB upload limit.'));
    };
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        if (rawFile.size <= MAX_FUNCTION_UPLOAD_BYTES) resolve(rawFile);
        else reject(new Error('This image format could not be compressed. Try JPG or PNG under 4 MB.'));
      };
      img.onload = async () => {
        const maxDim = 2000;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (rawFile.size <= MAX_FUNCTION_UPLOAD_BYTES) resolve(rawFile);
          else reject(new Error('This image could not be compressed below the 4 MB upload limit.'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const encode = quality => new Promise(blobResolve => {
          canvas.toBlob(blobResolve, 'image/jpeg', quality);
        });
        for (const quality of [0.92, 0.86, 0.8, 0.74]) {
          const blob = await encode(quality);
          if (!blob) break;
          if (blob.size <= MAX_FUNCTION_UPLOAD_BYTES) {
            const cleanName = rawFile.name.replace(/\.[^/.]+$/, '') + '.jpg';
            resolve(new File([blob], cleanName, { type: 'image/jpeg' }));
            return;
          }
        }
        reject(new Error('This image is still too large after compression. Try a closer, cropped photo of the receipt.'));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(rawFile);
  });
}

export default function ScanReceipt() {
  const navigate = useNavigate();
  const toast = useToast();
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
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tif', '.tiff'], 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    onDropRejected: (rejections) => {
      const err = rejections[0]?.errors[0];
      if (err?.code === 'file-too-large') setError('File too large. Maximum 10 MB.');
      else setError('Unsupported file type. Use JPG, PNG, WebP, TIFF, or PDF.');
    },
  });

  const handleScan = async () => {
    if (!file) return;
    setError('');
    setExtraction(null);
    setLoading(true);
    setScanStatus('Compressing receipt image...');

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
      toast.success('Expense saved!');
      setExtraction(null);
      setFile(null);
      setPreview(null);
      setTimeout(() => navigate('/', { state: { refreshedAt: Date.now() } }), 500);
    } catch (err) {
      setError(err.message || 'Failed to save.');
      toast.error(err.message || 'Failed to save expense.');
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
    <div className="scan-receipt-page">
      <header className="scan-receipt-heading"><div className="dashboard-panel-eyebrow">Camera to ledger</div><h1>Scan a receipt</h1><p>Drop in a photo or PDF. We’ll extract the details for you to review.</p></header>

      {success && <motion.div className="scan-receipt-success" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}><CheckCircle2 size={17} />{success}</motion.div>}

      <div className="scan-receipt-layout">
        <motion.section className="scan-receipt-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, ease: 'easeOut' }}>
          <h2 className="scan-receipt-panel-title">{file ? 'Receipt ready to scan' : 'Add your receipt'}</h2>
          <p className="scan-receipt-panel-copy">Images up to 10 MB are optimized before upload. PDFs must be 4 MB or less.</p>

          {!file ? (
            <div {...getRootProps()} className={`scan-dropzone ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} />
              <div className="scan-dropzone-content">
                <span className="scan-upload-icon"><Upload size={25} /></span>
                <h3 className="scan-dropzone-title">{isDragActive ? 'Drop it here' : 'Drag and drop your receipt'}</h3>
                <p className="scan-dropzone-copy">or click anywhere in this area to choose an image or PDF from your device.</p>
                <span className="scan-dropzone-hint"><FileText size={13} /> JPG · PNG · WebP · TIFF · PDF</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="scan-preview-frame">
                {preview && file.type.startsWith('image/') && <img src={preview} alt="Receipt preview" className="scan-preview-image" />}
                {file.type === 'application/pdf' && <div className="scan-pdf-card"><FileText size={32} color="var(--accent-primary)" /><div style={{ minWidth: 0 }}><div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>PDF receipt</div><div className="scan-file-name" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: 3 }}>{file.name}</div></div></div>}
                <button type="button" onClick={clearFile} className="btn btn-icon scan-preview-remove" aria-label="Remove receipt"><X size={16} /></button>
              </div>
              <div className="scan-file-info"><span className="scan-file-name">{file.name}</span><span>{(file.size / 1024 / 1024).toFixed(1)} MB</span></div>
              <div className="scan-actions">
                <MagneticButton type="button" className="btn btn-primary btn-lg" onClick={handleScan} disabled={loading}><Sparkles size={17} /> Scan receipt</MagneticButton>
                <button type="button" className="btn btn-secondary" onClick={clearFile} disabled={loading}>Change file</button>
              </div>
            </div>
          )}

          {loading && <motion.div key={scanStatus.startsWith('Scanning') ? 'reading' : 'preparing'} className={`scan-progress ${scanStatus.startsWith('Scanning') ? 'scan-progress-reading' : 'scan-progress-upload'}`} role="status" aria-label={scanStatus || 'Scanning receipt'} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
            <div className="scan-progress-title"><Sparkles size={15} />{scanStatus.startsWith('Scanning') ? 'Reading receipt with AI' : 'Preparing receipt for upload'}</div>
            {scanStatus.startsWith('Scanning') ? <div className="scan-reading-state"><span className="scan-reading-pulse" />Checking merchant, date, and totals…</div> : <div className="scan-upload-track"><motion.span initial={{ scaleX: 0.12 }} animate={{ scaleX: 0.82 }} transition={{ duration: 0.8, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }} /></div>}
          </motion.div>}

          {error && <div className="alert alert-error scan-receipt-alert" role="alert">{error}</div>}

          {ocrText && <div className="scan-ocr"><button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowOcr(!showOcr)}><FileText size={14} /> {showOcr ? 'Hide extracted text' : 'View extracted text'}</button>{showOcr && <pre className="scan-ocr-text">{ocrText}</pre>}</div>}
        </motion.section>

        <aside className="scan-receipt-aside">
          <section className="scan-tip"><div className="scan-tip-header"><Sun size={16} color="var(--warning)" /> Get a clearer scan</div><p className="scan-tip-copy">A few small changes can help the scanner read totals and line items accurately.</p><ul className="scan-tip-list"><li><CheckCircle2 size={14} color="var(--success)" />Use bright, even light</li><li><Focus size={14} color="var(--info)" />Keep the full receipt in frame</li><li><ReceiptText size={14} color="var(--accent-primary)" />Place it flat and avoid glare</li></ul></section>
          <section className="scan-tip"><div className="scan-tip-header"><ShieldCheck size={16} color="var(--accent-primary)" /> Review before saving</div><p className="scan-tip-copy">Extracted details open in a review step. Check the amount, date, and category before confirming.</p></section>
          <section className="scan-tip"><div className="scan-tip-header"><Camera size={16} color="var(--cat-transport)" /> Using a phone?</div><p className="scan-tip-copy">On mobile, choose the camera from the file picker to capture a receipt directly.</p></section>
        </aside>
      </div>

      <AnimatePresence>{extraction && <ConfirmExpenseModal data={extraction} onConfirm={handleConfirm} onCancel={() => setExtraction(null)} loading={saving} source="receipt" />}</AnimatePresence>
    </div>
  );
}

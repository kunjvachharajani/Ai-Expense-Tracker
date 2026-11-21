import { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, Camera, FileText, X, Sparkles, CheckCircle2, Sun, Focus, ShieldCheck, ReceiptText, ArrowUpRight } from 'lucide-react';
import { scanReceipt, createExpense, listExpenses } from '../services/api';
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
  const [recentScans, setRecentScans] = useState(null);

  const isPdfFile = file?.type === 'application/pdf' || file?.name?.toLowerCase().endsWith('.pdf');
  const activeStep = saving ? 3 : extraction ? 2 : file ? 1 : 0;

  useEffect(() => {
    let isCurrent = true;
    listExpenses({ page: 1, per_page: 24, sort_by: 'created_at', sort_order: 'desc' })
      .then(result => {
        if (isCurrent) setRecentScans((result?.expenses || []).filter(expense => expense.source === 'receipt').slice(0, 4));
      })
      .catch(() => {
        if (isCurrent) setRecentScans([]);
      });
    return () => { isCurrent = false; };
  }, []);

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
      <header className="scan-receipt-heading">
        <div className="scan-receipt-heading-copy"><div className="dashboard-panel-eyebrow">Camera to ledger</div><h1>Scan Receipt</h1><p>Upload a receipt and let the AI extract the expense details for you.</p><span className="scan-ai-indicator"><Sparkles size={13} /> AI-assisted extraction</span></div>
        <div className="scan-receipt-steps" aria-label="Receipt scanning steps">
          {['Upload', 'Scan', 'Review', 'Save'].map((label, index) => (
            <div className="scan-step-wrap" key={label}>
              {index > 0 && <b aria-hidden="true" />}
              <span className={`${index === activeStep ? 'is-current' : ''} ${index < activeStep ? 'is-complete' : ''}`} aria-current={index === activeStep ? 'step' : undefined}><i>{String(index + 1).padStart(2, '0')}</i>{label}</span>
            </div>
          ))}
        </div>
      </header>

      {success && <motion.div className="scan-receipt-success" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}><CheckCircle2 size={17} />{success}</motion.div>}

      <div className="scan-receipt-layout">
        <motion.section className="scan-receipt-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, ease: 'easeOut' }}>
          <div className="scan-receipt-panel-heading"><div><div className="dashboard-panel-eyebrow">Upload workspace</div><h2 className="scan-receipt-panel-title">{file ? 'Receipt ready to scan' : 'Add your receipt'}</h2></div><span className="scan-receipt-private"><ShieldCheck size={14} /> Private upload</span></div>
          <p className="scan-receipt-panel-copy">Images are optimized before upload. PDF files must be 4 MB or less.</p>

          {!file ? (
            <div {...getRootProps()} className={`scan-dropzone ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} />
              <div className="scan-dropzone-content">
                <div className="scan-upload-illustration" aria-hidden="true"><span className="scan-upload-icon"><Upload size={24} /></span><span className="scan-upload-spark scan-upload-spark-one"><Sparkles size={14} /></span><span className="scan-upload-spark scan-upload-spark-two"><ReceiptText size={14} /></span></div>
                <span className="scan-dropzone-kicker">{isDragActive ? 'READY TO RECEIVE' : 'START WITH A RECEIPT'}</span>
                <h3 className="scan-dropzone-title">{isDragActive ? 'Drop it here' : 'Drop a receipt image or PDF'}</h3>
                <p className="scan-dropzone-copy">Drag a file into this space, or browse your device to select one.</p>
                <span className="scan-browse-cta"><Upload size={15} /> Choose a file</span>
                <span className="scan-dropzone-hint"><FileText size={13} /> JPG · JPEG · PNG · GIF · BMP · WebP · TIFF · PDF</span>
                <span className="scan-dropzone-limits">Images up to 10 MB · PDFs up to 4 MB</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="scan-preview-frame">
                {preview && !isPdfFile && <img src={preview} alt="Receipt preview" className="scan-preview-image" />}
                {isPdfFile && <div className="scan-pdf-card"><FileText size={32} color="var(--accent-primary)" /><div style={{ minWidth: 0 }}><div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>PDF receipt</div><div className="scan-file-name" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: 3 }}>{file.name}</div></div></div>}
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
            <div className="scan-progress-title"><span className="scan-processing-dot" />{scanStatus.startsWith('Scanning') ? 'Scanning receipt' : 'Preparing receipt'}</div>
            <div className="scan-reading-state">{scanStatus.startsWith('Scanning') ? 'Extracting expense information…' : 'Optimizing image before upload…'}</div>
            <div className="scan-upload-track" aria-hidden="true"><span /></div>
          </motion.div>}

          {error && <div className="scan-receipt-error" role="alert"><div className="scan-error-copy"><strong>{file ? 'Unable to scan receipt' : 'This file could not be added'}</strong><span>{file ? 'We couldn’t extract the details from this receipt. Check the photo and try again.' : 'Choose a supported receipt image or PDF within the size limit.'}</span><details><summary>Details</summary><p>{error}</p></details></div>{file && <button type="button" className="btn btn-secondary btn-sm" onClick={handleScan} disabled={loading}>Try again</button>}</div>}

          {ocrText && <div className="scan-ocr"><button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowOcr(!showOcr)}><FileText size={14} /> {showOcr ? 'Hide extracted text' : 'View extracted text'}</button>{showOcr && <pre className="scan-ocr-text">{ocrText}</pre>}</div>}
        </motion.section>

        <aside className="scan-receipt-aside">
          <section className="scan-tip scan-tip-featured"><div className="scan-tip-overline">FOR A BETTER RESULT</div><div className="scan-tip-header"><Sun size={17} color="var(--warning)" /> Make the receipt easy to read</div><p className="scan-tip-copy">A clear, complete photo helps identify the merchant, date, and total.</p><ul className="scan-tip-list"><li><CheckCircle2 size={14} color="var(--success)" />Use bright, even light</li><li><Focus size={14} color="var(--info)" />Keep all four edges in frame</li><li><ReceiptText size={14} color="var(--accent-primary)" />Lay it flat and avoid glare</li></ul></section>
          <section className="scan-tip"><div className="scan-tip-header"><ShieldCheck size={16} color="var(--accent-primary)" /> You review before saving</div><p className="scan-tip-copy">Extracted details open in an editable review step. Confirm the amount, date, and category before saving.</p></section>
          <section className="scan-tip"><div className="scan-tip-header"><Camera size={16} color="var(--cat-transport)" /> Scan from your phone</div><p className="scan-tip-copy">Choose the camera in your phone’s file picker to capture a receipt directly.</p></section>
        </aside>
      </div>

      <div className="scan-receipt-footnote"><span><ShieldCheck size={15} /> No expense is saved until you confirm the extracted details.</span><span>Receipt data is editable before saving.</span></div>

      {recentScans?.length > 0 && <motion.section className="scan-recent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
        <header className="scan-recent-heading"><div><div className="dashboard-panel-eyebrow">Your receipt history</div><h2>Recent scans</h2></div><Link to="/expenses" className="scan-recent-link">All expenses <ArrowUpRight size={14} /></Link></header>
        <div className="scan-recent-list">
          {recentScans.map(expense => {
            let amountLabel = `${expense.currency || 'INR'} ${expense.amount}`;
            try { amountLabel = new Intl.NumberFormat('en-IN', { style: 'currency', currency: expense.currency || 'INR', maximumFractionDigits: 2 }).format(Number(expense.amount)); } catch {}
            const dateLabel = expense.expense_date ? new Date(`${expense.expense_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unavailable';
            return <article className="scan-recent-row" key={expense.id}>
              <span className="scan-recent-icon"><ReceiptText size={17} /></span>
              <div className="scan-recent-main"><strong>{expense.merchant || expense.description || 'Receipt expense'}</strong><span>{dateLabel}</span></div>
              <span className="scan-recent-category">{expense.category || 'Other'}</span>
              <strong className="scan-recent-amount">{amountLabel}</strong>
            </article>;
          })}
        </div>
      </motion.section>}

      <AnimatePresence>{extraction && <ConfirmExpenseModal data={extraction} onConfirm={handleConfirm} onCancel={() => setExtraction(null)} loading={saving} source="receipt" receiptPreview={file ? { url: preview, name: file.name, size: file.size, isPdf: isPdfFile } : null} />}</AnimatePresence>
    </div>
  );
}

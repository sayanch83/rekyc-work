import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Railway volumes mount at /data. Fall back to local ./uploads for dev
const UPLOAD_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads')
  : path.join(__dirname, '..', 'uploads');
const DB_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'db.json')
  : path.join(__dirname, '..', 'db.json');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());

// ── Multer for file uploads ──
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuid() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── Seed Data ──
const SEED = {
  customers: {
    'KYC-4528': {
      id: 'KYC-4528', name: 'Rajesh Kumar Sharma', acct: 'XXXX4528',
      mobile: '+91 98765 43210', email: 'rajesh.s***@gmail.com',
      dob: '15 Mar 1985', pan: 'ABCPS****K', aadhaar: 'XXXX XXXX 7842',
      constitution: 'Individual',
      address: 'Flat 402, Sunrise Apartments, MG Road, Andheri West, Mumbai - 400058',
      due: '30 Apr 2026', status: 'in-progress', kycType: null,
      docsOnFile: [
        { name: 'PAN Card', meta: 'Verified – Lifetime', valid: true },
        { name: 'Passport', meta: 'No. Z12345XX – Exp: 15 Dec 2027', valid: true },
        { name: 'Aadhaar Card', meta: 'Last verified: 10 Jun 2023', valid: true },
      ],
      reminders: [
        { ch: 'SMS', date: '01 Mar 2026, 10:00 AM', status: 'Delivered' },
        { ch: 'Email', date: '01 Mar 2026, 10:01 AM', status: 'Opened' },
        { ch: 'WhatsApp', date: '15 Mar 2026, 09:30 AM', status: 'Read' },
        { ch: 'SMS', date: '01 Apr 2026, 10:00 AM', status: 'Delivered' },
        { ch: 'WhatsApp', date: '10 Apr 2026, 11:15 AM', status: 'Read' },
      ],
      linkActive: true, linkExpiry: '30 Apr 2026, 11:59 PM',
      source: null, agent: null, completedDate: null,
      documents: [],
    },
    'KYC-7891': {
      id: 'KYC-7891', name: 'Priya Mehta', acct: 'XXXX7891',
      mobile: '+91 87654 32100', email: 'priya.m***@gmail.com',
      dob: '22 Jul 1990', pan: 'BXZPM****R', aadhaar: 'XXXX XXXX 3156',
      constitution: 'Individual',
      address: '12B, Palm Grove Society, Bandra West, Mumbai - 400050',
      due: '30 Apr 2026', status: 'completed', kycType: 'Self-Declaration',
      docsOnFile: [
        { name: 'PAN Card', meta: 'Verified – Lifetime', valid: true },
        { name: 'Aadhaar Card', meta: 'Last verified: 05 Jan 2024', valid: true },
      ],
      reminders: [
        { ch: 'SMS', date: '01 Mar 2026, 10:00 AM', status: 'Delivered' },
        { ch: 'WhatsApp', date: '15 Mar 2026, 09:30 AM', status: 'Read' },
      ],
      linkActive: false, linkExpiry: null,
      source: 'Digital', agent: null, completedDate: '20 Mar 2026',
      documents: [
        { id: 'd-priya-1', name: 'PAN Card', fileName: 'pan_priya.pdf', size: '142 KB',
          uploadedBy: 'Customer', uploadDate: '18 Mar 2026', status: 'approved',
          reviewedBy: 'Auto-verified', reviewDate: '18 Mar 2026', rejectReason: null, fileId: null },
      ],
    },
    'KYC-3345': {
      id: 'KYC-3345', name: 'Amit Patel', acct: 'XXXX3345',
      mobile: '+91 99887 76543', email: 'amit.p***@yahoo.com',
      dob: '08 Nov 1978', pan: 'CDFPP****L', aadhaar: 'XXXX XXXX 9021',
      constitution: 'Individual',
      address: '301, Shanti Nagar, Satellite, Ahmedabad - 380015',
      due: '30 Apr 2026', status: 'completed', kycType: 'Full KYC',
      docsOnFile: [
        { name: 'PAN Card', meta: 'Verified – Lifetime', valid: true },
        { name: 'Driving Licence', meta: 'DL renewed – Exp: 20 Mar 2030', valid: true },
        { name: 'Aadhaar Card', meta: 'Last verified: 12 Sep 2022', valid: true },
      ],
      reminders: [
        { ch: 'SMS', date: '01 Mar 2026, 10:00 AM', status: 'Delivered' },
        { ch: 'Email', date: '01 Mar 2026, 10:01 AM', status: 'Bounced' },
        { ch: 'WhatsApp', date: '10 Mar 2026, 02:00 PM', status: 'Read' },
      ],
      linkActive: false, linkExpiry: null,
      source: 'Branch Agent', agent: { name: 'Suresh Iyer', date: '02 Apr 2026' },
      completedDate: '02 Apr 2026',
      documents: [
        { id: 'd-amit-1', name: 'Driving Licence (Renewed)', fileName: 'dl_amit.pdf', size: '510 KB',
          uploadedBy: 'Agent: Suresh Iyer', uploadDate: '02 Apr 2026', status: 'approved',
          reviewedBy: 'Rakesh Verma', reviewDate: '02 Apr 2026', rejectReason: null, fileId: null },
      ],
    },
    'KYC-5512': {
      id: 'KYC-5512', name: 'Sneha Reddy', acct: 'XXXX5512',
      mobile: '+91 91234 56789', email: 'sneha.r***@outlook.com',
      dob: '14 Apr 1995', pan: 'EFRPS****T', aadhaar: 'XXXX XXXX 6734',
      constitution: 'Individual',
      address: 'Flat 8, Lakeview Towers, Jubilee Hills, Hyderabad - 500033',
      due: '30 Apr 2026', status: 'in-progress', kycType: 'Partial Update',
      docsOnFile: [
        { name: 'PAN Card', meta: 'Verified – Lifetime', valid: true },
        { name: 'Passport', meta: 'No. R98765XX – Exp: 10 Aug 2028', valid: true },
        { name: 'Aadhaar Card', meta: 'Last verified: 22 Feb 2024', valid: true },
      ],
      reminders: [
        { ch: 'WhatsApp', date: '01 Mar 2026, 09:30 AM', status: 'Read' },
        { ch: 'SMS', date: '15 Mar 2026, 10:00 AM', status: 'Delivered' },
        { ch: 'WhatsApp', date: '05 Apr 2026, 11:00 AM', status: 'Read' },
      ],
      linkActive: true, linkExpiry: '25 Apr 2026, 11:59 PM',
      source: null, agent: null, completedDate: null,
      documents: [],
    },
    'KYC-6678': {
      id: 'KYC-6678', name: 'Vikram Singh', acct: 'XXXX6678',
      mobile: '+91 98123 45678', email: 'vikram.s***@gmail.com',
      dob: '30 Jan 1982', pan: 'GHIPS****M', aadhaar: 'XXXX XXXX 2489',
      constitution: 'Individual',
      address: '56, Sector 15, Chandigarh - 160015',
      due: '30 Apr 2026', status: 'overdue', kycType: 'Full KYC',
      docsOnFile: [
        { name: 'PAN Card', meta: 'Verified – Lifetime', valid: true },
        { name: 'Voter ID', meta: 'No. CHD/XXXXX', valid: true },
        { name: 'Aadhaar Card', meta: 'Last verified: 15 May 2021', valid: true },
      ],
      reminders: [
        { ch: 'SMS', date: '01 Feb 2026, 10:00 AM', status: 'Delivered' },
        { ch: 'Email', date: '01 Feb 2026, 10:01 AM', status: 'Opened' },
        { ch: 'SMS', date: '01 Mar 2026, 10:00 AM', status: 'Delivered' },
        { ch: 'SMS', date: '01 Apr 2026, 10:00 AM', status: 'Delivered' },
      ],
      linkActive: true, linkExpiry: '30 Apr 2026, 11:59 PM',
      source: null, agent: null, completedDate: null,
      documents: [],
    },
  }
};

// ── DB helpers ──
function loadDb() {
  if (!fs.existsSync(DB_PATH)) { saveDb(SEED); return structuredClone(SEED); }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function saveDb(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }
function now() { return new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true }); }
function today() { return new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric' }); }

// Init
loadDb();

// ═══════════ ROUTES ═══════════

// List all customers
app.get('/api/customers', (_, res) => {
  const db = loadDb();
  res.json(Object.values(db.customers));
});

// Get single customer
app.get('/api/customers/:id', (req, res) => {
  const db = loadDb();
  const c = db.customers[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(c);
});

// Update customer status / kycType
app.put('/api/customers/:id', (req, res) => {
  const db = loadDb();
  const c = db.customers[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  const { status, kycType, source, completedDate } = req.body;
  if (status) c.status = status;
  if (kycType) c.kycType = kycType;
  if (source) c.source = source;
  if (completedDate) c.completedDate = completedDate;
  saveDb(db);
  res.json(c);
});

// Upload document
app.post('/api/customers/:id/documents', upload.single('file'), (req, res) => {
  const db = loadDb();
  const c = db.customers[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const doc = {
    id: 'd-' + uuid().slice(0, 8),
    name: req.body.docName || req.file.originalname,
    fileName: req.file.originalname,
    size: (req.file.size / 1024).toFixed(0) + ' KB',
    uploadedBy: req.body.uploadedBy || 'Customer',
    uploadDate: today(),
    status: 'pending',
    reviewedBy: null,
    reviewDate: null,
    rejectReason: null,
    fileId: req.file.filename,
  };
  c.documents.push(doc);
  saveDb(db);
  res.status(201).json(doc);
});

// View/download uploaded file
app.get('/api/files/:fileId', (req, res) => {
  const fp = path.join(UPLOAD_DIR, req.params.fileId);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(fp);
});

// Review (approve/reject) a document
app.put('/api/customers/:id/documents/:did/review', (req, res) => {
  const db = loadDb();
  const c = db.customers[req.params.id];
  if (!c) return res.status(404).json({ error: 'Customer not found' });

  const doc = c.documents.find(d => d.id === req.params.did);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const { action, reason, reviewer } = req.body;
  doc.status = action === 'approve' ? 'approved' : 'rejected';
  doc.reviewedBy = reviewer || 'Bank Officer';
  doc.reviewDate = today();
  if (action === 'reject') {
    doc.rejectReason = reason || '';
    c.reminders.push({ ch: 'System', date: now(), status: `Doc '${doc.name}' rejected – customer notified` });
  } else {
    c.reminders.push({ ch: 'System', date: now(), status: `Doc '${doc.name}' approved` });
  }
  saveDb(db);
  res.json(doc);
});

// Regenerate link
app.post('/api/customers/:id/regen-link', (req, res) => {
  const db = loadDb();
  const c = db.customers[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  c.linkActive = true;
  c.linkExpiry = '29 Apr 2026, 11:59 PM';
  c.reminders.push({ ch: 'System', date: now(), status: 'Link regenerated & sent' });
  saveDb(db);
  res.json(c);
});

// Reset to seed
app.post('/api/reset', (_, res) => {
  fs.readdirSync(UPLOAD_DIR).forEach(f => fs.unlinkSync(path.join(UPLOAD_DIR, f)));
  saveDb(SEED);
  res.json({ ok: true });
});

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'rekyc-api', timestamp: new Date().toISOString() });
});

// Root
app.get('/', (_, res) => {
  res.json({ service: 'Re-KYC API', version: '1.0.0', endpoints: ['/health', '/api/customers', '/api/files/:fileId'] });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`Re-KYC API running → port ${PORT}`));

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => { const ext = path.extname(file.originalname); cb(null, uuid() + ext); }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const SEED = {
  customers: {
    'KYC-4528': { risk: 'Medium',
      id: 'KYC-4528', name: 'Rajesh Kumar Sharma', acct: 'XXXX4528',
      mobile: '+91 98765 43210', email: 'rajesh.s***@gmail.com',
      dob: '15 Mar 1985', pan: 'ABCPS****K', aadhaar: 'XXXX XXXX 7842',
      constitution: 'Individual', relationship: 'Savings Account',
      address: 'Flat 402, Sunrise Apartments, MG Road, Andheri West, Mumbai - 400058',
      zone: 'West', city: 'Mumbai', assignedTo: 'Priya Nair',
      due: '30 Apr 2026', status: 'Pending VKYC', kycType: 'Full KYC',
      docsOnFile: [
        { name: 'PAN Card', meta: 'No. ABCPS****K', valid: true },
        { name: 'Passport', meta: 'No. Z1234****  •  Exp: 15 Dec 2027', valid: true },
        { name: 'Aadhaar Card', meta: 'No. XXXX XXXX 7842', valid: true },
      ],
      panStep: { status: 'Verified', date: '18 Apr 2026' },
      poiStep: { status: 'Verified', date: '18 Apr 2026', type: 'Passport', mode: 'Physical' },
      poaStep: { status: 'Verified', date: '18 Apr 2026', type: 'Aadhaar', mode: 'DigiLocker' },
      vkycStep: { status: 'Pending', date: null },
      reminders: [
        { ch: 'SMS', date: '01 Mar 2026, 10:00 AM' },
        { ch: 'Email', date: '01 Mar 2026, 10:01 AM' },
        { ch: 'WhatsApp', date: '15 Mar 2026, 09:30 AM' },
        { ch: 'SMS', date: '01 Apr 2026, 10:00 AM' },
        { ch: 'WhatsApp', date: '10 Apr 2026, 11:15 AM' },
      ],
      linkActive: true, linkExpiry: '30 Apr 2026, 11:59 PM',
      source: 'Digital', agent: null, completedDate: null, agentGeo: null,
      documents: [],
    },
    'KYC-7891': { risk: 'Low',
      id: 'KYC-7891', name: 'Priya Mehta', acct: 'XXXX7891',
      mobile: '+91 87654 32100', email: 'priya.m***@gmail.com',
      dob: '22 Jul 1990', pan: 'BXZPM****R', aadhaar: 'XXXX XXXX 3156',
      constitution: 'Individual', relationship: 'Credit Card',
      address: '12B, Palm Grove Society, Bandra West, Mumbai - 400050',
      zone: 'West', city: 'Mumbai', assignedTo: 'Kiran Desai',
      due: '30 Apr 2026', status: 'Completed', kycType: 'Self-Declaration',
      docsOnFile: [
        { name: 'PAN Card', meta: 'No. ABCPS****K', valid: true },
        { name: 'Aadhaar Card', meta: 'No. XXXX XXXX 3156', valid: true },
      ],
      panStep: { status: 'Verified', date: '20 Mar 2026' },
      poiStep: { status: 'Verified', date: '20 Mar 2026', type: 'Aadhaar', mode: 'DigiLocker' },
      poaStep: { status: 'Verified', date: '20 Mar 2026', type: 'Aadhaar', mode: 'DigiLocker' },
      vkycStep: { status: 'Completed', date: '20 Mar 2026' },
      reminders: [
        { ch: 'SMS', date: '01 Mar 2026, 10:00 AM' },
        { ch: 'WhatsApp', date: '15 Mar 2026, 09:30 AM' },
      ],
      linkActive: false, linkExpiry: null,
      source: 'Digital', agent: null, completedDate: '20 Mar 2026', agentGeo: null,
      documents: [
        { id: 'd-priya-1', name: 'PAN Card', fileName: 'pan_priya.pdf', size: '142 KB',
          uploadedBy: 'Customer', uploadDate: '18 Mar 2026', status: 'approved',
          reviewedBy: 'Auto-verified', reviewDate: '18 Mar 2026', rejectReason: null, fileId: null },
      ],
    },
    'KYC-3345': { risk: 'Low',
      id: 'KYC-3345', name: 'Amit Patel', acct: 'XXXX3345',
      mobile: '+91 99887 76543', email: 'amit.p***@yahoo.com',
      dob: '08 Nov 1978', pan: 'CDFPP****L', aadhaar: 'XXXX XXXX 9021',
      constitution: 'Individual', relationship: 'Personal Loan',
      address: '301, Shanti Nagar, Satellite, Ahmedabad - 380015',
      zone: 'North', city: 'Ahmedabad', assignedTo: 'Suresh Iyer',
      due: '30 Apr 2026', status: 'Completed', kycType: 'Full KYC',
      docsOnFile: [
        { name: 'PAN Card', meta: 'No. ABCPS****K', valid: true },
        { name: 'Driving Licence', meta: 'No. MH04****2030  •  Exp: 20 Mar 2030', valid: true },
        { name: 'Aadhaar Card', meta: 'No. XXXX XXXX 9021', valid: true },
      ],
      panStep: { status: 'Verified', date: '02 Apr 2026' },
      poiStep: { status: 'Verified', date: '02 Apr 2026', type: 'Driving Licence', mode: 'Physical' },
      poaStep: { status: 'Verified', date: '02 Apr 2026', type: 'Aadhaar', mode: 'Physical' },
      vkycStep: { status: 'Completed', date: '02 Apr 2026' },
      reminders: [
        { ch: 'SMS', date: '01 Mar 2026, 10:00 AM' },
        { ch: 'WhatsApp', date: '10 Mar 2026, 02:00 PM' },
      ],
      linkActive: false, linkExpiry: null,
      source: 'Branch Agent', agent: { name: 'Suresh Iyer', date: '02 Apr 2026' },
      completedDate: '02 Apr 2026',
      agentGeo: { time: '02 Apr 2026, 11:45 AM', location: 'Satellite, Ahmedabad', distance: '0.3 km', distanceOk: true },
      documents: [
        { id: 'd-amit-1', name: 'Driving Licence (Renewed)', fileName: 'dl_amit.pdf', size: '510 KB',
          uploadedBy: 'Agent: Suresh Iyer', uploadDate: '02 Apr 2026', status: 'approved',
          reviewedBy: 'Rakesh Verma', reviewDate: '02 Apr 2026', rejectReason: null, fileId: null },
        { id: 'd-amit-2', name: 'Address Proof – Aadhaar', fileName: 'aadhaar_amit.pdf', size: '245 KB',
          uploadedBy: 'Agent: Suresh Iyer', uploadDate: '02 Apr 2026', status: 'approved',
          reviewedBy: 'Rakesh Verma', reviewDate: '02 Apr 2026', rejectReason: null, fileId: null },
      ],
    },
    'KYC-5512': { risk: 'Low',
      id: 'KYC-5512', name: 'Sneha Reddy', acct: 'XXXX5512',
      mobile: '+91 91234 56789', email: 'sneha.r***@outlook.com',
      dob: '14 Apr 1995', pan: 'EFRPS****T', aadhaar: 'XXXX XXXX 6734',
      constitution: 'Individual', relationship: 'Home Loan',
      address: 'Flat 8, Lakeview Towers, Jubilee Hills, Hyderabad - 500033',
      zone: 'South', city: 'Hyderabad', assignedTo: 'Anjali Rao',
      due: '30 Apr 2026', status: 'Pending Doc Upload', kycType: 'Partial Update',
      docsOnFile: [
        { name: 'PAN Card', meta: 'No. ABCPS****K', valid: true },
        { name: 'Passport', meta: 'No. R9876****  •  Exp: 10 Aug 2028', valid: true },
      ],
      panStep: { status: 'Verified', date: '15 Apr 2026' },
      poiStep: { status: 'Pending', date: null, type: 'Passport', mode: null },
      poaStep: { status: 'Pending', date: null, type: null, mode: null },
      vkycStep: { status: 'Pending', date: null },
      reminders: [
        { ch: 'WhatsApp', date: '01 Mar 2026, 09:30 AM' },
        { ch: 'SMS', date: '15 Mar 2026, 10:00 AM' },
        { ch: 'WhatsApp', date: '05 Apr 2026, 11:00 AM' },
      ],
      linkActive: true, linkExpiry: '25 Apr 2026, 11:59 PM',
      source: 'Digital', agent: null, completedDate: null, agentGeo: null,
      documents: [],
    },
    'KYC-6678': { risk: 'Medium',
      id: 'KYC-6678', name: 'Vikram Singh', acct: 'XXXX6678',
      mobile: '+91 98123 45678', email: 'vikram.s***@gmail.com',
      dob: '30 Jan 1982', pan: 'GHIPS****M', aadhaar: 'XXXX XXXX 2489',
      constitution: 'Individual', relationship: 'Savings Account',
      address: '56, Sector 15, Chandigarh - 160015',
      zone: 'North', city: 'Chandigarh', assignedTo: null,
      due: '30 Apr 2026', status: 'Initiated', kycType: 'Full KYC',
      docsOnFile: [
        { name: 'PAN Card', meta: 'No. ABCPS****K', valid: true },
        { name: 'Voter ID', meta: 'No. CHD/XXX****', valid: true },
      ],
      panStep: { status: 'Pending', date: null },
      poiStep: { status: 'Pending', date: null, type: null, mode: null },
      poaStep: { status: 'Pending', date: null, type: null, mode: null },
      vkycStep: { status: 'Pending', date: null },
      reminders: [
        { ch: 'SMS', date: '01 Feb 2026, 10:00 AM' },
        { ch: 'Email', date: '01 Feb 2026, 10:01 AM' },
        { ch: 'SMS', date: '01 Mar 2026, 10:00 AM' },
        { ch: 'SMS', date: '01 Apr 2026, 10:00 AM' },
      ],
      linkActive: true, linkExpiry: '30 Apr 2026, 11:59 PM',
      source: null, agent: null, completedDate: null, agentGeo: null,
      documents: [],
    },
    'KYC-2290': { risk: 'Low',
      id: 'KYC-2290', name: 'Meera Joshi', acct: 'XXXX2290',
      mobile: '+91 90876 54321', email: 'meera.j***@gmail.com',
      dob: '03 Jun 1988', pan: 'IJKMJ****N', aadhaar: 'XXXX XXXX 8823',
      constitution: 'Individual', relationship: 'Savings Account',
      address: 'B-204, Green Valley, Viman Nagar, Pune - 411014',
      zone: 'West', city: 'Pune', assignedTo: 'Kiran Desai',
      due: '30 Apr 2026', status: 'Completed', kycType: 'Partial Update',
      docsOnFile: [
        { name: 'PAN Card', meta: 'No. ABCPS****K', valid: true },
        { name: 'Aadhaar Card', meta: 'No. XXXX XXXX 8823', valid: true },
      ],
      panStep: { status: 'Verified', date: '12 Mar 2026' },
      poiStep: { status: 'Verified', date: '12 Mar 2026', type: 'Aadhaar', mode: 'DigiLocker' },
      poaStep: { status: 'Verified', date: '12 Mar 2026', type: 'Utility Bill', mode: 'Physical' },
      vkycStep: { status: 'Completed', date: '12 Mar 2026' },
      reminders: [
        { ch: 'SMS', date: '01 Mar 2026, 10:00 AM' },
        { ch: 'WhatsApp', date: '10 Mar 2026, 02:00 PM' },
      ],
      linkActive: false, linkExpiry: null,
      source: 'Digital', agent: null, completedDate: '12 Mar 2026', agentGeo: null,
      documents: [
        { id: 'd-meera-1', name: 'Address Proof – Utility Bill', fileName: 'gas_bill_meera.pdf', size: '176 KB',
          uploadedBy: 'Customer', uploadDate: '11 Mar 2026', status: 'approved',
          reviewedBy: 'Rakesh Verma', reviewDate: '12 Mar 2026', rejectReason: null, fileId: null },
      ],
    },
    'KYC-8834': { risk: 'Low',
      id: 'KYC-8834', name: 'Arjun Nair', acct: 'XXXX8834',
      mobile: '+91 94567 89012', email: 'arjun.n***@gmail.com',
      dob: '12 Dec 1992', pan: 'LMNPN****P', aadhaar: 'XXXX XXXX 4421',
      constitution: 'Individual', relationship: 'Auto Loan',
      address: '45, Kaloor Junction, Ernakulam, Kochi - 682017',
      zone: 'South', city: 'Kochi', assignedTo: 'Priya Nair',
      due: '30 Apr 2026', status: 'Link Generated', kycType: null,
      docsOnFile: [
        { name: 'PAN Card', meta: 'No. ABCPS****K', valid: true },
        { name: 'Aadhaar Card', meta: 'No. XXXX XXXX 4421', valid: true },
      ],
      panStep: null, poiStep: null, poaStep: null, vkycStep: null,
      reminders: [
        { ch: 'WhatsApp', date: '20 Apr 2026, 09:00 AM' },
      ],
      linkActive: true, linkExpiry: '02 May 2026, 11:59 PM',
      source: null, agent: null, completedDate: null, agentGeo: null,
      documents: [],
    },
    'KYC-1190': { risk: 'Medium',
      id: 'KYC-1190', name: 'Divya Krishnan', acct: 'XXXX1190',
      mobile: '+91 88901 23456', email: 'divya.k***@yahoo.com',
      dob: '25 Sep 1980', pan: 'OPQDK****Q', aadhaar: 'XXXX XXXX 7712',
      constitution: 'Individual', relationship: 'Fixed Deposit',
      address: '22, Boat Club Road, Alwarpet, Chennai - 600018',
      zone: 'South', city: 'Chennai', assignedTo: 'Anjali Rao',
      due: '30 Apr 2026', status: 'Pending Verification', kycType: 'Full KYC',
      docsOnFile: [
        { name: 'PAN Card', meta: 'No. ABCPS****K', valid: true },
        { name: 'Voter ID', meta: 'No. TN/XXX****', valid: true },
        { name: 'Aadhaar Card', meta: 'No. XXXX XXXX 7712', valid: true },
      ],
      panStep: { status: 'Verified', date: '12 Apr 2026' },
      poiStep: { status: 'Verified', date: '14 Apr 2026', type: 'Voter ID', mode: 'Physical' },
      poaStep: { status: 'Verified', date: '14 Apr 2026', type: 'Aadhaar', mode: 'Physical' },
      vkycStep: { status: 'Completed', date: '16 Apr 2026' },
      reminders: [
        { ch: 'SMS', date: '01 Mar 2026, 10:00 AM' },
        { ch: 'Email', date: '01 Mar 2026, 10:05 AM' },
        { ch: 'WhatsApp', date: '10 Apr 2026, 11:00 AM' },
        { ch: 'WhatsApp', date: '18 Apr 2026, 03:00 PM' },
      ],
      linkActive: false, linkExpiry: null,
      source: 'Digital', agent: null, completedDate: null, agentGeo: null,
      documents: [
        { id: 'd-divya-1', name: 'Voter ID', fileName: 'voter_id_divya.pdf', size: '310 KB',
          uploadedBy: 'Customer', uploadDate: '14 Apr 2026', status: 'pending',
          reviewedBy: null, reviewDate: null, rejectReason: null, fileId: null },
        { id: 'd-divya-2', name: 'Aadhaar Card', fileName: 'aadhaar_divya.jpg', size: '198 KB',
          uploadedBy: 'Customer', uploadDate: '14 Apr 2026', status: 'pending',
          reviewedBy: null, reviewDate: null, rejectReason: null, fileId: null },
      ],
    },
    'KYC-9901': { risk: 'High',
      id: 'KYC-9901', name: 'Sanjay Kapoor', acct: 'XXXX9901',
      mobile: '+91 77890 12345', email: 'sanjay.k***@gmail.com',
      dob: '18 Mar 1975', pan: 'RSTSK****R', aadhaar: 'XXXX XXXX 3390',
      constitution: 'Individual', relationship: 'Savings Account',
      address: 'H-12, Defence Colony, New Delhi - 110024',
      zone: 'North', city: 'Delhi', assignedTo: 'Mohit Sharma',
      due: '30 Apr 2026', status: 'Rejected', kycType: 'Full KYC',
      docsOnFile: [
        { name: 'PAN Card', meta: 'No. ABCPS****K', valid: true },
        { name: 'Passport', meta: 'No. M8765****  •  Exp: 22 Sep 2024 (EXPIRED)', valid: false },
      ],
      panStep: { status: 'Verified', date: '05 Apr 2026' },
      poiStep: { status: 'Failed', date: '07 Apr 2026', type: 'Passport', mode: 'Physical' },
      poaStep: { status: 'Failed', date: '07 Apr 2026', type: 'Passport', mode: 'Physical' },
      vkycStep: { status: 'Failed', date: '07 Apr 2026' },
      reminders: [
        { ch: 'SMS', date: '01 Mar 2026, 10:00 AM' },
        { ch: 'Email', date: '01 Mar 2026, 10:05 AM' },
        { ch: 'WhatsApp', date: '20 Mar 2026, 11:00 AM' },
        { ch: 'WhatsApp', date: '05 Apr 2026, 09:00 AM' },
      ],
      linkActive: false, linkExpiry: null,
      source: 'Digital', agent: null, completedDate: null, agentGeo: null,
      documents: [
        { id: 'd-sanjay-1', name: 'Passport (Expired)', fileName: 'passport_sanjay.pdf', size: '680 KB',
          uploadedBy: 'Customer', uploadDate: '06 Apr 2026', status: 'rejected',
          reviewedBy: 'Mohit Sharma', reviewDate: '07 Apr 2026',
          rejectReason: 'Passport expired on 22 Sep 2024. Please upload a valid ID document.', fileId: null },
      ],
    },
    'KYC-4421': { risk: 'Low',
      id: 'KYC-4421', name: 'Lakshmi Venkataraman', acct: 'XXXX4421',
      mobile: '+91 96321 54780', email: 'lakshmi.v***@outlook.com',
      dob: '07 Aug 1965', pan: 'UVWLV****S', aadhaar: 'XXXX XXXX 5567',
      constitution: 'Individual', relationship: 'NRI Savings Account',
      address: 'Plot 7, TNHB Colony, T. Nagar, Chennai - 600017',
      zone: 'South', city: 'Chennai', assignedTo: 'Anjali Rao',
      due: '30 Apr 2026', status: 'Completed', kycType: 'Full KYC',
      docsOnFile: [
        { name: 'PAN Card', meta: 'No. ABCPS****K', valid: true },
        { name: 'Passport', meta: 'No. P2345****  •  Exp: 30 Jun 2029', valid: true },
        { name: 'Aadhaar Card', meta: 'No. XXXX XXXX 5567', valid: true },
      ],
      panStep: { status: 'Verified', date: '28 Mar 2026' },
      poiStep: { status: 'Verified', date: '28 Mar 2026', type: 'Passport', mode: 'Physical' },
      poaStep: { status: 'Verified', date: '29 Mar 2026', type: 'Aadhaar', mode: 'DigiLocker' },
      vkycStep: { status: 'Completed', date: '30 Mar 2026' },
      reminders: [
        { ch: 'Email', date: '01 Mar 2026, 10:05 AM' },
        { ch: 'WhatsApp', date: '15 Mar 2026, 11:00 AM' },
        { ch: 'WhatsApp', date: '25 Mar 2026, 09:00 AM' },
      ],
      linkActive: false, linkExpiry: null,
      source: 'Branch Agent', agent: { name: 'Anjali Rao', date: '28 Mar 2026' },
      completedDate: '30 Mar 2026',
      agentGeo: { time: '28 Mar 2026, 10:30 AM', location: 'T. Nagar, Chennai', distance: '0.1 km', distanceOk: true },
      documents: [
        { id: 'd-lv-1', name: 'Passport', fileName: 'passport_lakshmi.pdf', size: '720 KB',
          uploadedBy: 'Agent: Anjali Rao', uploadDate: '28 Mar 2026', status: 'approved',
          reviewedBy: 'Rakesh Verma', reviewDate: '29 Mar 2026', rejectReason: null, fileId: null },
      ],
    },
    'KYC-7723': { risk: 'Medium',
      id: 'KYC-7723', name: 'Rohit Agarwal', acct: 'XXXX7723',
      mobile: '+91 85432 10987', email: 'rohit.a***@gmail.com',
      dob: '29 Feb 1984', pan: 'XYZRA****T', aadhaar: 'XXXX XXXX 1144',
      constitution: 'Individual', relationship: 'Business Loan',
      address: '14/2, Commercial Complex, MG Road, Bengaluru - 560001',
      zone: 'South', city: 'Bengaluru', assignedTo: 'Mohit Sharma',
      due: '30 Apr 2026', status: 'In Progress', kycType: 'Full KYC',
      docsOnFile: [
        { name: 'PAN Card', meta: 'No. ABCPS****K', valid: true },
        { name: 'Aadhaar Card', meta: 'No. XXXX XXXX 1144', valid: true },
      ],
      panStep: { status: 'Verified', date: '20 Apr 2026' },
      poiStep: { status: 'In Progress', date: null, type: 'Aadhaar', mode: 'DigiLocker' },
      poaStep: { status: 'Pending', date: null, type: null, mode: null },
      vkycStep: { status: 'Pending', date: null },
      reminders: [
        { ch: 'SMS', date: '01 Apr 2026, 10:00 AM' },
        { ch: 'WhatsApp', date: '15 Apr 2026, 09:30 AM' },
        { ch: 'WhatsApp', date: '21 Apr 2026, 11:00 AM' },
      ],
      linkActive: true, linkExpiry: '30 Apr 2026, 11:59 PM',
      source: 'Digital', agent: null, completedDate: null, agentGeo: null,
      documents: [],
    },
  }
};

function loadDb() {
  if (!fs.existsSync(DB_PATH)) { saveDb(SEED); return JSON.parse(JSON.stringify(SEED)); }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function saveDb(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }
function now() { return new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true }); }
function today() { return new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric' }); }

loadDb();

app.get('/api/customers', (_, res) => { const db = loadDb(); res.json(Object.values(db.customers)); });
app.get('/api/customers/:id', (req, res) => { const db = loadDb(); const c = db.customers[req.params.id]; if (!c) return res.status(404).json({ error: 'Not found' }); res.json(c); });
app.put('/api/customers/:id', (req, res) => {
  const db = loadDb(); const c = db.customers[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  const body = req.body;
  // Merge fields
  Object.assign(c, body);
  // When status changes to Completed, update verification steps
  if (body.status === 'Completed' && body.kycType) {
    const d = today();
    c.panStep = { status: 'Verified', date: d };
    c.poiStep = { status: 'Verified', date: d, type: 'Aadhaar', mode: 'DigiLocker' };
    c.poaStep = { status: 'Verified', date: d, type: 'Aadhaar', mode: 'DigiLocker' };
    c.vkycStep = { status: 'Completed', date: d };
    c.linkActive = false;
    if (!c.reminders) c.reminders = [];
    c.reminders.push({ ch: 'System', date: now(), status: 'KYC completed via digital portal' });
  }
  if (body.status === 'Pending VKYC' && body.kycType === 'Full KYC') {
    const d = today();
    c.panStep = { status: 'Verified', date: d };
    c.poiStep = { status: 'Verified', date: d, type: 'Aadhaar', mode: 'DigiLocker' };
    c.poaStep = { status: 'Verified', date: d, type: 'Aadhaar', mode: 'DigiLocker' };
    c.vkycStep = { status: 'Pending', date: null };
    if (!c.reminders) c.reminders = [];
    c.reminders.push({ ch: 'System', date: now(), status: 'Documents submitted — VKYC link generated' });
  }
  saveDb(db); res.json(c);
});
app.post('/api/customers/:id/documents', upload.single('file'), (req, res) => {
  const db = loadDb(); const c = db.customers[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const doc = {
    id: 'd-' + uuid().slice(0, 8), name: req.body.docName || req.file.originalname,
    fileName: req.file.originalname, size: (req.file.size / 1024).toFixed(0) + ' KB',
    uploadedBy: req.body.uploadedBy || 'Customer', uploadDate: today(),
    status: 'pending', reviewedBy: null, reviewDate: null, rejectReason: null, fileId: req.file.filename,
  };
  c.documents.push(doc); saveDb(db); res.status(201).json(doc);
});
app.get('/api/files/:fileId', (req, res) => {
  const fp = path.join(UPLOAD_DIR, req.params.fileId);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(fp);
});
app.put('/api/customers/:id/documents/:did/review', (req, res) => {
  const db = loadDb(); const c = db.customers[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  const doc = c.documents.find(d => d.id === req.params.did);
  if (!doc) return res.status(404).json({ error: 'Doc not found' });
  const { action, reason, reviewer } = req.body;
  doc.status = action === 'approve' ? 'approved' : 'rejected';
  doc.reviewedBy = reviewer || 'Bank Officer';
  doc.reviewDate = today();
  if (action === 'reject') {
    doc.rejectReason = reason || '';
    c.reminders.push({ ch: 'System', date: now() });
  } else {
    c.reminders.push({ ch: 'System', date: now() });
  }
  saveDb(db); res.json(doc);
});
app.post('/api/customers/:id/regen-link', (req, res) => {
  const db = loadDb(); const c = db.customers[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  c.linkActive = true; c.linkExpiry = '02 May 2026, 11:59 PM';
  c.reminders.push({ ch: 'System', date: now() });
  saveDb(db); res.json(c);
});
app.post('/api/reset', (_, res) => {
  try { fs.readdirSync(UPLOAD_DIR).forEach(f => fs.unlinkSync(path.join(UPLOAD_DIR, f))); } catch(e) {}
  saveDb(SEED); res.json({ ok: true });
});
app.get('/health', (_, res) => { res.json({ status: 'ok', service: 'rekyc-api', timestamp: new Date().toISOString() }); });
app.get('/', (_, res) => { res.json({ service: 'Re-KYC API', version: '1.0.0' }); });

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`Re-KYC API running → port ${PORT}`));

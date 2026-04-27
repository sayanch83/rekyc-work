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

// ── Twilio Verify (optional — falls back to demo mode if not configured) ──
// Uses Verify Service instead of raw SMS — no phone number purchase needed
let twilioClient = null;
const VERIFY_SID = process.env.TWILIO_VERIFY_SID; // starts with VA...
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && VERIFY_SID) {
  try {
    const { default: twilio } = await import('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio Verify: connected — SID', VERIFY_SID);
  } catch(e) { console.warn('Twilio: failed to init —', e.message); }
} else { console.log('Twilio: not configured — OTP will be demo mode (123456)'); }

// ── Firebase Admin (optional) ──
let firebaseAdmin = null;
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    const { default: admin } = await import('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      })});
    }
    firebaseAdmin = admin;
    console.log('Firebase: connected');
  } catch(e) { console.warn('Firebase: failed to init —', e.message); }
} else { console.log('Firebase: not configured — push notifications disabled'); }

// ── SendGrid (optional) ──
let sgMail = null;
if (process.env.SENDGRID_API_KEY) {
  try {
    const sg = await import('@sendgrid/mail');
    sgMail = sg.default;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('SendGrid: connected');
  } catch(e) { console.warn('SendGrid: failed to init —', e.message); }
} else { console.log('SendGrid: not configured — emails disabled'); }

// ── DigiLocker OAuth ──
const DL_CLIENT_ID     = process.env.DIGILOCKER_CLIENT_ID     || '';
const DL_CLIENT_SECRET = process.env.DIGILOCKER_CLIENT_SECRET || '';
const DL_REDIRECT_URI  = process.env.DIGILOCKER_REDIRECT_URI  || '';
// DigiLocker sandbox vs production
const DL_BASE = process.env.DIGILOCKER_ENV === 'production'
  ? 'https://api.digitallocker.gov.in'
  : 'https://sandbox.digitallocker.gov.in';

const dlConfigured = !!(DL_CLIENT_ID && DL_CLIENT_SECRET && DL_REDIRECT_URI);
console.log(dlConfigured ? 'DigiLocker: configured' : 'DigiLocker: not configured');

// In-memory store for OAuth state → customer mapping (state is a random nonce)
const dlStateStore = new Map(); // state → { custId, screen, expires }

function dlAuthUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: DL_CLIENT_ID,
    redirect_uri: DL_REDIRECT_URI,
    state,
    scope: 'openid',
  });
  return `${DL_BASE}/public/oauth2/1/authorize?${params}`;
}

async function sendPushNotification(fcmToken, title, body, data = {}) {
  if (!firebaseAdmin || !fcmToken) return;
  try {
    await firebaseAdmin.messaging().send({ token: fcmToken, notification: { title, body }, data });
  } catch(e) { console.warn('FCM send failed:', e.message); }
}

async function sendEmail(to, subject, html) {
  if (!sgMail || !to) return;
  try {
    await sgMail.send({
      to, from: process.env.SENDGRID_FROM || 'rekyc@nationalbank.co.in',
      subject, html,
    });
  } catch(e) { console.warn('SendGrid send failed:', e.message); }
}

function ackEmailHtml(custName, custId, kycType, ref) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#074994;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="margin:0;font-size:20px">National Bank Ltd.</h2>
    <p style="margin:4px 0 0;opacity:.8;font-size:13px">KYC Update — Acknowledgement</p>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
    <p>Dear <strong>${custName}</strong>,</p>
    <p>Your KYC update has been received and is currently under review.</p>
    <div style="background:#f0f4f8;border-left:4px solid #074994;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0">
      <strong>Reference: ${ref}</strong>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
      <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee">Customer ID</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${custId}</td></tr>
      <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee">KYC Type</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${kycType}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Expected TAT</td><td style="padding:8px 0;text-align:right">2–3 working days</td></tr>
    </table>
    <p style="color:#666;font-size:13px">You will receive another email once your KYC has been verified. Your pre-approved reward will be credited upon successful verification.</p>
    <p style="color:#999;font-size:11px;margin-top:24px">This is a system-generated email. Please do not reply to this message.</p>
  </div>
  </div>`;
}

function rejectionEmailHtml(custName, docName, reason, custId) {
  const link = `https://nationalbank.co.in/rekyc?id=${custId}`;
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#900909;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="margin:0;font-size:20px">Action Required</h2>
    <p style="margin:4px 0 0;opacity:.8;font-size:13px">Document Rejected — Re-upload Required</p>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
    <p>Dear <strong>${custName}</strong>,</p>
    <p>Your document <strong>${docName}</strong> was reviewed and could not be accepted.</p>
    <div style="background:#fde8e8;border-left:4px solid #900909;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0">
      <strong style="color:#900909">Rejection Reason:</strong><br>
      <span style="color:#333">${reason || 'Document could not be verified. Please upload a clearer copy.'}</span>
    </div>
    <p>Please re-upload a valid copy to continue your KYC process:</p>
    <a href="${link}" style="display:inline-block;background:#074994;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:8px 0">Re-upload Document</a>
    <p style="color:#999;font-size:11px;margin-top:24px">This is a system-generated email. Please do not reply to this message.</p>
  </div>
  </div>`;
}

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
app.put('/api/customers/:id', async (req, res) => {
  const db = loadDb(); const c = db.customers[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  const body = req.body;
  Object.assign(c, body);
  if (body.status === 'Completed' && body.kycType) {
    const d = today();
    c.panStep = { status: 'Verified', date: d };
    c.poiStep = { status: 'Verified', date: d, type: 'Aadhaar', mode: 'DigiLocker' };
    c.poaStep = { status: 'Verified', date: d, type: 'Aadhaar', mode: 'DigiLocker' };
    c.vkycStep = { status: 'Completed', date: d };
    c.linkActive = false;
    if (!c.reminders) c.reminders = [];
    c.reminders.push({ ch: 'System', date: now(), status: 'KYC completed via digital portal' });
    const ref = `KYC-2026-${c.acct.slice(-4)}`;
    await sendEmail(c.email, `National Bank: KYC Submitted — ${ref}`, ackEmailHtml(c.name, c.id, body.kycType, ref));
  }
  if (body.status === 'Pending VKYC' && body.kycType === 'Full KYC') {
    const d = today();
    c.panStep = { status: 'Verified', date: d };
    c.poiStep = { status: 'Verified', date: d, type: 'Aadhaar', mode: 'DigiLocker' };
    c.poaStep = { status: 'Verified', date: d, type: 'Aadhaar', mode: 'DigiLocker' };
    c.vkycStep = { status: 'Pending', date: null };
    if (!c.reminders) c.reminders = [];
    c.reminders.push({ ch: 'System', date: now(), status: 'Documents submitted — VKYC link generated' });
    const ref = `KYC-2026-${c.acct.slice(-4)}`;
    await sendEmail(c.email, `National Bank: Documents Received — VKYC Pending`, ackEmailHtml(c.name, c.id, body.kycType, ref));
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
app.put('/api/customers/:id/documents/:did/review', async (req, res) => {
  const db = loadDb(); const c = db.customers[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });
  const doc = c.documents.find(d => d.id === req.params.did);
  if (!doc) return res.status(404).json({ error: 'Doc not found' });
  const { action, reason, reviewer } = req.body;
  doc.status = action === 'approve' ? 'approved' : 'rejected';
  doc.reviewedBy = reviewer || 'Bank Officer';
  doc.reviewDate = today();
  if (action === 'reject') doc.rejectReason = reason || '';
  c.reminders.push({ ch: 'System', date: now(), status: action === 'approve' ? 'Document approved' : 'Document rejected' });
  saveDb(db);

  // ── Push notification ──
  const fcmToken = db.fcmTokens?.[c.id];
  if (action === 'approve') {
    await sendPushNotification(fcmToken,
      `Document Approved ✓`,
      `Your ${doc.name} has been verified by National Bank.`,
      { action: 'approved', custId: c.id }
    );
    await sendEmail(c.email,
      `National Bank: ${doc.name} Approved`,
      ackEmailHtml(c.name, c.id, c.kycType || 'KYC Update', `KYC-2026-${c.acct.slice(-4)}`)
    );
  } else {
    await sendPushNotification(fcmToken,
      `Action Required: Document Rejected`,
      `Your ${doc.name} was not accepted. Tap to re-upload.`,
      { action: 'rejected', custId: c.id, docId: doc.id }
    );
    await sendEmail(c.email,
      `Action Required: Re-upload ${doc.name}`,
      rejectionEmailHtml(c.name, doc.name, reason, c.id)
    );
  }

  res.json(doc);
});
app.post('/api/customers/:id/regen-link', async (req, res) => {
  const db = loadDb(); const c = db.customers[req.params.id];
  if (!c) return res.status(404).json({ error: 'Not found' });

  const expiryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

  c.linkActive = true;
  c.linkExpiry = expiryDate;
  c.reminders.push({ ch: 'SMS', date: now(), status: 'Re-KYC link sent via SMS' });
  saveDb(db);

  // Send real SMS via Twilio if configured
  const frontendUrl = process.env.FRONTEND_URL || 'https://rekyc-ui-production.up.railway.app';
  const link = `${frontendUrl}/customer?id=${c.id}`;
  const msg = `National Bank: Your Re-KYC link is ready. Click to complete your KYC update: ${link} Valid until ${expiryDate}. Do not share this link.`;

  if (twilioClient && VERIFY_SID && c.mobile) {
    try {
      await twilioClient.messages.create({
        body: msg,
        from: process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID
          ? process.env.TWILIO_PHONE_NUMBER
          : undefined,
        messagingServiceSid: !process.env.TWILIO_PHONE_NUMBER ? process.env.TWILIO_MESSAGING_SERVICE_SID : undefined,
        to: c.mobile,
      });
      console.log(`Re-KYC link SMS sent to ${c.mobile}`);
    } catch(e) {
      console.warn('SMS send failed (link still regenerated):', e.message);
    }
  } else {
    console.log(`[DEMO] Re-KYC link for ${c.name}: ${link}`);
  }

  res.json(c);
});

// ── OTP: Send via Twilio Verify ──
app.post('/api/otp/send', async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ error: 'Mobile required' });

  if (twilioClient && VERIFY_SID) {
    try {
      // Twilio Verify handles rate limiting, expiry, and attempt counting automatically
      const verification = await twilioClient.verify.v2
        .services(VERIFY_SID)
        .verifications.create({ to: mobile, channel: 'sms' });
      console.log(`Verify OTP sent to ${mobile} — status: ${verification.status}`);
      res.json({ ok: true, via: 'sms', status: verification.status });
    } catch(e) {
      console.error('Twilio Verify send error:', e.message);
      // Handle specific Twilio errors clearly
      if (e.code === 60200) return res.status(400).json({ error: 'Invalid mobile number format.' });
      if (e.code === 60203) return res.status(429).json({ error: 'Max OTP attempts reached. Please try again later.' });
      res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }
  } else {
    // Demo mode — no Twilio configured, silently accept any 6-digit code
    console.log(`[DEMO] OTP requested for ${mobile} — Twilio not configured`);
    res.json({ ok: true, via: 'demo' });
  }
});

// ── OTP: Verify via Twilio Verify ──
app.post('/api/otp/verify', async (req, res) => {
  const { mobile, otp } = req.body;
  if (!mobile || !otp) return res.status(400).json({ error: 'Mobile and OTP required' });

  // Demo mode: any 6-digit code works when Twilio not configured
  if (!twilioClient || !VERIFY_SID) {
    if (otp.length === 6) return res.json({ ok: true, demo: true });
    return res.status(400).json({ error: 'Please enter a valid 6-digit OTP.', attemptsLeft: 2 });
  }

  try {
    const check = await twilioClient.verify.v2
      .services(VERIFY_SID)
      .verificationChecks.create({ to: mobile, code: otp });

    if (check.status === 'approved') {
      res.json({ ok: true });
    } else {
      // 'pending' means wrong code — Twilio tracks attempts automatically
      res.status(400).json({
        error: 'Incorrect OTP. Please check and try again.',
        attemptsLeft: 2, // Twilio allows 5 attempts before auto-expiry
      });
    }
  } catch(e) {
    console.error('Twilio Verify check error:', e.message);
    if (e.code === 60202) {
      // Max check attempts reached — Twilio expires the verification automatically
      return res.status(429).json({
        error: 'Too many incorrect attempts. Please request a new OTP.',
        locked: true,
      });
    }
    if (e.code === 20404) {
      return res.status(400).json({
        error: 'OTP has expired or was already used. Please request a new one.',
        expired: true,
      });
    }
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// ── DigiLocker: Initiate OAuth ──
app.get('/api/digilocker/init', (req, res) => {
  const custId = req.query.custId;
  if (!custId) return res.status(400).json({ error: 'custId required' });

  if (!dlConfigured) {
    return res.status(503).json({ error: 'DigiLocker not configured', demo: true });
  }

  // Generate random state nonce (CSRF protection)
  const state = uuid().replace(/-/g, '');
  dlStateStore.set(state, {
    custId,
    expires: Date.now() + 10 * 60 * 1000, // 10 min
  });

  const authUrl = dlAuthUrl(state);
  res.json({ ok: true, authUrl });
});

// ── DigiLocker: OAuth Callback (browser redirect) ──
app.get('/api/digilocker/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL || 'https://rekyc-ui-production.up.railway.app'}/customer?dl_error=${error}`);
  }

  const stateData = dlStateStore.get(state);
  if (!stateData || Date.now() > stateData.expires) {
    return res.redirect(`${process.env.FRONTEND_URL || 'https://rekyc-ui-production.up.railway.app'}/customer?dl_error=invalid_state`);
  }
  dlStateStore.delete(state);

  const { custId } = stateData;

  try {
    // Exchange code for access token
    const tokenRes = await fetch(`${DL_BASE}/public/oauth2/1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: DL_CLIENT_ID,
        client_secret: DL_CLIENT_SECRET,
        redirect_uri: DL_REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token: ' + JSON.stringify(tokenData));

    const accessToken = tokenData.access_token;

    // Fetch Aadhaar eKYC data
    const eKycRes = await fetch(`${DL_BASE}/public/oauth2/1/xml/eaadhaar`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const eKycXml = await eKycRes.text();

    // Parse key fields from Aadhaar XML
    const getName  = (xml) => xml.match(/<name>([^<]+)<\/name>/i)?.[1] || xml.match(/name="([^"]+)"/i)?.[1] || '';
    const getDob   = (xml) => xml.match(/<dob>([^<]+)<\/dob>/i)?.[1]  || xml.match(/dob="([^"]+)"/i)?.[1]  || '';
    const getGender= (xml) => xml.match(/<gender>([^<]+)<\/gender>/i)?.[1] || xml.match(/gender="([^"]+)"/i)?.[1] || '';
    const getAddr  = (xml) => xml.match(/<address>([^<]+)<\/address>/i)?.[1] || '';

    const aadhaarData = {
      name:   getName(eKycXml),
      dob:    getDob(eKycXml),
      gender: getGender(eKycXml),
      address: getAddr(eKycXml),
      verifiedAt: new Date().toISOString(),
      source: 'DigiLocker',
    };

    // Save verified data to customer record
    const db = loadDb();
    const c = db.customers[custId];
    if (c) {
      c.digilockerVerified = aadhaarData;
      c.poiStep = { status: 'Verified', date: today(), type: 'Aadhaar', mode: 'DigiLocker' };
      c.poaStep = { status: 'Verified', date: today(), type: 'Aadhaar', mode: 'DigiLocker' };
      if (!c.reminders) c.reminders = [];
      c.reminders.push({ ch: 'System', date: now(), status: 'Aadhaar verified via DigiLocker' });
      saveDb(db);
    }

    console.log(`DigiLocker: Aadhaar verified for customer ${custId} — ${aadhaarData.name}`);

    // Redirect back to customer portal with success flag
    res.redirect(`${process.env.FRONTEND_URL || 'https://rekyc-ui-production.up.railway.app'}/customer?dl_verified=${custId}&custId=${custId}`);

  } catch(e) {
    console.error('DigiLocker callback error:', e.message);
    res.redirect(`${process.env.FRONTEND_URL || 'https://rekyc-ui-production.up.railway.app'}/customer?dl_error=fetch_failed&custId=${custId}`);
  }
});

// ── DigiLocker: Check verification status ──
app.get('/api/digilocker/status/:custId', (req, res) => {
  const db = loadDb();
  const c = db.customers[req.params.custId];
  if (!c) return res.status(404).json({ error: 'Not found' });

  if (c.digilockerVerified) {
    res.json({
      verified: true,
      name:   c.digilockerVerified.name,
      dob:    c.digilockerVerified.dob,
      gender: c.digilockerVerified.gender,
      verifiedAt: c.digilockerVerified.verifiedAt,
    });
  } else {
    res.json({ verified: false });
  }
});


app.post('/api/customers/:id/fcm-token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });
  const db = loadDb();
  if (!db.fcmTokens) db.fcmTokens = {};
  db.fcmTokens[req.params.id] = token;
  saveDb(db);
  console.log(`FCM token saved for customer ${req.params.id}`);
  res.json({ ok: true });
});

// ── Bulk: Create single customer record ──
app.post('/api/customers/bulk', (req, res) => {
  const db = loadDb();
  const body = req.body;
  if (!body.id || !body.name || !body.mobile) {
    return res.status(400).json({ error: 'id, name, mobile required' });
  }
  // Check for duplicate by ID
  if (db.customers[body.id]) {
    return res.status(409).json({ error: `Customer ${body.id} already exists` });
  }
  // Check for duplicate mobile
  const existingByMobile = Object.values(db.customers).find((c: any) =>
    c.mobile?.replace(/\D/g,'') === body.mobile?.replace(/\D/g,'')
  );
  if (existingByMobile) {
    return res.status(409).json({ error: `Mobile ${body.mobile} already registered` });
  }
  db.customers[body.id] = {
    ...body,
    id: body.id,
    reminders: body.reminders || [],
    documents: body.documents || [],
    docsOnFile: body.docsOnFile || [],
  };
  saveDb(db);
  console.log(`Bulk: created customer ${body.id} — ${body.name}`);
  res.json(db.customers[body.id]);
});


app.post('/api/demo/config', (req, res) => {
  const db = loadDb();
  const { custId = 'KYC-4528', ...updates } = req.body;
  const c = db.customers[custId];
  if (!c) return res.status(404).json({ error: `Customer ${custId} not found` });
  Object.assign(c, updates);
  saveDb(db);
  console.log(`Demo config updated for ${custId}:`, Object.keys(updates).join(', '));
  res.json({ ok: true, customer: { id: c.id, name: c.name, mobile: c.mobile, email: c.email, due: c.due } });
});

app.get('/api/demo/config/:custId', (req, res) => {
  const db = loadDb();
  const c = db.customers[req.params.custId];
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json({ id: c.id, name: c.name, mobile: c.mobile, email: c.email, due: c.due, status: c.status, risk: c.risk });
});

app.post('/api/reset', (_, res) => {
  try { fs.readdirSync(UPLOAD_DIR).forEach(f => fs.unlinkSync(path.join(UPLOAD_DIR, f))); } catch(e) {}
  saveDb(SEED); res.json({ ok: true });
});
app.get('/health', (_, res) => { res.json({ status: 'ok', service: 'rekyc-api', timestamp: new Date().toISOString(), integrations: { twilio_verify: !!(twilioClient && VERIFY_SID), firebase: !!firebaseAdmin, sendgrid: !!sgMail, digilocker: dlConfigured } }); });
app.get('/', (_, res) => { res.json({ service: 'Re-KYC API', version: '1.0.0' }); });

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`Re-KYC API running → port ${PORT}`));

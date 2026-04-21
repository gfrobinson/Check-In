// send-accountability.mjs
// Runs every 15 minutes via GitHub Actions.
// Finds unsent accountability emails in Firestore, sends them via Resend, marks as sent.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const serviceAccount   = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const ALERT_FROM_EMAIL = process.env.ALERT_FROM_EMAIL;
const APP_URL          = process.env.APP_URL || 'https://gfrobinson.github.io/Check-In';

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

console.log(`Running at: ${new Date().toISOString()}`);

// Find all unsent pending emails
const snap = await db.collection('pendingAccountabilityEmails')
  .where('sent', '==', false)
  .get();

if (snap.empty) { console.log('No pending accountability emails.'); process.exit(0); }

console.log(`Found ${snap.docs.length} pending email(s).`);
let sent = 0, failed = 0;

for (const docSnap of snap.docs) {
  const data = docSnap.data();
  const { setName, partnerEmail, mode, questions, answers } = data;

  try {
    await sendEmail({ setName, partnerEmail, mode, questions, answers });
    await docSnap.ref.update({ sent: true, sentAt: Timestamp.now() });
    console.log(`Sent accountability email for "${setName}" to ${partnerEmail}`);
    sent++;
  } catch(e) {
    console.error(`Failed for "${setName}" to ${partnerEmail}:`, e.message);
    failed++;
  }
}

console.log(`Done. Sent: ${sent}, Failed: ${failed}`);

async function sendEmail({ setName, partnerEmail, mode, questions, answers }) {
  // Calculate score
  const nums = questions.flatMap(q => {
    const a = answers[q.id];
    if (q.type === 'scale' && typeof a === 'number') return [a];
    if (q.type === 'yesno' && a !== undefined) return [a === (q.desiredAnswer || 'Yes') ? 10 : 0];
    return [];
  });
  const score = nums.length ? (nums.reduce((s,n)=>s+n,0)/nums.length).toFixed(1) : 'N/A';

  let bodyHtml = '';

  if (mode === 'all') {
    bodyHtml = questions.map(q => {
      const a = answers[q.id];
      if (a === undefined) return '';
      return `<div style="margin-bottom:0.75rem;padding:0.75rem 1rem;background:#1e2028;border-radius:8px;">
        <div style="font-size:0.78rem;color:#8b8fa8;margin-bottom:4px;">${q.text}</div>
        <div style="font-weight:600;color:#e8e9f0;">${a}${q.type==='scale'?' / 10':''}</div>
      </div>`;
    }).join('');
    bodyHtml += `<div style="margin-top:1rem;padding:0.75rem 1rem;background:#1e2028;border-radius:8px;text-align:center;">
      <div style="font-size:0.78rem;color:#8b8fa8;margin-bottom:4px;">Overall Score</div>
      <div style="font-size:1.5rem;font-weight:700;color:#a78bfa;">${score}/10</div>
    </div>`;
  } else {
    bodyHtml = `<div style="text-align:center;padding:1.5rem 0;">
      <div style="font-size:3.5rem;font-weight:700;color:#a78bfa;line-height:1;">${score}</div>
      <div style="font-size:1.2rem;color:#8b8fa8;margin-top:4px;">/ 10</div>
      <div style="color:#8b8fa8;margin-top:0.75rem;font-size:0.9rem;">Overall Score</div>
    </div>`;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: ALERT_FROM_EMAIL,
      to: [partnerEmail],
      subject: `📋 ${setName} check-in completed`,
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0e0f14;color:#e8e9f0;max-width:520px;margin:0 auto;padding:2rem;">
        <div style="background:#16181f;border:1px solid #2a2d38;border-radius:12px;padding:2rem;">
          <h1 style="font-size:1.4rem;color:#a78bfa;margin-bottom:.25rem;">CheckIn.</h1>
          <h2 style="font-weight:400;font-size:1.1rem;margin-bottom:1.5rem;color:#8b8fa8;">${setName} — just completed</h2>
          ${bodyHtml}
          <hr style="border:none;border-top:1px solid #2a2d38;margin:1.5rem 0;"/>
          <p style="font-size:.8rem;color:#8b8fa8;">Sent via <a href="${APP_URL}" style="color:#7c6af7;">CheckIn</a>.</p>
        </div>
      </body></html>`
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error: ${text}`);
  }
}

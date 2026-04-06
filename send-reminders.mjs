// send-reminders.mjs
// Runs hourly via GitHub Actions.
// Reads user settings from Firestore, checks who needs a reminder, emails them.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const serviceAccount   = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const ALERT_FROM_EMAIL = process.env.ALERT_FROM_EMAIL;
const APP_URL          = process.env.APP_URL || 'https://gfrobinson.github.io/checkin-app';

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const now        = new Date();
const currentHour = String(now.getUTCHours()).padStart(2,'0');
const currentDOW  = now.getUTCDay();
const todayStart  = new Date(now); todayStart.setUTCHours(0,0,0,0);

console.log(`Running at UTC ${currentHour}:xx, DOW=${currentDOW}`);

// Get all users
const usersSnap = await db.collection('users').listDocuments();
let sent = 0, skipped = 0;

for (const userRef of usersSnap) {
  // Get reminder settings
  const settingsDoc = await userRef.collection('settings').doc('reminders').get();
  if (!settingsDoc.exists) { skipped++; continue; }
  const s = settingsDoc.data();

  // Match hour
  const [settingHour] = (s.reminderTime || '08:00').split(':');
  if (settingHour !== currentHour) { skipped++; continue; }

  // Match day
  if (s.frequency === 'weekly' && s.weekday !== currentDOW) { skipped++; continue; }
  if (s.frequency === 'custom' && !(s.customDays||[]).includes(currentDOW)) { skipped++; continue; }

  // Already checked in today?
  const checkinsSnap = await userRef.collection('checkins')
    .where('completedAt', '>=', Timestamp.fromDate(todayStart))
    .limit(1).get();
  if (!checkinsSnap.empty) { console.log(`User ${userRef.id} already checked in.`); skipped++; continue; }

  const toEmail = s.reminderEmail;
  if (!toEmail) { skipped++; continue; }

  await sendEmail(toEmail);
  console.log(`Sent to ${toEmail}`);
  sent++;
}

console.log(`Done. Sent: ${sent}, Skipped: ${skipped}`);

async function sendEmail(to) {
  if (!SENDGRID_API_KEY) { console.log(`[DRY RUN] Would email ${to}`); return; }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: ALERT_FROM_EMAIL },
      subject: '⏰ Time for your daily check-in',
      content: [{
        type: 'text/html',
        value: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0e0f14;color:#e8e9f0;max-width:520px;margin:0 auto;padding:2rem;">
          <div style="background:#16181f;border:1px solid #2a2d38;border-radius:12px;padding:2rem;">
            <h1 style="font-size:1.4rem;color:#a78bfa;margin-bottom:.5rem;">CheckIn.</h1>
            <h2 style="font-weight:400;font-size:1.2rem;margin-bottom:1rem;">Time for your check-in 📋</h2>
            <p style="color:#8b8fa8;margin-bottom:1.5rem;">Take a moment to reflect and track your progress today.</p>
            <a href="${APP_URL}" style="display:inline-block;background:#7c6af7;color:#fff;padding:.75rem 1.75rem;border-radius:10px;text-decoration:none;font-weight:600;">
              Start Check-In →
            </a>
          </div>
        </body></html>`
      }]
    })
  });
  if (!res.ok) console.error('SendGrid error:', await res.text());
}

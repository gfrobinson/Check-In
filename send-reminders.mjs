// send-reminders.mjs
// Runs hourly. For each user, checks each Question Set to see if a reminder
// should be sent based on their local timezone and the set's reminder time.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const serviceAccount   = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const ALERT_FROM_EMAIL = process.env.ALERT_FROM_EMAIL;
const APP_URL          = process.env.APP_URL || 'https://gfrobinson.github.io/Check-In';

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const nowUTC = new Date();
console.log(`Running at UTC: ${nowUTC.toISOString()}`);

const usersSnap = await db.collection('users').listDocuments();
let sent = 0, skipped = 0;

for (const userRef of usersSnap) {
  // Get user profile (timezone + reminder email)
  const profileDoc = await userRef.collection('settings').doc('profile').get();
  if (!profileDoc.exists) { skipped++; continue; }
  const profile = profileDoc.data();
  const timezone     = profile.timezone || 'America/Anchorage';
  const reminderEmail = profile.reminderEmail;
  if (!reminderEmail) { skipped++; continue; }

  // Get current local time for this user's timezone
  const localTime = new Date(nowUTC.toLocaleString('en-US', { timeZone: timezone }));
  const localHour = localTime.getHours();
  const localDOW  = localTime.getDay();
  const localDate = localTime.getDate();
  const localDateStr = localTime.toISOString().split('T')[0];

  // Get all question sets for this user
  const setsSnap = await userRef.collection('questionSets').get();
  if (setsSnap.empty) { skipped++; continue; }

  for (const setDoc of setsSnap.docs) {
    const set = setDoc.data();
    const setId = setDoc.id;

    // Match reminder hour (local time)
    const [setHour] = (set.reminderTime || '08:00').split(':').map(Number);
    if (setHour !== localHour) { skipped++; continue; }

    // Match frequency/day
    if (set.frequency === 'weekly' && parseInt(set.weekday) !== localDOW) { skipped++; continue; }
    if (set.frequency === 'monthly' && parseInt(set.monthDay || 1) !== localDate) { skipped++; continue; }
    if (set.frequency === 'custom' && !(set.customDays || []).includes(localDOW)) { skipped++; continue; }

    // Already checked in today for this set?
    const startOfDay = new Date(localTime); startOfDay.setHours(0,0,0,0);
    const checkinsSnap = await userRef.collection('checkins').doc(setId)
      .collection('entries')
      .where('completedAt', '>=', Timestamp.fromDate(startOfDay))
      .limit(1).get();

    if (!checkinsSnap.empty) {
      console.log(`User ${userRef.id} already completed "${set.name}" today — skipping.`);
      skipped++;
      continue;
    }

    await sendEmail(reminderEmail, set.name);
    console.log(`Sent reminder for "${set.name}" to ${reminderEmail}`);
    sent++;
  }
}

console.log(`Done. Sent: ${sent}, Skipped: ${skipped}`);

async function sendEmail(to, setName) {
  if (!RESEND_API_KEY) { console.log(`[DRY RUN] Would email ${to} for "${setName}"`); return; }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: ALERT_FROM_EMAIL,
      to: [to],
      subject: `⏰ Time for your check-in`,
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0e0f14;color:#e8e9f0;max-width:520px;margin:0 auto;padding:2rem;">
        <div style="background:#16181f;border:1px solid #2a2d38;border-radius:12px;padding:2rem;">
          <h1 style="font-size:1.4rem;color:#a78bfa;margin-bottom:.5rem;">CheckIn.</h1>
          <h2 style="font-weight:400;font-size:1.2rem;margin-bottom:1rem;">Time for your check-in. 📋</h2>
          <p style="color:#8b8fa8;margin-bottom:1.5rem;">Take a moment to reflect and track your progress.</p>
          <a href="${APP_URL}" style="display:inline-block;background:#7c6af7;color:#fff;padding:.75rem 1.75rem;border-radius:10px;text-decoration:none;font-weight:600;">
            Start Check-In →
          </a>
          <hr style="border:none;border-top:1px solid #2a2d38;margin:1.5rem 0;"/>
          <p style="font-size:.8rem;color:#8b8fa8;">You're receiving this because you set up a reminder in CheckIn. <a href="${APP_URL}" style="color:#7c6af7;">Manage settings</a>.</p>
        </div>
      </body></html>`
    })
  });

  if (!res.ok) console.error(`Resend error for ${to}:`, await res.text());
}

// send-reminders.mjs
// Runs hourly via GitHub Actions.
// Finds users whose reminder time matches the current UTC hour,
// checks if they haven't checked in yet today, and emails them.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SENDGRID_API_KEY     = process.env.SENDGRID_API_KEY;
const ALERT_FROM_EMAIL     = process.env.ALERT_FROM_EMAIL;
const APP_URL              = process.env.APP_URL || 'https://YOUR-USERNAME.github.io/checkin-app';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}
if (!SENDGRID_API_KEY) {
  console.warn('No SENDGRID_API_KEY — emails will be skipped (dry run).');
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Current UTC hour as HH:MM string (we match on hour only; minutes stored in setting)
const now = new Date();
const currentHour = String(now.getUTCHours()).padStart(2, '0');
const currentDOW  = now.getUTCDay(); // 0=Sun … 6=Sat
const todayStr    = now.toISOString().split('T')[0];

console.log(`Running at UTC ${currentHour}:xx, DOW=${currentDOW}, date=${todayStr}`);

// ===== Fetch all user settings =====
const { data: settings, error: sErr } = await db
  .from('user_settings')
  .select('user_id, frequency, reminder_time, reminder_email, weekday, custom_days');

if (sErr) { console.error('Failed to fetch settings:', sErr.message); process.exit(1); }

let sent = 0, skipped = 0;

for (const s of settings) {
  const [settingHour] = (s.reminder_time || '08:00').split(':');

  // 1. Does the reminder hour match current UTC hour?
  if (settingHour !== currentHour) { skipped++; continue; }

  // 2. Should we remind today based on frequency?
  if (s.frequency === 'weekly') {
    if (parseInt(s.weekday) !== currentDOW) { skipped++; continue; }
  } else if (s.frequency === 'custom') {
    const days = s.custom_days || [1,2,3,4,5];
    if (!days.includes(currentDOW)) { skipped++; continue; }
  }
  // 'daily' always passes

  // 3. Has the user already checked in today?
  const { data: todayCheckin } = await db
    .from('checkins')
    .select('id')
    .eq('user_id', s.user_id)
    .gte('completed_at', todayStr + 'T00:00:00Z')
    .lte('completed_at', todayStr + 'T23:59:59Z')
    .single();

  if (todayCheckin) {
    console.log(`User ${s.user_id} already checked in today — skipping.`);
    skipped++;
    continue;
  }

  // 4. Get reminder email (fall back to auth email)
  let toEmail = s.reminder_email;
  if (!toEmail) {
    const { data: authUser } = await db.auth.admin.getUserById(s.user_id);
    toEmail = authUser?.user?.email;
  }
  if (!toEmail) { console.warn(`No email for user ${s.user_id}`); skipped++; continue; }

  // 5. Send email
  await sendReminderEmail(toEmail, APP_URL);
  console.log(`Sent reminder to ${toEmail}`);
  sent++;
}

console.log(`Done. Sent: ${sent}, Skipped: ${skipped}`);

// ===== Email via SendGrid =====
async function sendReminderEmail(toEmail, appUrl) {
  if (!SENDGRID_API_KEY) {
    console.log(`[DRY RUN] Would send to ${toEmail}`);
    return;
  }

  const body = {
    personalizations: [{ to: [{ email: toEmail }] }],
    from: { email: ALERT_FROM_EMAIL },
    subject: "⏰ Time for your daily check-in",
    content: [
      {
        type: "text/html",
        value: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="font-family:sans-serif;background:#0e0f14;color:#e8e9f0;max-width:520px;margin:0 auto;padding:2rem;">
  <div style="background:#16181f;border:1px solid #2a2d38;border-radius:12px;padding:2rem;">
    <h1 style="font-size:1.4rem;margin-bottom:.5rem;color:#a78bfa;">CheckIn.</h1>
    <h2 style="font-size:1.2rem;font-weight:400;margin-bottom:1rem;">Time for your daily check-in 📋</h2>
    <p style="color:#8b8fa8;margin-bottom:1.5rem;">How are you doing today? Take a moment to reflect and track your progress.</p>
    <a href="${appUrl}/pages/checkin.html"
       style="display:inline-block;background:#7c6af7;color:#fff;padding:.75rem 1.75rem;border-radius:10px;text-decoration:none;font-weight:600;">
      Start Check-In →
    </a>
    <hr style="border:none;border-top:1px solid #2a2d38;margin:1.5rem 0;"/>
    <p style="font-size:.8rem;color:#8b8fa8;">
      You're receiving this because you set up a reminder in CheckIn.
      To change your reminder settings, visit <a href="${appUrl}/pages/settings.html" style="color:#7c6af7;">Settings</a>.
    </p>
  </div>
</body>
</html>`
      }
    ]
  };

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`SendGrid error for ${toEmail}:`, text);
  }
}

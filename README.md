# CheckIn — Personal Habit Tracker

A personal check-in app hosted on GitHub Pages. Set custom questions, get email reminders, and track your progress over time.

## Features

- ✅ Custom questions: 1–10 scale, Yes/No, Multiple choice, Free text
- ✅ Daily, weekly, or custom day reminders via email
- ✅ Progress charts (trend + per-question breakdowns)
- ✅ Streak tracking
- ✅ Secure auth via Supabase (email/password)
- ✅ All data stored in your own Supabase project

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML/CSS/JS — GitHub Pages |
| Auth & Database | Supabase (free tier) |
| Email Reminders | SendGrid (free: 100 emails/day) |
| Scheduled Emails | GitHub Actions (hourly cron) |

---

## Setup Instructions

### 1. Fork or Create This Repository

Create a new GitHub repo and upload all files, OR fork this one.

Make the repo **public** (required for free GitHub Pages).

---

### 2. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (save your database password)
3. Go to **SQL Editor → New query**
4. Paste the contents of `sql/setup.sql` and click **Run**
5. Go to **Settings → API** and copy:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **anon / public key** (starts with `eyJ…`)
   - **service_role key** (keep this secret — only for GitHub Actions)

6. Open `js/supabase.js` and replace:
   ```js
   const SUPABASE_URL = 'YOUR_SUPABASE_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```

---

### 3. Enable GitHub Pages

1. Go to your repo **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main**, folder: **/ (root)**
4. Click **Save** — your app will be at:  
   `https://YOUR-USERNAME.github.io/checkin-app`

---

### 4. SendGrid Setup (email reminders)

1. Sign up at [sendgrid.com](https://sendgrid.com) (free: 100 emails/day)
2. Verify a sender email address (Settings → Sender Authentication)
3. Create an API key (Settings → API Keys → Full Access)
4. Copy the key (starts with `SG.`)

---

### 5. Add GitHub Secrets

Go to your repo **Settings → Secrets and variables → Actions → New repository secret**.

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase service_role key |
| `SENDGRID_API_KEY` | Your SendGrid API key |
| `ALERT_FROM_EMAIL` | Your verified SendGrid sender email |
| `APP_URL` | Your GitHub Pages URL (e.g. `https://user.github.io/checkin-app`) |

The GitHub Action (`.github/workflows/reminders.yml`) runs **every hour**. It checks each user's saved reminder time and sends an email only when it matches AND the user hasn't checked in yet that day.

---

### 6. First Use

1. Visit your GitHub Pages URL
2. Click **Get Started** → create an account
3. Go to **Settings** → add your check-in questions
4. Set your reminder schedule and email
5. Do your first check-in!

---

## File Structure

```
checkin-app/
├── index.html                  # Dashboard
├── css/
│   └── style.css
├── js/
│   └── supabase.js             # Supabase client + shared functions
├── pages/
│   ├── checkin.html            # Check-in form
│   ├── history.html            # History + charts
│   └── settings.html           # Questions + reminder settings
├── scripts/
│   ├── send-reminders.mjs      # Email reminder script (Node.js)
│   └── package.json
├── sql/
│   └── setup.sql               # Supabase table definitions
├── .github/
│   └── workflows/
│       └── reminders.yml       # GitHub Actions cron job
└── README.md
```

---

## Notes

- **Reminder times** are stored and matched in UTC. If you're in Alaska (UTC−9), set your reminder time to `17:00` in the app to receive it at 8:00 AM AKST.
- The GitHub Action runs hourly and sends emails only when there's a match and the user hasn't checked in yet — no duplicate emails.
- All user data is isolated by Supabase Row Level Security — users can only see their own check-ins and questions.

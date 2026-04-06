# Firebase Setup

Same pattern as your Upside-Maximizer-Dashboard.

## 1. Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `checkin-app` (or reuse your existing project)
3. Disable Google Analytics (optional) → **Create project**

## 2. Enable Authentication

1. Go to **Authentication → Get started**
2. Click **Email/Password** → Enable → Save

## 3. Create Firestore Database

1. Go to **Firestore Database → Create database**
2. Choose **Production mode** → select a region → Done
3. Go to **Rules** tab and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

4. Click **Publish**

## 4. Get Your Firebase Config

1. Go to **Project Settings** (gear icon) → **General**
2. Under "Your apps", click **Add app → Web (</>)**
3. Name it `checkin-app` → Register app
4. Copy the `firebaseConfig` object — it looks like:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

5. Paste these values into `src/firebase.js` replacing the `YOUR_*` placeholders

## 5. Service Account (for GitHub Actions email reminders)

1. Go to **Project Settings → Service accounts**
2. Click **Generate new private key** → Download the JSON file
3. In your GitHub repo → **Settings → Secrets → Actions**
4. Add secret `FIREBASE_SERVICE_ACCOUNT` → paste the entire JSON file contents

## 6. GitHub Secrets to Add

| Secret | Value |
|--------|-------|
| `FIREBASE_SERVICE_ACCOUNT` | Contents of downloaded service account JSON |
| `SENDGRID_API_KEY` | Your SendGrid API key (SG.xxx) |
| `ALERT_FROM_EMAIL` | Your verified SendGrid sender email |
| `APP_URL` | `https://gfrobinson.github.io/checkin-app` |

## 7. Deploy

```bash
npm install
npm run deploy
```

This builds the React app and pushes to the `gh-pages` branch automatically.
Enable GitHub Pages in repo Settings → Pages → Branch: `gh-pages`.

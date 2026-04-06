// src/firebase.js
// Replace with your Firebase project config values
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  Timestamp
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const signUp   = (email, pw) => createUserWithEmailAndPassword(auth, email, pw);
export const signIn   = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const logOut   = ()          => signOut(auth);
export const onAuth   = (cb)        => onAuthStateChanged(auth, cb);

// ── Questions ─────────────────────────────────────────────────────────────────
// Stored as a single document: users/{uid}/settings/questions
export async function getQuestions(uid) {
  const ref  = doc(db, 'users', uid, 'settings', 'questions');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().list || [] : [];
}

export async function saveQuestions(uid, list) {
  const ref = doc(db, 'users', uid, 'settings', 'questions');
  await setDoc(ref, { list });
}

// ── User settings (reminders) ─────────────────────────────────────────────────
export async function getSettings(uid) {
  const ref  = doc(db, 'users', uid, 'settings', 'reminders');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveSettings(uid, data) {
  const ref = doc(db, 'users', uid, 'settings', 'reminders');
  await setDoc(ref, data);
}

// ── Check-ins ─────────────────────────────────────────────────────────────────
export async function saveCheckin(uid, answers) {
  const col = collection(db, 'users', uid, 'checkins');
  await addDoc(col, {
    answers,
    completedAt: Timestamp.now()
  });
}

export async function getCheckins(uid, limitCount = 100) {
  const col  = collection(db, 'users', uid, 'checkins');
  const q    = query(col, orderBy('completedAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTodayCheckin(uid) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const col  = collection(db, 'users', uid, 'checkins');
  const q    = query(col, where('completedAt', '>=', Timestamp.fromDate(startOfDay)), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0];
}

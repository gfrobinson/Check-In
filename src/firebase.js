// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyChoGRORc-xAPgU8Yi2ahWHWHTog_MWi_U",
  authDomain:        "check-in-83cab.firebaseapp.com",
  projectId:         "check-in-83cab",
  storageBucket:     "check-in-83cab.firebasestorage.app",
  messagingSenderId: "426999582840",
  appId:             "1:426999582840:web:62eec7a477c9874748dd8d"
};

const app      = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

// Auth
export const signUp           = (email, pw) => createUserWithEmailAndPassword(auth, email, pw);
export const signIn           = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const signInWithGoogle = ()           => signInWithPopup(auth, googleProvider);
export const logOut           = ()           => signOut(auth);
export const onAuth           = (cb)         => onAuthStateChanged(auth, cb);

// Questions
export async function getQuestions(uid) {
  const ref = doc(db, 'users', uid, 'settings', 'questions');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().list || [] : [];
}
export async function saveQuestions(uid, list) {
  await setDoc(doc(db, 'users', uid, 'settings', 'questions'), { list });
}

// Settings
export async function getSettings(uid) {
  const snap = await getDoc(doc(db, 'users', uid, 'settings', 'reminders'));
  return snap.exists() ? snap.data() : null;
}
export async function saveSettings(uid, data) {
  await setDoc(doc(db, 'users', uid, 'settings', 'reminders'), data);
}

// Check-ins
export async function saveCheckin(uid, answers) {
  await addDoc(collection(db, 'users', uid, 'checkins'), { answers, completedAt: Timestamp.now() });
}
export async function getCheckins(uid, limitCount = 100) {
  const q = query(collection(db, 'users', uid, 'checkins'), orderBy('completedAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getTodayCheckin(uid) {
  const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
  const q = query(collection(db, 'users', uid, 'checkins'), where('completedAt', '>=', Timestamp.fromDate(startOfDay)), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0];
}

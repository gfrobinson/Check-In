// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, addDoc, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyChoGRORc-xAPgU8Yi2ahWHWHTog_MWi_U",
  authDomain:        "check-in-83cab.firebaseapp.com",
  projectId:         "check-in-83cab",
  storageBucket:     "check-in-83cab.firebasestorage.app",
  messagingSenderId: "426999582840",
  appId:             "1:426999582840:web:62eec7a477c9874748dd8d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

// ── Auth ──────────────────────────────────────────────────────────────────────
export const signUp           = (email, pw) => createUserWithEmailAndPassword(auth, email, pw);
export const signIn           = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const signInWithGoogle = ()           => signInWithPopup(auth, googleProvider);
export const logOut           = ()           => signOut(auth);
export const onAuth           = (cb)         => onAuthStateChanged(auth, cb);

// ── User profile ──────────────────────────────────────────────────────────────
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid, 'settings', 'profile'));
  return snap.exists() ? snap.data() : { timezone: 'America/Anchorage', reminderEmail: '' };
}
export async function saveUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid, 'settings', 'profile'), data);
}

// ── Question Sets ─────────────────────────────────────────────────────────────
export async function getQuestionSets(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'questionSets'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function saveQuestionSet(uid, set) {
  const { id, ...data } = set;
  if (id) {
    await setDoc(doc(db, 'users', uid, 'questionSets', id), data);
    return id;
  } else {
    const ref = await addDoc(collection(db, 'users', uid, 'questionSets'), data);
    return ref.id;
  }
}
export async function deleteQuestionSet(uid, setId) {
  await deleteDoc(doc(db, 'users', uid, 'questionSets', setId));
}

// ── Check-ins ─────────────────────────────────────────────────────────────────
export async function saveCheckin(uid, setId, answers) {
  await addDoc(collection(db, 'users', uid, 'checkins', setId, 'entries'), {
    answers,
    completedAt: Timestamp.now()
  });
}
export async function getCheckins(uid, setId, limitCount = 100) {
  const q = query(
    collection(db, 'users', uid, 'checkins', setId, 'entries'),
    orderBy('completedAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getTodayCheckin(uid, setId) {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const q = query(
    collection(db, 'users', uid, 'checkins', setId, 'entries'),
    where('completedAt', '>=', Timestamp.fromDate(startOfDay)),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0];
}

// ── Pending accountability emails ─────────────────────────────────────────────
// Written by the app after a check-in; read and cleared by GitHub Actions
export async function queueAccountabilityEmail(uid, { setId, setName, partnerEmail, mode, questions, answers }) {
  await addDoc(collection(db, 'pendingAccountabilityEmails'), {
    uid,
    setId,
    setName,
    partnerEmail,
    mode,       // 'summary' | 'all'
    questions,  // array — needed to render answers and labels
    answers,
    sent: false,
    createdAt: Timestamp.now()
  });
}

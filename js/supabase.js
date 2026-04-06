// ===== supabase.js =====
// Replace these with your actual Supabase project values
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== AUTH =====
async function signIn() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const note = document.getElementById('authNote');
  if (!email || !password) { note.textContent = 'Please enter email and password.'; return; }
  note.textContent = '';
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) { note.textContent = error.message; return; }
  closeAuth();
  location.reload();
}

async function signUp() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const note = document.getElementById('authNote');
  if (!email || !password) { note.textContent = 'Please enter email and password.'; return; }
  note.textContent = '';
  const { error } = await db.auth.signUp({ email, password });
  if (error) { note.textContent = error.message; return; }
  note.className = 'auth-note success';
  note.textContent = 'Account created! Check your email to confirm.';
}

async function signOut() {
  await db.auth.signOut();
  location.reload();
}

async function getUser() {
  const { data } = await db.auth.getUser();
  return data?.user || null;
}

// ===== MODAL =====
function showAuth() { document.getElementById('authModal').classList.add('open'); }
function closeAuth() { document.getElementById('authModal').classList.remove('open'); }

// ===== TOAST =====
function toast(msg, type = 'success') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = (type === 'success' ? '✓ ' : '✕ ') + msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ===== QUESTIONS CRUD =====
async function getQuestions(userId) {
  const { data, error } = await db.from('questions').select('*').eq('user_id', userId).order('sort_order');
  if (error) throw error;
  return data || [];
}

async function saveQuestions(userId, questions) {
  // Delete old, re-insert
  await db.from('questions').delete().eq('user_id', userId);
  if (!questions.length) return;
  const rows = questions.map((q, i) => ({ ...q, user_id: userId, sort_order: i }));
  const { error } = await db.from('questions').insert(rows);
  if (error) throw error;
}

// ===== SETTINGS CRUD =====
async function getSettings(userId) {
  const { data } = await db.from('user_settings').select('*').eq('user_id', userId).single();
  return data;
}

async function saveSettings(userId, settings) {
  const { error } = await db.from('user_settings').upsert({ user_id: userId, ...settings });
  if (error) throw error;
}

// ===== CHECK-INS CRUD =====
async function saveCheckin(userId, answers) {
  const { data, error } = await db.from('checkins').insert({
    user_id: userId,
    answers: answers,
    completed_at: new Date().toISOString()
  }).select().single();
  if (error) throw error;
  return data;
}

async function getCheckins(userId, limit = 50) {
  const { data, error } = await db.from('checkins')
    .select('*').eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function getTodayCheckin(userId) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await db.from('checkins')
    .select('id').eq('user_id', userId)
    .gte('completed_at', today + 'T00:00:00')
    .lte('completed_at', today + 'T23:59:59')
    .single();
  return data;
}

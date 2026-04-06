// src/App.js
import { useState, useEffect, useCallback } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, BarElement,
  Tooltip, Filler
} from 'chart.js';
import AuthModal from './AuthModal';
import {
  auth, onAuth, logOut,
  getQuestions, saveQuestions,
  getSettings, saveSettings,
  saveCheckin, getCheckins, getTodayCheckin
} from './firebase';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler);

// ── Shared style tokens ───────────────────────────────────────────────────────
const S = {
  surface:  { background: '#16181f', border: '1px solid #2a2d38', borderRadius: 12 },
  surface2: { background: '#1e2028', border: '1px solid #2a2d38', borderRadius: 8 },
  label:    { display:'block', fontSize:'0.78rem', fontWeight:600, color:'#8b8fa8', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5 },
  input:    { width:'100%', background:'#1e2028', border:'1px solid #2a2d38', borderRadius:8, color:'#e8e9f0', padding:'0.6rem 0.9rem', fontSize:'0.9rem', fontFamily:'inherit', outline:'none', boxSizing:'border-box' },
  btnPrimary: { background:'#7c6af7', color:'#fff', border:'none', borderRadius:10, padding:'0.6rem 1.3rem', fontWeight:600, fontSize:'0.88rem', cursor:'pointer' },
  btnGhost:   { background:'transparent', color:'#8b8fa8', border:'1px solid #2a2d38', borderRadius:10, padding:'0.55rem 1.1rem', fontSize:'0.88rem', cursor:'pointer' },
  btnDanger:  { background:'transparent', color:'#f87171', border:'1px solid #f87171', borderRadius:8, padding:'0.45rem 0.9rem', fontSize:'0.82rem', cursor:'pointer' },
};

const chartDefaults = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color:'#8b8fa8', maxTicksLimit:10 }, grid: { color:'#2a2d38' } },
    y: { min:0, max:10, ticks:{ color:'#8b8fa8' }, grid:{ color:'#2a2d38' } }
  }
};

function genId() { return 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2,5); }

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type='success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return { toasts, toast };
}

function ToastContainer({ toasts }) {
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:300, display:'flex', flexDirection:'column', gap:8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background:'#16181f', border:`1px solid ${t.type==='success'?'#34d399':'#f87171'}`,
          borderRadius:10, padding:'0.8rem 1.2rem', fontSize:'0.9rem',
          boxShadow:'0 4px 24px rgba(0,0,0,0.4)', animation:'slideIn 0.25s ease'
        }}>
          {t.type === 'success' ? '✓ ' : '✕ '}{t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar({ view, setView, user, showAuth }) {
  const links = ['Dashboard','Check In','History','Settings'];
  return (
    <nav style={{
      display:'flex', alignItems:'center', gap:'2rem',
      padding:'1rem 2rem', borderBottom:'1px solid #2a2d38',
      background:'#16181f', position:'sticky', top:0, zIndex:100
    }}>
      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.35rem', color:'#e8e9f0', marginRight:'auto' }}>
        CheckIn<span style={{ color:'#7c6af7' }}>.</span>
      </div>
      <div style={{ display:'flex', gap:'1.5rem' }}>
        {links.map(l => (
          <button key={l} onClick={() => setView(l)}
            style={{ background:'none', border:'none', cursor:'pointer',
              color: view===l ? '#e8e9f0' : '#8b8fa8',
              fontWeight: view===l ? 600 : 400, fontSize:'0.88rem', fontFamily:'inherit' }}>
            {l}
          </button>
        ))}
      </div>
      {user
        ? <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <span style={{ fontSize:'0.82rem', color:'#8b8fa8' }}>{user.email}</span>
            <button style={S.btnGhost} onClick={logOut}>Sign Out</button>
          </div>
        : <button style={S.btnGhost} onClick={showAuth}>Sign In</button>
      }
    </nav>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ user, setView, toast }) {
  const [checkins, setCheckins]   = useState([]);
  const [questions, setQuestions] = useState([]);
  const [settings, setSettings]   = useState(null);
  const [todayDone, setTodayDone] = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([getCheckins(user.uid, 50), getQuestions(user.uid), getSettings(user.uid), getTodayCheckin(user.uid)])
      .then(([ci, qs, st, td]) => {
        setCheckins(ci); setQuestions(qs); setSettings(st); setTodayDone(!!td);
      }).finally(() => setLoading(false));
  }, [user]);

  if (!user) return (
    <div style={{ textAlign:'center', padding:'6rem 1rem' }}>
      <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'2.8rem', lineHeight:1.2, marginBottom:'1rem' }}>
        Track how you're <em style={{ color:'#a78bfa' }}>really</em> doing.
      </h1>
      <p style={{ color:'#8b8fa8', marginBottom:'2rem', fontSize:'1rem' }}>
        Set up recurring check-in questions, get email reminders, and visualize your progress over time.
      </p>
    </div>
  );

  if (loading) return <div style={{ padding:'4rem', textAlign:'center', color:'#8b8fa8' }}>Loading…</div>;

  // Streak calc
  const dates = [...new Set(checkins.map(c => c.completedAt?.toDate().toISOString().split('T')[0]))].sort().reverse();
  let streak = 0;
  let check = new Date().toISOString().split('T')[0];
  for (const d of dates) {
    if (d === check) { streak++; const dt = new Date(check); dt.setDate(dt.getDate()-1); check = dt.toISOString().split('T')[0]; }
    else break;
  }

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
  const weekCount = checkins.filter(c => c.completedAt?.toDate() >= weekAgo).length;

  const avgScore = c => {
    const nums = Object.values(c.answers||{}).filter(a => typeof a === 'number');
    return nums.length ? (nums.reduce((s,n)=>s+n,0)/nums.length).toFixed(1) : '—';
  };

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem 1.5rem' }}>
      {/* Hero stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1.25rem', marginBottom:'2rem' }}>
        {/* Streak */}
        <div style={{ ...S.surface, padding:'1.75rem', display:'flex', flexDirection:'column' }}>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'3.5rem', color:'#a78bfa', lineHeight:1 }}>{streak}</div>
          <div style={{ fontSize:'0.82rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', color:'#8b8fa8', marginTop:4 }}>Day Streak 🔥</div>
          <div style={{ fontSize:'0.8rem', color:'#8b8fa8', marginTop:6 }}>
            {streak > 0 ? `${streak} day${streak>1?'s':''} in a row!` : 'Complete a check-in to start!'}
          </div>
        </div>
        {/* Next reminder */}
        <div style={{ ...S.surface, padding:'1.75rem', display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:'0.78rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', color:'#8b8fa8' }}>Next Reminder</div>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.8rem', margin:'0.4rem 0 auto' }}>
            {settings?.reminderTime || '—'}
          </div>
          <button
            style={{ ...S.btnPrimary, marginTop:'auto', opacity: todayDone ? 0.6 : 1,
              background: todayDone ? '#34d399' : '#7c6af7' }}
            onClick={() => setView('Check In')}
          >
            {todayDone ? '✓ Done Today' : 'Start Check-In →'}
          </button>
        </div>
        {/* Total */}
        <div style={{ ...S.surface, padding:'1.75rem', display:'flex', flexDirection:'column' }}>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'3.5rem', color:'#34d399', lineHeight:1 }}>{checkins.length}</div>
          <div style={{ fontSize:'0.82rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', color:'#8b8fa8', marginTop:4 }}>Total Check-Ins</div>
          <div style={{ background:'#1e2028', borderRadius:99, height:6, margin:'1rem 0 4px', overflow:'hidden' }}>
            <div style={{ background:'#34d399', height:'100%', borderRadius:99, width:`${Math.min(100,(weekCount/7)*100)}%`, transition:'width .6s' }} />
          </div>
          <div style={{ fontSize:'0.8rem', color:'#8b8fa8' }}>This week: {weekCount}</div>
        </div>
      </div>

      {/* Recent */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
        <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.3rem' }}>Recent Check-Ins</h2>
        <button style={S.btnGhost} onClick={() => setView('History')}>View All</button>
      </div>
      {checkins.length === 0
        ? <div style={{ ...S.surface, padding:'3rem', textAlign:'center', color:'#8b8fa8' }}>
            No check-ins yet. <button style={{ background:'none', border:'none', color:'#a78bfa', cursor:'pointer' }} onClick={() => setView('Settings')}>Set up your questions →</button>
          </div>
        : checkins.slice(0,5).map(c => {
            const date = c.completedAt?.toDate().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) || '';
            const preview = questions.slice(0,2).map(q => {
              const a = c.answers?.[q.id];
              return a !== undefined ? `${q.text.slice(0,22)}…: ${a}` : '';
            }).filter(Boolean).join(' · ');
            const score = avgScore(c);
            const sNum = parseFloat(score);
            const badgeColor = isNaN(sNum) ? '#8b8fa8' : sNum>=7 ? '#34d399' : sNum>=4 ? '#a78bfa' : '#f87171';
            return (
              <div key={c.id} style={{ ...S.surface, padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem', marginBottom:'0.75rem', cursor:'default' }}>
                <div style={{ fontSize:'0.8rem', color:'#8b8fa8', minWidth:100 }}>{date}</div>
                <div style={{ flex:1, fontSize:'0.88rem', color:'#8b8fa8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{preview || 'Check-in completed'}</div>
                <div style={{ background:'#1e2028', borderRadius:6, padding:'0.22rem 0.6rem', fontSize:'0.8rem', fontWeight:600, color:badgeColor }}>{score}/10</div>
              </div>
            );
          })
      }
    </div>
  );
}

// ── Check-In View ─────────────────────────────────────────────────────────────
function CheckInView({ user, toast }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers]     = useState({});
  const [todayDone, setTodayDone] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([getQuestions(user.uid), getTodayCheckin(user.uid)])
      .then(([qs, td]) => { setQuestions(qs); setTodayDone(!!td); })
      .finally(() => setLoading(false));
  }, [user]);

  function setAnswer(qid, val) { setAnswers(a => ({ ...a, [qid]: val })); }

  async function handleSubmit() {
    const unanswered = questions.filter(q => answers[q.id] === undefined);
    if (unanswered.length) { toast('Please answer all questions.', 'error'); return; }
    try {
      await saveCheckin(user.uid, answers);
      setSubmitted(true);
      toast('Check-in saved! Great job 🎉');
    } catch(e) { toast('Error: ' + e.message, 'error'); }
  }

  if (!user) return <div style={{ padding:'4rem', textAlign:'center', color:'#8b8fa8' }}>Please sign in to complete a check-in.</div>;
  if (loading) return <div style={{ padding:'4rem', textAlign:'center', color:'#8b8fa8' }}>Loading…</div>;

  if (submitted || todayDone) return (
    <div style={{ maxWidth:680, margin:'4rem auto', textAlign:'center', padding:'0 1.5rem' }}>
      <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>✅</div>
      <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.8rem', marginBottom:'0.75rem' }}>
        {submitted ? 'Check-in saved!' : 'Already done today!'}
      </h2>
      <p style={{ color:'#8b8fa8' }}>Come back tomorrow to keep your streak going.</p>
    </div>
  );

  if (questions.length === 0) return (
    <div style={{ maxWidth:680, margin:'4rem auto', textAlign:'center', padding:'0 1.5rem' }}>
      <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>📝</div>
      <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.8rem', marginBottom:'0.75rem' }}>No questions yet</h2>
      <p style={{ color:'#8b8fa8', marginBottom:'1.5rem' }}>Set up your check-in questions in Settings first.</p>
    </div>
  );

  return (
    <div style={{ maxWidth:680, margin:'0 auto', padding:'2rem 1.5rem' }}>
      <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'2rem', marginBottom:'0.35rem' }}>Today's Check-In</h1>
      <p style={{ color:'#8b8fa8', marginBottom:'2rem' }}>
        {new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
      </p>

      {questions.map((q, i) => (
        <div key={q.id} style={{ ...S.surface, padding:'1.75rem', marginBottom:'1.25rem' }}>
          <div style={{ fontSize:'0.78rem', fontWeight:600, color:'#8b8fa8', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 }}>
            Question {i+1}
          </div>
          <div style={{ fontSize:'1.05rem', fontWeight:500, marginBottom:'1.25rem' }}>{q.text}</div>

          {q.type === 'scale' && (
            <div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {Array.from({length:10},(_,k)=>k+1).map(n => (
                  <button key={n} onClick={() => setAnswer(q.id, n)} style={{
                    width:42, height:42, borderRadius:8, border:'1px solid',
                    borderColor: answers[q.id]===n ? '#7c6af7' : '#2a2d38',
                    background: answers[q.id]===n ? '#7c6af7' : '#1e2028',
                    color: answers[q.id]===n ? '#fff' : '#8b8fa8',
                    fontWeight:600, fontSize:'0.9rem', cursor:'pointer'
                  }}>{n}</button>
                ))}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:'0.75rem', color:'#8b8fa8' }}>
                <span>Low</span><span>High</span>
              </div>
            </div>
          )}

          {q.type === 'yesno' && (
            <div style={{ display:'flex', gap:'0.75rem' }}>
              {['Yes','No'].map(opt => (
                <button key={opt} onClick={() => setAnswer(q.id, opt)} style={{
                  flex:1, padding:'0.7rem', borderRadius:8, fontWeight:600, fontSize:'0.95rem', cursor:'pointer',
                  border:'1px solid',
                  borderColor: answers[q.id]===opt ? (opt==='Yes'?'#34d399':'#f87171') : '#2a2d38',
                  background: answers[q.id]===opt ? (opt==='Yes'?'#34d399':'#f87171') : '#1e2028',
                  color: answers[q.id]===opt ? (opt==='Yes'?'#0e0f14':'#fff') : '#8b8fa8'
                }}>{opt}</button>
              ))}
            </div>
          )}

          {q.type === 'multiple_choice' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {(q.options||[]).map(opt => (
                <button key={opt} onClick={() => setAnswer(q.id, opt)} style={{
                  padding:'0.7rem 1rem', borderRadius:8, textAlign:'left', fontSize:'0.9rem', cursor:'pointer',
                  border:'1px solid',
                  borderColor: answers[q.id]===opt ? '#7c6af7' : '#2a2d38',
                  background: answers[q.id]===opt ? '#7c6af7' : '#1e2028',
                  color: answers[q.id]===opt ? '#fff' : '#8b8fa8'
                }}>{opt}</button>
              ))}
            </div>
          )}

          {q.type === 'text' && (
            <textarea
              rows={3}
              placeholder="Your thoughts…"
              value={answers[q.id] || ''}
              onChange={e => setAnswer(q.id, e.target.value)}
              style={{ ...S.input, resize:'vertical', minHeight:80 }}
            />
          )}
        </div>
      ))}

      <div style={{ ...S.surface, padding:'1.25rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:'0.88rem', color:'#8b8fa8' }}>
          <span style={{ color:'#e8e9f0', fontWeight:600 }}>{Object.keys(answers).length}</span> of{' '}
          <span style={{ color:'#e8e9f0', fontWeight:600 }}>{questions.length}</span> answered
        </div>
        <button style={S.btnPrimary} onClick={handleSubmit}>Save Check-In ✓</button>
      </div>
    </div>
  );
}

// ── History View ──────────────────────────────────────────────────────────────
function HistoryView({ user }) {
  const [checkins, setCheckins]   = useState([]);
  const [questions, setQuestions] = useState([]);
  const [range, setRange]         = useState(30);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([getCheckins(user.uid, 500), getQuestions(user.uid)])
      .then(([ci, qs]) => { setCheckins(ci); setQuestions(qs); })
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return <div style={{ padding:'4rem', textAlign:'center', color:'#8b8fa8' }}>Please sign in to view history.</div>;
  if (loading) return <div style={{ padding:'4rem', textAlign:'center', color:'#8b8fa8' }}>Loading…</div>;

  const filtered = range === 0 ? checkins : checkins.filter(c => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-range);
    return c.completedAt?.toDate() >= cutoff;
  });

  const sorted = [...filtered].reverse();
  const labels = sorted.map(c => c.completedAt?.toDate().toLocaleDateString('en-US',{month:'short',day:'numeric'}) || '');
  const scores = sorted.map(c => {
    const nums = Object.values(c.answers||{}).filter(a => typeof a === 'number');
    return nums.length ? +(nums.reduce((s,n)=>s+n,0)/nums.length).toFixed(2) : null;
  });
  const scaleQs = questions.filter(q => q.type === 'scale');

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem 1.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem' }}>
        <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'2rem' }}>History</h1>
        <div style={{ display:'flex', gap:'0.5rem' }}>
          {[['30d',30],['90d',90],['1y',365],['All',0]].map(([label,val]) => (
            <button key={val} onClick={() => setRange(val)} style={{
              padding:'0.4rem 0.9rem', borderRadius:99, fontSize:'0.85rem', cursor:'pointer',
              border:'1px solid',
              borderColor: range===val ? '#7c6af7' : '#2a2d38',
              background: range===val ? '#1e2028' : 'transparent',
              color: range===val ? '#e8e9f0' : '#8b8fa8'
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Trend chart */}
      <div style={{ ...S.surface, padding:'1.5rem', marginBottom:'1.25rem' }}>
        <h3 style={{ fontFamily:"'DM Serif Display',serif", fontWeight:400, color:'#8b8fa8', marginBottom:'1rem' }}>Overall Score Trend</h3>
        <Line data={{
          labels,
          datasets: [{ label:'Avg Score', data:scores, borderColor:'#7c6af7', backgroundColor:'rgba(124,106,247,0.1)', fill:true, tension:0.35, pointRadius:4, pointBackgroundColor:'#7c6af7' }]
        }} options={chartDefaults} />
      </div>

      {/* Per-question bar charts */}
      {scaleQs.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:'1.25rem', marginBottom:'1.25rem' }}>
          {scaleQs.map(q => (
            <div key={q.id} style={{ ...S.surface, padding:'1.5rem' }}>
              <h3 style={{ fontFamily:"'DM Serif Display',serif", fontWeight:400, color:'#8b8fa8', marginBottom:'1rem', fontSize:'0.95rem' }}>{q.text}</h3>
              <Bar data={{
                labels,
                datasets: [{ data: sorted.map(c => c.answers?.[q.id] ?? null),
                  backgroundColor: sorted.map(c => {
                    const v = c.answers?.[q.id];
                    return v == null ? 'transparent' : v>=7 ? 'rgba(52,211,153,0.7)' : v>=4 ? 'rgba(124,106,247,0.7)' : 'rgba(248,113,113,0.7)';
                  }), borderRadius:4 }]
              }} options={{ ...chartDefaults, scales: { ...chartDefaults.scales, y:{ min:0, max:10, ticks:{color:'#8b8fa8'}, grid:{color:'#2a2d38'} } } }} />
            </div>
          ))}
        </div>
      )}

      {/* Entry list */}
      <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.2rem', marginBottom:'1rem' }}>All Entries</h2>
      {filtered.length === 0
        ? <div style={{ ...S.surface, padding:'3rem', textAlign:'center', color:'#8b8fa8' }}>No check-ins in this time range.</div>
        : filtered.map(c => {
            const date = c.completedAt?.toDate().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'}) || '';
            const preview = questions.slice(0,2).map(q => {
              const a = c.answers?.[q.id];
              return a !== undefined ? `${q.text.slice(0,20)}…: ${a}` : '';
            }).filter(Boolean).join(' · ');
            const nums = Object.values(c.answers||{}).filter(a=>typeof a==='number');
            const score = nums.length ? (nums.reduce((s,n)=>s+n,0)/nums.length).toFixed(1) : '—';
            const sNum = parseFloat(score);
            const col = isNaN(sNum)?'#8b8fa8':sNum>=7?'#34d399':sNum>=4?'#a78bfa':'#f87171';
            return (
              <div key={c.id} onClick={() => setSelected(selected?.id===c.id?null:c)}
                style={{ ...S.surface, padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem', marginBottom:'0.75rem', cursor:'pointer', borderColor: selected?.id===c.id?'#7c6af7':'#2a2d38' }}>
                <div style={{ fontSize:'0.8rem', color:'#8b8fa8', minWidth:100 }}>{date}</div>
                <div style={{ flex:1, fontSize:'0.88rem', color:'#8b8fa8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{preview || 'Tap to expand'}</div>
                <div style={{ background:'#1e2028', borderRadius:6, padding:'0.22rem 0.6rem', fontSize:'0.8rem', fontWeight:600, color:col }}>{score}/10</div>
              </div>
            );
          })
      }
      {/* Expanded detail */}
      {selected && (
        <div style={{ ...S.surface, padding:'1.5rem', marginTop:'1rem' }}>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.1rem', marginBottom:'1rem' }}>
            {selected.completedAt?.toDate().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            {questions.map(q => {
              const a = selected.answers?.[q.id];
              if (a === undefined) return null;
              return (
                <div key={q.id} style={{ ...S.surface2, padding:'1rem' }}>
                  <div style={{ fontSize:'0.78rem', color:'#8b8fa8', marginBottom:4 }}>{q.text}</div>
                  <div style={{ fontWeight:600 }}>{a}{q.type==='scale'?' / 10':''}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Settings View ─────────────────────────────────────────────────────────────
function SettingsView({ user, toast }) {
  const [questions, setLocalQuestions] = useState([]);
  const [settings, setLocalSettings]  = useState({ frequency:'daily', reminderTime:'08:00', reminderEmail:'', weekday:1, customDays:[1,2,3,4,5] });
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([getQuestions(user.uid), getSettings(user.uid)])
      .then(([qs, st]) => {
        setLocalQuestions(qs);
        if (st) setLocalSettings(s => ({ ...s, ...st }));
      }).finally(() => setLoading(false));
  }, [user]);

  function addQuestion(type) {
    setLocalQuestions(qs => [...qs, { id:genId(), type, text:'', options: type==='multiple_choice' ? ['Option A','Option B'] : [] }]);
  }
  function removeQuestion(id) { setLocalQuestions(qs => qs.filter(q => q.id !== id)); }
  function updateQuestion(id, field, val) { setLocalQuestions(qs => qs.map(q => q.id===id ? {...q,[field]:val} : q)); }
  function addOption(qid, opt) { setLocalQuestions(qs => qs.map(q => q.id===qid ? {...q, options:[...(q.options||[]),opt]} : q)); }
  function removeOption(qid, oi) { setLocalQuestions(qs => qs.map(q => q.id===qid ? {...q, options:q.options.filter((_,i)=>i!==oi)} : q)); }
  function toggleDay(d) { setLocalSettings(s => ({ ...s, customDays: s.customDays.includes(d) ? s.customDays.filter(x=>x!==d) : [...s.customDays,d] })); }

  async function handleSaveQuestions() {
    if (questions.some(q => !q.text.trim())) { toast('Please fill in all question texts.','error'); return; }
    try { await saveQuestions(user.uid, questions); toast('Questions saved! ✓'); } catch(e) { toast(e.message,'error'); }
  }
  async function handleSaveReminders() {
    try { await saveSettings(user.uid, settings); toast('Reminder settings saved! ✓'); } catch(e) { toast(e.message,'error'); }
  }

  if (!user) return <div style={{ padding:'4rem', textAlign:'center', color:'#8b8fa8' }}>Please sign in to manage settings.</div>;
  if (loading) return <div style={{ padding:'4rem', textAlign:'center', color:'#8b8fa8' }}>Loading…</div>;

  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem 1.5rem' }}>
      <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'2rem', marginBottom:'2rem' }}>Settings</h1>

      {/* Questions */}
      <div style={{ ...S.surface, padding:'1.75rem', marginBottom:'1.5rem' }}>
        <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.1rem', marginBottom:'0.5rem' }}>Check-In Questions</div>
        <p style={{ color:'#8b8fa8', fontSize:'0.88rem', marginBottom:'1.5rem' }}>These questions appear every time you do a check-in.</p>

        {questions.map((q, i) => (
          <div key={q.id} style={{ background:'#1e2028', border:'1px solid #2a2d38', borderRadius:10, padding:'1rem', marginBottom:'0.75rem' }}>
            <div style={{ display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                <input style={S.input} placeholder="Question text…" value={q.text} onChange={e => updateQuestion(q.id,'text',e.target.value)} />
                <select style={S.input} value={q.type} onChange={e => updateQuestion(q.id,'type',e.target.value)}>
                  <option value="scale">Scale 1–10</option>
                  <option value="yesno">Yes / No</option>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="text">Free Text</option>
                </select>
                {q.type === 'multiple_choice' && (
                  <div>
                    <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginBottom:'0.4rem' }}>
                      {(q.options||[]).map((opt,oi) => (
                        <span key={oi} style={{ display:'flex', alignItems:'center', gap:4, background:'#16181f', border:'1px solid #2a2d38', borderRadius:6, padding:'0.22rem 0.5rem', fontSize:'0.82rem' }}>
                          {opt}
                          <button onClick={() => removeOption(q.id,oi)} style={{ background:'none',border:'none',color:'#8b8fa8',cursor:'pointer',fontSize:'0.8rem' }}>×</button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display:'flex', gap:'0.5rem' }}>
                      <input style={{ ...S.input, flex:1 }} placeholder="New option…" id={`opt-${q.id}`}
                        onKeyDown={e => { if(e.key==='Enter'&&e.target.value.trim()){addOption(q.id,e.target.value.trim());e.target.value='';} }} />
                      <button style={S.btnGhost} onClick={() => {
                        const el = document.getElementById(`opt-${q.id}`);
                        if(el?.value.trim()){addOption(q.id,el.value.trim());el.value='';}
                      }}>Add</button>
                    </div>
                  </div>
                )}
              </div>
              <button style={S.btnDanger} onClick={() => removeQuestion(q.id)}>✕</button>
            </div>
          </div>
        ))}

        <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap', marginBottom:'1.25rem' }}>
          {[['Scale 1–10','scale'],['Yes / No','yesno'],['Multiple Choice','multiple_choice'],['Free Text','text']].map(([label,type]) => (
            <button key={type} style={S.btnGhost} onClick={() => addQuestion(type)}>+ {label}</button>
          ))}
        </div>
        <button style={S.btnPrimary} onClick={handleSaveQuestions}>Save Questions</button>
      </div>

      {/* Reminders */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
        <div style={{ ...S.surface, padding:'1.75rem' }}>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.1rem', marginBottom:'1.25rem' }}>Reminder Schedule</div>

          <div style={{ marginBottom:'1rem' }}>
            <label style={S.label}>Frequency</label>
            <select style={S.input} value={settings.frequency} onChange={e => setLocalSettings(s=>({...s,frequency:e.target.value}))}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="custom">Custom days</option>
            </select>
          </div>

          {settings.frequency === 'weekly' && (
            <div style={{ marginBottom:'1rem' }}>
              <label style={S.label}>Day of week</label>
              <select style={S.input} value={settings.weekday} onChange={e => setLocalSettings(s=>({...s,weekday:parseInt(e.target.value)}))}>
                {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d,i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}

          {settings.frequency === 'custom' && (
            <div style={{ marginBottom:'1rem' }}>
              <label style={S.label}>Days</label>
              <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
                {DAY_LABELS.map((d,i) => (
                  <button key={i} onClick={() => toggleDay(i)} style={{
                    padding:'0.4rem 0.65rem', borderRadius:8, fontSize:'0.82rem', cursor:'pointer',
                    border:'1px solid',
                    borderColor: settings.customDays.includes(i) ? '#7c6af7' : '#2a2d38',
                    background: settings.customDays.includes(i) ? '#1e2028' : 'transparent',
                    color: settings.customDays.includes(i) ? '#e8e9f0' : '#8b8fa8'
                  }}>{d}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom:'1rem' }}>
            <label style={S.label}>Reminder time (UTC)</label>
            <input style={S.input} type="time" value={settings.reminderTime} onChange={e => setLocalSettings(s=>({...s,reminderTime:e.target.value}))} />
            <p style={{ fontSize:'0.78rem', color:'#8b8fa8', marginTop:4 }}>Alaska (AKST) = UTC−9. For 8 AM reminder, enter 17:00.</p>
          </div>

          <div style={{ marginBottom:'1.25rem' }}>
            <label style={S.label}>Reminder email</label>
            <input style={S.input} type="email" placeholder="you@example.com" value={settings.reminderEmail} onChange={e => setLocalSettings(s=>({...s,reminderEmail:e.target.value}))} />
          </div>

          <button style={S.btnPrimary} onClick={handleSaveReminders}>Save Reminders</button>
        </div>

        {/* Account */}
        <div style={{ ...S.surface, padding:'1.75rem' }}>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.1rem', marginBottom:'1.25rem' }}>Account</div>
          <p style={{ color:'#8b8fa8', fontSize:'0.88rem', marginBottom:'1.5rem' }}>{user?.email}</p>
          <button style={{ ...S.btnDanger, width:'100%', padding:'0.65rem' }} onClick={logOut}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]       = useState(undefined); // undefined = loading
  const [view, setView]       = useState('Dashboard');
  const [showAuth, setShowAuth] = useState(false);
  const { toasts, toast }     = useToast();

  useEffect(() => { return onAuth(u => setUser(u)); }, []);

  if (user === undefined) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#8b8fa8' }}>
      Loading…
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        button:hover { opacity: 0.88; }
        select option { background: #1e2028; }
        @media (max-width:700px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .settings-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Navbar view={view} setView={setView} user={user} showAuth={() => setShowAuth(true)} />

      {view === 'Dashboard' && <Dashboard user={user} setView={setView} toast={toast} />}
      {view === 'Check In'  && <CheckInView user={user} toast={toast} />}
      {view === 'History'   && <HistoryView user={user} />}
      {view === 'Settings'  && <SettingsView user={user} toast={toast} />}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <ToastContainer toasts={toasts} />
    </>
  );
}

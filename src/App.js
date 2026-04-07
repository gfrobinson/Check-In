// src/App.js
import { useState, useEffect, useCallback } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler } from 'chart.js';
import AuthModal from './AuthModal';
import {
  auth, onAuth, logOut,
  getUserProfile, saveUserProfile,
  getQuestionSets, saveQuestionSet, deleteQuestionSet,
  saveCheckin, getCheckins, getTodayCheckin
} from './firebase';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler);

// ── Common timezones ──────────────────────────────────────────────────────────
const TIMEZONES = [
  'America/Anchorage','America/Los_Angeles','America/Denver',
  'America/Chicago','America/New_York','America/Halifax',
  'Pacific/Honolulu','Europe/London','Europe/Paris',
  'Asia/Tokyo','Asia/Shanghai','Australia/Sydney'
];

const TZ_LABELS = {
  'America/Anchorage':   'Alaska (AKST/AKDT)',
  'America/Los_Angeles': 'Pacific (PST/PDT)',
  'America/Denver':      'Mountain (MST/MDT)',
  'America/Chicago':     'Central (CST/CDT)',
  'America/New_York':    'Eastern (EST/EDT)',
  'America/Halifax':     'Atlantic (AST/ADT)',
  'Pacific/Honolulu':    'Hawaii (HST)',
  'Europe/London':       'London (GMT/BST)',
  'Europe/Paris':        'Central Europe (CET/CEST)',
  'Asia/Tokyo':          'Japan (JST)',
  'Asia/Shanghai':       'China (CST)',
  'Australia/Sydney':    'Sydney (AEST/AEDT)',
};

// ── Style tokens ──────────────────────────────────────────────────────────────
const S = {
  surface:    { background:'#16181f', border:'1px solid #2a2d38', borderRadius:12 },
  surface2:   { background:'#1e2028', border:'1px solid #2a2d38', borderRadius:8 },
  label:      { display:'block', fontSize:'0.78rem', fontWeight:600, color:'#8b8fa8', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:5 },
  input:      { width:'100%', background:'#1e2028', border:'1px solid #2a2d38', borderRadius:8, color:'#e8e9f0', padding:'0.6rem 0.9rem', fontSize:'0.9rem', fontFamily:'inherit', outline:'none', boxSizing:'border-box' },
  btnPrimary: { background:'#7c6af7', color:'#fff', border:'none', borderRadius:10, padding:'0.6rem 1.3rem', fontWeight:600, fontSize:'0.88rem', cursor:'pointer' },
  btnGhost:   { background:'transparent', color:'#8b8fa8', border:'1px solid #2a2d38', borderRadius:10, padding:'0.55rem 1.1rem', fontSize:'0.88rem', cursor:'pointer' },
  btnDanger:  { background:'transparent', color:'#f87171', border:'1px solid #f87171', borderRadius:8, padding:'0.45rem 0.9rem', fontSize:'0.82rem', cursor:'pointer' },
};

const chartDefaults = {
  responsive: true,
  plugins: { legend: { display:false } },
  scales: {
    x: { ticks:{ color:'#8b8fa8', maxTicksLimit:10 }, grid:{ color:'#2a2d38' } },
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
        <div key={t.id} style={{ background:'#16181f', border:`1px solid ${t.type==='success'?'#34d399':'#f87171'}`, borderRadius:10, padding:'0.8rem 1.2rem', fontSize:'0.9rem', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
          {t.type==='success'?'✓ ':'✕ '}{t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar({ view, setView, user, showAuth }) {
  return (
    <nav style={{ display:'flex', alignItems:'center', gap:'2rem', padding:'1rem 2rem', borderBottom:'1px solid #2a2d38', background:'#16181f', position:'sticky', top:0, zIndex:100 }}>
      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.35rem', color:'#e8e9f0', marginRight:'auto' }}>
        CheckIn<span style={{ color:'#7c6af7' }}>.</span>
      </div>
      <div style={{ display:'flex', gap:'1.5rem' }}>
        {['Dashboard','Check In','History','Settings'].map(l => (
          <button key={l} onClick={() => setView(l)} style={{ background:'none', border:'none', cursor:'pointer', color:view===l?'#e8e9f0':'#8b8fa8', fontWeight:view===l?600:400, fontSize:'0.88rem', fontFamily:'inherit' }}>
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

// ── Frequency helpers ─────────────────────────────────────────────────────────
function isDueToday(set) {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun
  if (set.frequency === 'daily') return true;
  if (set.frequency === 'weekly') return parseInt(set.weekday) === dow;
  if (set.frequency === 'monthly') return now.getDate() === parseInt(set.monthDay || 1);
  if (set.frequency === 'custom') return (set.customDays || []).includes(dow);
  return false;
}

function freqLabel(set) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  if (set.frequency === 'daily') return 'Daily';
  if (set.frequency === 'weekly') return `Weekly · ${days[set.weekday] || ''}`;
  if (set.frequency === 'monthly') return `Monthly · Day ${set.monthDay || 1}`;
  if (set.frequency === 'custom') return `Custom · ${(set.customDays||[]).map(d=>days[d]).join(', ')}`;
  return set.frequency;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ user, setView, setActiveSetId, toast }) {
  const [sets, setSets]       = useState([]);
  const [dueStatus, setDue]   = useState({}); // setId -> bool (done today)
  const [totalCounts, setTotals] = useState({}); // setId -> count
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getQuestionSets(user.uid).then(async qs => {
      setSets(qs);
      const status = {}, totals = {};
      await Promise.all(qs.map(async s => {
        const td = await getTodayCheckin(user.uid, s.id);
        status[s.id] = !!td;
        const all = await getCheckins(user.uid, s.id, 500);
        totals[s.id] = all.length;
      }));
      setDue(status);
      setTotals(totals);
    }).finally(() => setLoading(false));
  }, [user]);

  if (!user) return (
    <div style={{ textAlign:'center', padding:'6rem 1rem' }}>
      <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'2.8rem', lineHeight:1.2, marginBottom:'1rem' }}>
        Track how you're <em style={{ color:'#a78bfa' }}>really</em> doing.
      </h1>
      <p style={{ color:'#8b8fa8', marginBottom:'2rem' }}>Set up Question Sets with custom schedules, get reminders, and visualize your progress.</p>
    </div>
  );

  if (loading) return <div style={{ padding:'4rem', textAlign:'center', color:'#8b8fa8' }}>Loading…</div>;

  const dueSets  = sets.filter(s => isDueToday(s));
  const doneSets = dueSets.filter(s => dueStatus[s.id]);
  const todoSets = dueSets.filter(s => !dueStatus[s.id]);

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem 1.5rem' }}>

      {/* Due today */}
      <div style={{ marginBottom:'2rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
          <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.4rem' }}>Due Today</h2>
          <span style={{ fontSize:'0.85rem', color:'#8b8fa8' }}>{doneSets.length} / {dueSets.length} complete</span>
        </div>

        {dueSets.length === 0 && (
          <div style={{ ...S.surface, padding:'2rem', textAlign:'center', color:'#8b8fa8' }}>
            Nothing scheduled for today. <button style={{ background:'none', border:'none', color:'#a78bfa', cursor:'pointer' }} onClick={() => setView('Settings')}>Set up Question Sets →</button>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {todoSets.map(s => (
            <div key={s.id} style={{ ...S.surface, padding:'1.25rem 1.5rem', display:'flex', alignItems:'center', gap:'1rem' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, marginBottom:2 }}>{s.name}</div>
                <div style={{ fontSize:'0.82rem', color:'#8b8fa8' }}>{freqLabel(s)} · {s.questions?.length || 0} questions · {s.reminderTime}</div>
              </div>
              <button style={S.btnPrimary} onClick={() => { setActiveSetId(s.id); setView('Check In'); }}>
                Start →
              </button>
            </div>
          ))}
          {doneSets.map(s => (
            <div key={s.id} style={{ ...S.surface, padding:'1.25rem 1.5rem', display:'flex', alignItems:'center', gap:'1rem', opacity:0.6 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, marginBottom:2 }}>✓ {s.name}</div>
                <div style={{ fontSize:'0.82rem', color:'#8b8fa8' }}>{freqLabel(s)} · Completed today</div>
              </div>
              <button style={S.btnGhost} onClick={() => { setActiveSetId(s.id); setView('History'); }}>View History</button>
            </div>
          ))}
        </div>
      </div>

      {/* All Question Sets summary */}
      {sets.filter(s => !isDueToday(s)).length > 0 && (
        <div>
          <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.4rem', marginBottom:'1rem' }}>Other Question Sets</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1rem' }}>
            {sets.filter(s => !isDueToday(s)).map(s => (
              <div key={s.id} style={{ ...S.surface, padding:'1.25rem' }}>
                <div style={{ fontWeight:600, marginBottom:4 }}>{s.name}</div>
                <div style={{ fontSize:'0.82rem', color:'#8b8fa8', marginBottom:'1rem' }}>{freqLabel(s)} · {totalCounts[s.id] || 0} check-ins total</div>
                <button style={S.btnGhost} onClick={() => { setActiveSetId(s.id); setView('History'); }}>View History</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Check-In View ─────────────────────────────────────────────────────────────
function CheckInView({ user, activeSetId, setActiveSetId, toast }) {
  const [sets, setSets]         = useState([]);
  const [currentSet, setCurrent] = useState(null);
  const [answers, setAnswers]   = useState({});
  const [todayDone, setTodayDone] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getQuestionSets(user.uid).then(async qs => {
      const due = qs.filter(s => isDueToday(s));
      setSets(due);
      if (activeSetId) {
        const s = qs.find(x => x.id === activeSetId);
        if (s) {
          setCurrent(s);
          const td = await getTodayCheckin(user.uid, s.id);
          setTodayDone(!!td);
        }
      }
    }).finally(() => setLoading(false));
  }, [user, activeSetId]);

  function setAnswer(qid, val) { setAnswers(a => ({ ...a, [qid]: val })); }

  async function handleSubmit() {
    const unanswered = currentSet.questions.filter(q => answers[q.id] === undefined);
    if (unanswered.length) { toast('Please answer all questions.', 'error'); return; }
    try {
      await saveCheckin(user.uid, currentSet.id, answers);
      setSubmitted(true);
      toast(`${currentSet.name} saved! 🎉`);
    } catch(e) { toast('Error: ' + e.message, 'error'); }
  }

  if (!user) return <div style={{ padding:'4rem', textAlign:'center', color:'#8b8fa8' }}>Please sign in to complete a check-in.</div>;
  if (loading) return <div style={{ padding:'4rem', textAlign:'center', color:'#8b8fa8' }}>Loading…</div>;

  // No set selected — show list of due sets
  if (!currentSet) return (
    <div style={{ maxWidth:680, margin:'0 auto', padding:'2rem 1.5rem' }}>
      <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'2rem', marginBottom:'0.35rem' }}>Check In</h1>
      <p style={{ color:'#8b8fa8', marginBottom:'2rem' }}>
        {new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
      </p>
      {sets.length === 0
        ? <div style={{ ...S.surface, padding:'3rem', textAlign:'center', color:'#8b8fa8' }}>
            No Question Sets are due today.
          </div>
        : sets.map(s => (
            <div key={s.id} style={{ ...S.surface, padding:'1.25rem 1.5rem', display:'flex', alignItems:'center', gap:'1rem', marginBottom:'0.75rem' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600 }}>{s.name}</div>
                <div style={{ fontSize:'0.82rem', color:'#8b8fa8' }}>{s.questions?.length || 0} questions</div>
              </div>
              <button style={S.btnPrimary} onClick={() => { setActiveSetId(s.id); setCurrent(s); }}>Start →</button>
            </div>
          ))
      }
    </div>
  );

  if (submitted || todayDone) return (
    <div style={{ maxWidth:680, margin:'4rem auto', textAlign:'center', padding:'0 1.5rem' }}>
      <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>✅</div>
      <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.8rem', marginBottom:'0.75rem' }}>
        {submitted ? `${currentSet.name} saved!` : 'Already done today!'}
      </h2>
      <p style={{ color:'#8b8fa8', marginBottom:'1.5rem' }}>Come back tomorrow to keep your streak going.</p>
      <button style={S.btnGhost} onClick={() => { setCurrent(null); setActiveSetId(null); setSubmitted(false); }}>
        ← Back to Check-Ins
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth:680, margin:'0 auto', padding:'2rem 1.5rem' }}>
      <button style={{ ...S.btnGhost, marginBottom:'1.5rem', fontSize:'0.82rem' }} onClick={() => { setCurrent(null); setActiveSetId(null); }}>
        ← Back
      </button>
      <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'2rem', marginBottom:'0.25rem' }}>{currentSet.name}</h1>
      <p style={{ color:'#8b8fa8', marginBottom:'2rem' }}>
        {new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
      </p>

      {(currentSet.questions || []).map((q, i) => (
        <div key={q.id} style={{ ...S.surface, padding:'1.75rem', marginBottom:'1.25rem' }}>
          <div style={{ fontSize:'0.78rem', fontWeight:600, color:'#8b8fa8', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 }}>Question {i+1}</div>
          <div style={{ fontSize:'1.05rem', fontWeight:500, marginBottom:'1.25rem' }}>{q.text}</div>

          {q.type === 'scale' && (
            <div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {Array.from({length:10},(_,k)=>k+1).map(n => (
                  <button key={n} onClick={() => setAnswer(q.id, n)} style={{ width:42, height:42, borderRadius:8, border:'1px solid', borderColor:answers[q.id]===n?'#7c6af7':'#2a2d38', background:answers[q.id]===n?'#7c6af7':'#1e2028', color:answers[q.id]===n?'#fff':'#8b8fa8', fontWeight:600, fontSize:'0.9rem', cursor:'pointer' }}>{n}</button>
                ))}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:'0.75rem', color:'#8b8fa8' }}><span>Low</span><span>High</span></div>
            </div>
          )}

          {q.type === 'yesno' && (
            <div style={{ display:'flex', gap:'0.75rem' }}>
              {['Yes','No'].map(opt => (
                <button key={opt} onClick={() => setAnswer(q.id, opt)} style={{ flex:1, padding:'0.7rem', borderRadius:8, fontWeight:600, fontSize:'0.95rem', cursor:'pointer', border:'1px solid', borderColor:answers[q.id]===opt?(opt==='Yes'?'#34d399':'#f87171'):'#2a2d38', background:answers[q.id]===opt?(opt==='Yes'?'#34d399':'#f87171'):'#1e2028', color:answers[q.id]===opt?(opt==='Yes'?'#0e0f14':'#fff'):'#8b8fa8' }}>{opt}</button>
              ))}
            </div>
          )}

          {q.type === 'multiple_choice' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {(q.options||[]).map(opt => (
                <button key={opt} onClick={() => setAnswer(q.id, opt)} style={{ padding:'0.7rem 1rem', borderRadius:8, textAlign:'left', fontSize:'0.9rem', cursor:'pointer', border:'1px solid', borderColor:answers[q.id]===opt?'#7c6af7':'#2a2d38', background:answers[q.id]===opt?'#7c6af7':'#1e2028', color:answers[q.id]===opt?'#fff':'#8b8fa8' }}>{opt}</button>
              ))}
            </div>
          )}

          {q.type === 'text' && (
            <textarea rows={3} placeholder="Your thoughts…" value={answers[q.id]||''} onChange={e => setAnswer(q.id, e.target.value)} style={{ ...S.input, resize:'vertical', minHeight:80 }} />
          )}
        </div>
      ))}

      <div style={{ ...S.surface, padding:'1.25rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:'0.88rem', color:'#8b8fa8' }}>
          <span style={{ color:'#e8e9f0', fontWeight:600 }}>{Object.keys(answers).length}</span> of <span style={{ color:'#e8e9f0', fontWeight:600 }}>{currentSet.questions?.length || 0}</span> answered
        </div>
        <button style={S.btnPrimary} onClick={handleSubmit}>Save Check-In ✓</button>
      </div>
    </div>
  );
}

// ── History View ──────────────────────────────────────────────────────────────
function HistoryView({ user, activeSetId, setActiveSetId }) {
  const [sets, setSets]         = useState([]);
  const [currentSet, setCurrent] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [range, setRange]       = useState(30);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getQuestionSets(user.uid).then(async qs => {
      setSets(qs);
      const target = activeSetId ? qs.find(x => x.id === activeSetId) : null;
      if (target) { setCurrent(target); loadCheckins(target); }
      else setLoading(false);
    });
  }, [user, activeSetId]);

  async function loadCheckins(s) {
    setLoading(true);
    const ci = await getCheckins(user.uid, s.id, 500);
    setCheckins(ci);
    setLoading(false);
  }

  function selectSet(s) { setCurrent(s); setActiveSetId(s.id); loadCheckins(s); }

  if (!user) return <div style={{ padding:'4rem', textAlign:'center', color:'#8b8fa8' }}>Please sign in to view history.</div>;

  // Set picker
  if (!currentSet) return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem 1.5rem' }}>
      <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'2rem', marginBottom:'1.5rem' }}>History</h1>
      {loading
        ? <div style={{ color:'#8b8fa8' }}>Loading…</div>
        : sets.length === 0
          ? <div style={{ ...S.surface, padding:'3rem', textAlign:'center', color:'#8b8fa8' }}>No Question Sets yet.</div>
          : <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {sets.map(s => (
                <div key={s.id} style={{ ...S.surface, padding:'1.25rem 1.5rem', display:'flex', alignItems:'center', gap:'1rem', cursor:'pointer' }} onClick={() => selectSet(s)}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600 }}>{s.name}</div>
                    <div style={{ fontSize:'0.82rem', color:'#8b8fa8' }}>{freqLabel(s)}</div>
                  </div>
                  <span style={{ color:'#8b8fa8' }}>→</span>
                </div>
              ))}
            </div>
      }
    </div>
  );

  const filtered = range === 0 ? checkins : checkins.filter(c => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-range);
    return c.completedAt?.toDate() >= cutoff;
  });
  const sorted = [...filtered].reverse();
  const labels = sorted.map(c => c.completedAt?.toDate().toLocaleDateString('en-US',{month:'short',day:'numeric'})||'');
  const scores = sorted.map(c => {
    const nums = (currentSet.questions||[]).flatMap(q => {
      const a = c.answers?.[q.id];
      if (q.type === 'scale' && typeof a === 'number') return [a];
      if (q.type === 'yesno' && a !== undefined) return [a === (q.desiredAnswer||'Yes') ? 10 : 0];
      return [];
    });
    return nums.length ? +(nums.reduce((s,n)=>s+n,0)/nums.length).toFixed(2) : null;
  });
  const scaleQs = (currentSet.questions||[]).filter(q=>q.type==='scale');
  const ynQs = (currentSet.questions||[]).filter(q=>q.type==='yesno');
  const avgScore = c => {
    const nums = (currentSet.questions||[]).flatMap(q => {
      const a = c.answers?.[q.id];
      if (q.type === 'scale' && typeof a === 'number') return [a];
      if (q.type === 'yesno' && a !== undefined) return [a === (q.desiredAnswer||'Yes') ? 10 : 0];
      return [];
    });
    return nums.length ? (nums.reduce((s,n)=>s+n,0)/nums.length).toFixed(1) : '—';
  };

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem 1.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
        <button style={S.btnGhost} onClick={() => { setCurrent(null); setActiveSetId(null); }}>← All Sets</button>
        <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'2rem', flex:1 }}>{currentSet.name}</h1>
        <div style={{ display:'flex', gap:'0.5rem' }}>
          {[['30d',30],['90d',90],['1y',365],['All',0]].map(([label,val]) => (
            <button key={val} onClick={() => setRange(val)} style={{ padding:'0.4rem 0.9rem', borderRadius:99, fontSize:'0.85rem', cursor:'pointer', border:'1px solid', borderColor:range===val?'#7c6af7':'#2a2d38', background:range===val?'#1e2028':'transparent', color:range===val?'#e8e9f0':'#8b8fa8' }}>{label}</button>
          ))}
        </div>
      </div>

      {loading ? <div style={{ color:'#8b8fa8' }}>Loading…</div> : <>
        <div style={{ ...S.surface, padding:'1.5rem', marginBottom:'1.25rem' }}>
          <h3 style={{ fontFamily:"'DM Serif Display',serif", fontWeight:400, color:'#8b8fa8', marginBottom:'1rem' }}>Overall Score Trend</h3>
          <Line data={{ labels, datasets:[{ label:'Avg Score', data:scores, borderColor:'#7c6af7', backgroundColor:'rgba(124,106,247,0.1)', fill:true, tension:0.35, pointRadius:4, pointBackgroundColor:'#7c6af7' }] }} options={chartDefaults} />
        </div>

        {scaleQs.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:'1.25rem', marginBottom:'1.25rem' }}>
            {scaleQs.map(q => (
              <div key={q.id} style={{ ...S.surface, padding:'1.5rem' }}>
                <h3 style={{ fontFamily:"'DM Serif Display',serif", fontWeight:400, color:'#8b8fa8', marginBottom:'1rem', fontSize:'0.95rem' }}>{q.text}</h3>
                <Bar data={{ labels, datasets:[{ data:sorted.map(c=>c.answers?.[q.id]??null), backgroundColor:sorted.map(c=>{ const v=c.answers?.[q.id]; return v==null?'transparent':v>=7?'rgba(52,211,153,0.7)':v>=4?'rgba(124,106,247,0.7)':'rgba(248,113,113,0.7)'; }), borderRadius:4 }] }} options={chartDefaults} />
              </div>
            ))}
          </div>
        )}

        <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.2rem', marginBottom:'1rem' }}>All Entries ({filtered.length})</h2>
        {filtered.length === 0
          ? <div style={{ ...S.surface, padding:'2rem', textAlign:'center', color:'#8b8fa8' }}>No entries in this time range.</div>
          : filtered.map(c => {
              const date = c.completedAt?.toDate().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})||'';
              const score = avgScore(c);
              const sNum = parseFloat(score);
              const col = isNaN(sNum)?'#8b8fa8':sNum>=7?'#34d399':sNum>=4?'#a78bfa':'#f87171';
              return (
                <div key={c.id} onClick={() => setSelected(selected?.id===c.id?null:c)}
                  style={{ ...S.surface, padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem', marginBottom:'0.75rem', cursor:'pointer', borderColor:selected?.id===c.id?'#7c6af7':'#2a2d38' }}>
                  <div style={{ fontSize:'0.8rem', color:'#8b8fa8', minWidth:120 }}>{date}</div>
                  <div style={{ flex:1, fontSize:'0.88rem', color:'#8b8fa8' }}>{Object.keys(c.answers||{}).length} answers</div>
                  <div style={{ background:'#1e2028', borderRadius:6, padding:'0.22rem 0.6rem', fontSize:'0.8rem', fontWeight:600, color:col }}>{score}/10</div>
                </div>
              );
            })
        }
        {selected && (
          <div style={{ ...S.surface, padding:'1.5rem', marginTop:'1rem' }}>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.1rem', marginBottom:'1rem' }}>
              {selected.completedAt?.toDate().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
              {(currentSet.questions||[]).map(q => {
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
      </>}
    </div>
  );
}

// ── Settings View ─────────────────────────────────────────────────────────────
function SettingsView({ user, toast }) {
  const [sets, setSets]         = useState([]);
  const [editing, setEditing]   = useState(null); // null | 'new' | set object
  const [profile, setProfile]   = useState({ timezone:'America/Anchorage', reminderEmail:'' });
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([getQuestionSets(user.uid), getUserProfile(user.uid)])
      .then(([qs, prof]) => { setSets(qs); if (prof) setProfile(p => ({...p,...prof})); })
      .finally(() => setLoading(false));
  }, [user]);

  async function handleSaveProfile() {
    try { await saveUserProfile(user.uid, profile); toast('Profile saved! ✓'); } catch(e) { toast(e.message,'error'); }
  }

  async function handleSaveSet(set) {
    try {
      const id = await saveQuestionSet(user.uid, set);
      const updated = await getQuestionSets(user.uid);
      setSets(updated);
      setEditing(null);
      toast(`"${set.name}" saved! ✓`);
    } catch(e) { toast(e.message,'error'); }
  }

  async function handleDeleteSet(setId, name) {
    if (!window.confirm(`Delete "${name}"? This will not delete existing check-in history.`)) return;
    try {
      await deleteQuestionSet(user.uid, setId);
      setSets(s => s.filter(x => x.id !== setId));
      toast('Question Set deleted.');
    } catch(e) { toast(e.message,'error'); }
  }

  if (!user) return <div style={{ padding:'4rem', textAlign:'center', color:'#8b8fa8' }}>Please sign in to manage settings.</div>;
  if (loading) return <div style={{ padding:'4rem', textAlign:'center', color:'#8b8fa8' }}>Loading…</div>;

  if (editing) return (
    <SetEditor
      set={editing === 'new' ? null : editing}
      onSave={handleSaveSet}
      onCancel={() => setEditing(null)}
      toast={toast}
    />
  );

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem 1.5rem' }}>
      <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'2rem', marginBottom:'2rem' }}>Settings</h1>

      {/* Question Sets */}
      <div style={{ ...S.surface, padding:'1.75rem', marginBottom:'1.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.1rem' }}>Question Sets</div>
          <button style={S.btnPrimary} onClick={() => setEditing('new')}>+ New Set</button>
        </div>
        {sets.length === 0
          ? <p style={{ color:'#8b8fa8', fontSize:'0.9rem' }}>No Question Sets yet. Create one to get started.</p>
          : sets.map(s => (
              <div key={s.id} style={{ ...S.surface2, padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem', marginBottom:'0.75rem' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, marginBottom:2 }}>{s.name}</div>
                  <div style={{ fontSize:'0.82rem', color:'#8b8fa8' }}>{freqLabel(s)} · {s.questions?.length||0} questions · {s.reminderTime}</div>
                </div>
                <button style={S.btnGhost} onClick={() => setEditing(s)}>Edit</button>
                <button style={S.btnDanger} onClick={() => handleDeleteSet(s.id, s.name)}>Delete</button>
              </div>
            ))
        }
      </div>

      {/* Profile */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
        <div style={{ ...S.surface, padding:'1.75rem' }}>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.1rem', marginBottom:'1.25rem' }}>Profile & Reminders</div>
          <div style={{ marginBottom:'1rem' }}>
            <label style={S.label}>Your timezone</label>
            <select style={S.input} value={profile.timezone} onChange={e => setProfile(p=>({...p,timezone:e.target.value}))}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{TZ_LABELS[tz] || tz}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:'1.25rem' }}>
            <label style={S.label}>Reminder email</label>
            <input style={S.input} type="email" placeholder="you@example.com" value={profile.reminderEmail} onChange={e => setProfile(p=>({...p,reminderEmail:e.target.value}))} />
          </div>
          <button style={S.btnPrimary} onClick={handleSaveProfile}>Save Profile</button>
        </div>
        <div style={{ ...S.surface, padding:'1.75rem' }}>
          <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.1rem', marginBottom:'1.25rem' }}>Account</div>
          <p style={{ color:'#8b8fa8', fontSize:'0.88rem', marginBottom:'1.5rem' }}>{user?.email}</p>
          <button style={{ ...S.btnDanger, width:'100%', padding:'0.65rem' }} onClick={logOut}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}

// ── Set Editor ────────────────────────────────────────────────────────────────
function SetEditor({ set, onSave, onCancel, toast }) {
  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const [name, setName]           = useState(set?.name || '');
  const [frequency, setFrequency] = useState(set?.frequency || 'daily');
  const [weekday, setWeekday]     = useState(set?.weekday ?? 1);
  const [monthDay, setMonthDay]   = useState(set?.monthDay ?? 1);
  const [customDays, setCustomDays] = useState(set?.customDays || [1,2,3,4,5]);
  const [reminderTime, setReminderTime] = useState(set?.reminderTime || '08:00');
  const [questions, setQuestions] = useState(set?.questions || []);

  function addQuestion(type) { setQuestions(qs => [...qs, { id:genId(), type, text:'', options:type==='multiple_choice'?['Option A','Option B']:[] }]); }
  function removeQuestion(id) { setQuestions(qs => qs.filter(q=>q.id!==id)); }
  function updateQuestion(id, field, val) { setQuestions(qs => qs.map(q=>q.id===id?{...q,[field]:val}:q)); }
  function addOption(qid, opt) { setQuestions(qs => qs.map(q=>q.id===qid?{...q,options:[...(q.options||[]),opt]}:q)); }
  function removeOption(qid, oi) { setQuestions(qs => qs.map(q=>q.id===qid?{...q,options:q.options.filter((_,i)=>i!==oi)}:q)); }
  function toggleDay(d) { setCustomDays(ds => ds.includes(d)?ds.filter(x=>x!==d):[...ds,d]); }

  function handleSave() {
    if (!name.trim()) { toast('Please enter a name.','error'); return; }
    if (questions.some(q=>!q.text.trim())) { toast('Please fill in all question texts.','error'); return; }
    onSave({ id:set?.id, name, frequency, weekday, monthDay, customDays, reminderTime, questions });
  }

  return (
    <div style={{ maxWidth:760, margin:'0 auto', padding:'2rem 1.5rem' }}>
      <button style={{ ...S.btnGhost, marginBottom:'1.5rem', fontSize:'0.82rem' }} onClick={onCancel}>← Back</button>
      <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:'2rem', marginBottom:'2rem' }}>
        {set ? `Edit: ${set.name}` : 'New Question Set'}
      </h1>

      {/* Name & Schedule */}
      <div style={{ ...S.surface, padding:'1.75rem', marginBottom:'1.25rem' }}>
        <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.1rem', marginBottom:'1.25rem' }}>Details</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
          <div>
            <label style={S.label}>Name</label>
            <input style={S.input} placeholder="e.g. Daily Check-In" value={name} onChange={e=>setName(e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Reminder time (your local time)</label>
            <input style={S.input} type="time" value={reminderTime} onChange={e=>setReminderTime(e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Frequency</label>
            <select style={S.input} value={frequency} onChange={e=>setFrequency(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom days</option>
            </select>
          </div>
          {frequency === 'weekly' && (
            <div>
              <label style={S.label}>Day of week</label>
              <select style={S.input} value={weekday} onChange={e=>setWeekday(parseInt(e.target.value))}>
                {DAY_LABELS.map((d,i)=><option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}
          {frequency === 'monthly' && (
            <div>
              <label style={S.label}>Day of month</label>
              <select style={S.input} value={monthDay} onChange={e=>setMonthDay(parseInt(e.target.value))}>
                {Array.from({length:28},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          {frequency === 'custom' && (
            <div>
              <label style={S.label}>Days</label>
              <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginTop:4 }}>
                {DAY_LABELS.map((d,i)=>(
                  <button key={i} onClick={()=>toggleDay(i)} style={{ padding:'0.4rem 0.65rem', borderRadius:8, fontSize:'0.82rem', cursor:'pointer', border:'1px solid', borderColor:customDays.includes(i)?'#7c6af7':'#2a2d38', background:customDays.includes(i)?'#1e2028':'transparent', color:customDays.includes(i)?'#e8e9f0':'#8b8fa8' }}>{d}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Questions */}
      <div style={{ ...S.surface, padding:'1.75rem', marginBottom:'1.25rem' }}>
        <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:'1.1rem', marginBottom:'1rem' }}>Questions</div>
        {questions.map((q,i) => (
          <div key={q.id} style={{ background:'#1e2028', border:'1px solid #2a2d38', borderRadius:10, padding:'1rem', marginBottom:'0.75rem' }}>
            <div style={{ display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                <input style={S.input} placeholder="Question text…" value={q.text} onChange={e=>updateQuestion(q.id,'text',e.target.value)} />
                <select style={S.input} value={q.type} onChange={e=>updateQuestion(q.id,'type',e.target.value)}>
                  <option value="scale">Scale 1–10</option>
                  <option value="yesno">Yes / No</option>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="text">Free Text</option>
                </select>
                {q.type === 'yesno' && (
                  <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                    <label style={{ ...S.label, margin:0, whiteSpace:'nowrap' }}>Desired answer:</label>
                    <div style={{ display:'flex', gap:'0.5rem' }}>
                      {['Yes','No'].map(opt => (
                        <button key={opt} onClick={()=>updateQuestion(q.id,'desiredAnswer',opt)} style={{ padding:'0.35rem 0.9rem', borderRadius:8, fontSize:'0.85rem', cursor:'pointer', border:'1px solid', borderColor:(q.desiredAnswer||'Yes')===opt?'#34d399':'#2a2d38', background:(q.desiredAnswer||'Yes')===opt?'rgba(52,211,153,0.15)':'transparent', color:(q.desiredAnswer||'Yes')===opt?'#34d399':'#8b8fa8', fontWeight:600 }}>{opt}</button>
                      ))}
                    </div>
                  </div>
                )}
                {q.type === 'multiple_choice' && (
                  <div>
                    <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginBottom:'0.4rem' }}>
                      {(q.options||[]).map((opt,oi)=>(
                        <span key={oi} style={{ display:'flex', alignItems:'center', gap:4, background:'#16181f', border:'1px solid #2a2d38', borderRadius:6, padding:'0.22rem 0.5rem', fontSize:'0.82rem' }}>
                          {opt} <button onClick={()=>removeOption(q.id,oi)} style={{ background:'none',border:'none',color:'#8b8fa8',cursor:'pointer' }}>×</button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display:'flex', gap:'0.5rem' }}>
                      <input style={{ ...S.input, flex:1 }} placeholder="New option…" id={`opt-${q.id}`}
                        onKeyDown={e=>{if(e.key==='Enter'&&e.target.value.trim()){addOption(q.id,e.target.value.trim());e.target.value='';}}} />
                      <button style={S.btnGhost} onClick={()=>{const el=document.getElementById(`opt-${q.id}`);if(el?.value.trim()){addOption(q.id,el.value.trim());el.value='';}}}>Add</button>
                    </div>
                  </div>
                )}
              </div>
              <button style={S.btnDanger} onClick={()=>removeQuestion(q.id)}>✕</button>
            </div>
          </div>
        ))}
        <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap', marginBottom:'1.25rem' }}>
          {[['Scale 1–10','scale'],['Yes / No','yesno'],['Multiple Choice','multiple_choice'],['Free Text','text']].map(([label,type])=>(
            <button key={type} style={S.btnGhost} onClick={()=>addQuestion(type)}>+ {label}</button>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', gap:'0.75rem' }}>
        <button style={S.btnPrimary} onClick={handleSave}>Save Question Set</button>
        <button style={S.btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]         = useState(undefined);
  const [view, setView]         = useState('Dashboard');
  const [showAuth, setShowAuth] = useState(false);
  const [activeSetId, setActiveSetId] = useState(null);
  const { toasts, toast }       = useToast();

  useEffect(() => { return onAuth(u => setUser(u)); }, []);

  if (user === undefined) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#8b8fa8' }}>Loading…</div>
  );

  return (
    <>
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);} }
        button:hover{opacity:0.88;}
        select option{background:#1e2028;}
      `}</style>
      <Navbar view={view} setView={v=>{setView(v);}} user={user} showAuth={()=>setShowAuth(true)} />
      {view==='Dashboard' && <Dashboard user={user} setView={setView} setActiveSetId={setActiveSetId} toast={toast} />}
      {view==='Check In'  && <CheckInView user={user} activeSetId={activeSetId} setActiveSetId={setActiveSetId} toast={toast} />}
      {view==='History'   && <HistoryView user={user} activeSetId={activeSetId} setActiveSetId={setActiveSetId} />}
      {view==='Settings'  && <SettingsView user={user} toast={toast} />}
      {showAuth && <AuthModal onClose={()=>setShowAuth(false)} />}
      <ToastContainer toasts={toasts} />
    </>
  );
}

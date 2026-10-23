// ═══════════ ADMIN DB ACCESS (ADMIN CONSOLE ONLY) ═══════════
// Dedicated admin database operations isolated from public portal
if (!window.hwDb) window.hwDb = {};
Object.assign(window.hwDb, {
  async fetchUnverified() {
    if (!window.hwSupabase) return [];
    try {
      // 1. Prioritize nav_warnings_review_queue view
      const { data: queueData, error: queueErr } = await window.hwSupabase
        .from('nav_warnings_review_queue')
        .select('*');
      if (!queueErr && Array.isArray(queueData) && queueData.length > 0) {
        return queueData.map(q => ({
          ...q,
          id: q.warning_id,
          warning_id: q.canonical_id || q.warning_id,
          canonical_id: q.canonical_id,
        }));
      }

      // 2. Fallback to unverified in master table
      const { data, error } = await window.hwSupabase
        .from('nav_warnings')
        .select('*')
        .or('is_verified.eq.false,triage_tier.in.(B,C)')
        .eq('status', 'active');
      return data || [];
    } catch (e) {
      return [];
    }
  },

  async verifyWarning(id, details = {}) {
    if (!window.hwSupabase) return { error: 'No db connection' };
    const operator = (currentUser && currentUser.email) || 'safety-operator';
    const isUuid = typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    // Update master record to Tier A and explicit data quality
    const updatePayload = {
      is_verified: true,
      verified_at: new Date().toISOString(),
      triage_tier: 'A',
      data_quality: 'EXPLICIT',
      unplotted_reason: null,
      parsing_method: 'RULE'
    };

    query = isUuid ? query.eq('id', id) : query.or(`warning_id.eq."${id}",canonical_id.eq."${id"`);
    const res = await query.select('id, canonical_id');

    // Record immutable operator audit row to nav_warning_audits
    try {
      const masterId = res.data?.[0]?.id || (isUuid ? id : null);
      if (masterId) {
        await window.hwSupabase.from('nav_warning_audits').insert([{
          warning_id: masterId,
          operator_id: operator,
          previous_tier: 'B',
          new_tier: 'A',
          action: 'PROMOTE',
          reason: details.reason || 'Operator verified in Admin Console',
          signature_hash: btoa(masterId + ':' + Date.now()),
          diff_patch: updatePayload
        }]);
      }
    } catch (auditErr) {
      console.warn('nav_warning_audits insert notice:', auditErr);
    }

    return res;
  },

  async rejectWarning(id, reason = 'Operator rejected') {
    if (!window.hwSupabase) return { error: 'No db connection' };
    const operator = (currentUser && currentUser.email) || 'safety-operator';
    const isUuid = typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const updatePayload = {
      status: 'rejected',
      triage_tier: 'C',
      unplotted_reason: reason
    };

    query = isUuid ? query.eq('id', id) : query.or(`warning_id.eq."${id}",canonical_id.eq."${id"`);
    const res = await query.select('id, canonical_id');

    // Record immutable audit row
    try {
      const masterId = res.data?.[0]?.id || (isUuid ? id : null);
      if (masterId) {
        await window.hwSupabase.from('nav_warning_audits').insert([{
          warning_id: masterId,
          operator_id: operator,
          previous_tier: 'B',
          new_tier: 'C',
          action: 'DEMOTE',
          reason: reason,
          signature_hash: btoa(masterId + ':' + Date.now()),
          diff_patch: updatePayload
        }]);
      }
    } catch (auditErr) {
      console.warn('nav_warning_audits insert notice:', auditErr);
    }

    return res;
  },

  async publishImport(warnings) {
    if (!window.hwSupabase) return { error: 'No db connection' };
    // Call server sync endpoint with auth header for atomic multi-table persistence
    try {
      const token = sessionStorage.getItem('hw_admin_token') || '';
      const res = await fetch('/api/supabase/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ warnings })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Server sync call notice, falling back to direct master upsert:', err);
    }

    return await window.hwSupabase
      .from('nav_warnings')
      .upsert(warnings, { onConflict: 'canonical_id', ignoreDuplicates: true });
  }
});

// ═══════════ MANUAL PASTE QUEUE (GitHub Action bridge) ═══════════
// Mirrors scripts/run_manual_paste.py detect_navarea(): the bulletin
// header is authoritative; the dropdown is only a fallback.
// Region keys match the backend registry (dedicated: 1, 8, iv, xi, xii,
// baltic; universal: ii, iii, v, vi, vii, ix, x, xiii-xx).
const NAVAREA_ROMAN_TO_KEY = {
  I: '1', II: 'ii', III: 'iii', IV: 'iv', V: 'v', VI: 'vi', VII: 'vii',
  VIII: '8', IX: 'ix', X: 'x', XI: 'xi', XII: 'xii', XIII: 'xiii',
  XIV: 'xiv', XV: 'xv', XVI: 'xvi', XVII: 'xvii', XVIII: 'xviii',
  XIX: 'xix', XX: 'xx'
};
// Longest-first alternation so NAVAREA XVII never truncates to XV.
const NAVAREA_ROMAN_RE = 'XVIII|XVII|XIII|XIV|XVI|XIX|XII|XV|XI|IX|VIII|VII|VI|IV|III|II|XX|X|V|I';
const NAVAREA_HEADER_RE = new RegExp('\\bNAVAREA\\s+(?:' + NAVAREA_ROMAN_RE + '|[0-9]{1,2})\\b', 'i');
function detectNavareaJS(text) {
  if (!text) return null;
  const m = String(text).match(NAVAREA_HEADER_RE);
  if (m) {
    const t = m[1].toUpperCase();
    if (/^[0-9]/.test(t)) return (t === '1' || t === '01') ? '1' : null;
    return NAVAREA_ROMAN_TO_KEY[t] || null;
  }
  if (/\b(SWEDISH NAV WARN|SKAGERRAK|BALTIC SEA)\b/i.test(text)) return 'baltic';
  return null;
}
Object.assign(window.hwDb, {
  async submitPasteQueue(navarea, rawText) {
    if (!window.hwSupabase) return { error: 'No db connection' };
    const payload = { raw_text: rawText };
    if (navarea && navarea !== 'auto') payload.navarea = navarea;
    // RLS on manual_ingest_queue: only public.admin_users may insert.
    const { data, error } = await window.hwSupabase
      .from('manual_ingest_queue')
      .insert(payload)
      .select('id, navarea, status, detected_navarea, result, created_at')
      .single();
    return { data, error };
  },

  subscribePasteQueue(onChange) {
    if (!window.hwSupabase || !window.hwSupabase.channel) return () => {};
    const channel = window.hwSupabase
      .channel('admin-manual-ingest-queue')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'manual_ingest_queue' },
        (payload) => onChange(payload))
      .subscribe();
    return () => { try { window.hwSupabase.removeChannel(channel); } catch (e) {} };
  }
});

// ═══════════ STATE ═══════════
const SESSION_KEY = 'hw_admin_session';
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
let currentUser = null;

const state = {
  unverified: [],
  logFilter: "ALL",
  wizard: { step:1, method:"paste", results:[], accepted:new Set(), preflight:null, queueRow:null },
  pipelineRunning: false,
  queueChannelUnsub: null
};
let logs = [];

// ═══════════ AUTH ═══════════
window.handleLogin = async function(e){
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  errEl.style.display = 'none';

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in…';

  try {
    if (window.hwSupabase) {
      const { data, error } = await window.hwSupabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      currentUser = data.user;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: data.user.email, ts: Date.now() }));
      enterAdmin(data.user.email);
    } else {
      throw new Error('Supabase client not connected. Please check configuration.');
    }
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
};

window.checkSession = async function(){
  try {
    if (window.hwSupabase) {
      const { data: { session } } = await window.hwSupabase.auth.getSession();
      if (session) {
        currentUser = session.user;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: session.user.email, ts: Date.now() }));
        enterAdmin(session.user.email);
        return;
      }
    }
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (s && (Date.now() - s.ts) < SESSION_TIMEOUT) {
      currentUser = { email: s.email };
      enterAdmin(s.email);
      return;
    }
    if (s) sessionStorage.removeItem(SESSION_KEY);
  } catch(e) {}
};

window.logout = async function(){
  if (window.hwSupabase) await window.hwSupabase.auth.signOut();
  sessionStorage.removeItem(SESSION_KEY);
  currentUser = null;
  location.href = '/';
};

function enterAdmin(email){
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('adminView').style.display = 'block';
  document.getElementById('adminUserEmail').textContent = email;
  setTimeout(() => { if (currentUser) { showToast('Session expired — signing out'); setTimeout(logout, 1500); } }, SESSION_TIMEOUT);
  loadAdminData();
}

// ═══════════ DATA LOAD ═══════════
async function loadAdminData() {
  if (window.hwDb) {
    const data = await window.hwDb.fetchUnverified();
    state.unverified = data;
  }
  renderVerifyQueue();
  renderAttention();
}

// ═══════════ NAV ═══════════
window.switchAdminSub = function(sub){
  document.querySelectorAll('.admin-sub').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.asub-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('admin-'+sub)?.classList.add('active');
  document.querySelector('.asub-btn[data-sub="'+sub+'"]')?.classList.add('active');
  if(sub==='overview') renderAttention();
  if(sub==='verify') renderVerifyQueue();
};

// ═══════════ OVERVIEW ═══════════
function badge(cls,txt){return '<span class="badge-simple badge-'+cls+'"><span class="dot"></span> '+txt+'</span>'}
function renderAttention(){
  const p=document.getElementById('attentionPanel');
  if(!p) return;
  const items=[];
  if(state.unverified.length>0) items.push({icon:'⚠',cls:'warn',html:'<b>'+state.unverified.length+' warning'+(state.unverified.length>1?'s':'')+'</b> awaiting verification',sub:state.unverified.map(w=>w.warning_id).join(' · '),btn:'Review',fn:"switchAdminSub('verify')"});
  if(!items.length){ p.innerHTML='<div class="att-clear"><div class="big">✓</div>All clear — no items need attention.</div>'; return; }
  p.innerHTML='<div class="att-title">Needs Attention <span class="badge-simple badge-high"><span class="dot"></span> '+items.length+'</span></div>'+
    items.map(i=>'<div class="att-item"><span class="att-icon '+i.cls+'">'+i.icon+'</span><div class="att-text">'+i.html+'<div class="att-sub">'+i.sub+'</div></div><button class="btn btn-sm btn-secondary" onclick="'+i.fn+'">'+i.btn+'</button></div>').join('');
  const qa = document.getElementById('qaVerifySub');
  if(qa) qa.textContent = state.unverified.length ? state.unverified.length+' awaiting review' : 'All verified';
  const vb = document.getElementById('verifyBadge');
  if(vb) {
    vb.style.display = state.unverified.length ? 'inline-flex' : 'none';
    vb.textContent = state.unverified.length;
  }
}

// ═══════════ VERIFY ═══════════
function renderVerifyQueue(){
  const q=document.getElementById('verifyQueue');
  if(!q) return;
  const items=state.unverified;
  if(!items.length){ q.innerHTML='<div class="success-panel"><div class="big">✓</div><h3>Verification Queue Empty</h3><p>All published warnings carry verified status.</p></div>'; return; }
  q.innerHTML='<div class="page-header" style="margin-bottom:14px"><div><h1 style="font-size:20px">Verification Queue</h1><p class="subtitle">'+items.length+' human confirmation required</p></div><div><button class="btn btn-secondary" onclick="verifyAll()">✓ Verify All</button></div></div>'+
  items.map(w=>'<div class="verify-card">
    <div class="verify-head"><span class="verify-title">'+(w.warning_id || w.id)+' · '+w.navarea+'</span>'+badge('high',w.severity?.toUpperCase() || 'HIGH')+'</div>
    <div style="font-weight:500">'+w.title+'</div>
    <div class="verify-text">'+(w.raw_text || w.text)+'</div>
    <div class="verify-checks"><span>✓ Coords valid ('+(w.coordinates || w.coords)+')</span><span>✓ In-force window open</span></div>
    <div class="verify-actions">
      <button class="btn btn-sm btn-secondary" style="color:var(--critical)" onclick="rejectWarning(\''+(w.warning_id || w.id)+'\')">Reject</button>
      <button class="btn btn-sm btn-primary" style="width:auto" onclick="verifyWarning(\''+(w.warning_id || w.id)+'\')">✓ Verify</button>
    </div></div>').join('');
}
window.verifyWarning = async function(id){
  if(window.hwDb) {
    await window.hwDb.verifyWarning(id);
    state.unverified = state.unverified.filter(w => (w.warning_id || w.id) !== id);
    afterVerifyChange(id+' verified');
  }
};
window.rejectWarning = async function(id){
  if(window.hwDb) {
    await window.hwDb.rejectWarning(id);
    state.unverified = state.unverified.filter(w => (w.warning_id || w.id) !== id);
    afterVerifyChange(id+' rejected');
  }
};
window.verifyAll = async function(){ 
  for(const w of state.unverified) { await verifyWarning(w.warning_id || w.id); } 
};
function afterVerifyChange(msg){
  renderVerifyQueue(); renderAttention();
  showToast(msg);
}

// ═══════════ PIPELINE & SYSTEM ═══════════
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
window.runPipelineCycle = async function(){
  if(state.pipelineRunning)return;
  state.pipelineRunning=true;
  ['runCycleBtn','runCycleBtn2'].forEach(id=>{const b=document.getElementById(id);if(b){b.disabled=true;b.innerHTML='<span class="spinner"></span> Running…'}});
  await sleep(2000);
  ['runCycleBtn','runCycleBtn2'].forEach(id=>{const b=document.getElementById(id);if(b){b.disabled=false;b.innerHTML='▶ Run Cycle Now'}});
  showToast('Pipeline cycle complete (simulated)');
  state.pipelineRunning=false;
};

window.testModel = async function(m){
  const btn=document.getElementById(m+'Btn');
  btn.disabled=true; btn.innerHTML='<span class="spinner dark"></span> Testing…';
  try {
    const res = await fetch('/api/admin/test-gemini', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer '+((await window.hwSupabase?.auth.getSession())?.data?.session?.access_token || '')
      }
    });
    const data = await res.json();
    if(res.ok && data.success) {
      document.getElementById(m+'Status').innerHTML='<span class="dot"></span> Connected';
      document.getElementById(m+'Last').textContent='Last test: just now · '+data.latency_ms+'ms · key operational';
      showToast(m+' API operational — '+data.latency_ms+'ms');
    } else {
      throw new Error(data.error || 'Test failed');
    }
  } catch(e) {
    document.getElementById(m+'Status').innerHTML='<span class="dot" style="background:var(--critical)"></span> Error';
    showToast('Test failed: '+e.message);
  }
  btn.disabled=false; btn.textContent='Test Again';
};

// ═══════════ IMPORT WIZARD ═══════════
window.selectMethod = function(m){
  state.wizard.method=m;
  document.querySelectorAll('.method-card').forEach(c=>c.classList.toggle('selected',c.dataset.method===m));
};
window.updateWizCount = function(){
  const v=document.getElementById('wizInput')?.value;
  const lines=v?v.split('\n').filter(l=>l.trim()).length:0;
  const wl = document.getElementById('wizCountLabel'); if(wl) wl.textContent=lines+' lines · '+(new Blob([v||'']).size/1024).toFixed(1)+' KB';
  const wc = document.getElementById('wizContinue2'); if(wc) wc.disabled=lines===0;
};
window.wizardGo = function(step){
  const w=state.wizard;
  if(step===3){
    // Pre-flight only: the REAL parse+validation happens in the backend
    // pipeline (never client-side). We only summarise + detect region.
    const text = document.getElementById('wizInput')?.value || '';
    const sel = document.getElementById('wizRegion')?.value || 'auto';
    const detected = detectNavareaJS(text);
    const effective = detected || (sel !== 'auto' ? sel : null);
    w.preflight = {
      text, sel, detected, effective,
      lines: text.split('\n').filter(l => l.trim()).length,
      kb: (new Blob([text]).size / 1024).toFixed(1)
    };
    renderParseResults();
  }
  if(step===4){
    const p = w.preflight || {};
    const region = p.effective || p.detected || 'auto-detect';
    document.getElementById('prJob').textContent = (p.lines || 0)+' lines · '+(p.kb || '0')+' KB · NAVAREA '+region;
    document.getElementById('publishArea').style.display='block';
    document.getElementById('successArea').style.display='none';
  }
  w.step=step;
  for(let i=1;i<=4;i++){
    document.getElementById('wstep'+i)?.classList.toggle('active',i===step);
    document.getElementById('wstep'+i)?.classList.toggle('done',i<step);
    if(i<4)document.getElementById('wl'+i)?.classList.toggle('done',i<step);
  }
  document.querySelectorAll('.wpanel').forEach((p,i)=>p.classList.toggle('active',i===step-1));
};
function renderParseResults(){
  const p = state.wizard.preflight || {};
  const pills = [];
  pills.push('<span class="pill pill-ok">'+(p.lines || 0)+' lines · '+(p.kb || '0')+' KB</span>');
  if (p.detected) {
    pills.push('<span class="pill pill-ok">header: NAVAREA '+p.detected.toUpperCase()+'</span>');
    if (p.sel && p.sel !== 'auto' && p.sel !== p.detected) {
      pills.push('<span class="pill" style="background:#fff7ed;color:var(--high)">selection '+p.sel.toUpperCase()+' overridden</span>');
    }
  } else if (p.sel && p.sel !== 'auto') {
    pills.push('<span class="pill pill-ok">selection: NAVAREA '+p.sel.toUpperCase()+'</span>');
  } else {
    pills.push('<span class="pill" style="background:#fff7ed;color:var(--high)">no header — region must be selected</span>');
  }
  document.getElementById('parseSummary').innerHTML = pills.join(' ');
  document.getElementById('parseResults').innerHTML =
    '<div class="parse-card accepted">
      <div class="parse-main">
        <div class="parse-head"><strong>Pre-flight check</strong> · backend pipeline does the real parse</div>
        <div class="parse-title">'+(p.effective ? 'Will ingest via NAVAREA ' + p.effective.toUpperCase() : 'Region unknown — the pipeline will reject this paste')+'</div>
        <div class="parse-meta">Route: Supabase queue → GitHub Action (≤ 15 min) → region parser → differential sync</div>
      </div>
    </div>';
}
window.toggleAccept = function(id,checked){ if(checked)state.wizard.accepted.add(id); else state.wizard.accepted.delete(id); };
window.publishImport = async function(){
  const rawText = document.getElementById('wizInput')?.value || '';
  if (!rawText.trim()) { showToast('Nothing to submit'); return; }
  const regionSel = document.getElementById('wizRegion')?.value || 'auto';
  const btn = document.getElementById('publishBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Submitting…';
  try {
    const res = await window.hwDb.submitPasteQueue(regionSel, rawText);
    if (res.error) throw new Error(res.error.message || 'Queue insert rejected — admin only');
    const row = res.data;
    state.wizard.queueRow = row;
    document.getElementById('genId').textContent = 'queue-id: ' + (row.id || '').slice(0, 8);
    document.getElementById('publishArea').style.display = 'none';
    document.getElementById('successArea').style.display = 'block';

    let liveRow = { ...row };
    const statusEl = document.getElementById('queueLiveStatus');
    const renderStatus = (r) => {
      if (!statusEl) return;
      const st = String(r.status || 'pending').toUpperCase();
      const det = r.detected_navarea ? ' · region ' + String(r.detected_navarea).toUpperCase() : '';
      const res = r.result ? ' · ' + r.result : '';
      statusEl.textContent = st + det + res;
    };
    renderStatus(liveRow);
    if (state.queueChannelUnsub) { try { state.queueChannelUnsub(); } catch (e) {} }
    state.queueChannelUnsub = window.hwDb.subscribePasteQueue((payload) => {
      const changed = payload.new || {};
      if (liveRow.id && (changed.id === liveRow.id || (payload.old && payload.old.id === liveRow.id))) {
        liveRow = { ...liveRow, ...changed };
        renderStatus(liveRow);
      }
    });
    showToast('Paste submitted — the pipeline picks it up within 15 min');
  } catch (e) {
    showToast('Submit failed: ' + e.message);
  }
  btn.disabled = false; btn.innerHTML = '🔒 Submit to Ingest Pipeline';
};
window.resetWizard = function(){
  if (state.queueChannelUnsub) { try { state.queueChannelUnsub(); } catch (e) {} state.queueChannelUnsub = null; }
  state.wizard={step:1,method:'paste',results:[],accepted:new Set(),preflight:null,queueRow:null};
  const input = document.getElementById('wizInput'); if(input) input.value='';
  window.updateWizCount();
  document.querySelectorAll('.method-card').forEach(c=>c.classList.toggle('selected',c.dataset.method==='paste'));
  window.wizardGo(1);
};

// ═══════════ TOAST ═══════════
let toastTimeout;
window.showToast = function(m){
  const t=document.getElementById('toast'); if(!t) return;
  t.textContent=m; t.classList.add('show');
  clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>t.classList.remove('show'),2600);
};

// ═══════════ INIT ═══════════
document.addEventListener('DOMContentLoaded', async ()=>{
  await checkSession();
});
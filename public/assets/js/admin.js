// ═══════════ ADMIN DB ACCESS (ADMIN CONSOLE ONLY) ═══════════
// Dedicated admin database operations isolated from public portal
if (!window.hwDb) window.hwDb = {};
Object.assign(window.hwDb, {
  async fetchUnverified() {
    if (!window.hwSupabase) return { items: [], error: 'No db connection' };
    try {
      // 1. Prioritize nav_warnings_review_queue view
      const { data: queueData, error: queueErr } = await window.hwSupabase
        .from('nav_warnings_review_queue')
        .select('*');
      if (!queueErr && Array.isArray(queueData) && queueData.length > 0) {
        return {
          items: queueData.map(q => ({
            ...q,
            id: q.warning_id,
            warning_id: q.canonical_id || q.warning_id,
            canonical_id: q.canonical_id
          })),
          error: null
        };
      }

      // 2. Fallback to review-needed rows in the master table.
      //    20261019/20 schema: is_verified/verified_at/warning_id columns no
      //    longer exist. Review queue = active warnings in Tier B or C.
      const { data, error } = await window.hwSupabase
        .from('nav_warnings')
        .select('id, canonical_id, navarea, title, raw_text, area_text, categories,'
          + ' triage_tier, data_quality, qa_flags, status, valid_from, valid_to, updated_at')
        .in('triage_tier', ['B', 'C'])
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) return { items: [], error: error.message };
      return { items: data || [], error: null };
    } catch (e) {
      return { items: [], error: (e && e.message) || String(e) };
    }
  },

  async verifyWarning(id, details = {}) {
    if (!window.hwSupabase) return { error: 'No db connection' };
    // Hard-fail: an audit row without a real operator attribution is a lie.
    if (!currentUser || !currentUser.email) {
      return { error: 'Not signed in — audit attribution unavailable. Sign in again.' };
    }
    const operator = currentUser.email;
    const isUuid = typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // 20261019/20 schema: is_verified / verified_at do not exist.
    // Verification = promote to Tier A with explicit data quality.
    const updatePayload = {
      triage_tier: 'A',
      data_quality: 'EXPLICIT',
      unplotted_reason: null,
      parsing_method: 'RULE'
    };

    let query = window.hwSupabase.from('nav_warnings').update(updatePayload);
    query = isUuid ? query.eq('id', id) : query.eq('canonical_id', id);
    const res = await query.select('id, canonical_id');
    if (res.error) return res;

    // Record immutable operator audit row to nav_warning_audits
    // (soft-optional: the table is owned by the backend repo; report status)
    res.audit = 'skipped';
    const masterId = res.data && res.data[0] && res.data[0].id;
    if (masterId || isUuid) {
      try {
        const a = await window.hwSupabase.from('nav_warning_audits').insert([{
          warning_id: masterId || id,
          operator_id: operator,
          previous_tier: 'B',
          new_tier: 'A',
          action: 'PROMOTE',
          reason: details.reason || 'Operator verified in Admin Console',
          signature_hash: btoa((masterId || id) + ':' + Date.now()),
          diff_patch: updatePayload
        }]);
        res.audit = a.error ? 'failed' : 'written';
        if (a.error) console.warn('nav_warning_audits insert failed:', a.error.message);
      } catch (auditErr) {
        res.audit = 'failed';
        console.warn('nav_warning_audits insert notice:', auditErr);
      }
    }
    return res;
  },

  async rejectWarning(id, reason = 'Operator rejected') {
    if (!window.hwSupabase) return { error: 'No db connection' };
    if (!currentUser || !currentUser.email) {
      return { error: 'Not signed in — audit attribution unavailable. Sign in again.' };
    }
    const operator = currentUser.email;
    const isUuid = typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // 20261019/20 schema: status CHECK whitelist is
    // active|cancelled|expired|superseded|unverified — 'rejected' is not a
    // status. Rejection = demote to Tier C (excluded from all public reads);
    // the free-text reason lives on the audit row, not on the row itself.
    const updatePayload = {
      triage_tier: 'C',
      unplotted_reason: null
    };

    let query = window.hwSupabase.from('nav_warnings').update(updatePayload);
    query = isUuid ? query.eq('id', id) : query.eq('canonical_id', id);
    const res = await query.select('id, canonical_id');
    if (res.error) return res;

    res.audit = 'skipped';
    const masterId = res.data && res.data[0] && res.data[0].id;
    if (masterId || isUuid) {
      try {
        const a = await window.hwSupabase.from('nav_warning_audits').insert([{
          warning_id: masterId || id,
          operator_id: operator,
          previous_tier: 'B',
          new_tier: 'C',
          action: 'DEMOTE',
          reason: reason,
          signature_hash: btoa((masterId || id) + ':' + Date.now()),
          diff_patch: updatePayload
        }]);
        res.audit = a.error ? 'failed' : 'written';
        if (a.error) console.warn('nav_warning_audits insert failed:', a.error.message);
      } catch (auditErr) {
        res.audit = 'failed';
        console.warn('nav_warning_audits insert notice:', auditErr);
      }
    }
    return res;
  },

  async publishImport(warnings) {
    if (!window.hwSupabase) return { error: 'No db connection' };
    // Call server sync endpoint with the operator's real JWT for atomic
    // multi-table persistence (hw_admin_token is written at login/checkSession)
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
function detectNavareaJS(text) {
  if (!text) return null;
  const m = (text || '').match(/\bNAVAREA\s+((?:VIII|XII|XI|IV|I)\b|[0-9]{1,2}\b)/i);
  if (m) {
    const t = m[1].toUpperCase();
    if (/^[0-9]/.test(t)) return (t === '1' || t === '01') ? '1' : null;
    return ({ I: '1', IV: 'iv', VIII: '8', XI: 'xi', XII: 'xii' })[t] || null;
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

// ═══════════ SECURITY HELPERS (E0) ═══════════
// HTML-escape every user-controlled value before innerHTML interpolation.
// Bulletin raw_text/title/navarea are attacker-controllable via the paste
// queue — an unescaped interpolation is a stored XSS on every operator.
function _esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}

// Admin authorization. Preferred: set app_metadata.role = 'admin' on the
// user in the Supabase dashboard (Auth → Users → app_metadata).
// Fallback: add operator emails to ADMIN_EMAILS (lowercase).
const ADMIN_EMAILS = [
  // 'operator@example.com'
];
function isAdminUser(user) {
  if (!user || !user.email) return false;
  const meta = user.app_metadata || {};
  if (meta.role === 'admin') return true;
  if (Array.isArray(meta.roles) && meta.roles.indexOf('admin') !== -1) return true;
  const email = String(user.email).trim().toLowerCase();
  return ADMIN_EMAILS.indexOf(email) !== -1;
}

// ═══════════ STATE ═══════════
const SESSION_KEY = 'hw_admin_session';
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
let currentUser = null;

const state = {
  unverified: [],
  loadError: null,
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
      // Authorization: only admins may enter the console (E0 fix BUG-V4).
      if (!isAdminUser(data.user)) {
        await window.hwSupabase.auth.signOut();
        throw new Error('This account is not authorized for the admin console.');
      }
      currentUser = data.user;
      const s = await window.hwSupabase.auth.getSession();
      if (s && s.data && s.data.session) {
        sessionStorage.setItem('hw_admin_token', s.data.session.access_token);
      }
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
    if (!window.hwSupabase) return;
    // E0 fix BUG-V5: a live JWT is REQUIRED to enter. A stale sessionStorage
    // entry is only ever a remembered-email hint — never an auth grant.
    const { data: { session } } = await window.hwSupabase.auth.getSession();
    if (session && session.user) {
      if (!isAdminUser(session.user)) {
        await window.hwSupabase.auth.signOut();
        return;
      }
      currentUser = session.user;
      sessionStorage.setItem('hw_admin_token', session.access_token);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: session.user.email, ts: Date.now() }));
      enterAdmin(session.user.email);
      return;
    }
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const emailEl = document.getElementById('loginEmail');
        if (parsed && parsed.email && emailEl && !emailEl.value) emailEl.value = parsed.email;
      } catch (e) {}
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem('hw_admin_token');
    }
  } catch(e) {
    console.warn('checkSession:', e);
  }
};

window.logout = async function(){
  if (window.hwSupabase) await window.hwSupabase.auth.signOut();
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('hw_admin_token');
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
    const res = await window.hwDb.fetchUnverified();
    state.unverified = (res.items || []).map(w => ({
      ...w,
      warning_id: w.warning_id || w.canonical_id || w.id
    }));
    state.loadError = res.error || null;
    if (state.loadError) showToast('Verify queue load failed: ' + state.loadError);
  }
  renderVerifyQueue();
  renderAttention();
}

// ═══════════ NAV ═══════════
window.switchAdminSub = function(sub){
  document.querySelectorAll('.admin-sub').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.asub-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('admin-'+sub)?.classList.add('active');
  document.querySelector(`.asub-btn[data-sub="${sub}"]`)?.classList.add('active');
  if(sub==='overview') renderAttention();
  if(sub==='verify') renderVerifyQueue();
};

// ═══════════ OVERVIEW ═══════════
function badge(cls,txt){return `<span class="badge-simple badge-${cls}"><span class="dot"></span> ${txt}</span>`}
function renderAttention(){
  const p=document.getElementById('attentionPanel');
  if(!p) return;
  const items=[];
  if(state.unverified.length>0) items.push({icon:'⚠',cls:'warn',html:`<b>${state.unverified.length} warning${state.unverified.length>1?'s':''}</b> awaiting verification`,sub:state.unverified.map(w=>_esc(w.warning_id)).join(' · '),btn:'Review',fn:"switchAdminSub('verify')"});
  if(!items.length){ p.innerHTML=`<div class="att-clear"><div class="big">✓</div>All clear — no items need attention.</div>`; return; }
  p.innerHTML=`<div class="att-title">Needs Attention <span class="badge-simple badge-high"><span class="dot"></span> ${items.length}</span></div>`+
    items.map(i=>`<div class="att-item"><span class="att-icon ${i.cls}">${i.icon}</span><div class="att-text">${i.html}<div class="att-sub">${i.sub}</div></div><button class="btn btn-sm btn-secondary" onclick="${i.fn}">${i.btn}</button></div>`).join('');
  const qa = document.getElementById('qaVerifySub');
  if(qa) qa.textContent = state.unverified.length ? `${state.unverified.length} awaiting review` : 'All verified';
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
  if(!items.length){
    // E0 fix BUG-V1: an empty queue because the query FAILED must never look
    // like "all verified".
    if (state.loadError) {
      q.innerHTML=`<div class="success-panel"><div class="big">⚠</div><h3>Verification Queue Unavailable</h3><p>${_esc(state.loadError)}</p></div>`;
    } else {
      q.innerHTML=`<div class="success-panel"><div class="big">✓</div><h3>Verification Queue Empty</h3><p>All published warnings carry verified status.</p></div>`;
    }
    return;
  }
  q.innerHTML=`<div class="page-header" style="margin-bottom:14px"><div><h1 style="font-size:20px">Verification Queue</h1><p class="subtitle">${items.length} human confirmation required</p></div><div><button class="btn btn-secondary" onclick="verifyAll()">✓ Verify All</button></div></div>`+
  items.map(w=>`<div class="verify-card">
    <div class="verify-head"><span class="verify-title">${_esc(w.warning_id || w.id)} · ${_esc(w.navarea)}</span>${badge('high','TIER ' + _esc(String(w.triage_tier || 'B')) + ' · REVIEW')}</div>
    <div style="font-weight:500">${_esc(w.title)}</div>
    <div class="verify-text">${_esc(w.raw_text || w.text || '')}</div>
    <div class="verify-checks"><span>${_esc((Array.isArray(w.categories) ? w.categories : []).join(', ') || 'general')}</span><span>✓ In-force window open</span></div>
    <div class="verify-actions">
      <button class="btn btn-sm btn-secondary" style="color:var(--critical)" onclick="rejectWarning('${_esc(w.warning_id || w.id)}')">Reject</button>
      <button class="btn btn-sm btn-primary" style="width:auto" onclick="verifyWarning('${_esc(w.warning_id || w.id)}')">✓ Verify</button>
    </div></div>`).join('');
}
// E0 fix BUG-V7/V8: never fake success. Branch on the real DB result and
// keep the item in the queue on failure.
window.verifyWarning = async function(id){
  if(!window.hwDb) return;
  const res = await window.hwDb.verifyWarning(id);
  if (res && res.error) {
    showToast('Verify FAILED: ' + (res.error.message || res.error));
    renderVerifyQueue();
    return;
  }
  state.unverified = state.unverified.filter(w => (w.warning_id || w.id) !== id);
  const auditNote = res && res.audit === 'failed' ? ' — audit row FAILED (check console)' : '';
  afterVerifyChange(`${id} verified${auditNote}`);
};
window.rejectWarning = async function(id){
  if(!window.hwDb) return;
  const res = await window.hwDb.rejectWarning(id);
  if (res && res.error) {
    showToast('Reject FAILED: ' + (res.error.message || res.error));
    renderVerifyQueue();
    return;
  }
  state.unverified = state.unverified.filter(w => (w.warning_id || w.id) !== id);
  const auditNote = res && res.audit === 'failed' ? ' — audit row FAILED (check console)' : '';
  afterVerifyChange(`${id} rejected to Tier C${auditNote}`);
};
window.verifyAll = async function(){
  if(!window.hwDb) return;
  const targets = state.unverified.slice();
  let ok = 0, fail = 0;
  for (const w of targets) {
    const id = w.warning_id || w.id;
    const res = await window.hwDb.verifyWarning(id);
    if (res && res.error) { fail++; }
    else {
      ok++;
      state.unverified = state.unverified.filter(x => (x.warning_id || x.id) !== id);
    }
  }
  afterVerifyChange(`Verified ${ok}${fail ? `, failed ${fail}` : ''}`);
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
        'Authorization': `Bearer ${(await window.hwSupabase?.auth.getSession())?.data?.session?.access_token || ''}`
      }
    });
    const data = await res.json();
    if(res.ok && data.success) {
      document.getElementById(m+'Status').innerHTML='<span class="dot"></span> Connected';
      document.getElementById(m+'Last').textContent=`Last test: just now · ${data.latency_ms}ms · key operational`;
      showToast(`${m} API operational — ${data.latency_ms}ms`);
    } else {
      throw new Error(data.error || 'Test failed');
    }
  } catch(e) {
    document.getElementById(m+'Status').innerHTML='<span class="dot" style="background:var(--critical)"></span> Error';
    showToast(`Test failed: ${e.message}`);
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
  const wl = document.getElementById('wizCountLabel'); if(wl) wl.textContent=`${lines} lines · ${(new Blob([v||'']).size/1024).toFixed(1)} KB`;
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
    document.getElementById('prJob').textContent = `${p.lines || 0} lines · ${p.kb || '0'} KB · NAVAREA ${region}`;
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
  pills.push(`<span class="pill pill-ok">${p.lines || 0} lines · ${p.kb || '0'} KB</span>`);
  if (p.detected) {
    pills.push(`<span class="pill pill-ok">header: NAVAREA ${_esc(p.detected.toUpperCase())}</span>`);
    if (p.sel && p.sel !== 'auto' && p.sel !== p.detected) {
      pills.push(`<span class="pill" style="background:#fff7ed;color:var(--high)">selection ${_esc(p.sel.toUpperCase())} overridden</span>`);
    }
  } else if (p.sel && p.sel !== 'auto') {
    pills.push(`<span class="pill pill-ok">selection: NAVAREA ${_esc(p.sel.toUpperCase())}</span>`);
  } else {
    pills.push(`<span class="pill" style="background:#fff7ed;color:var(--high)">no header — region must be selected</span>`);
  }
  document.getElementById('parseSummary').innerHTML = pills.join(' ');
  document.getElementById('parseResults').innerHTML =
    `<div class="parse-card accepted">
      <div class="parse-main">
        <div class="parse-head"><strong>Pre-flight check</strong> · backend pipeline does the real parse</div>
        <div class="parse-title">${p.effective ? 'Will ingest via NAVAREA ' + _esc(p.effective.toUpperCase()) : 'Region unknown — the pipeline will reject this paste'}</div>
        <div class="parse-meta">Route: Supabase queue → GitHub Action (≤ 15 min) → region parser → differential sync</div>
      </div>
    </div>`;
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

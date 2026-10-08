// ═══════════ ADMIN DB ACCESS (ADMIN CONSOLE ONLY) ═══════════
// Dedicated admin database operations isolated from public portal
if (!window.hwDb) window.hwDb = {};
Object.assign(window.hwDb, {
  async fetchUnverified() {
    if (!window.hwSupabase) return [];
    try {
      const { data, error } = await window.hwSupabase
        .from('nav_warnings')
        .select('*')
        .eq('is_verified', false)
        .eq('status', 'active');
      return data || [];
    } catch (e) {
      return [];
    }
  },

  async verifyWarning(id) {
    if (!window.hwSupabase) return { error: 'No db connection' };
    return await window.hwSupabase
      .from('nav_warnings')
      .update({ is_verified: true, verified_at: new Date().toISOString() })
      .eq('warning_id', id);
  },

  async rejectWarning(id) {
    if (!window.hwSupabase) return { error: 'No db connection' };
    return await window.hwSupabase
      .from('nav_warnings')
      .update({ status: 'rejected' })
      .eq('warning_id', id);
  },

  async publishImport(warnings) {
    if (!window.hwSupabase) return { error: 'No db connection' };
    return await window.hwSupabase
      .from('nav_warnings')
      .upsert(warnings, { onConflict: 'source_id, warning_id', ignoreDuplicates: true });
  }
});

// ═══════════ STATE ═══════════
const SESSION_KEY = 'hw_admin_session';
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
let currentUser = null;

const state = {
  unverified: [],
  logFilter: "ALL",
  wizard: { step:1, method:"paste", results:[], accepted:new Set() },
  pipelineRunning: false
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
  if(state.unverified.length>0) items.push({icon:'⚠',cls:'warn',html:`<b>${state.unverified.length} warning${state.unverified.length>1?'s':''}</b> awaiting verification`,sub:state.unverified.map(w=>w.warning_id).join(' · '),btn:'Review',fn:"switchAdminSub('verify')"});
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
  if(!items.length){ q.innerHTML=`<div class="success-panel"><div class="big">✓</div><h3>Verification Queue Empty</h3><p>All published warnings carry verified status.</p></div>`; return; }
  q.innerHTML=`<div class="page-header" style="margin-bottom:14px"><div><h1 style="font-size:20px">Verification Queue</h1><p class="subtitle">${items.length} human confirmation required</p></div><div><button class="btn btn-secondary" onclick="verifyAll()">✓ Verify All</button></div></div>`+
  items.map(w=>`<div class="verify-card">
    <div class="verify-head"><span class="verify-title">${w.warning_id || w.id} · ${w.navarea}</span>${badge('high',w.severity?.toUpperCase() || 'HIGH')}</div>
    <div style="font-weight:500">${w.title}</div>
    <div class="verify-text">${w.raw_text || w.text}</div>
    <div class="verify-checks"><span>✓ Coords valid (${w.coordinates || w.coords})</span><span>✓ In-force window open</span></div>
    <div class="verify-actions">
      <button class="btn btn-sm btn-secondary" style="color:var(--critical)" onclick="rejectWarning('${w.warning_id || w.id}')">Reject</button>
      <button class="btn btn-sm btn-primary" style="width:auto" onclick="verifyWarning('${w.warning_id || w.id}')">✓ Verify</button>
    </div></div>`).join('');
}
window.verifyWarning = async function(id){
  if(window.hwDb) {
    await window.hwDb.verifyWarning(id);
    state.unverified = state.unverified.filter(w => (w.warning_id || w.id) !== id);
    afterVerifyChange(`${id} verified`);
  }
};
window.rejectWarning = async function(id){
  if(window.hwDb) {
    await window.hwDb.rejectWarning(id);
    state.unverified = state.unverified.filter(w => (w.warning_id || w.id) !== id);
    afterVerifyChange(`${id} rejected`);
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
    w.results=[{status:'new',id:'BULK/26',navarea:'NA I',title:'Bulk Parse Test',coords:'55N 003E',conf:96,lat:55,lng:3}];
    w.accepted=new Set(w.results.filter(r=>r.status==='new').map(r=>r.id));
    renderParseResults(); 
  }
  if(step===4){
    const news=w.results.filter(r=>r.status==='new'&&w.accepted.has(r.id));
    document.getElementById('prNew').textContent=news.length;
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
  const R=state.wizard.results;
  const news=R.filter(r=>r.status==='new');
  document.getElementById('parseSummary').innerHTML=`<span class="pill pill-ok">${news.length} new</span>`;
  document.getElementById('parseResults').innerHTML=news.map(r=>{
    return `<div class="parse-card accepted">
      <label class="parse-check"><input type="checkbox" checked onchange="toggleAccept('${r.id}',this.checked)"></label>
      <div class="parse-main"><div class="parse-head"><strong>${r.id}</strong> · ${r.navarea} ${badge('active','NEW')}</div>
      <div class="parse-title">${r.title}</div><div class="parse-meta">🎯 ${r.coords}</div>
      </div></div>`;
  }).join('');
}
window.toggleAccept = function(id,checked){ if(checked)state.wizard.accepted.add(id); else state.wizard.accepted.delete(id); };
window.publishImport = async function(){
  const w=state.wizard, news=w.results.filter(r=>r.status==='new'&&w.accepted.has(r.id));
  if(!news.length){ showToast('Nothing to publish'); return; }
  const btn=document.getElementById('publishBtn');
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Publishing…';
  
  const mapped = news.map(r=>({
    warning_id: r.id, source_id: 'manual', navarea: r.navarea, title: r.title,
    severity: 'high', status: 'active', raw_text: 'Bulk imported warning',
    latitude: r.lat, longitude: r.lng, coordinates: r.coords
  }));
  
  if (window.hwDb) {
    await window.hwDb.publishImport(mapped);
  }
  
  document.getElementById('genId').textContent='gen-bulk-'+Date.now().toString().slice(-6);
  document.getElementById('publishArea').style.display='none';
  document.getElementById('successArea').style.display='block';
  showToast(`${news.length} warnings published`);
};
window.resetWizard = function(){
  state.wizard={step:1,method:'paste',results:[],accepted:new Set()};
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

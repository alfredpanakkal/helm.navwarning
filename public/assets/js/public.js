// ═══════════ STATE ═══════════
let warnings = [];

// Seed fallback data if Supabase is empty or offline
const SEED_WARNINGS = [
 {id:"0142/26",navarea:"NA I",title:"North Sea, Dogger Bank — UXO",severity:"high",issued:"2026-09-12",issued_text:"121000 UTC SEP 2026",coords:"55.24, 3.75",lat:55.24,lng:3.75,status:"active",category:"military",text:"NAVAREA I 0142/26 NORTH SEA, DOGGER BANK. UNEXPLODED ORDNANCE (UXO) LOCATED. VESSELS ADVISED TO MAINTAIN SAFE DISTANCE.",is_verified:false},
 {id:"0140/26",navarea:"NA I",title:"English Channel — Drifting Container",severity:"high",issued:"2026-09-10",issued_text:"100830 UTC SEP 2026",coords:"50.92, 1.38",lat:50.92,lng:1.38,status:"active",category:"drifting",text:"NAVAREA I 0140/26 ENGLISH CHANNEL, DOVER STRAIT. DRIFTING CONTAINER IN 50-55.4N 001-22.8E. NAVIGATION HAZARD.",is_verified:false},
 {id:"0812/26",navarea:"NA IV",title:"W. North Atlantic — Rocket Launch",severity:"high",issued:"2026-09-11",issued_text:"111400 UTC SEP 2026",coords:"28.58, -80.50",lat:28.58,lng:-80.50,status:"active",category:"military",text:"NAVAREA IV 0812/26 WESTERN NORTH ATLANTIC. HAZARDOUS OPERATIONS, ROCKET LAUNCHING. AREA BOUNDED BY 28-35N 080-30W.",is_verified:true},
 {id:"0095/26",navarea:"NA III",title:"Mediterranean — Military Exercise",severity:"high",issued:"2026-09-13",issued_text:"130915 UTC SEP 2026",coords:"35.97, -5.33",lat:35.97,lng:-5.33,status:"active",category:"military",text:"NAVAREA III 0095/26 MEDITERRANEAN. MILITARY EXERCISE IN PROGRESS.",is_verified:true},
 {id:"0311/26",navarea:"NA X",title:"Australian Waters — Hazard",severity:"high",issued:"2026-09-14",issued_text:"140200 UTC SEP 2026",coords:"-16.75, 148.21",lat:-16.75,lng:148.21,status:"active",category:"general",text:"NAVAREA X 0311/26 AUSTRALIAN WATERS. HAZARD REPORTED.",is_verified:false}
];

// ═══════════ DEVICE / NAV ═══════════
function detectDevice(){
  const w=window.innerWidth, ua=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  document.body.classList.remove('is-mobile','is-tablet','is-desktop');
  if(w<=768||(ua&&w<=1024)) document.body.classList.add('is-mobile');
  else if(w<=1024) document.body.classList.add('is-tablet');
  else document.body.classList.add('is-desktop');
}
function debounce(fn,d){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),d)}}
window.addEventListener('resize',debounce(()=>{detectDevice();if(window.map)window.map.invalidateSize()},250));

window.switchTab = function(tab){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.drawer-item').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+tab)?.classList.add('active');
  document.querySelector(`.nav-tab[data-tab="${tab}"]`)?.classList.add('active');
  document.querySelector(`.drawer-item[data-drawer-tab="${tab}"]`)?.classList.add('active');
  document.querySelector(`.bottom-nav-item[data-bottom-tab="${tab}"]`)?.classList.add('active');
  if(tab==='map'){ if(!window.map) initMap(); else setTimeout(()=>window.map.invalidateSize(),100); }
  window.scrollTo({top:0,behavior:'smooth'});
};

window.toggleDrawer = function(){
  document.getElementById('drawer')?.classList.toggle('open');
  document.getElementById('drawerOverlay')?.classList.toggle('open');
  document.body.style.overflow=document.getElementById('drawer')?.classList.contains('open')?'hidden':'';
};
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){toggleDrawerIfOpen();closeWarningModal();} });
function toggleDrawerIfOpen(){ if(document.getElementById('drawer')?.classList.contains('open')) toggleDrawer(); }

// ═══════════ MAP ═══════════
let map, markerLayer;
function initMap(){
  const isMob=document.body.classList.contains('is-mobile');
  map = L.map('map',{center:[30,0],zoom:isMob?2:3,worldCopyJump:true,zoomControl:!isMob,tap:true});
  window.map = map;
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',{attribution:'Esri, GEBCO, NOAA',maxZoom:13}).addTo(map);
  if(!isMob) L.control.zoom({position:'bottomright'}).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  warnings.filter(w=>w.status!=='rejected').forEach(addMarker);
  rebuildMapList();
}
function addMarker(w){
  const color=w.severity==='critical'?'#dc2626':w.severity==='high'?'#ea580c':'#64748b';
  const m=L.circleMarker([w.latitude || w.lat, w.longitude || w.lng],{radius:document.body.classList.contains('is-mobile')?8:6,fillColor:color,color:'#fff',weight:2,fillOpacity:.9});
  m.bindPopup(`<div style="font-family:system-ui;font-size:13px;min-width:180px"><strong>${w.warning_id || w.id}</strong> · ${w.navarea}<br>${w.title}</div>`,{maxWidth:250});
  m.on('click',()=>openWarningModal(w));
  markerLayer.addLayer(m);
}
function rebuildMapList(){
  const list=document.getElementById('mapWarningList');
  if(!list) return;
  list.querySelectorAll('.warning-item').forEach(e=>e.remove());
  warnings.filter(w=>w.status!=='rejected').forEach(w=>{
    const item=document.createElement('div');
    item.className='warning-item'; item.onclick=()=>openWarningModal(w);
    const c=w.severity==='critical'?'var(--critical)':w.severity==='high'?'var(--high)':'var(--neutral)';
    item.innerHTML=`<span class="severity-dot" style="background:${c}"></span><div><div class="warning-id">${w.warning_id || w.id} · ${w.navarea}</div><div class="warning-meta">${w.title}</div><div class="warning-meta">${w.issued_date || w.issued}</div></div>`;
    list.appendChild(item);
  });
}
window.toggleLayer = function(name,vis){
  if(!map)return;
  if(name==='warnings'){ vis?markerLayer.addTo(map):map.removeLayer(markerLayer); }
};
window.locateOnMap = function(){ if(currentWarning&&map){ switchTab('map'); map.setView([currentWarning.latitude || currentWarning.lat, currentWarning.longitude || currentWarning.lng],7,{animate:true}); closeWarningModal(); } };

// ═══════════ TABLE / CARDS / STATS ═══════════
function badge(cls,txt){return `<span class="badge-simple badge-${cls}"><span class="dot"></span> ${txt}</span>`}
function statusBadge(w){
  if(w.status==='rejected') return badge('neutral','REJECTED');
  return !w.is_verified ? badge('neutral','UNVERIFIED') : badge('verified','VERIFIED');
}
function populateTable(filtered=warnings){
  const tb=document.getElementById('tableBody'); 
  if(!tb) return;
  tb.innerHTML='';
  const live=filtered.filter(w=>w.status!=='rejected');
  live.forEach(w=>{
    const tr=document.createElement('tr'); tr.onclick=()=>openWarningModal(w);
    tr.innerHTML=`<td><strong>${w.warning_id || w.id}</strong></td><td>${w.navarea}</td><td>${w.title}</td>
    <td>${badge(w.severity==='high'?'high':w.severity==='critical'?'critical':'moderate',w.severity.toUpperCase())}</td>
    <td>${w.issued_date || w.issued}</td><td>${w.coordinates || w.coords}</td><td>${statusBadge(w)}</td>`;
    tb.appendChild(tr);
  });
  const tc = document.getElementById('tableCount');
  if(tc) tc.textContent=`Showing 1–${live.length} of ${live.length}`;
}
function populateCards(filtered=warnings){
  const cl=document.getElementById('cardList');
  if(!cl) return;
  cl.querySelectorAll('.warning-card').forEach(e=>e.remove());
  filtered.filter(w=>w.status!=='rejected').forEach(w=>{
    const c=document.createElement('div'); c.className='warning-card'; c.onclick=()=>openWarningModal(w);
    c.innerHTML=`<div class="warning-card-header"><span class="warning-card-id">${w.warning_id || w.id} · ${w.navarea}</span>${badge(w.severity==='high'?'high':'moderate',w.severity.toUpperCase())}</div>
    <div class="warning-card-title">${w.title}</div>
    <div class="warning-card-meta"><span>📍 ${w.navarea}</span><span>📅 ${w.issued_date || w.issued}</span><span>🎯 ${w.coordinates || w.coords}</span></div>`;
    cl.appendChild(c);
  });
}
window.filterTable = function(){
  const q=document.getElementById('searchInput')?.value.toLowerCase() || '';
  const f=warnings.filter(w=>((w.warning_id || w.id)+w.title+w.navarea).toLowerCase().includes(q));
  populateTable(f); populateCards(f);
};
window.applyFilters = function(){
  const na=document.getElementById('filter-navarea')?.value, sv=document.getElementById('filter-severity')?.value, ca=document.getElementById('filter-category')?.value;
  const f=warnings.filter(w=>(!na||w.navarea===na)&&(!sv||w.severity===sv)&&(!ca||w.category===ca));
  populateTable(f); populateCards(f);
  const n=[na,sv,ca].filter(Boolean).length, el=document.getElementById('activeFilterCount');
  if(el){ el.style.display=n?'inline-flex':'none'; el.textContent=n; }
};
function updateStats(){
  const live=warnings.filter(w=>w.status!=='rejected');
  const areas=new Set(live.map(w=>w.navarea)).size;
  const n=live.length;
  ['nav-map-badge','nav-data-badge','drawer-map-badge','bottomBadge'].forEach(id => {
    const el = document.getElementById(id); if(el) el.textContent = n;
  });
  const mlb = document.getElementById('mapLiveBadge'); if(mlb) mlb.innerHTML=`<span class="dot"></span> ${n} live`;
  const mSub = document.getElementById('mapSubtitle'); if(mSub) mSub.textContent=`${n} in-force across ${areas} NAVAREAs`;
  const dSub = document.getElementById('dataSubtitle'); if(dSub) dSub.textContent=`${n} published warnings`;
  const sAct = document.getElementById('statActive'); if(sAct) sAct.textContent=n;
  const sCov = document.getElementById('statCoverage'); if(sCov) sCov.textContent=areas+'/21';
  const sCovSub = document.getElementById('statCoverageSub'); if(sCovSub) sCovSub.textContent=Math.round(areas/21*100)+'% world coverage';
  const hi=live.filter(w=>w.severity==='critical'||w.severity==='high').length;
  const sHi = document.getElementById('statHigh'); if(sHi) sHi.textContent=hi;
  const sHiSub = document.getElementById('statHighSub'); if(sHiSub) sHiSub.textContent=hi+' of '+n+' warnings';
}
function populateSources(){
  const g=document.getElementById('sourcesGrid');
  if(!g) return;
  [["I","UK Hydrographic Office","msi.admiralty.co.uk",4],["Baltic","Swedish Maritime Admin","sjofartsverket.se",2],["II","SHOM (France)","diffusion.shom.fr",3],["III","IHM (Spain)","armada.defensa.gob.es",3],["IV, XII","NGA (USA)","msi.nga.mil",5],["V","CHM (Brazil)","marinha.mil.br",2],["VI","SHN (Argentina)","hidro.gov.ar",1],["VII","SANHO (South Africa)","sanho.co.za",2],["VIII","INHO (India)","hydrobharat.gov.in",3],["IX","Pakistan Hydro Dept","hydrography.paknavy.gov.pk",2],["X","AMSA (Australia)","amsa.gov.au",4],["XI","Japan Coast Guard","kaiho.mlit.go.jp",3],["XIV","Maritime New Zealand","maritimenz.govt.nz",2],["XV","SHOA (Chile)","shoa.cl",2]].forEach(([r,p,u,n])=>{
    const un=["V","VI","XV"].includes(r);
    const d=document.createElement('div'); d.className='source-card';
    d.innerHTML=`<div class="source-header"><div><div class="source-name">${r}</div><div class="source-region">${p}</div></div>${un?badge('neutral','⋯'):badge('verified','✓')}</div><div class="source-count">${n} active warnings</div><a href="https://${u}" target="_blank" rel="noopener" class="source-url">${u}</a>`;
    g.appendChild(d);
  });
}
window.refreshData = async function(){
  await loadWarnings();
  if(markerLayer){ markerLayer.clearLayers(); warnings.filter(w=>w.status!=='rejected').forEach(addMarker); rebuildMapList(); }
  showToast('Data refreshed — latest published generation loaded');
};

// ═══════════ MODAL / TOAST ═══════════
let currentWarning, toastTimeout;
window.openWarningModal = function(w){
  currentWarning=w;
  document.getElementById('modalTitle').textContent=`${w.warning_id || w.id} — ${w.navarea}`;
  document.getElementById('modalBody').innerHTML=`
    <div class="detail-row"><div class="detail-label">Severity</div><div class="detail-value">${badge(w.severity==='high'?'high':'moderate',w.severity.toUpperCase())}</div></div>
    <div class="detail-row"><div class="detail-label">Issued</div><div class="detail-value">${w.issued_text || w.issued_date || w.issued}</div></div>
    <div class="detail-row"><div class="detail-label">Coordinates</div><div class="detail-value">${w.coordinates || w.coords}</div></div>
    <div class="detail-row"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(w)}</div></div>
    <div class="warning-text">${w.raw_text || w.text}</div>`;
  document.getElementById('warningModal')?.classList.add('open');
  document.body.style.overflow='hidden';
};
window.closeModal = function(e){ if(e.target===e.currentTarget) closeWarningModal(); };
window.closeWarningModal = function(){ document.getElementById('warningModal')?.classList.remove('open'); document.body.style.overflow=''; };
window.showToast = function(m){
  const t=document.getElementById('toast'); if(!t) return;
  t.textContent=m; t.classList.add('show');
  clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>t.classList.remove('show'),2600);
};

// ═══════════ INIT ═══════════
async function loadWarnings() {
  if (window.hwDb) {
    const data = await window.hwDb.fetchActiveWarnings();
    if (data && data.length > 0) {
      warnings = data;
    } else {
      warnings = SEED_WARNINGS;
    }
  } else {
    warnings = SEED_WARNINGS;
  }
  updateStats(); populateTable(); populateCards();
}

document.addEventListener('DOMContentLoaded', async ()=>{
  detectDevice();
  populateSources();
  await loadWarnings();
});

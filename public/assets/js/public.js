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
window.addEventListener('resize',debounce(()=>{
  detectDevice();
  const m = getLeafletMap();
  if(m) m.invalidateSize();
},250));

window.switchTab = function(tab){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.drawer-item').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+tab)?.classList.add('active');
  document.querySelector(`.nav-tab[data-tab="${tab}"]`)?.classList.add('active');
  document.querySelector(`.drawer-item[data-drawer-tab="${tab}"]`)?.classList.add('active');
  document.querySelector(`.bottom-nav-item[data-bottom-tab="${tab}"]`)?.classList.add('active');
  if(tab==='map'){
    const m = getLeafletMap();
    if(!m) initMap();
    else setTimeout(()=>m.invalidateSize(),100);
  }
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
let leafletMap = null, markerLayer = null;
function getLeafletMap() {
  return leafletMap && typeof leafletMap.invalidateSize === 'function' ? leafletMap : null;
}

function initMap(){
  if (leafletMap && typeof leafletMap.invalidateSize === 'function') return;
  const mapEl = document.getElementById('map');
  if (!mapEl || typeof L === 'undefined') return;
  const isMob=document.body.classList.contains('is-mobile');
  leafletMap = L.map('map',{center:[30,0],zoom:isMob?2:3,worldCopyJump:true,zoomControl:false,tap:true});
  window.leafletMap = leafletMap;
  window.hwMap = leafletMap;
  window.map = leafletMap;
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',{attribution:'Esri, GEBCO, NOAA',maxZoom:13}).addTo(leafletMap);
  markerLayer = L.layerGroup().addTo(leafletMap);
  warnings.filter(w=>w.status!=='rejected').forEach(addMarker);
  rebuildMapList();
}
function addMarker(w){
  const color=w.severity==='critical'?'#dc2626':w.severity==='high'?'#ea580c':'#64748b';
  const lat = Number(w.latitude ?? w.lat);
  const lng = Number(w.longitude ?? w.lng);
  if (isNaN(lat) || isNaN(lng)) return;
  const m=L.circleMarker([lat, lng],{radius:document.body.classList.contains('is-mobile')?8:6,fillColor:color,color:'#fff',weight:2,fillOpacity:.9});
  m.bindPopup(`<div style="font-family:system-ui;font-size:13px;min-width:180px"><strong>${w.warning_id || w.id}</strong> · ${w.navarea}<br>${w.title}</div>`,{maxWidth:250});
  m.on('click', () => {
    const wid = w.warning_id || w.id;
    const itemEl = Array.from(document.querySelectorAll('.warning-item')).find(el => el.dataset.warningId === wid);
    if (itemEl) {
      itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (!itemEl.classList.contains('expanded')) {
        toggleInlineWarning(w, itemEl);
      }
    } else {
      openWarningModal(w);
    }
  });
  if(markerLayer) markerLayer.addLayer(m);
}

let expandedWarningId = null;

async function toggleInlineWarning(w, itemEl){
  const isCurrentlyExpanded = itemEl.classList.contains('expanded');
  
  // Collapse any currently expanded item
  const list = document.getElementById('mapWarningList');
  if (list) {
    list.querySelectorAll('.warning-item.expanded').forEach(el => {
      el.classList.remove('expanded');
      const body = el.querySelector('.warning-expanded-body');
      if (body) body.remove();
    });
  }

  if (isCurrentlyExpanded) {
    expandedWarningId = null;
    return;
  }

  expandedWarningId = w.warning_id || w.id;
  itemEl.classList.add('expanded');

  // Focus map on marker
  const lat = Number(w.latitude ?? w.lat);
  const lng = Number(w.longitude ?? w.lng);
  const m = getLeafletMap();
  if (m && !isNaN(lat) && !isNaN(lng)) {
    m.panTo([lat, lng], { animate: true });
  }

  const sevClass = w.severity === 'critical' ? 'critical' : w.severity === 'high' ? 'high' : 'moderate';
  const verClass = w.is_verified ? 'verified' : 'neutral';
  const verLabel = w.is_verified ? 'VERIFIED' : 'UNVERIFIED';

  const expBody = document.createElement('div');
  expBody.className = 'warning-expanded-body';
  expBody.onclick = (e) => e.stopPropagation();

  const coordsText = w.coordinates || w.coords || (!isNaN(lat) && !isNaN(lng) ? `${lat.toFixed(2)}, ${lng.toFixed(2)}` : 'N/A');
  const issuedText = w.issued_text || w.issued_date || w.issued || 'N/A';
  const wid = w.warning_id || w.id;

  expBody.innerHTML = `
    <div class="warning-expanded-badges">
      ${badge(sevClass, (w.severity || 'HIGH').toUpperCase())}
      ${badge(verClass, verLabel)}
      ${w.category ? `<span class="badge-simple badge-neutral">${w.category.toUpperCase()}</span>` : ''}
    </div>
    <div class="warning-expanded-meta">
      <div><strong>Issued:</strong> ${issuedText}</div>
      <div><strong>Coordinates:</strong> ${coordsText}</div>
    </div>
    <div class="warning-expanded-text">Loading bulletin text...</div>
    <div class="warning-expanded-actions">
      <button type="button" class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); panToWarning('${encodeURIComponent(wid)}')">
        <span>📍 Focus on Map</span>
      </button>
      <button type="button" class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); toggleInlineWarningById('${encodeURIComponent(wid)}')">
        <span>Collapse</span>
      </button>
    </div>
  `;

  itemEl.appendChild(expBody);

  const textEl = expBody.querySelector('.warning-expanded-text');
  if (textEl) {
    if (w.raw_text) {
      textEl.innerText = w.raw_text;
    } else if (w.text) {
      textEl.innerText = w.text;
    } else {
      const fetchFn = typeof fetchWarningDetails === 'function'
        ? fetchWarningDetails
        : (window.hwDb && window.hwDb.fetchWarningDetails);
      const details = fetchFn ? await fetchFn(w.id || w.warning_id) : null;
      if (details && details.raw_text) {
        w.raw_text = details.raw_text;
        textEl.innerText = w.raw_text;
      } else {
        textEl.innerText = "No additional bulletin text available.";
      }
    }
  }
}

window.panToWarning = function(rawId){
  const id = decodeURIComponent(rawId);
  const w = warnings.find(item => (item.warning_id || item.id) === id);
  if (!w) return;
  const lat = Number(w.latitude ?? w.lat);
  const lng = Number(w.longitude ?? w.lng);
  const m = getLeafletMap();
  if (m && !isNaN(lat) && !isNaN(lng)) {
    m.setView([lat, lng], Math.max(m.getZoom(), 6), { animate: true });
  }
};

window.toggleInlineWarningById = function(rawId){
  const id = decodeURIComponent(rawId);
  const el = Array.from(document.querySelectorAll('.warning-item')).find(item => item.dataset.warningId === id);
  const w = warnings.find(item => (item.warning_id || item.id) === id);
  if (el && w) {
    toggleInlineWarning(w, el);
  }
};

function rebuildMapList(){
  const list=document.getElementById('mapWarningList');
  if(!list) return;
  list.querySelectorAll('.warning-item').forEach(e=>e.remove());
  warnings.filter(w=>w.status!=='rejected').forEach(w=>{
    const item=document.createElement('div');
    const wid = w.warning_id || w.id;
    item.className='warning-item';
    item.dataset.warningId = wid;
    item.onclick=()=>toggleInlineWarning(w, item);
    const c=w.severity==='critical'?'var(--critical)':w.severity==='high'?'var(--high)':'var(--neutral)';
    item.innerHTML=`
      <div class="warning-item-header">
        <span class="severity-dot" style="background:${c}"></span>
        <div class="warning-item-title-col">
          <div class="warning-id">${wid} · ${w.navarea}</div>
          <div class="warning-meta">${w.title}</div>
          <div class="warning-meta">${w.issued_date || w.issued}</div>
        </div>
        <svg class="warning-item-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </div>`;
    list.appendChild(item);

    if (expandedWarningId === wid) {
      toggleInlineWarning(w, item);
    }
  });
}
window.toggleLayer = function(name,vis){
  const m = getLeafletMap();
  if(!m || !markerLayer) return;
  if(name==='warnings'){ vis?markerLayer.addTo(m):m.removeLayer(markerLayer); }
};

window.toggleMinimizeWarningList = function(){
  const el = document.getElementById('mapWarningList');
  if(!el) return;
  const isMin = el.classList.contains('is-minimized');
  el.classList.remove('is-maximized');
  el.classList.toggle('is-minimized', !isMin);
  const minBtn = document.getElementById('btnMinWarningList');
  if(minBtn) {
    minBtn.title = !isMin ? 'Restore' : 'Minimize';
    minBtn.setAttribute('aria-label', !isMin ? 'Restore active warnings list' : 'Minimize active warnings list');
    minBtn.innerHTML = !isMin
      ? '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>'
      : '<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  }
  const maxBtn = document.getElementById('btnMaxWarningList');
  if(maxBtn) {
    maxBtn.title = 'Maximize';
    maxBtn.setAttribute('aria-label', 'Maximize active warnings list');
    maxBtn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  }
};

window.toggleMaximizeWarningList = function(){
  const el = document.getElementById('mapWarningList');
  if(!el) return;
  const isMax = el.classList.contains('is-maximized');
  el.classList.remove('is-minimized');
  el.classList.toggle('is-maximized', !isMax);
  const minBtn = document.getElementById('btnMinWarningList');
  if(minBtn) {
    minBtn.title = 'Minimize';
    minBtn.setAttribute('aria-label', 'Minimize active warnings list');
    minBtn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  }
  const maxBtn = document.getElementById('btnMaxWarningList');
  if(maxBtn) {
    maxBtn.title = !isMax ? 'Restore' : 'Maximize';
    maxBtn.setAttribute('aria-label', !isMax ? 'Restore active warnings list size' : 'Maximize active warnings list');
    maxBtn.innerHTML = !isMax
      ? '<svg viewBox="0 0 24 24"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'
      : '<svg viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  }
};
window.locateOnMap = function(){
  const m = getLeafletMap();
  if(currentWarning && m){
    switchTab('map');
    const lat = Number(currentWarning.latitude ?? currentWarning.lat);
    const lng = Number(currentWarning.longitude ?? currentWarning.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      m.setView([lat, lng],7,{animate:true});
    }
    closeWarningModal();
  }
};

// ═══════════ TABLE / CARDS / STATS ═══════════
function badge(cls,txt){return `<span class="badge-simple badge-${cls}"><span class="dot"></span> ${txt}</span>`}
function statusBadge(w){
  if(w.status==='rejected') return badge('neutral','REJECTED');
  return !w.is_verified ? badge('neutral','UNVERIFIED') : badge('verified','VERIFIED');
}

let expandedTableWarningId = null;

function toggleTableDetailRow(w, tr) {
  const wid = w.warning_id || w.id;
  const isCurrentlyOpen = tr.classList.contains('table-row-selected');
  const tb = document.getElementById('tableBody');
  if (!tb) return;

  // Remove existing detail row and selection
  tb.querySelectorAll('.table-detail-row').forEach(row => row.remove());
  tb.querySelectorAll('.table-row-selected').forEach(row => row.classList.remove('table-row-selected'));

  if (isCurrentlyOpen) {
    expandedTableWarningId = null;
    return;
  }

  expandedTableWarningId = wid;
  tr.classList.add('table-row-selected');

  const detailTr = document.createElement('tr');
  detailTr.className = 'table-detail-row';
  detailTr.dataset.forWarning = wid;

  const lat = Number(w.latitude ?? w.lat);
  const lng = Number(w.longitude ?? w.lng);
  const coordsText = w.coordinates || w.coords || (!isNaN(lat) && !isNaN(lng) ? `${lat.toFixed(2)}, ${lng.toFixed(2)}` : 'N/A');
  const issuedText = w.issued_text || w.issued_date || w.issued || 'N/A';
  const sevClass = w.severity === 'critical' ? 'critical' : w.severity === 'high' ? 'high' : 'moderate';
  const verClass = w.is_verified ? 'verified' : 'neutral';
  const verLabel = w.is_verified ? 'VERIFIED' : 'UNVERIFIED';

  detailTr.innerHTML = `
    <td colspan="7">
      <div class="table-detail-container" onclick="event.stopPropagation()">
        <div class="table-detail-header">
          <div class="warning-expanded-badges">
            ${badge(sevClass, (w.severity || 'HIGH').toUpperCase())}
            ${badge(verClass, verLabel)}
            ${w.category ? `<span class="badge-simple badge-neutral">${w.category.toUpperCase()}</span>` : ''}
            <span style="font-weight:600;font-size:13px;color:var(--text)">${w.title}</span>
          </div>
          <div class="table-detail-actions">
            <button type="button" class="btn btn-sm btn-primary" onclick="event.stopPropagation(); locateOnMapById('${encodeURIComponent(wid)}')">
              <span>📍 View on Map</span>
            </button>
            <button type="button" class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); toggleTableDetailRowById('${encodeURIComponent(wid)}')">
              <span>Collapse</span>
            </button>
          </div>
        </div>
        <div class="table-detail-meta">
          <div><strong>NAVAREA:</strong> ${w.navarea}</div>
          <div><strong>Issued:</strong> ${issuedText}</div>
          <div><strong>Coordinates:</strong> ${coordsText}</div>
          ${w.authority ? `<div><strong>Authority:</strong> ${w.authority}</div>` : ''}
        </div>
        <div class="table-detail-text">Loading bulletin text...</div>
      </div>
    </td>
  `;

  tr.after(detailTr);

  const textEl = detailTr.querySelector('.table-detail-text');
  if (textEl) {
    if (w.raw_text) {
      textEl.innerText = w.raw_text;
    } else if (w.text) {
      textEl.innerText = w.text;
    } else {
      const fetchFn = typeof fetchWarningDetails === 'function'
        ? fetchWarningDetails
        : (window.hwDb && window.hwDb.fetchWarningDetails);
      const fetchPromise = fetchFn ? fetchFn(wid) : Promise.resolve(null);
      fetchPromise.then(details => {
        if (details && details.raw_text) {
          w.raw_text = details.raw_text;
          textEl.innerText = w.raw_text;
        } else {
          textEl.innerText = "No additional bulletin text available.";
        }
      }).catch(() => {
        textEl.innerText = "Error loading bulletin text.";
      });
    }
  }
}

let expandedCardWarningId = null;

function toggleCardDetail(w, cardEl) {
  const wid = w.warning_id || w.id;
  const isCurrentlyOpen = cardEl.classList.contains('expanded');
  const cl = document.getElementById('cardList');
  if (!cl) return;

  cl.querySelectorAll('.warning-card.expanded').forEach(c => {
    c.classList.remove('expanded');
    const body = c.querySelector('.warning-card-expanded-body');
    if (body) body.remove();
  });

  if (isCurrentlyOpen) {
    expandedCardWarningId = null;
    return;
  }

  expandedCardWarningId = wid;
  cardEl.classList.add('expanded');

  const lat = Number(w.latitude ?? w.lat);
  const lng = Number(w.longitude ?? w.lng);
  const coordsText = w.coordinates || w.coords || (!isNaN(lat) && !isNaN(lng) ? `${lat.toFixed(2)}, ${lng.toFixed(2)}` : 'N/A');
  const issuedText = w.issued_text || w.issued_date || w.issued || 'N/A';
  const verClass = w.is_verified ? 'verified' : 'neutral';
  const verLabel = w.is_verified ? 'VERIFIED' : 'UNVERIFIED';

  const bodyEl = document.createElement('div');
  bodyEl.className = 'warning-card-expanded-body';
  bodyEl.onclick = (e) => e.stopPropagation();

  bodyEl.innerHTML = `
    <div class="warning-expanded-badges">
      ${badge(verClass, verLabel)}
      ${w.category ? `<span class="badge-simple badge-neutral">${w.category.toUpperCase()}</span>` : ''}
    </div>
    <div class="warning-expanded-meta">
      <div><strong>Issued:</strong> ${issuedText}</div>
      <div><strong>Coordinates:</strong> ${coordsText}</div>
    </div>
    <div class="warning-expanded-text">Loading bulletin text...</div>
    <div class="warning-expanded-actions">
      <button type="button" class="btn btn-sm btn-primary" onclick="event.stopPropagation(); locateOnMapById('${encodeURIComponent(wid)}')">
        <span>📍 View on Map</span>
      </button>
      <button type="button" class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); toggleCardDetailById('${encodeURIComponent(wid)}')">
        <span>Collapse</span>
      </button>
    </div>
  `;

  cardEl.appendChild(bodyEl);

  const textEl = bodyEl.querySelector('.warning-expanded-text');
  if (textEl) {
    if (w.raw_text) {
      textEl.innerText = w.raw_text;
    } else if (w.text) {
      textEl.innerText = w.text;
    } else {
      const fetchFn = typeof fetchWarningDetails === 'function'
        ? fetchWarningDetails
        : (window.hwDb && window.hwDb.fetchWarningDetails);
      const fetchPromise = fetchFn ? fetchFn(wid) : Promise.resolve(null);
      fetchPromise.then(details => {
        if (details && details.raw_text) {
          w.raw_text = details.raw_text;
          textEl.innerText = w.raw_text;
        } else {
          textEl.innerText = "No additional bulletin text available.";
        }
      }).catch(() => {
        textEl.innerText = "Error loading bulletin text.";
      });
    }
  }
}

window.locateOnMapById = function(rawId){
  const id = decodeURIComponent(rawId);
  const w = warnings.find(item => (item.warning_id || item.id) === id);
  if (!w) return;
  switchTab('map');
  const lat = Number(w.latitude ?? w.lat);
  const lng = Number(w.longitude ?? w.lng);
  const m = getLeafletMap();
  if (m && !isNaN(lat) && !isNaN(lng)) {
    m.setView([lat, lng], 7, { animate: true });
  }
  const itemEl = Array.from(document.querySelectorAll('.warning-item')).find(el => el.dataset.warningId === id);
  if (itemEl) {
    itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (!itemEl.classList.contains('expanded')) {
      toggleInlineWarning(w, itemEl);
    }
  }
};

window.toggleTableDetailRowById = function(rawId){
  const id = decodeURIComponent(rawId);
  const tr = Array.from(document.querySelectorAll('tr[data-warning-id]')).find(el => el.dataset.warningId === id);
  const w = warnings.find(item => (item.warning_id || item.id) === id);
  if (tr && w) {
    toggleTableDetailRow(w, tr);
  }
};

window.toggleCardDetailById = function(rawId){
  const id = decodeURIComponent(rawId);
  const c = Array.from(document.querySelectorAll('.warning-card')).find(el => el.dataset.warningId === id);
  const w = warnings.find(item => (item.warning_id || item.id) === id);
  if (c && w) {
    toggleCardDetail(w, c);
  }
};

function populateTable(filtered=warnings){
  const tb=document.getElementById('tableBody'); 
  if(!tb) return;
  tb.innerHTML='';
  const live=filtered.filter(w=>w.status!=='rejected');
  live.forEach(w=>{
    const tr=document.createElement('tr');
    const wid = w.warning_id || w.id;
    tr.dataset.warningId = wid;
    tr.onclick=()=>toggleTableDetailRow(w, tr);
    tr.innerHTML=`<td><strong>${wid}</strong> <svg class="row-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></td><td>${w.navarea}</td><td>${w.title}</td>
    <td>${badge(w.severity==='high'?'high':w.severity==='critical'?'critical':'moderate',w.severity.toUpperCase())}</td>
    <td>${w.issued_date || w.issued}</td><td>${w.coordinates || w.coords}</td><td>${statusBadge(w)}</td>`;
    tb.appendChild(tr);

    if (expandedTableWarningId === wid) {
      toggleTableDetailRow(w, tr);
    }
  });
  const tc = document.getElementById('tableCount');
  if(tc) tc.textContent=`Showing 1–${live.length} of ${live.length}`;
}
function populateCards(filtered=warnings){
  const cl=document.getElementById('cardList');
  if(!cl) return;
  cl.querySelectorAll('.warning-card').forEach(e=>e.remove());
  filtered.filter(w=>w.status!=='rejected').forEach(w=>{
    const c=document.createElement('div');
    const wid = w.warning_id || w.id;
    c.className='warning-card';
    c.dataset.warningId = wid;
    c.onclick=()=>toggleCardDetail(w, c);
    c.innerHTML=`<div class="warning-card-header"><span class="warning-card-id">${wid} · ${w.navarea}</span>${badge(w.severity==='high'?'high':'moderate',w.severity.toUpperCase())}</div>
    <div class="warning-card-title">${w.title}</div>
    <div class="warning-card-meta"><span>📍 ${w.navarea}</span><span>📅 ${w.issued_date || w.issued}</span><span>🎯 ${w.coordinates || w.coords}</span></div>`;
    cl.appendChild(c);

    if (expandedCardWarningId === wid) {
      toggleCardDetail(w, c);
    }
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
window.openWarningModal = async function(w){
  currentWarning=w;
  document.getElementById('modalTitle').textContent=`${w.warning_id || w.id} — ${w.navarea}`;
  document.getElementById('modalBody').innerHTML=`
    <div class="detail-row"><div class="detail-label">Severity</div><div class="detail-value">${badge(w.severity==='high'?'high':w.severity==='critical'?'critical':'moderate',w.severity.toUpperCase())}</div></div>
    <div class="detail-row"><div class="detail-label">Issued</div><div class="detail-value">${w.issued_text || w.issued_date || w.issued}</div></div>
    <div class="detail-row"><div class="detail-label">Coordinates</div><div class="detail-value">${w.coordinates || w.coords}</div></div>
    <div class="detail-row"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(w)}</div></div>
    <div class="warning-text" id="modalTextContainer"></div>`;
  document.getElementById('warningModal')?.classList.add('open');
  document.body.style.overflow='hidden';

  const textContainer = document.getElementById('modalTextContainer');
  if (!textContainer) return;

  // Check if we already fetched the raw_text
  if (w.raw_text) {
    textContainer.innerText = w.raw_text;
  } else if (w.text) {
    textContainer.innerText = w.text;
  } else {
    // Show a loading state
    textContainer.innerHTML = '<span class="loading-spinner">Loading bulletin text...</span>';
    
    // Fetch the details on demand
    const fetchFn = typeof fetchWarningDetails === 'function'
      ? fetchWarningDetails
      : (window.hwDb && window.hwDb.fetchWarningDetails);

    const details = fetchFn ? await fetchFn(w.id) : null;
    if (details && details.raw_text) {
      w.raw_text = details.raw_text; // Cache it in memory so we don't fetch it twice
      textContainer.innerText = w.raw_text;
    } else {
      textContainer.innerText = "Error loading bulletin text.";
    }
  }
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
  if (markerLayer) {
    markerLayer.clearLayers();
    warnings.filter(w=>w.status!=='rejected').forEach(addMarker);
    rebuildMapList();
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  detectDevice();
  initMap();
  populateSources();
  await loadWarnings();
});

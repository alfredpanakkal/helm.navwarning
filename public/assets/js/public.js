// ═══════════ STATE ═══════════
let warnings = [];

// ═══════════ POSITION FORMAT (site-wide standard) ═══════════
// Every coordinate displayed on the site uses degrees + decimal minutes,
// e.g. 25° 54.71' N 065° 52.02' E (formatDMD is hoisted; defined near the
// coordinate picker below). Falls back to the stored text, then `fallback`.
function warningPositionText(w, fallback) {
  const lat = Number(w.latitude ?? w.lat);
  const lng = Number(w.longitude ?? w.lng);
  if (!isNaN(lat) && !isNaN(lng)) return formatDMD(lat, lng);
  return w.coordinates || w.coords || (fallback || 'N/A');
}


// Seed fallback data if Supabase is empty or offline (demonstrating points, polygons, circles, corridors)
const SEED_WARNINGS = [
  {
    id:"0180/26",
    navarea:"NA I",
    title:"North Sea — Mobile Offshore Drilling Units (MODU)",
    severity:"high",
    issued:"2026-09-15",
    issued_text:"151000 UTC SEP 2026",
    coords:"57.10, 1.50",
    lat:57.10,
    lng:1.50,
    status:"active",
    category:"offshore",
    buffer_nm: 0.27,
    geometries: [
      {
        feature_type: "POINT",
        buffer_nm: 0,
        zone_label: "Rig: VALARIS 120",
        is_rig: true,
        geojson_blob: { type: "Point", coordinates: [3.21, 56.19] }
      },
      {
        feature_type: "POINT",
        buffer_nm: 0.27,
        zone_label: "500m Safety Zone - VALARIS 120",
        is_rig: true,
        geojson_blob: { type: "Point", coordinates: [3.21, 56.19] }
      },
      {
        feature_type: "POINT",
        buffer_nm: 0,
        zone_label: "Rig: NOBLE PROSPECT",
        is_rig: true,
        geojson_blob: { type: "Point", coordinates: [1.31, 57.75] }
      },
      {
        feature_type: "POINT",
        buffer_nm: 0.27,
        zone_label: "500m Safety Zone - NOBLE PROSPECT",
        is_rig: true,
        geojson_blob: { type: "Point", coordinates: [1.31, 57.75] }
      },
      {
        feature_type: "POINT",
        buffer_nm: 0,
        zone_label: "Rig: STENA DON",
        is_rig: true,
        geojson_blob: { type: "Point", coordinates: [0.81, 58.20] }
      },
      {
        feature_type: "POINT",
        buffer_nm: 0.27,
        zone_label: "500m Safety Zone - STENA DON",
        is_rig: true,
        geojson_blob: { type: "Point", coordinates: [0.81, 58.20] }
      },
      {
        feature_type: "POINT",
        buffer_nm: 0,
        zone_label: "Rig: OCEAN ENDEAVOR",
        is_rig: true,
        geojson_blob: { type: "Point", coordinates: [0.85, 57.24] }
      },
      {
        feature_type: "POINT",
        buffer_nm: 0.27,
        zone_label: "500m Safety Zone - OCEAN ENDEAVOR",
        is_rig: true,
        geojson_blob: { type: "Point", coordinates: [0.85, 57.24] }
      }
    ],
    text:"NAVAREA I 0180/26 NORTH SEA. RIGS IN OFFSHORE SECTOR:\n1. DRILLING RIGS ESTABLISHED:\nA. VALARIS 120 56-11.4N 003-12.8E\nB. NOBLE PROSPECT 57-45.2N 001-18.4E\nC. STENA DON 58-12.0N 000-48.5E\nD. OCEAN ENDEAVOR 57-14.2N 000-51.1E\n2. 500 METRES SAFETY ZONE IN FORCE AROUND EACH RIG. WIDE BERTH REQUESTED.",
    is_verified:true
  },
  {
    id:"0215/26",
    navarea:"NA I",
    title:"Scotland East Coast — Multi-Sector Firing Exercises",
    severity:"critical",
    issued:"2026-09-14",
    issued_text:"140800 UTC SEP 2026",
    coords:"56.85, -1.50",
    lat:56.85,
    lng:-1.50,
    status:"active",
    category:"military",
    geometries: [
      {
        feature_type: "POLYGON",
        zone_label: "Area Alfa (Firing Danger Area)",
        geojson_blob: {
          type: "Polygon",
          coordinates: [[
            [-1.33, 57.17],
            [-0.67, 57.17],
            [-0.67, 57.50],
            [-1.33, 57.50],
            [-1.33, 57.17]
          ]]
        }
      },
      {
        feature_type: "POLYGON",
        zone_label: "Area Bravo (Missile Danger Area)",
        geojson_blob: {
          type: "Polygon",
          coordinates: [[
            [-1.83, 56.67],
            [-1.17, 56.67],
            [-1.17, 57.00],
            [-1.83, 57.00],
            [-1.83, 56.67]
          ]]
        }
      },
      {
        feature_type: "POINT",
        buffer_nm: 5.0,
        zone_label: "Sector Charlie (5 NM Safety Zone)",
        geojson_blob: { type: "Point", coordinates: [-2.08, 56.25] }
      },
      {
        feature_type: "POINT",
        buffer_nm: 0,
        zone_label: "Sector Charlie Center Point",
        geojson_blob: { type: "Point", coordinates: [-2.08, 56.25] }
      }
    ],
    text:"NAVAREA I 0215/26 SCOTLAND, EAST COAST. FIRING EXERCISES.\n1. HAZARDOUS AREAS ESTABLISHED:\nAREA ALFA BOUNDED BY: 57-10.0N 001-20.0W, 57-10.0N 000-40.0W, 57-30.0N 000-40.0W, 57-30.0N 001-20.0W.\nAREA BRAVO BOUNDED BY: 56-40.0N 001-50.0W, 56-40.0N 001-10.0W, 57-00.0N 001-10.0W, 57-00.0N 001-50.0W.\nSECTOR CHARLIE (SAFETY ZONE): 56-15.0N 002-05.0W RADIUS 5 NM.\n2. ALL VESSELS IN VICINITY KEEP CLEAR.",
    is_verified:true
  },
  {
   id:"0142/26",
   navarea:"NA I",
   title:"North Sea, Dogger Bank — UXO Clearance",
   severity:"critical",
   issued:"2026-09-12",
   issued_text:"121000 UTC SEP 2026",
   coords:"55.24, 3.75",
   lat:55.24,
   lng:3.75,
   status:"active",
   category:"military",
   buffer_nm: 1.5,
   feature_type: "POINT",
   geometries: [
     {
       feature_type: "POINT",
       buffer_nm: 1.5,
       zone_label: "UXO Safety Zone",
       geojson_blob: { type: "Point", coordinates: [3.75, 55.24] }
     }
   ],
   text:"NAVAREA I 0142/26 NORTH SEA, DOGGER BANK. UNEXPLODED ORDNANCE (UXO) LOCATED IN 55-14.4N 003-45.0E. 1.5 NM SAFETY CLEARANCE ZONE ESTABLISHED. VESSELS ADVISED TO MAINTAIN SAFE DISTANCE.",
   is_verified:true
 },
 {
   id:"0140/26",
   navarea:"NA I",
   title:"English Channel — Drifting Container",
   severity:"high",
   issued:"2026-09-10",
   issued_text:"100830 UTC SEP 2026",
   coords:"50.92, 1.38",
   lat:50.92,
   lng:1.38,
   status:"active",
   category:"drifting",
   buffer_nm: 0,
   feature_type: "POINT",
   geometries: [
     {
       feature_type: "POINT",
       buffer_nm: 0,
       zone_label: "Drifting Container",
       geojson_blob: { type: "Point", coordinates: [1.38, 50.92] }
     }
   ],
   text:"NAVAREA I 0140/26 ENGLISH CHANNEL, DOVER STRAIT. DRIFTING CONTAINER IN 50-55.4N 001-22.8E. NAVIGATION HAZARD.",
   is_verified:false
 },
 {
   id:"0812/26",
   navarea:"NA IV",
   title:"W. North Atlantic — Rocket Launch Danger Area",
   severity:"critical",
   issued:"2026-09-11",
   issued_text:"111400 UTC SEP 2026",
   coords:"28.29, -80.12",
   lat:28.29,
   lng:-80.12,
   status:"active",
   category:"military",
   feature_type: "POLYGON",
   geometries: [
     {
       feature_type: "POLYGON",
       buffer_nm: 0,
       zone_label: "Rocket Drop Zone Alpha",
       geojson_blob: {
         type: "Polygon",
         coordinates: [[
           [-80.50, 28.58],
           [-79.75, 28.58],
           [-79.75, 28.00],
           [-80.50, 28.00],
           [-80.50, 28.58]
         ]]
       }
     }
   ],
   text:"NAVAREA IV 0812/26 WESTERN NORTH ATLANTIC. HAZARDOUS OPERATIONS, ROCKET LAUNCHING. AREA BOUNDED BY 28-35N 080-30W, 28-35N 079-45W, 28-00N 079-45W, 28-00N 080-30W. EXCLUSION ZONE IN EFFECT.",
   is_verified:true
 },
 {
   id:"0095/26",
   navarea:"NA III",
   title:"Mediterranean — Military Exercise Safety Zone",
   severity:"high",
   issued:"2026-09-13",
   issued_text:"130915 UTC SEP 2026",
   coords:"35.97, -5.33",
   lat:35.97,
   lng:-5.33,
   status:"active",
   category:"military",
   buffer_nm: 10.0,
   feature_type: "POINT",
   geometries: [
     {
       feature_type: "POINT",
       buffer_nm: 10.0,
       zone_label: "Naval Gunnery Safety Zone (10 NM)",
       geojson_blob: { type: "Point", coordinates: [-5.33, 35.97] }
     }
   ],
   text:"NAVAREA III 0095/26 MEDITERRANEAN. MILITARY EXERCISE IN PROGRESS. 10 NM RADIUS SAFETY CLEARANCE ZONE AROUND 35-58N 005-20W. ALL MARINERS KEEP CLEAR.",
   is_verified:true
 },
 {
   id:"0311/26",
   navarea:"NA X",
   title:"Australian Waters, Coral Sea — Subsea Cable Corridor",
   severity:"high",
   issued:"2026-09-14",
   issued_text:"140200 UTC SEP 2026",
   coords:"-17.12, 148.65",
   lat:-17.12,
   lng:148.65,
   status:"active",
   category:"verified",
   feature_type: "CORRIDOR",
   buffer_nm: 2.0,
   corridor_half_width_nm: 2.0,
   geometries: [
     {
       feature_type: "CORRIDOR",
       buffer_nm: 2.0,
       corridor_half_width_nm: 2.0,
       zone_label: "Submarine Cable Laying Track",
       geojson_blob: {
         type: "LineString",
         coordinates: [
           [148.21, -16.75],
           [148.80, -17.20],
           [149.30, -17.80]
         ]
       }
     }
   ],
   text:"NAVAREA X 0311/26 AUSTRALIAN WATERS, CORAL SEA. SUBMARINE CABLE INSTALLATION OPERATIONS ALONG TRACK JOINING 16-45.0S 148-12.6E, 17-12.0S 148-48.0E, 17-48.0S 149-18.0E. WIDE BERTH 2 NM REQUESTED.",
   is_verified:false
 }
];

// ═══════════ BULLETIN & DATE HELPERS ═══════════
function getBulletinText(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const text = (
    obj.bulletin ||
    obj.raw_text ||
    obj.text ||
    obj.rawText ||
    obj.raw_nav_warning ||
    obj.body ||
    obj.details ||
    obj.message ||
    obj.content ||
    obj.description ||
    ''
  );
  return typeof text === 'string' ? text.trim() : String(text || '');
}

function formatWarningDate(w) {
  if (!w || typeof w !== 'object') return 'Date not stated';
  const val = w.issued_date || w.issued || w.date || w.issued_text || w.issued_at || w.timestamp || w.created_at;
  if (!val) return 'Date not stated';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return 'Date not stated';
    if (trimmed.includes('T') && !isNaN(Date.parse(trimmed))) {
      try {
        return trimmed.split('T')[0];
      } catch (_) {}
    }
    return trimmed;
  }
  if (typeof val === 'number') {
    try {
      return new Date(val).toISOString().split('T')[0];
    } catch (_) {}
  }
  return String(val);
}

function formatWarningIssuedText(w) {
  if (!w || typeof w !== 'object') return 'Date not stated';
  const val = w.issued_text || w.issued_date || w.issued || w.date || w.issued_at || w.timestamp || w.created_at;
  if (!val) return 'Date not stated';
  const str = String(val).trim();
  return (str && str !== 'undefined' && str !== 'null') ? str : 'Date not stated';
}

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
},150));

window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    detectDevice();
    const m = getLeafletMap();
    if(m) m.invalidateSize();
  }, 180);
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', debounce(() => {
    const m = getLeafletMap();
    if (m) m.invalidateSize();
  }, 150));
}

window.switchTab = function(tab){
  document.querySelectorAll('.tab-panel').forEach(p=>{
    p.classList.remove('active');
    p.hidden = true;
  });
  document.querySelectorAll('.nav-tab').forEach(t=>{
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  const panel = document.getElementById('tab-'+tab);
  if(panel){
    panel.classList.add('active');
    panel.hidden = false;
  }
  const mainTab = document.querySelector(`.nav-tab[data-tab="${tab}"]`);
  if(mainTab){
    mainTab.classList.add('active');
    mainTab.setAttribute('aria-selected', 'true');
  }
  // More menu stays highlighted while any of its destinations is active
  const moreBtn = document.getElementById('tab-btn-more');
  if(moreBtn){
    const inMoreGroup = (tab === 'info' || tab === 'sources' || tab === 'appearance');
    moreBtn.classList.toggle('active', inMoreGroup);
  }

  const isMap = (tab === 'map');
  document.body.classList.toggle('tab-map-active', isMap);
  document.documentElement.classList.toggle('tab-map-active', isMap);

  if(tab==='map'){
    const m = getLeafletMap();
    if(!m) initMap();
    else {
      setTimeout(()=>m.invalidateSize(), 50);
      setTimeout(()=>m.invalidateSize(), 200);
    }
    window.scrollTo({top:0,behavior:'instant'});
  } else {
    window.scrollTo({top:0,behavior:'smooth'});
  }
};

// More menu — compact dropdown (desktop) / bottom sheet (mobile)
window.toggleMoreMenu = function(force){
  const menu = document.getElementById('moreMenu');
  const btn = document.getElementById('tab-btn-more');
  if(!menu) return;
  const open = (typeof force === 'boolean') ? force : menu.hidden;
  menu.hidden = !open;
  if(btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.body.classList.toggle('more-menu-open', open);
};

window.toggleAdvancedFilters = function(explicitState){
  const af = document.getElementById('advancedFilters');
  const btn = document.getElementById('btnToggleFilters');
  const scrim = document.getElementById('filtersScrim');
  if(!af) return;
  const isCurrentlyOpen = af.classList.contains('open');
  const nextState = typeof explicitState === 'boolean' ? explicitState : !isCurrentlyOpen;

  af.classList.toggle('open', nextState);
  if(scrim) scrim.classList.toggle('open', nextState);
  if(btn){
    btn.setAttribute('aria-expanded', nextState ? 'true' : 'false');
  }
};

window.resetFilters = function(){
  const na = document.getElementById('filter-navarea');
  const sv = document.getElementById('filter-severity');
  const ca = document.getElementById('filter-category');
  if (na) na.value = '';
  if (sv) sv.value = '';
  if (ca) ca.value = '';
  applyFilters();
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.body.classList.contains('map-focus-active')) {
      toggleMapFocusMode(false);
      return;
    }
    toggleAdvancedFilters(false);
    closeWarningModal();
    closeMapSettings();
    closeWarningDrawer();
  } else if ((e.key === 'f' || e.key === 'F') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) {
    const mapTab = document.getElementById('tab-map');
    if (mapTab && mapTab.classList.contains('active')) {
      toggleMapFocusMode();
    }
  }
});

// ═══════════ MAP & SPATIAL ENGINE ═══════════
let leafletMap = null;
let markerLayer = null;
let pointsLayer = null, polygonsLayer = null, circlesLayer = null, linesLayer = null;
let currentBaseLayer = null, osmBaseLayer = null, openSeaMapLayer = null, soundingsLayer = null;

const MAP_PREFERENCES_KEY = 'helm_map_preferences_v1';
const DEFAULT_MAP_PREFERENCES = {
  baseMap: 'osm',
  masterOverlays: true,
  overlays: {
    points: true,
    polygons: true,
    circles: true,
    lines: true,
    seamarks: true,
    soundings: false
  }
};

function loadMapPreferences() {
  try {
    const raw = localStorage.getItem(MAP_PREFERENCES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          baseMap: parsed.baseMap || 'osm',
          masterOverlays: parsed.masterOverlays !== false,
          overlays: { ...DEFAULT_MAP_PREFERENCES.overlays, ...(parsed.overlays || {}) }
        };
      }
    }
  } catch (e) {
    console.warn('Map preferences load notice:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_MAP_PREFERENCES));
}

function saveMapPreferences(prefs) {
  try {
    localStorage.setItem(MAP_PREFERENCES_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Map preferences save notice:', e);
  }
}

let mapPreferences = loadMapPreferences();
let currentBaseMapId = mapPreferences.baseMap || 'osm';
let currentSelectedNavArea = ''; // Default to Global View (All NAVAREAs)
// Map auto-fit state: the first data-driven fit must not animate, and data
// refreshes must never reposition a map the user is already looking at.
let mapFirstFitPending = true;
let lastFittedNavArea = null;

const BASE_MAP_DEFS = {
  'osm': {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors · OpenSeaMap'
  },
  'carto-voyager': {
    name: 'CARTO Voyager',
    url: '/api/tiles/carto/voyager/{z}/{x}/{y}',
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors · CARTO · OpenSeaMap'
  },
  'carto-dark': {
    name: 'CARTO Dark Matter',
    url: '/api/tiles/carto/dark_all/{z}/{x}/{y}',
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors · CARTO · OpenSeaMap'
  },
  'carto-positron': {
    name: 'CARTO Positron',
    url: '/api/tiles/carto/light_all/{z}/{x}/{y}',
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors · CARTO · OpenSeaMap'
  },
  'esri-ocean': {
    name: 'ESRI Ocean Base',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 13,
    attribution: 'Tiles © Esri — GEBCO, NOAA · OpenSeaMap'
  }
};

// ---- TILE ERROR DIAGNOSTICS (temporary - mobile zoom flicker investigation) ----
// Logs the first TILE_ERROR_LOG_LIMIT failing tile URLs per layer to the console,
// then suppresses detail so a flood of empty-sea 404s cannot spam mobile logs.
const TILE_ERROR_LOG_LIMIT = 20;
const tileErrorCounts = {};
function logTileError(layerName) {
  return function (ev) {
    tileErrorCounts[layerName] = (tileErrorCounts[layerName] || 0) + 1;
    const count = tileErrorCounts[layerName];
    if (count <= TILE_ERROR_LOG_LIMIT) {
      const url = (ev && ev.tile && ev.tile.src) ? ev.tile.src : 'unknown';
      console.warn('[tileerror] ' + layerName + ' #' + count + ': ' + url);
    } else if (count === TILE_ERROR_LOG_LIMIT + 1) {
      console.warn('[tileerror] ' + layerName + ': over ' + TILE_ERROR_LOG_LIMIT + ' errors, further detail suppressed');
    }
  };
}

const NAVAREA_CENTERS = {
  'NA I': { center: [56.0, 3.0], zoom: 5 },
  'NA II': { center: [28.0, -15.0], zoom: 4 },
  'NA III': { center: [36.0, 15.0], zoom: 5 },
  'NA IV': { center: [28.0, -75.0], zoom: 4 },
  'NA V': { center: [-20.0, -35.0], zoom: 4 },
  'NA VI': { center: [-45.0, -55.0], zoom: 4 },
  'NA VII': { center: [-35.0, 25.0], zoom: 4 },
  'NA VIII': { center: [10.0, 75.0], zoom: 4 },
  'NA IX': { center: [23.0, 58.0], zoom: 5 },
  'NA X': { center: [-22.0, 135.0], zoom: 4 },
  'NA XI': { center: [25.0, 130.0], zoom: 4 },
  'NA XII': { center: [20.0, -120.0], zoom: 4 },
  'NA XIII': { center: [50.0, 150.0], zoom: 4 },
  'NA XIV': { center: [-40.0, 175.0], zoom: 4 },
  'NA XV': { center: [-33.0, -80.0], zoom: 4 },
  'NA XVI': { center: [-10.0, -85.0], zoom: 4 },
  'NA XVII': { center: [72.0, -135.0], zoom: 3 },
  'NA XVIII': { center: [72.0, -75.0], zoom: 3 },
  'NA XIX': { center: [70.0, 15.0], zoom: 4 },
  'NA XX': { center: [75.0, 75.0], zoom: 3 },
  'NA XXI': { center: [75.0, 150.0], zoom: 3 }
};

function matchesNavArea(warnArea, targetArea) {
  if (!targetArea || targetArea === 'ALL' || targetArea === '') return true;
  if (!warnArea) return false;
  const normWarn = String(warnArea).trim().toUpperCase().replace(/^NAVAREA\s+/, '').replace(/^NA\s+/, '');
  const normTarget = String(targetArea).trim().toUpperCase().replace(/^NAVAREA\s+/, '').replace(/^NA\s+/, '');
  return normWarn === normTarget;
}

// A warning is "unscoped" when its navarea is not a real NAVAREA I..XXI
// (blank, Baltic, etc.). Unscoped warnings are scoped to the NAVAREA I
// view (the Baltic Sea lies in NAVAREA I waters) plus the Global view,
// instead of appearing in every regional view.
function isNavAreaUnscoped(warnArea) {
  const n = String(warnArea ?? '').trim().toUpperCase().replace(/^NAVAREA\s+/, '').replace(/^NA\s+/, '');
  return !/^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX|XXI)$/.test(n);
}

// Region-scope rule (maintainer decision 2026-11-07, supersedes the PR #133
// every-area rule): a warning belongs to the selected view when its
// navarea matches, or when it is unscoped AND the view is NAVAREA I.
// Baltic/blank warnings carry no NAVAREA numeral and the Baltic Sea lies
// in NAVAREA I waters, so they appear under NAVAREA I (and Global).
function inRegionScope(warnArea, targetArea) {
  if (!targetArea || targetArea === 'ALL' || targetArea === '') return true;
  if (matchesNavArea(warnArea, targetArea)) return true;
  return isNavAreaUnscoped(warnArea) && matchesNavArea('NA I', targetArea);
}

// ═══════════ CARTOGRAPHIC MATH HELPERS ═══════════
function computePolygonAreaSqNm(latLngs) {
  if (!Array.isArray(latLngs) || latLngs.length < 3) return 0;
  let area = 0;
  const numPoints = latLngs.length;
  for (let i = 0; i < numPoints; i++) {
    const j = (i + 1) % numPoints;
    const xi = latLngs[i][1] * 60 * Math.cos((latLngs[i][0] * Math.PI) / 180);
    const yi = latLngs[i][0] * 60;
    const xj = latLngs[j][1] * 60 * Math.cos((latLngs[j][0] * Math.PI) / 180);
    const yj = latLngs[j][0] * 60;
    area += xi * yj - xj * yi;
  }
  return Math.abs(Math.round(area / 2));
}

function computeCentroid(latLngs) {
  if (!Array.isArray(latLngs) || latLngs.length === 0) return [0, 0];
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;
  for (const pt of latLngs) {
    if (Array.isArray(pt) && !isNaN(pt[0]) && !isNaN(pt[1])) {
      sumLat += pt[0];
      sumLng += pt[1];
      count++;
    }
  }
  return count > 0 ? [sumLat / count, sumLng / count] : [0, 0];
}

function parseCoordinatesFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const coords = [];
  const coordRegex = /(\d{1,2})[-°](\d{1,2}(?:\.\d+)?)[ '"]*([NS])\s*(\d{1,3})[-°](\d{1,2}(?:\.\d+)?)[ '"]*([EW])/gi;
  let m;
  while ((m = coordRegex.exec(rawText)) !== null) {
    let lat = parseFloat(m[1]) + parseFloat(m[2]) / 60;
    if (m[3].toUpperCase() === 'S') lat = -lat;
    let lng = parseFloat(m[4]) + parseFloat(m[5]) / 60;
    if (m[6].toUpperCase() === 'W') lng = -lng;
    coords.push([lat, lng]);
  }
  return coords;
}

function getLeafletMap() {
  return leafletMap && typeof leafletMap.invalidateSize === 'function' ? leafletMap : null;
}

function initMap(){
  if (leafletMap && typeof leafletMap.invalidateSize === 'function') return;
  const mapEl = document.getElementById('map');
  if (!mapEl || typeof L === 'undefined') return;
  const isMob = document.body.classList.contains('is-mobile');
  // Start already positioned on the deep-linked / default NAVAREA: no
  // global-to-region jump on first load.
  const initArea = NAVAREA_CENTERS[currentSelectedNavArea];
  leafletMap = L.map('map', {
    center: initArea ? initArea.center : [20, 0],
    zoom: initArea ? initArea.zoom : (isMob ? 2 : 3),
    worldCopyJump: true,
    zoomControl: false,
    attributionControl: false,
    tap: true,
  });
  window.leafletMap = leafletMap;
  window.hwMap = leafletMap;
  window.map = leafletMap;

  // Base cartography layer (defaults to OpenStreetMap)
  const baseDef = BASE_MAP_DEFS[currentBaseMapId] || BASE_MAP_DEFS['osm'];
  currentBaseLayer = L.tileLayer(baseDef.url, {
    maxZoom: baseDef.maxZoom,
    attribution: baseDef.attribution,
    keepBuffer: 4,
    updateWhenZooming: false,
  }).addTo(leafletMap);
  currentBaseLayer.on('tileerror', logTileError('base:' + currentBaseMapId));
  osmBaseLayer = currentBaseLayer;

  // OpenSeaMap nautical seamarks overlay
  openSeaMapLayer = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
    maxZoom: 18,
    opacity: 1.0,
    keepBuffer: 4,
    updateWhenZooming: false,
    attribution: 'Map style: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a>'
  });
  openSeaMapLayer.on('tileerror', logTileError('seamarks'));
  if (mapPreferences.overlays.seamarks) {
    openSeaMapLayer.addTo(leafletMap);
  }

  // Ocean soundings overlay
  soundingsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',{
    attribution: 'Tiles &copy; Esri &mdash; NOAA, GEBCO',
    maxZoom: 13,
    keepBuffer: 4,
    updateWhenZooming: false
  });
  soundingsLayer.on('tileerror', logTileError('soundings'));
  if (mapPreferences.overlays.soundings) {
    soundingsLayer.addTo(leafletMap);
  }

  // Initialize polymorphic vector layer groups
  polygonsLayer = L.layerGroup();
  if (mapPreferences.overlays.polygons) polygonsLayer.addTo(leafletMap);

  circlesLayer = L.layerGroup();
  if (mapPreferences.overlays.circles) circlesLayer.addTo(leafletMap);

  linesLayer = L.layerGroup();
  if (mapPreferences.overlays.lines) linesLayer.addTo(leafletMap);

  pointsLayer = L.layerGroup();
  if (mapPreferences.overlays.points) pointsLayer.addTo(leafletMap);

  // Main warning group for backward compatibility
  markerLayer = L.layerGroup([polygonsLayer, circlesLayer, linesLayer, pointsLayer]);

  // Map canvas click clears touch selection, hides title card, and closes settings
  leafletMap.on('click', () => {
    clearActiveFeatureHighlight();
    hideTitleCard(true);
    closeMapSettings();
  });

  // Maximum Map View: Auto-collapse top controls on map interaction
  setupMapInteractionAutoCollapse(leafletMap);

  // Coordinate picker: live cursor readout + click-to-pin in degrees/decimal minutes
  setupCoordinatePicker(leafletMap);

  // Setup idle state detector for map controls
  setupControlsIdleDetector();

  // Setup swipe-down dismiss on title card
  setupTitleCardSwipeDismiss();

  syncSettingsUI(mapPreferences);
  filterMapByNavArea(currentSelectedNavArea);

  const attrEl = document.querySelector('.map-attribution');
  if (attrEl) {
    attrEl.textContent = baseDef.attribution;
  }
}

// ═══════════ MAXIMUM MAP VIEW & FOCUS MODE ═══════════
let mapControlsAutoCollapseTimer = null;
let controlsIdleTimer = null;

window.openNavAreaPicker = function () {
  dismissNavAreaHint();                       // user found it, so hide the tooltip
  const s = document.getElementById('mapNavAreaSelect');
  const section = document.getElementById('mapTopSection');
  if (!s || !section) return;

  const wasCollapsed = section.classList.contains('collapsed');
  toggleMapTopControls(true);                 // expand so the select is rendered

  // If it started collapsed, collapse it again once the user picks or leaves
  const restore = () => {
    s.removeEventListener('change', restore);
    s.removeEventListener('blur', restore);
    if (wasCollapsed) toggleMapTopControls(false);
  };
  s.addEventListener('change', restore);
  s.addEventListener('blur', restore);

  // Wait for the expand transition, or the picker can open in the wrong place
  setTimeout(() => {
    try { s.showPicker(); }
    catch (err) { s.focus(); }               // older browsers: select is visible and focused
  }, 250);
};

// ═══════════ NAVAREA PICKER HINT (one-time tooltip) ═══════════
let navAreaHintEl = null, navAreaHintTimer = null;
function dismissNavAreaHint() {
  if (navAreaHintTimer) { clearTimeout(navAreaHintTimer); navAreaHintTimer = null; }
  if (navAreaHintEl) { navAreaHintEl.remove(); navAreaHintEl = null; }
  try { localStorage.setItem('hw-navarea-hint', '1'); } catch (e) { /* private mode */ }
}
function maybeShowNavAreaHint() {
  try { if (localStorage.getItem('hw-navarea-hint')) return; } catch (e) { return; }
  const chip = document.getElementById('mapControlsChip');
  const container = document.querySelector('.map-container');
  if (!chip || !container) return;
  navAreaHintEl = document.createElement('div');
  navAreaHintEl.className = 'navarea-hint';
  navAreaHintEl.setAttribute('role', 'status');
  navAreaHintEl.textContent = 'Tap to switch NAVAREA';
  container.appendChild(navAreaHintEl);
  const r = chip.getBoundingClientRect(), c = container.getBoundingClientRect();
  navAreaHintEl.style.left = Math.max(8, r.left - c.left) + 'px';
  navAreaHintEl.style.top = (r.bottom - c.top + 6) + 'px';
  navAreaHintTimer = setTimeout(dismissNavAreaHint, 6000);
}

// Store the visible screen height in a CSS variable, so the mobile map fits above browser toolbars.
function setAppHeight() {
  // visualViewport is the area the user can actually see; fall back to the window height.
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-h', h + 'px');
}
setAppHeight();
if (window.visualViewport) window.visualViewport.addEventListener('resize', setAppHeight);
window.addEventListener('resize', setAppHeight);
window.toggleMapTopControls = function(forceState) {
  const topSec = document.getElementById('mapTopSection');
  const chip = document.getElementById('mapControlsChip');
  if (!topSec) return;

  const willBeCollapsed = typeof forceState === 'boolean'
    ? !forceState
    : !topSec.classList.contains('collapsed');

  topSec.classList.toggle('collapsed', willBeCollapsed);
  if (chip) {
    chip.classList.toggle('is-expanded', !willBeCollapsed);
    chip.setAttribute('aria-expanded', willBeCollapsed ? 'false' : 'true');
  }

  // Trigger leaflet map resize after smooth layout expansion
  const m = getLeafletMap();
  if (m) {
    setTimeout(() => m.invalidateSize(), 160);
    setTimeout(() => m.invalidateSize(), 320);
  }
};

window.toggleMapFocusMode = function(explicitState) {
  const isCurrentlyActive = document.body.classList.contains('map-focus-active');
  const nextState = typeof explicitState === 'boolean' ? explicitState : !isCurrentlyActive;
  
  document.body.classList.toggle('map-focus-active', nextState);
  
  const iconMax = document.getElementById('iconMapFocusMax');
  const iconMin = document.getElementById('iconMapFocusMin');
  const btn = document.getElementById('btnMapFocus');
  if (iconMax && iconMin) {
    iconMax.style.display = nextState ? 'none' : 'block';
    iconMin.style.display = nextState ? 'block' : 'none';
  }
  if (btn) {
    btn.classList.toggle('active', nextState);
    btn.setAttribute('aria-pressed', nextState ? 'true' : 'false');
    btn.setAttribute('aria-label', nextState ? 'Exit focus mode' : 'Maximize map view full screen');
    btn.title = nextState ? 'Exit Focus Mode (Esc)' : 'Maximize Map View (Focus Mode)';
  }

  // Auto-collapse top controls in focus mode
  if (nextState) {
    toggleMapTopControls(false);
  }

  const m = getLeafletMap();
  if (m) {
    m.invalidateSize();
    setTimeout(() => m.invalidateSize(), 150);
  }

  showToast(nextState ? 'Focus Mode active (Press Esc to exit)' : 'Exited Focus Mode');
};

function setupMapInteractionAutoCollapse(mapInstance) {
  if (!mapInstance) return;
  const triggerAutoCollapse = () => {
    const topSec = document.getElementById('mapTopSection');
    if (!topSec || topSec.classList.contains('collapsed')) return;

    if (mapControlsAutoCollapseTimer) clearTimeout(mapControlsAutoCollapseTimer);
    mapControlsAutoCollapseTimer = setTimeout(() => {
      toggleMapTopControls(false);
    }, 2500);
  };

  mapInstance.on('movestart zoomstart dragstart', triggerAutoCollapse);
}

function setupControlsIdleDetector() {
  const mapContainer = document.querySelector('.map-container');
  const ctrlGroup = document.querySelector('.map-ctrl-topright');
  if (!mapContainer || !ctrlGroup) return;

  const wakeControls = () => {
    ctrlGroup.classList.remove('is-idle');
    if (controlsIdleTimer) clearTimeout(controlsIdleTimer);
    controlsIdleTimer = setTimeout(() => {
      const popover = document.getElementById('mapSettingsPopover');
      if (!popover || !popover.classList.contains('open')) {
        ctrlGroup.classList.add('is-idle');
      }
    }, 4000);
  };

  mapContainer.addEventListener('mousemove', wakeControls, { passive: true });
  mapContainer.addEventListener('touchstart', wakeControls, { passive: true });
  mapContainer.addEventListener('pointermove', wakeControls, { passive: true });
  wakeControls();
}

function setupTitleCardSwipeDismiss() {
  const card = document.getElementById('mapTitleCard');
  if (!card) return;
  let startY = 0;
  let isSwiping = false;

  card.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      startY = e.touches[0].clientY;
      isSwiping = true;
    }
  }, { passive: true });

  card.addEventListener('touchmove', (e) => {
    if (!isSwiping || e.touches.length !== 1) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 25) {
      isSwiping = false;
      hideTitleCard(true);
      clearActiveFeatureHighlight();
    }
  }, { passive: true });

  card.addEventListener('touchend', () => {
    isSwiping = false;
  }, { passive: true });
}

// ═══════════ SETTINGS CONTROLLERS & PERSISTENCE ═══════════
window.syncSettingsUI = function(prefs) {
  if (!prefs) prefs = mapPreferences;
  document.querySelectorAll('input[name="basemap-desktop"]').forEach(r => {
    r.checked = (r.value === prefs.baseMap);
  });
  document.querySelectorAll('input[name="basemap-mobile"]').forEach(r => {
    r.checked = (r.value === prefs.baseMap);
  });

  const keys = ['points', 'polygons', 'circles', 'lines', 'seamarks', 'soundings'];
  keys.forEach(k => {
    const cap = k.charAt(0).toUpperCase() + k.slice(1);
    const dBox = document.getElementById(`layerToggle${cap}Desktop`);
    if (dBox) dBox.checked = !!prefs.overlays[k];
    const mBox = document.getElementById(`layerToggle${cap}Mobile`);
    if (mBox) mBox.checked = !!prefs.overlays[k];
  });

  const masterBtnDesk = document.getElementById('masterToggleBtnDesktop');
  if (masterBtnDesk) {
    masterBtnDesk.textContent = prefs.masterOverlays ? '[ON]' : '[OFF]';
    masterBtnDesk.classList.toggle('off', !prefs.masterOverlays);
    masterBtnDesk.setAttribute('aria-pressed', String(!!prefs.masterOverlays));
  }
  const masterBtnMob = document.getElementById('masterToggleBtnMobile');
  if (masterBtnMob) {
    masterBtnMob.textContent = prefs.masterOverlays ? '[ON]' : '[OFF]';
    masterBtnMob.classList.toggle('off', !prefs.masterOverlays);
    masterBtnMob.setAttribute('aria-pressed', String(!!prefs.masterOverlays));
  }
};

window.toggleMapSettings = function(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  if (window.__gearLongPressed) {
    window.__gearLongPressed = false;
    return;
  }
  const isMob = document.body.classList.contains('is-mobile');
  const btn = document.getElementById('btnMapSettings');

  if (isMob) {
    const sheet = document.getElementById('mapSettingsSheet');
    const scrim = document.getElementById('mapSettingsScrim');
    if (!sheet) return;
    const isOpen = sheet.classList.toggle('open');
    if (scrim) scrim.classList.toggle('open', isOpen);
    if (btn) {
      btn.classList.toggle('active', isOpen);
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
  } else {
    const pop = document.getElementById('mapSettingsPopover');
    if (!pop) return;
    const isOpen = pop.classList.toggle('open');
    if (btn) {
      btn.classList.toggle('active', isOpen);
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
  }
};

window.closeMapSettings = function() {
  const pop = document.getElementById('mapSettingsPopover');
  if (pop) pop.classList.remove('open');
  const sheet = document.getElementById('mapSettingsSheet');
  if (sheet) sheet.classList.remove('open');
  const scrim = document.getElementById('mapSettingsScrim');
  if (scrim) scrim.classList.remove('open');
  const btn = document.getElementById('btnMapSettings');
  if (btn) {
    btn.classList.remove('active');
    btn.setAttribute('aria-expanded', 'false');
  }
};

window.toggleMasterOverlays = function() {
  const nextState = !mapPreferences.masterOverlays;
  mapPreferences.masterOverlays = nextState;

  const keys = ['points', 'polygons', 'circles', 'lines', 'seamarks', 'soundings'];
  if (!nextState) {
    keys.forEach(k => {
      mapPreferences.overlays[k] = false;
      window.toggleLayer(k, false, false);
    });
  } else {
    keys.forEach(k => {
      const enable = k !== 'soundings';
      mapPreferences.overlays[k] = enable;
      window.toggleLayer(k, enable, false);
    });
  }

  saveMapPreferences(mapPreferences);
  syncSettingsUI(mapPreferences);
};

window.resetMapSettingsToDefaults = function() {
  mapPreferences = JSON.parse(JSON.stringify(DEFAULT_MAP_PREFERENCES));
  saveMapPreferences(mapPreferences);

  window.selectBaseMap('osm');

  const m = getLeafletMap();
  if (m) {
    if (pointsLayer && !m.hasLayer(pointsLayer)) pointsLayer.addTo(m);
    if (polygonsLayer && !m.hasLayer(polygonsLayer)) polygonsLayer.addTo(m);
    if (circlesLayer && !m.hasLayer(circlesLayer)) circlesLayer.addTo(m);
    if (linesLayer && !m.hasLayer(linesLayer)) linesLayer.addTo(m);
    if (openSeaMapLayer && !m.hasLayer(openSeaMapLayer)) openSeaMapLayer.addTo(m);
    if (soundingsLayer && m.hasLayer(soundingsLayer)) m.removeLayer(soundingsLayer);
  }

  syncSettingsUI(mapPreferences);
  showToast('Map settings reset to defaults');
};

function attachGearLongPress() {
  const btn = document.getElementById('btnMapSettings');
  if (!btn) return;
  let timer = null;
  let longPressed = false;

  const startPress = () => {
    longPressed = false;
    timer = setTimeout(() => {
      longPressed = true;
      window.__gearLongPressed = true;
      resetMapSettingsToDefaults();
      btn.classList.add('active');
      setTimeout(() => btn.classList.remove('active'), 500);
      setTimeout(() => { window.__gearLongPressed = false; }, 350);
    }, 500);
  };

  const cancelPress = (e) => {
    if (timer) clearTimeout(timer);
    if (longPressed && e) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  btn.addEventListener('mousedown', startPress);
  btn.addEventListener('touchstart', startPress, { passive: true });
  btn.addEventListener('mouseup', cancelPress);
  btn.addEventListener('touchend', cancelPress);
  btn.addEventListener('mouseleave', cancelPress);
  btn.addEventListener('touchcancel', cancelPress);
}

// ═══════════ PROGRESSIVE DISCLOSURE STATE & CONTROLLERS ═══════════
let activeTouchFeature = null;
let activeHighlightedLayer = null;
let currentDrawerWarning = null;

function clearActiveFeatureHighlight() {
  if (activeHighlightedLayer) {
    if (typeof activeHighlightedLayer.setStyle === 'function') {
      const origWeight = activeHighlightedLayer._origWeight || 2;
      const origColor = activeHighlightedLayer._origColor || '#2563eb';
      activeHighlightedLayer.setStyle({ weight: origWeight, color: origColor });
    }
    if (activeHighlightedLayer._icon) {
      activeHighlightedLayer._icon.classList.remove('nw-active-selected');
    }
  }
  activeHighlightedLayer = null;
  activeTouchFeature = null;
}

function showTitleCard(w, summaryText, mouseEvent, pillColor) {
  const card = document.getElementById('mapTitleCard');
  const textEl = document.getElementById('titleCardText');
  const pillEl = document.getElementById('titleCardPill');
  const hintEl = document.getElementById('titleCardHint');
  if (!card || !textEl) return;

  const isMob = document.body.classList.contains('is-mobile');
  const wid = w.canonical_id || w.warning_id || w.id || 'Notice';
  let cleanSummary = summaryText || '';
  if (cleanSummary.startsWith(wid)) {
    cleanSummary = cleanSummary.slice(wid.length).replace(/^[\s·—–:-]+/, '');
  }
  textEl.textContent = cleanSummary ? `${wid} · ${cleanSummary}` : wid;
  if (pillEl) {
    pillEl.style.background = pillColor || getWarningColor(w);
  }
  if (hintEl) {
    hintEl.style.display = isMob ? 'inline' : 'none';
  }

  card.classList.add('show');
  card.setAttribute('aria-hidden', 'false');

  if (!isMob && mouseEvent) {
    const mapContainer = document.querySelector('.map-container');
    const rect = mapContainer ? mapContainer.getBoundingClientRect() : { left: 0, top: 0 };
    const x = mouseEvent.clientX - rect.left + 16;
    const y = mouseEvent.clientY - rect.top - 20;
    const maxX = (mapContainer?.clientWidth || 800) - 280;
    const maxY = (mapContainer?.clientHeight || 600) - 50;
    card.style.left = `${Math.max(12, Math.min(x, maxX))}px`;
    card.style.top = `${Math.max(12, Math.min(y, maxY))}px`;
    card.style.bottom = 'auto';
    card.style.right = 'auto';
  }
}

function hideTitleCard(force = false) {
  if (!force && document.body.classList.contains('is-mobile') && activeTouchFeature) {
    return;
  }
  const card = document.getElementById('mapTitleCard');
  if (card) {
    card.classList.remove('show');
    card.setAttribute('aria-hidden', 'true');
  }
}
window.hideTitleCard = hideTitleCard;

window.handleTitleCardClick = function() {
  if (activeTouchFeature) {
    openWarningDetails(activeTouchFeature);
  } else if (currentDrawerWarning) {
    openWarningDetails(currentDrawerWarning);
  }
};

// C4: remember the element that opened the details drawer so focus can
// be restored to it when the drawer closes.
let drawerTriggerElement = null;

window.openWarningDetails = function(w) {
  currentDrawerWarning = w;
  currentWarning = w;
  const isMob = document.body.classList.contains('is-mobile');
  if (isMob) {
    if (typeof openWarningModal === 'function') {
      openWarningModal(w);
    }
    return;
  }

  // Desktop Side Drawer
  const drawer = document.getElementById('warningDetailsDrawer');
  const body = document.getElementById('drawerDetailsBody');
  const titleEl = document.getElementById('drawerDetailsTitle');
  if (!drawer || !body) return;

  const wid = w.canonical_id || w.warning_id || w.id || 'Notice';
  const navarea = w.navarea || 'NAVAREA';
  const color = getWarningColor(w);
  const issuedText = formatWarningIssuedText(w);
  const text = getBulletinText(w) || w.raw_text || 'No raw bulletin text provided.';
  const cats = Array.isArray(w.categories) ? w.categories.join(' · ') : (w.category || 'General');

  if (titleEl) {
    titleEl.textContent = `${wid} — ${navarea}`;
  }

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <span class="badge-simple" style="background:${color}18;color:${color};font-weight:var(--w-hero, 500)">
        <span class="dot" style="background:${color}"></span> ${(w.severity || 'ACTIVE').toUpperCase()}
      </span>
      <span class="badge-simple badge-neutral">${cats.toUpperCase()}</span>
      <span class="badge-simple ${w.is_verified ? 'badge-verified' : 'badge-neutral'}">${w.is_verified ? 'VERIFIED' : 'ACTIVE'}</span>
    </div>

    <div>
      <div style="font-size:11px;font-weight:var(--w-hero, 500);text-transform:uppercase;color:var(--ink-secondary, var(--text-muted));letter-spacing:0.5px">Area / Subject</div>
      <div style="font-weight:var(--w-hero, 500);font-size:14px;color:var(--ink-primary, var(--text));margin-top:2px">${w.title || w.area_text || wid}</div>
      ${w.area_text && w.area_text !== w.title ? `<div style="font-size:12px;color:var(--ink-secondary, var(--text-muted));margin-top:2px">${w.area_text}</div>` : ''}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;background:var(--surface-subtle);padding:10px 12px;border-radius:6px;border:1px solid var(--border-input)">
      <div>
        <div style="font-size:10px;font-weight:var(--w-hero, 500);color:var(--ink-secondary, var(--text-muted));text-transform:uppercase">Issued</div>
        <div style="font-weight:var(--w-hero, 500);color:var(--ink-body, var(--text));font-family:ui-monospace,monospace">${issuedText}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:var(--w-hero, 500);color:var(--ink-secondary, var(--text-muted));text-transform:uppercase">Coordinates</div>
        <div style="font-weight:var(--w-hero, 500);color:var(--ink-body, var(--text));font-family:ui-monospace,monospace">${warningPositionText(w, 'Spatial Vector')}</div>
      </div>
    </div>

    <div>
      <div style="font-size:11px;font-weight:var(--w-hero, 500);text-transform:uppercase;color:var(--ink-secondary, var(--text-muted));letter-spacing:0.5px;margin-bottom:6px">Raw Bulletin Text</div>
      <div class="warning-expanded-text" style="max-height:280px">${text}</div>
    </div>
  `;

  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  drawerTriggerElement = document.activeElement;
  const drawerCloseBtn = drawer.querySelector('.settings-close-btn') || drawer.querySelector('button');
  if (drawerCloseBtn) setTimeout(() => drawerCloseBtn.focus(), 50);
};

window.closeWarningDrawer = function() {
  const drawer = document.getElementById('warningDetailsDrawer');
  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }
  if (drawerTriggerElement && typeof drawerTriggerElement.focus === 'function') {
    drawerTriggerElement.focus();
  }
  drawerTriggerElement = null;
};

window.copyCurrentWarningText = function() {
  if (!currentDrawerWarning) return;
  const text = getBulletinText(currentDrawerWarning) || currentDrawerWarning.raw_text || '';
  if (!text) {
    showToast('No bulletin text available to copy');
    return;
  }
  const done = () => showToast('Warning bulletin copied to clipboard');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      fallbackCopyText(text, done);
    });
  } else {
    fallbackCopyText(text, done);
  }
};

function fallbackCopyText(text, callback) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (typeof callback === 'function') callback();
  } catch (_) {
    showToast('Failed to copy text to clipboard');
  }
}

function bindProgressiveFeatureInteractions(layer, w, summaryText, color) {
  const wid = w.canonical_id || w.warning_id || w.id;
  layer._origWeight = layer.options?.weight || 2;
  layer._origColor = color;

  // Desktop Hover
  layer.on('mouseover', (e) => {
    if (document.body.classList.contains('is-mobile')) return;
    if (typeof layer.setStyle === 'function') {
      layer.setStyle({ weight: (layer._origWeight || 2) + 1.5, opacity: 1.0 });
    }
    if (layer._icon) {
      layer._icon.classList.add('nw-active-selected');
    }
    showTitleCard(w, summaryText, e.originalEvent, color);
  });

  layer.on('mousemove', (e) => {
    if (document.body.classList.contains('is-mobile')) return;
    showTitleCard(w, summaryText, e.originalEvent, color);
  });

  layer.on('mouseout', () => {
    if (document.body.classList.contains('is-mobile')) return;
    if (typeof layer.setStyle === 'function') {
      layer.setStyle({ weight: layer._origWeight, opacity: 0.95 });
    }
    if (layer._icon) {
      layer._icon.classList.remove('nw-active-selected');
    }
    hideTitleCard();
  });

  // Click / Touch
  layer.on('click', (e) => {
    L.DomEvent.stopPropagation(e);
    const isMob = document.body.classList.contains('is-mobile');

    if (isMob) {
      clearActiveFeatureHighlight();
      activeTouchFeature = w;
      activeHighlightedLayer = layer;
      if (typeof layer.setStyle === 'function') {
        layer.setStyle({ weight: (layer._origWeight || 2) + 2, color: '#38bdf8' });
      }
      if (layer._icon) {
        layer._icon.classList.add('nw-active-selected');
      }
      hideTitleCard(true);
    }

    openWarningDetails(w);
  });
}

// ═══════════ POLYMORPHIC PLOTTING ENGINE ═══════════
function getWarningCategories(w) {
  if (Array.isArray(w?.categories)) return w.categories.map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
  if (typeof w?.categories === 'string' && w.categories.trim()) return [w.categories.trim().toLowerCase()];
  return [String(w?.category || w?.hazard_category || '').trim().toLowerCase()].filter(Boolean);
}

function getWarningSeverity(w) {
  if (['critical', 'high', 'moderate'].includes(w?.severity)) return w.severity;
  const text = [w?.title, w?.raw_text, w?.category].filter(Boolean).join(' ').toUpperCase();
  const cats = getWarningCategories(w);
  if (
    /\b(DRIFTING MINE|SEA MINE|DISTRESS ALERT|SEARCH AND RESCUE|MAN OVERBOARD|PERSON OVERBOARD|GUNNERY|FIRING EXERCISE|MILITARY FIRING|MISSILE FIRING|NAVAL FIRING|ROCKET LAUNCH|TSUNAMI|CYCLONE|TYPHOON|HURRICANE)\b/i.test(text) ||
    cats.some(category => ['sar', 'mil_fire', 'weather'].includes(category))
  ) return 'critical';
  if (
    /\b(UNEXPLODED ORDNANCE|ORDNANCE DISPOSAL|EXPLOSIVE ORDNANCE|SECURITY ADVISORY|PIRACY|SUSPICIOUS SKIFF|ATTACK|BOARDED|DERELICT|ADRIFT|DRIFTING VESSEL|DRIFTING BARGE|DRIFTING CONTAINER|ICEBERG|SEA ICE|DANGEROUS WRECK|SUNKEN WRECK|SUBMERGED OBSTRUCTION|COLLISION|UNLIT|DAMAGED|DESTROYED|OFF STATION|UNDER TOW|ALERT)\b/i.test(text) ||
    cats.some(category => ['uxo', 'security', 'drift', 'drifting', 'ice', 'wreck'].includes(category))
  ) return 'high';
  if (cats.includes('aton') && /\b(UNLIT|DAMAGED|DESTROYED|OFF STATION|WITHDRAWN)\b/i.test(text)) return 'high';
  if (cats.includes('rig') && /\b(ALERT|UNDER TOW|ADRIFT)\b/i.test(text)) return 'high';
  return 'moderate';
}

function getWarningColor(w) {
  const severity = getWarningSeverity(w);
  if (severity === 'critical') return '#B42318';
  if (severity === 'high') return '#8C5208';
  return '#2F6B4F';
}

function getWarningPrimarySymbol(w) {
  const aliases = {
    mil_fire: 'military', uxo: 'military', military: 'military', military_ops: 'military', 'mines area': 'military',
    drift: 'drifting', drifting: 'drifting',
    aton: 'aton',
    cable: 'cable', survey: 'subsea', rig: 'subsea', subsea: 'subsea', offshore: 'subsea', 'drilling operations': 'subsea',
    wreck: 'wreck',
    sar: 'general', weather: 'general', ice: 'general', ops: 'general', service_status: 'general',
    general_chart: 'general', general: 'general', electronic: 'general', restricted: 'general', 'in force': 'general'
  };
  const category = getWarningCategories(w)[0] || 'general';
  return aliases[category] || 'general';
}

const WARNING_SYMBOL_SVG = {
  general: '<polygon points="12,2 14.5,9.5 22,12 14.5,14.5 12,22 9.5,14.5 2,12 9.5,9.5" fill="currentColor"/>',
  military: '<circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.8" fill="none"/><line x1="12" y1="2" x2="12" y2="7" stroke="currentColor" stroke-width="2"/><line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="2"/><line x1="2" y1="12" x2="7" y2="12" stroke="currentColor" stroke-width="2"/><line x1="17" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
  drifting: '<path d="M3 15 L21 15 L18 19 L6 19 Z" fill="currentColor"/><path d="M12 4 L12 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 6 L17 10 L12 11 Z" fill="currentColor"/>',
  aton: '<polygon points="9,20 15,20 13,8 11,8" stroke="currentColor" stroke-width="1.5" fill="currentColor"/><rect x="10" y="5" width="4" height="3" fill="currentColor"/><polygon points="12,2 8,5 16,5" fill="currentColor"/><line x1="4" y1="6" x2="7" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="20" y1="6" x2="17" y2="7" stroke="currentColor" stroke-width="1.5"/>',
  subsea: '<line x1="7" y1="19" x2="10" y2="7" stroke="currentColor" stroke-width="1.8"/><line x1="17" y1="19" x2="14" y2="7" stroke="currentColor" stroke-width="1.8"/><line x1="7" y1="15" x2="17" y2="15" stroke="currentColor" stroke-width="1.5"/><line x1="9" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="5" width="8" height="2.5" fill="currentColor"/><line x1="12" y1="2" x2="12" y2="5" stroke="currentColor" stroke-width="2"/>',
  cable: '<circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M4 17 Q8 10 12 12 T20 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  wreck: '<line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" stroke-width="2"/><path d="M6 18 Q12 12 18 18" stroke="currentColor" stroke-width="2" fill="none"/><line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" stroke-width="2"/><line x1="9" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="2"/>'
};

function createWarningMarkerIcon(w) {
  const symbol = getWarningPrimarySymbol(w);
  const severityColor = getWarningColor(w);
  const html = '<div role="img" aria-label="' + symbol + ' warning" title="' + symbol + ' warning" ' +
    'style="width:26px;height:26px;border-radius:50%;background:' + severityColor + ';border:1.5px solid #111827;' +
    'color:#fff;display:flex;align-items:center;justify-content:center;box-sizing:border-box;box-shadow:0 0 0 1px rgba(255,255,255,.95),0 2px 6px rgba(0,0,0,.45)">' +
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    WARNING_SYMBOL_SVG[symbol] + '</svg></div>';
  return L.divIcon({ className: 'nw-public-warning-marker', html, iconSize: [26, 26], iconAnchor: [13, 13] });
}

function buildPopupHtml(w, label, geomType) {
  const wid = w.canonical_id || w.warning_id || w.id;
  const color = getWarningColor(w);
  const safeTitle = (w.title || wid).replace(/"/g, '&quot;');
  const typeBadge = geomType ? `<span style="font-size:10px;text-transform:uppercase;background:#f1f5f9;color:#475569;padding:1px 5px;border-radius:4px;margin-left:auto">${geomType}</span>` : '';
  const dateStr = formatWarningDate(w);

  return `
    <div style="font-family:system-ui;font-size:13px;min-width:210px;line-height:1.4">
      <div style="font-weight:700;display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};flex-shrink:0"></span>
        <span style="white-space:nowrap">${wid} · ${w.navarea}</span>
        ${typeBadge}
      </div>
      <div style="margin-top:5px;font-weight:600;color:var(--text);font-size:12px">${safeTitle}</div>
      ${label ? `<div style="margin-top:3px;color:var(--text-muted);font-size:11px">${label}</div>` : ''}
      <div style="margin-top:3px;color:var(--text-light);font-size:11px">Issued: ${dateStr}</div>
      <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:6px">
        <button type="button" class="btn btn-sm btn-primary" style="font-size:11px;padding:2px 8px;min-height:26px" onclick="openWarningDetails(warnings.find(x => (x.canonical_id === '${encodeURIComponent(wid)}' || x.warning_id === '${encodeURIComponent(wid)}' || x.id === '${encodeURIComponent(wid)}')) || currentDrawerWarning)">
          View Details
        </button>
      </div>
    </div>
  `;
}

function plotWarning(w) {
  if (typeof L === 'undefined') return;
  const isMobile = document.body.classList.contains('is-mobile');
  const color = getWarningColor(w);
  const wid = w.canonical_id || w.warning_id || w.id;
  const categories = getWarningCategories(w);
  const isCableRoute = categories.includes('cable');
  const isRestrictedArea = categories.includes('restricted');
  const isMilitary = getWarningSeverity(w) === 'critical';

  w._layers = [];
  w._bounds = null;
  const allCoordsForBounds = [];

  // 1. Gather all geometry definitions
  let geoms = [];
  if (Array.isArray(w.geometries) && w.geometries.length > 0) {
    geoms = w.geometries;
  } else if (w.spatial?.geometries && Array.isArray(w.spatial.geometries) && w.spatial.geometries.length > 0) {
    geoms = w.spatial.geometries.map(g => ({
      feature_type: g.type,
      geojson_blob: { type: g.type, coordinates: g.coordinates },
      buffer_nm: g.buffer_nm || 0,
      zone_label: g.label || w.title || wid,
    }));
  } else if (w.geojson_blob && typeof w.geojson_blob === 'object') {
    geoms = [{
      feature_type: w.feature_type || w.geojson_blob.type,
      geojson_blob: w.geojson_blob,
      buffer_nm: w.buffer_nm || 0,
      zone_label: w.title || wid,
    }];
  }


  // 2. Render each geometry with appropriate cartographic geometry
  for (const geom of geoms) {
    const blob = geom.geojson_blob;
    if (!blob) continue;
    const featType = (geom.feature_type || blob.type || '').toUpperCase();
    const label = geom.zone_label || w.title || wid;
    const bufferNm = Number(geom.buffer_nm) || Number(geom.corridor_half_width_nm) || 0;

    // A. POLYGON / AREA
    if (featType === 'POLYGON' || blob.type === 'Polygon' || featType === 'MULTIPOLYGON' || blob.type === 'MultiPolygon') {
      try {
        let rings = [];
        if (blob.type === 'Polygon') {
          rings = blob.coordinates.map(ring => ring.map(([lng, lat]) => [lat, lng]));
        } else if (blob.type === 'MultiPolygon') {
          rings = blob.coordinates.map(poly => poly[0].map(([lng, lat]) => [lat, lng]));
        }

        rings.forEach(latLngs => {
          if (!Array.isArray(latLngs) || latLngs.length < 3) return;
          latLngs.forEach(c => allCoordsForBounds.push(c));

          const areaSqNm = computePolygonAreaSqNm(latLngs);
          const centroid = computeCentroid(latLngs);

          const poly = L.polygon(latLngs, {
            // Restricted-area boundary is S-52-informed; severity remains in the fill.
            color: isRestrictedArea ? '#D946EF' : color,
            weight: 2,
            opacity: 0.95,
            fillColor: color,
            fillOpacity: 0.22,
            dashArray: isMilitary ? '6, 6' : undefined,
          });

          const summaryText = `${label} · Area: ${areaSqNm} sq NM`;
          bindProgressiveFeatureInteractions(poly, w, summaryText, color);

          if (polygonsLayer) polygonsLayer.addLayer(poly);
          w._layers.push(poly);
          if (!w._primaryLayer) w._primaryLayer = poly;
        });
      } catch (polyErr) {
        console.warn('Polygon plot notice:', polyErr);
      }
    }

    // B. SAFETY CIRCLE / CLEARANCE RADIUS
    else if ((featType === 'POINT' || blob.type === 'Point' || featType === 'CIRCLE' || blob.type === 'Circle') && bufferNm > 0) {
      try {
        const centerLng = blob.coordinates[0];
        const centerLat = blob.coordinates[1];
        if (isNaN(centerLat) || isNaN(centerLng)) continue;

        const center = [centerLat, centerLng];
        allCoordsForBounds.push(center);
        const radiusMeters = bufferNm * 1852;
        const isRigCircle = geom.is_rig || /RIG|PLATFORM|MODU|DRILLSHIP/i.test(label) || /RIG|PLATFORM/i.test(w.category || '');
        const circleColor = isRigCircle ? '#059669' : color;

        const circle = L.circle(center, {
          color: circleColor,
          weight: 2,
          opacity: 0.95,
          fillColor: circleColor,
          fillOpacity: 0.16,
          dashArray: '4, 4',
          radius: radiusMeters,
        });

        const radiusStr = bufferNm >= 1 ? `${bufferNm} NM` : `${Math.round(bufferNm * 1852)}m`;
        const summaryText = `${label} · Safety Clearance: ${radiusStr}`;
        bindProgressiveFeatureInteractions(circle, w, summaryText, circleColor);

        if (circlesLayer) circlesLayer.addLayer(circle);
        w._layers.push(circle);
        if (!w._primaryLayer) w._primaryLayer = circle;

        // Center crosshair
        const centerCrosshair = L.circleMarker(center, {
          radius: isMobile ? 5 : 4,
          fillColor: circleColor,
          color: '#ffffff',
          weight: 1.5,
          fillOpacity: 1.0,
        });
        bindProgressiveFeatureInteractions(centerCrosshair, w, summaryText, circleColor);
        if (circlesLayer) circlesLayer.addLayer(centerCrosshair);
        w._layers.push(centerCrosshair);
      } catch (circErr) {
        console.warn('Circle plot notice:', circErr);
      }
    }

    // C. CORRIDOR / LINE / TRACK
    else if (featType === 'LINE' || blob.type === 'LineString' || featType === 'CORRIDOR' || blob.type === 'MultiLineString') {
      try {
        let lines = [];
        if (blob.type === 'LineString') {
          lines = [blob.coordinates.map(([lng, lat]) => [lat, lng])];
        } else if (blob.type === 'MultiLineString') {
          lines = blob.coordinates.map(line => line.map(([lng, lat]) => [lat, lng]));
        }

        lines.forEach(latLngs => {
          if (!Array.isArray(latLngs) || latLngs.length < 2) return;
          latLngs.forEach(c => allCoordsForBounds.push(c));

          const summaryText = bufferNm > 0 ? `${label} · Swath: ${bufferNm * 2} NM` : `${label} · Track Corridor`;

          // Wide translucent corridor swath underlay if corridor has half width
          if (bufferNm > 0) {
            const swath = L.polyline(latLngs, {
              color: isCableRoute ? '#D946EF' : '#06b6d4',
              weight: Math.min(24, Math.max(8, bufferNm * 6)),
              opacity: 0.25,
            });
            bindProgressiveFeatureInteractions(swath, w, summaryText, '#06b6d4');
            if (linesLayer) linesLayer.addLayer(swath);
            w._layers.push(swath);
          }

          // Cable routes use a chart-familiar magenta line; geometry is unchanged.
          const mainLine = L.polyline(latLngs, {
            color: isCableRoute ? '#D946EF' : '#0891b2',
            weight: 3,
            opacity: 0.95,
            dashArray: '6, 4',
          });

          bindProgressiveFeatureInteractions(mainLine, w, summaryText, '#0891b2');

          if (linesLayer) linesLayer.addLayer(mainLine);
          w._layers.push(mainLine);
          if (!w._primaryLayer) w._primaryLayer = mainLine;

          // Termini markers (A and B) without permanent cluttering tooltips
          const endpointClass = isCableRoute ? 'nw-terminus-pin nw-cable-terminus' : 'nw-terminus-pin';
          const pA = L.divIcon({ className: 'nw-terminus-wrap', html: `<div class="${endpointClass}">A</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
          const pB = L.divIcon({ className: 'nw-terminus-wrap', html: `<div class="${endpointClass}">B</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });

          const markA = L.marker(latLngs[0], { icon: pA });
          const markB = L.marker(latLngs[latLngs.length - 1], { icon: pB });
          bindProgressiveFeatureInteractions(markA, w, summaryText, '#0891b2');
          bindProgressiveFeatureInteractions(markB, w, summaryText, '#0891b2');

          if (linesLayer) {
            linesLayer.addLayer(markA);
            linesLayer.addLayer(markB);
          }
          w._layers.push(markA, markB);
        });
      } catch (lineErr) {
        console.warn('Line plot notice:', lineErr);
      }
    }

    // D. POINT / DISCRETE HAZARD / RIG PLATFORM
    else if (featType === 'POINT' || blob.type === 'Point') {
      try {
        const lng = blob.coordinates[0];
        const lat = blob.coordinates[1];
        if (isNaN(lat) || isNaN(lng)) continue;

        const pos = [lat, lng];
        allCoordsForBounds.push(pos);

        const primarySymbol = getWarningPrimarySymbol(w);
        const severity = getWarningSeverity(w);
        const pointMarker = L.marker(pos, { icon: createWarningMarkerIcon(w) });
        const summaryText = `${label} · ${primarySymbol} · ${severity}`;
        bindProgressiveFeatureInteractions(pointMarker, w, summaryText, color);

        if (pointsLayer) pointsLayer.addLayer(pointMarker);
        w._layers.push(pointMarker);
        if (!w._primaryLayer) w._primaryLayer = pointMarker;
      } catch (ptErr) {
        console.warn('Point plot notice:', ptErr);
      }
    }
  }

  // Calculate bounding envelope for zooming & focusing
  if (allCoordsForBounds.length > 1) {
    w._bounds = L.latLngBounds(allCoordsForBounds);
  } else if (allCoordsForBounds.length === 1) {
    w._bounds = L.latLngBounds([allCoordsForBounds[0], allCoordsForBounds[0]]);
  }
}

// Backward compatibility helper
function addMarker(w) {
  plotWarning(w);
}

window.filterMapByNavArea = function(navArea, opts) {
  currentSelectedNavArea = navArea || '';
  try { localStorage.setItem('hw-navarea', currentSelectedNavArea || 'ALL'); } catch (e) { /* private mode: ignore */ }

  const mapSelect = document.getElementById('mapNavAreaSelect');
  if (mapSelect && mapSelect.value !== currentSelectedNavArea) {
    mapSelect.value = currentSelectedNavArea;
  }
  const dataBankSelect = document.getElementById('filter-navarea');
  if (dataBankSelect && dataBankSelect.value !== currentSelectedNavArea) {
    dataBankSelect.value = currentSelectedNavArea;
    if (typeof applyFilters === 'function') {
      applyFilters();
    }
  }

  const filtered = warnings.filter(w => w.status !== 'rejected' && inRegionScope(w.navarea, currentSelectedNavArea));

  // Clear all vector layers
  if (pointsLayer) pointsLayer.clearLayers();
  if (polygonsLayer) polygonsLayer.clearLayers();
  if (circlesLayer) circlesLayer.clearLayers();
  if (linesLayer) linesLayer.clearLayers();

  // Plot each warning into the appropriate layer
  filtered.forEach(plotWarning);

  rebuildMapList(filtered);

  const mlb = document.getElementById('mapLiveBadge');
  if (mlb) mlb.innerHTML = `<span class="dot"></span> ${filtered.length} live`;

  const chipNavText = document.getElementById('chipNavAreaText');
  if (chipNavText) {
    if (!currentSelectedNavArea) {
      chipNavText.textContent = 'Global View';
    } else {
      const opt = mapSelect?.options[mapSelect.selectedIndex]?.text;
      chipNavText.textContent = opt ? opt.split('·')[0].trim() : currentSelectedNavArea;
    }
  }
  const chipCount = document.getElementById('chipLiveCount');
  if (chipCount) {
    chipCount.textContent = `${filtered.length} live`;
  }

  // Filter-aware subtitle: keeps the honest global count visible with a
  // one-tap escape hatch back to the Global View.
  const mSub = document.getElementById('mapSubtitle');
  if (mSub) {
    const live = warnings.filter(w => w.status !== 'rejected');
    const showAll = document.getElementById('mapShowAll');
    if (!currentSelectedNavArea) {
      const areas = new Set(live.map(w => w.navarea)).size;
      mSub.textContent = `${live.length} in-force across ${areas} NAVAREAs`;
      if (showAll) showAll.setAttribute('hidden', '');
    } else {
      const opt = mapSelect?.options[mapSelect.selectedIndex]?.text;
      const label = opt ? opt.split('·')[0].trim() : currentSelectedNavArea;
      mSub.textContent = `Showing ${label}: ${filtered.length} of ${live.length} in-force`;
      if (showAll) showAll.removeAttribute('hidden');
    }
  }

  const m = getLeafletMap();
  const shouldRefit = mapFirstFitPending || (navArea || '') !== lastFittedNavArea || !!(opts && opts.forceRefit);
  const animateFit = !mapFirstFitPending;
  if (m && shouldRefit) {
    if (currentSelectedNavArea) {
      const allCoords = [];
      filtered.filter(w => matchesNavArea(w.navarea, currentSelectedNavArea)).forEach(w => {
        if (w._bounds && w._bounds.isValid()) {
          allCoords.push(w._bounds.getSouthWest(), w._bounds.getNorthEast());
        } else if (!isNaN(Number(w.latitude)) && !isNaN(Number(w.longitude))) {
          allCoords.push([Number(w.latitude), Number(w.longitude)]);
        }
      });

      if (allCoords.length > 1) {
        m.fitBounds(allCoords, { maxZoom: 6, padding: [40, 40], animate: animateFit });
      } else if (allCoords.length === 1) {
        m.setView(allCoords[0], 6, { animate: animateFit });
      } else if (NAVAREA_CENTERS[currentSelectedNavArea]) {
        const c = NAVAREA_CENTERS[currentSelectedNavArea];
        m.setView(c.center, c.zoom, { animate: animateFit });
      }
    } else {
      const isMob = document.body.classList.contains('is-mobile');
      m.setView([20, 0], isMob ? 2 : 3, { animate: animateFit });
    }
    // Consume the first fit (and mark the region fitted) only once real
    // warning data exists; the pre-data initMap call must not lock it in.
    if (warnings.length > 0) {
      mapFirstFitPending = false;
      lastFittedNavArea = navArea || '';
    }
  }
};


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

  expandedWarningId = w.canonical_id || w.warning_id || w.id;
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

  const coordsText = warningPositionText(w);
  const issuedText = formatWarningIssuedText(w);
  const wid = w.canonical_id || w.warning_id || w.id;

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
    const existing = getBulletinText(w);
    if (existing) {
      textEl.innerText = existing;
    } else {
      const fetchFn = typeof fetchWarningDetails === 'function'
        ? fetchWarningDetails
        : (window.hwDb && window.hwDb.fetchWarningDetails);
      const details = fetchFn ? await fetchFn(w.id || wid || w) : null;
      const text = getBulletinText(details);
      if (text) {
        w.raw_text = text;
        w.bulletin = text;
        textEl.innerText = text;
      } else {
        const fallbackText = getBulletinText(w) || w.area_text || w.title;
        textEl.innerText = fallbackText || "No additional bulletin text available.";
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

function rebuildMapList(items = null){
  const list=document.getElementById('mapWarningList');
  if(!list) return;
  list.querySelectorAll('.warning-item, .warning-item-empty').forEach(e=>e.remove());
  const activeItems = items !== null
    ? items
    : warnings.filter(w=>w.status!=='rejected' && inRegionScope(w.navarea, currentSelectedNavArea));

  if (activeItems.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'warning-item-empty';
    emptyEl.style.padding = '18px 14px';
    emptyEl.style.fontSize = '12px';
    emptyEl.style.color = 'var(--text-muted)';
    emptyEl.style.textAlign = 'center';
    emptyEl.textContent = 'No active warnings in selected navigation area.';
    list.appendChild(emptyEl);
    return;
  }

  activeItems.forEach(w=>{
    const item=document.createElement('div');
    const wid = w.canonical_id || w.warning_id || w.id;
    const unscopedHere = currentSelectedNavArea
      && !isNavAreaUnscoped(currentSelectedNavArea)
      && isNavAreaUnscoped(w.navarea);
    item.className='warning-item';
    item.dataset.warningId = wid;
    item.onclick=()=>toggleInlineWarning(w, item);
    const c=w.severity==='critical'?'var(--critical)':w.severity==='high'?'var(--high)':'var(--neutral)';
    item.innerHTML=`
      <div class="warning-item-header">
        <span class="severity-dot" style="background:${c}"></span>
        <div class="warning-item-title-col">
          <div class="warning-id">${wid} · ${w.navarea}${unscopedHere ? '<span title="This warning has no NAVAREA number, so it is shown with NAVAREA I (the Baltic Sea lies in NAVAREA I waters)." style="display:inline-block;margin:2px 0 0 6px;padding:0 6px;border:1px solid var(--border);border-radius:999px;font-size:11px;font-weight:500;color:var(--text-muted)">No NAVAREA · shown with NAVAREA I</span>' : ''}</div>
          <div class="warning-meta">${w.title}</div>
          <div class="warning-meta">${formatWarningDate(w)}</div>
        </div>
        <svg class="warning-item-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="6 9 12 15 18 9"/></svg>
      </div>`;
    list.appendChild(item);

    if (expandedWarningId === wid) {
      toggleInlineWarning(w, item);
    }
  });
}
window.selectBaseMap = function(id){
  const m = getLeafletMap();
  if(!m || !BASE_MAP_DEFS[id]) return;
  if(currentBaseMapId === id && currentBaseLayer && m.hasLayer(currentBaseLayer)) return;
  if(currentBaseLayer){
    m.removeLayer(currentBaseLayer);
  }
  currentBaseMapId = id;
  const def = BASE_MAP_DEFS[id];
  currentBaseLayer = L.tileLayer(def.url, {
    maxZoom: def.maxZoom,
    attribution: def.attribution,
    keepBuffer: 4,
    updateWhenZooming: false,
  });
  currentBaseLayer.on('tileerror', logTileError('base:' + id));
  currentBaseLayer.addTo(m);
  if(typeof currentBaseLayer.bringToBack === 'function'){
    currentBaseLayer.bringToBack();
  }
  osmBaseLayer = currentBaseLayer;

  const attrEl = document.querySelector('.map-attribution');
  if(attrEl){
    attrEl.textContent = def.attribution;
    if(id === 'carto-dark'){
      attrEl.style.background = 'rgba(15, 23, 42, 0.85)';
      attrEl.style.color = '#94a3b8';
    } else {
      attrEl.style.background = 'rgba(255, 255, 255, 0.85)';
      attrEl.style.color = 'var(--text-light)';
    }
  }
};

window.resetMapView = function(){
  filterMapByNavArea(currentSelectedNavArea, { forceRefit: true });
};
window.locateMapView = window.resetMapView;

/* My position — geolocate, drop a persistent marker and pan to it */
let mePositionMarker = null;
window.locateMe = function(){
  const m = getLeafletMap();
  if (!m) return;
  if (!navigator.geolocation || !navigator.geolocation.getCurrentPosition) {
    showToast('Position unavailable on this device');
    return;
  }
  showToast('Locating…');
  navigator.geolocation.getCurrentPosition((pos) => {
    const ll = [pos.coords.latitude, pos.coords.longitude];
    if (mePositionMarker) {
      mePositionMarker.setLatLng(ll);
    } else {
      // #2563eb mirrors a distinct "you" marker color for Leaflet SVG
      mePositionMarker = L.circleMarker(ll, {
        radius: 8, color: '#2563eb', weight: 2,
        fillColor: '#2563eb', fillOpacity: 0.35
      }).addTo(m).bindTooltip('Your position', { direction: 'top', offset: [0, -8] });
    }
    m.setView(ll, Math.max(m.getZoom(), 10));
    showToast('Showing your position');
  }, () => {
    showToast('Position unavailable');
  }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
};

window.toggleLayer = function(name, vis){
  const m = getLeafletMap();
  if(!m) return;
  if(name === 'points' && pointsLayer){
    vis ? pointsLayer.addTo(m) : m.removeLayer(pointsLayer);
  } else if(name === 'polygons' && polygonsLayer){
    vis ? polygonsLayer.addTo(m) : m.removeLayer(polygonsLayer);
  } else if(name === 'circles' && circlesLayer){
    vis ? circlesLayer.addTo(m) : m.removeLayer(circlesLayer);
  } else if(name === 'lines' && linesLayer){
    vis ? linesLayer.addTo(m) : m.removeLayer(linesLayer);
  } else if(name === 'warnings'){
    [pointsLayer, polygonsLayer, circlesLayer, linesLayer].forEach(layer => {
      if(layer){
        vis ? layer.addTo(m) : m.removeLayer(layer);
      }
    });
  } else if(name === 'seamarks'){
    if(!openSeaMapLayer){
      openSeaMapLayer = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        maxZoom: 18,
        opacity: 1.0,
        keepBuffer: 4,
        updateWhenZooming: false,
        attribution: 'Map style: &copy; OpenSeaMap'
      });
      openSeaMapLayer.on('tileerror', logTileError('seamarks'));
    }
    vis ? openSeaMapLayer.addTo(m) : m.removeLayer(openSeaMapLayer);
  } else if(name === 'soundings'){
    if(vis){
      if(!soundingsLayer){
        soundingsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',{
          attribution: 'Tiles &copy; Esri &mdash; NOAA, GEBCO',
          maxZoom: 13,
          keepBuffer: 4,
          updateWhenZooming: false,
        });
        soundingsLayer.on('tileerror', logTileError('soundings'));
      }
      soundingsLayer.addTo(m);
    } else if(soundingsLayer){
      m.removeLayer(soundingsLayer);
    }
  }
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
    minBtn.setAttribute('aria-expanded', !isMin ? 'false' : 'true');
    minBtn.innerHTML = !isMin
      ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="6 9 12 15 18 9"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  }
  const maxBtn = document.getElementById('btnMaxWarningList');
  if(maxBtn) {
    maxBtn.title = 'Maximize';
    maxBtn.setAttribute('aria-label', 'Maximize active warnings list');
    maxBtn.setAttribute('aria-expanded', 'false');
    maxBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  }
};

// Tap anywhere on the minimized header bar to restore the list (buttons excepted)
window.onWarningListHeaderClick = function(ev){
  const el = document.getElementById('mapWarningList');
  if(!el || !el.classList.contains('is-minimized')) return;
  if(ev && ev.target && ev.target.closest && ev.target.closest('.panel-actions')) return;
  window.toggleMinimizeWarningList();
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
    minBtn.setAttribute('aria-expanded', 'true');
    minBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  }
  const maxBtn = document.getElementById('btnMaxWarningList');
  if(maxBtn) {
    maxBtn.title = !isMax ? 'Restore' : 'Maximize';
    maxBtn.setAttribute('aria-label', !isMax ? 'Restore active warnings list size' : 'Maximize active warnings list');
    maxBtn.setAttribute('aria-expanded', !isMax ? 'true' : 'false');
    maxBtn.innerHTML = !isMax
      ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  }
};

window.locateOnMap = function(){
  const m = getLeafletMap();
  if(currentWarning && m){
    switchTab('map');
    if(currentWarning.navarea && !isNavAreaUnscoped(currentWarning.navarea) && !matchesNavArea(currentWarning.navarea, currentSelectedNavArea)){
      filterMapByNavArea(currentWarning.navarea);
    }

    if(currentWarning._bounds && currentWarning._bounds.isValid()){
      m.fitBounds(currentWarning._bounds, { maxZoom: 8, padding: [50, 50], animate: true });
    } else {
      const lat = Number(currentWarning.latitude ?? currentWarning.lat);
      const lng = Number(currentWarning.longitude ?? currentWarning.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        m.setView([lat, lng], 7, { animate: true });
      }
    }

    if(currentWarning._primaryLayer && typeof currentWarning._primaryLayer.openPopup === 'function'){
      currentWarning._primaryLayer.openPopup();
    }

    const wid = currentWarning.canonical_id || currentWarning.warning_id || currentWarning.id;
    const itemEl = Array.from(document.querySelectorAll('.warning-item')).find(el => el.dataset.warningId === wid);
    if(itemEl) {
      itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if(!itemEl.classList.contains('expanded')) {
        toggleInlineWarning(currentWarning, itemEl);
      }
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
  const wid = w.canonical_id || w.warning_id || w.id;
  const isCurrentlyOpen = tr.classList.contains('table-row-selected');
  const tb = document.getElementById('tableBody');
  if (!tb) return;

  // Remove existing detail row and selection
  tb.querySelectorAll('.table-detail-row').forEach(row => row.remove());
  tb.querySelectorAll('.table-row-selected').forEach(row => {
    row.classList.remove('table-row-selected');
    row.setAttribute('aria-expanded', 'false');
  });

  if (isCurrentlyOpen) {
    expandedTableWarningId = null;
    tr.setAttribute('aria-expanded', 'false');
    return;
  }

  expandedTableWarningId = wid;
  tr.classList.add('table-row-selected');
  tr.setAttribute('aria-expanded', 'true');

  const detailTr = document.createElement('tr');
  detailTr.className = 'table-detail-row';
  detailTr.dataset.forWarning = wid;

  const lat = Number(w.latitude ?? w.lat);
  const lng = Number(w.longitude ?? w.lng);
  const coordsText = warningPositionText(w);
  const issuedText = formatWarningIssuedText(w);
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
    const existing = getBulletinText(w);
    if (existing) {
      textEl.innerText = existing;
    } else {
      const fetchFn = typeof fetchWarningDetails === 'function'
        ? fetchWarningDetails
        : (window.hwDb && window.hwDb.fetchWarningDetails);
      const fetchPromise = fetchFn ? fetchFn(w.id || wid || w) : Promise.resolve(null);
      fetchPromise.then(details => {
        const text = getBulletinText(details);
        if (text) {
          w.raw_text = text;
          w.bulletin = text;
          textEl.innerText = text;
        } else {
          const fallbackText = getBulletinText(w) || w.area_text || w.title;
          textEl.innerText = fallbackText || "No additional bulletin text available.";
        }
      }).catch(() => {
        const fallbackText = getBulletinText(w);
        textEl.innerText = fallbackText || "Error loading bulletin text.";
      });
    }
  }
}

let expandedCardWarningId = null;

function toggleCardDetail(w, cardEl) {
  const wid = w.canonical_id || w.warning_id || w.id;
  const isCurrentlyOpen = cardEl.classList.contains('expanded');
  const cl = document.getElementById('cardList');
  if (!cl) return;

  cl.querySelectorAll('.warning-card.expanded').forEach(c => {
    c.classList.remove('expanded');
    c.setAttribute('aria-expanded', 'false');
    const body = c.querySelector('.warning-card-expanded-body');
    if (body) body.remove();
  });

  if (isCurrentlyOpen) {
    expandedCardWarningId = null;
    cardEl.setAttribute('aria-expanded', 'false');
    return;
  }

  expandedCardWarningId = wid;
  cardEl.classList.add('expanded');
  cardEl.setAttribute('aria-expanded', 'true');

  const lat = Number(w.latitude ?? w.lat);
  const lng = Number(w.longitude ?? w.lng);
  const coordsText = warningPositionText(w, 'Spatial Vector');
  const issuedText = formatWarningIssuedText(w);
  const verClass = w.is_verified ? 'verified' : 'neutral';
  const verLabel = w.is_verified ? 'VERIFIED' : 'UNVERIFIED';

  let categoryBadges = '';
  if (Array.isArray(w.categories) && w.categories.length > 0) {
    categoryBadges = w.categories.map(cat => `<span class="badge-simple badge-neutral">${String(cat).toUpperCase()}</span>`).join('');
  } else if (w.category) {
    categoryBadges = `<span class="badge-simple badge-neutral">${String(w.category).toUpperCase()}</span>`;
  }

  const bodyEl = document.createElement('div');
  bodyEl.className = 'warning-card-expanded-body';
  bodyEl.onclick = (e) => e.stopPropagation();

  bodyEl.innerHTML = `
    <div class="warning-expanded-badges">
      ${badge(verClass, verLabel)}
      ${categoryBadges}
    </div>
    <div class="warning-expanded-meta">
      <div><strong>Issued:</strong> ${issuedText}</div>
      <div><strong>Coordinates:</strong> ${coordsText}</div>
    </div>
    <div class="warning-expanded-text">Loading bulletin text...</div>
    <div class="warning-expanded-actions">
      <button type="button" class="btn btn-primary" onclick="event.stopPropagation(); locateOnMapById('${encodeURIComponent(wid)}')">
        <span>On Map →</span>
      </button>
      <button type="button" class="btn btn-secondary" onclick="event.stopPropagation(); openWarningModalById('${encodeURIComponent(wid)}')">
        <span>Full Notice</span>
      </button>
      <button type="button" class="btn btn-ghost" onclick="event.stopPropagation(); toggleCardDetailById('${encodeURIComponent(wid)}')">
        <span>Collapse</span>
      </button>
    </div>
  `;

  cardEl.appendChild(bodyEl);

  const textEl = bodyEl.querySelector('.warning-expanded-text');
  if (textEl) {
    const existing = getBulletinText(w);
    if (existing) {
      textEl.innerText = existing;
    } else {
      const fetchFn = typeof fetchWarningDetails === 'function'
        ? fetchWarningDetails
        : (window.hwDb && window.hwDb.fetchWarningDetails);
      const fetchPromise = fetchFn ? fetchFn(w.id || wid || w) : Promise.resolve(null);
      fetchPromise.then(details => {
        const text = getBulletinText(details);
        if (text) {
          w.raw_text = text;
          w.bulletin = text;
          textEl.innerText = text;
        } else {
          const fallbackText = getBulletinText(w) || w.area_text || w.title;
          textEl.innerText = fallbackText || "No additional bulletin text available.";
        }
      }).catch(() => {
        const fallbackText = getBulletinText(w);
        textEl.innerText = fallbackText || "Error loading bulletin text.";
      });
    }
  }
}

window.locateOnMapById = function(rawId){
  const id = decodeURIComponent(rawId);
  const w = warnings.find(item => (item.canonical_id || item.warning_id || item.id) === id);
  if (!w) return;
  switchTab('map');
  if(w.navarea && !isNavAreaUnscoped(w.navarea) && !matchesNavArea(w.navarea, currentSelectedNavArea)){
    filterMapByNavArea(w.navarea);
  }
  const m = getLeafletMap();
  if (m) {
    if (w._bounds && w._bounds.isValid()) {
      m.fitBounds(w._bounds, { maxZoom: 8, padding: [50, 50], animate: true });
    } else {
      const lat = Number(w.latitude ?? w.lat);
      const lng = Number(w.longitude ?? w.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        m.setView([lat, lng], Math.max(m.getZoom(), 7), { animate: true });
      }
    }
    if (w._primaryLayer && typeof w._primaryLayer.openPopup === 'function') {
      w._primaryLayer.openPopup();
    } else if (typeof m.closePopup === 'function') {
      m.closePopup();
    }
  }

  // The list intentionally stays minimized here if the user minimized it:
  // selecting a marker opens details without re-expanding the panel.

  // Find matching warning card in bottom sheet
  const itemEl = Array.from(document.querySelectorAll('.warning-item')).find(el => el.dataset.warningId === id);
  if (itemEl) {
    if (!itemEl.classList.contains('expanded')) {
      toggleInlineWarning(w, itemEl);
    }
    itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    itemEl.classList.add('warning-item-target');
    setTimeout(() => {
      itemEl.classList.remove('warning-item-target');
    }, 2500);
  }
};

window.toggleTableDetailRowById = function(rawId){
  const id = decodeURIComponent(rawId);
  const tr = Array.from(document.querySelectorAll('tr[data-warning-id]')).find(el => el.dataset.warningId === id);
  const w = warnings.find(item => (item.canonical_id || item.warning_id || item.id) === id);
  if (tr && w) {
    toggleTableDetailRow(w, tr);
  }
};

window.openWarningModalById = function(rawId){
  const id = decodeURIComponent(rawId);
  const w = warnings.find(item => (item.canonical_id || item.warning_id || item.id) === id);
  if (w && typeof window.openWarningModal === 'function') {
    window.openWarningModal(w);
  }
};

window.toggleCardDetailById = function(rawId){
  const id = decodeURIComponent(rawId);
  const c = Array.from(document.querySelectorAll('.warning-card')).find(el => el.dataset.warningId === id);
  const w = warnings.find(item => (item.canonical_id || item.warning_id || item.id) === id);
  if (c && w) {
    toggleCardDetail(w, c);
  }
};

function populateTable(filtered=warnings){
  const tb=document.getElementById('tableBody'); 
  if(!tb) return;
  tb.innerHTML='';
  const live=filtered.filter(w=>w.status!=='rejected');
  const tc = document.getElementById('tableCount');
  if (live.length === 0) {
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px 16px;color:var(--ink-secondary);font-size:0.9rem;">No published warnings match the selected filters.</td></tr>';
    if (tc) tc.textContent = 'Showing 0 of 0';
    return;
  }
  live.forEach(w=>{
    const tr=document.createElement('tr');
    const wid = w.canonical_id || w.warning_id || w.id;
    tr.dataset.warningId = wid;
    tr.setAttribute('tabindex', '0');
    tr.setAttribute('aria-expanded', expandedTableWarningId === wid ? 'true' : 'false');
    tr.setAttribute('aria-label', `Warning ${wid}, ${w.navarea}, ${w.title}. Click or press Enter to toggle details.`);
    tr.onclick=()=>toggleTableDetailRow(w, tr);
    tr.onkeydown=(e)=>{
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        toggleTableDetailRow(w, tr);
      }
    };
    const sevClass = w.severity === 'critical' ? 'critical' : w.severity === 'high' ? 'high' : 'moderate';
    const sevLabel = (w.severity || 'moderate').toUpperCase();
    tr.innerHTML=`<td><strong>${wid}</strong> <svg class="row-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="6 9 12 15 18 9"/></svg></td><td>${w.navarea}</td><td>${w.title}</td>
    <td>${badge(sevClass, sevLabel)}</td>
    <td>${formatWarningDate(w)}</td><td>${warningPositionText(w)}</td><td>${statusBadge(w)}</td>`;
    tb.appendChild(tr);

    if (expandedTableWarningId === wid) {
      toggleTableDetailRow(w, tr);
    }
  });
  if(tc) tc.textContent=`Showing 1–${live.length} of ${live.length}`;
}

function populateCards(filtered=warnings){
  const cl=document.getElementById('cardList');
  if(!cl) return;
  cl.querySelectorAll('.warning-card, .warning-card-empty').forEach(e=>e.remove());
  const live=filtered.filter(w=>w.status!=='rejected');

  if (live.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'warning-card-empty';
    empty.style.padding = '32px 16px';
    empty.style.textAlign = 'center';
    empty.style.color = 'var(--text-muted)';
    empty.style.fontSize = '14px';
    empty.textContent = 'No published warnings match the selected filters.';
    cl.appendChild(empty);
    return;
  }

  live.forEach(w=>{
    const c=document.createElement('div');
    const wid = w.canonical_id || w.warning_id || w.id;
    c.className='warning-card';
    c.dataset.warningId = wid;
    c.setAttribute('tabindex', '0');
    c.setAttribute('role', 'button');
    const isExpanded = expandedCardWarningId === wid;
    c.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    c.setAttribute('aria-label', `Warning ${wid}, ${w.navarea}, ${w.title}. Tap to toggle details.`);

    const sevClass = w.severity === 'critical' ? 'critical' : w.severity === 'high' ? 'high' : 'moderate';
    const sevLabel = (w.severity || 'HIGH').toUpperCase();
    const lat = Number(w.latitude ?? w.lat);
    const lng = Number(w.longitude ?? w.lng);
    const coordsText = warningPositionText(w, 'Spatial Vector');

    const idLabel = /^NAVAREA/i.test(String(wid)) ? String(wid) : `${wid} · ${w.navarea}`;
    c.innerHTML=`
      <div class="warning-card-main">
        <div class="warning-card-header">
          <span class="warning-card-id">${idLabel}</span>
          ${badge(sevClass, sevLabel)}
        </div>
        <div class="warning-card-title">${w.title}</div>
        <div class="warning-card-meta">
          <span class="meta-item"><span class="meta-glyph" aria-hidden="true">⌖</span> ${coordsText}</span>
          <span class="meta-item"><span class="meta-glyph" aria-hidden="true">▦</span> ${formatWarningDate(w)}</span>
        </div>
      </div>
    `;
    
    c.onclick = (e) => {
      if (e.target.closest('.warning-card-expanded-body button')) return;
      toggleCardDetail(w, c);
    };

    c.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('.warning-card-expanded-body button')) return;
        e.preventDefault();
        toggleCardDetail(w, c);
      }
    };
    
    cl.appendChild(c);

    if (isExpanded) {
      toggleCardDetail(w, c);
    }
  });
}
function getFilteredWarnings(){
  const q=(document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const na=document.getElementById('filter-navarea')?.value;
  const sv=document.getElementById('filter-severity')?.value;
  const ca=document.getElementById('filter-category')?.value;

  return warnings.filter(w=>{
    if(w.status==='rejected') return false;
    if(na && !inRegionScope(w.navarea, na)) return false;
    if(sv && w.severity!==sv) return false;
    if(ca && w.category!==ca) return false;
    if(q){
      const wid=(w.canonical_id || w.warning_id || w.id || '').toLowerCase();
      const title=(w.title || '').toLowerCase();
      const area=(w.navarea || '').toLowerCase();
      const text=(w.raw_text || w.area_text || '').toLowerCase();
      if(!wid.includes(q) && !title.includes(q) && !area.includes(q) && !text.includes(q)){
        return false;
      }
    }
    return true;
  });
}

window.filterTable = function(){
  const f=getFilteredWarnings();
  populateTable(f); populateCards(f);
};
window.applyFilters = function(){
  const na=document.getElementById('filter-navarea')?.value, sv=document.getElementById('filter-severity')?.value, ca=document.getElementById('filter-category')?.value;
  const f=getFilteredWarnings();
  populateTable(f); populateCards(f);
  const n=[na,sv,ca].filter(Boolean).length, el=document.getElementById('activeFilterCount');
  if(el){ el.style.display=n?'inline-flex':'none'; el.textContent=n; }

  if (na !== undefined && na !== currentSelectedNavArea) {
    currentSelectedNavArea = na || '';
    try { localStorage.setItem('hw-navarea', currentSelectedNavArea || 'ALL'); } catch (e) { /* private mode: ignore */ }
    const mapSelect = document.getElementById('mapNavAreaSelect');
    if (mapSelect && mapSelect.value !== currentSelectedNavArea) {
      mapSelect.value = currentSelectedNavArea;
    }
    const filtered = warnings.filter(w=>w.status!=='rejected' && inRegionScope(w.navarea, currentSelectedNavArea));
    if (markerLayer) {
      markerLayer.clearLayers();
      filtered.forEach(addMarker);
    }
    rebuildMapList(filtered);
    const mlb = document.getElementById('mapLiveBadge');
    if (mlb) mlb.innerHTML = `<span class="dot"></span> ${filtered.length} live`;
  }
};
function updateStats(){
  const live=warnings.filter(w=>w.status!=='rejected');
  const areas=new Set(live.map(w=>w.navarea)).size;
  const n=live.length;
  const mlb = document.getElementById('mapLiveBadge'); if(mlb) mlb.innerHTML=`<span class="dot"></span> ${n} live`;
  const chipCount = document.getElementById('chipLiveCount'); if(chipCount) chipCount.textContent = `${n} live`;
  const mSub = document.getElementById('mapSubtitle'); if(mSub) mSub.textContent=`${n} in-force across ${areas} NAVAREAs`;
  const dSub = document.getElementById('dataSubtitle'); if(dSub) dSub.textContent=`${n} published warnings`;
  const sAct = document.getElementById('statActive'); if(sAct) sAct.textContent=n;
  const sActD = document.getElementById('statActiveDetail'); if(sActD) sActD.textContent=n;
  const sRep = document.getElementById('statReportingCount'); if(sRep) sRep.textContent=areas;
  const sCov = document.getElementById('statCoverage'); if(sCov) sCov.textContent=areas+'/21';
  const sCovD = document.getElementById('statCoverageDetail'); if(sCovD) sCovD.textContent=areas+'/21';
  const sCovSub = document.getElementById('statCoverageSub'); if(sCovSub) sCovSub.textContent=Math.round(areas/21*100)+'% world coverage';
  const sGeo = document.getElementById('statGeo'); if(sGeo) sGeo.textContent='100%';
  const sGeoD = document.getElementById('statGeoDetail'); if(sGeoD) sGeoD.textContent='100%';
}
window.toggleStatSummary = function(){
  const grid = document.getElementById('statGrid');
  const btn = document.getElementById('statSummaryToggle');
  if(!grid || !btn) return;
  const show = grid.hasAttribute('hidden');
  if(show){ grid.removeAttribute('hidden'); } else { grid.setAttribute('hidden',''); }
  btn.setAttribute('aria-expanded', show ? 'true' : 'false');
};
function populateSources(){
  // Removed with the Info-page refactor: the preview grid moved to the
  // Sources & Coverage registry panel (see /?tab=sources). Kept as a no-op
  // so any legacy deep link or bookmark calling it stays harmless.
}
window.refreshData = async function(btn){
  const target = btn || document.querySelector('button[onclick*="refreshData"]');
  if (target) target.disabled = true;
  try {
    const loaded = await loadWarnings();
    if (loaded) {
      filterMapByNavArea(currentSelectedNavArea);
      showToast('Data refreshed — latest published generation loaded');
    } else {
      showToast('Data unavailable — authoritative warning geometry could not be loaded');
    }
  } finally {
    if (target) target.disabled = false;
  }
};

window.refreshSupabaseConnection = async function(){
  const btn = document.getElementById('btnRefreshSupabase');
  const origText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.innerHTML = `<span style="display:inline-block;margin-right:6px;">↻</span><span>Connecting...</span>`;
  }
  showToast('Refreshing connection with Supabase...');
  try {
    const loaded = await loadWarnings();
    if (loaded) {
      filterMapByNavArea(currentSelectedNavArea);
      showToast(`Supabase live: ${warnings.length} active warnings synchronized`);
    } else {
      showToast('Supabase connection notice: authoritative warning data unavailable');
    }
  } catch (err) {
    showToast('Supabase connection notice: ' + (err.message || 'Failed to reconnect'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.innerHTML = origText;
    }
  }
};

// ═══════════ MODAL / TOAST ═══════════
let currentWarning, toastTimeout, previousFocusedElement = null;
window.openWarningModal = async function(w){
  previousFocusedElement = document.activeElement;
  currentWarning=w;
  currentDrawerWarning=w;
  const modalOverlay = document.getElementById('warningModal');
  const wid = w.canonical_id || w.warning_id || w.id || 'Notice';
  document.getElementById('modalTitle').textContent=`${wid} — ${w.navarea || 'NAVAREA'}`;
  document.getElementById('modalBody').innerHTML=`
    <div class="detail-row"><div class="detail-label">Severity</div><div class="detail-value">${badge(w.severity==='high'?'high':w.severity==='critical'?'critical':'moderate',w.severity.toUpperCase())}</div></div>
    <div class="detail-row"><div class="detail-label">Issued</div><div class="detail-value">${formatWarningIssuedText(w)}</div></div>
    <div class="detail-row"><div class="detail-label">Coordinates</div><div class="detail-value">${warningPositionText(w)}</div></div>
    <div class="detail-row"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(w)}</div></div>
    <div class="warning-text" id="modalTextContainer"></div>`;
  if(modalOverlay){
    modalOverlay.classList.add('open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    const closeBtn = modalOverlay.querySelector('.modal-close');
    if(closeBtn) setTimeout(()=>closeBtn.focus(), 50);
  }
  document.body.style.overflow='hidden';

  const textContainer = document.getElementById('modalTextContainer');
  if (!textContainer) return;

  // Check if we already fetched or hold the bulletin text
  const existing = getBulletinText(w);
  if (existing) {
    textContainer.innerText = existing;
  } else {
    // Show a loading state
    textContainer.innerHTML = '<span class="loading-spinner">Loading bulletin text...</span>';
    
    // Fetch the details on demand
    const fetchFn = typeof fetchWarningDetails === 'function'
      ? fetchWarningDetails
      : (window.hwDb && window.hwDb.fetchWarningDetails);

    const details = fetchFn ? await fetchFn(w.id || w.warning_id || w) : null;
    const text = getBulletinText(details);
    if (text) {
      w.raw_text = text; // Cache it in memory so we don't fetch it twice
      w.bulletin = text;
      textContainer.innerText = text;
    } else {
      const fallbackText = getBulletinText(w) || w.area_text || w.title;
      textContainer.innerText = fallbackText || "No additional bulletin text available.";
    }
  }
};
window.closeModal = function(e){ if(e.target===e.currentTarget) closeWarningModal(); };
window.closeWarningModal = function(){
  const modalOverlay = document.getElementById('warningModal');
  if(modalOverlay){
    modalOverlay.classList.remove('open');
    modalOverlay.setAttribute('aria-hidden', 'true');
  }
  document.body.style.overflow='';
  if(previousFocusedElement && typeof previousFocusedElement.focus === 'function'){
    previousFocusedElement.focus();
  }
};
window.showToast = function(m){
  const t=document.getElementById('toast'); if(!t) return;
  t.textContent=m; t.classList.add('show');
  clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>t.classList.remove('show'),2600);
};


// ═══════════ MAP INTERROGATE (right-click / toolbar button) ═══════════
// Right-click the chart to interrogate directly: a fixed square centred
// on the cursor and lists every in-scope warning whose geometry intersects
// it. Clicking a result opens the standard warning details modal (the same
// window a map marker opens). Interrogation is client-side: the page
// already holds all active rows with geometries, so the result is instant.
// Desktop interaction for now — touch devices have no context menu; a
// toolbar entry can follow later.

const INTERROGATE_SQUARE_PX = 100; // full width & height: a 100 × 100 px box on screen, zoom-independent
let interrogateBox = null;
let interrogateSetupDone = false;
let interrogatePopup = null;

// Toolbar mode (btnInterrogate, mirrors toggleCoordMode): while active, a
// plain left-click on the chart interrogates the 10 NM box centred on the
// cursor. Only one cursor tool at a time — enabling interrogation switches
// the coordinate picker off. Escape or the button itself exits the mode.
let interrogateModeActive = false;

function toggleInterrogateMode(force) {
  interrogateModeActive = (typeof force === 'boolean') ? force : !interrogateModeActive;
  document.body.classList.toggle('interrogate-mode-active', interrogateModeActive);
  const btn = document.getElementById('btnInterrogate');
  if (btn) {
    btn.classList.toggle('is-active', interrogateModeActive);
    btn.setAttribute('aria-pressed', String(interrogateModeActive));
  }
  if (interrogateModeActive && typeof coordModeActive !== 'undefined' && coordModeActive) toggleCoordMode(false);
  if (!interrogateModeActive) clearInterrogate();
}
window.toggleInterrogateMode = toggleInterrogateMode;

function interrogateBoundsAt(latlng) {
  // Pixel-sized interrogation box: a 100 × 100 px square on screen, centred
  // on the cursor. The geographic footprint follows the current zoom —
  // tighter when zoomed in, wider when zoomed out — which matches how the
  // user "sees" the chart at that moment.
  const center = leafletMap.latLngToContainerPoint(latlng);
  const half = INTERROGATE_SQUARE_PX / 2;
  return L.latLngBounds(
    leafletMap.containerPointToLatLng([center.x - half, center.y - half]),
    leafletMap.containerPointToLatLng([center.x + half, center.y + half])
  );
}

// Flattens a GeoJSON blob into a list of [lat, lng] vertices.
function interrogateVertices(blob, out) {
  if (!blob || !Array.isArray(blob.coordinates)) return;
  const walk = (node) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      out.push([node[1], node[0]]); // GeoJSON stores [lng, lat]
      return;
    }
    for (const child of node) walk(child);
  };
  walk(blob.coordinates);
}

// A warning matches when any geometry vertex lies inside the box, or the
// box contains its representative position. Per-geometry vertex testing
// (not just the envelope) keeps false positives out of dense areas.
function warningIntersectsBounds(w, box) {
  const geoms = (Array.isArray(w.geometries) && w.geometries.length > 0 && w.geometries) ||
    (w.spatial && Array.isArray(w.spatial.geometries) && w.spatial.geometries) || [];
  for (const g of geoms) {
    const blob = g.geojson_blob || (g.coordinates ? { type: g.type, coordinates: g.coordinates } : null);
    const verts = [];
    interrogateVertices(blob, verts);
    for (const v of verts) {
      if (box.contains(L.latLng(v[0], v[1]))) return true;
    }
  }
  const lat = Number(w.latitude ?? w.lat);
  const lng = Number(w.longitude ?? w.lng);
  if (!isNaN(lat) && !isNaN(lng) && box.contains(L.latLng(lat, lng))) return true;
  return false;
}

function clearInterrogate() {
  if (interrogateBox) { interrogateBox.remove(); interrogateBox = null; }
  if (interrogatePopup) { interrogatePopup.remove(); interrogatePopup = null; }
}

function runInterrogate(latlng) {
  clearInterrogate();
  const box = interrogateBoundsAt(latlng);
  interrogateBox = L.rectangle(box, {
    color: '#dc2626',
    weight: 2,
    dashArray: '6, 4',
    fillColor: '#dc2626',
    fillOpacity: 0.06,
    interactive: false
  }).addTo(leafletMap);
  // Same in-scope rule as filterMapByNavArea: the region filter (unscoped
  // warnings count as NAVAREA I) decides what the chart shows, so it decides
  // what interrogation reports. #dc2626 mirrors the --critical token.
  const inScope = warnings.filter(w => w.status !== 'rejected' && inRegionScope(w.navarea, currentSelectedNavArea));
  const hits = inScope.filter(w => warningIntersectsBounds(w, box));
  showInterrogatePopup(latlng, hits);
}

function showInterrogatePopup(latlng, hits) {
  const container = document.querySelector('.map-container');
  if (!container) return;
  if (interrogatePopup) { interrogatePopup.remove(); interrogatePopup = null; }
  const popup = document.createElement('div');
  popup.className = 'interrogate-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Navigational warnings in interrogated area');

  const header = document.createElement('div');
  header.className = 'interrogate-popup-head';
  const title = document.createElement('strong');
  title.textContent = (hits.length === 1 ? '1 warning' : hits.length + ' warnings') + ' within ' + INTERROGATE_SQUARE_PX + ' px';
  header.appendChild(title);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'interrogate-popup-close';
  closeBtn.setAttribute('aria-label', 'Close interrogation results');
  closeBtn.textContent = '\u2715';
  closeBtn.addEventListener('click', clearInterrogate);
  header.appendChild(closeBtn);
  popup.appendChild(header);

  const posLine = document.createElement('div');
  posLine.className = 'interrogate-popup-pos';
  posLine.textContent = formatDMD(latlng.lat, latlng.lng);
  popup.appendChild(posLine);

  if (hits.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'interrogate-popup-empty';
    empty.textContent = 'No navigational warnings inside this area.';
    popup.appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'interrogate-popup-list';
    list.setAttribute('role', 'list');
    hits.forEach((w) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'interrogate-popup-item';
      row.setAttribute('role', 'listitem');
      const dot = document.createElement('span');
      dot.className = 'interrogate-popup-dot';
      dot.style.background = getWarningColor(w);
      row.appendChild(dot);
      const area = document.createElement('span');
      area.className = 'interrogate-popup-area';
      area.textContent = w.navarea || '';
      row.appendChild(area);
      const name = document.createElement('span');
      name.className = 'interrogate-popup-title';
      name.textContent = (w.canonical_id || w.warning_id || '') + (w.title ? ' \u2014 ' + w.title : '');
      row.appendChild(name);
      row.addEventListener('click', () => openWarningDetails(w));
      list.appendChild(row);
    });
    popup.appendChild(list);
  }
  container.appendChild(popup);
  interrogatePopup = popup;

  // Position beside the interrogation point, clamped inside the container.
  const point = leafletMap.latLngToContainerPoint(latlng);
  const maxLeft = Math.max(8, container.clientWidth - popup.offsetWidth - 8);
  const maxTop = Math.max(8, container.clientHeight - popup.offsetHeight - 8);
  popup.style.left = Math.min(Math.max(8, point.x + 14), maxLeft) + 'px';
  popup.style.top = Math.min(Math.max(8, point.y - popup.offsetHeight - 14), maxTop) + 'px';

  closeBtn.focus();
  popup.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { ev.stopPropagation(); clearInterrogate(); }
  });
  // Re-arm cleanly: drop any earlier pending once-handler before adding
  // a new one, so repeated interrogations without a pan don't stack.
  leafletMap.off('movestart', clearInterrogate);
  leafletMap.once('movestart', clearInterrogate);
}

function setupInterrogate(map) {
  if (interrogateSetupDone || !map) return;
  interrogateSetupDone = true;

  // Right-click anywhere on the chart = interrogate directly (no menu
  // step). A native contextmenu listener on the map container in the
  // CAPTURE phase fires before Leaflet's own handlers, even over markers
  // and tiles, and suppresses the browser's context menu. Right-clicks
  // aimed at real UI controls (buttons, links, popovers) are left alone.
  map.getContainer().addEventListener('contextmenu', (ev) => {
    const t = ev.target;
    if (t && t.closest && t.closest('button, a, input, select, .interrogate-popup, .map-settings-popover, .map-settings-sheet, .map-settings-scrim')) return;
    ev.preventDefault();
    ev.stopPropagation();
    let latlng = null;
    try { latlng = map.mouseEventToLatLng(ev); } catch (err) { latlng = null; }
    if (latlng) runInterrogate(latlng);
  }, true);

  // Toolbar mode (btnInterrogate): while active, a plain left-click on the
  // chart interrogates the 10 NM box centred on the cursor. The coordinate
  // picker keeps priority when both are somehow active.
  map.on('click', (e) => {
    if (interrogateModeActive && !coordModeActive) runInterrogate(e.latlng);
  });

  // Escape exits interrogation mode (the results popup handles its own
  // Escape first, with stopPropagation, so this fires for the bare map).
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (interrogateModeActive) toggleInterrogateMode(false);
  });
}

// The Leaflet instance is created inside the main init handler further down
// this file. A DOMContentLoaded listener registered HERE would fire BEFORE
// the main init one (registration order decides, not source position), so a
// same-tick lookup would miss it — that dead hookup was why interrogation
// never wired up. Poll until the map exists, then attach exactly once.
(function setupInterrogateWhenReady(attempt) {
  if (window.leafletMap) { setupInterrogate(window.leafletMap); return; }
  if (attempt > 100) return; // ~10s: give up quietly; the site still works
  setTimeout(() => setupInterrogateWhenReady(attempt + 1), 100);
})(0);

// ═══════════ INIT ═══════════
// Shows when the warning database was last updated (max nav_warnings.updated_at).
async function updateDataFreshness() {
  const el = document.getElementById('dataFreshness');
  if (!el || !window.hwSupabase) return;
  try {
    const { data } = await window.hwSupabase
      .from('nav_warnings')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);
    const ts = data && data[0] && data[0].updated_at;
    if (!ts) return;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const pad = (n) => String(n).padStart(2, '0');
    el.textContent = `Data updated: ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC · Source: Official NAVAREA coordinators (WWNWS)`;
  } catch (err) {
    /* keep placeholder freshness line */
  }
}

async function loadWarnings() {
  let loadError = null;
  try {
    if (!window.hwDb) throw new Error('Warning data client is unavailable');
    const data = await window.hwDb.fetchActiveWarnings();
    if (!Array.isArray(data)) throw new Error('Warning data response is invalid');
    warnings = data;
  } catch (error) {
    console.warn('Public warning data unavailable:', error);
    warnings = [];
    loadError = error;
  }
  updateStats(); populateTable(); populateCards();
  updateDataFreshness();
  filterMapByNavArea(currentSelectedNavArea);
  if (loadError) {
    const badge = document.getElementById('mapLiveBadge');
    if (badge) badge.textContent = 'Data unavailable';
    const subtitle = document.getElementById('mapSubtitle');
    if (subtitle) subtitle.textContent = 'Unable to load authoritative warning geometry. Please try again.';
  }
  return !loadError;
}

document.addEventListener('DOMContentLoaded', async ()=>{
  detectDevice();
  // Regional page deep link: /?navarea=NA+IV preselects the map region
  // (linked from the prerendered /navarea/<RN> regional pages).
  try {
    const deepLinked = new URLSearchParams(window.location.search).get('navarea');
    if (deepLinked) {
      const mapSelect = document.getElementById('mapNavAreaSelect');
      const isKnown = mapSelect && Array.prototype.some.call(mapSelect.options, function (o) { return o.value === deepLinked; });
      if (isKnown) {
        currentSelectedNavArea = deepLinked;
        mapSelect.value = deepLinked;
      }
    }
  } catch (deepLinkErr) { /* ignore malformed query strings */ }
  // Default view: NAVAREA VIII (Indian waters, India-coordinated) on a first
  // visit; restore the last choice afterwards. Deep links (?navarea=) above
  // still take precedence. Stored 'ALL' = Global View; a missing or unknown
  // value falls back to NA VIII.
  if (!currentSelectedNavArea) {
    try {
      const saved = localStorage.getItem('hw-navarea');
      const mapSelect = document.getElementById('mapNavAreaSelect');
      const isKnown = function (v) { return mapSelect && Array.prototype.some.call(mapSelect.options, function (o) { return o.value === v; }); };
      if (saved === 'ALL') {
        currentSelectedNavArea = '';
      } else {
        currentSelectedNavArea = (saved !== null && saved !== undefined && isKnown(saved)) ? saved : 'NA VIII';
      }
      if (mapSelect && mapSelect.value !== currentSelectedNavArea) mapSelect.value = currentSelectedNavArea;
    } catch (navPrefErr) { currentSelectedNavArea = 'NA VIII'; }
  }
  // Static-page top-nav deep link: /?tab=data or /?tab=info opens that tab
  // (linked from the prerendered /about, /navarea and warning pages).
  try {
    const wantedTab = new URLSearchParams(window.location.search).get('tab');
    if (wantedTab === 'data' || wantedTab === 'info' || wantedTab === 'sources' || wantedTab === 'appearance') switchTab(wantedTab);
  } catch (tabLinkErr) { /* ignore malformed query strings */ }
  const isMap = document.getElementById('tab-map')?.classList.contains('active') ?? true;
  document.body.classList.toggle('tab-map-active', isMap);
  document.documentElement.classList.toggle('tab-map-active', isMap);

  initMap();
  populateSources();
  attachGearLongPress();
  await loadWarnings();
  maybeShowNavAreaHint();
});

// Click outside to dismiss desktop settings popover
document.addEventListener('click', (e) => {
  const popover = document.getElementById('mapSettingsPopover');
  const btn = document.getElementById('btnMapSettings');
  if (popover && popover.classList.contains('open')) {
    if (!popover.contains(e.target) && !btn?.contains(e.target)) {
      closeMapSettings();
    }
  }
  // Click outside to dismiss the More menu
  const moreMenu = document.getElementById('moreMenu');
  const moreBtn = document.getElementById('tab-btn-more');
  if (moreMenu && !moreMenu.hidden) {
    if (!moreMenu.contains(e.target) && !moreBtn?.contains(e.target)) {
      window.toggleMoreMenu(false);
    }
  }
});

// Keyboard navigation (Escape to dismiss modal/drawer/settings/focus mode)
document.addEventListener('keydown', (e) => {
  // C4: keep Tab focus inside the open warning modal (wrap-around), so
  // keyboard users cannot escape behind the overlay. If focus has already
  // leaked outside, the next Tab pulls it back in.
  if (e.key === 'Tab') {
    const openModal = document.getElementById('warningModal');
    if (openModal && openModal.classList.contains('open')) {
      const focusables = openModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusables.length) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const inside = openModal.contains(document.activeElement);
        if (e.shiftKey && (!inside || document.activeElement === first)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }
  if (e.key === 'Escape') {
    const modal = document.getElementById('warningModal');
    if (modal && modal.classList.contains('open')) {
      closeWarningModal();
      return;
    }
    const drawer = document.getElementById('warningDetailsDrawer');
    if (drawer && drawer.classList.contains('open')) {
      closeWarningDrawer();
      return;
    }
    const popover = document.getElementById('mapSettingsPopover');
    const sheet = document.getElementById('mapSettingsSheet');
    if ((popover && popover.classList.contains('open')) || (sheet && sheet.classList.contains('open'))) {
      closeMapSettings();
      return;
    }
    const moreMenu = document.getElementById('moreMenu');
    if (moreMenu && !moreMenu.hidden) {
      window.toggleMoreMenu(false);
      return;
    }
    if (document.body.classList.contains('map-focus-active')) {
      toggleMapFocusMode(false);
      return;
    }
  } else if ((e.key === 'f' || e.key === 'F') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    const tabMap = document.getElementById('tab-map');
    if (tabMap && tabMap.classList.contains('active')) {
      toggleMapFocusMode();
    }
  }
});




// ═════════════ COORDINATE PICKER (degrees + decimal minutes) ═════════════
// Toggle via the crosshair button in the map toolbar. When active:
//  - the cursor position is shown live in the readout panel
//    (bottom-left on desktop, below the controls chip on mobile)
//  - clicking/tapping the map drops a pin with the exact position in
//    degrees and decimal minutes, e.g. 56° 11.40' N 003° 12.60' E
// The readout sits in an unobstructed corner (attribution is bottom-right,
// the warning list docks top-right on desktop / bottom on mobile).

const COORD_MINUTE_DECIMALS = 2;

function formatDMD(lat, lng) {
  const fmt = (value, pos, neg, pad) => {
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const min = (abs - deg) * 60;
    const dir = value >= 0 ? pos : neg;
    return String(deg).padStart(pad, '0') + '° ' + min.toFixed(COORD_MINUTE_DECIMALS) + "' " + dir;
  };
  // Latitude is padded to 2 digits, longitude to 3 (standard nautical notation)
  return fmt(lat, 'N', 'S', 2) + ' ' + fmt(lng, 'E', 'W', 3);
}

let coordModeActive = false;
let coordPin = null;

function setCoordReadout(text, label) {
  const txtEl = document.getElementById('coordText');
  const lblEl = document.getElementById('coordLabel');
  if (txtEl) txtEl.textContent = text;
  if (lblEl && label) lblEl.textContent = label;
}

function copyCoordReadout() {
  const txtEl = document.getElementById('coordText');
  const value = txtEl ? txtEl.textContent.trim() : '';
  if (!value || value === '—') return;
  const done = () => { if (typeof showToast === 'function') showToast('Coordinates copied: ' + value); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(value).then(done).catch(() => {});
  } else {
    const ta = document.createElement('textarea');
    ta.value = value;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (err) { /* clipboard unavailable */ }
    document.body.removeChild(ta);
  }
}

function toggleCoordMode(force) {
  coordModeActive = (typeof force === 'boolean') ? force : !coordModeActive;
  document.body.classList.toggle('coord-mode-active', coordModeActive);
  const btn = document.getElementById('btnMapCoord');
  const panel = document.getElementById('coordPanel');
  if (btn) {
    btn.classList.toggle('is-active', coordModeActive);
    btn.setAttribute('aria-pressed', String(coordModeActive));
  }
  if (panel) panel.classList.toggle('open', coordModeActive);
  if (!coordModeActive && coordPin) {
    coordPin.remove();
    coordPin = null;
  }
  setCoordReadout(coordModeActive ? '—' : '', coordModeActive ? 'Cursor' : '');
}

window.copyCoordReadout = copyCoordReadout;
window.toggleCoordMode = toggleCoordMode;

function setupCoordinatePicker(map) {
  if (!map) return;

  // Live cursor readout (superseded while a pin is placed)
  map.on('mousemove', (e) => {
    if (!coordModeActive || coordPin) return;
    const w = e.latlng.wrap();
    setCoordReadout(formatDMD(w.lat, w.lng), 'Cursor');
  });

  map.on('mouseout', () => {
    if (coordModeActive && !coordPin) setCoordReadout('—', 'Cursor');
  });

  // Click/tap to pin the exact position
  map.on('click', (e) => {
    if (!coordModeActive) return;
    const w = e.latlng.wrap();
    const dmd = formatDMD(w.lat, w.lng);
    if (coordPin) {
      coordPin.setLatLng(e.latlng);
      coordPin.setTooltipContent(dmd);
    } else {
      // #dc2626 mirrors the --critical token for Leaflet SVG (CSS vars unsupported here)
      coordPin = L.circleMarker(e.latlng, {
        radius: 6,
        color: '#dc2626',
        weight: 2,
        fillColor: '#ffffff',
        fillOpacity: 1
      }).addTo(map).bindTooltip(dmd, {
        permanent: true,
        direction: 'top',
        offset: [0, -8],
        className: 'coord-pin-tooltip'
      });
    }
    coordPin.openTooltip();
    setCoordReadout(dmd, 'Selected');
  });
}



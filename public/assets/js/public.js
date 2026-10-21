// ═══════════ STATE ═══════════
let warnings = [];

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
  if (!w || typeof w !== 'object') return 'N/A';
  const val = w.issued_date || w.issued || w.date || w.issued_text || w.issued_at || w.timestamp || w.created_at;
  if (!val) return 'N/A';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return 'N/A';
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
  if (!w || typeof w !== 'object') return 'N/A';
  const val = w.issued_text || w.issued_date || w.issued || w.date || w.issued_at || w.timestamp || w.created_at;
  if (!val) return 'N/A';
  const str = String(val).trim();
  return (str && str !== 'undefined' && str !== 'null') ? str : 'N/A';
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
},250));

window.switchTab = function(tab){
  document.querySelectorAll('.tab-panel').forEach(p=>{
    p.classList.remove('active');
    p.hidden = true;
  });
  document.querySelectorAll('.nav-tab').forEach(t=>{
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.drawer-item').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(t=>{
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
  document.querySelector(`.drawer-item[data-drawer-tab="${tab}"]`)?.classList.add('active');
  const bottomTab = document.querySelector(`.bottom-nav-item[data-bottom-tab="${tab}"]`);
  if(bottomTab){
    bottomTab.classList.add('active');
    bottomTab.setAttribute('aria-selected', 'true');
  }
  if(tab==='map'){
    const m = getLeafletMap();
    if(!m) initMap();
    else setTimeout(()=>m.invalidateSize(),100);
  }
  window.scrollTo({top:0,behavior:'smooth'});
};

window.toggleDrawer = function(){
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const toggleBtn = document.querySelector('.menu-toggle');
  const isOpen = drawer?.classList.toggle('open');
  overlay?.classList.toggle('open');
  if(toggleBtn){
    toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
  if(drawer){
    drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  }
  document.body.style.overflow = isOpen ? 'hidden' : '';
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
    toggleDrawerIfOpen();
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
function toggleDrawerIfOpen(){ if(document.getElementById('drawer')?.classList.contains('open')) toggleDrawer(); }

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
  leafletMap = L.map('map', {
    center: [20, 0],
    zoom: isMob ? 2 : 3,
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
    attribution: baseDef.attribution
  }).addTo(leafletMap);
  osmBaseLayer = currentBaseLayer;

  // OpenSeaMap nautical seamarks overlay
  openSeaMapLayer = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
    maxZoom: 18,
    opacity: 1.0,
    attribution: 'Map style: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a>'
  });
  openSeaMapLayer.on('tileerror', function() {});
  if (mapPreferences.overlays.seamarks) {
    openSeaMapLayer.addTo(leafletMap);
  }

  // Ocean soundings overlay
  soundingsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',{
    attribution: 'Tiles &copy; Esri &mdash; NOAA, GEBCO',
    maxZoom: 13
  });
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
  }
  const masterBtnMob = document.getElementById('masterToggleBtnMobile');
  if (masterBtnMob) {
    masterBtnMob.textContent = prefs.masterOverlays ? '[ON]' : '[OFF]';
    masterBtnMob.classList.toggle('off', !prefs.masterOverlays);
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

window.handleTitleCardClick = function() {
  if (activeTouchFeature) {
    openWarningDetails(activeTouchFeature);
  } else if (currentDrawerWarning) {
    openWarningDetails(currentDrawerWarning);
  }
};

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
      <span class="badge-simple" style="background:${color}18;color:${color};font-weight:700">
        <span class="dot" style="background:${color}"></span> ${(w.severity || 'ACTIVE').toUpperCase()}
      </span>
      <span class="badge-simple badge-neutral">${cats.toUpperCase()}</span>
      <span class="badge-simple ${w.is_verified ? 'badge-verified' : 'badge-neutral'}">${w.is_verified ? 'VERIFIED' : 'ACTIVE'}</span>
    </div>

    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.5px">Area / Subject</div>
      <div style="font-weight:600;font-size:14px;color:var(--text);margin-top:2px">${w.title || w.area_text || wid}</div>
      ${w.area_text && w.area_text !== w.title ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${w.area_text}</div>` : ''}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;background:var(--bg);padding:10px 12px;border-radius:6px;border:1px solid var(--border)">
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Issued</div>
        <div style="font-weight:600;color:var(--text);font-family:ui-monospace,monospace">${issuedText}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Coordinates</div>
        <div style="font-weight:600;color:var(--text);font-family:ui-monospace,monospace">${w.coordinates || w.coords || (w.latitude && w.longitude ? `${Number(w.latitude).toFixed(2)}°, ${Number(w.longitude).toFixed(2)}°` : 'Spatial Vector')}</div>
      </div>
    </div>

    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.5px;margin-bottom:6px">Raw Bulletin Text</div>
      <div class="warning-expanded-text" style="max-height:280px">${text}</div>
    </div>
  `;

  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
};

window.closeWarningDrawer = function() {
  const drawer = document.getElementById('warningDetailsDrawer');
  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }
};

window.copyCurrentWarningText = function() {
  if (!currentDrawerWarning) return;
  const text = getBulletinText(currentDrawerWarning) || currentDrawerWarning.raw_text || '';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Warning bulletin copied to clipboard');
    }).catch(() => {
      showToast('Copied bulletin text');
    });
  } else {
    showToast('Copied bulletin text');
  }
};

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

    if (!isMob) {
      openWarningDetails(w);
      return;
    }

    if (activeTouchFeature && (activeTouchFeature.canonical_id === wid || activeTouchFeature.warning_id === wid || activeTouchFeature.id === wid)) {
      openWarningDetails(w);
    } else {
      clearActiveFeatureHighlight();
      activeTouchFeature = w;
      activeHighlightedLayer = layer;
      if (typeof layer.setStyle === 'function') {
        layer.setStyle({ weight: (layer._origWeight || 2) + 2, color: '#38bdf8' });
      }
      if (layer._icon) {
        layer._icon.classList.add('nw-active-selected');
      }
      showTitleCard(w, summaryText, null, color);
    }
  });
}

// ═══════════ POLYMORPHIC PLOTTING ENGINE ═══════════
function getWarningColor(w) {
  const text = (w.title || '' + ' ' + (w.raw_text || '') + ' ' + (w.category || '')).toUpperCase();
  const cats = Array.isArray(w.categories) ? w.categories.join(' ').toLowerCase() : (w.category || '').toLowerCase();

  if (w.severity === 'critical' || /FIRING|GUNNERY|MISSILE|ROCKET|UXO|EXPLOSIVE|MINE|BOMBING/i.test(text) || cats.includes('military')) {
    return '#dc2626'; // --critical
  }
  if (w.severity === 'high' || /DANGER\s+AREA|RESTRICTED|DRIFTING|CONTAINER|DERELICT|COLLISION/i.test(text) || cats.includes('drifting')) {
    return '#ea580c'; // --high
  }
  if (/RIG|PLATFORM|DRILLSHIP|MODU/i.test(text) || cats.includes('offshore')) {
    return '#059669'; // --active (platform safety)
  }
  if (/CABLE|PIPELINE|BUOY|LIGHT|ATON|BEACON/i.test(text) || cats.includes('aton') || cats.includes('subsea')) {
    return '#0d9488'; // --verified
  }
  return '#64748b'; // --neutral
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
  const isMobile = document.body.classList.contains('is-mobile');
  const color = getWarningColor(w);
  const wid = w.warning_id || w.id;
  const isMilitary = color === '#dc2626';

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

  // Fallback: If no structured geometry exists, extract from raw bulletin text
  if (geoms.length === 0) {
    const rawBulletin = w.raw_text || w.bulletin || w.text || '';
    if (typeof extractGeometriesFromRawText === 'function' && rawBulletin) {
      geoms = extractGeometriesFromRawText(rawBulletin, w.title || wid);
    }
    if (geoms.length === 0) {
      const repLat = Number(w.latitude ?? w.lat);
      const repLng = Number(w.longitude ?? w.lng);
      if (!isNaN(repLat) && !isNaN(repLng) && (repLat !== 0 || repLng !== 0)) {
        geoms.push({
          feature_type: 'POINT',
          buffer_nm: Number(w.buffer_nm) || 0,
          geojson_blob: { type: 'Point', coordinates: [repLng, repLat] },
          zone_label: w.title || wid,
        });
      }
    }
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
            color: color,
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
              color: '#06b6d4',
              weight: Math.min(24, Math.max(8, bufferNm * 6)),
              opacity: 0.25,
            });
            bindProgressiveFeatureInteractions(swath, w, summaryText, '#06b6d4');
            if (linesLayer) linesLayer.addLayer(swath);
            w._layers.push(swath);
          }

          const mainLine = L.polyline(latLngs, {
            color: '#0891b2',
            weight: 3,
            opacity: 0.95,
            dashArray: '6, 4',
          });

          bindProgressiveFeatureInteractions(mainLine, w, summaryText, '#0891b2');

          if (linesLayer) linesLayer.addLayer(mainLine);
          w._layers.push(mainLine);
          if (!w._primaryLayer) w._primaryLayer = mainLine;

          // Termini markers (A and B) without permanent cluttering tooltips
          const pA = L.divIcon({ className: 'nw-terminus-wrap', html: `<div class="nw-terminus-pin">A</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
          const pB = L.divIcon({ className: 'nw-terminus-wrap', html: `<div class="nw-terminus-pin">B</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });

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

        const isRig = geom.is_rig || /RIG|PLATFORM|MODU|DRILLSHIP/i.test(label) || /RIG|PLATFORM/i.test(w.category || '');

        if (isRig) {
          // Special offshore platform icon
          const rigIcon = L.divIcon({
            className: 'nw-rig-wrap',
            html: `<div class="nw-rig-pin" title="${label}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2.2"><path d="M12 2L4 22h16L12 2z"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="6" y1="17" x2="18" y2="17"/></svg></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });
          const rigMarker = L.marker(pos, { icon: rigIcon });
          const summaryText = `${label} · Offshore Platform`;
          bindProgressiveFeatureInteractions(rigMarker, w, summaryText, '#059669');

          if (pointsLayer) pointsLayer.addLayer(rigMarker);
          w._layers.push(rigMarker);
          if (!w._primaryLayer) w._primaryLayer = rigMarker;
        } else {
          // Animated radar pulse marker for critical / active firing hazards
          if (isMilitary) {
            const radarIcon = L.divIcon({
              className: 'nw-radar-wrap',
              html: `<div class="nw-radar-pulse"></div>`,
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            });
            const radarMarker = L.marker(pos, { icon: radarIcon });
            if (pointsLayer) pointsLayer.addLayer(radarMarker);
            w._layers.push(radarMarker);
          }

          const pointMarker = L.circleMarker(pos, {
            radius: isMobile ? 8 : 6,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            fillOpacity: 0.95,
          });

          const summaryText = `${label} · Point Hazard`;
          bindProgressiveFeatureInteractions(pointMarker, w, summaryText, color);

          if (pointsLayer) pointsLayer.addLayer(pointMarker);
          w._layers.push(pointMarker);
          if (!w._primaryLayer) w._primaryLayer = pointMarker;
        }
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

window.filterMapByNavArea = function(navArea) {
  currentSelectedNavArea = navArea || '';

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

  const filtered = warnings.filter(w => w.status !== 'rejected' && matchesNavArea(w.navarea, currentSelectedNavArea));

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

  const m = getLeafletMap();
  if (m) {
    if (currentSelectedNavArea) {
      const allCoords = [];
      filtered.forEach(w => {
        if (w._bounds && w._bounds.isValid()) {
          allCoords.push(w._bounds.getSouthWest(), w._bounds.getNorthEast());
        } else if (!isNaN(Number(w.latitude)) && !isNaN(Number(w.longitude))) {
          allCoords.push([Number(w.latitude), Number(w.longitude)]);
        }
      });

      if (allCoords.length > 1) {
        m.fitBounds(allCoords, { maxZoom: 6, padding: [40, 40], animate: true });
      } else if (allCoords.length === 1) {
        m.setView(allCoords[0], 6, { animate: true });
      } else if (NAVAREA_CENTERS[currentSelectedNavArea]) {
        const c = NAVAREA_CENTERS[currentSelectedNavArea];
        m.setView(c.center, c.zoom, { animate: true });
      }
    } else {
      const isMob = document.body.classList.contains('is-mobile');
      m.setView([20, 0], isMob ? 2 : 3, { animate: true });
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
  const issuedText = formatWarningIssuedText(w);
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
    : warnings.filter(w=>w.status!=='rejected' && matchesNavArea(w.navarea, currentSelectedNavArea));

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
          <div class="warning-meta">${formatWarningDate(w)}</div>
        </div>
        <svg class="warning-item-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
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
    attribution: def.attribution
  });
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
  filterMapByNavArea(currentSelectedNavArea);
};
window.locateMapView = window.resetMapView;

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
        attribution: 'Map style: &copy; OpenSeaMap'
      });
      openSeaMapLayer.on('tileerror', function() {});
    }
    vis ? openSeaMapLayer.addTo(m) : m.removeLayer(openSeaMapLayer);
  } else if(name === 'soundings'){
    if(vis){
      if(!soundingsLayer){
        soundingsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',{
          attribution: 'Tiles &copy; Esri &mdash; NOAA, GEBCO',
          maxZoom: 13
        });
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
    if(currentWarning.navarea && !matchesNavArea(currentWarning.navarea, currentSelectedNavArea)){
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

    const wid = currentWarning.warning_id || currentWarning.id;
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
  const wid = w.warning_id || w.id;
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
  const coordsText = w.coordinates || w.coords || (!isNaN(lat) && !isNaN(lng) ? `${lat.toFixed(2)}°, ${lng.toFixed(2)}°` : 'Spatial Vector');
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
        <span>📍 View on Map</span>
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
  if(w.navarea && !matchesNavArea(w.navarea, currentSelectedNavArea)){
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

  // Ensure bottom Active Warnings sheet / drawer is expanded if collapsed
  const sheet = document.getElementById('mapWarningList');
  if (sheet && sheet.classList.contains('is-minimized')) {
    sheet.classList.remove('is-minimized');
    const minBtn = document.getElementById('btnMinWarningList');
    if (minBtn) {
      minBtn.title = 'Minimize';
      minBtn.setAttribute('aria-label', 'Minimize active warnings list');
      minBtn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    }
  }

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
    tr.innerHTML=`<td><strong>${wid}</strong> <svg class="row-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="6 9 12 15 18 9"/></svg></td><td>${w.navarea}</td><td>${w.title}</td>
    <td>${badge(w.severity==='high'?'high':w.severity==='critical'?'critical':'moderate',w.severity.toUpperCase())}</td>
    <td>${formatWarningDate(w)}</td><td>${w.coordinates || w.coords || 'N/A'}</td><td>${statusBadge(w)}</td>`;
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
    const coordsText = w.coordinates || w.coords || (!isNaN(lat) && !isNaN(lng) ? `${lat.toFixed(2)}°, ${lng.toFixed(2)}°` : 'Spatial Vector');

    c.innerHTML=`
      <div class="warning-card-main">
        <div class="warning-card-header">
          <span class="warning-card-id">${wid} · ${w.navarea}</span>
          ${badge(sevClass, sevLabel)}
        </div>
        <div class="warning-card-title">${w.title}</div>
        <div class="warning-card-meta">
          <span>📅 ${formatWarningDate(w)}</span>
          <span>📍 ${coordsText}</span>
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
window.filterTable = function(){
  const q=document.getElementById('searchInput')?.value.toLowerCase() || '';
  const f=warnings.filter(w=>((w.warning_id || w.id)+w.title+w.navarea).toLowerCase().includes(q));
  populateTable(f); populateCards(f);
};
window.applyFilters = function(){
  const na=document.getElementById('filter-navarea')?.value, sv=document.getElementById('filter-severity')?.value, ca=document.getElementById('filter-category')?.value;
  const f=warnings.filter(w=>(!na||matchesNavArea(w.navarea, na))&&(!sv||w.severity===sv)&&(!ca||w.category===ca));
  populateTable(f); populateCards(f);
  const n=[na,sv,ca].filter(Boolean).length, el=document.getElementById('activeFilterCount');
  if(el){ el.style.display=n?'inline-flex':'none'; el.textContent=n; }

  if (na !== undefined && na !== currentSelectedNavArea) {
    currentSelectedNavArea = na || '';
    const mapSelect = document.getElementById('mapNavAreaSelect');
    if (mapSelect && mapSelect.value !== currentSelectedNavArea) {
      mapSelect.value = currentSelectedNavArea;
    }
    const filtered = warnings.filter(w=>w.status!=='rejected' && matchesNavArea(w.navarea, currentSelectedNavArea));
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
  ['nav-map-badge','nav-data-badge','drawer-map-badge','bottomBadge'].forEach(id => {
    const el = document.getElementById(id); if(el) el.textContent = n;
  });
  const mlb = document.getElementById('mapLiveBadge'); if(mlb) mlb.innerHTML=`<span class="dot"></span> ${n} live`;
  const chipCount = document.getElementById('chipLiveCount'); if(chipCount) chipCount.textContent = `${n} live`;
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
  filterMapByNavArea(currentSelectedNavArea);
  showToast('Data refreshed — latest published generation loaded');
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
    await loadWarnings();
    filterMapByNavArea(currentSelectedNavArea);
    showToast(`Supabase live: ${warnings.length} active warnings synchronized`);
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
    <div class="detail-row"><div class="detail-label">Coordinates</div><div class="detail-value">${w.coordinates || w.coords || 'N/A'}</div></div>
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

// ═══════════ INIT ═══════════
async function loadWarnings() {
  if (window.hwDb) {
    const data = await window.hwDb.fetchActiveWarnings();
    warnings = Array.isArray(data) ? data : [];
  } else {
    warnings = [];
  }
  updateStats(); populateTable(); populateCards();
  filterMapByNavArea(currentSelectedNavArea);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  detectDevice();
  initMap();
  populateSources();
  attachGearLongPress();
  await loadWarnings();
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
});

// Keyboard navigation (Escape to dismiss modal/drawer/settings/focus mode)
document.addEventListener('keydown', (e) => {
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



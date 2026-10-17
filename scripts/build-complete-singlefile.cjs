// Script to assemble public/export/helm-warning-complete.html
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// 1. Read Vendor Libraries
const leafletCss = fs.readFileSync(path.join(rootDir, 'node_modules/leaflet/dist/leaflet.css'), 'utf8');
const leafletJs = fs.readFileSync(path.join(rootDir, 'node_modules/leaflet/dist/leaflet.js'), 'utf8');
const supabaseJs = fs.readFileSync(path.join(rootDir, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), 'utf8');

// 2. Read App Styles
const tokensCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/tokens.css'), 'utf8');
const componentsCss = fs.readFileSync(path.join(rootDir, 'public/assets/css/components.css'), 'utf8');

// 3. Read HTML Templates
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const adminHtml = fs.readFileSync(path.join(rootDir, 'admin.html'), 'utf8');

// 4. Extract custom styles from index.html & admin.html
const extractStyle = (html) => {
  const m = html.match(/<style>([\s\S]*?)<\/style>/i);
  return m ? m[1] : '';
};
const indexStyles = extractStyle(indexHtml);
const adminStyles = extractStyle(adminHtml);

// 5. Read App Scripts
const supabaseAppJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/supabase.js'), 'utf8');
const publicAppJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/public.js'), 'utf8');
const adminAppJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/admin.js'), 'utf8');

// 6. Build Unified HTML
const bundleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0f172a">
<title>Helm.Warning — Complete Platform (Offline Bundle)</title>

<!-- INLINED LEAFLET CSS -->
<style>
${leafletCss}
</style>

<!-- INLINED TOKENS & COMPONENTS CSS -->
<style>
${tokensCss}
${componentsCss}
</style>

<!-- INLINED PORTAL & ADMIN RESPONSIVE STYLES -->
<style>
${indexStyles}
${adminStyles}

/* View State Switcher */
#portalView { display: block; }
#loginView { display: none; }
#adminView { display: none; }

.app-mode-active #portalView { display: none; }
.admin-login-active #portalView { display: none; }
.admin-login-active #loginView { display: flex; }
.admin-active #portalView { display: none; }
.admin-active #loginView { display: none; }
.admin-active #adminView { display: block; }

.admin-nav-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
  padding: 6px 12px;
  border-radius: var(--radius);
  background: rgba(234, 88, 12, 0.1);
  color: var(--high);
  border: 1px solid rgba(234, 88, 12, 0.25);
  font: 600 13px system-ui;
  cursor: pointer;
  transition: all .15s ease;
}
.admin-nav-trigger:hover {
  background: var(--high);
  color: #fff;
}
</style>
</head>
<body id="appBody">
<a href="#main" class="skip-link">Skip to main content</a>

<!-- ════════════════════════════════════════════════════════════════════════════ -->
<!-- PUBLIC MARITIME PORTAL VIEW                                                 -->
<!-- ════════════════════════════════════════════════════════════════════════════ -->
<div id="portalView">
<header class="site-header">
  <div class="header-inner">
    <a href="#" onclick="returnToPublic(); return false;" class="logo">
      <span class="logo-badge" aria-hidden="true">HW</span>
      <span>Helm.Warning</span>
    </a>

    <!-- PUBLIC NAVIGATION -->
    <nav class="main-nav" aria-label="Main navigation">
      <div role="tablist" aria-label="Main navigation views" style="display:flex;gap:4px;align-items:center">
        <button class="nav-tab active" data-tab="map" role="tab" aria-selected="true" aria-controls="tab-map" id="tab-btn-map" onclick="switchTab('map')">Map View <span class="badge" id="nav-map-badge">0</span></button>
        <button class="nav-tab" data-tab="data" role="tab" aria-selected="false" aria-controls="tab-data" id="tab-btn-data" onclick="switchTab('data')">Data Bank <span class="badge" id="nav-data-badge">0</span></button>
        <button class="nav-tab" data-tab="sources" role="tab" aria-selected="false" aria-controls="tab-sources" id="tab-btn-sources" onclick="switchTab('sources')">Sources</button>
        <button type="button" class="admin-nav-trigger" onclick="openAdmin()" title="Access Operator Console">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span>Admin Console</span>
        </button>
      </div>
    </nav>

    <button class="menu-toggle" onclick="toggleDrawer()" aria-label="Navigation Menu" aria-expanded="false" aria-controls="drawer">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
  </div>
</header>

<div class="drawer-overlay" id="drawerOverlay" onclick="toggleDrawer()" aria-hidden="true"></div>
<nav class="drawer" id="drawer" aria-label="Mobile drawer navigation" aria-hidden="true">
  <div class="drawer-header"><span class="logo-badge" aria-hidden="true">HW</span> Helm.Warning</div>
  <div class="drawer-nav">
    <button class="drawer-item active" data-drawer-tab="map" onclick="switchTab('map');toggleDrawer()"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>Map View<span class="badge" id="drawer-map-badge">0</span></button>
    <button class="drawer-item" data-drawer-tab="data" onclick="switchTab('data');toggleDrawer()"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>Data Bank<span class="badge">0</span></button>
    <button class="drawer-item" data-drawer-tab="sources" onclick="switchTab('sources');toggleDrawer()"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>Sources</button>
    <div style="height:1px;background:var(--border);margin:8px 0"></div>
    <button class="drawer-item" onclick="openAdmin();toggleDrawer()"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>Admin Console 🔐</button>
  </div>
  <div class="drawer-footer">Automated decision-support system.<br>Not a substitute for GMDSS.</div>
</nav>

<main id="main" class="main" tabindex="-1">
<!-- MAP -->
<div class="tab-panel active" id="tab-map" role="tabpanel" aria-labelledby="tab-btn-map">
  <div class="page-header">
    <div><h1>Active Warnings</h1><p class="subtitle" id="mapSubtitle">0 in-force across 0 NAVAREAs</p></div>
    <div class="actions">
      <div class="navarea-select-wrapper">
        <label for="mapNavAreaSelect" class="sr-only">Select Navigation Area</label>
        <select id="mapNavAreaSelect" class="navarea-select" onchange="filterMapByNavArea(this.value)" aria-label="Select Navigation Area">
          <option value="NA I" selected>NAVAREA I · North Atlantic / UK</option>
          <option value="NA II">NAVAREA II · East Atlantic</option>
          <option value="NA III">NAVAREA III · Mediterranean</option>
          <option value="NA IV">NAVAREA IV · West Atlantic</option>
          <option value="NA V">NAVAREA V · Brazil / SW Atlantic</option>
          <option value="NA VI">NAVAREA VI · Argentina / SE Atlantic</option>
          <option value="NA VII">NAVAREA VII · South Africa</option>
          <option value="NA VIII">NAVAREA VIII · Indian Ocean</option>
          <option value="NA IX">NAVAREA IX · Red Sea / Persian Gulf</option>
          <option value="NA X">NAVAREA X · Australia</option>
          <option value="NA XI">NAVAREA XI · East Asia / Japan</option>
          <option value="NA XII">NAVAREA XII · East Pacific</option>
          <option value="NA XIII">NAVAREA XIII · NW Pacific / Okhotsk</option>
          <option value="NA XIV">NAVAREA XIV · New Zealand / S. Pacific</option>
          <option value="NA XV">NAVAREA XV · Chile / SE Pacific</option>
          <option value="NA XVI">NAVAREA XVI · Peru / E. South Pacific</option>
          <option value="NA XVII">NAVAREA XVII · Arctic Canada (West)</option>
          <option value="NA XVIII">NAVAREA XVIII · Arctic Canada (East)</option>
          <option value="NA XIX">NAVAREA XIX · Arctic Norway</option>
          <option value="NA XX">NAVAREA XX · Arctic Russia (Kara/Laptev)</option>
          <option value="NA XXI">NAVAREA XXI · Arctic Russia (East Siberian)</option>
        </select>
        <svg class="navarea-select-chevron" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      <button class="btn btn-primary" onclick="refreshData()">Refresh Data</button>
      <button class="btn btn-secondary" onclick="switchTab('data')">Data Bank →</button>
    </div>
  </div>
  <div class="map-container">
    <div id="map"></div>
    <div class="map-overlay">
      <details class="map-layer-panel">
        <summary>
          <svg class="layer-summary-icon" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          <span>Layers</span>
          <svg class="layer-summary-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </summary>
        <div class="map-layer-section-title">Base Map</div>
        <label class="map-layer-item"><input type="radio" name="basemap" value="carto-voyager" checked onchange="selectBaseMap(this.value)">CARTO Voyager</label>
        <label class="map-layer-item"><input type="radio" name="basemap" value="carto-dark" onchange="selectBaseMap(this.value)">CARTO Dark Matter</label>
        <label class="map-layer-item"><input type="radio" name="basemap" value="carto-positron" onchange="selectBaseMap(this.value)">CARTO Positron</label>
        <label class="map-layer-item"><input type="radio" name="basemap" value="osm" onchange="selectBaseMap(this.value)">OpenStreetMap</label>
        <label class="map-layer-item"><input type="radio" name="basemap" value="esri-ocean" onchange="selectBaseMap(this.value)">ESRI Ocean Base</label>
        <div class="map-layer-divider"></div>
        <div class="map-layer-section-title">Maritime Overlays</div>
        <label class="map-layer-item"><input type="checkbox" checked onchange="toggleLayer('warnings',this.checked)">Warning Markers</label>
        <label class="map-layer-item"><input type="checkbox" checked onchange="toggleLayer('seamarks',this.checked)">OpenSeaMap Seamarks</label>
        <label class="map-layer-item"><input type="checkbox" onchange="toggleLayer('soundings',this.checked)">Ocean Soundings</label>
      </details>
    </div>
    <div class="map-ctrl-topright" role="toolbar" aria-label="Map Navigation Controls">
      <button type="button" class="map-recenter-pill-btn" onclick="resetMapView()" title="Re-center / Locate" aria-label="Re-center navigation area on map">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/><circle cx="12" cy="12" r="8"/></svg>
        <span>Re-center</span>
      </button>
    </div>
    <div class="map-warning-list" id="mapWarningList">
      <div class="panel-header">
        <div style="display:flex;align-items:center;gap:8px">
          <h2>Active Warnings</h2>
          <span class="badge-simple badge-active" id="mapLiveBadge"><span class="dot"></span> 0 live</span>
        </div>
        <div class="panel-actions">
          <button type="button" class="panel-btn" id="btnMinWarningList" onclick="toggleMinimizeWarningList()" title="Minimize" aria-label="Minimize active warnings list">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button type="button" class="panel-btn" id="btnMaxWarningList" onclick="toggleMaximizeWarningList()" title="Maximize" aria-label="Maximize active warnings list">
            <svg id="iconMaxWarningList" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="map-attribution">© OpenStreetMap contributors · CARTO · OpenSeaMap</div>
  </div>
</div>

<!-- DATA BANK -->
<div class="tab-panel" id="tab-data" role="tabpanel" aria-labelledby="tab-btn-data" hidden>
  <div class="page-header">
    <div><h1>Data Bank</h1><p class="subtitle" id="dataSubtitle">0 published warnings</p></div>
    <div class="actions">
      <button class="btn btn-primary" id="btnRefreshSupabase" onclick="refreshSupabaseConnection()">
        <svg style="width:14px;height:14px;display:inline-block;vertical-align:-2px;margin-right:6px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
        <span>Refresh Supabase</span>
      </button>
      <button class="btn btn-secondary" onclick="showToast('Exporting data as CSV/JSON (Offline format)')">Export</button>
    </div>
  </div>
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-icon active" aria-hidden="true">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M4.93 4.93a10 10 0 0 1 14.14 0M7.76 7.76a6 6 0 0 1 8.48 0"/></svg>
      </div>
      <div class="stat-content">
        <div class="stat-label">Active</div>
        <div class="stat-value-row"><span class="stat-value" id="statActive">0</span><span class="stat-sub">In-force</span></div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon coverage" aria-hidden="true">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      </div>
      <div class="stat-content">
        <div class="stat-label">Coverage</div>
        <div class="stat-value-row"><span class="stat-value" id="statCoverage">0/21</span><span class="stat-sub" id="statCoverageSub">0% global</span></div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon high" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div class="stat-content">
        <div class="stat-label">Critical / High</div>
        <div class="stat-value-row"><span class="stat-value" id="statHigh">0</span><span class="stat-sub" id="statHighSub">0 warnings</span></div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon geo" aria-hidden="true">
        <svg viewBox="0 0 24 24"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
      </div>
      <div class="stat-content">
        <div class="stat-label">Georeferenced</div>
        <div class="stat-value-row"><span class="stat-value" id="statGeo">100%</span><span class="stat-sub">GPS Coords</span></div>
      </div>
    </div>
  </div>
  <div class="filter-bar">
    <div class="search">
      <label for="searchInput" class="sr-only">Search warnings</label>
      <input type="search" placeholder="Search warnings..." id="searchInput" oninput="filterTable()" aria-label="Search warnings">
    </div>
    <button class="btn btn-ghost" id="btnToggleFilters" onclick="toggleAdvancedFilters()" aria-expanded="false" aria-controls="advancedFilters">Filters <span id="activeFilterCount" class="badge-simple badge-neutral" style="display:none">0</span></button>
  </div>
  <div class="advanced-filters" id="advancedFilters">
    <div class="filter-grid">
      <div class="filter-group">
        <label for="filter-navarea">NAVAREA</label>
        <select id="filter-navarea" onchange="applyFilters()" aria-label="Filter by NAVAREA">
          <option value="">All Regions</option>
          <option value="NA I">NA I · North Atlantic / UK</option>
          <option value="NA II">NA II · East Atlantic</option>
          <option value="NA III">NA III · Mediterranean</option>
          <option value="NA IV">NA IV · West Atlantic</option>
          <option value="NA V">NA V · Brazil / SW Atlantic</option>
          <option value="NA VI">NA VI · Argentina / SE Atlantic</option>
          <option value="NA VII">NA VII · South Africa</option>
          <option value="NA VIII">NA VIII · Indian Ocean</option>
          <option value="NA IX">NA IX · Red Sea / Persian Gulf</option>
          <option value="NA X">NA X · Australia</option>
          <option value="NA XI">NA XI · East Asia / Japan</option>
          <option value="NA XII">NA XII · East Pacific</option>
          <option value="NA XIII">NA XIII · NW Pacific / Okhotsk</option>
          <option value="NA XIV">NA XIV · New Zealand / S. Pacific</option>
          <option value="NA XV">NA XV · Chile / SE Pacific</option>
          <option value="NA XVI">NA XVI · Peru / E. South Pacific</option>
          <option value="NA XVII">NA XVII · Arctic Canada (West)</option>
          <option value="NA XVIII">NA XVIII · Arctic Canada (East)</option>
          <option value="NA XIX">NA XIX · Arctic Norway</option>
          <option value="NA XX">NA XX · Arctic Russia (Kara/Laptev)</option>
          <option value="NA XXI">NA XXI · Arctic Russia (East Siberian)</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="filter-severity">Severity</label>
        <select id="filter-severity" onchange="applyFilters()" aria-label="Filter by Severity">
          <option value="">All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="moderate">Moderate</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="filter-category">Category</label>
        <select id="filter-category" onchange="applyFilters()" aria-label="Filter by Category">
          <option value="">All</option>
          <option value="military">Military</option>
          <option value="drifting">Drifting</option>
          <option value="general">General</option>
          <option value="aton">AtoN</option>
          <option value="subsea">Subsea</option>
        </select>
      </div>
    </div>
  </div>
  <div class="data-table-container">
    <table class="data-table">
      <caption class="sr-only">Navigational Warnings Data Bank</caption>
      <thead>
        <tr>
          <th scope="col">ID</th>
          <th scope="col">Area</th>
          <th scope="col">Title</th>
          <th scope="col">Severity</th>
          <th scope="col">Issued</th>
          <th scope="col">Coords</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody id="tableBody"></tbody>
    </table>
    <div class="table-footer"><span id="tableCount">Showing 1–0 of 0</span><span>Rows: 10</span></div>
  </div>
  <div class="card-list" id="cardList"></div>
</div>

<!-- SOURCES -->
<div class="tab-panel" id="tab-sources" role="tabpanel" aria-labelledby="tab-btn-sources" hidden>
  <div class="page-header">
    <div><h1>Source Registry</h1><p class="subtitle">14 verified feeds across 21 NAVAREAs</p></div>
  </div>
  <div class="sources-grid" id="sourcesGrid"></div>
</div>
</main>

<nav class="bottom-nav" aria-label="Mobile bottom navigation">
  <div role="tablist" aria-label="Mobile navigation views" style="display:flex;width:100%;align-items:center">
    <button class="bottom-nav-item active" data-bottom-tab="map" role="tab" aria-selected="true" aria-controls="tab-map" onclick="switchTab('map')"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg><span>Map</span><span class="bottom-badge" id="bottomBadge">0</span></button>
    <button class="bottom-nav-item" data-bottom-tab="data" role="tab" aria-selected="false" aria-controls="tab-data" onclick="switchTab('data')"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg><span>Data</span></button>
    <button class="bottom-nav-item" data-bottom-tab="sources" role="tab" aria-selected="false" aria-controls="tab-sources" onclick="switchTab('sources')"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg><span>Sources</span></button>
  </div>
</nav>

<footer class="site-footer">
  <div class="footer-inner">
    <div>Helm.Warning — NAVAREA Maritime Safety Information Pipeline</div>
    <div class="footer-disclaimer">Automated decision-support system. Not a substitute for GMDSS or official MSI.</div>
  </div>
</footer>
</div><!-- /portalView -->

<!-- ════════════════════════════════════════════════════════════════════════════ -->
<!-- ADMIN LOGIN GATE                                                            -->
<!-- ════════════════════════════════════════════════════════════════════════════ -->
<div id="loginView">
  <div class="login-card">
    <div class="login-logo"><span class="logo-badge">HW</span> Helm.Warning</div>
    <div class="login-sub">Admin Console — restricted operator access</div>
    <div class="login-error" id="loginError"></div>
    <form onsubmit="handleLogin(event)">
      <label class="login-label" for="loginEmail">Email</label>
      <input class="login-input" type="email" id="loginEmail" placeholder="admin@helm.warning" autocomplete="username" required>
      <label class="login-label" for="loginPassword">Password</label>
      <input class="login-input" type="password" id="loginPassword" placeholder="••••••••" autocomplete="current-password" required>
      <button class="btn btn-primary" type="submit" id="loginBtn" style="width:100%">Sign In</button>
    </form>
    <div style="text-align:center;margin-top:20px">
      <a href="#" onclick="returnToPublic(); return false;" style="font-size:13px;color:var(--text-light);text-decoration:none">← Back to public maritime portal</a>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════════════════════════════════════ -->
<!-- ADMIN OPERATIONAL APP                                                        -->
<!-- ════════════════════════════════════════════════════════════════════════════ -->
<div id="adminView">
<header class="admin-header">
  <div class="admin-header-inner">
    <div class="admin-brand">
      <span class="logo-badge">HW</span>
      Helm.Warning <span class="admin-chip">Admin</span>
    </div>
    <div class="admin-header-actions">
      <span class="admin-user" id="adminUserEmail"></span>
      <button type="button" class="btn btn-ghost" onclick="returnToPublic()" style="text-decoration:none">View Site ↗</button>
      <button type="button" class="btn btn-sm btn-secondary" onclick="logout()">Sign Out</button>
    </div>
  </div>
</header>

<main class="main" id="adminMain" tabindex="-1">
  <nav class="admin-subnav" aria-label="Admin console navigation">
    <div role="tablist" aria-label="Admin console sections" style="display:flex;gap:4px;width:100%;align-items:center">
      <button class="asub-btn active" data-sub="overview" role="tab" aria-selected="true" onclick="switchAdminSub('overview')">Overview</button>
      <button class="asub-btn" data-sub="pipeline" role="tab" aria-selected="false" onclick="switchAdminSub('pipeline')">Pipeline</button>
      <button class="asub-btn" data-sub="import" role="tab" aria-selected="false" onclick="switchAdminSub('import')">Import</button>
      <button class="asub-btn" data-sub="verify" role="tab" aria-selected="false" onclick="switchAdminSub('verify')">Verify <span class="asub-badge" id="verifyBadge" style="display:none">0</span></button>
      <button class="asub-btn" data-sub="system" role="tab" aria-selected="false" onclick="switchAdminSub('system')">System</button>
    </div>
  </nav>

  <!-- OVERVIEW -->
  <div class="admin-sub active" id="admin-overview">
    <div class="admin-hero">
      <div>
        <div class="hero-status"><span class="status-dot live"></span> Pipeline Operational</div>
        <div class="hero-meta">Cycle operational · background worker active</div>
        <div class="hero-stages"><span class="hero-stage">✓ Fetch</span><span class="hero-stage">✓ Parse</span><span class="hero-stage">✓ Geocode</span><span class="hero-stage">✓ Publish</span></div>
      </div>
      <button class="btn btn-primary" id="runCycleBtn" onclick="runPipelineCycle()">▶ Run Cycle Now</button>
    </div>
    <div class="attention" id="attentionPanel"></div>
    <div class="section-title">Quick Actions</div>
    <div class="qa-row">
      <button class="qa-card" onclick="switchAdminSub('import')"><span class="qa-ico">⬆</span><div><b>Import Data</b><span>Bulk ingestion wizard</span></div></button>
      <button class="qa-card" onclick="switchAdminSub('verify')"><span class="qa-ico">✓</span><div><b>Verify Warnings</b><span id="qaVerifySub">All verified</span></div></button>
    </div>
  </div>

  <!-- PIPELINE -->
  <div class="admin-sub" id="admin-pipeline">
    <div class="stage-row">
      <div class="stage-card" id="stage-fetch"><div class="stage-top"><span class="stage-num">01</span><span class="stage-state" id="st-fetch"><span class="dot"></span> Ready</span></div><div class="stage-name">Fetch Sources</div><div class="stage-desc">Poll coordinators via HTTPS</div></div>
      <div class="stage-arrow">→</div>
      <div class="stage-card" id="stage-parse"><div class="stage-top"><span class="stage-num">02</span><span class="stage-state" id="st-parse"><span class="dot"></span> Ready</span></div><div class="stage-name">Parse &amp; Normalize</div><div class="stage-desc">Tokenize raw text</div></div>
      <div class="stage-arrow">→</div>
      <div class="stage-card" id="stage-geocode"><div class="stage-top"><span class="stage-num">03</span><span class="stage-state" id="st-geocode"><span class="dot"></span> Ready</span></div><div class="stage-name">Geocode Geometry</div><div class="stage-desc">Points, polygons, circles</div></div>
      <div class="stage-arrow">→</div>
      <div class="stage-card" id="stage-publish"><div class="stage-top"><span class="stage-num">04</span><span class="stage-state" id="st-publish"><span class="dot"></span> Ready</span></div><div class="stage-name">Publish Generation</div><div class="stage-desc">Atomic pointer swap</div></div>
    </div>
    <div class="wiz-nav" style="margin:0 0 20px">
      <span></span>
      <button class="btn btn-primary" id="runCycleBtn2" onclick="runPipelineCycle()">▶ Run Cycle Now</button>
    </div>
  </div>

  <!-- IMPORT -->
  <div class="admin-sub" id="admin-import">
    <div class="wizard-steps">
      <div class="wstep active" id="ws1"><span class="wstep-num">1</span>Source</div><div class="wstep-line" id="wl1"></div>
      <div class="wstep" id="ws2"><span class="wstep-num">2</span>Input</div><div class="wstep-line" id="wl2"></div>
      <div class="wstep" id="ws3"><span class="wstep-num">3</span>Validate</div><div class="wstep-line" id="wl3"></div>
      <div class="wstep" id="ws4"><span class="wstep-num">4</span>Publish</div>
    </div>
    <div class="wpanel active" id="wstep1">
      <div class="method-grid">
        <button class="method-card selected" data-method="paste" onclick="selectMethod('paste')"><span class="method-icon">✎</span><div><div class="method-name">Paste Warning Text</div><div class="method-desc">Raw NAVAREA / MSI bulletin text</div></div><span class="method-tag">manual</span></button>
      </div>
      <div class="wiz-nav"><span></span><button class="btn btn-primary" onclick="wizardGo(2)">Continue →</button></div>
    </div>
    <div class="wpanel" id="wstep2">
      <label for="wizInput" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">Raw Warning Bulletin Text</label>
      <textarea class="wiz-textarea" id="wizInput" aria-label="Raw warning bulletin text" placeholder="Paste mixed maritime feed, bulletin, or web dump..." oninput="updateWizCount()"></textarea>
      <div class="wiz-count"><span id="wizCountLabel">0 lines · 0 KB</span></div>
      <div class="wiz-nav">
        <button class="btn btn-secondary" onclick="wizardGo(1)">← Back</button>
        <button class="btn btn-primary" id="wizContinue2" onclick="wizardGo(3)" disabled>Validate →</button>
      </div>
    </div>
    <div class="wpanel" id="wstep3">
      <div class="parse-summary" id="parseSummary"></div>
      <div id="parseResults"></div>
      <div class="wiz-nav">
        <button class="btn btn-secondary" onclick="wizardGo(2)">← Back</button>
        <button class="btn btn-primary" onclick="wizardGo(4)">Review &amp; Publish →</button>
      </div>
    </div>
    <div class="wpanel" id="wstep4">
      <div id="publishArea">
        <div class="publish-review">
          <div class="pr-row"><span class="k">New warnings to publish</span><span class="v" id="prNew">0</span></div>
          <div class="pr-row"><span class="k">Target</span><span class="v">Supabase · public.nav_warnings</span></div>
        </div>
        <div class="wiz-nav"><span></span><button class="btn btn-primary" id="publishBtn" onclick="publishImport()">🔒 Publish Atomically</button></div>
      </div>
      <div id="successArea" style="display:none">
        <div class="success-panel">
          <div class="big">✓</div><h3>Published Successfully</h3>
          <p>New warnings are now live on the public site.</p>
          <div class="gen-id" id="genId"></div>
          <div class="wiz-nav" style="justify-content:center;margin-top:20px">
            <button class="btn btn-secondary" onclick="returnToPublic()">View Public Site ↗</button>
            <button class="btn btn-ghost" onclick="resetWizard()">Start New Import</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- VERIFY -->
  <div class="admin-sub" id="admin-verify">
    <div id="verifyQueue"></div>
  </div>

  <!-- SYSTEM -->
  <div class="admin-sub" id="admin-system">
    <div class="section-title">AI Extraction Chain</div>
    <div class="sys-grid">
      <div class="ai-card"><div class="ai-head"><span class="ai-name">Gemini API</span><span class="badge-simple badge-neutral" id="geminiStatus"><span class="dot"></span> Idle</span></div><div class="ai-meta">gemini-3.1-flash-lite</div><div class="ai-last" id="geminiLast">Last test: never</div><button class="btn btn-sm btn-secondary" id="geminiBtn" onclick="testModel('gemini')">Test Connection</button></div>
    </div>
    <div class="section-title">Database</div>
    <div class="db-status"><span class="status-dot live"></span> Connected — Supabase Postgres</div>
    <div style="margin-bottom:16px; margin-top:8px;">
      <div style="padding:14px 16px; background:var(--surface); border:1px solid var(--border); border-radius:0 0 12px 12px;">
        <pre class="schema-box" id="sqlSchema">CREATE TABLE IF NOT EXISTS public.nav_warnings (
  id UUID DEFAULT gen_random_uuid(),
  warning_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  navarea TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  risk_level TEXT,
  PRIMARY KEY (source_id, warning_id)
);</pre>
      </div>
    </div>
  </div>
</main>
</div><!-- /adminView -->

<!-- SHARED MODALS & NOTIFICATIONS -->
<div class="modal-overlay" id="warningModal" onclick="closeModal(event)" role="dialog" aria-modal="true" aria-labelledby="modalTitle" aria-hidden="true">
  <div class="modal" onclick="event.stopPropagation()">
    <div class="modal-header"><h2 id="modalTitle">Warning</h2><button class="modal-close" onclick="closeWarningModal()" aria-label="Close warning details">✕</button></div>
    <div class="modal-body" id="modalBody"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeWarningModal()">Close</button>
      <button class="btn btn-secondary" onclick="locateOnMap()">Locate on Map</button>
    </div>
  </div>
</div>

<div class="toast" id="toast" role="status" aria-live="polite"></div>

<!-- ════════════════════════════════════════════════════════════════════════════ -->
<!-- INLINED VENDOR LIBRARIES                                                     -->
<!-- ════════════════════════════════════════════════════════════════════════════ -->
<script>
${leafletJs}
</script>

<script>
${supabaseJs}
</script>

<!-- ════════════════════════════════════════════════════════════════════════════ -->
<!-- INLINED APPLICATION SCRIPTS & CONTROLLERS                                    -->
<!-- ════════════════════════════════════════════════════════════════════════════ -->
<script>
${supabaseAppJs}
</script>

<script>
${publicAppJs}
</script>

<script>
${adminAppJs}
</script>

<!-- UNIFIED TRANSITION CONTROLLER -->
<script>
window.openAdmin = function() {
  document.body.classList.remove('admin-active');
  document.body.classList.add('admin-login-active');
  window.checkSession();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.returnToPublic = function() {
  document.body.classList.remove('admin-login-active', 'admin-active');
  document.getElementById('portalView').style.display = 'block';
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('adminView').style.display = 'none';
  const m = typeof getLeafletMap === 'function' ? getLeafletMap() : null;
  if (m) {
    setTimeout(() => m.invalidateSize(), 150);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Hook into enterAdmin to set body class
const _origEnterAdmin = window.enterAdmin;
window.enterAdmin = function(email) {
  document.body.classList.remove('admin-login-active');
  document.body.classList.add('admin-active');
  document.getElementById('portalView').style.display = 'none';
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('adminView').style.display = 'block';
  document.getElementById('adminUserEmail').textContent = email;
  if (typeof loadAdminData === 'function') loadAdminData();
};

const _origLogout = window.logout;
window.logout = async function() {
  if (window.hwSupabase) {
    try { await window.hwSupabase.auth.signOut(); } catch(_) {}
  }
  sessionStorage.removeItem('hw_admin_session');
  returnToPublic();
  showToast('Signed out of admin console');
};
</script>
</body>
</html>
`;

const outputPath = path.join(rootDir, 'public/export/helm-warning-complete.html');
fs.writeFileSync(outputPath, bundleHtml, 'utf8');

console.log('Successfully generated complete single-file bundle at:');
console.log(outputPath);
console.log('File size:', (Buffer.byteLength(bundleHtml, 'utf8') / 1024).toFixed(1), 'KB');

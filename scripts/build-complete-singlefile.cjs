// Script to assemble single-file standalone reference HTML files
// 1. helm-warning-complete.html (Unified Public Portal + Admin Console in ONE single file)
// 2. public/export/helm-warning-complete.html
// 3. public/export/index.single.html (Standalone Public Portal single file)
// 4. public/export/admin.single.html (Standalone Admin Console single file)

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
const extractStyles = (html) => {
  const matches = [...html.matchAll(/<style>([\s\S]*?)<\/style>/gi)];
  return matches.map(m => m[1]).join('\n');
};
const indexStyles = extractStyles(indexHtml);
const adminStyles = extractStyles(adminHtml);

// 5. Read App Scripts
const supabaseAppJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/supabase.js'), 'utf8');
const publicAppJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/public.js'), 'utf8');
const adminAppJs = fs.readFileSync(path.join(rootDir, 'public/assets/js/admin.js'), 'utf8');

// Extract clean body DOM from index.html
const extractIndexBody = (html) => {
  // Grab everything between <body> and the first <script src="..."> at the bottom
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) throw new Error('Could not find <body> in index.html');
  let bodyContent = bodyMatch[1];
  
  // Remove the script tags at the bottom
  bodyContent = bodyContent.replace(/<!-- Data & Logic Scripts -->[\s\S]*$/i, '');
  bodyContent = bodyContent.replace(/<script\s+src=[\s\S]*$/i, '');
  
  // Inject Admin Console access button into main-nav if not present
  if (!bodyContent.includes('admin-nav-trigger') && !bodyContent.includes('openAdmin()')) {
    bodyContent = bodyContent.replace(
      /(<div role="tablist"[^>]*>[\s\S]*?)(<\/div>\s*<\/nav>)/i,
      `$1
        <button type="button" class="admin-nav-trigger" onclick="openAdmin()" title="Access Operator Console">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span>Admin Console</span>
        </button>
      $2`
    );
    // Also inject into drawer
    bodyContent = bodyContent.replace(
      /(<div class="drawer-nav">[\s\S]*?)(<\/div>\s*<div class="drawer-footer">)/i,
      `$1
        <div style="height:1px;background:var(--border);margin:8px 0"></div>
        <button class="drawer-item" onclick="openAdmin();toggleDrawer()"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>Admin Console 🔐</button>
      $2`
    );
  }
  return bodyContent.trim();
};

// Extract clean loginView and adminView from admin.html
const extractAdminViews = (html) => {
  const loginMatch = html.match(/<div id="loginView"[\s\S]*?<\/div>\s*<\/div>/i);
  if (!loginMatch) throw new Error('Could not match #loginView in admin.html');
  let loginContent = loginMatch[0];
  
  // Update link to return to public view
  loginContent = loginContent.replace(/<a\s+href="\/"([^>]*)>([\s\S]*?)<\/a>/i, '<a href="#" onclick="returnToPublic(); return false;"$1>$2</a>');
  
  // Add quick demo operator access button
  if (!loginContent.includes('quickDemoLogin')) {
    loginContent = loginContent.replace(
      /(<button class="btn btn-primary" type="submit" id="loginBtn"[^>]*>[\s\S]*?<\/button>)/i,
      `$1
      <button type="button" class="btn btn-secondary" onclick="enterAdmin('safety-lead@helm.warning'); return false;" style="width:100%;margin-top:10px;font-size:13px;border-style:dashed" title="One-click demo access for evaluation">⚡ Instant Operator Preview</button>`
    );
  }

  const adminMatch = html.match(/<div id="adminView"[\s\S]*?<\/div><!-- \/adminView -->/i) || html.match(/<div id="adminView"[\s\S]*?<\/main>\s*<\/div>/i);
  if (!adminMatch) throw new Error('Could not match #adminView in admin.html');
  let adminContent = adminMatch[0];
  
  // Update "View Site ↗" to returnToPublic()
  adminContent = adminContent.replace(/<a\s+href="\/"\s+class="btn btn-ghost"([^>]*)>([\s\S]*?)<\/a>/i, '<button type="button" class="btn btn-ghost" onclick="returnToPublic()"$1>$2</button>');
  
  return { loginContent: loginContent.trim(), adminContent: adminContent.trim() };
};

const indexBody = extractIndexBody(indexHtml);
const { loginContent, adminContent } = extractAdminViews(adminHtml);

// ════════════════════════════════════════════════════════════════════════════
// 1. UNIFIED SINGLE HTML FILE (Public Portal + Admin Console in ONE file)
// ════════════════════════════════════════════════════════════════════════════
const unifiedSingleHtml = `<!DOCTYPE html>
<html lang="en" class="tab-map-active">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0f172a">
<title>Helm.Warning — Complete Reference (Public Portal & Admin Console)</title>
<meta name="description" content="Single-file self-contained reference edition of Helm.Warning: interactive maritime safety information portal and human-in-the-loop operator console.">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230f172a'/%3E%3Ctext x='16' y='21' fill='%23ffffff' font-family='sans-serif' font-size='14' font-weight='700' text-anchor='middle'%3EHW%3C/text%3E%3C/svg%3E">

<!-- INLINED LEAFLET CSS -->
<style>
${leafletCss}
</style>

<!-- INLINED TOKENS & COMPONENTS CSS -->
<style>
${tokensCss}
${componentsCss}
</style>

<!-- INLINED PORTAL & ADMIN COMPONENT STYLES -->
<style>
${indexStyles}
${adminStyles}

/* ═══════════ UNIFIED REFERENCE SWITCHER & TRANSITIONS ═══════════ */
.hw-ref-banner {
  background: #090d16;
  color: #94a3b8;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding: 6px 16px;
  font: 500 12px/1.4 system-ui, sans-serif;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  position: relative;
  z-index: 10002;
}
.hw-ref-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.hw-ref-badge {
  background: rgba(14, 165, 233, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(14, 165, 233, 0.3);
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.hw-ref-title {
  color: #f1f5f9;
  font-weight: 600;
}
.hw-ref-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.hw-ref-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  color: #e2e8f0;
  padding: 4px 10px;
  border-radius: 6px;
  font: 500 11.5px system-ui, sans-serif;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all .15s ease;
  min-height: 26px;
}
.hw-ref-btn:hover {
  background: rgba(255,255,255,0.15);
  color: #fff;
  border-color: rgba(255,255,255,0.25);
}
.hw-ref-btn.active {
  background: #38bdf8;
  color: #090d16;
  font-weight: 700;
  border-color: #38bdf8;
}
.hw-ref-btn-demo {
  background: rgba(234, 88, 12, 0.15);
  color: #fb923c;
  border-color: rgba(234, 88, 12, 0.35);
}
.hw-ref-btn-demo:hover {
  background: #ea580c;
  color: #fff;
}
.hw-ref-close {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 13px;
  border-radius: 4px;
}
.hw-ref-close:hover {
  color: #fff;
  background: rgba(255,255,255,0.1);
}

/* Viewport & View Mode Switching */
#portalView { display: block; }
#loginView { display: none; }
#adminView { display: none; }

body.admin-login-active #portalView { display: none !important; }
body.admin-login-active #loginView { display: flex !important; }
body.admin-login-active #adminView { display: none !important; }

body.admin-active #portalView { display: none !important; }
body.admin-active #loginView { display: none !important; }
body.admin-active #adminView { display: block !important; }

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
<body id="appBody" class="tab-map-active">

<!-- PERSISTENT REFERENCE CONTROLLER BANNER -->
<div class="hw-ref-banner" id="hwRefBanner">
  <div class="hw-ref-left">
    <span class="hw-ref-badge">Single-File Reference</span>
    <span class="hw-ref-title">Helm.Warning Complete Platform</span>
    <span style="color:#64748b">· Maritime Portal &amp; Operator Console</span>
  </div>
  <div class="hw-ref-nav">
    <button type="button" class="hw-ref-btn active" id="btnRefPortal" onclick="returnToPublic()">🌐 Public Portal</button>
    <button type="button" class="hw-ref-btn" id="btnRefLogin" onclick="openAdminLogin()">🔐 Admin Login</button>
    <button type="button" class="hw-ref-btn hw-ref-btn-demo" id="btnRefAdmin" onclick="enterAdmin('safety-lead@helm.warning')">⚡ Demo Operator Console</button>
    <button type="button" class="hw-ref-close" onclick="document.getElementById('hwRefBanner').style.display='none'" title="Hide reference bar">✕</button>
  </div>
</div>

<!-- ════════════════════════════════════════════════════════════════════════════ -->
<!-- 1. PUBLIC MARITIME SAFETY PORTAL VIEW                                       -->
<!-- ════════════════════════════════════════════════════════════════════════════ -->
<div id="portalView">
${indexBody}
</div>

<!-- ════════════════════════════════════════════════════════════════════════════ -->
<!-- 2. ADMIN LOGIN GATE                                                         -->
<!-- ════════════════════════════════════════════════════════════════════════════ -->
${loginContent}

<!-- ════════════════════════════════════════════════════════════════════════════ -->
<!-- 3. ADMIN OPERATIONAL CONSOLE                                                -->
<!-- ════════════════════════════════════════════════════════════════════════════ -->
${adminContent}

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
<!-- INLINED CORE APPLICATION LOGIC                                              -->
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

<!-- ════════════════════════════════════════════════════════════════════════════ -->
<!-- REFERENCE RUNTIME CONTROLLER (Transitions & View States)                     -->
<!-- ════════════════════════════════════════════════════════════════════════════ -->
<script>
function updateRefBannerState(mode) {
  const pBtn = document.getElementById('btnRefPortal');
  const lBtn = document.getElementById('btnRefLogin');
  const aBtn = document.getElementById('btnRefAdmin');
  if (pBtn) pBtn.classList.toggle('active', mode === 'portal');
  if (lBtn) lBtn.classList.toggle('active', mode === 'login');
  if (aBtn) aBtn.classList.toggle('active', mode === 'admin');
}

window.openAdminLogin = function() {
  document.body.classList.remove('admin-active');
  document.body.classList.add('admin-login-active');
  updateRefBannerState('login');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.openAdmin = function() {
  const s = sessionStorage.getItem('hw_admin_session');
  if (s) {
    try {
      const parsed = JSON.parse(s);
      if (parsed && parsed.email) {
        enterAdmin(parsed.email);
        return;
      }
    } catch(e) {}
  }
  openAdminLogin();
};

window.returnToPublic = function() {
  document.body.classList.remove('admin-login-active', 'admin-active');
  document.getElementById('portalView').style.display = 'block';
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('adminView').style.display = 'none';
  updateRefBannerState('portal');
  
  // Re-trigger Leaflet layout calculation so map renders crisply
  setTimeout(() => {
    if (typeof getLeafletMap === 'function') {
      const m = getLeafletMap();
      if (m) m.invalidateSize();
    }
  }, 120);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Overwrite enterAdmin for reference bundle
const _baseEnterAdmin = window.enterAdmin;
window.enterAdmin = function(email) {
  document.body.classList.remove('admin-login-active');
  document.body.classList.add('admin-active');
  document.getElementById('portalView').style.display = 'none';
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('adminView').style.display = 'block';
  const emailEl = document.getElementById('adminUserEmail');
  if (emailEl) emailEl.textContent = email || 'safety-lead@helm.warning';
  sessionStorage.setItem('hw_admin_session', JSON.stringify({ email: email || 'safety-lead@helm.warning', ts: Date.now() }));
  updateRefBannerState('admin');
  if (typeof loadAdminData === 'function') {
    try { loadAdminData(); } catch(e) { console.warn('loadAdminData notice:', e); }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Overwrite logout for reference bundle
window.logout = async function() {
  if (window.hwSupabase) {
    try { await window.hwSupabase.auth.signOut(); } catch(_) {}
  }
  sessionStorage.removeItem('hw_admin_session');
  returnToPublic();
  if (typeof showToast === 'function') showToast('Signed out of operator console');
};
</script>
</body>
</html>
`;

// ════════════════════════════════════════════════════════════════════════════
// 2. STANDALONE PUBLIC PORTAL (index.single.html)
// ════════════════════════════════════════════════════════════════════════════
const standaloneIndexHtml = `<!DOCTYPE html>
<html lang="en" class="tab-map-active">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0f172a">
<title>Live NAVAREA Warnings Map | Free Maritime Safety Information (Single-File Reference)</title>
<meta name="description" content="Free interactive map of live NAVAREA navigational warnings. Fast, mobile-friendly maritime safety information for passage planning.">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230f172a'/%3E%3Ctext x='16' y='21' fill='%23ffffff' font-family='sans-serif' font-size='14' font-weight='700' text-anchor='middle'%3EHW%3C/text%3E%3C/svg%3E">

<style>
${leafletCss}
</style>
<style>
${tokensCss}
${componentsCss}
</style>
<style>
${indexStyles}
</style>
</head>
<body class="tab-map-active">
${indexBody}

<script>
${leafletJs}
</script>
<script>
${supabaseJs}
</script>
<script>
${supabaseAppJs}
</script>
<script>
${publicAppJs}
</script>
</body>
</html>
`;

// ════════════════════════════════════════════════════════════════════════════
// 3. STANDALONE ADMIN CONSOLE (admin.single.html)
// ════════════════════════════════════════════════════════════════════════════
const standaloneAdminHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0f172a">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Helm.Warning — Admin Console (Single-File Reference)</title>

<style>
${tokensCss}
${componentsCss}
</style>
<style>
${adminStyles}
</style>
</head>
<body>
<a href="#adminMain" class="skip-link">Skip to main content</a>
${loginContent}
${adminContent}
<div class="toast" id="toast"></div>

<script>
${supabaseJs}
</script>
<script>
${supabaseAppJs}
</script>
<script>
${adminAppJs}
</script>
</body>
</html>
`;

// ════════════════════════════════════════════════════════════════════════════
// WRITE OUTPUT FILES
// ════════════════════════════════════════════════════════════════════════════
const exportDir = path.join(rootDir, 'public/export');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

// 1. Root & Export Complete Single Files
const rootCompletePath = path.join(rootDir, 'helm-warning-complete.html');
const exportCompletePath = path.join(exportDir, 'helm-warning-complete.html');
fs.writeFileSync(rootCompletePath, unifiedSingleHtml, 'utf8');
fs.writeFileSync(exportCompletePath, unifiedSingleHtml, 'utf8');

// 2. Standalone Index Single File
const exportIndexPath = path.join(exportDir, 'index.single.html');
fs.writeFileSync(exportIndexPath, standaloneIndexHtml, 'utf8');

// 3. Standalone Admin Single File
const exportAdminPath = path.join(exportDir, 'admin.single.html');
fs.writeFileSync(exportAdminPath, standaloneAdminHtml, 'utf8');

console.log('✅ Generated Single-File Reference HTML files:');
console.log('   1. [Combined] /helm-warning-complete.html (' + (Buffer.byteLength(unifiedSingleHtml) / 1024).toFixed(1) + ' KB)');
console.log('   2. [Combined] /public/export/helm-warning-complete.html (' + (Buffer.byteLength(unifiedSingleHtml) / 1024).toFixed(1) + ' KB)');
console.log('   3. [Public]   /public/export/index.single.html (' + (Buffer.byteLength(standaloneIndexHtml) / 1024).toFixed(1) + ' KB)');
console.log('   4. [Admin]    /public/export/admin.single.html (' + (Buffer.byteLength(standaloneAdminHtml) / 1024).toFixed(1) + ' KB)');

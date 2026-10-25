// scripts/navarea-pages/navareaConfig.mjs
// Single source of truth for the 21 public NAVAREA regional pages
// (/navarea/I ... /navarea/XXI). Pure module: no Node APIs. Imported by the
// generator (generate-navarea-pages.mjs) and the vitest route-matrix suite.
//
// Rendering decision (Phase G): the public site is a static Vite page with no
// router, so regional pages are PRERENDERED from this config at build time;
// only the live warning list is hydrated client-side via the existing public
// anon Supabase access (assets/js/supabase.js).
//
// Stored warning records use navarea codes like 'NA I' ... 'NA XXI'
// (see public/index.html map filter and src/services/navWarningQueries.ts).

export const SITE_URL = 'https://helmwarning.vercel.app';

export const NAVAREA_REGIONS = [
  { id: 'I',     shortLabel: 'North Atlantic / UK',           waters: 'the Northeast Atlantic, North Sea and waters around the United Kingdom and Ireland', authority: 'the United Kingdom Hydrographic Office (UKHO)' },
  { id: 'II',    shortLabel: 'East Atlantic',                waters: 'the Northeast Atlantic and Bay of Biscay', authority: 'the Service Hydrographique et Oceanographique de la Marine (SHOM, France)' },
  { id: 'III',   shortLabel: 'Mediterranean',                waters: 'the Mediterranean and Black Seas', authority: 'the Instituto Hidrografico de la Marina (IHM, Spain)' },
  { id: 'IV',    shortLabel: 'West Atlantic',                waters: 'the Western North Atlantic and Gulf of Mexico', authority: 'the National Geospatial-Intelligence Agency (NGA, United States)' },
  { id: 'V',     shortLabel: 'Brazil / SW Atlantic',         waters: 'the Southwest Atlantic off Brazil', authority: 'the Diretoria de Hidrografia e Navegacao (DHN, Brazil)' },
  { id: 'VI',    shortLabel: 'Argentina / SE Atlantic',      waters: 'the Southeast Atlantic off Argentina', authority: 'the Servicio de Hidrografia Naval (SHN, Argentina)' },
  { id: 'VII',   shortLabel: 'South Africa',                 waters: 'the waters off South Africa and the Southern Ocean', authority: 'the South African Navy Hydrographic Office' },
  { id: 'VIII',  shortLabel: 'Indian Ocean',                 waters: 'the North Indian Ocean', authority: 'the Indian Navy Hydrographic Department (INHD)' },
  { id: 'IX',    shortLabel: 'Red Sea / Persian Gulf',        waters: 'the Red Sea, Persian Gulf and Arabian Sea', authority: 'the Pakistan Navy Hydrographic Department (PNHD)' },
  { id: 'X',     shortLabel: 'Australia',                    waters: 'the waters off Australia and the Coral Sea', authority: 'the Australian Maritime Safety Authority (AMSA)' },
  { id: 'XI',    shortLabel: 'East Asia / Japan',            waters: 'the waters off East Asia, the South China Sea and Japan', authority: 'the Japan Coast Guard (JCG)' },
  { id: 'XII',   shortLabel: 'East Pacific',                waters: 'the Eastern Pacific and waters off the United States West Coast', authority: 'the National Geospatial-Intelligence Agency (NGA, United States)' },
  { id: 'XIII',  shortLabel: 'NW Pacific / Okhotsk',         waters: 'the Northwest Pacific and Sea of Okhotsk', authority: 'the Federal Agency for Maritime and River Transport of Russia (Rosmorrechflot)' },
  { id: 'XIV',   shortLabel: 'New Zealand / S. Pacific',     waters: 'the waters off New Zealand and the South Pacific', authority: 'Land Information New Zealand (LINZ)' },
  { id: 'XV',    shortLabel: 'Chile / SE Pacific',            waters: 'the Southeast Pacific off Chile', authority: 'the Servicio Hidrografico y Oceanografico de la Armada de Chile (SHOA)' },
  { id: 'XVI',   shortLabel: 'Peru / E. South Pacific',      waters: 'the Southeast Pacific off Peru', authority: 'the Direccion de Hidrografia y Navegacion (DHN, Peru)' },
  { id: 'XVII',  shortLabel: 'Arctic Canada (West)',         waters: 'the Arctic waters of Western Canada', authority: 'the Canadian Coast Guard (CCG)' },
  { id: 'XVIII', shortLabel: 'Arctic Canada (East)',         waters: 'the Arctic waters of Eastern Canada', authority: 'the Canadian Coast Guard (CCG)' },
  { id: 'XIX',   shortLabel: 'Arctic Norway',                waters: 'the Arctic waters off Norway', authority: 'the Norwegian Coastal Administration' },
  { id: 'XX',    shortLabel: 'Arctic Russia (Kara/Laptev)',  waters: 'the Arctic waters of Russia including the Kara and Laptev Seas', authority: 'the Federal Agency for Maritime and River Transport of Russia (Rosmorrechflot)' },
  { id: 'XXI',   shortLabel: 'Arctic Russia (East Siberian)', waters: 'the Arctic waters of Russia including the East Siberian Sea', authority: 'the Federal Agency for Maritime and River Transport of Russia (Rosmorrechflot)' }
];

export const VALID_IDS = NAVAREA_REGIONS.map(function (r) { return r.id; });

export function isValidNavareaId(id) {
  return typeof id === 'string' && VALID_IDS.indexOf(id) !== -1;
}

// Stored navarea code in nav_warnings: 'NA I' ... 'NA XXI'.
export function navareaCode(id) {
  if (!isValidNavareaId(id)) throw new Error('Invalid NAVAREA id: ' + String(id));
  return 'NA ' + id;
}

export function canonicalPath(id) {
  if (!isValidNavareaId(id)) throw new Error('Invalid NAVAREA id: ' + String(id));
  return '/navarea/' + id;
}

// Deep link onto the existing map with the region preselected (handled by
// the small ?navarea= patch in public/assets/js/public.js).
export function navareaMapHref(id) {
  return '/?navarea=' + encodeURIComponent(navareaCode(id));
}

// Normalizes whatever the database stores for a warning's navarea field.
// Tolerates 'NA I', 'na i' and 'NAVAREA I'; returns the canonical id or null.
export function normalizeStoredNavarea(value) {
  if (typeof value !== 'string') return null;
  const parts = value.toUpperCase().trim().split(' ').filter(Boolean);
  if (parts.length === 0) return null;
  const token = parts[parts.length - 1];
  return isValidNavareaId(token) ? token : null;
}

export function belongsToNavarea(warning, requested) {
  if (!isValidNavareaId(requested)) return false;
  const stored = warning && typeof warning.navarea === 'string' ? warning.navarea : null;
  return normalizeStoredNavarea(stored) === requested;
}

const PAGE_CSS = [
  'body{margin:0;background:var(--bg);color:var(--text);font:400 15px/1.65 system-ui,-apple-system,sans-serif}',
  '.site-header{background:var(--surface-dark);border-bottom:1px solid var(--border)}',
  '.site-header .inner{max-width:820px;margin:0 auto;padding:14px 20px}',
  '.logo{display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:#fff;font-weight:600;font-size:16px}',
  '.logo-badge{width:28px;height:28px;border-radius:7px;background:var(--verified);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}',
  '.page{max-width:820px;margin:0 auto;padding:24px 20px 48px}',
  'h1{font:var(--font-h1);margin:0 0 12px}',
  'h2{font:var(--font-h2);margin:30px 0 12px}',
  'p{margin:0 0 14px;color:var(--text)}',
  'p.muted,p.lead-note{color:var(--text-muted);font-size:13.5px}',
  '.crumbs{font-size:13px;color:var(--text-muted);margin:0 0 18px}',
  '.crumbs a{color:var(--text-muted)}',
  '.crumbs a:hover{color:var(--text)}',
  '.overview{font-size:14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px}',
  '.btn-map{display:inline-flex;align-items:center;gap:8px;margin:0 0 14px;padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);text-decoration:none;font-weight:600;min-height:var(--touch-min)}',
  '.btn-map:hover{border-color:var(--text-light)}',
  '.warn-item{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin:0 0 10px;padding:0}',
  '.warn-item summary{padding:12px 16px;cursor:pointer;min-height:var(--touch-min);display:block}',
  '.warn-id{font-weight:700;display:block}',
  '.warn-title{font-weight:600;display:block}',
  '.warn-date{font-size:12px;color:var(--text-muted);display:block}',
  '.warn-body{padding:0 16px 14px}',
  '.warn-text{background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;font:12px/1.6 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word;overflow-x:auto;margin:0}',
  '.warn-meta{font-size:12.5px;color:var(--text-muted);margin:8px 0 0}',
  '.warn-maplink{font-size:13px;display:inline-block;margin-top:8px}',
  '#loadMore{display:inline-block;padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);font:600 14px system-ui;cursor:pointer;min-height:var(--touch-min)}',
  '#loadMore:hover{border-color:var(--text-light)}',
  '#loadMore[hidden]{display:none}',
  '.empty,.error{background:var(--surface);border:1px solid var(--border);border-left:3px solid #f59e0b;border-radius:var(--radius);padding:14px 16px;font-size:14px}',
  '.region-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px 16px;padding:0;list-style:none;margin:0 0 14px}',
  '.region-grid a{color:var(--text-muted);text-decoration:none;font-size:13px}',
  '.region-grid a:hover{color:var(--text)}',
  '.region-grid a[aria-current=page]{color:var(--text);font-weight:600}',
  '.disclaimer-box{background:var(--surface);border:1px solid var(--border);border-left:3px solid #f59e0b;border-radius:var(--radius);padding:14px 16px;margin:12px 0 0;font-size:13.5px;color:var(--text-muted)}',
  'footer.site{background:var(--surface);border-top:1px solid var(--border);padding:20px;text-align:center;font-size:12.5px;color:var(--text-light);padding-bottom:calc(20px + var(--safe-bottom))}',
  'footer.site p{margin:0 0 6px;color:var(--text-light)}',
  'footer.site p:last-child{margin:0}',
  'footer.site a{color:var(--text-muted)}'
].join('');

// Renders one complete, self-contained regional page. Pure string output —
// the same function produces the committed files and the build-time output.
export function buildPageHtml(r) {
  const code = navareaCode(r.id);
  const path = canonicalPath(r.id);
  const url = SITE_URL + path;
  const mapHref = navareaMapHref(r.id);
  const title = 'NAVAREA ' + r.id + ' Navigational Warnings | Helm.Warning';
  const description = 'Live NAVAREA ' + r.id + ' navigational warnings (' + r.shortLabel + '). View in-force maritime safety information for ' + r.waters + ', read the original warning bulletins, and open the region on the interactive Helm.Warning map.';
  const lead = 'NAVAREA ' + r.id + ' covers ' + r.waters + '. This page lists the in-force navigational warnings Helm.Warning currently holds for the region, as broadcast by the area coordinator, ' + r.authority + ', under the World-Wide Navigational Warning Service (WWNWS).';
  const jsonLd = '{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[' +
    '{"@type":"ListItem","position":1,"name":"Home","item":"' + SITE_URL + '/"},' +
    '{"@type":"ListItem","position":2,"name":"NAVAREA ' + r.id + '","item":"' + url + '"}]}';
  const cfgJson = '{"id":"' + r.id + '","code":"' + code + '"}';
  const regionLinks = NAVAREA_REGIONS.map(function (x) {
    const cur = x.id === r.id ? ' aria-current="page"' : '';
    return '        <li><a href="' + canonicalPath(x.id) + '"' + cur + '>NAVAREA ' + x.id + ' &middot; ' + x.shortLabel + '</a></li>';
  }).join('\n');
  const lines = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">',
    '<meta name="theme-color" content="#0f172a">',
    '<title>' + title + '</title>',
    '<meta name="description" content="' + description + '">',
    '<link rel="canonical" href="' + url + '">',
    '<meta name="robots" content="index, follow">',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Helm.Warning">',
    '<meta property="og:title" content="' + title + '">',
    '<meta property="og:description" content="' + description + '">',
    '<meta property="og:url" content="' + url + '">',
    '<meta property="og:image" content="' + SITE_URL + '/og-preview.png">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + title + '">',
    '<meta name="twitter:description" content="' + description + '">',
    '<script type="application/ld+json">' + jsonLd + '</' + 'script>',
    '<link rel="stylesheet" href="/assets/css/tokens.css">',
    '<style>' + PAGE_CSS + '</style>',
    '</head>',
    '<body>',
    '<header class="site-header">',
    '  <div class="inner">',
    '    <a href="/" class="logo"><span class="logo-badge" aria-hidden="true">HW</span><span>Helm.Warning</span></a>',
    '  </div>',
    '</header>',
    '',
    '<main class="page">',
    '  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>NAVAREA ' + r.id + '</span></nav>',
    '  <h1>NAVAREA ' + r.id + ' Navigational Warnings</h1>',
    '  <p class="lead">' + lead + '</p>',
    '  <a class="btn-map" href="' + mapHref + '">View NAVAREA ' + r.id + ' on the live map</a>',
    '  <p class="overview" id="overviewLine">In-force warnings: <strong id="statCount">&mdash;</strong> &middot; Database last updated: <strong id="statUpdated">&mdash;</strong></p>',
    '',
    '  <section>',
    '    <h2>In-force warnings</h2>',
    '    <div id="warningList" aria-live="polite"></div>',
    '    <p id="emptyState" class="empty" hidden>No in-force warnings for NAVAREA ' + r.id + ' are currently held in the Helm.Warning database. The region may genuinely have no active broadcasts, or the daily ingestion pipeline may not have run recently &mdash; always verify with the official coordinator broadcasts described below.</p>',
    '    <p id="errorState" class="error" hidden role="alert">The live warning list for NAVAREA ' + r.id + ' could not be loaded right now. The regional information on this page is still valid &mdash; retry later, use the live map, or check the official coordinator broadcasts.</p>',
    '    <button id="loadMore" type="button" hidden>Load more warnings</button>',
    '    <noscript><p class="muted">Enable JavaScript to load the live warning list for this region.</p></noscript>',
    '    <p class="lead-note">Each entry expands to the complete original bulletin text. Warnings whose coordinates could not be plotted on the map are still listed here in full.</p>',
    '  </section>',
    '',
    '  <section>',
    '    <h2>About NAVAREA ' + r.id + '</h2>',
    '    <p>NAVAREA ' + r.id + ' is one of the 21 ocean regions of the World-Wide Navigational Warning Service (WWNWS), coordinated jointly by the International Maritime Organization (IMO) and the International Hydrographic Organization (IHO). The designated area coordinator is ' + r.authority + ', which issues and cancels the region&rsquo;s navigational warnings. Helm.Warning aggregates these broadcasts daily from verified official feeds and plots them on the live map.</p>',
    '    <p>Helm.Warning is a convenience copy of these broadcasts, not an official source of Maritime Safety Information. Always verify against official channels (NAVTEX, Inmarsat SafetyNET) as required by SOLAS &mdash; see the <a href="/about">about and disclaimer</a> page for the full safety notice.</p>',
    '  </section>',
    '',
    '  <section>',
    '    <h2>All NAVAREA regions</h2>',
    '    <ul class="region-grid">',
    regionLinks,
    '    </ul>',
    '  </section>',
    '',
    '  <p class="disclaimer-box">Situational awareness only. Not a substitute for GMDSS, NAVTEX or SafetyNET broadcasts. Official broadcasts and the Master&rsquo;s judgment always take priority.</p>',
    '</main>',
    '',
    '<footer class="site">',
    '  <p>Helm.Warning &mdash; NAVAREA Maritime Safety Information Pipeline</p>',
    '  <p><a href="/">Live warnings map</a> &middot; <a href="/about">About &amp; Disclaimer</a></p>',
    '</footer>',
    '',
    '<script type="application/json" id="navareaPageConfig">' + cfgJson + '</' + 'script>',
    '<script defer src="https://unpkg.com/@supabase/supabase-js@2.117.3/dist/umd/supabase.js" integrity="sha256-1qXEQUpdTOZG2cHeIjqnBn0/9mTBU5T/63/P/HYzVKM=" crossorigin="anonymous"></' + 'script>',
    '<script defer src="/assets/js/supabase.js"></' + 'script>',
    '<script defer src="/assets/js/navarea-page.js"></' + 'script>',
    '</body>',
    '</html>'
  ];
  return lines.join('\n');
}

// Regenerates public/sitemap.xml: homepage + about + the 21 regional pages.
export function buildSitemapXml(todayIso) {
  const entries = [
    { loc: SITE_URL + '/', freq: 'daily', priority: '1.0' },
    { loc: SITE_URL + '/about', freq: 'monthly', priority: '0.6' }
  ];
  for (const r of NAVAREA_REGIONS) {
    entries.push({ loc: SITE_URL + canonicalPath(r.id), freq: 'daily', priority: '0.8' });
  }
  const urls = entries.map(function (e) {
    return '  <url>\n    <loc>' + e.loc + '</loc>\n    <lastmod>' + todayIso + '</lastmod>\n    <changefreq>' + e.freq + '</changefreq>\n    <priority>' + e.priority + '</priority>\n  </url>';
  }).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n';
}

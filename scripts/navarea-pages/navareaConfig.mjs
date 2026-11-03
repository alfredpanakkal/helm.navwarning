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
  { id: 'I',     shortLabel: 'North Atlantic / UK',           waters: 'the Northeast Atlantic, North Sea and waters around the United Kingdom and Ireland', authority: 'the United Kingdom Hydrographic Office (UKHO)', ingest: 'automated', sourceUrl: 'https://msi.admiralty.co.uk/RadioNavigationalWarnings', sourceLabel: 'UKHO Admiralty radio navigational warnings' },
  { id: 'II',    shortLabel: 'East Atlantic',                waters: 'the Northeast Atlantic and Bay of Biscay', authority: 'the Service Hydrographique et Oceanographique de la Marine (SHOM, France)', ingest: 'manual' },
  { id: 'III',   shortLabel: 'Mediterranean',                waters: 'the Mediterranean and Black Seas', authority: 'the Instituto Hidrografico de la Marina (IHM, Spain)', ingest: 'automated', sourceUrl: 'https://armada.defensa.gob.es/ihm/XML/navareas_crudo.xml', sourceLabel: 'IHM Armada (Spain) NAVAREA XML snapshot' },
  { id: 'IV',    shortLabel: 'West Atlantic',                waters: 'the Western North Atlantic and Gulf of Mexico', authority: 'the National Geospatial-Intelligence Agency (NGA, United States)', ingest: 'automated', sourceUrl: 'https://msi.nga.mil/apology_objects/DailyMemIV.txt', sourceLabel: 'NGA (US) Daily Memo IV' },
  { id: 'V',     shortLabel: 'Brazil / SW Atlantic',         waters: 'the Southwest Atlantic off Brazil', authority: 'the Diretoria de Hidrografia e Navegacao (DHN, Brazil)', ingest: 'restricted', sourceUrl: 'https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/avisos-radio-nauticos-e-sar', sourceLabel: 'CHM Marinha (Brazil) portal' },
  { id: 'VI',    shortLabel: 'Argentina / SE Atlantic',      waters: 'the Southeast Atlantic off Argentina', authority: 'the Servicio de Hidrografia Naval (SHN, Argentina)', ingest: 'manual' },
  { id: 'VII',   shortLabel: 'South Africa',                 waters: 'the waters off South Africa and the Southern Ocean', authority: 'the South African Navy Hydrographic Office', ingest: 'automated', sourceUrl: 'https://www.sanho.co.za/notices_mariners/navarea_v11_messages.htm?b2=NAVAREA+VII', sourceLabel: 'SANHO (South Africa) notices to mariners' },
  { id: 'VIII',  shortLabel: 'Indian Ocean',                 waters: 'the North Indian Ocean', authority: 'the Indian Navy Hydrographic Department (INHD)', ingest: 'automated', sourceUrl: 'https://hydrobharat.gov.in/navarea-warnings', sourceLabel: 'NHO India — HydroBharat portal' },
  { id: 'IX',    shortLabel: 'Red Sea / Persian Gulf',        waters: 'the Red Sea, Persian Gulf and Arabian Sea', authority: 'the Pakistan Navy Hydrographic Department (PNHD)', ingest: 'automated', sourceUrl: 'https://hydrography.paknavy.gov.pk/navarea-ix-warnings/', sourceLabel: 'Pakistan Navy Hydrographic Department' },
  { id: 'X',     shortLabel: 'Australia',                    waters: 'the waters off Australia and the Coral Sea', authority: 'the Australian Maritime Safety Authority (AMSA)', ingest: 'automated', sourceUrl: 'https://www.operations.amsa.gov.au/AMSA.Web.MSIPublication/Home', sourceLabel: 'AMSA / RCC Australia MSI publication' },
  { id: 'XI',    shortLabel: 'East Asia / Japan',            waters: 'the waters off East Asia, the South China Sea and Japan', authority: 'the Japan Coast Guard (JCG)', ingest: 'automated', sourceUrl: 'https://www1.kaiho.mlit.go.jp/TUHO/keiho/navarea11_en.html', sourceLabel: 'Japan Coast Guard (Kaiho)' },
  { id: 'XII',   shortLabel: 'East Pacific',                waters: 'the Eastern Pacific and waters off the United States West Coast', authority: 'the National Geospatial-Intelligence Agency (NGA, United States)', ingest: 'automated', sourceUrl: 'https://msi.nga.mil/apology_objects/DailyMemXII.txt', sourceLabel: 'NGA (US) Daily Memo XII' },
  { id: 'XIII',  shortLabel: 'NW Pacific / Okhotsk',         waters: 'the Northwest Pacific and Sea of Okhotsk', authority: 'the Federal Agency for Maritime and River Transport of Russia (Rosmorrechflot)', ingest: 'restricted' },
  { id: 'XIV',   shortLabel: 'New Zealand / S. Pacific',     waters: 'the waters off New Zealand and the South Pacific', authority: 'Land Information New Zealand (LINZ)', ingest: 'manual' },
  { id: 'XV',    shortLabel: 'Chile / SE Pacific',            waters: 'the Southeast Pacific off Chile', authority: 'the Servicio Hidrografico y Oceanografico de la Armada de Chile (SHOA)', ingest: 'manual' },
  { id: 'XVI',   shortLabel: 'Peru / E. South Pacific',      waters: 'the Southeast Pacific off Peru', authority: 'the Direccion de Hidrografia y Navegacion (DHN, Peru)', ingest: 'manual' },
  { id: 'XVII',  shortLabel: 'Arctic Canada (West)',         waters: 'the Arctic waters of Western Canada', authority: 'the Canadian Coast Guard (CCG)', ingest: 'manual' },
  { id: 'XVIII', shortLabel: 'Arctic Canada (East)',         waters: 'the Arctic waters of Eastern Canada', authority: 'the Canadian Coast Guard (CCG)', ingest: 'manual' },
  { id: 'XIX',   shortLabel: 'Arctic Norway',                waters: 'the Arctic waters off Norway', authority: 'the Norwegian Coastal Administration', ingest: 'automated', sourceUrl: 'https://kyvreports.kystverket.no/NavcoReport/navareaxixvarsler.aspx', sourceLabel: 'Kystverket NavcoReport' },
  { id: 'XX',    shortLabel: 'Arctic Russia (Kara/Laptev)',  waters: 'the Arctic waters of Russia including the Kara and Laptev Seas', authority: 'the Federal Agency for Maritime and River Transport of Russia (Rosmorrechflot)', ingest: 'restricted' },
  { id: 'XXI',   shortLabel: 'Arctic Russia (East Siberian)', waters: 'the Arctic waters of Russia including the East Siberian Sea', authority: 'the Federal Agency for Maritime and River Transport of Russia (Rosmorrechflot)', ingest: 'restricted' }
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

// ── Ingestion reliability (per region) ──────────────────────────────
// 'automated'  = dedicated scraper runs against a verified official feed.
// 'restricted' = the source does not reliably permit automatic crawling
//                (bot-protected portal or no accessible publication endpoint),
//                so data may be stale — NOT RELIABLE (NAVAREA V, Russian areas).
// 'manual'     = no automated feed yet — reviewed manual entry only.
export const FEED_STATUS = {
  automated: { badge: 'feed-ok',    label: 'Automated ingestion — verified official feed' },
  restricted: { badge: 'feed-warn', label: 'Not reliable — automatic crawling not permitted; data may be stale' },
  manual: { badge: 'feed-none',    label: 'No automated feed — reviewed manual entry only' }
};

export function feedStatus(id) {
  if (!isValidNavareaId(id)) throw new Error('Invalid NAVAREA id: ' + String(id));
  const region = NAVAREA_REGIONS.filter(function (x) { return x.id === id; })[0];
  const status = FEED_STATUS[region.ingest];
  if (!status) throw new Error('Unknown ingest status for NAVAREA ' + id);
  return status;
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
    '    <p>NAVAREA ' + r.id + ' is one of the 21 ocean regions of the World-Wide Navigational Warning Service (WWNWS), coordinated jointly by the International Maritime Organization (IMO) and the International Hydrographic Organization (IHO). The designated area coordinator is ' + r.authority + ', which issues and cancels the region&rsquo;s navigational warnings. ' + (r.ingest === 'automated'
      ? 'Helm.Warning aggregates these broadcasts daily from its verified official feed and plots them on the live map.'
      : 'Helm.Warning collects these broadcasts through its ingestion pipeline and plots them on the live map.') + '</p>',
    '    <p class="lead-note">Ingestion status: <strong>' + feedStatus(r.id).label + '</strong>' + (r.sourceUrl ? ' &middot; Official source: <a href="' + r.sourceUrl + '" target="_blank" rel="noopener noreferrer">' + r.sourceLabel + '</a>' : '') + '</p>',
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

// ── Warning detail pages (Step 2) ──────────────────────────────
// Permalink slugs derive from canonical_id's trailing '<number>/<year>'
// token ('NAVAREA XI 0451/26' -> '0451-26'), so both 'NA XI' and
// 'NAVAREA XI' canonical prefixes produce the same URL. Prerendered for
// active warnings at build time; warnings ingested since the last deploy
// fall back to the /warning-shell rewrite + client hydration (noindex).
export function warningSlug(canonicalId) {
  const tail = String(canonicalId === null || canonicalId === undefined ? '' : canonicalId).trim().split(/\s+/).pop();
  return /^\d+\/\d+$/.test(tail) ? tail.replace(/\//g, '-') : null;
}

export function warningDetailPath(regionId, canonicalId) {
  if (!isValidNavareaId(regionId)) throw new Error('Invalid NAVAREA id: ' + String(regionId));
  const slug = warningSlug(canonicalId);
  return slug ? canonicalPath(regionId) + '/warning/' + slug : null;
}

function escapeHtml(v) {
  return String(v === null || v === undefined ? '' : v)
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getUTCDate() + ' ' + months[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

export const DETAIL_CSS = [
  '.meta-rows{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px;color:var(--text-muted);margin:0 0 14px}',
  '.meta-row{display:inline-flex;gap:6px}',
  '.meta-label{color:var(--text-light)}',
  '.meta-value{color:var(--text-muted);font-weight:600}',
  '.backlinks{margin:14px 0 0;font-size:13.5px}',
  '.backlinks a{margin-right:14px}',
  '#warningDetail{margin:0 0 14px}'
].join('');

function metaRow(label, value) {
  return value ? '<span class="meta-row"><span class="meta-label">' + label + '</span><span class="meta-value">' + value + '</span></span>' : '';
}

// Fully static detail page: the complete original warning text is in the
// initial HTML (crawlable without JS). No hydration scripts included.
export function buildWarningPageHtml(r, w) {
  const slug = warningSlug(w.canonical_id);
  if (!slug) throw new Error('Cannot build warning page for canonical_id: ' + String(w.canonical_id));
  const path = canonicalPath(r.id) + '/warning/' + slug;
  const url = SITE_URL + path;
  const idText = String(w.canonical_id);
  const title = idText + ' | Helm.Warning';
  const descTitle = String(w.title || idText);
  const description = descTitle + ' — NAVAREA ' + r.id + ' navigational warning (' + r.shortLabel + '). Full original bulletin text, status and validity as held by Helm.Warning.';
  const jsonLd = '{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[' +
    '{"@type":"ListItem","position":1,"name":"Home","item":"' + SITE_URL + '/"},' +
    '{"@type":"ListItem","position":2,"name":"NAVAREA ' + r.id + '","item":"' + SITE_URL + canonicalPath(r.id) + '"},' +
    '{"@type":"ListItem","position":3,"name":"' + idText + '","item":"' + url + '"}]}';
  const issued = fmtDate(w.issued_at);
  const validFrom = fmtDate(w.valid_from);
  const validTo = fmtDate(w.valid_to);
  const validText = (validFrom || validTo) ? (validFrom || 'unknown') + ' to ' + (validTo || 'until cancelled') : '';
  const cats = Array.isArray(w.categories) ? w.categories.join(', ') : '';
  const metaRows = '<div class="meta-rows">' +
    metaRow('Region:', '<a href="' + canonicalPath(r.id) + '">NAVAREA ' + r.id + '</a>') +
    metaRow('Status:', escapeHtml(String(w.status || 'active'))) +
    (issued ? metaRow('Issued:', escapeHtml(issued)) : '') +
    (validText ? metaRow('Valid:', escapeHtml(validText)) : '') +
    (cats ? metaRow('Categories:', escapeHtml(cats)) : '') +
    (w.triage_tier ? metaRow('Geometry tier:', escapeHtml(String(w.triage_tier)) + (w.data_quality ? ' &middot; ' + escapeHtml(String(w.data_quality)) : '')) : '') +
    '</div>';
  const lines = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">',
    '<meta name="theme-color" content="#0f172a">',
    '<title>' + title + '</title>',
    '<meta name="description" content="' + escapeHtml(description) + '">',
    '<link rel="canonical" href="' + url + '">',
    '<meta name="robots" content="index, follow">',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Helm.Warning">',
    '<meta property="og:title" content="' + title + '">',
    '<meta property="og:description" content="' + escapeHtml(description) + '">',
    '<meta property="og:url" content="' + url + '">',
    '<meta property="og:image" content="' + SITE_URL + '/og-preview.png">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + title + '">',
    '<meta name="twitter:description" content="' + escapeHtml(description) + '">',
    '<script type="application/ld+json">' + jsonLd + '</' + 'script>',
    '<link rel="stylesheet" href="/assets/css/tokens.css">',
    '<style>' + PAGE_CSS + DETAIL_CSS + '</style>',
    '</head>',
    '<body>',
    '<header class="site-header">',
    '  <div class="inner">',
    '    <a href="/" class="logo"><span class="logo-badge" aria-hidden="true">HW</span><span>Helm.Warning</span></a>',
    '  </div>',
    '</header>',
    '',
    '<main class="page">',
    '  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="' + canonicalPath(r.id) + '">NAVAREA ' + r.id + '</a> &rsaquo; <span>' + escapeHtml(idText) + '</span></nav>',
    '  <h1>' + escapeHtml(idText) + '</h1>',
    '  <p class="lead">' + escapeHtml(descTitle) + (w.area_text ? ' &mdash; ' + escapeHtml(String(w.area_text)) : '') + '</p>',
    metaRows,
    '',
    '  <section>',
    '    <h2>Original bulletin text</h2>',
    '    <pre class="warn-text">' + escapeHtml(String(w.raw_text || 'Original bulletin text is not available for this record.')) + '</pre>',
    '    <p class="lead-note">Verbatim as ingested by Helm.Warning from ' + r.authority + ', the NAVAREA ' + r.id + ' area coordinator. Warnings whose coordinates could not be plotted on the map are still published here in full.</p>',
    '  </section>',
    '',
    '  <section>',
    '    <h2>About this warning</h2>',
    '    <p>' + escapeHtml(idText) + ' is a navigational warning for NAVAREA ' + r.id + ' (' + r.shortLabel + '), broadcast by ' + r.authority + ' under the World-Wide Navigational Warning Service (WWNWS). Helm.Warning aggregates these broadcasts daily and plots warnings with resolved geometry on the <a href="' + navareaMapHref(r.id) + '">live map</a>.</p>',
    '    <p>Helm.Warning is a convenience copy of these broadcasts, not an official source of Maritime Safety Information. Always verify against official channels (NAVTEX, Inmarsat SafetyNET) as required by SOLAS &mdash; see the <a href="/about">about and disclaimer</a> page for the full safety notice.</p>',
    '    <p class="backlinks"><a href="' + canonicalPath(r.id) + '">All NAVAREA ' + r.id + ' warnings</a><a href="' + navareaMapHref(r.id) + '">View on the live map</a><a href="/about#source-registry">Source registry</a></p>',
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
    '</body>',
    '</html>'
  ];
  return lines.join('\n');
}

// Generic client-hydrated shell for detail URLs that are not prerendered
// (warnings ingested after the last deploy). Served through the
// /navarea/:rn/warning/:slug -> /warning-shell rewrite. Intentionally
// noindex: crawlers pick the page up once the next deploy prerenders it.
export function buildWarningShellHtml() {
  const url = SITE_URL + '/warning-shell';
  const title = 'Navigational warning | Helm.Warning';
  const description = 'NAVAREA navigational warning detail — original bulletin text, status and validity.';
  const jsonLd = '{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[' +
    '{"@type":"ListItem","position":1,"name":"Home","item":"' + SITE_URL + '/"},' +
    '{"@type":"ListItem","position":2,"name":"Warning","item":"' + url + '"}]}';
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
    '<meta name="robots" content="noindex, follow">',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<script type="application/ld+json">' + jsonLd + '</' + 'script>',
    '<link rel="stylesheet" href="/assets/css/tokens.css">',
    '<style>' + PAGE_CSS + DETAIL_CSS + '</style>',
    '</head>',
    '<body>',
    '<header class="site-header">',
    '  <div class="inner">',
    '    <a href="/" class="logo"><span class="logo-badge" aria-hidden="true">HW</span><span>Helm.Warning</span></a>',
    '  </div>',
    '</header>',
    '',
    '<main class="page">',
    '  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>Warning</span></nav>',
    '  <h1 id="warningTitle">Navigational warning</h1>',
    '  <div id="warningDetail" aria-live="polite"></div>',
    '  <p id="emptyState" class="empty" hidden>No warning matches this address. It may have been cancelled, expired or removed. Browse the <a href="/about#source-registry">source registry</a> or return to the <a href="/">live map</a>.</p>',
    '  <p id="errorState" class="error" hidden role="alert">This warning could not be loaded right now. Retry later, browse the <a href="/about#source-registry">source registry</a>, or use the <a href="/">live map</a>.</p>',
    '  <noscript><p class="muted">Enable JavaScript to load this warning. Static warning pages are rebuilt on every deployment &mdash; the <a href="/about#source-registry">source registry</a> lists all regions.</p></noscript>',
    '</main>',
    '',
    '<footer class="site">',
    '  <p>Helm.Warning &mdash; NAVAREA Maritime Safety Information Pipeline</p>',
    '  <p><a href="/">Live warnings map</a> &middot; <a href="/about">About &amp; Disclaimer</a></p>',
    '</footer>',
    '',
    '<script defer src="https://unpkg.com/@supabase/supabase-js@2.117.3/dist/umd/supabase.js" integrity="sha256-1qXEQUpdTOZG2cHeIjqnBn0/9mTBU5T/63/P/HYzVKM=" crossorigin="anonymous"></' + 'script>',
    '<script defer src="/assets/js/supabase.js"></' + 'script>',
    '<script defer src="/assets/js/warning-detail.js"></' + 'script>',
    '</body>',
    '</html>'
  ];
  return lines.join('\n');
}

// Combined public About + Source Registry page (/about): everything the old
// /about page carried (intro, data sources, safety disclaimer, developer,
// watch-theme settings) plus the full 21-region source registry that used to
// live at /sources. One crawlable, fully static page - no client-side
// hydration. /sources permanently redirects here (vercel.json).
export function buildAboutPageHtml() {
  const url = SITE_URL + '/about';
  const title = 'About Helm.Warning | NAVAREA Source Registry &amp; Maritime Safety Information';
  const description = 'What Helm.Warning is, where its NAVAREA warning data comes from, the 21-region source registry with official WWNWS area coordinators, and the safety disclaimer: for situational awareness only - not a substitute for official Maritime Safety Information (MSI).';
  const jsonLd = '{"@context":"schema.org","@type":"BreadcrumbList","itemListElement":[' +
    '{"@type":"ListItem","position":1,"name":"Home","item":"' + SITE_URL + '/"},' +
    '{"@type":"ListItem","position":2,"name":"About","item":"' + url + '"}]}';
  const nAutomated = NAVAREA_REGIONS.filter(function (x) { return x.ingest === 'automated'; }).length;
  const nRestricted = NAVAREA_REGIONS.filter(function (x) { return x.ingest === 'restricted'; }).length;
  const nManual = NAVAREA_REGIONS.filter(function (x) { return x.ingest === 'manual'; }).length;
  const cards = NAVAREA_REGIONS.map(function (x) {
    const feed = feedStatus(x.id);
    return '      <li><a class="source-card" href="' + canonicalPath(x.id) + '">' +
      '<span class="source-id">NAVAREA ' + x.id + '</span>' +
      '<span class="source-label">' + x.shortLabel + '</span>' +
      '<span class="source-waters">Covers ' + x.waters + '.</span>' +
      '<span class="source-authority">Coordinator: ' + x.authority + '</span>' +
      '<span class="feed-badge ' + feed.badge + '">' + feed.label + '</span>' +
      '</a>' +
      (x.sourceUrl
        ? '<p class="source-portal">Source: <a href="' + x.sourceUrl + '" target="_blank" rel="noopener noreferrer">' + x.sourceLabel + '</a></p>'
        : '') +
      '</li>';
  }).join('\n');
  const sourceCss = [
    '.source-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;padding:0;list-style:none;margin:0 0 14px}',
    '.source-card{display:block;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;text-decoration:none;min-height:var(--touch-min)}',
    '.source-card:hover{border-color:var(--text-light)}',
    '.source-id{display:block;font-weight:700;color:var(--text)}',
    '.source-label{display:block;font-weight:600;font-size:13.5px;color:var(--text)}',
    '.source-waters{display:block;font-size:12.5px;color:var(--text-muted);margin-top:6px}',
    '.source-authority{display:block;font-size:12.5px;color:var(--text-light);margin-top:4px}',
    '.feed-badge{display:inline-block;margin-top:10px;font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:999px;border:1px solid var(--border)}',
    '.feed-ok{color:#16a34a;border-color:#16a34a;background:rgba(22,163,74,0.08)}',
    '.feed-warn{color:#b45309;border-color:#f59e0b;background:rgba(245,158,11,0.10)}',
    '.feed-none{color:var(--text-light)}',
    '.source-portal{font-size:12.5px;color:var(--text-muted);margin:4px 0 12px}'
  ].join('');
  const aboutCss = [
    '.disclaimer-box{background:var(--surface);border:1px solid var(--border);border-left:3px solid #f59e0b;border-radius:var(--radius);padding:16px 18px;margin:12px 0 0}',
    '.disclaimer-box p{margin:0 0 10px;color:var(--text)}',
    '.disclaimer-box p:last-child{margin:0}',
    '.page ul{margin:0 0 14px;padding-left:20px;color:var(--text)}',
    '.page li{margin:0 0 6px}',
    '.dev-links{margin-top:16px}',
    '.dev-links a{color:var(--text-muted)}',
    '.dev-links a:hover{color:var(--text-light)}',
    '.backlink{display:inline-flex;align-items:center;gap:8px;margin-top:32px;padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);text-decoration:none;font-weight:500;min-height:var(--touch-min)}',
    '.backlink:hover{border-color:var(--text-light)}',
    '.cta-btn{display:inline-flex;align-items:center;gap:8px;margin-top:4px;padding:10px 18px;background:var(--verified);color:#fff;text-decoration:none;font-weight:600;border:1px solid transparent;border-radius:var(--radius);min-height:var(--touch-min);transition:filter .15s ease}',
    '.cta-btn:hover{filter:brightness(1.12)}',
    '.cta-btn:focus-visible{outline:2px solid var(--text-light);outline-offset:2px}',
    '.theme-picker{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 4px}',
    '.theme-option{flex:1 1 150px;display:flex;flex-direction:column;gap:3px;align-items:flex-start;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font:inherit;cursor:pointer;min-height:var(--touch-min);text-align:left;transition:border-color .15s,box-shadow .15s}',
    '.theme-option:hover{border-color:var(--text-muted)}',
    '.theme-option:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
    '.theme-option[aria-pressed="true"]{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}',
    '.theme-option-name{font-weight:600;font-size:14px}',
    '.theme-option-desc{font-size:12px;color:var(--text-muted)}'
  ].join('');
  const prePaintScript = [
    '<script>',
    '/* Pre-paint: apply the saved watch theme (hw-theme) before first paint. */',
    '(function () {',
    '  try {',
    "    var t = localStorage.getItem('hw-theme');",
    "    if (t === 'dark' || t === 'night') {",
    "      document.documentElement.setAttribute('data-theme', t);",
    '      var m = document.querySelector(\'meta[name="theme-color"]\');',
    "      if (m) m.setAttribute('content', t === 'night' ? '#080404' : '#0E1210');",
    '    }',
    '  } catch (e) { /* storage unavailable: stay on light */ }',
    '})();',
    '</' + 'script>'
  ].join('\n');
  const themeToggleScript = [
    '<script>',
    '/* Watch-theme toggle: applies the selected theme live and persists it (hw-theme). */',
    '(function () {',
    "  var KEY = 'hw-theme';",
    "  var META = { light: '#FAFAF7', dark: '#0E1210', night: '#080404' };",
    "  var btns = Array.prototype.slice.call(document.querySelectorAll('[data-theme-set]'));",
    '  function current() {',
    "    try { var t = localStorage.getItem(KEY); return (t === 'dark' || t === 'night') ? t : 'light'; }",
    "    catch (e) { return 'light'; }",
    '  }',
    '  function paint(t) {',
    '    btns.forEach(function (b) {',
    "      b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === t ? 'true' : 'false');",
    '    });',
    '  }',
    '  btns.forEach(function (b) {',
    "    b.addEventListener('click', function () {",
    "      var t = b.getAttribute('data-theme-set');",
    "      if (t !== 'dark' && t !== 'night') t = 'light';",
    '      try { localStorage.setItem(KEY, t); } catch (e) { /* private mode: not persisted */ }',
    "      document.documentElement.setAttribute('data-theme', t);",
    '      var m = document.querySelector(\'meta[name="theme-color"]\');',
    "      if (m) m.setAttribute('content', META[t]);",
    '      paint(t);',
    '    });',
    '  });',
    '  paint(current());',
    '})();',
    '</' + 'script>'
  ].join('\n');
  const lines = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">',
    '<meta name="theme-color" content="#0f172a">',
    '',
    prePaintScript,
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
    '<style>' + PAGE_CSS + sourceCss + aboutCss + '</style>',
    '</head>',
    '<body>',
    '<header class="site-header">',
    '  <div class="inner">',
    '    <a href="/" class="logo"><span class="logo-badge" aria-hidden="true">HW</span><span>Helm.Warning</span></a>',
    '  </div>',
    '</header>',
    '',
    '<main class="page">',
    '  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <span>About</span></nav>',
    '  <h1>About Helm.Warning</h1>',
    '',
    '  <section>',
    '    <h2>What is Helm.Warning?</h2>',
    '    <p>Helm.Warning is a free interactive map that displays live NAVAREA navigational warnings to support maritime situational awareness and passage planning. Active warnings are plotted on nautical charts with danger areas, safety zones, and hazard points &mdash; no login or account required.</p>',
    '    <a class="cta-btn" href="#source-registry" aria-label="Explore all 21 NAVAREA areas and their live warnings">',
    '      Explore the 21 NAVAREA areas &amp; warnings',
    '      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
    '    </a>',
    '  </section>',
    '',
    '  <section>',
    '    <h2>Data Sources</h2>',
    '    <p>Warnings are aggregated from official NAVAREA coordinators operating under the World-Wide Navigational Warning Service (WWNWS), jointly coordinated by the International Maritime Organization (IMO) and the International Hydrographic Organization (IHO). Coverage spans all 21 NAVAREA regions worldwide, including the five Arctic areas (XVII&ndash;XXI). Data is refreshed daily from verified hydrographic authority feeds such as the UKHO, NGA, SHOM, AMSA, and the Japan Coast Guard.</p>',
    '  </section>',
    '',
    '  <section id="source-registry" aria-labelledby="source-registry-heading">',
    '    <h2 id="source-registry-heading">Source Registry &mdash; the 21 NAVAREA regions</h2>',
    '    <p class="lead">Every NAVAREA ocean region has one designated area coordinator &mdash; a national hydrographic office or maritime authority &mdash; responsible for issuing, updating and cancelling its warnings. Select any region below to open its regional page with the live in-force warnings and the original bulletins.</p>',
    '    <p class="overview">Regions: <strong>21</strong> &middot; Automated feeds: <strong>' + nAutomated + '</strong> &middot; Not reliable / restricted: <strong>' + nRestricted + '</strong> &middot; Manual entry only: <strong>' + nManual + '</strong> &middot; Coverage: global, including the Arctic</p>',
    '    <ul class="source-grid">',
    cards,
    '    </ul>',
    '    <p>Helm.Warning ingests each region and plots the parsed warnings on the <a href="/">live map</a>. Every card carries an ingestion status: <span class="feed-badge feed-ok">green</span> = automated ingestion from a verified official feed; <span class="feed-badge feed-warn">amber</span> = not reliable, the source does not permit automatic crawling (bot-protected portal or no accessible publication endpoint), so data may be stale; <span class="feed-badge feed-none">grey</span> = no automated feed yet, warnings entered through the reviewed admin pipeline rather than an unofficial source. Regions with a verified source portal also link to it directly below the card.</p>',
    '  </section>',
    '',
    '  <section>',
    '    <h2>Important Safety Disclaimer</h2>',
    '    <div class="disclaimer-box">',
    "      <p>Helm.Warning is a situational-awareness tool. It shows a convenience copy of NAVAREA and other maritime safety warnings gathered from public sources. It is not an official source of Maritime Safety Information.</p>",
    '      <p>The map can lag behind the original broadcasts, miss warnings, or show them incorrectly. Always check the official broadcast (NAVTEX, SafetyNET, or the issuing authority) before relying on any warning.</p>',
    "      <p>Official broadcasts and the Master's judgment take priority over anything shown here. Under SOLAS, responsibility for the safe navigation of the vessel stays with the Master. Helm.Warning must not be used as the sole or primary source for passage planning or navigation decisions.</p>",
    '    </div>',
    '  </section>',
    '',
    '  <section>',
    '    <h2>About the Developer</h2>',
    '    <p>Helm.Warning is built by <strong>Alfred Panakkal Jose</strong> &mdash; a Full-Stack Developer and serving Third Officer with over 2 years of experience as Third Officer and active in the maritime field since 2019.</p>',
    '    <p>Having worked on ocean-going oil tankers, he has first-hand experience of the real difficulties faced by seafarers &mdash; limited connectivity, high operational pressure, and the constant need for reliable tools at sea. This practical understanding shapes the way he builds software: simple, fast, offline-friendly, and focused on actual bridge and operational needs.</p>',
    '    <p>Alongside his sea-going career, Alfred has developed several maritime and productivity web applications under the <strong>Helm</strong> series, including:</p>',
    '    <ul>',
    '      <li><strong>Helm Almanac</strong> &ndash; Maritime reference and vessel schedule tool</li>',
    '      <li><strong>Helm Productivity</strong> &ndash; Watchkeeping and task management suite for seafarers</li>',
    '      <li><strong>Helm Bond</strong> &ndash; Networking and bond store management platform</li>',
    '      <li><strong>Helm Fasting</strong> &ndash; Health companion designed for long voyages</li>',
    '      <li><strong>Navarea Warning Plotter</strong> and other utility tools</li>',
    '    </ul>',
    '    <p class="dev-links">',
    '      <strong>Portfolio:</strong> <a href="https://alfred-panakkal.vercel.app" rel="noopener">alfred-panakkal.vercel.app</a><br>',
    '      <strong>LinkedIn:</strong> <a href="https://www.linkedin.com/in/alfredpanakkal" rel="noopener">linkedin.com/in/alfredpanakkal</a>',
    '    </p>',
    '  </section>',
    '',
    '  <section aria-labelledby="theme-heading">',
    '    <h2 id="theme-heading">Display &amp; Watch Themes</h2>',
    '    <p>Helm.Warning follows the watch. Pick the theme that suits your station and time of day &mdash; your choice is saved on this device and applies across the site, including the live map.</p>',
    '    <div class="theme-picker" role="group" aria-label="Choose theme">',
    '      <button type="button" class="theme-option" data-theme-set="light" aria-pressed="true">',
    '        <span class="theme-option-name">Chart paper</span>',
    '        <span class="theme-option-desc">Light &mdash; desk &amp; passage planning</span>',
    '      </button>',
    '      <button type="button" class="theme-option" data-theme-set="dark" aria-pressed="false">',
    '        <span class="theme-option-name">Bridge</span>',
    '        <span class="theme-option-desc">Dark &mdash; the main bridge look</span>',
    '      </button>',
    '      <button type="button" class="theme-option" data-theme-set="night" aria-pressed="false">',
    '        <span class="theme-option-name">Red watch</span>',
    '        <span class="theme-option-desc">Night &mdash; dim reds to protect night vision</span>',
    '      </button>',
    '    </div>',
    '    <p class="muted">Red watch is intentionally dim. These colours are calculated, not tested on a bridge display &mdash; try it at night on your own device and adjust screen brightness until it is comfortable. Severity colours keep the same meaning in every theme: a Critical warning always looks Critical.</p>',
    '  </section>',
    '',
    '  <a class="backlink" href="/" aria-label="Back to the live NAVAREA warnings map">',
    '    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
    '    Back to the live map',
    '  </a>',
    '</main>',
    '',
    '<footer class="site">',
    '  <p>Helm.Warning &mdash; NAVAREA Maritime Safety Information Pipeline</p>',
    '  <p>For situational awareness only. Not a substitute for official MSI (SafetyNET, NAVTEX). Always verify with official channels as required by SOLAS. <a href="/">Live warnings map</a></p>',
    '</footer>',
    '',
    themeToggleScript,
    '</body>',
    '</html>'
  ];
  return lines.join('\n');
}


export function buildSitemapXml(todayIso, detailUrls) {
  const entries = [
    { loc: SITE_URL + '/', freq: 'daily', priority: '1.0' },
    { loc: SITE_URL + '/about', freq: 'monthly', priority: '0.7' }
  ];
  for (const r of NAVAREA_REGIONS) {
    entries.push({ loc: SITE_URL + canonicalPath(r.id), freq: 'daily', priority: '0.8' });
  }
  for (const d of (detailUrls || [])) {
    entries.push({ loc: SITE_URL + d, freq: 'daily', priority: '0.6' });
  }
  const urls = entries.map(function (e) {
    return '  <url>\n    <loc>' + e.loc + '</loc>\n    <lastmod>' + todayIso + '</lastmod>\n    <changefreq>' + e.freq + '</changefreq>\n    <priority>' + e.priority + '</priority>\n  </url>';
  }).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n';
}


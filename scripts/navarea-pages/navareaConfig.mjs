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
  '.site-header{background:var(--canvas);border-bottom:1px solid var(--hairline);position:sticky;top:0;z-index:1000;padding-top:var(--safe-top)}',
  '.header-inner{max-width:820px;margin:0 auto;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:56px}',
  '.logo{font:500 16px var(--font-family-base);letter-spacing:-0.01em;color:var(--ink-primary);text-decoration:none;display:flex;align-items:center;gap:8px;flex-shrink:0}',
  '.logo-mark{height:20px;width:auto;flex-shrink:0;display:block;color:var(--ink-primary)}',
  '.main-nav{display:flex;gap:4px}',
  'a.nav-tab{text-decoration:none}',
  '.nav-tab{padding:6px 14px;border-radius:var(--radius-chip);background:transparent;border:1px solid transparent;font:500 13px var(--font-family-base);color:var(--ink-secondary);cursor:pointer;min-height:36px;display:flex;align-items:center;position:relative;transition:background .12s ease,border-color .12s ease,color .12s ease}',
  '.nav-tab:hover{background:var(--surface-subtle);color:var(--ink-primary);border-color:var(--border-chip)}',
  '.nav-tab.active{background:var(--surface-subtle);border-color:var(--border-chip-on);color:var(--ink-primary)}',
  '.nav-tab.stacked{flex-direction:column;gap:1px;padding:3px 12px;min-width:56px;text-align:center}',
  '.nav-tab.stacked svg{width:18px;height:18px;stroke:currentColor;stroke-width:1.8;fill:none;flex-shrink:0}',
  '.nav-tab.stacked .nav-tab-label{font-size:11px;line-height:1.2}',
  '.page{max-width:820px;margin:0 auto;padding:24px 20px 48px}',
  'h1{font:var(--font-h1);margin:0 0 12px}',
  'h2{font:var(--font-h2);margin:30px 0 12px}',
  'p{margin:0 0 14px;color:var(--text)}',
  'p.muted,p.lead-note{color:var(--text-muted);font-size:13.5px}',
  '.crumbs{font-size:13px;color:var(--text-muted);margin:0 0 18px}',
  '.crumbs a{color:var(--text-muted)}',
  '.crumbs a:hover{color:var(--text)}',
  '.overview{font-size:14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px}',
  '.btn-map{display:inline-flex;align-items:center;gap:8px;margin:0 0 14px;padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);text-decoration:none;font-weight:500;min-height:var(--touch-min)}',
  '.btn-map:hover{border-color:var(--text-light)}',
  '.warn-item{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin:0 0 10px;padding:0}',
  '.warn-item summary{padding:12px 16px;cursor:pointer;min-height:var(--touch-min);display:block}',
  '.warn-id{font-weight:500;display:block}',
  '.warn-title{font-weight:500;display:block}',
  '.warn-date{font-size:12px;color:var(--text-muted);display:block}',
  '.warn-body{padding:0 16px 14px}',
  '.warn-text{background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;font:12px/1.6 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word;overflow-x:auto;margin:0}',
  '.warn-meta{font-size:12.5px;color:var(--text-muted);margin:8px 0 0}',
  '.warn-maplink{font-size:13px;display:inline-block;margin-top:8px}',
  '#loadMore{display:inline-block;padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);font:500 14px system-ui;cursor:pointer;min-height:var(--touch-min)}',
  '#loadMore:hover{border-color:var(--text-light)}',
  '#loadMore[hidden]{display:none}',
  '.empty,.error{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--sev-high);border-radius:var(--radius);padding:14px 16px;font-size:14px}',
  '.region-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px 16px;padding:0;list-style:none;margin:0 0 14px}',
  '.region-grid a{color:var(--text-muted);text-decoration:none;font-size:13px}',
  '.region-grid a:hover{color:var(--text)}',
  '.region-grid a[aria-current=page]{color:var(--text);font-weight:500}',
  '.disclaimer-box{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--sev-high);border-radius:var(--radius);padding:14px 16px;margin:12px 0 0;font-size:13.5px;color:var(--text-muted)}',
  'footer.site{background:var(--surface);border-top:1px solid var(--border);padding:20px;text-align:center;font-size:12.5px;color:var(--text-light);padding-bottom:calc(20px + var(--safe-bottom))}',
  'footer.site p{margin:0 0 6px;color:var(--text-light)}',
  'footer.site p:last-child{margin:0}',
  'footer.site a{color:var(--text-muted)}'
].join('');

// ── Public top bar (matches the homepage single-nav IA) ─────────────
// Mirrors the homepage header (index.html): sticky bar, inline Helm mark,
// HELM.WARNING wordmark and the Map / Data / Info tabs. On these static
// pages the tabs are links: Map -> /, Data -> /?tab=data, Info -> /?tab=info
// (handled by the small ?tab= deep-link patch in public/assets/js/public.js).
// The tab matching the page context is marked active + aria-current.
const LOGO_PATH = 'M390.5 5.0L390.5 9.5L380.5 10.7C324.7 17.6 292.3 45.3 280.9 96.0C277.6 111.0 276.9 135.1 277.2 228.5L277.5 317.5L365.7 317.8L453.9 318.0L454.2 347.8C454.4 364.1 454.4 381.2 454.2 385.7L453.8 394.0L365.5 394.0L277.2 394.0L277.1 476.7C277.0 525.5 277.4 565.9 278.0 575.0C280.8 615.4 292.8 647.9 312.7 669.1C329.2 686.6 355.9 698.7 382.9 700.9L390.5 701.5L390.8 706.2L391.1 711.0L198.8 711.2C93.0 711.4 5.0 711.3 3.3 711.1C0.1 710.8 0.0 710.6 0.0 706.5C0.0 701.9 0.9 701.0 6.1 701.0C11.1 701.0 28.1 696.9 35.5 694.0C43.6 690.8 53.3 685.4 60.0 680.5C80.4 665.5 93.4 636.9 99.2 594.0C101.1 579.8 101.1 119.9 99.2 105.6C93.0 60.0 69.2 29.0 30.3 16.0C23.1 13.6 5.5 10.0 0.8 10.0C0.3 10.0 0.0 7.7 0.0 5.0L0.0 0.0L195.3 0.2L390.5 0.5L390.5 5.0ZM1008.0 4.8L1008.0 9.7L998.2 11.3C966.6 16.5 939.9 31.9 925.0 53.5C915.8 66.8 909.0 87.6 907.0 108.4C905.7 122.5 905.7 561.0 907.0 579.3C908.9 604.9 914.0 625.1 923.5 644.0C929.4 655.9 934.2 662.6 942.8 671.3C957.7 686.5 981.4 698.3 1001.9 700.6L1008.0 701.3L1008.0 706.1L1008.0 710.9L997.3 711.2C991.3 711.4 903.3 711.4 801.7 711.2L616.9 711.0L617.2 706.2L617.5 701.5L625.5 700.8C650.6 698.5 676.1 686.9 692.6 670.4C704.3 658.6 713.6 642.4 719.9 623.0C727.9 598.0 728.2 594.5 728.9 502.6L729.5 422.7L758.0 404.9C773.7 395.0 797.6 380.2 811.2 371.8C824.8 363.4 835.9 356.3 836.0 356.0C836.0 355.7 827.6 350.4 817.3 344.1C797.2 331.9 788.5 326.5 752.3 304.0L729.2 289.5L728.7 201.5C728.3 104.5 728.2 103.0 721.8 83.0C708.6 41.6 675.5 16.3 627.6 10.9L617.0 9.7L617.0 5.5C617.0 3.2 617.3 1.0 617.7 0.7C618.0 0.3 706.0 0.0 813.2 0.0L1008.0 0.0L1008.0 4.8ZM476.2 202.9C478.0 203.9 486.7 208.7 495.5 213.5C525.2 229.8 608.3 276.0 676.5 314.0C693.6 323.5 717.6 336.8 729.8 343.6C749.4 354.3 751.9 356.0 750.2 356.9C749.1 357.5 747.5 357.8 746.8 357.7C746.1 357.5 745.9 357.5 746.3 357.8C747.4 358.4 745.3 359.7 733.0 366.5C727.2 369.7 714.0 377.1 703.5 383.0C693.1 388.9 669.9 402.0 652.0 412.1C634.1 422.1 599.7 441.6 575.5 455.3C551.3 469.0 522.5 485.3 511.5 491.5C500.5 497.7 485.7 506.1 478.5 510.2C471.4 514.4 465.4 517.6 465.2 517.5C464.9 517.2 470.7 503.1 505.7 419.5C511.5 405.7 519.7 385.9 524.0 375.4L531.8 356.3L524.0 335.9C516.1 314.9 477.8 215.6 474.1 206.2C473.0 203.4 472.2 201.0 472.5 201.0C472.7 201.0 474.4 201.8 476.2 202.9Z';
const LOGO_MARK_SVG = '<svg class="logo-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1008.0 711.3" fill="currentColor" aria-hidden="true" focusable="false"><path d="' + LOGO_PATH + '"/></svg>';
const NAV_ICONS = {
  map: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>',
  data: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};
const NAV_TABS = [
  { id: 'map',  label: 'Map',  href: '/',          title: 'Map View' },
  { id: 'data', label: 'Data', href: '/?tab=data', title: 'Data Bank' },
  { id: 'info', label: 'Info', href: '/?tab=info', title: 'Sources, Disclaimer & About' }
];
export function siteHeader(activeTab) {
  const links = NAV_TABS.map(function (t) {
    const isActive = t.id === activeTab;
    return '      <a class="nav-tab stacked' + (isActive ? ' active' : '') + '" href="' + t.href + '"' + (isActive ? ' aria-current="page"' : '') + ' title="' + t.title + '">' + NAV_ICONS[t.id] + '<span class="nav-tab-label">' + t.label + '</span></a>';
  }).join('\n');
  return [
    '<header class="site-header">',
    '  <div class="header-inner">',
    '    <a href="/" class="logo">' + LOGO_MARK_SVG + '<span>HELM.WARNING</span></a>',
    '    <nav class="main-nav" aria-label="Main navigation">',
    '      <div style="display:flex;gap:2px">',
    links,
    '      </div>',
    '    </nav>',
    '  </div>',
    '</header>'
  ].join('\n');
}

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
    '<meta name="theme-color" content="#FAFAF7">',
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
    siteHeader('map'),
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
  '.meta-value{color:var(--text-muted);font-weight:500}',
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
    '<meta name="theme-color" content="#FAFAF7">',
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
    siteHeader('map'),
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
    '<meta name="theme-color" content="#FAFAF7">',
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
    siteHeader('map'),
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
    '.source-id{display:block;font-weight:500;color:var(--text)}',
    '.source-label{display:block;font-weight:500;font-size:13.5px;color:var(--text)}',
    '.source-waters{display:block;font-size:12.5px;color:var(--text-muted);margin-top:6px}',
    '.source-authority{display:block;font-size:12.5px;color:var(--text-light);margin-top:4px}',
    '.feed-badge{display:inline-block;margin-top:10px;font-size:11.5px;font-weight:500;padding:2px 9px;border-radius:999px;border:1px solid var(--border)}',
    '.feed-ok{color:var(--accent);border-color:var(--accent);background:var(--accent-halo)}',
    '.feed-warn{color:var(--sev-high);border-color:var(--sev-high);background:var(--sev-high-halo)}',
    '.feed-none{color:var(--text-light)}',
    '.source-portal{font-size:12.5px;color:var(--text-muted);margin:4px 0 12px}'
  ].join('');
  const aboutCss = [
    '.disclaimer-box{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--sev-high);border-radius:var(--radius);padding:16px 18px;margin:12px 0 0}',
    '.disclaimer-box p{margin:0 0 10px;color:var(--text)}',
    '.disclaimer-box p:last-child{margin:0}',
    '.page ul{margin:0 0 14px;padding-left:20px;color:var(--text)}',
    '.page li{margin:0 0 6px}',
    '.dev-links{margin-top:16px}',
    '.dev-links a{color:var(--text-muted)}',
    '.dev-links a:hover{color:var(--text-light)}',
    '.backlink{display:inline-flex;align-items:center;gap:8px;margin-top:32px;padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);text-decoration:none;font-weight:500;min-height:var(--touch-min)}',
    '.backlink:hover{border-color:var(--text-light)}',
    '.cta-btn{display:inline-flex;align-items:center;gap:8px;margin-top:4px;padding:10px 18px;background:var(--verified);color:var(--canvas);text-decoration:none;font-weight:500;border:1px solid transparent;border-radius:var(--radius);min-height:var(--touch-min);transition:filter .15s ease}',
    '.cta-btn:hover{filter:brightness(1.12)}',
    '.cta-btn:focus-visible{outline:2px solid var(--text-light);outline-offset:2px}',
    '.theme-picker{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 4px}',
    '.theme-option{flex:1 1 150px;display:flex;flex-direction:column;gap:3px;align-items:flex-start;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font:inherit;cursor:pointer;min-height:var(--touch-min);text-align:left;transition:border-color .15s,box-shadow .15s}',
    '.theme-option:hover{border-color:var(--text-muted)}',
    '.theme-option:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
    '.theme-option[aria-pressed="true"]{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}',
    '.theme-option-name{font-weight:500;font-size:14px}',
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
    '<meta name="theme-color" content="#FAFAF7">',
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
    siteHeader('info'),
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
    '      <strong>Portfolio:</strong> <a href="https://alfredpanakkal.web.app" rel="noopener">alfredpanakkal.web.app</a><br>',
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


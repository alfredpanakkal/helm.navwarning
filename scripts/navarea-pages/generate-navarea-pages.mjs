// scripts/navarea-pages/generate-navarea-pages.mjs
// Prerenders the public NAVAREA regional pages, the source-registry hub
// (/sources), the warning-detail shell (/warning-shell) and — when the
// public Supabase read returns data — one static page per active warning
// (/navarea/<RN>/warning/<num>-<year>) plus public/sitemap.xml. Runs as the
// first step of 'npm run build'. Regional + sources + shell output is
// deterministic; warning detail pages depend on the live database and are
// gitignored (regenerated on every deploy, stale pages removed).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPageHtml, buildSourcesPageHtml, buildWarningShellHtml, buildWarningPageHtml,
  buildSitemapXml, warningDetailPath, NAVAREA_REGIONS, normalizeStoredNavarea,
} from './navareaConfig.mjs';
import { fetchActiveWarnings } from './fetchActiveWarnings.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

for (const r of NAVAREA_REGIONS) {
  const dir = path.join(root, 'public', 'navarea', r.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), buildPageHtml(r));
}
const sourcesDir = path.join(root, 'public', 'sources');
fs.mkdirSync(sourcesDir, { recursive: true });
fs.writeFileSync(path.join(sourcesDir, 'index.html'), buildSourcesPageHtml());
const shellDir = path.join(root, 'public', 'warning-shell');
fs.mkdirSync(shellDir, { recursive: true });
fs.writeFileSync(path.join(shellDir, 'index.html'), buildWarningShellHtml());

// Warning detail pages: prerender the current active set. Fresh warnings and
// warnings removed since the last build are handled by the /warning-shell
// rewrite at runtime (no 404s, no stale pages).
const warnings = await fetchActiveWarnings();
const byPath = new Map();
for (const w of warnings) {
  const regionId = normalizeStoredNavarea(w.navarea) || normalizeStoredNavarea(w.canonical_id);
  if (!regionId) continue;
  const p = warningDetailPath(regionId, w.canonical_id);
  if (!p || byPath.has(p)) continue;
  byPath.set(p, { regionId, w });
}
for (const r of NAVAREA_REGIONS) {
  fs.rmSync(path.join(root, 'public', 'navarea', r.id, 'warning'), { recursive: true, force: true });
  fs.mkdirSync(path.join(root, 'public', 'navarea', r.id, 'warning'), { recursive: true });
}
let detailCount = 0;
for (const [p, { regionId, w }] of byPath) {
  const region = NAVAREA_REGIONS.find(function (x) { return x.id === regionId; });
  if (!region) continue;
  fs.mkdirSync(path.join(root, 'public', p), { recursive: true });
  fs.writeFileSync(path.join(root, 'public', p, 'index.html'), buildWarningPageHtml(region, w));
  detailCount++;
}
fs.writeFileSync(path.join(root, 'public', 'sitemap.xml'), buildSitemapXml(new Date().toISOString().slice(0, 10), Array.from(byPath.keys())));
console.log('Generated ' + NAVAREA_REGIONS.length + ' regional pages, source registry, warning shell, sitemap and ' + detailCount + ' warning detail pages');

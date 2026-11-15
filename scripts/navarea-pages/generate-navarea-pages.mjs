// scripts/navarea-pages/generate-navarea-pages.mjs
// Prerenders the public NAVAREA regional pages, the combined About + Source
// Registry page (/about), the warning-detail shell (/warning-shell) and —
// when the public Supabase read returns data — one static page per active
// warning (/navarea/<RN>/warning/<num>-<year>) plus public/sitemap.xml. Runs
// as the first step of 'npm run build'. Regional + about + shell output is
// deterministic; warning detail pages depend on the live database and are
// gitignored (regenerated on every deploy, stale pages removed). The old
// /sources hub no longer exists — it permanently redirects to /about.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPageHtml, buildAboutPageHtml, buildWarningShellHtml, buildWarningPageHtml,
  buildSitemapXml, warningDetailPath, NAVAREA_REGIONS, normalizeStoredNavarea,
} from './navareaConfig.mjs';
import { fetchActiveWarnings } from './fetchActiveWarnings.mjs';
import { buildNavareaSnapshots } from './snapshotData.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Combined About + Source Registry page replaces the old static about.html;
// the retired /sources directory is removed so no deploy serves the stale hub
// (vercel.json redirects /sources to /about).
fs.writeFileSync(path.join(root, 'public', 'about.html'), buildAboutPageHtml());
fs.rmSync(path.join(root, 'public', 'sources'), { recursive: true, force: true });
const shellDir = path.join(root, 'public', 'warning-shell');
fs.mkdirSync(shellDir, { recursive: true });
fs.writeFileSync(path.join(shellDir, 'index.html'), buildWarningShellHtml());

// Read active warnings once for both regional snapshots and warning detail pages.
// null means the request failed; [] means Supabase successfully returned no active rows.
const fetchedWarnings = await fetchActiveWarnings();
const warnings = fetchedWarnings || [];
if (fetchedWarnings !== null) {
  const generatedAt = new Date().toISOString();
  const snapshots = buildNavareaSnapshots(warnings, generatedAt);
  for (const r of NAVAREA_REGIONS) {
    const dir = path.join(root, 'public', 'navarea', r.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'warnings.json'), JSON.stringify(snapshots.get(r.id)));
  }
  console.log('Generated 21 NAVAREA warning snapshots from Supabase');
} else {
  console.warn('Supabase unavailable during build; existing warning snapshots were left untouched');
}

// Regional pages are deterministic and can be generated after snapshot refresh.
for (const r of NAVAREA_REGIONS) {
  const dir = path.join(root, 'public', 'navarea', r.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), buildPageHtml(r));
}

// Warning detail pages: prerender the current active set. Fresh warnings and
// warnings removed since the last build are handled by the /warning-shell
// rewrite at runtime (no 404s, no stale pages).
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
console.log('Generated ' + NAVAREA_REGIONS.length + ' regional pages, combined about/source-registry page, warning shell, sitemap and ' + detailCount + ' warning detail pages');


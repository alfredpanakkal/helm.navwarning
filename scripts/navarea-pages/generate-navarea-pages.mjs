// scripts/navarea-pages/generate-navarea-pages.mjs
// Prerenders the 21 public NAVAREA regional pages and regenerates
// public/sitemap.xml. Runs as the first step of 'npm run build' (also
// available via 'npm run generate:navarea'). Output is deterministic: the
// committed files in public/navarea/ are the same bytes this script produces.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPageHtml, buildSitemapXml, NAVAREA_REGIONS } from './navareaConfig.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

for (const r of NAVAREA_REGIONS) {
  const dir = path.join(root, 'public', 'navarea', r.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), buildPageHtml(r));
}
fs.writeFileSync(path.join(root, 'public', 'sitemap.xml'), buildSitemapXml(new Date().toISOString().slice(0, 10)));
console.log('Generated ' + NAVAREA_REGIONS.length + ' NAVAREA regional pages and public/sitemap.xml');

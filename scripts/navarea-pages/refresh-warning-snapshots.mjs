// scripts/navarea-pages/refresh-warning-snapshots.mjs
// Refresh committed NAVAREA snapshots for fast first paint and build fallback.
// A failed read, or an unexpected global zero while snapshots contain data,
// must never erase the last known snapshot.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAVAREA_REGIONS } from './navareaConfig.mjs';
import { fetchActiveWarnings } from './fetchActiveWarnings.mjs';
import { buildNavareaSnapshots } from './snapshotData.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const warnings = await fetchActiveWarnings();
if (warnings === null) {
  console.error('Supabase read failed; no snapshots were changed.');
  process.exit(1);
}

const previousCount = NAVAREA_REGIONS.reduce(function (total, region) {
  try {
    const file = path.join(root, 'public', 'navarea', region.id, 'warnings.json');
    const current = JSON.parse(fs.readFileSync(file, 'utf8'));
    return total + (Array.isArray(current.warnings) ? current.warnings.length : 0);
  } catch (e) { return total; }
}, 0);

if (warnings.length === 0 && previousCount > 0 && process.env.ALLOW_EMPTY_NAVAREA_SNAPSHOT !== 'true') {
  console.error('Supabase returned zero active warnings while committed snapshots contain ' + previousCount + '. Refusing to erase the last known data.');
  process.exit(1);
}

const snapshots = buildNavareaSnapshots(warnings, new Date().toISOString());
let changed = 0;
for (const region of NAVAREA_REGIONS) {
  const file = path.join(root, 'public', 'navarea', region.id, 'warnings.json');
  const snapshot = snapshots.get(region.id);
  let previous = null;
  try { previous = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* first snapshot */ }
  if (previous && JSON.stringify(previous.warnings) === JSON.stringify(snapshot.warnings)) continue;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(snapshot) + '\n');
  changed++;
}
console.log('Updated ' + changed + ' of 21 NAVAREA snapshots; ' + warnings.length + ' active database rows checked.');

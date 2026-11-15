// scripts/navarea-pages/snapshotData.mjs
import { NAVAREA_REGIONS, navareaCode, normalizeStoredNavarea } from './navareaConfig.mjs';

export function buildNavareaSnapshots(warnings, generatedAt) {
  if (!Array.isArray(warnings)) throw new TypeError('warnings must be an array');
  const snapshots = new Map();
  for (const region of NAVAREA_REGIONS) {
    const rows = warnings.filter(function (warning) {
      if (!warning || warning.status !== 'active') return false;
      const id = normalizeStoredNavarea(warning.navarea) || normalizeStoredNavarea(warning.canonical_id);
      return id === region.id;
    }).slice().sort(function (a, b) {
      const aTime = a.issued_at ? Date.parse(a.issued_at) : 0;
      const bTime = b.issued_at ? Date.parse(b.issued_at) : 0;
      return bTime - aTime;
    });
    snapshots.set(region.id, {
      schemaVersion: 1,
      navarea: navareaCode(region.id),
      generatedAt,
      warningCount: rows.length,
      warnings: rows
    });
  }
  return snapshots;
}

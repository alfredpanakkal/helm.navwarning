// Draft persistence for map-native geometry edits (console save resilience).
//
// A draft is GEOMETRY ONLY — never raw warning text — and lives in
// sessionStorage: cleared when the tab closes, never shared across tabs.
// Every storage call is guarded (private mode can throw) and never throws
// itself. loadDraft validates the whole shape; anything corrupt,
// wrong-version or out-of-range makes the draft simply absent (null).
// Coordinates are never clamped — an invalid value invalidates the draft.

import type { EditablePart } from '../components/MapGeometryEditor';

export interface GeometryDraft {
  v: 1;
  /** warning.updated_at the draft was made against (stale-draft check). */
  baseUpdatedAt: string | null;
  /** ISO time the draft was written. */
  savedAt: string;
  parts: EditablePart[];
}

export const DRAFT_PREFIX = 'helm_geom_draft:';

export function draftKey(warningKey: string): string {
  return DRAFT_PREFIX + warningKey;
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function validPart(p: any): p is EditablePart {
  if (!p || (p.kind !== 'polygon' && p.kind !== 'line' && p.kind !== 'points' && p.kind !== 'circle')) return false;
  if (p.bufferNm !== undefined && (typeof p.bufferNm !== 'number' || !Number.isFinite(p.bufferNm))) return false;
  if (!Array.isArray(p.latlngs) || p.latlngs.length === 0) return false;
  for (const ll of p.latlngs) {
    if (!Array.isArray(ll) || ll.length !== 2) return false;
    const lat = ll[0];
    const lng = ll[1];
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    // Never clamp: out-of-range means the draft is untrusted as a whole.
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  }
  return true;
}

export function saveDraft(warningKey: string, draft: GeometryDraft): void {
  try {
    storage()?.setItem(draftKey(warningKey), JSON.stringify(draft));
  } catch {
    // Private mode can throw; a draft is best-effort, never an error.
  }
}

export function loadDraft(warningKey: string): GeometryDraft | null {
  try {
    const s = storage();
    if (!s) return null;
    const raw = s.getItem(draftKey(warningKey));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1 || typeof d.savedAt !== 'string' || !Array.isArray(d.parts)) return null;
    if (!(d.baseUpdatedAt === null || typeof d.baseUpdatedAt === 'string')) return null;
    if (!d.parts.every(validPart)) return null;
    return { v: 1, baseUpdatedAt: d.baseUpdatedAt, savedAt: d.savedAt, parts: d.parts };
  } catch {
    // Corrupt JSON or a throwing storage surface: the draft is absent.
    return null;
  }
}

export function clearDraft(warningKey: string): void {
  try {
    storage()?.removeItem(draftKey(warningKey));
  } catch {
    // Never throw.
  }
}

export function clearAllDrafts(): void {
  try {
    const s = storage();
    if (!s) return;
    const doomed: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(DRAFT_PREFIX)) doomed.push(k);
    }
    doomed.forEach((k) => s.removeItem(k));
  } catch {
    // Never throw.
  }
}

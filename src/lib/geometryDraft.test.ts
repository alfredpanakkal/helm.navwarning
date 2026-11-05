import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  clearAllDrafts,
  clearDraft,
  DRAFT_PREFIX,
  draftKey,
  loadDraft,
  saveDraft,
  type GeometryDraft,
} from './geometryDraft';

// Minimal Web Storage stub — the module only needs getItem/setItem/
// removeItem/key/length on window.sessionStorage, so a plain Map-backed
// fake exercises the full validation path without a DOM environment.
class FakeStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(String(k), String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

const g = globalThis as any;

beforeEach(() => {
  g.window = { sessionStorage: new FakeStorage() };
});

afterEach(() => {
  delete g.window;
});

const DRAFT: GeometryDraft = {
  v: 1,
  baseUpdatedAt: '2026-11-05T00:00:00Z',
  savedAt: '2026-11-05T01:00:00Z',
  parts: [{ kind: 'polygon', latlngs: [[12.34, 56.78], [12.4, 56.8], [12.36, 56.82]] }],
};

describe('geometryDraft', () => {
  it('round-trips a draft through saveDraft/loadDraft', () => {
    saveDraft('w-1', DRAFT);
    expect(loadDraft('w-1')).toEqual(DRAFT);
    expect(loadDraft('w-other')).toBeNull();
    clearDraft('w-1');
    expect(loadDraft('w-1')).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    g.window.sessionStorage.setItem(draftKey('w-1'), '{not json');
    expect(loadDraft('w-1')).toBeNull();
  });

  it('returns null on a version mismatch', () => {
    saveDraft('w-1', DRAFT);
    const stored = JSON.parse(g.window.sessionStorage.getItem(draftKey('w-1')));
    stored.v = 2;
    g.window.sessionStorage.setItem(draftKey('w-1'), JSON.stringify(stored));
    expect(loadDraft('w-1')).toBeNull();
  });

  it('returns null for latitude 91 (invalid, never clamped)', () => {
    const bad = JSON.parse(JSON.stringify(DRAFT));
    bad.parts[0].latlngs[0][0] = 91;
    g.window.sessionStorage.setItem(draftKey('w-1'), JSON.stringify(bad));
    expect(loadDraft('w-1')).toBeNull();
  });

  it('returns null for a non-numeric coordinate and for a bad kind', () => {
    const nan = JSON.parse(JSON.stringify(DRAFT));
    nan.parts[0].latlngs[0][1] = 'x';
    g.window.sessionStorage.setItem(draftKey('w-1'), JSON.stringify(nan));
    expect(loadDraft('w-1')).toBeNull();
    const badKind = JSON.parse(JSON.stringify(DRAFT));
    badKind.parts[0].kind = 'hexagon';
    g.window.sessionStorage.setItem(draftKey('w-1'), JSON.stringify(badKind));
    expect(loadDraft('w-1')).toBeNull();
  });

  it('clearAllDrafts removes only keys with the draft prefix', () => {
    saveDraft('w-1', DRAFT);
    saveDraft('w-2', DRAFT);
    g.window.sessionStorage.setItem('unrelated_key', 'keep me');
    clearAllDrafts();
    expect(loadDraft('w-1')).toBeNull();
    expect(loadDraft('w-2')).toBeNull();
    expect(g.window.sessionStorage.getItem('unrelated_key')).toBe('keep me');
    expect(g.window.sessionStorage.length).toBe(1);
    expect(DRAFT_PREFIX.startsWith('helm_geom_draft')).toBe(true);
  });

  it('never throws when the storage surface throws', () => {
    g.window.sessionStorage = {
      get length() { throw new Error('boom'); },
      key() { throw new Error('boom'); },
      getItem() { throw new Error('boom'); },
      setItem() { throw new Error('boom'); },
      removeItem() { throw new Error('boom'); },
    };
    expect(() => saveDraft('w-1', DRAFT)).not.toThrow();
    expect(() => loadDraft('w-1')).not.toThrow();
    expect(loadDraft('w-1')).toBeNull();
    expect(() => clearDraft('w-1')).not.toThrow();
    expect(() => clearAllDrafts()).not.toThrow();
  });
});

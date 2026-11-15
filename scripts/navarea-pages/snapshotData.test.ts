import { describe, expect, it } from 'vitest';
import { buildNavareaSnapshots } from './snapshotData.mjs';

describe('NAVAREA warning snapshots', () => {
  it('creates a snapshot for every NAVAREA, including genuinely empty regions', () => {
    const snapshots = buildNavareaSnapshots([], '2026-11-16T00:00:00.000Z');
    expect(snapshots.size).toBe(21);
    expect(snapshots.get('I')).toEqual({
      schemaVersion: 1,
      navarea: 'NA I',
      generatedAt: '2026-11-16T00:00:00.000Z',
      warningCount: 0,
      warnings: []
    });
    expect(snapshots.get('XXI').navarea).toBe('NA XXI');
  });

  it('keeps only active records belonging to the requested NAVAREA', () => {
    const warnings = [
      { canonical_id: 'NAVAREA I 0100/26', navarea: 'NA I', status: 'active', issued_at: '2026-01-01T00:00:00Z' },
      { canonical_id: 'NAVAREA I 0101/26', navarea: 'NA I', status: 'cancelled', issued_at: '2026-01-02T00:00:00Z' },
      { canonical_id: 'NAVAREA II 0102/26', navarea: 'NA II', status: 'active', issued_at: '2026-01-03T00:00:00Z' },
      { canonical_id: 'NAVAREA III 0103/26', navarea: null, status: 'active', issued_at: '2026-01-04T00:00:00Z' },
      { canonical_id: 'NAVAREA I 0104/26', navarea: 'na i', status: 'active', issued_at: '2026-02-01T00:00:00Z' }
    ];
    const snapshots = buildNavareaSnapshots(warnings, '2026-11-16T00:00:00.000Z');
    expect(snapshots.get('I').warningCount).toBe(2);
    expect(snapshots.get('I').warnings.map((w) => w.canonical_id)).toEqual([
      'NAVAREA I 0104/26', 'NAVAREA I 0100/26'
    ]);
    expect(snapshots.get('II').warningCount).toBe(1);
    expect(snapshots.get('III').warningCount).toBe(0);
  });

  it('rejects invalid input rather than silently creating empty snapshots', () => {
    expect(() => buildNavareaSnapshots(null, '2026-11-16T00:00:00.000Z')).toThrow();
  });
});

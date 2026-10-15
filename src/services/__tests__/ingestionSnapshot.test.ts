// src/services/__tests__/ingestionSnapshot.test.ts
// Phase 4: Ingestion Pipeline & Snapshot Integration Test Suite

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  extractIssuedAtFromList,
  validateInForceSnapshot,
  syncInForceSnapshot,
  setSnapshotSupabaseClient,
  resetSnapshotSupabaseClient,
} from '../snapshotService';
import { syncInForceSnapshot as reExportedSync } from '../../lib/supabaseServer';
import {
  FEATURE_FLAGS,
  isFeatureEnabled,
  resetFeatureFlags,
} from '../../lib/featureFlags';
import { processInForceList } from '../../../api/scrape-navwarn';

describe('Phase 4: Dynamic Feature Flags', () => {
  const originalEnvFlags = process.env.FEATURE_FLAGS;

  beforeEach(() => {
    resetFeatureFlags();
    delete process.env.FEATURE_FLAGS;
  });

  afterEach(() => {
    resetFeatureFlags();
    if (originalEnvFlags !== undefined) {
      process.env.FEATURE_FLAGS = originalEnvFlags;
    } else {
      delete process.env.FEATURE_FLAGS;
    }
  });

  it('defaults inForceSnapshots to true', () => {
    expect(FEATURE_FLAGS.inForceSnapshots).toBe(true);
    expect(isFeatureEnabled('inForceSnapshots')).toBe(true);
  });

  it('respects process.env.FEATURE_FLAGS JSON override dynamically', () => {
    process.env.FEATURE_FLAGS = JSON.stringify({ inForceSnapshots: false });
    expect(FEATURE_FLAGS.inForceSnapshots).toBe(false);
    expect(isFeatureEnabled('inForceSnapshots')).toBe(false);

    process.env.FEATURE_FLAGS = JSON.stringify({ inForceSnapshots: true });
    expect(FEATURE_FLAGS.inForceSnapshots).toBe(true);
    expect(isFeatureEnabled('inForceSnapshots')).toBe(true);
  });

  it('supports direct property mutation when process.env.FEATURE_FLAGS is unset', () => {
    FEATURE_FLAGS.inForceSnapshots = false;
    expect(FEATURE_FLAGS.inForceSnapshots).toBe(false);
    expect(isFeatureEnabled('inForceSnapshots')).toBe(false);

    FEATURE_FLAGS.inForceSnapshots = true;
    expect(FEATURE_FLAGS.inForceSnapshots).toBe(true);
    expect(isFeatureEnabled('inForceSnapshots')).toBe(true);
  });
});

describe('Phase 4: extractIssuedAtFromList', () => {
  it('extracts DTG format: "151200Z OCT 24"', () => {
    const text = `
NAVAREA IV 123/24
151200Z OCT 24
1. NAVAREA IV WARNINGS IN FORCE
    `;
    const date = extractIssuedAtFromList(text);
    expect(date).not.toBeNull();
    expect(date?.toISOString()).toBe('2024-10-15T12:00:00.000Z');
  });

  it('extracts Header date format: "ON 15 OCT 2024"', () => {
    const text = `
NAVAREA IV WARNINGS IN FORCE ON 15 OCT 2024.
2024 SERIES: 001 002.
    `;
    const date = extractIssuedAtFromList(text);
    expect(date).not.toBeNull();
    expect(date?.toISOString()).toBe('2024-10-15T00:00:00.000Z');
  });

  it('extracts JHOD format: "Date:2026/10/10 12 UTC"', () => {
    const text = `
Date:2026/10/10 12 UTC
NAVAREA XI IN-FORCE LIST
    `;
    const date = extractIssuedAtFromList(text);
    expect(date).not.toBeNull();
    expect(date?.toISOString()).toBe('2026-10-10T12:00:00.000Z');
  });

  it('returns null when no recognized date exists', () => {
    const text = 'NAVAREA IV WARNINGS IN FORCE NO DATE GIVEN';
    const date = extractIssuedAtFromList(text);
    expect(date).toBeNull();
  });
});

describe('Phase 4: validateInForceSnapshot', () => {
  it('validates a valid camelCase snapshot', () => {
    const validCamel = {
      navarea: 'IV',
      snapshotWarningId: 'NAVAREA IV 123/24',
      sourceId: 'src-nga',
      issuedAt: '2024-10-15T12:00:00Z',
      entries: [{ seriesYear: 24, number: 1, warningId: 'NAVAREA IV 1/24' }],
    };
    expect(validateInForceSnapshot(validCamel)).toBe(true);
  });

  it('validates a valid snake_case snapshot', () => {
    const validSnake = {
      navarea: 'XI',
      snapshot_warning_id: 'NAVAREA XI 456/26',
      source_id: 'src-jhod',
      issued_at: new Date('2026-10-10T12:00:00Z'),
      entries: [],
    };
    expect(validateInForceSnapshot(validSnake)).toBe(true);
  });

  it('rejects snapshots with missing required fields', () => {
    expect(validateInForceSnapshot(null)).toBe(false);
    expect(validateInForceSnapshot({})).toBe(false);
    expect(validateInForceSnapshot({ navarea: '', snapshotWarningId: '1', sourceId: '1', issuedAt: new Date(), entries: [] })).toBe(false);
    expect(validateInForceSnapshot({ navarea: 'IV', snapshotWarningId: '', sourceId: '1', issuedAt: new Date(), entries: [] })).toBe(false);
    expect(validateInForceSnapshot({ navarea: 'IV', snapshotWarningId: '1', sourceId: '', issuedAt: new Date(), entries: [] })).toBe(false);
    expect(validateInForceSnapshot({ navarea: 'IV', snapshotWarningId: '1', sourceId: '1', issuedAt: 'invalid-date', entries: [] })).toBe(false);
    expect(validateInForceSnapshot({ navarea: 'IV', snapshotWarningId: '1', sourceId: '1', issuedAt: new Date(), entries: null })).toBe(false);
  });
});

describe('Phase 4: syncInForceSnapshot', () => {
  beforeEach(() => {
    resetFeatureFlags();
    delete process.env.FEATURE_FLAGS;
  });

  afterEach(() => {
    resetSnapshotSupabaseClient();
    resetFeatureFlags();
    delete process.env.FEATURE_FLAGS;
  });

  it('is re-exported from src/lib/supabaseServer.ts', () => {
    expect(reExportedSync).toBe(syncInForceSnapshot);
  });

  it('returns error when feature flag is disabled', async () => {
    FEATURE_FLAGS.inForceSnapshots = false;

    const res = await syncInForceSnapshot({
      navarea: 'IV',
      snapshotWarningId: 'NAVAREA IV 123/24',
      sourceId: 'src-nga',
      issuedAt: new Date(),
      entries: [],
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('disabled');
  });

  it('demotes previous authoritative snapshot when isAuthoritative is true', async () => {
    const updateSpy = vi.fn().mockReturnThis();
    const eqSpy = vi.fn().mockReturnThis();

    const mockRow = {
      id: 'snap-1',
      navarea: 'IV',
      snapshot_warning_id: 'NAVAREA IV 123/24',
      source_id: 'src-nga',
      issued_at: '2024-10-15T12:00:00.000Z',
      issue_date: '2024-10-15',
      entries: [],
      cancelled_refs: [],
      is_partial: false,
      is_authoritative: true,
      created_at: '2024-10-15T12:00:00.000Z',
      updated_at: '2024-10-15T12:00:00.000Z',
    };

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'in_force_snapshots') {
          return {
            update: updateSpy,
            eq: eqSpy,
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockRow, error: null }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    setSnapshotSupabaseClient(mockClient);

    const res = await syncInForceSnapshot({
      navarea: 'IV',
      snapshot_warning_id: 'NAVAREA IV 123/24',
      source_id: 'src-nga',
      issued_at: '2024-10-15T12:00:00.000Z',
      entries: [],
      is_authoritative: true,
    });

    expect(res.success).toBe(true);
    expect(res.snapshot?.isAuthoritative).toBe(true);
    // Demote was called
    expect(updateSpy).toHaveBeenCalledWith({ is_authoritative: false });
  });
});

describe('Phase 4: processInForceList (Ingestion Integration)', () => {
  beforeEach(() => {
    resetFeatureFlags();
    delete process.env.FEATURE_FLAGS;
  });

  afterEach(() => {
    resetSnapshotSupabaseClient();
    resetFeatureFlags();
    delete process.env.FEATURE_FLAGS;
  });

  it('skips non-in-force blocks cleanly', async () => {
    const nonInForceText = `
NAVAREA IV 500/24
GULF OF MEXICO.
1. HAZARDOUS OPERATIONS 151200Z TO 151800Z OCT.
2. CANCEL AT 151800Z OCT 24.
    `;

    const res = await processInForceList(nonInForceText, 'src-nga', 'IV');
    expect(res.isList).toBe(false);
    expect(res.snapshot).toBeUndefined();
  });

  it('detects, parses, and persists authoritative in-force list snapshot', async () => {
    const inForceText = `
NAVAREA IV 100/24
151200Z OCT 24
1. NAVAREA IV WARNINGS IN FORCE AT 151200Z OCT 24:
2024 SERIES: 001 002 003 005-007.
2. SUMMARY OF CANCELLED MESSAGES:
CANCEL NAVAREA IV 090/24.
3. CANCEL THIS MSG 221200Z OCT 24.
    `;

    const mockRow = {
      id: 'snap-uuid-100',
      navarea: 'IV',
      snapshot_warning_id: 'NAVAREA IV 100/24',
      source_id: 'src-nga',
      issued_at: '2024-10-15T12:00:00.000Z',
      issue_date: '2024-10-15',
      entries: [
        { seriesYear: 24, number: 1, warningId: 'NAVAREA IV 1/24' },
        { seriesYear: 24, number: 2, warningId: 'NAVAREA IV 2/24' },
        { seriesYear: 24, number: 3, warningId: 'NAVAREA IV 3/24' },
      ],
      cancelled_refs: ['NAVAREA IV 090/24'],
      is_partial: false,
      is_authoritative: true,
      created_at: '2024-10-15T12:00:00.000Z',
      updated_at: '2024-10-15T12:00:00.000Z',
    };

    const mockClient = {
      from: vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockRow, error: null }),
          }),
        }),
      })),
    };

    setSnapshotSupabaseClient(mockClient);

    const res = await processInForceList(inForceText, 'src-nga', 'IV');

    expect(res.isList).toBe(true);
    expect(res.parsed).toBeDefined();
    expect(res.parsed?.entryCount).toBeGreaterThan(0);
    expect(res.snapshot).toBeDefined();
    expect(res.snapshot?.snapshotWarningId).toBe('NAVAREA IV 100/24');
  });
});

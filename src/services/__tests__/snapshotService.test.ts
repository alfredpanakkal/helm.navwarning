// src/services/__tests__/snapshotService.test.ts
// Unit and integration test suite for in-force snapshots database and service layer

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveSnapshot,
  getLatestSnapshot,
  getAuthoritativeSnapshot,
  listSnapshots,
  setAuthoritativeSnapshot,
  createSnapshotFromParsedList,
  mapRowToSnapshot,
  mapInputToRow,
  setSnapshotSupabaseClient,
  resetSnapshotSupabaseClient,
} from '../snapshotService';
import { FEATURE_FLAGS } from '../../lib/featureFlags';
import type { ParsedInForceList } from '../../parsers/inForceListParser';
import type { CreateSnapshotInput, InForceSnapshotRow } from '../../types/snapshot';

describe('In-Force Snapshots Service Suite (Phase 3)', () => {
  const originalFlag = FEATURE_FLAGS.inForceSnapshots;

  beforeEach(() => {
    FEATURE_FLAGS.inForceSnapshots = true;
    resetSnapshotSupabaseClient();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    FEATURE_FLAGS.inForceSnapshots = originalFlag;
    resetSnapshotSupabaseClient();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Data Mapping & Normalization Tests
  // =========================================================================
  describe('Data Mapping & Normalization', () => {
    it('correctly maps domain input to PostgreSQL snake_case row', () => {
      const fixedDate = new Date('2026-10-22T08:00:00Z');
      const input: CreateSnapshotInput = {
        navarea: 'ix',
        snapshotWarningId: 'NAVAREA IX 1000/26',
        sourceId: 'src-navarea-9',
        issuedAt: fixedDate,
        issueDate: '22 OCT 2026',
        entries: [
          { seriesYear: 26, number: 977, warningId: 'NAVAREA IX 977/26' },
          { seriesYear: 26, number: 976, warningId: 'NAVAREA IX 976/26' },
        ],
        cancelledRefs: ['NAVAREA IX 857/26'],
        isPartial: false,
        isAuthoritative: true,
      };

      const row = mapInputToRow(input);

      expect(row.navarea).toBe('IX'); // Uppercase normalized
      expect(row.snapshot_warning_id).toBe('NAVAREA IX 1000/26');
      expect(row.source_id).toBe('src-navarea-9');
      expect(row.issued_at).toBe(fixedDate.toISOString());
      expect(row.issue_date).toBe('22 OCT 2026');
      expect(row.entries).toHaveLength(2);
      expect(row.cancelled_refs).toEqual(['NAVAREA IX 857/26']);
      expect(row.is_partial).toBe(false);
      expect(row.is_authoritative).toBe(true);
    });

    it('correctly maps raw database row to application domain model', () => {
      const row: InForceSnapshotRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        navarea: 'IV',
        snapshot_warning_id: 'NAVAREA IV 500/26',
        source_id: 'src-navarea-4',
        issued_at: '2026-10-22T12:00:00.000Z',
        issue_date: '22 OCT 2026',
        entries: [
          { seriesYear: 26, number: 400, warningId: 'NAVAREA IV 400/26' },
        ],
        cancelled_refs: ['NAVAREA IV 390/26'],
        is_partial: false,
        is_authoritative: true,
        created_at: '2026-10-22T12:05:00.000Z',
        updated_at: '2026-10-22T12:05:00.000Z',
      };

      const snapshot = mapRowToSnapshot(row);

      expect(snapshot.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(snapshot.navarea).toBe('IV');
      expect(snapshot.snapshotWarningId).toBe('NAVAREA IV 500/26');
      expect(snapshot.sourceId).toBe('src-navarea-4');
      expect(snapshot.issuedAt).toBe('2026-10-22T12:00:00.000Z');
      expect(snapshot.issueDate).toBe('22 OCT 2026');
      expect(snapshot.entries).toHaveLength(1);
      expect(snapshot.cancelledRefs).toEqual(['NAVAREA IV 390/26']);
      expect(snapshot.isPartial).toBe(false);
      expect(snapshot.isAuthoritative).toBe(true);
      expect(snapshot.createdAt).toBe('2026-10-22T12:05:00.000Z');
    });

    it('handles null/missing array fields gracefully in mapRowToSnapshot', () => {
      const row: InForceSnapshotRow = {
        navarea: 'I',
        snapshot_warning_id: 'NAVAREA I 100/26',
        source_id: 'src-navarea-1',
        issued_at: '2026-10-22T00:00:00Z',
        entries: null as any,
        cancelled_refs: null as any,
      };

      const snapshot = mapRowToSnapshot(row);
      expect(snapshot.entries).toEqual([]);
      expect(snapshot.cancelledRefs).toEqual([]);
      expect(snapshot.isPartial).toBe(false);
      expect(snapshot.isAuthoritative).toBe(false);
      expect(snapshot.id).toBe('');
    });
  });

  // =========================================================================
  // 2. Feature Flag & Client Availability Tests
  // =========================================================================
  describe('Feature Flag & Availability Gates', () => {
    it('returns null and does not query database when feature flag is disabled', async () => {
      FEATURE_FLAGS.inForceSnapshots = false;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await saveSnapshot({
        navarea: 'IX',
        snapshotWarningId: 'NAVAREA IX 100/26',
        sourceId: 'src-1',
        issuedAt: new Date(),
        entries: [],
      });

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('FEATURE_FLAGS.inForceSnapshots')
      );
    });

    it('returns null when Supabase client is unavailable', async () => {
      setSnapshotSupabaseClient(null);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await saveSnapshot({
        navarea: 'IX',
        snapshotWarningId: 'NAVAREA IX 100/26',
        sourceId: 'src-1',
        issuedAt: new Date(),
        entries: [],
      });

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Supabase client unavailable')
      );
    });
  });

  // =========================================================================
  // 3. PostgREST Query Chains: saveSnapshot (Upsert)
  // =========================================================================
  describe('saveSnapshot with PostgREST upsert', () => {
    it('successfully calls upsert with onConflict constraint and returns hydrated snapshot', async () => {
      const mockSavedRow: InForceSnapshotRow = {
        id: 'snapshot-uuid-999',
        navarea: 'IX',
        snapshot_warning_id: 'NAVAREA IX 1000/26',
        source_id: 'src-navarea-9',
        issued_at: '2026-10-22T08:00:00.000Z',
        issue_date: '22 OCT 2026',
        entries: [{ seriesYear: 26, number: 977, warningId: 'NAVAREA IX 977/26' }],
        cancelled_refs: ['NAVAREA IX 857/26'],
        is_partial: false,
        is_authoritative: true,
        created_at: '2026-10-22T08:00:01.000Z',
        updated_at: '2026-10-22T08:00:01.000Z',
      };

      const singleMock = vi.fn().mockResolvedValue({ data: mockSavedRow, error: null });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
      const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });

      const mockClient = { from: fromMock };
      setSnapshotSupabaseClient(mockClient);

      const result = await saveSnapshot({
        navarea: 'IX',
        snapshotWarningId: 'NAVAREA IX 1000/26',
        sourceId: 'src-navarea-9',
        issuedAt: new Date('2026-10-22T08:00:00Z'),
        issueDate: '22 OCT 2026',
        entries: [{ seriesYear: 26, number: 977, warningId: 'NAVAREA IX 977/26' }],
        cancelledRefs: ['NAVAREA IX 857/26'],
        isAuthoritative: true,
      });

      expect(fromMock).toHaveBeenCalledWith('in_force_snapshots');
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          navarea: 'IX',
          snapshot_warning_id: 'NAVAREA IX 1000/26',
          source_id: 'src-navarea-9',
          is_authoritative: true,
        }),
        { onConflict: 'navarea,snapshot_warning_id' }
      );
      expect(selectMock).toHaveBeenCalled();
      expect(singleMock).toHaveBeenCalled();

      expect(result).not.toBeNull();
      expect(result?.id).toBe('snapshot-uuid-999');
      expect(result?.navarea).toBe('IX');
      expect(result?.entries).toHaveLength(1);
    });

    it('returns null and logs error when PostgREST upsert fails', async () => {
      const errorMock = { message: 'unique constraint violation', code: '23505' };
      const singleMock = vi.fn().mockResolvedValue({ data: null, error: errorMock });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
      const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });

      setSnapshotSupabaseClient({ from: fromMock });
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await saveSnapshot({
        navarea: 'IX',
        snapshotWarningId: 'NAVAREA IX 1000/26',
        sourceId: 'src-9',
        issuedAt: new Date(),
        entries: [],
      });

      expect(result).toBeNull();
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error saving in-force snapshot'),
        errorMock
      );
    });
  });

  // =========================================================================
  // 4. Query Chains: getLatestSnapshot & getAuthoritativeSnapshot
  // =========================================================================
  describe('Query Chains: getLatestSnapshot & getAuthoritativeSnapshot', () => {
    it('executes getLatestSnapshot with ordered query chain', async () => {
      const mockRow: InForceSnapshotRow = {
        id: 'snap-1',
        navarea: 'IV',
        snapshot_warning_id: 'NAVAREA IV 1000/26',
        source_id: 'src-4',
        issued_at: '2026-10-22T10:00:00Z',
        entries: [],
        cancelled_refs: [],
      };

      const maybeSingleMock = vi.fn().mockResolvedValue({ data: mockRow, error: null });
      const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      setSnapshotSupabaseClient({ from: fromMock });

      const result = await getLatestSnapshot('iv');

      expect(fromMock).toHaveBeenCalledWith('in_force_snapshots');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(eqMock).toHaveBeenCalledWith('navarea', 'IV');
      expect(orderMock).toHaveBeenCalledWith('issued_at', { ascending: false });
      expect(limitMock).toHaveBeenCalledWith(1);
      expect(maybeSingleMock).toHaveBeenCalled();
      expect(result?.snapshotWarningId).toBe('NAVAREA IV 1000/26');
    });

    it('executes getAuthoritativeSnapshot with authoritative query chain', async () => {
      const mockRow: InForceSnapshotRow = {
        id: 'snap-auth',
        navarea: 'IX',
        snapshot_warning_id: 'NAVAREA IX 363/26',
        source_id: 'src-9',
        issued_at: '2026-10-22T08:00:00Z',
        entries: [],
        cancelled_refs: [],
        is_authoritative: true,
      };

      const maybeSingleMock = vi.fn().mockResolvedValue({ data: mockRow, error: null });
      const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const eqAuthMock = vi.fn().mockReturnValue({ order: orderMock });
      const eqNavareaMock = vi.fn().mockReturnValue({ eq: eqAuthMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqNavareaMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      setSnapshotSupabaseClient({ from: fromMock });

      const result = await getAuthoritativeSnapshot('IX');

      expect(fromMock).toHaveBeenCalledWith('in_force_snapshots');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(eqNavareaMock).toHaveBeenCalledWith('navarea', 'IX');
      expect(eqAuthMock).toHaveBeenCalledWith('is_authoritative', true);
      expect(orderMock).toHaveBeenCalledWith('issued_at', { ascending: false });
      expect(limitMock).toHaveBeenCalledWith(1);
      expect(result?.isAuthoritative).toBe(true);
    });
  });

  // =========================================================================
  // 5. Query Chains: listSnapshots & Pagination
  // =========================================================================
  describe('listSnapshots with filtering and pagination', () => {
    it('queries all snapshots ordered by issued_at with limit', async () => {
      const mockRows: InForceSnapshotRow[] = [
        {
          id: 's1',
          navarea: 'IX',
          snapshot_warning_id: 'NAVAREA IX 2/26',
          source_id: 'src-9',
          issued_at: '2026-10-22T12:00:00Z',
          entries: [],
        },
        {
          id: 's2',
          navarea: 'IX',
          snapshot_warning_id: 'NAVAREA IX 1/26',
          source_id: 'src-9',
          issued_at: '2026-10-22T10:00:00Z',
          entries: [],
        },
      ];

      const limitMock = vi.fn().mockResolvedValue({ data: mockRows, error: null });
      const eqMock = vi.fn().mockReturnValue({ limit: limitMock });
      const orderMock = vi.fn().mockReturnValue({ eq: eqMock });
      const selectMock = vi.fn().mockReturnValue({ order: orderMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      setSnapshotSupabaseClient({ from: fromMock });

      const results = await listSnapshots({ navarea: 'IX', limit: 10 });

      expect(fromMock).toHaveBeenCalledWith('in_force_snapshots');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(orderMock).toHaveBeenCalledWith('issued_at', { ascending: false });
      expect(eqMock).toHaveBeenCalledWith('navarea', 'IX');
      expect(limitMock).toHaveBeenCalledWith(10);
      expect(results).toHaveLength(2);
      expect(results[0].snapshotWarningId).toBe('NAVAREA IX 2/26');
    });

    it('applies range pagination when offset and limit are specified', async () => {
      const rangeMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
      const selectMock = vi.fn().mockReturnValue({ order: orderMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      setSnapshotSupabaseClient({ from: fromMock });

      await listSnapshots({ offset: 20, limit: 10 });

      expect(rangeMock).toHaveBeenCalledWith(20, 29); // offset to offset + limit - 1
    });
  });

  // =========================================================================
  // 6. Two-Step Authoritative Snapshot Transition
  // =========================================================================
  describe('setAuthoritativeSnapshot', () => {
    it('demotes existing authoritative snapshot then promotes the target snapshot', async () => {
      // Setup step 1: demote existing
      const step1EqAuth = vi.fn().mockResolvedValue({ error: null });
      const step1EqNavarea = vi.fn().mockReturnValue({ eq: step1EqAuth });
      const step1Update = vi.fn().mockReturnValue({ eq: step1EqNavarea });

      // Setup step 2: promote target
      const step2EqNavarea = vi.fn().mockResolvedValue({ error: null });
      const step2EqId = vi.fn().mockReturnValue({ eq: step2EqNavarea });
      const step2Update = vi.fn().mockReturnValue({ eq: step2EqId });

      let callCount = 0;
      const fromMock = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { update: step1Update };
        }
        return { update: step2Update };
      });

      setSnapshotSupabaseClient({ from: fromMock });

      const success = await setAuthoritativeSnapshot('snap-uuid-456', 'IX');

      expect(success).toBe(true);
      expect(step1Update).toHaveBeenCalledWith({ is_authoritative: false });
      expect(step1EqNavarea).toHaveBeenCalledWith('navarea', 'IX');
      expect(step1EqAuth).toHaveBeenCalledWith('is_authoritative', true);

      expect(step2Update).toHaveBeenCalledWith({ is_authoritative: true });
      expect(step2EqId).toHaveBeenCalledWith('id', 'snap-uuid-456');
      expect(step2EqNavarea).toHaveBeenCalledWith('navarea', 'IX');
    });

    it('aborts and returns false if demoting existing authoritative snapshot fails', async () => {
      const step1EqAuth = vi.fn().mockResolvedValue({ error: { message: 'db error' } });
      const step1EqNavarea = vi.fn().mockReturnValue({ eq: step1EqAuth });
      const step1Update = vi.fn().mockReturnValue({ eq: step1EqNavarea });
      const fromMock = vi.fn().mockReturnValue({ update: step1Update });

      setSnapshotSupabaseClient({ from: fromMock });
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const success = await setAuthoritativeSnapshot('snap-uuid-456', 'IX');

      expect(success).toBe(false);
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error demoting existing authoritative snapshot'),
        expect.anything()
      );
    });
  });

  // =========================================================================
  // 7. createSnapshotFromParsedList Integration Helper
  // =========================================================================
  describe('createSnapshotFromParsedList', () => {
    it('returns null if input is not an in-force list (isList === false)', async () => {
      const nonList: ParsedInForceList = {
        isList: false,
        warningId: 'NAVAREA IX 10/26',
        navarea: 'IX',
        inForceEntries: [],
        cancelledRefs: [],
        cancellationDetails: [],
        isPartialList: false,
        entryCount: 0,
        rawText: 'GUNNERY EXERCISE IN PROGRESS',
        isSelfCancelling: false,
      };

      const result = await createSnapshotFromParsedList(nonList, 'src-9');
      expect(result).toBeNull();
    });

    it('bridges ParsedInForceList directly into saveSnapshot', async () => {
      const parsedList: ParsedInForceList = {
        isList: true,
        warningId: 'NAVAREA IX 1000/26',
        navarea: 'IX',
        inForceEntries: [
          { seriesYear: 26, number: 1, warningId: 'NAVAREA IX 1/26' },
          { seriesYear: 26, number: 7, warningId: 'NAVAREA IX 7/26' },
        ],
        cancelledRefs: ['NAVAREA IX 990/26'],
        cancellationDetails: [],
        isPartialList: false,
        entryCount: 2,
        rawText: 'NAVAREA IX 1000/26...',
        isSelfCancelling: false,
        asOfDate: '22 OCT 2026',
      };

      const mockSavedRow: InForceSnapshotRow = {
        id: 'snapshot-from-parser',
        navarea: 'IX',
        snapshot_warning_id: 'NAVAREA IX 1000/26',
        source_id: 'src-feed',
        issued_at: '2026-10-22T08:00:00Z',
        issue_date: '22 OCT 2026',
        entries: parsedList.inForceEntries,
        cancelled_refs: ['NAVAREA IX 990/26'],
        is_partial: false,
        is_authoritative: true,
      };

      const singleMock = vi.fn().mockResolvedValue({ data: mockSavedRow, error: null });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
      const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock });

      setSnapshotSupabaseClient({ from: fromMock });

      const result = await createSnapshotFromParsedList(
        parsedList,
        'src-feed',
        new Date('2026-10-22T08:00:00Z'),
        true
      );

      expect(result?.id).toBe('snapshot-from-parser');
      expect(result?.snapshotWarningId).toBe('NAVAREA IX 1000/26');
      expect(result?.entries).toHaveLength(2);
      expect(result?.isAuthoritative).toBe(true);
    });
  });
});

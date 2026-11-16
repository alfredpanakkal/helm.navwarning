import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SUPABASE_JS = fileURLToPath(new URL('../../../public/assets/js/supabase.js', import.meta.url));
const PUBLIC_JS = fileURLToPath(new URL('../../../public/assets/js/public.js', import.meta.url));

type Row = Record<string, any>;
type QueryResult = { data: Row[] | null; error: { message: string } | null };

interface Scenario {
  spatialRows: Row[];
  textResult?: QueryResult;
  spatialError?: { message: string } | null;
  pageErrorAt?: number;
  pageOverrides?: Record<number, QueryResult>;
}

function makeClient(scenario: Scenario, calls: string[], orderCalls: unknown[][], idFilterCalls: unknown[][]) {
  return {
    from(table: string) {
      calls.push(table);
      return {
        select(columns: string) {
          let from = 0;
          let to = Number.MAX_SAFE_INTEGER;
          const isSpatial = table === 'nav_warnings_active_spatial';
          const isText = table === 'nav_warnings' && columns === 'id, raw_text, issued_at, parsing_method, qa_flags';
          if (!isSpatial && !isText) throw new Error('Unexpected public query: ' + table + ' / ' + columns);
          const builder = {
            eq: (...args: unknown[]) => { idFilterCalls.push(args); return builder; },
            in: (...args: unknown[]) => { idFilterCalls.push(args); return builder; },
            order: (...args: unknown[]) => { orderCalls.push(args); return builder; },
            range: (start: number, end: number) => { from = start; to = end; return builder; },
            then: (resolve: (value: QueryResult) => unknown, reject?: (error: unknown) => unknown) => {
              if (isText) {
                const textResult = scenario.textResult ?? { data: [], error: null };
                const pagedTextResult = Array.isArray(textResult.data)
                  ? { ...textResult, data: textResult.data.slice(from, to + 1) }
                  : textResult;
                return Promise.resolve(pagedTextResult).then(resolve, reject);
              }
              if (scenario.pageErrorAt === from) {
                return Promise.resolve({ data: null, error: { message: 'page failure' } }).then(resolve, reject);
              }
              const override = scenario.pageOverrides?.[from];
              const result = override ?? {
                data: scenario.spatialRows.slice(from, to + 1),
                error: from === 0 ? (scenario.spatialError ?? null) : null,
              };
              const selected = new Set(columns.split(',').map((column) => column.trim()));
              if (!selected.has('severity') && Array.isArray(result.data)) {
                result.data = result.data.map(({ severity: _severity, ...row }) => row);
              }
              return Promise.resolve(result).then(resolve, reject);
            },
          };
          return builder;
        },
      };
    },
  };
}

interface Loaded {
  fetchActiveWarnings: (options?: { onCached?: (data: Row[], metadata: { savedAt: string }) => void }) => Promise<unknown>;
  calls: string[];
  orderCalls: unknown[][];
  idFilterCalls: unknown[][];
  warnings: unknown[][];
  window: Record<string, unknown>;
}

function load(scenario: Scenario): Loaded {
  const warnings: unknown[][] = [];
  const calls: string[] = [];
  const orderCalls: unknown[][] = [];
  const idFilterCalls: unknown[][] = [];
  const win: Record<string, any> = {
    supabase: { createClient: () => makeClient(scenario, calls, orderCalls, idFilterCalls) },
  };
  const sandbox = {
    window: win,
    console: { warn: (...args: unknown[]) => warnings.push(args), log: () => {}, error: () => {} },
    fetch: () => Promise.reject(new Error('Unexpected network fallback')),
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(readFileSync(SUPABASE_JS, 'utf8'), context, { filename: 'supabase.js' });
  const hwDb = win.hwDb as { fetchActiveWarnings: () => Promise<unknown> };
  return { fetchActiveWarnings: hwDb.fetchActiveWarnings, calls, orderCalls, idFilterCalls, warnings, window: win };
}

async function getEntries(loaded: Loaded): Promise<Row[]> {
  const result = await loaded.fetchActiveWarnings() as { data: Row[] };
  return result.data;
}

function spatialRow(over: Row = {}): Row {
  return {
    warning_id: 'uuid-1',
    canonical_id: 'TEST-1/26',
    navarea: 'NA I',
    title: 'Test warning',
    area_text: 'Test area',
    categories: ['general'],
    severity: 'moderate',
    status: 'active',
    triage_tier: 'A',
    data_quality: 'EXPLICIT',
    geom_id: 'geom-1',
    feature_type: 'POINT',
    buffer_nm: 0,
    corridor_half_width_nm: 0,
    geojson_blob: { type: 'Point', coordinates: [1, 2] },
    ...over,
  };
}

const EMPTY_TEXT: QueryResult = { data: [], error: null };

describe('public spatial warning fetch', () => {
  it('groups authoritative geometry rows and preserves valid GeoJSON', async () => {
    const rows = [
      spatialRow({ geom_id: 'g-point', canonical_id: 'POINT/26' }),
      spatialRow({
        geom_id: 'g-poly', canonical_id: 'POLY/26', feature_type: 'POLYGON',
        geojson_blob: { type: 'Polygon', coordinates: [[[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]] },
      }),
      spatialRow({ geom_id: 'g-line', canonical_id: 'LINE/26', feature_type: 'LINE',
        geojson_blob: { type: 'LineString', coordinates: [[1, 2], [3, 4]] } }),
    ];
    const loaded = load({ spatialRows: rows, textResult: EMPTY_TEXT });
    const entries = await getEntries(loaded);
    expect(entries.map((entry) => entry.canonical_id)).toEqual(['POINT/26', 'POLY/26', 'LINE/26']);
    expect(entries.find((entry) => entry.canonical_id === 'POLY/26')?.spatial.validation_status).toBe('passed');
    expect(loaded.orderCalls).toEqual([['id', { ascending: true }], ['geom_id', { ascending: true }]]);
  });

  it('paginates public Tier-A bulletin text beyond the PostgREST row limit', async () => {
    const spatialRows = Array.from({ length: 1001 }, (_, index) =>
      spatialRow({
        warning_id: 'uuid-' + index,
        canonical_id: 'TEST-' + index + '/26',
        geom_id: 'geom-' + index,
      })
    );
    const textRows = spatialRows.map((row) => ({
      id: row.warning_id,
      raw_text: 'BULLETIN ' + row.canonical_id,
      issued_at: null,
      parsing_method: 'RULE',
      qa_flags: [],
    }));
    const loaded = load({ spatialRows, textResult: { data: textRows, error: null } });
    const entries = await getEntries(loaded);
    expect(entries).toHaveLength(1001);
    expect(entries.every((entry) => entry.raw_text.startsWith('BULLETIN '))).toBe(true);
    expect(loaded.orderCalls.filter((call) => call[0] === 'id')).toHaveLength(2);
  });

  it('uses canonical severity from the spatial view independently of parser triage', async () => {
    const loaded = load({
      spatialRows: [
        spatialRow({ geom_id: 'g-critical', canonical_id: 'CRITICAL/26', severity: 'critical' }),
        spatialRow({ geom_id: 'g-high', canonical_id: 'HIGH/26', severity: 'high' }),
        spatialRow({ geom_id: 'g-moderate', canonical_id: 'MODERATE/26', severity: 'moderate' }),
      ],
      textResult: EMPTY_TEXT,
    });
    const entries = await getEntries(loaded);
    expect(entries.map((entry) => entry.severity)).toEqual(['critical', 'high', 'moderate']);
  });

  it('defaults missing or unknown severity to moderate, never deriving it from triage', async () => {
    const loaded = load({
      spatialRows: [
        spatialRow({ geom_id: 'g-missing', canonical_id: 'MISSING/26', severity: undefined }),
        spatialRow({ geom_id: 'g-unknown', canonical_id: 'UNKNOWN/26', severity: 'caution' }),
      ],
      textResult: EMPTY_TEXT,
    });
    const entries = await getEntries(loaded);
    expect(entries.map((entry) => entry.severity)).toEqual(['moderate', 'moderate']);
  });

  it('never includes Tier B or Tier C rows even if returned by the spatial view', async () => {
    const loaded = load({
      spatialRows: [
        spatialRow({ geom_id: 'g-tier-b', canonical_id: 'TIER-B/26', triage_tier: 'B' }),
        spatialRow({ geom_id: 'g-tier-c', canonical_id: 'TIER-C/26', triage_tier: 'C' }),
      ],
      textResult: EMPTY_TEXT,
    });
    await expect(loaded.fetchActiveWarnings()).resolves.toMatchObject({ data: [] });
  });

  it('treats a successful empty spatial view as a legitimate empty result', async () => {
    const loaded = load({ spatialRows: [], textResult: EMPTY_TEXT });
    await expect(loaded.fetchActiveWarnings()).resolves.toMatchObject({ data: [] });
    expect(loaded.calls).toEqual(['nav_warnings', 'nav_warnings_active_spatial']);
  });

  it('rejects a spatial-view query error instead of falling back to master warnings', async () => {
    const loaded = load({ spatialRows: [], spatialError: { message: 'view unavailable' }, textResult: EMPTY_TEXT });
    await expect(loaded.fetchActiveWarnings()).rejects.toThrow('Authoritative spatial query failed: view unavailable');
    expect(loaded.calls).toEqual(['nav_warnings', 'nav_warnings_active_spatial']);
  });

  it('retrieves every row beyond the 1,000-row PostgREST page size', async () => {
    const rows = Array.from({ length: 1505 }, (_, index) =>
      spatialRow({ geom_id: 'geom-' + index, canonical_id: 'TEST-' + index + '/26' })
    );
    const loaded = load({ spatialRows: rows, textResult: EMPTY_TEXT });
    const entries = await getEntries(loaded);
    expect(entries).toHaveLength(1505);
  });

  it('does not return a partial dataset when a later page fails', async () => {
    const rows = Array.from({ length: 1505 }, (_, index) =>
      spatialRow({ geom_id: 'geom-' + index, canonical_id: 'TEST-' + index + '/26' })
    );
    const loaded = load({ spatialRows: rows, pageErrorAt: 1000, textResult: EMPTY_TEXT });
    await expect(loaded.fetchActiveWarnings()).rejects.toThrow('Authoritative spatial query failed: page failure');
  });

  it('deduplicates a geometry repeated at a page boundary', async () => {
    const rows = Array.from({ length: 1001 }, (_, index) =>
      spatialRow({ geom_id: 'geom-' + index, canonical_id: 'TEST-' + index + '/26' })
    );
    const loaded = load({
      spatialRows: rows,
      pageOverrides: { 1000: { data: [rows[999], rows[1000]], error: null } },
      textResult: EMPTY_TEXT,
    });
    const entries = await getEntries(loaded);
    expect(entries).toHaveLength(1001);
  });

  it('limits text hydration to the public Tier-A tier and returns only spatially published rows', async () => {
    const loaded = load({
      spatialRows: [
        spatialRow({ warning_id: 'public-uuid', geom_id: 'g-public', triage_tier: 'A' }),
        spatialRow({ warning_id: 'review-uuid', geom_id: 'g-review', canonical_id: 'REVIEW/26', triage_tier: 'B' }),
      ],
      textResult: {
        data: [{
          id: 'public-uuid',
          raw_text: 'PUBLIC BULLETIN',
          issued_at: null,
          parsing_method: 'RULE',
          qa_flags: [],
        }],
        error: null,
      },
    });
    const entries = await getEntries(loaded);
    expect(entries).toHaveLength(1);
    expect(loaded.idFilterCalls).toContainEqual(['triage_tier', 'A']);
    expect(loaded.idFilterCalls).toContainEqual(['status', 'active']);
    expect(loaded.calls).toEqual(['nav_warnings', 'nav_warnings_active_spatial']);
  });

  it('uses the in-memory public snapshot when a later refresh fails', async () => {
    const loaded = load({
      spatialRows: [spatialRow()],
      textResult: {
        data: [{
          id: 'uuid-1',
          raw_text: 'CURRENT BULLETIN',
          issued_at: null,
          parsing_method: 'RULE',
          qa_flags: [],
        }],
        error: null,
      },
    });
    await getEntries(loaded);
    let cachedRows: Row[] = [];
    loaded.window.hwSupabase = {
      from: () => ({
        select: () => ({
          order: () => ({
            range: () => Promise.resolve({ data: null, error: { message: 'offline' } }),
          }),
        }),
      }),
    };
    const result = await loaded.fetchActiveWarnings({
      onCached: (data) => { cachedRows = data; },
    }) as { data: Row[]; source: string };
    expect(cachedRows).toHaveLength(1);
    expect(result.source).toBe('cache');
    expect(result.data[0].raw_text).toBe('CURRENT BULLETIN');
  });

  it('replaces the complete cached snapshot so a cancelled warning is not retained after refresh', async () => {
    const loaded = load({
      spatialRows: [spatialRow()],
      textResult: {
        data: [{
          id: 'uuid-1',
          raw_text: 'WARNING THAT WILL BE CANCELLED',
          issued_at: null,
          parsing_method: 'RULE',
          qa_flags: [],
        }],
        error: null,
      },
    });
    await getEntries(loaded);

    // A successful authoritative refresh returns an empty public view.
    loaded.window.hwSupabase = {
      from: () => ({
        select: () => {
          const builder: any = {
            eq: () => builder,
            order: () => builder,
            range: () => Promise.resolve({ data: [], error: null }),
            then: (resolve: (value: QueryResult) => unknown) =>
              Promise.resolve({ data: [], error: null }).then(resolve),
          };
          return builder;
        },
      }),
    };
    let previousSnapshot: Row[] = [];
    const refreshed = await loaded.fetchActiveWarnings({
      onCached: (data) => { previousSnapshot = data; },
    }) as { data: Row[]; source: string };
    expect(previousSnapshot).toHaveLength(1);
    expect(refreshed.source).toBe('network');
    expect(refreshed.data).toEqual([]);

    // If the next refresh fails, the replaced empty snapshot is what remains.
    loaded.window.hwSupabase = {
      from: () => ({
        select: () => ({
          order: () => ({
            range: () => Promise.resolve({ data: null, error: { message: 'offline' } }),
          }),
          eq: () => ({
            eq: () => ({
              then: (resolve: (value: QueryResult) => unknown) =>
                Promise.resolve({ data: null, error: { message: 'offline' } }).then(resolve),
            }),
          }),
        }),
      }),
    };
    const afterFailure = await loaded.fetchActiveWarnings() as { data: Row[]; source: string };
    expect(afterFailure.source).toBe('cache');
    expect(afterFailure.data).toEqual([]);
  });

  it('rejects malformed polygon geometry and does not mark it as passed', async () => {
    const invalid = spatialRow({
      geom_id: 'g-invalid', canonical_id: 'INVALID/26', feature_type: 'POLYGON',
      geojson_blob: { type: 'Polygon', coordinates: [[[0, 0], [0, 2], [2, 2], [2, 0]]] },
    });
    const loaded = load({ spatialRows: [invalid], textResult: EMPTY_TEXT });
    const entries = await getEntries(loaded);
    expect(entries).toHaveLength(1);
    expect(entries[0].geometries).toEqual([]);
    expect(entries[0].spatial.validation_status).toBe('not_present');
  });

  it('shows fresh geometry during incomplete text hydration without replacing the last complete snapshot', async () => {
    const scenario: Scenario = {
      spatialRows: [spatialRow()],
      textResult: {
        data: [{
          id: 'uuid-1',
          raw_text: 'PREVIOUS COMPLETE BULLETIN',
          issued_at: null,
          parsing_method: 'RULE',
          qa_flags: [],
        }],
        error: null,
      },
    };
    const loaded = load(scenario);
    const initial = await loaded.fetchActiveWarnings() as { data: Row[]; source: string; complete: boolean };
    expect(initial.source).toBe('network');
    expect(initial.complete).toBe(true);
    expect(initial.data[0].raw_text).toBe('PREVIOUS COMPLETE BULLETIN');

    scenario.spatialRows = [spatialRow({
      warning_id: 'uuid-2',
      canonical_id: 'NEWLY-ISSUED/26',
      geom_id: 'geom-new',
      title: 'Newly issued warning',
    })];
    scenario.textResult = { data: null, error: { message: 'text unavailable' } };

    const partial = await loaded.fetchActiveWarnings() as { data: Row[]; source: string; complete: boolean };
    expect(partial.source).toBe('network');
    expect(partial.complete).toBe(false);
    expect(partial.data).toHaveLength(1);
    expect(partial.data[0].canonical_id).toBe('NEWLY-ISSUED/26');
    expect(partial.data[0].geometries).toHaveLength(1);
    expect(partial.data[0].raw_text).toBeUndefined();

    // A spatial failure proves partial data did not replace the saved snapshot.
    scenario.spatialError = { message: 'spatial refresh failed' };
    const afterSpatialFailure = await loaded.fetchActiveWarnings() as { data: Row[]; source: string };
    expect(afterSpatialFailure.source).toBe('cache');
    expect(afterSpatialFailure.data[0].canonical_id).toBe('TEST-1/26');
    expect(afterSpatialFailure.data[0].raw_text).toBe('PREVIOUS COMPLETE BULLETIN');

    // A complete retry updates the cache with the newly issued warning.
    scenario.spatialError = null;
    scenario.textResult = {
      data: [{
        id: 'uuid-2',
        raw_text: 'NEWLY ISSUED COMPLETE BULLETIN',
        issued_at: null,
        parsing_method: 'RULE',
        qa_flags: [],
      }],
      error: null,
    };
    const recovered = await loaded.fetchActiveWarnings() as { data: Row[]; source: string; complete: boolean };
    expect(recovered.source).toBe('network');
    expect(recovered.complete).toBe(true);
    expect(recovered.data[0].raw_text).toBe('NEWLY ISSUED COMPLETE BULLETIN');

    scenario.spatialError = { message: 'later failure' };
    const afterRecoveryFailure = await loaded.fetchActiveWarnings() as { data: Row[]; source: string };
    expect(afterRecoveryFailure.source).toBe('cache');
    expect(afterRecoveryFailure.data[0].canonical_id).toBe('NEWLY-ISSUED/26');
  });

  it('marks a successful spatial response with zero text rows as incomplete', async () => {
    const loaded = load({
      spatialRows: [spatialRow()],
      textResult: { data: [], error: null },
    });
    const result = await loaded.fetchActiveWarnings() as { data: Row[]; complete: boolean };
    expect(result.complete).toBe(false);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].raw_text).toBeUndefined();
    expect(result.data[0].geometries).toHaveLength(1);
  });

  it('hydrates Tier-A verification and the explicit issue date from the bulletin', async () => {
    const loaded = load({
      spatialRows: [spatialRow()],
      textResult: {
        data: [{
          id: 'uuid-1',
          raw_text: 'NO.26-0507 Date:2026/11/10 12 UTC\\nAREA BOUNDED BY',
          issued_at: null,
          parsing_method: 'RULE',
          qa_flags: ['geometry_basis:keyword:area_bounded'],
        }],
        error: null,
      },
    });
    const entries = await getEntries(loaded);
    expect(entries[0].is_verified).toBe(true);
    expect(entries[0].issued_date).toBe('2026-11-10');
    expect(entries[0].issued_at).toBe('2026-11-10T12:00:00.000Z');
  });

  it('does not mark non-explicit or review-flagged rows as verified', async () => {
    const loaded = load({
      spatialRows: [spatialRow()],
      textResult: {
        data: [{
          id: 'uuid-1',
          raw_text: 'NO.26-0507',
          issued_at: null,
          parsing_method: 'AI',
          qa_flags: ['VALIDATION_FAILED'],
        }],
        error: null,
      },
    });
    const entries = await getEntries(loaded);
    expect(entries[0].is_verified).toBe(false);
  });

  it('does not contain a renderer fallback that reconstructs geometry from bulletin text or coordinates', () => {
    const source = readFileSync(PUBLIC_JS, 'utf8');
    expect(source).not.toContain('extractGeometriesFromRawText');
    expect(source).not.toContain('const rawBulletin = w.raw_text');
    expect(source).not.toContain('const repLat = Number(w.latitude ?? w.lat)');
    expect(source).not.toContain('SEED_WARNINGS');
    expect(source).toContain("return result.complete === false ? 'partial' : 'fresh';");
    expect(source).toContain('Data unavailable — authoritative warning geometry could not be loaded');
  });
});

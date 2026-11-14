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

function makeClient(scenario: Scenario, calls: string[], orderCalls: unknown[][]) {
  return {
    from(table: string) {
      calls.push(table);
      return {
        select(columns: string) {
          let from = 0;
          let to = Number.MAX_SAFE_INTEGER;
          const isSpatial = table === 'nav_warnings_active_spatial';
          const isText = table === 'nav_warnings' && columns === 'id, raw_text, issued_at';
          if (!isSpatial && !isText) throw new Error('Unexpected public query: ' + table + ' / ' + columns);
          const builder = {
            eq: () => builder,
            order: (...args: unknown[]) => { orderCalls.push(args); return builder; },
            range: (start: number, end: number) => { from = start; to = end; return builder; },
            then: (resolve: (value: QueryResult) => unknown, reject?: (error: unknown) => unknown) => {
              if (isText) return Promise.resolve(scenario.textResult ?? { data: [], error: null }).then(resolve, reject);
              if (scenario.pageErrorAt === from) {
                return Promise.resolve({ data: null, error: { message: 'page failure' } }).then(resolve, reject);
              }
              const override = scenario.pageOverrides?.[from];
              const result = override ?? {
                data: scenario.spatialRows.slice(from, to + 1),
                error: from === 0 ? (scenario.spatialError ?? null) : null,
              };
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
  fetchActiveWarnings: () => Promise<unknown>;
  calls: string[];
  orderCalls: unknown[][];
  warnings: unknown[][];
}

function load(scenario: Scenario): Loaded {
  const warnings: unknown[][] = [];
  const calls: string[] = [];
  const orderCalls: unknown[][] = [];
  const win: Record<string, unknown> = {
    supabase: { createClient: () => makeClient(scenario, calls, orderCalls) },
  };
  const sandbox = {
    window: win,
    console: { warn: (...args: unknown[]) => warnings.push(args), log: () => {}, error: () => {} },
    fetch: () => Promise.reject(new Error('Unexpected network fallback')),
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(readFileSync(SUPABASE_JS, 'utf8'), context, { filename: 'supabase.js' });
  const hwDb = win.hwDb as { fetchActiveWarnings: () => Promise<unknown> };
  return { fetchActiveWarnings: hwDb.fetchActiveWarnings, calls, orderCalls, warnings };
}

function spatialRow(over: Row = {}): Row {
  return {
    warning_id: 'uuid-1',
    canonical_id: 'TEST-1/26',
    navarea: 'NA I',
    title: 'Test warning',
    area_text: 'Test area',
    categories: ['general'],
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
    const entries = await loaded.fetchActiveWarnings() as Row[];
    expect(entries.map((entry) => entry.canonical_id)).toEqual(['POINT/26', 'POLY/26', 'LINE/26']);
    expect(entries.find((entry) => entry.canonical_id === 'POLY/26')?.spatial.validation_status).toBe('passed');
    expect(loaded.orderCalls).toEqual([['geom_id', { ascending: true }]]);
  });

  it('never includes Tier B or Tier C rows even if returned by the spatial view', async () => {
    const loaded = load({
      spatialRows: [
        spatialRow({ geom_id: 'g-tier-b', canonical_id: 'TIER-B/26', triage_tier: 'B' }),
        spatialRow({ geom_id: 'g-tier-c', canonical_id: 'TIER-C/26', triage_tier: 'C' }),
      ],
      textResult: EMPTY_TEXT,
    });
    await expect(loaded.fetchActiveWarnings()).resolves.toEqual([]);
  });

  it('treats a successful empty spatial view as a legitimate empty result', async () => {
    const loaded = load({ spatialRows: [], textResult: EMPTY_TEXT });
    await expect(loaded.fetchActiveWarnings()).resolves.toEqual([]);
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
    const entries = await loaded.fetchActiveWarnings() as Row[];
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
    const entries = await loaded.fetchActiveWarnings() as Row[];
    expect(entries).toHaveLength(1001);
  });

  it('rejects malformed polygon geometry and does not mark it as passed', async () => {
    const invalid = spatialRow({
      geom_id: 'g-invalid', canonical_id: 'INVALID/26', feature_type: 'POLYGON',
      geojson_blob: { type: 'Polygon', coordinates: [[[0, 0], [0, 2], [2, 2], [2, 0]]] },
    });
    const loaded = load({ spatialRows: [invalid], textResult: EMPTY_TEXT });
    const entries = await loaded.fetchActiveWarnings() as Row[];
    expect(entries).toHaveLength(1);
    expect(entries[0].geometries).toEqual([]);
    expect(entries[0].spatial.validation_status).toBe('not_present');
  });

  it('does not block the map when optional raw-text hydration fails', async () => {
    const loaded = load({
      spatialRows: [spatialRow()],
      textResult: { data: null, error: { message: 'text unavailable' } },
    });
    const entries = await loaded.fetchActiveWarnings() as Row[];
    expect(entries).toHaveLength(1);
    expect(entries[0].geometries).toHaveLength(1);
  });

  it('does not contain a renderer fallback that reconstructs geometry from bulletin text or coordinates', () => {
    const source = readFileSync(PUBLIC_JS, 'utf8');
    expect(source).not.toContain('extractGeometriesFromRawText');
    expect(source).not.toContain('const rawBulletin = w.raw_text');
    expect(source).not.toContain('const repLat = Number(w.latitude ?? w.lat)');
  });
});

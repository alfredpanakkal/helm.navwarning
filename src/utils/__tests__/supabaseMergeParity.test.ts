// Parity test for public/assets/js/supabase.js -> fetchActiveWarnings (spatial view path).
//
// supabase.js is a plain browser script (no exports, uses window globals), so this test
// loads it into a node:vm context with a stubbed window and a fake Supabase client.
// No network, no jsdom, no new dependencies. All data below is fake placeholder data.
//
// The golden file in __snapshots__/ was generated from the code BEFORE the merge was
// moved into mergeSpatialAndTextRows. It must never be regenerated with -u just to make
// a failing run pass. A diff against it means the behaviour changed.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SUPABASE_JS = fileURLToPath(new URL('../../../public/assets/js/supabase.js', import.meta.url));
const GOLDEN = './__snapshots__/supabaseMergeParity.golden.jsonl';

type Row = Record<string, unknown>;
type QueryResult = { data: Row[] | null; error: { message: string } | null };

interface Scenario {
  spatial: QueryResult;
  text: QueryResult;
  master: QueryResult;
}

// ---------- fake Supabase client ----------

// Every query is a chainable thenable. select/eq/order return the same builder,
// and awaiting it resolves to { data, error }. Routing is by table and select string.
function makeClient(scenario: Scenario) {
  return {
    from(table: string) {
      return {
        select(cols: string) {
          let result: QueryResult;
          if (table === 'nav_warnings_active_spatial') {
            result = scenario.spatial;
          } else if (table === 'nav_warnings' && cols === 'id, raw_text, issued_at') {
            result = scenario.text;
          } else if (table === 'nav_warnings') {
            result = scenario.master;
          } else {
            throw new Error(`unexpected query: ${table} / ${cols}`);
          }
          const builder = {
            eq: () => builder,
            order: () => builder,
            then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
              Promise.resolve(result).then(resolve, reject),
          };
          return builder;
        },
      };
    },
  };
}

// ---------- load supabase.js into a vm context ----------

interface Loaded {
  fetchActiveWarnings: () => Promise<unknown>;
  warnings: unknown[][];
}

function load(scenario: Scenario): Loaded {
  const warnings: unknown[][] = [];
  const win: Record<string, unknown> = {
    supabase: { createClient: () => makeClient(scenario) },
  };
  const sandbox = {
    window: win,
    console: { warn: (...a: unknown[]) => warnings.push(a), log: () => {}, error: () => {} },
    // Any fetch in the third fallback must fail loudly, never reach the network.
    fetch: () => Promise.reject(new Error('fetch is not available in this test')),
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(readFileSync(SUPABASE_JS, 'utf8'), context, { filename: 'supabase.js' });
  const hwDb = win.hwDb as { fetchActiveWarnings: () => Promise<unknown> };
  return { fetchActiveWarnings: hwDb.fetchActiveWarnings, warnings };
}

// Cross-realm objects (from the vm context) are normalised to plain JSON.
async function run(scenario: Scenario): Promise<unknown> {
  const { fetchActiveWarnings } = load(scenario);
  const out = await fetchActiveWarnings();
  return JSON.parse(JSON.stringify(out));
}

// ---------- fake fixtures ----------

function spatialRow(over: Row): Row {
  return {
    warning_id: 'uuid-x',
    canonical_id: 'TEST-X/99',
    navarea: 'TT',
    title: 'Fake title',
    area_text: 'Fake area',
    categories: ['general'],
    status: 'active',
    triage_tier: 'A',
    data_quality: 'EXPLICIT',
    valid_from: null,
    valid_to: null,
    radio_frequencies: null,
    space_launch_mission: null,
    geom_id: 'g-x',
    zone_label: null,
    feature_type: 'POINT',
    buffer_nm: 0,
    corridor_half_width_nm: 0,
    geojson_blob: null,
    ...over,
  };
}

const SPATIAL_ROWS: Row[] = [
  // point
  spatialRow({
    warning_id: 'uuid-point', canonical_id: 'TEST-P1/99', title: 'Point warning', geom_id: 'g-p1',
    geojson_blob: { type: 'Point', coordinates: [1.1, 2.2] },
  }),
  // line (3 coordinates), representative point is the middle vertex
  spatialRow({
    warning_id: 'uuid-line', canonical_id: 'TEST-L1/99', title: 'Line warning', geom_id: 'g-l1',
    feature_type: 'LineString', triage_tier: 'B', categories: ['cable'],
    geojson_blob: { type: 'LineString', coordinates: [[1, 2], [3, 4], [5, 6]] },
  }),
  // polygon (4 vertices plus closing vertex)
  spatialRow({
    warning_id: 'uuid-poly', canonical_id: 'TEST-A1/99', title: 'Area warning', geom_id: 'g-a1',
    feature_type: 'Polygon', categories: ['firing', 'general'],
    geojson_blob: { type: 'Polygon', coordinates: [[[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]] },
  }),
  // center + radius
  spatialRow({
    warning_id: 'uuid-circle', canonical_id: 'TEST-C1/99', title: 'Circle warning', geom_id: 'g-c1',
    buffer_nm: 5, zone_label: 'Fake circle',
    geojson_blob: { type: 'Point', coordinates: [7.5, 8.5] },
  }),
  // two POINT rows sharing one canonical_id: stays ONE entry, two Point geometries, never a polygon
  spatialRow({
    warning_id: 'uuid-multi', canonical_id: 'TEST-M1/99', title: 'Two points', geom_id: 'g-m1',
    geojson_blob: { type: 'Point', coordinates: [10, 11] },
  }),
  spatialRow({
    warning_id: 'uuid-multi', canonical_id: 'TEST-M1/99', title: 'Two points', geom_id: 'g-m2',
    geojson_blob: { type: 'Point', coordinates: [12, 13] },
  }),
  // no geometry
  spatialRow({ warning_id: 'uuid-nogeom', canonical_id: 'TEST-N1/99', title: 'No geometry', geom_id: null }),
  // spatial row with no matching text row
  spatialRow({
    warning_id: 'uuid-notext', canonical_id: 'TEST-T1/99', title: 'No text row', geom_id: 'g-t1',
    geojson_blob: { type: 'Point', coordinates: [20, 21] },
  }),
  // out of range point: must pass through exactly as given, no clamp, no flag
  spatialRow({
    warning_id: 'uuid-range', canonical_id: 'TEST-R1/99', title: 'Out of range', geom_id: 'g-r1',
    geojson_blob: { type: 'Point', coordinates: [190, 95] },
  }),
  // no canonical_id: key falls back to warning_id; null categories, tier missing
  spatialRow({
    warning_id: 'uuid-nocanon', canonical_id: null, title: null, geom_id: 'g-n2', categories: null,
    triage_tier: null, status: null, data_quality: null,
    geojson_blob: { type: 'Point', coordinates: [30, 31] },
  }),
];

const TEXT_ROWS: Row[] = [
  { id: 'uuid-point', raw_text: 'FAKE RAW TEXT POINT', issued_at: '2026-01-02T03:04:05Z' },
  { id: 'uuid-line', raw_text: 'FAKE RAW TEXT LINE', issued_at: '2026-01-03T00:00:00Z' },
  { id: 'uuid-poly', raw_text: '', issued_at: '2026-01-04T00:00:00Z' },
  { id: 'uuid-circle', raw_text: 'FAKE RAW TEXT CIRCLE', issued_at: null },
  { id: 'uuid-multi', raw_text: 'FAKE RAW TEXT MULTI', issued_at: '2026-01-05T00:00:00Z' },
  { id: 'uuid-range', raw_text: 'FAKE RAW TEXT RANGE', issued_at: '2026-01-06T00:00:00Z' },
  // orphan: no spatial row, must never appear in the output
  { id: 'uuid-orphan', raw_text: 'FAKE ORPHAN', issued_at: '2026-01-07T00:00:00Z' },
];

const MASTER_ROWS: Row[] = [
  {
    id: 'uuid-m1', canonical_id: 'TEST-F1/99', navarea: 'TT', title: 'Fallback area', area_text: 'Fake',
    categories: ['firing'], status: 'active', triage_tier: 'A', data_quality: 'EXPLICIT',
    valid_from: null, valid_to: null, issued_at: '2026-02-01T00:00:00Z',
    raw_text: 'AREA BOUNDED BY 10-00N 120-00E, 10-00N 121-00E, 11-00N 121-00E, 11-00N 120-00E.',
    created_at: null, updated_at: null,
  },
  {
    id: 'uuid-m2', canonical_id: 'TEST-F2/99', navarea: 'TT', title: 'Fallback no coords', area_text: 'Fake',
    categories: [], status: 'active', triage_tier: 'B', data_quality: 'EXPLICIT',
    valid_from: null, valid_to: null, issued_at: null,
    raw_text: 'FAKE TEXT WITH NO COORDINATES.',
    created_at: null, updated_at: null,
  },
];

const OK = (data: Row[]): QueryResult => ({ data, error: null });

const SCENARIOS: Record<string, Scenario> = {
  // spatial view has rows: the path that gets moved into mergeSpatialAndTextRows
  path1: { spatial: OK(SPATIAL_ROWS), text: OK(TEXT_ROWS), master: OK(MASTER_ROWS) },
  // spatial view empty: falls back to the master table path
  fallbackEmptySpatial: { spatial: OK([]), text: OK(TEXT_ROWS), master: OK(MASTER_ROWS) },
  // spatial view errors: same fallback
  fallbackSpatialError: {
    spatial: { data: null, error: { message: 'fake error' } },
    text: OK(TEXT_ROWS),
    master: OK(MASTER_ROWS),
  },
};

// ---------- tests ----------

describe('supabase.js fetchActiveWarnings: spatial path parity', () => {
  it('matches the golden output generated from the pre-extraction code', async () => {
    // The error scenario is covered by the equality test below, so it is not repeated here.
    const out: Record<string, unknown> = {};
    for (const name of ['path1', 'fallbackEmptySpatial']) {
      out[name] = await run(SCENARIOS[name]);
    }
    // One compact JSON line per scenario, so a failing diff points at the scenario.
    const lines = Object.entries(out).map(([scenario, result]) => JSON.stringify({ scenario, result }));
    await expect(lines.join('\n') + '\n').toMatchFileSnapshot(GOLDEN);
  });

  it('path 1 returns merged entries, never fallback output', async () => {
    const entries = (await run(SCENARIOS.path1)) as Row[];
    // 10 spatial rows collapse to 9 entries (two rows share TEST-M1/99).
    expect(entries).toHaveLength(9);
    // The count and ids below are what tell path 1 apart from fallback 2, which returns
    // 2 rows with other ids. A merge call that throws is swallowed by the try/catch in
    // fetchActiveWarnings and falls through to fallback 2, so these must fail if it does.
    for (const e of entries) expect(e).toHaveProperty('spatial');
    expect(entries.map((e) => e.canonical_id)).toContain('TEST-P1/99');
    expect(entries.map((e) => e.canonical_id)).not.toContain('TEST-F1/99');
  });

  it('keeps representative coordinates and geometry decisions as they were', async () => {
    const entries = (await run(SCENARIOS.path1)) as Row[];
    const byId = (id: string) => entries.find((e) => e.canonical_id === id) as Row;
    expect([byId('TEST-P1/99').latitude, byId('TEST-P1/99').longitude]).toEqual([2.2, 1.1]);
    expect([byId('TEST-L1/99').latitude, byId('TEST-L1/99').longitude]).toEqual([4, 3]);
    expect(byId('TEST-C1/99').buffer_nm).toBe(5);
    expect((byId('TEST-C1/99').spatial as Row).circles).toHaveLength(1);
    // two POINT rows stay two Point geometries in one entry, not a polygon
    const multi = byId('TEST-M1/99');
    expect((multi.geometries as Row[]).map((g) => (g.geojson_blob as Row).type)).toEqual(['Point', 'Point']);
    expect((multi.spatial as Row).circles).toHaveLength(0);
    // out of range point is neither clamped nor flagged
    expect([byId('TEST-R1/99').latitude, byId('TEST-R1/99').longitude]).toEqual([95, 190]);
  });

  it('never emits an orphan text row', async () => {
    const entries = (await run(SCENARIOS.path1)) as Row[];
    expect(JSON.stringify(entries)).not.toContain('FAKE ORPHAN');
  });

  it('spatial error and empty spatial give identical fallback output', async () => {
    const a = await run(SCENARIOS.fallbackEmptySpatial);
    const b = await run(SCENARIOS.fallbackSpatialError);
    expect(a).toEqual(b);
    expect(a as Row[]).toHaveLength(2);
  });

  it('does not mutate the rows it is given', async () => {
    const spatialBefore = structuredClone(SPATIAL_ROWS);
    const textBefore = structuredClone(TEXT_ROWS);
    await run(SCENARIOS.path1);
    expect(SPATIAL_ROWS).toEqual(spatialBefore);
    expect(TEXT_ROWS).toEqual(textBefore);
  });
});

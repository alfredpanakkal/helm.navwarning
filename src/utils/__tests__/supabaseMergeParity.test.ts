import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext as vmCreateContext, runInContext } from 'node:vm';

/**
 * PR A parity test: the spatial-rows + text-rows merge inside fetchActiveWarnings
 * (public/assets/js/supabase.js, now the pure function mergeSpatialAndTextRows)
 * must produce byte-identical output before and after the extraction.
 *
 * Golden snapshot protocol (run against UNCHANGED code first):
 *   1. On main, with only this test file applied:
 *      npx vitest run src/utils/__tests__/supabaseMergeParity.test.ts
 *      -> writes __snapshots__ (the golden). Compare against the reported golden.
 *   2. On the PR branch (move applied), same command -> all tests must pass
 *      against the SAME snapshot. Any snapshot mismatch = STOP.
 *
 * The harness loads the unmodified classic script in node:vm with a stubbed
 * window and a fake Supabase client; no network, no jsdom, no DOM.
 * All fixtures are fake placeholders (TEST-*/99, navarea 'TT'); nothing here
 * resembles a real warning number, NAVAREA or official coordinates.
 */

const SUPABASE_JS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../../public/assets/js/supabase.js');
const SRC = readFileSync(SUPABASE_JS_PATH, 'utf8');

/* eslint-disable @typescript-eslint/no-explicit-any */
type QueryResult = { data: any; error: any };

function makeSpatialRow(o: Record<string, any>) {
  return Object.assign(
    {
      warning_id: 'uuid-' + o.canonical_id,
      navarea: 'TT',
      title: 'TT ' + o.canonical_id,
      area_text: 'area ' + o.canonical_id,
      categories: ['catX'],
      status: 'active',
      triage_tier: 'A',
      data_quality: 'EXPLICIT',
      valid_from: null,
      valid_to: null,
      radio_frequencies: null,
      space_launch_mission: null,
      geom_id: 'geom-' + o.canonical_id,
      zone_label: null,
      feature_type: null,
      buffer_nm: null,
      corridor_half_width_nm: null,
      geojson_blob: null
    },
    o
  );
}

const spatialRows = [
  // point
  makeSpatialRow({ canonical_id: 'TEST-P1/99', feature_type: 'POINT', buffer_nm: 0, geojson_blob: { type: 'Point', coordinates: [1.1, 2.2] }, zone_label: 'pt zone' }),
  // line (3 coordinates)
  makeSpatialRow({ canonical_id: 'TEST-L1/99', feature_type: 'LINE', corridor_half_width_nm: 1.5, geojson_blob: { type: 'LineString', coordinates: [[1, 2], [3, 4], [5, 6]] } }),
  // polygon (4-vertex ring)
  makeSpatialRow({ canonical_id: 'TEST-PG1/99', feature_type: 'POLYGON', geojson_blob: { type: 'Polygon', coordinates: [[[0, 0], [4, 0], [4, 4], [0, 0]]] } }),
  // center + radius
  makeSpatialRow({ canonical_id: 'TEST-R1/99', feature_type: 'POINT', buffer_nm: 5, geojson_blob: { type: 'Point', coordinates: [7.5, 8.5] }, zone_label: 'radius zone' }),
  // multiple coordinates that is NOT a polygon: two POINT rows, same canonical_id
  makeSpatialRow({ canonical_id: 'TEST-MP1/99', feature_type: 'POINT', buffer_nm: 0, geojson_blob: { type: 'Point', coordinates: [1, 1] }, geom_id: 'g-a' }),
  makeSpatialRow({ canonical_id: 'TEST-MP1/99', feature_type: 'POINT', buffer_nm: 0, geojson_blob: { type: 'Point', coordinates: [2, 2] }, geom_id: 'g-b' }),
  // no geometry at all
  makeSpatialRow({ canonical_id: 'TEST-NG1/99', feature_type: null, geojson_blob: null }),
  // invalid / out-of-range coordinates: preserved as-is, never clamped or flagged here
  makeSpatialRow({ canonical_id: 'TEST-INV1/99', feature_type: 'POINT', buffer_nm: 0, geojson_blob: { type: 'Point', coordinates: [190, 95] } }),
  // spatial row with NO matching text row
  makeSpatialRow({ canonical_id: 'TEST-NT1/99', feature_type: 'POINT', buffer_nm: 0, geojson_blob: { type: 'Point', coordinates: [3, 3] } })
];

const textRows = [
  { id: 'uuid-TEST-P1/99', raw_text: 'TEXT P1', issued_at: '2026-01-02T03:04:05Z' },
  { id: 'uuid-TEST-L1/99', raw_text: 'TEXT L1', issued_at: null },
  { id: 'uuid-TEST-PG1/99', raw_text: '', issued_at: '2026-01-02T03:04:05Z' },
  { id: 'uuid-TEST-R1/99', raw_text: 'TEXT R1', issued_at: '2026-01-02T03:04:05Z' },
  { id: 'uuid-TEST-MP1/99', raw_text: 'TEXT MP1', issued_at: '2026-01-02T03:04:05Z' },
  { id: 'uuid-TEST-NG1/99', raw_text: 'TEXT NG1', issued_at: '2026-01-02T03:04:05Z' },
  { id: 'uuid-TEST-INV1/99', raw_text: 'TEXT INV1', issued_at: '2026-01-02T03:04:05Z' },
  // text row with NO matching spatial row: must be ignored by path 1
  { id: 'uuid-TEST-ORPHAN/99', raw_text: 'ORPHAN', issued_at: '2026-01-02T03:04:05Z' }
];

const fallbackRows = [
  {
    id: 'uuid-FB1/99', canonical_id: 'TEST-FB1/99', navarea: 'TT', source_id: 'src-x',
    title: 'FB ONE', area_text: 'fb area', categories: ['catX'], status: 'active', triage_tier: 'A',
    data_quality: 'EXPLICIT', valid_from: null, valid_to: null, issued_at: '2026-01-02T03:04:05Z',
    raw_text: 'TEST FIXTURE. AREA BOUNDED BY 01-00.0N 002-00.0E, 01-00.0N 003-00.0E, 00-30.0N 003-00.0E, 00-30.0N 002-00.0E.',
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z'
  },
  {
    id: 'uuid-FB2/99', canonical_id: 'TEST-FB2/99', navarea: 'TT', source_id: 'src-x',
    title: 'FB TWO', area_text: 'fb area 2', categories: [], status: 'active', triage_tier: null,
    data_quality: null, valid_from: null, valid_to: null, issued_at: null,
    raw_text: 'NO COORDINATES HERE', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z'
  }
];

/**
 * Loads the real (unmodified) supabase.js in a node:vm context with a stubbed
 * window and a fake Supabase client that mimics the exact query chain the code
 * uses: from(table).select(cols), select(...).eq(...), and the fallback's
 * select(LIGHT_COLUMNS).eq(...).order(...). Returns hwDb.fetchActiveWarnings.
 */
function loadDb(spatial: QueryResult, text: QueryResult, fallback: QueryResult): () => Promise<any[]> {
  const chain = (v: unknown): any => ({
    eq: () => chain(v),
    order: () => chain(v),
    maybeSingle: () => chain(v),
    then: (res: any) => Promise.resolve(res(v)),
    catch: () => Promise.resolve(v)
  });
  const client = {
    from(table: string) {
      return {
        select(cols: string) {
          if (table === 'nav_warnings_active_spatial') return chain(spatial);
          if (cols.startsWith('id, raw_text')) return chain(text);
          return chain(fallback);
        }
      };
    }
  };
  const windowStub: any = { supabase: { createClient: () => client } };
  const context = vmCreateContext({
    window: windowStub,
    console,
    fetch: () => Promise.reject(new Error('unexpected network call in parity test'))
  });
  runInContext(SRC, context, { filename: 'supabase.js' });
  const w: any = (context as any).window;
  return w.hwDb.fetchActiveWarnings;
}

async function runScenario(spatial: QueryResult, text: QueryResult, fallback: QueryResult) {
  const fetchActive = loadDb(spatial, text, fallback);
  return await fetchActive();
}

describe('fetchActiveWarnings spatial+text merge (PR A parity)', () => {
  it('path 1: merges spatial and text rows into warning objects (golden snapshot)', async () => {
    const spatialBefore = JSON.parse(JSON.stringify(spatialRows));
    const textBefore = JSON.parse(JSON.stringify(textRows));

    const entries = await runScenario({ data: spatialRows, error: null }, { data: textRows, error: null }, { data: fallbackRows, error: null });

    expect(Array.isArray(entries)).toBe(true);
    expect(entries).toHaveLength(8);

    // Amendment 3: a thrown error swallowed by the try/catch falls through to
    // the fallback output; real path-1 entries always carry a spatial contract.
    for (const entry of entries) {
      expect(Object.prototype.hasOwnProperty.call(entry, 'spatial')).toBe(true);
    }

    const byId: Record<string, any> = {};
    for (const e of entries) byId[e.canonical_id] = e;

    expect(Object.keys(byId).sort()).toEqual([
      'TEST-INV1/99', 'TEST-L1/99', 'TEST-MP1/99', 'TEST-NG1/99',
      'TEST-NT1/99', 'TEST-P1/99', 'TEST-PG1/99', 'TEST-R1/99'
    ]);

    // representative coordinates per geometry type (no coordinate-count inference)
    expect([byId['TEST-P1/99'].latitude, byId['TEST-P1/99'].longitude]).toEqual([2.2, 1.1]);
    expect([byId['TEST-L1/99'].latitude, byId['TEST-L1/99'].longitude]).toEqual([4, 3]);
    expect([byId['TEST-PG1/99'].latitude, byId['TEST-PG1/99'].longitude]).toEqual([1, 2]);
    expect([byId['TEST-MP1/99'].latitude, byId['TEST-MP1/99'].longitude]).toEqual([1, 1]);

    // center + radius -> circle
    expect(byId['TEST-R1/99'].spatial.circles).toHaveLength(1);
    expect(byId['TEST-R1/99'].spatial.circles[0]).toEqual({ center: [7.5, 8.5], radius_nm: 5, label: 'radius zone' });
    expect(byId['TEST-R1/99'].buffer_nm).toBe(5);

    // multiple coordinates, not a polygon
    expect(byId['TEST-MP1/99'].spatial.geometries).toHaveLength(2);
    expect(byId['TEST-MP1/99'].spatial.geometries.every((g: any) => g.type === 'Point')).toBe(true);

    // no geometry
    expect(byId['TEST-NG1/99'].geometries).toHaveLength(0);
    expect(byId['TEST-NG1/99'].latitude).toBeNull();

    // invalid / out-of-range input stays as-is: never clamped, never "fixed"
    expect([byId['TEST-INV1/99'].latitude, byId['TEST-INV1/99'].longitude]).toEqual([95, 190]);
    expect(byId['TEST-INV1/99'].spatial.geometries[0].coordinates).toEqual([190, 95]);

    // spatial row with no matching text row: no raw_text/bulletin/text keys at all
    expect(Object.prototype.hasOwnProperty.call(byId['TEST-NT1/99'], 'raw_text')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(byId['TEST-NT1/99'], 'text')).toBe(false);

    // orphan text row ignored
    expect(entries.some((e: any) => e.id === 'uuid-TEST-ORPHAN/99')).toBe(false);

    // empty raw_text and null issued_at hydrate to '' / null (no guessing)
    expect(byId['TEST-PG1/99'].raw_text).toBe('');
    expect([byId['TEST-L1/99'].issued_at, byId['TEST-L1/99'].issued_date, byId['TEST-L1/99'].issued_text]).toEqual([null, null, null]);

    // the merge must not mutate its inputs
    expect(JSON.parse(JSON.stringify(spatialRows))).toEqual(spatialBefore);
    expect(JSON.parse(JSON.stringify(textRows))).toEqual(textBefore);

    // golden snapshot: generate on UNCHANGED code, verify identical after the move
    expect(JSON.stringify(entries, null, 1)).toMatchSnapshot();
  });

  it('forced fallback (spatial empty / spatial error) produces identical output both ways', async () => {
    const emptySpatial = await runScenario({ data: [], error: null }, { data: textRows, error: null }, { data: fallbackRows, error: null });
    const errorSpatial = await runScenario({ data: null, error: { message: 'forced spatial error' } }, { data: textRows, error: null }, { data: fallbackRows, error: null });

    expect(emptySpatial).toHaveLength(2);
    expect(JSON.stringify(errorSpatial)).toBe(JSON.stringify(emptySpatial));

    expect(Object.prototype.hasOwnProperty.call(emptySpatial[0], 'spatial')).toBe(true);
    expect(emptySpatial[0].canonical_id).toBe('TEST-FB1/99');
    expect(emptySpatial[1].latitude).toBeNull();

    expect(JSON.stringify(emptySpatial, null, 1)).toMatchSnapshot();
  });
});

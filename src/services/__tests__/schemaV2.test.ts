// src/services/__tests__/schemaV2.test.ts
// Contract tests for the 20261019/20 Supabase schema migration.
// Fixture rows mirror what the backend actually writes (docs/supabase-backend-contract.md).

import { describe, it, expect } from 'vitest';
import { mapSupabaseRowToNavWarning, normalizeNavarea, bufferCirclesFromGeometries } from '../api';
import { groupSpatialRowsByCanonicalId, geojsonBlobToGeometry, type ActiveSpatialRow } from '../navWarningQueries';

const viewRow = (over: Partial<ActiveSpatialRow> = {}): ActiveSpatialRow => ({
  warning_id: '11111111-1111-1111-1111-111111111111',
  canonical_id: 'NAVAREA XI 0451/26',
  navarea: 'NAVAREA XI',
  title: 'OKINOTORI SHIMA',
  area_text: 'NORTH PACIFIC',
  categories: ['drifting'],
  status: 'active',
  triage_tier: 'A',
  data_quality: 'EXPLICIT',
  valid_from: '2026-10-09T07:00:00Z',
  valid_to: null,
  radio_frequencies: [],
  space_launch_mission: null,
  geom_id: '22222222-2222-2222-2222-222222222222',
  zone_label: 'HATCH COVER',
  feature_type: 'POINT',
  buffer_nm: 0,
  corridor_half_width_nm: null,
  altitude_floor_m: 0,
  altitude_ceiling_fl: null,
  geom_postgis: '0101000020E6100000...',
  geojson_blob: { type: 'Point', coordinates: [134.6583, 16.9017] },
  ...over,
});

describe('normalizeNavarea', () => {
  it('strips the NAVAREA prefix for roman areas', () => {
    expect(normalizeNavarea('NAVAREA XI')).toBe('XI');
    expect(normalizeNavarea('NAVAREA I')).toBe('I');
  });

  it('maps Baltic to the UI id', () => {
    expect(normalizeNavarea('NAVAREA BALTIC')).toBe('Baltic');
    expect(normalizeNavarea('Baltic')).toBe('Baltic');
  });

  it('defaults safely', () => {
    expect(normalizeNavarea('')).toBe('I');
    expect(normalizeNavarea(undefined)).toBe('I');
  });
});

describe('geojsonBlobToGeometry', () => {
  it('converts a view geojson_blob into a geometry entry', () => {
    const g = geojsonBlobToGeometry({ type: 'Polygon', coordinates: [[[140, 35], [141, 35], [141, 34], [140, 35]]] }, 'AREA A');
    expect(g).toEqual({ type: 'Polygon', coordinates: [[[140, 35], [141, 35], [141, 34], [140, 35]]], label: 'AREA A' });
  });

  it('rejects non-geometry objects', () => {
    expect(geojsonBlobToGeometry(null)).toBeNull();
    expect(geojsonBlobToGeometry({ type: 'Feature' })).toBeNull();
  });
});

describe('groupSpatialRowsByCanonicalId', () => {
  it('groups one warning with multiple geometries into a single record', () => {
    const rows = [
      viewRow(),
      viewRow({ geom_id: '33333333-3333-3333-3333-333333333333', zone_label: 'AREA B', geojson_blob: { type: 'Point', coordinates: [140.0, 35.0] } }),
      viewRow({ canonical_id: 'NAVAREA XI 0452/26', warning_id: '44444444-4444-4444-4444-444444444444' }),
    ];
    const grouped = groupSpatialRowsByCanonicalId(rows);
    expect(grouped).toHaveLength(2);
    const first = grouped.find((g) => (g as any).canonical_id === 'NAVAREA XI 0451/26')!;
    expect((first._geometries as any[])).toHaveLength(2);
    expect(first._geojson).toBeTruthy();
  });

  it('preserves every geometry row for a warning in deterministic order', () => {
    const rows = [
      viewRow(),
      viewRow({ geom_id: '33333333-3333-3333-3333-333333333333', zone_label: 'AREA B', geojson_blob: { type: 'Point', coordinates: [140.0, 35.0] } }),
      viewRow({ geom_id: '44444444-4444-4444-4444-444444444444', zone_label: 'AREA C', geojson_blob: { type: 'LineString', coordinates: [[140, 35], [141, 36]] } }),
    ];
    const grouped = groupSpatialRowsByCanonicalId(rows);
    expect(grouped).toHaveLength(1);
    const geoms = grouped[0]._geometries as any[];
    expect(geoms).toHaveLength(3);
    expect(geoms.map((g) => g.label)).toEqual(['HATCH COVER', 'AREA B', 'AREA C']);
  });

  it('carries persisted buffer_nm and corridor_half_width_nm onto every geometry entry', () => {
    const rows = [
      viewRow({ buffer_nm: 2.5, corridor_half_width_nm: 1 }),
      viewRow({ geom_id: '33333333-3333-3333-3333-333333333333', buffer_nm: 0, corridor_half_width_nm: null, geojson_blob: { type: 'Point', coordinates: [140.0, 35.0] } }),
    ];
    const grouped = groupSpatialRowsByCanonicalId(rows);
    const geoms = grouped[0]._geometries as any[];
    expect(geoms[0].buffer_nm).toBe(2.5);
    expect(geoms[0].corridor_half_width_nm).toBe(1);
    expect(geoms[1].buffer_nm).toBe(0);
    expect(geoms[1].corridor_half_width_nm).toBeNull();
  });

  it('hydrates production-shaped buffered view rows into circles after grouping', () => {
    // Production Supabase view returns one row per geometry. Current live data
    // contains buffered POINT rows with buffer_nm = 1 (double precision).
    const rows = [
      viewRow({ buffer_nm: 1, geojson_blob: { type: 'Point', coordinates: [67.2545, 24.7867] } }),
      viewRow({
        geom_id: '33333333-3333-3333-3333-333333333333',
        zone_label: 'SECOND POSITION',
        buffer_nm: 0,
        geojson_blob: { type: 'Point', coordinates: [67.2612, 24.7880] },
      }),
      viewRow({
        geom_id: '44444444-4444-4444-4444-444444444444',
        zone_label: 'AREA',
        feature_type: 'POLYGON',
        buffer_nm: 0,
        geojson_blob: { type: 'Polygon', coordinates: [[[67.25, 24.78], [67.27, 24.78], [67.27, 24.80], [67.25, 24.78]]] },
      }),
    ];

    const grouped = groupSpatialRowsByCanonicalId(rows);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]._geometries).toHaveLength(3);

    const circles = bufferCirclesFromGeometries(grouped[0]._geometries);
    expect(circles).toEqual([
      { center: [67.2545, 24.7867], radius_nm: 1, label: 'HATCH COVER' },
    ]);
  });

  it('keeps a warning with only malformed geometry rows as zero geometries', () => {
    const grouped = groupSpatialRowsByCanonicalId([
      viewRow({ geojson_blob: { type: 'Feature' } as any }),
      viewRow({ geom_id: '33333333-3333-3333-3333-333333333333', geojson_blob: null }),
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]._geometries).toHaveLength(0);
    expect(grouped[0]._geojson).toBeNull();
  });

  it('does not discard sibling geometry rows when one row is malformed', () => {
    const grouped = groupSpatialRowsByCanonicalId([
      viewRow({ geojson_blob: { garbage: true } as any }),
      viewRow({ geom_id: '33333333-3333-3333-3333-333333333333', zone_label: 'AREA B', geojson_blob: { type: 'Point', coordinates: [140.0, 35.0] } }),
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]._geometries).toHaveLength(1);
    expect((grouped[0]._geometries as any[])[0].label).toBe('AREA B');
  });
});

describe('bufferCirclesFromGeometries', () => {
  it('derives one circle per buffered point using the persisted buffer_nm', () => {
    const circles = bufferCirclesFromGeometries([
      { type: 'Point', coordinates: [134.6583, 16.9017], buffer_nm: 2.5, label: 'WRECK' },
      { type: 'Point', coordinates: [140.0, 35.0], buffer_nm: 0.5 },
    ], 'FALLBACK');
    expect(circles).toHaveLength(2);
    expect(circles[0]).toEqual({ center: [134.6583, 16.9017], radius_nm: 2.5, label: 'WRECK' });
    expect(circles[1].label).toBe('FALLBACK');
  });

  it('never fabricates circles for unbuffered points, polygons or missing metadata', () => {
    expect(bufferCirclesFromGeometries([
      { type: 'Point', coordinates: [134.6583, 16.9017], buffer_nm: 0 },
      { type: 'Point', coordinates: [140.0, 35.0] },
      { type: 'Polygon', coordinates: [[[140, 35], [141, 35], [141, 34], [140, 35]]], buffer_nm: 3 },
      { type: 'Point', coordinates: 'not-an-array', buffer_nm: 2 },
    ])).toEqual([]);
    expect(bufferCirclesFromGeometries(null)).toEqual([]);
    expect(bufferCirclesFromGeometries(undefined)).toEqual([]);
  });

  it('rejects malformed, non-finite and out-of-range point coordinates', () => {
    const invalidGeometries = [
      { type: 'Point', coordinates: [], buffer_nm: 1 },
      { type: 'Point', coordinates: [140], buffer_nm: 1 },
      { type: 'Point', coordinates: [140, 35, 10], buffer_nm: 1 },
      { type: 'Point', coordinates: ['140', 35], buffer_nm: 1 },
      { type: 'Point', coordinates: [Number.NaN, 35], buffer_nm: 1 },
      { type: 'Point', coordinates: [140, Number.POSITIVE_INFINITY], buffer_nm: 1 },
      { type: 'Point', coordinates: [181, 35], buffer_nm: 1 },
      { type: 'Point', coordinates: [140, -91], buffer_nm: 1 },
      { type: 'Point', coordinates: [[140, 35], [141, 36]], buffer_nm: 1 },
      { type: 'Polygon', feature_type: 'POINT', coordinates: [140, 35], buffer_nm: 1 },
      null,
    ];

    for (const geometry of invalidGeometries) {
      expect(bufferCirclesFromGeometries([geometry as any])).toEqual([]);
    }
  });

  it('rejects non-finite, non-positive and non-numeric buffer radii', () => {
    const invalidRadii = [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '2'];

    for (const radius of invalidRadii) {
      expect(bufferCirclesFromGeometries([
        { type: 'Point', coordinates: [140, 35], buffer_nm: radius },
      ])).toEqual([]);
    }
  });
});

describe('mapSupabaseRowToNavWarning (20261019/20 schema)', () => {
  it('maps an active_spatial view row with geometry', () => {
    const w: any = mapSupabaseRowToNavWarning(viewRow(), 'active');
    expect(w.warning_id).toBe('NAVAREA XI 0451/26');
    expect(w.db_uuid).toBe('11111111-1111-1111-1111-111111111111');
    expect(w.navarea).toBe('XI');
    expect(w.status).toBe('active');
    expect(w.categories).toEqual(['drifting']);
    expect(w.hazard_category).toBe('drifting');
    expect(w.spatial.geometries).toHaveLength(1);
    expect(w.spatial.geometries[0].coordinates).toEqual([134.6583, 16.9017]);
    expect(w.triage_tier).toBe('A');
  });

  it('maps a bare nav_warnings table row (no geometry, null dates)', () => {
    const w: any = mapSupabaseRowToNavWarning({
      id: '55555555-5555-5555-5555-555555555555',
      canonical_id: 'NAVAREA BALTIC 034/26',
      navarea: 'NAVAREA BALTIC',
      source_id: 'sma-baltic-subarea',
      title: 'SURVEY OPERATIONS',
      area_text: 'BALTIC SEA',
      raw_text: 'No coordinates in this text.',
      categories: ['subsea'],
      status: 'active',
      triage_tier: 'A',
      data_quality: 'EXPLICIT',
      valid_from: null,
      valid_to: null,
      created_at: '2026-10-18T09:00:00Z',
      updated_at: '2026-10-18T09:00:00Z',
    });
    expect(w.warning_id).toBe('NAVAREA BALTIC 034/26');
    expect(w.navarea).toBe('Baltic');
    expect(w.valid_from).toBeNull();
    expect(w.valid_to).toBeNull(); // in force until cancelled
    expect(w.spatial.geometries).toHaveLength(0);
    expect(w.spatial.validation_status).toBe('not_present');
    expect(w.validation.geometry).toBe('pending');
  });

  it('prefers the complete _geometries array when a row also carries geojson_blob', () => {
    const w: any = mapSupabaseRowToNavWarning({
      canonical_id: 'NAVAREA XI 0451/26',
      navarea: 'NAVAREA XI',
      title: 'GROUPED VIEW ROW',
      status: 'active',
      geojson_blob: { type: 'Point', coordinates: [134.6583, 16.9017] },
      buffer_nm: 0,
      _geometries: [
        { type: 'Point', coordinates: [134.6583, 16.9017], buffer_nm: 2.5, label: 'WRECK' },
        { type: 'Polygon', coordinates: [[[140, 35], [141, 35], [141, 34], [140, 35]]], label: 'AREA A' },
        { type: 'LineString', coordinates: [[140, 35], [141, 36]], label: 'ROUTE' },
      ],
    });

    expect(w.spatial.geometries).toHaveLength(3);
    expect(w.spatial.circles).toEqual([
      { center: [134.6583, 16.9017], radius_nm: 2.5, label: 'WRECK' },
    ]);
  });

  it('maps a pre-grouped _geometries row: all geometries kept, buffered points become circles', () => {
    const w: any = mapSupabaseRowToNavWarning({
      canonical_id: 'NAVAREA XI 0451/26',
      navarea: 'NAVAREA XI',
      title: 'MULTI GEOMETRY',
      categories: ['drifting'],
      status: 'active',
      _geometries: [
        { type: 'Point', coordinates: [134.6583, 16.9017], buffer_nm: 2.5, label: 'WRECK' },
        { type: 'Polygon', coordinates: [[[140, 35], [141, 35], [141, 34], [140, 35]]], label: 'AREA A' },
        { type: 'Point', coordinates: [140.0, 35.0], buffer_nm: 0, label: 'UNBUFFERED' },
      ],
    });
    expect(w.spatial.geometries).toHaveLength(3);
    expect(w.spatial.circles).toHaveLength(1);
    expect(w.spatial.circles[0].radius_nm).toBe(2.5);
    expect(w.spatial.circles[0].center).toEqual([134.6583, 16.9017]);
  });

  it('uses shared circle validation for direct geojson_blob rows', () => {
    const valid: any = mapSupabaseRowToNavWarning({
      canonical_id: 'NAVAREA XI 0453/26',
      navarea: 'NAVAREA XI',
      title: 'BUFFERED POINT',
      geojson_blob: { type: 'Point', coordinates: [140, 35] },
      feature_type: 'POINT',
      buffer_nm: 2.5,
    });
    expect(valid.spatial.circles).toEqual([
      { center: [140, 35], radius_nm: 2.5, label: 'BUFFERED POINT' },
    ]);

    const contradictory: any = mapSupabaseRowToNavWarning({
      canonical_id: 'NAVAREA XI 0454/26',
      navarea: 'NAVAREA XI',
      title: 'POLYGON',
      geojson_blob: { type: 'Polygon', coordinates: [[[140, 35], [141, 35], [141, 34], [140, 35]]] },
      feature_type: 'POINT',
      buffer_nm: 2.5,
    });
    expect(contradictory.spatial.circles).toEqual([]);
  });

  it('falls back to raw-text coordinate extraction when no geometry exists', () => {
    const w: any = mapSupabaseRowToNavWarning({
      canonical_id: 'NAVAREA I 206/26',
      navarea: 'NAVAREA I',
      title: 'GUNNERY',
      raw_text: 'GUNNERY EXERCISES IN 35-12.0N 140-15.0E',
      categories: ['military'],
      status: 'active',
    });
    expect(w.spatial.geometries).toHaveLength(1);
    expect(w.spatial.geometries[0].type).toBe('Point');
    expect(w.spatial.geometries[0].coordinates[1]).toBeCloseTo(35.2, 4);
    expect(w.spatial.geometries[0].coordinates[0]).toBeCloseTo(140.25, 4);
    // Keep the regex fallback explicitly marked so the map never plots it as persisted geometry.
    expect(w.spatial.validation_status).toBe('parsed_from_text');
  });

  it('derives categories fallback and maps cancelled status', () => {
    const w: any = mapSupabaseRowToNavWarning({
      canonical_id: 'NAVAREA IV 1042/26',
      navarea: 'NAVAREA IV',
      title: 'CANCELLED EXERCISE',
      raw_text: 'EXERCISE COMPLETE.',
      status: 'cancelled',
      updated_at: '2026-10-19T00:00:00Z',
    });
    expect(w.categories).toEqual(['general']);
    expect(w.status).toBe('cancelled');
    expect(w.cancelled_at).toBe('2026-10-19T00:00:00Z');
  });
});

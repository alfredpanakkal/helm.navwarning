// src/services/__tests__/schemaV2.test.ts
// Contract tests for the 20261019/20 Supabase schema migration.
// Fixture rows mirror what the backend actually writes (docs/supabase-backend-contract.md).

import { describe, it, expect } from 'vitest';
import { mapSupabaseRowToNavWarning, normalizeNavarea } from '../api';
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

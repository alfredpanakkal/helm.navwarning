import { describe, expect, it } from 'vitest';
import { assessRouteWarnings, type WarningAssessmentWarningInput } from './assessment';
import type { VoyageRoute } from './types';

const route = (from: [number, number], to: [number, number], warningRangeNm = 10): VoyageRoute => ({
  id: 'route-1',
  name: 'Test route',
  waypoints: [
    { id: 'wp-1', name: 'Origin', position: { lat: from[1], lon: from[0] } },
    { id: 'wp-2', name: 'Destination', position: { lat: to[1], lon: to[0] } },
  ],
  defaultSpeedKn: 10,
  warningRangeNm,
  createdAt: '2026-11-18T00:00:00Z',
  updatedAt: '2026-11-18T00:00:00Z',
});

type GeometryFixture = {
  feature_type: string;
  buffer_nm?: number;
  corridor_half_width_nm?: number | null;
  zone_label?: string;
  geojson_blob: unknown;
};

const warning = (
  geometry: GeometryFixture,
  overrides: Partial<WarningAssessmentWarningInput> = {},
): WarningAssessmentWarningInput => ({
  canonical_id: 'NAVAREA VIII 0001/26',
  navarea: 'NAVAREA VIII',
  title: 'Test warning',
  severity: 'high',
  status: 'active',
  triage_tier: 'A',
  data_quality: 'EXPLICIT',
  is_verified: true,
  qa_flags: [],
  geometries: [{
    feature_type: geometry.feature_type,
    buffer_nm: geometry.buffer_nm ?? 0,
    corridor_half_width_nm: geometry.corridor_half_width_nm ?? null,
    zone_label: geometry.zone_label ?? 'Zone A',
    geojson_blob: geometry.geojson_blob,
  }],
  ...overrides,
});

describe('Voyage Planner warning geometry assessment', () => {
  it('detects a point buffer intersecting a rhumb route', () => {
    const result = assessRouteWarnings(route([0, 0], [10, 0]), [
      warning({ feature_type: 'POINT', buffer_nm: 1, geojson_blob: { type: 'Point', coordinates: [5, 0] } }),
    ]);
    expect(result.intersectsCount).toBe(1);
    expect(result.results[0].status).toBe('INTERSECTS');
    expect(result.results[0].nearestDistanceNm).toBe(0);
  });

  it('reports a point outside its buffer but inside the route search range', () => {
    const result = assessRouteWarnings(route([0, 0], [10, 0], 10), [
      warning({ feature_type: 'POINT', buffer_nm: 1, geojson_blob: { type: 'Point', coordinates: [5, 0.15] } }),
    ]);
    expect(result.withinRangeCount).toBe(1);
    expect(result.results[0].status).toBe('WITHIN_RANGE');
    expect(result.results[0].nearestDistanceNm).toBeGreaterThan(7);
    expect(result.results[0].nearestDistanceNm).toBeLessThan(10);
  });

  it('detects route intersections with line geometry', () => {
    const result = assessRouteWarnings(route([0, 0], [10, 0]), [
      warning({ feature_type: 'LINE', geojson_blob: { type: 'LineString', coordinates: [[5, -1], [5, 1]] } }),
    ]);
    expect(result.intersectsCount).toBe(1);
  });

  it('detects route intersections with polygon geometry', () => {
    const result = assessRouteWarnings(route([0, 0], [10, 0]), [
      warning({ feature_type: 'POLYGON', geojson_blob: { type: 'Polygon', coordinates: [[[4, -1], [6, -1], [6, 1], [4, 1], [4, -1]]] } }),
    ]);
    expect(result.intersectsCount).toBe(1);
  });

  it('respects polygon holes instead of treating them as hazard area', () => {
    const result = assessRouteWarnings(route([4.7, 0], [5.3, 0], 1), [
      warning({
        feature_type: 'POLYGON',
        geojson_blob: {
          type: 'Polygon',
          coordinates: [
            [[4, -1], [6, -1], [6, 1], [4, 1], [4, -1]],
            [[4.5, -0.5], [5.5, -0.5], [5.5, 0.5], [4.5, 0.5], [4.5, -0.5]],
          ],
        },
      }),
    ]);
    expect(result.intersectsCount).toBe(0);
    expect(result.withinRangeCount).toBe(0);
  });

  it('handles MultiPolygon parts split across the antimeridian', () => {
    const result = assessRouteWarnings(route([179, 0], [-179, 0]), [
      warning({
        feature_type: 'POLYGON',
        geojson_blob: {
          type: 'MultiPolygon',
          coordinates: [
            [[[179.5, -1], [180, -1], [180, 1], [179.5, 1], [179.5, -1]]],
            [[[-180, -1], [-179.5, -1], [-179.5, 1], [-180, 1], [-180, -1]]],
          ],
        },
      }),
    ]);
    expect(result.intersectsCount).toBe(1);
  });

  it.each([89.9, 89.99, 89.999])('handles a high-latitude rhumb route at %s degrees', (latitude) => {
    const result = assessRouteWarnings(route([0, latitude], [10, latitude]), [
      warning({ feature_type: 'POINT', geojson_blob: { type: 'Point', coordinates: [5, latitude] } }),
    ]);
    expect(result.intersectsCount).toBe(1);
  });

  it('detects a narrow polygon between route sampling points', () => {
    const result = assessRouteWarnings(route([0, 0], [10, 0]), [
      warning({
        feature_type: 'POLYGON',
        geojson_blob: {
          type: 'Polygon',
          coordinates: [[[5.001, -0.0001], [5.002, -0.0001], [5.002, 0.0001], [5.001, 0.0001], [5.001, -0.0001]]],
        },
      }),
    ]);
    expect(result.intersectsCount).toBe(1);
    expect(result.results[0].nearestDistanceNm).toBe(0);
  });

  it('flags additional unsupported geometry even when another zone intersects', () => {
    const item = warning({
      feature_type: 'POINT',
      geojson_blob: { type: 'Point', coordinates: [5, 0] },
    });
    item.geometries.push({
      feature_type: 'UNSUPPORTED',
      buffer_nm: 0,
      corridor_half_width_nm: null,
      zone_label: 'Unassessed zone',
      geojson_blob: { type: 'Point', coordinates: [5, 0] },
    });
    const result = assessRouteWarnings(route([0, 0], [10, 0]), [item]);
    expect(result.intersectsCount).toBe(1);
    expect(result.assessedWarnings).toBe(0);
    expect(result.results[0].status).toBe('INTERSECTS');
    expect(result.results[0].hasUnassessedGeometry).toBe(true);
  });

  it('keeps POINT/LineString metadata mismatches not assessed', () => {
    const result = assessRouteWarnings(route([0, 0], [10, 0]), [
      warning({ feature_type: 'POINT', geojson_blob: { type: 'LineString', coordinates: [[5, -1], [5, 1]] } }),
    ]);
    expect(result.notAssessedCount).toBe(1);
    expect(result.results[0].status).toBe('NOT_ASSESSED');
  });

  it('keeps warnings with non-verified quality state not assessed', () => {
    const result = assessRouteWarnings(route([0, 0], [10, 0]), [
      warning({ feature_type: 'POINT', geojson_blob: { type: 'Point', coordinates: [5, 0] } }, {
        is_verified: false,
        qa_flags: ['COORD_COUNT_MISMATCH'],
      }),
    ]);
    expect(result.notAssessedCount).toBe(1);
    expect(result.results[0].qaFlags).toContain('COORD_COUNT_MISMATCH');
  });

  it('groups multiple geometry zones under one warning and reports the nearest zone', () => {
    const item = warning({ feature_type: 'POINT', zone_label: 'Zone A', geojson_blob: { type: 'Point', coordinates: [5, 0.15] } });
    item.geometries.push({
      feature_type: 'POINT',
      buffer_nm: 0,
      corridor_half_width_nm: null,
      zone_label: 'Zone B',
      geojson_blob: { type: 'Point', coordinates: [5, 0.05] },
    });
    const result = assessRouteWarnings(route([0, 0], [10, 0]), [item]);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].nearestZone).toBe('Zone B');
  });

  it('does not evaluate warning validity dates against voyage time', () => {
    const result = assessRouteWarnings(route([0, 0], [10, 0]), [
      warning({ feature_type: 'POINT', geojson_blob: { type: 'Point', coordinates: [5, 0] } }, {
        valid_to: '2020-01-01T00:00:00Z',
      }),
    ]);
    expect(result.intersectsCount).toBe(1);
    expect(result.results[0].validTo).toBe('2020-01-01T00:00:00Z');
  });

  it('returns not-ready when the route has fewer than two waypoints', () => {
    const value = route([0, 0], [0, 0]);
    value.waypoints = [value.waypoints[0]];
    const result = assessRouteWarnings(value, []);
    expect(result.ready).toBe(false);
    expect(result.reason).toContain('two waypoints');
  });
});

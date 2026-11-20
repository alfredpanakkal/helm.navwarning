import { describe, expect, it } from 'vitest';
import { parseRouteImport } from './import';

describe('route import', () => {
  it('imports the ordered waypoint features from Helm.Warning GeoJSON', () => {
    const result = parseRouteImport(JSON.stringify({
      type: 'FeatureCollection',
      name: 'Indian Ocean route',
      features: [
        { type: 'Feature', properties: { featureType: 'route' }, geometry: { type: 'LineString', coordinates: [[1, 1], [2, 2]] } },
        { type: 'Feature', properties: { featureType: 'waypoint', sequence: 2, name: 'Destination' }, geometry: { type: 'Point', coordinates: [2, 2] } },
        { type: 'Feature', properties: { featureType: 'waypoint', sequence: 1, name: 'Origin' }, geometry: { type: 'Point', coordinates: [1, 1] } },
      ],
    }), 'voyage.geojson');
    expect(result).toEqual({
      ok: true,
      name: 'Indian Ocean route',
      waypoints: [
        { name: 'Origin', position: { lat: 1, lon: 1 } },
        { name: 'Destination', position: { lat: 2, lon: 2 } },
      ],
    });
  });

  it('ignores unrelated point features when waypoint feature metadata is present', () => {
    const result = parseRouteImport(JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { featureType: 'marker', name: 'Unrelated marker' }, geometry: { type: 'Point', coordinates: [30, 30] } },
        { type: 'Feature', properties: { featureType: 'waypoint', sequence: 1, name: 'A' }, geometry: { type: 'Point', coordinates: [1, 1] } },
        { type: 'Feature', properties: { featureType: 'waypoint', sequence: 2, name: 'B' }, geometry: { type: 'Point', coordinates: [2, 2] } },
      ],
    }), 'route.geojson');
    expect(result.ok && result.waypoints.map((item) => item.name)).toEqual(['A', 'B']);
  });

  it('imports waypoints from a GeoJSON LineString when point features are absent', () => {
    const result = parseRouteImport(JSON.stringify({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[10, 20], [11, 21]] },
      properties: {},
    }), 'line.json');
    expect(result.ok && result.waypoints.map((item) => item.position)).toEqual([
      { lat: 20, lon: 10 }, { lat: 21, lon: 11 },
    ]);
  });

  it('rejects malformed or insufficient GeoJSON routes', () => {
    expect(parseRouteImport('{broken', 'route.geojson').ok).toBe(false);
    expect(parseRouteImport(JSON.stringify({
      type: 'Feature', geometry: { type: 'Point', coordinates: [200, 91] }, properties: {},
    }), 'route.json')).toEqual({
      ok: false, error: '1 route point(s) have invalid coordinates. Nothing was imported.',
    });
  });


  it('rejects a GeoJSON waypoint collection when a latitude is out of range', () => {
    const result = parseRouteImport(JSON.stringify({
      type: 'FeatureCollection',
      features: [1, 2, 3].map((sequence) => ({
        type: 'Feature',
        properties: { featureType: 'waypoint', sequence, name: 'WP ' + sequence },
        geometry: { type: 'Point', coordinates: sequence === 2 ? [70, 91] : [69 + sequence, 8 + sequence] },
      })),
    }), 'invalid-latitude.geojson');
    expect(result.ok).toBe(false);
    if ('error' in result) expect(result.error).toContain('invalid coordinates');
  });

  it('rejects a GeoJSON waypoint collection when a longitude is out of range', () => {
    const result = parseRouteImport(JSON.stringify({
      type: 'FeatureCollection',
      features: [1, 2, 3].map((sequence) => ({
        type: 'Feature',
        properties: { featureType: 'waypoint', sequence, name: 'WP ' + sequence },
        geometry: { type: 'Point', coordinates: sequence === 2 ? [181, 8] : [69 + sequence, 8 + sequence] },
      })),
    }), 'invalid-longitude.geojson');
    expect(result.ok).toBe(false);
    if ('error' in result) expect(result.error).toContain('invalid coordinates');
  });

  it('rejects invalid coordinates in a route LineString when waypoints are also present', () => {
    const result = parseRouteImport(JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { featureType: 'route' }, geometry: { type: 'LineString', coordinates: [[1, 1], [181, 2]] } },
        { type: 'Feature', properties: { featureType: 'waypoint', sequence: 1 }, geometry: { type: 'Point', coordinates: [1, 1] } },
        { type: 'Feature', properties: { featureType: 'waypoint', sequence: 2 }, geometry: { type: 'Point', coordinates: [2, 2] } },
      ],
    }), 'invalid-route-line.geojson');
    expect(result).toEqual({
      ok: false, error: '1 route point(s) have invalid coordinates. Nothing was imported.',
    });
  });

  it('rejects invalid coordinates in a route MultiLineString', () => {
    const result = parseRouteImport(JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { featureType: 'route' }, geometry: { type: 'MultiLineString', coordinates: [[[1, 1], [2, 2]], [[3, 3], [4, 91]]] } },
        { type: 'Feature', properties: { featureType: 'waypoint', sequence: 1 }, geometry: { type: 'Point', coordinates: [1, 1] } },
        { type: 'Feature', properties: { featureType: 'waypoint', sequence: 2 }, geometry: { type: 'Point', coordinates: [2, 2] } },
      ],
    }), 'invalid-route-multiline.geojson');
    expect(result).toEqual({
      ok: false, error: '1 route point(s) have invalid coordinates. Nothing was imported.',
    });
  });

  it('continues to import a valid two-point GeoJSON route unchanged', () => {
    const result = parseRouteImport(JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { featureType: 'waypoint', sequence: 1, name: 'Start' }, geometry: { type: 'Point', coordinates: [70, 8] } },
        { type: 'Feature', properties: { featureType: 'waypoint', sequence: 2, name: 'Finish' }, geometry: { type: 'Point', coordinates: [71, 9] } },
      ],
    }), 'valid.geojson');
    expect(result).toEqual({
      ok: true,
      name: 'valid',
      waypoints: [
        { name: 'Start', position: { lat: 8, lon: 70 } },
        { name: 'Finish', position: { lat: 9, lon: 71 } },
      ],
    });
  });

  it('rejects unsupported extensions', () => {
    expect(parseRouteImport('', 'route.csv')).toEqual({
      ok: false, error: 'Choose a GPX, GeoJSON or JSON route file.',
    });
  });
});

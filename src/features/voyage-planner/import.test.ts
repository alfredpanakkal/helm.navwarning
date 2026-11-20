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
      ok: false, error: 'The file must contain at least two valid route points.',
    });
  });

  it('rejects unsupported extensions', () => {
    expect(parseRouteImport('', 'route.csv')).toEqual({
      ok: false, error: 'Choose a GPX, GeoJSON or JSON route file.',
    });
  });
});

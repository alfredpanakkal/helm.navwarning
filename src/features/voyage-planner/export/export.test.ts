import { describe, expect, it } from 'vitest';
import { exportRouteCsv } from './csv';
import { exportRouteGeoJson } from './geojson';
import { exportRouteGpx } from './gpx';
import type { VoyageRoute } from '../types';

const route: VoyageRoute = {
  id: 'route_1',
  name: 'Indian Ocean & <Passage>',
  waypoints: [
    { id: 'wp_1', name: 'Start', position: { lat: 10, lon: 75 } },
    { id: 'wp_2', name: 'Arrival', position: { lat: 11, lon: 76 }, speedKn: 12 },
  ],
  defaultSpeedKn: 10,
  warningRangeNm: 25,
  departureTimeUtc: '2026-11-18T00:00:00Z',
  createdAt: '2026-11-18T00:00:00Z',
  updatedAt: '2026-11-18T00:00:00Z',
};

describe('Voyage Planner exports', () => {
  it('exports a GeoJSON FeatureCollection with route and ordered waypoint features', () => {
    const result = JSON.parse(exportRouteGeoJson(route));
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(3);
    expect(result.features[0].geometry).toEqual({
      type: 'LineString',
      coordinates: [[75, 10], [76, 11]],
    });
    expect(result.features[2].properties.sequence).toBe(2);
    expect(result.features[2].properties.speedKn).toBe(12);
  });

  it('exports GPX 1.1 with escaped XML text and coordinates', () => {
    const result = exportRouteGpx(route);
    expect(result).toContain('<gpx version="1.1"');
    expect(result).toContain('<name>Indian Ocean &amp; &lt;Passage&gt;</name>');
    expect(result).toContain('<rtept lat="11" lon="76">');
    expect(result).toContain('<time>2026-11-18T00:00:00Z</time>');
    expect(result).not.toContain('Indian Ocean & <Passage>');
  });

  it('prefixes formula-like CSV cells and quotes delimiters safely', () => {
    const dangerous = {
      ...route,
      waypoints: [
        { ...route.waypoints[0], name: '=HYPERLINK("https://example.com","open")' },
        { ...route.waypoints[1], name: '+SUM(1,2)' },
      ],
    };
    const result = exportRouteCsv(dangerous);
    expect(result).toContain('"\'=HYPERLINK(""https://example.com"",""open"")"');
    expect(result).toContain('"\'+SUM(1,2)"');
    expect(result).toContain('"\'10"'); // Negative and formula-like prefixes are kept as text.
    expect(result).toContain('\\r\\n');
  });

  it('exports an empty header-only CSV for a route without waypoints', () => {
    const result = exportRouteCsv({ ...route, waypoints: [] });
    expect(result.split('\\r\\n')).toHaveLength(2);
  });

  it('rejects invalid routes instead of exporting malformed data', () => {
    expect(() => exportRouteGeoJson({ ...route, waypoints: [{ ...route.waypoints[0], position: { lat: 91, lon: 0 } }] })).toThrow(TypeError);
    expect(() => exportRouteGpx({ ...route, defaultSpeedKn: 99 })).toThrow(TypeError);
    expect(() => exportRouteCsv({ ...route, id: 'bad id' })).toThrow(TypeError);
  });
});

import { describe, expect, it } from 'vitest';
import { geojsonToEwkt } from '../geojsonToEwkt';

describe('geojsonToEwkt', () => {
  it.each([
    [{ type: 'Point', coordinates: [10, 20] }, 'POINT', 'POINT(10 20)'],
    [{ type: 'MultiPoint', coordinates: [[10, 20], [11, 21]] }, 'POINT', 'MULTIPOINT((10 20), (11 21))'],
    [{ type: 'LineString', coordinates: [[10, 20], [11, 21]] }, 'LINE', 'LINESTRING(10 20, 11 21)'],
    [{ type: 'MultiLineString', coordinates: [[[10, 20], [11, 21]], [[12, 22], [13, 23]]] }, 'LINE', 'MULTILINESTRING((10 20, 11 21), (12 22, 13 23))'],
    [{ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, 'POLYGON', 'POLYGON((0 0, 1 0, 1 1, 0 0))'],
    [{ type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]], [[[2, 2], [3, 2], [3, 3], [2, 2]]]] }, 'POLYGON', 'MULTIPOLYGON(((0 0, 1 0, 1 1, 0 0)), ((2 2, 3 2, 3 3, 2 2)))'],
  ])('preserves %s geometry structure', (geometry, featureType, wkt) => {
    expect(geojsonToEwkt(geometry)).toEqual({
      ewkt: `SRID=4326;${wkt}`,
      featureType,
    });
  });

  it('preserves polygon interior rings', () => {
    const result = geojsonToEwkt({
      type: 'Polygon',
      coordinates: [
        [[0, 0], [4, 0], [4, 4], [0, 0]],
        [[1, 1], [2, 1], [2, 2], [1, 1]],
      ],
    });
    expect(result?.ewkt).toContain('), (1 1, 2 1, 2 2, 1 1))');
  });

  it.each([
    null,
    { type: 'GeometryCollection', geometries: [] },
    { type: 'Point', coordinates: [181, 20] },
    { type: 'Point', coordinates: [10, 91] },
    { type: 'Point', coordinates: [10, 20, 5] },
    { type: 'Point', coordinates: ['10', 20] },
    { type: 'LineString', coordinates: [[10, 20]] },
    { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] },
    { type: 'MultiLineString', coordinates: [[[0, 0], [1, 1]], []] },
  ])('rejects malformed or unsupported geometry %s', (geometry) => {
    expect(geojsonToEwkt(geometry)).toBeNull();
  });
});

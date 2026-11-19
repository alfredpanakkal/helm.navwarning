import { describe, expect, it } from 'vitest';
import { findInteriorPoint, getProjectedPolygonMetrics } from './small-area-geometry.js';

const identity = ([x, y]) => ({ x, y });
const square = [[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]];

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = (yi > point.y) !== (yj > point.y) &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

describe('small-area geometry helpers', () => {
  it('detects small polygons from projected area, not only their bounds', () => {
    const thin = [[0, 0], [100, 0], [100, 1], [0, 1], [0, 0]];
    const metrics = getProjectedPolygonMetrics([thin], identity);
    expect(metrics?.boundsArea).toBe(100);
    expect(metrics?.area).toBe(100);
    expect(metrics?.isTooSmall).toBe(true);
  });

  it('does not flag a readable rectangle at low zoom', () => {
    const rectangle = [[0, 0], [40, 0], [40, 30], [0, 30], [0, 0]];
    expect(getProjectedPolygonMetrics([rectangle], identity)?.isTooSmall).toBe(false);
  });

  it('finds an interior point for a concave polygon', () => {
    const concave = [[0, 0], [10, 0], [10, 2], [2, 2], [2, 10], [0, 10], [0, 0]];
    const point = findInteriorPoint([concave], identity);
    expect(point).not.toBeNull();
    expect(pointInRing(point, concave)).toBe(true);
  });

  it('does not place an indicator inside a polygon hole', () => {
    const exterior = square;
    const hole = [[8, 8], [12, 8], [12, 12], [8, 12], [8, 8]];
    const point = findInteriorPoint([exterior, hole], identity);
    expect(point).not.toBeNull();
    expect(pointInRing(point, exterior)).toBe(true);
    expect(pointInRing(point, hole)).toBe(false);
  });

  it('supports each MultiPolygon component independently', () => {
    const first = findInteriorPoint([square], identity);
    const secondRing = square.map(([x, y]) => [x + 50, y + 50]);
    const second = findInteriorPoint([secondRing], identity);
    expect(pointInRing(first, square)).toBe(true);
    expect(pointInRing(second, secondRing)).toBe(true);
  });

  it('chooses a different interior candidate when collision space permits', () => {
    const first = findInteriorPoint([square], identity);
    const second = findInteriorPoint([square], identity, [first]);
    expect(second).not.toBeNull();
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeGreaterThan(0);
    expect(pointInRing(second, square)).toBe(true);
  });

  it('treats normalized rectangle rings as ordinary polygon geometry', () => {
    const rectangle = [[-10, -5], [10, -5], [10, 5], [-10, 5], [-10, -5]];
    const point = findInteriorPoint([rectangle], identity);
    expect(pointInRing(point, rectangle)).toBe(true);
    expect(getProjectedPolygonMetrics([rectangle], identity)?.isTooSmall).toBe(false);
  });
});

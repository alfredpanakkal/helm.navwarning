// src/core/__tests__/coordinatesSector.test.ts
import { describe, it, expect } from 'vitest';
import {
  computeSectorPolygon,
  parseSectorDirective,
  computeLineCorridor,
  computeDistanceNm,
} from '../coordinates';

describe('coordinates — Sector & Corridor Geometry', () => {
  it('computes geodesic sector polygon for clockwise sweep without crossing north', () => {
    const center: [number, number] = [20.0, 60.0];
    const radiusNm = 10;
    const poly = computeSectorPolygon(center, radiusNm, 45, 135, 10);

    expect(poly.length).toBeGreaterThan(3);
    // Closed pie wedge: first and last coordinates match center
    expect(poly[0]).toEqual(center);
    expect(poly[poly.length - 1]).toEqual(center);

    // Intermediate arc points should all be ~10 NM from center
    for (let i = 1; i < poly.length - 1; i++) {
      const dist = computeDistanceNm(center, poly[i]);
      expect(Math.abs(dist - radiusNm)).toBeLessThan(0.1);
    }
  });

  it('computes geodesic sector polygon crossing 0°/360° north boundary seamlessly', () => {
    const center: [number, number] = [25.0, 70.0];
    const radiusNm = 5;
    // Sweep from 315° NW through 0° N to 45° NE (90 degree sweep)
    const poly = computeSectorPolygon(center, radiusNm, 315, 45, 10);

    expect(poly.length).toBeGreaterThan(3);
    expect(poly[0]).toEqual(center);
    expect(poly[poly.length - 1]).toEqual(center);

    for (let i = 1; i < poly.length - 1; i++) {
      const dist = computeDistanceNm(center, poly[i]);
      expect(Math.abs(dist - radiusNm)).toBeLessThan(0.1);
    }
  });

  it('parses directional sector clauses from raw warning text', () => {
    const text1 = 'NAVAL EXERCISE IN SECTOR BETWEEN BEARINGS 045 AND 135 OUT TO 10 NM.';
    const parsed1 = parseSectorDirective(text1);
    expect(parsed1).not.toBeNull();
    expect(parsed1?.startBearing).toBe(45);
    expect(parsed1?.endBearing).toBe(135);
    expect(parsed1?.radiusNm).toBe(10);

    const text2 = 'FIRING IN SECTOR BOUNDED BY 270 DEG AND 360 DEG, RADIUS 5 NM.';
    const parsed2 = parseSectorDirective(text2);
    expect(parsed2).not.toBeNull();
    expect(parsed2?.startBearing).toBe(270);
    expect(parsed2?.endBearing).toBe(0); // 360 normalized to 0
    expect(parsed2?.radiusNm).toBe(5);

    const noSectorText = 'SUBMARINE CABLE OPERATIONS IN PROGRESS.';
    expect(parseSectorDirective(noSectorText)).toBeNull();
  });

  it('computes asymmetric corridor polygons with port and starboard offsets', () => {
    const line: [number, number][] = [
      [10.0, 20.0],
      [10.5, 20.5],
    ];
    const corridor = computeLineCorridor(line, 6.0, 2.0, 4.0);
    expect(corridor.centerLine).toEqual(line);
    expect(corridor.widthNm).toBe(6.0);
    expect(corridor.boundaryPolygon.length).toBeGreaterThan(3);
  });
});

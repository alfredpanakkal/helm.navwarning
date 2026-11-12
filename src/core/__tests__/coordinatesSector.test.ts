// src/core/__tests__/coordinatesSector.test.ts
import { describe, it, expect } from 'vitest';
import {
  computeSectorPolygon,
  parseSectorDirective,
  computeLineCorridor,
  computeDistanceNm,
  computeDestinationPoint,
  formatWgs84Dms,
  parseDriftVector,
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

describe('Task 1 Regression: formatWgs84Dms coordinate formatting', () => {
  it('formats latitude and longitude with distinctly calculated minute values', () => {
    // 58 deg + 12.34 min = 58 + 12.34/60 = 58.2056667
    // 11 deg + 45.67 min = 11 + 45.67/60 = 11.7611667
    const lat = 58 + 12.34 / 60;
    const lng = 11 + 45.67 / 60;
    const formatted = formatWgs84Dms(lat, lng);

    expect(formatted).toBe("58° 12.34' N 011° 45.67' E");
    // Ensure longitude does NOT repeat latitude's minute value
    expect(formatted).not.toContain("011° 12.34' E");
  });

  it('handles negative southern and western coordinates correctly', () => {
    const lat = -(34 + 50.0 / 60);
    const lng = -(56 + 10.0 / 60);
    const formatted = formatWgs84Dms(lat, lng);

    expect(formatted).toBe("34° 50.00' S 056° 10.00' W");
  });

  it('returns N/A safely for non-finite or invalid coordinate values', () => {
    expect(formatWgs84Dms(NaN, 10)).toBe('N/A');
    expect(formatWgs84Dms(10, NaN)).toBe('N/A');
    expect(formatWgs84Dms(Infinity, 10)).toBe('N/A');
    expect(formatWgs84Dms(null as any, 10)).toBe('N/A');
  });
});

describe('Task 2: parseDriftVector estimation and projection clarity', () => {
  it('identifies 6-hour projection when speed is known and tags it as estimated', () => {
    const text = 'DRIFTING VESSEL IN 15-00N 060-00E, DRIFTING EAST AT 2.0 KNOTS.';
    const vector = parseDriftVector([15.0, 60.0], text);

    expect(vector).not.toBeNull();
    expect(vector?.speedKts).toBe(2.0);
    expect(vector?.distanceNm).toBe(12.0); // 2 kts * 6 hours
    expect(vector?.projectionHours).toBe(6);
    expect(vector?.isEstimated).toBe(true);
    expect(vector?.isFallback).toBe(false);
  });

  it('identifies fallback distance when speed is unknown and flags isFallback', () => {
    const text = 'CONTAINER ADRIFT IN 20-00N 070-00W DRIFTING NORTH-EAST.';
    const vector = parseDriftVector([20.0, -70.0], text);

    expect(vector).not.toBeNull();
    expect(vector?.speedKts).toBeUndefined();
    expect(vector?.distanceNm).toBe(5.0); // 5 NM fallback
    expect(vector?.projectionHours).toBeUndefined();
    expect(vector?.isEstimated).toBe(true);
    expect(vector?.isFallback).toBe(true);
  });
});

describe('Task 3: Geometry Edge Cases', () => {
  describe('Invalid and non-finite inputs', () => {
    it('returns empty array when computeSectorPolygon receives non-finite coordinates or radius', () => {
      expect(computeSectorPolygon([NaN, 60], 10, 0, 90)).toEqual([]);
      expect(computeSectorPolygon([20, Infinity], 10, 0, 90)).toEqual([]);
      expect(computeSectorPolygon([20, 60], NaN, 0, 90)).toEqual([]);
      expect(computeSectorPolygon([20, 60], Infinity, 0, 90)).toEqual([]);
      expect(computeSectorPolygon([20, 60], 10, NaN, 90)).toEqual([]);
    });

    it('returns empty array for invalid or non-positive radius values', () => {
      expect(computeSectorPolygon([20, 60], 0, 0, 90)).toEqual([]);
      expect(computeSectorPolygon([20, 60], -10, 0, 90)).toEqual([]);
    });

    it('handles non-finite points safely in computeDestinationPoint', () => {
      expect(computeDestinationPoint([NaN, 0], 90, 10)).toEqual([0, 0]);
      expect(computeDestinationPoint([0, 0], NaN, 10)).toEqual([0, 0]);
      expect(computeDestinationPoint([0, 0], 90, Infinity)).toEqual([0, 0]);
    });

    it('filters non-finite points in computeLineCorridor without crashing', () => {
      const pointsWithNan: [number, number][] = [
        [10.0, 20.0],
        [NaN, 25.0],
        [12.0, 22.0],
      ];
      const corridor = computeLineCorridor(pointsWithNan, 4.0);
      expect(corridor.centerLine.length).toBe(2);
      expect(corridor.boundaryPolygon.length).toBeGreaterThan(2);
      corridor.boundaryPolygon.forEach(([lat, lng]) => {
        expect(Number.isFinite(lat)).toBe(true);
        expect(Number.isFinite(lng)).toBe(true);
      });
    });
  });

  describe('Equal start/end sector bearings', () => {
    it('produces a full 360-degree circle when start and end bearings are equal', () => {
      const center: [number, number] = [10.0, 50.0];
      const radiusNm = 8;
      // Start = 90, End = 90 -> 360 deg sweep
      const poly = computeSectorPolygon(center, radiusNm, 90, 90, 10);

      expect(poly.length).toBeGreaterThan(10);
      // All points should lie at radius distance
      poly.forEach((pt) => {
        const d = computeDistanceNm(center, pt);
        expect(Math.abs(d - radiusNm)).toBeLessThan(0.1);
      });
    });
  });

  describe('High-latitude geometry', () => {
    it('computes destination and sector safely near North Pole without NaN', () => {
      const arcticCenter: [number, number] = [85.0, 10.0];
      const radiusNm = 50.0;
      const poly = computeSectorPolygon(arcticCenter, radiusNm, 0, 180, 10);

      expect(poly.length).toBeGreaterThan(3);
      poly.forEach(([lat, lng]) => {
        expect(Number.isFinite(lat)).toBe(true);
        expect(Number.isFinite(lng)).toBe(true);
        expect(lat).toBeLessThanOrEqual(90);
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lng).toBeLessThanOrEqual(180);
        expect(lng).toBeGreaterThanOrEqual(-180);
      });
    });

    it('handles destination point calculation exactly at 90 deg latitude', () => {
      const dest = computeDestinationPoint([90.0, 0.0], 180, 60); // 60 NM south of North Pole
      expect(Number.isFinite(dest[0])).toBe(true);
      expect(Number.isFinite(dest[1])).toBe(true);
      expect(dest[0]).toBeCloseTo(89.0, 1);
    });
  });

  describe('Sharp corridor turns and repeated points', () => {
    it('computes corridor around 180-degree hairpin turn without crashing or NaN', () => {
      const hairpin: [number, number][] = [
        [10.0, 20.0],
        [10.5, 20.0],
        [10.0, 20.0],
      ];
      const corridor = computeLineCorridor(hairpin, 4.0);
      expect(corridor.boundaryPolygon.length).toBeGreaterThan(3);
      corridor.boundaryPolygon.forEach(([lat, lng]) => {
        expect(Number.isFinite(lat)).toBe(true);
        expect(Number.isFinite(lng)).toBe(true);
      });
    });

    it('handles repeated adjacent identical coordinates safely', () => {
      const repeated: [number, number][] = [
        [10.0, 20.0],
        [10.0, 20.0],
        [10.5, 20.5],
      ];
      const corridor = computeLineCorridor(repeated, 4.0);
      expect(corridor.boundaryPolygon.length).toBeGreaterThan(3);
      corridor.boundaryPolygon.forEach(([lat, lng]) => {
        expect(Number.isFinite(lat)).toBe(true);
        expect(Number.isFinite(lng)).toBe(true);
      });
    });
  });

  describe('Dateline-crossing geometries (180° meridian)', () => {
    it('computes destination point across 180° antimeridian normalized into [-180, 180]', () => {
      // Start at 179.9° E, travel 60 NM East (bearing 90°)
      const dest = computeDestinationPoint([0.0, 179.9], 90, 60);
      expect(Number.isFinite(dest[0])).toBe(true);
      expect(Number.isFinite(dest[1])).toBe(true);
      // Destination must wrap into negative longitudes (-179° W range)
      expect(dest[1]).toBeLessThan(0);
      expect(dest[1]).toBeGreaterThanOrEqual(-180);
    });

    it('computes sector crossing the 180° antimeridian safely', () => {
      const center: [number, number] = [0.0, 179.5];
      const radiusNm = 60.0;
      const poly = computeSectorPolygon(center, radiusNm, 45, 135, 10);

      expect(poly.length).toBeGreaterThan(3);
      poly.forEach(([lat, lng]) => {
        expect(Number.isFinite(lat)).toBe(true);
        expect(Number.isFinite(lng)).toBe(true);
        expect(lng).toBeGreaterThanOrEqual(-180);
        expect(lng).toBeLessThanOrEqual(180);
      });
    });
  });
});

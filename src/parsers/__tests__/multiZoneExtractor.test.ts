// src/parsers/__tests__/multiZoneExtractor.test.ts
import { describe, it, expect } from 'vitest';
import { extractGeometry, extractLabeledZoneGroups } from '../geometryExtractor';

describe('geometryExtractor — Multi-Zone Labeled Splitting', () => {
  it('correctly splits multi-zone bulletins with AREA A and AREA B into distinct polygon groups', () => {
    const multiZoneText = `
NAVAREA IV 1042/26
GUNNERY EXERCISES.
AREA A: BOUNDED BY 25-00N 075-00W, 25-30N 075-00W, 25-30N 074-30W, 25-00N 074-30W.
AREA B: BOUNDED BY 26-00N 076-00W, 26-45N 076-00W, 26-45N 075-15W, 26-00N 075-15W.
CANCEL AT 151200Z NOV.
    `.trim();

    const res = extractGeometry(multiZoneText);

    expect(res.geometry.archetype).toBe('geometry_group');
    expect(res.geometry.polygons).toBeDefined();
    expect(res.geometry.polygons?.length).toBe(2);
    expect(res.geometry.zoneLabels).toEqual(['AREA A', 'AREA B']);

    // Area A should be a closed ring with 4 unique vertices (5 points total: p1..p4, p1)
    expect(res.geometry.polygons?.[0].length).toBe(5);
    expect(res.geometry.polygons?.[0][0].lat).toBeCloseTo(25.0, 1);
    expect(res.geometry.polygons?.[0][0].lng).toBeCloseTo(-75.0, 1);
    expect(res.geometry.polygons?.[0][4].lat).toBeCloseTo(25.0, 1);

    // Area B should be a closed ring with 4 unique vertices (5 points total: p1..p4, p1)
    expect(res.geometry.polygons?.[1].length).toBe(5);
    expect(res.geometry.polygons?.[1][0].lat).toBeCloseTo(26.0, 1);
    expect(res.geometry.polygons?.[1][0].lng).toBeCloseTo(-76.0, 1);
    expect(res.geometry.polygons?.[1][4].lat).toBeCloseTo(26.0, 1);
  });

  it('correctly handles 3-zone bulletins (AREA A, AREA B, AREA C)', () => {
    const threeZoneText = `
NAVAL EXERCISES IN THREE AREAS:
AREA A BOUNDED BY 10-00N 060-00E, 10-30N 060-00E, 10-30N 060-30E.
AREA B BOUNDED BY 11-00N 061-00E, 11-30N 061-00E, 11-30N 061-30E.
AREA C BOUNDED BY 12-00N 062-00E, 12-30N 062-00E, 12-30N 062-30E.
    `.trim();

    const res = extractGeometry(threeZoneText);

    expect(res.geometry.archetype).toBe('geometry_group');
    expect(res.geometry.polygons?.length).toBe(3);
    expect(res.geometry.zoneLabels).toEqual(['AREA A', 'AREA B', 'AREA C']);
    expect(res.geometry.polygons?.[0].length).toBe(4);
    expect(res.geometry.polygons?.[1].length).toBe(4);
    expect(res.geometry.polygons?.[2].length).toBe(4);
  });
});

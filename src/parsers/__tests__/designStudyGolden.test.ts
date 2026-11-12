/**
 * Golden Dataset & Comprehensive Verification Suite
 * Conforms to COMPETITOR_WARNING_DESIGN_STUDY.md Phase 5
 */
import { describe, it, expect } from 'vitest';
import { toPrimarySymbol, PRIMARY_SYMBOLS, PrimarySymbol } from '../../utils/symbolMapping';
import { HazardCategory } from '../../types';
import {
  computeSectorPolygon,
  parseSectorDirective,
  computeLineCorridor,
  computeDistanceNm,
  computePolygonAreaSqNm,
  parseDriftVector,
} from '../../core/coordinates';
import { extractGeometry, extractMaritimePlots, extractLabeledZoneGroups } from '../geometryExtractor';
import { classifyWarning } from '../warningClassifier';
import {
  getBoundaryDashArray,
  getBoundaryStyleType,
  getZoomScaleCategory,
  shouldShowVertexPills,
  shouldShowVertexDots,
  shouldShowSwathPill,
  shouldHideCenterPoint,
} from '../../utils/boundaryStyles';

describe('Phase 5.1: 6-Symbol System Resolution (All 16 Categories)', () => {
  const categoryExpectations: Record<HazardCategory, PrimarySymbol> = {
    general: 'general',
    hazard: 'general',
    unknown: 'general',
    mil_fire: 'military',
    mil_ops: 'military',
    firing: 'military',
    exercise: 'military',
    drifting_hazard: 'drifting',
    derelict: 'drifting',
    iceberg: 'drifting',
    light_failure: 'aton',
    buoy_off_station: 'aton',
    subsea_cable: 'subsea',
    pipe_op: 'subsea',
    survey: 'subsea',
    wreck: 'wreck',
    obstruction: 'wreck',
  };

  it('correctly maps every one of the 16 HazardCategory values to its primary symbol', () => {
    (Object.keys(categoryExpectations) as HazardCategory[]).forEach((cat) => {
      const expectedSymbol = categoryExpectations[cat];
      const actualSymbol = toPrimarySymbol(cat);
      expect(actualSymbol, `Category '${cat}' should resolve to symbol '${expectedSymbol}'`).toBe(expectedSymbol);
    });
  });

  it('only produces one of the 6 canonical primary symbols', () => {
    (Object.keys(categoryExpectations) as HazardCategory[]).forEach((cat) => {
      const symbol = toPrimarySymbol(cat);
      expect(PRIMARY_SYMBOLS).toContain(symbol);
    });
  });

  it('gracefully falls back to general for unrecognised categories', () => {
    expect(toPrimarySymbol(undefined)).toBe('general');
    expect(toPrimarySymbol('' as any)).toBe('general');
    expect(toPrimarySymbol('alien_spacecraft' as any)).toBe('general');
  });
});

describe('Phase 5.1: Sector Math & North Crossing Verification', () => {
  it('correctly computes a sector spanning across 0/360 deg north', () => {
    const center: [number, number] = [15.0, 65.0];
    const radiusNm = 12.0;
    // 330 deg (NNW) across 0 deg North to 030 deg (NNE) = 60 deg sweep
    const polygon = computeSectorPolygon(center, radiusNm, 330, 30, 16);

    expect(polygon.length).toBeGreaterThanOrEqual(10);
    // Polygon starts and ends at the center coordinate
    expect(polygon[0]).toEqual(center);
    expect(polygon[polygon.length - 1]).toEqual(center);

    // Verify all vertices are valid numbers
    polygon.forEach(([lat, lng]) => {
      expect(Number.isFinite(lat)).toBe(true);
      expect(Number.isFinite(lng)).toBe(true);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lng).toBeGreaterThanOrEqual(-180);
      expect(lng).toBeLessThanOrEqual(180);
    });

    // Sector vertices must lie north of center (lat >= center lat)
    const arcPoints = polygon.slice(1, -1);
    arcPoints.forEach(([lat]) => {
      expect(lat).toBeGreaterThan(center[0]);
    });
  });

  it('extracts sector directive from bulletin text with north crossing', () => {
    const text = 'NAVAREA VIII 120/26. FIRING PRACTICE IN SECTOR 340 TO 020 DEGREES RADIUS 15 NM CENTERED ON 10-00N 075-00E.';
    const sector = parseSectorDirective(text);
    expect(sector).not.toBeNull();
    expect(sector?.startBearing).toBe(340);
    expect(sector?.endBearing).toBe(20);
    expect(sector?.radiusNm).toBe(15);
  });
});

describe('Phase 5.1: Corridor Polygon Closure & Winding Order', () => {
  it('computes a closed corridor polygon around a multi-leg track', () => {
    const track: [number, number][] = [
      [24.0, 58.0],
      [24.5, 58.5],
      [25.0, 59.0],
    ];
    const corridor = computeLineCorridor(track, 4.0); // 4 NM buffer

    expect(corridor.lengthNm).toBeGreaterThan(0);
    expect(corridor.widthNm).toBe(4.0);
    expect(corridor.boundaryPolygon.length).toBeGreaterThanOrEqual(4);

    // Verify closure: first and last vertices are identical
    const firstPt = corridor.boundaryPolygon[0];
    const lastPt = corridor.boundaryPolygon[corridor.boundaryPolygon.length - 1];
    expect(firstPt[0]).toBeCloseTo(lastPt[0], 4);
    expect(firstPt[1]).toBeCloseTo(lastPt[1], 4);

    // Verify area is positive
    const areaSqNm = computePolygonAreaSqNm(corridor.boundaryPolygon);
    expect(areaSqNm).toBeGreaterThan(0);
  });
});

describe('Phase 5.2: Multi-Zone Labeled Warnings End-to-End', () => {
  it('extracts and preserves distinct labeled zones from multi-zone bulletins', () => {
    const raw = `NAVAREA IX 101/26.
    ARABIAN SEA.
    1. HAZARDOUS OPERATIONS CONDUCTED IN:
    AREA A: BOUNDED BY 22-00N 060-00E, 22-00N 062-00E, 23-00N 062-00E, 23-00N 060-00E.
    AREA B: BOUNDED BY 20-00N 065-00E, 20-00N 067-00E, 21-00N 067-00E, 21-00N 065-00E.
    2. CANCEL THIS MSG 251800 UTC NOV 26.`;

    const groups = extractLabeledZoneGroups(raw);
    expect(groups.length).toBe(2);
    expect(groups[0].label).toBe('AREA A');
    expect(groups[1].label).toBe('AREA B');
    expect(groups[0].coordinates.length).toBe(4);
    expect(groups[1].coordinates.length).toBe(4);

    const parsed = extractGeometry(raw);
    expect(parsed.geometry.zoneLabels).toBeDefined();
    expect(parsed.geometry.zoneLabels).toContain('AREA A');
    expect(parsed.geometry.zoneLabels).toContain('AREA B');
    expect(parsed.geometry.polygons?.length).toBe(2);

    const plots = extractMaritimePlots(raw);
    const polyPlots = plots.filter((p) => p.plotType === 'polygon');
    expect(polyPlots.length).toBe(2);
    expect(polyPlots[0].zoneLabel).toBe('AREA A');
    expect(polyPlots[1].zoneLabel).toBe('AREA B');
  });
});

describe('Phase 5.3: Real Bulletin Golden Evaluation Suite', () => {
  it('Bulletin A (NAVAREA IV Firing Exercise) resolves to military polygon', () => {
    const bulletin = `NAVAREA IV 512/26.
    GULF OF MEXICO.
    GUNNERY AND MISSILE FIRING EXERCISES IN AREA BOUNDED BY
    25-30.0N 088-00.0W, 25-30.0N 086-30.0W, 24-00.0N 086-30.0W, 24-00.0N 088-00.0W.
    SHIPS REQUESTED TO NAVIGATE WITH CAUTION.`;

    const classification = classifyWarning(bulletin);
    expect(toPrimarySymbol(classification.category)).toBe('military');

    const geom = extractGeometry(bulletin);
    expect(geom.geometry.polygons?.length).toBeGreaterThanOrEqual(1);
    expect(geom.geometry.polygons![0].length).toBe(4);
  });

  it('Bulletin B (Subsea Cable Installation) resolves to subsea corridor', () => {
    const bulletin = `NAVAREA I 88/26.
    NORTH SEA.
    SUBSEA POWER CABLE SURVEY IN PROGRESS BY CABLE SHIP ALONG LINE JOINING
    55-10.0N 002-15.0E, 55-30.0N 003-00.0E, 56-00.0N 004-10.0E.
    WIDE BERTH OF 2 NM REQUESTED.`;

    const classification = classifyWarning(bulletin);
    expect(toPrimarySymbol(classification.category)).toBe('subsea');

    const geom = extractGeometry(bulletin);
    expect(geom.geometry.linestrings?.length).toBeGreaterThanOrEqual(1);
    expect(geom.geometry.linestrings![0].length).toBe(3);
  });

  it('Bulletin C (Hazardous Drifting Object) resolves to drifting category and vector', () => {
    const bulletin = `NAVAREA XI 204/26.
    PACIFIC OCEAN.
    SEMI-SUBMERGED DRIFTING CONTAINER REPORTED IN VICINITY 18-20.0N 135-40.0E AT 100800 UTC.
    DRIFTING EAST-NORTHEAST AT 1.5 KNOTS.`;

    const classification = classifyWarning(bulletin);
    expect(toPrimarySymbol(classification.category)).toBe('drifting');

    const vector = parseDriftVector([18.333, 135.667], bulletin);
    expect(vector).not.toBeNull();
    expect(vector?.speedKts).toBe(1.5);
  });

  it('Bulletin D (AtoN Relocation) resolves to aton relocation displacement archetype', () => {
    const bulletin = `NAVAREA II 44/26.
    BAY OF BISCAY.
    LIGHT BUOY NO 4 PERMANENTLY RELOCATED FROM 45-12.0N 001-30.0W TO 45-14.5N 001-32.0W.`;

    const classification = classifyWarning(bulletin);
    expect(toPrimarySymbol(classification.category)).toBe('aton');

    const geom = extractGeometry(bulletin);
    expect(geom.geometry.archetype).toBe('relocation');
    expect(geom.geometry.displacementVector).toBeDefined();
    expect(geom.geometry.displacementVector?.from.lat).toBeCloseTo(45.2, 1);
    expect(geom.geometry.displacementVector?.to.lat).toBeCloseTo(45.24, 1);
  });

  it('Bulletin E (Dangerous Wreck) resolves to wreck primary symbol point', () => {
    const bulletin = `NAVAREA IV 1002/26.
    CARIBBEAN SEA.
    DANGEROUS SUNKEN WRECK REPORTED IN POSITION 12-45.5N 068-15.2W.
    DEPTH OVER WRECK 4 METRES.`;

    const classification = classifyWarning(bulletin);
    expect(toPrimarySymbol(classification.category)).toBe('wreck');

    const plots = extractMaritimePlots(bulletin);
    expect(plots.length).toBeGreaterThanOrEqual(1);
    expect(plots[0].plotType).toBe('point');
  });
});

describe('Phase 5 Invariant: Boundary Hierarchy & Zoom Rules Consistency', () => {
  it('guarantees solid border for explicit verified geometries', () => {
    expect(getBoundaryDashArray(false, 'EXPLICIT')).toBeUndefined();
    expect(getBoundaryStyleType(false, 'EXPLICIT')).toBe('solid');
  });

  it('guarantees dashed border for inferred heuristic geometries', () => {
    expect(getBoundaryDashArray(false, 'INFERRED')).toBe('8, 6');
    expect(getBoundaryStyleType(false, 'INFERRED')).toBe('dashed');
  });

  it('guarantees dotted amber border for Tier B unverified review candidates', () => {
    expect(getBoundaryDashArray(true, 'EXPLICIT')).toBe('3, 5');
    expect(getBoundaryStyleType(true, 'EXPLICIT')).toBe('dotted');
  });

  it('declutters vertex markers at global zoom and preserves cluster centroids', () => {
    expect(shouldShowVertexPills(3, true)).toBe(false);
    expect(shouldShowVertexDots(3, false)).toBe(false);
    expect(shouldShowSwathPill(3, false)).toBe(false);
    expect(shouldHideCenterPoint(true, true, 3)).toBe(false);
  });
});

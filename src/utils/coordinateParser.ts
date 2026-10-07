import {
  BoundingBox,
  NavAreaId,
  SpatialData,
  SpatialGeometry,
  SpatialCircle,
  EcdisIntermediateLayer,
  EcdisPointFeature,
  GeometryIntent,
  FeatureInference,
  FeatureConfidence,
  FeatureRoleHint
} from '../types';

export const NAVAREA_BOUNDS: Record<NavAreaId, BoundingBox> = {
  I: { minLat: 48, maxLat: 75, minLng: -30, maxLng: 30 },
  Baltic: { minLat: 53, maxLat: 66, minLng: 9, maxLng: 31 },
  II: { minLat: 0, maxLat: 48, minLng: -30, maxLng: 15 },
  III: { minLat: 30, maxLat: 47, minLng: -6, maxLng: 42 },
  IV: { minLat: 7, maxLat: 67, minLng: -100, maxLng: -35 },
  XII: { minLat: -3.5, maxLat: 67, minLng: -180, maxLng: -100 },
  V: { minLat: -35, maxLat: 7, minLng: -70, maxLng: -20 },
  VI: { minLat: -60, maxLat: -20, minLng: -70, maxLng: -50 },
  VII: { minLat: -60, maxLat: 6, minLng: -20, maxLng: 80 },
  VIII: { minLat: -10, maxLat: 25, minLng: 60, maxLng: 100 },
  IX: { minLat: 10, maxLat: 32, minLng: 32, maxLng: 75 },
  X: { minLat: -60, maxLat: 12, minLng: 110, maxLng: 170 },
  XI: { minLat: -10, maxLat: 45, minLng: 95, maxLng: 170 },
  XIII: { minLat: 42, maxLat: 75, minLng: 130, maxLng: 180 },
  XIV: { minLat: -60, maxLat: 0, minLng: 150, maxLng: -120 },
  XV: { minLat: -60, maxLat: -18, minLng: -120, maxLng: -70 },
  XVI: { minLat: -18, maxLat: 3.4, minLng: -90, maxLng: -70 },
  XVII: { minLat: 60, maxLat: 90, minLng: -180, maxLng: -120 },
  XVIII: { minLat: 60, maxLat: 90, minLng: -120, maxLng: -35 },
  XIX: { minLat: 65, maxLat: 90, minLng: -30, maxLng: 45 },
  XX: { minLat: 65, maxLat: 90, minLng: 30, maxLng: 125 },
  XXI: { minLat: 65, maxLat: 90, minLng: 125, maxLng: -170 },
};

export type SemanticGeometryType =
  | 'POINT'
  | 'MULTI_POINT'
  | 'POINT_WITH_RADIUS'
  | 'CIRCLE'
  | 'LINE'
  | 'LINE_WITH_WIDTH'
  | 'POLYGON'
  | 'BOUNDING_BOX'
  | 'RECTANGLE'
  | 'SECTOR'
  | 'ARC'
  | 'UNKNOWN'
  | 'PARTIAL';

export type GeometryInferenceMode = 'EXPLICIT' | 'INFERRED' | 'PARTIAL' | 'UNKNOWN';
export type GeometryConfidenceLevel = 'VERIFIED' | 'HIGH_CONFIDENCE' | 'PARTIAL' | 'AMBIGUOUS' | 'UNKNOWN';
export type CoordinateRole =
  | 'CENTER'
  | 'BOUNDARY_VERTEX'
  | 'START_POINT'
  | 'END_POINT'
  | 'TRACK_POINT'
  | 'WAYPOINT'
  | 'REFERENCE_POINT'
  | 'HAZARD_POINT'
  | 'ANCHOR_POINT'
  | 'UNKNOWN';

export type EscalationCondition =
  | 'COORDINATES_PRESENT_BUT_NOT_PARSED'
  | 'AMBIGUOUS_HEMISPHERE'
  | 'MISSING_REQUIRED_COORDINATE'
  | 'GEOMETRY_AMBIGUOUS'
  | 'SPATIAL_RELATIONSHIP_UNKNOWN'
  | 'MULTI_AREA_GROUPING_AMBIGUOUS'
  | 'PARTIAL_GEOMETRY'
  | 'GEOMETRY_CONFLICT'
  | 'INVALID_GEOMETRY'
  | 'SELF_INTERSECTION'
  | 'OTHER_UNRESOLVED_VALIDATION_ERROR';

export interface EvidenceItem {
  rule: string;
  matched_text?: string;
  result?: any;
  position_count?: number;
}

export interface CoordinateGroup {
  group_id: string;
  group_label?: string; // e.g. 'A', 'B', 'C', 'D'
  coordinates: [number, number][];
  relationship: string;
  roles: CoordinateRole[];
  sequence: number[];
  evidence: EvidenceItem[];
}

export interface EnhancedSpatialGeometry extends SpatialGeometry {
  semantic_type?: SemanticGeometryType;
  inference_mode?: GeometryInferenceMode;
  confidence_level?: GeometryConfidenceLevel;
  spatial_group_id?: string;
  group_label?: string;
  evidence?: EvidenceItem[];
  radius_derived?: boolean;
  diameter_nm?: number;
  offset_each_side_nm?: number;
  start_bearing?: number;
  end_bearing?: number;
}

export interface EnhancedSpatialData extends SpatialData {
  geometries: EnhancedSpatialGeometry[];
  spatial_groups?: CoordinateGroup[];
  hemisphere_status?: 'EXPLICIT' | 'INFERRED_CONVENTION' | 'AMBIGUOUS_HEMISPHERE';
  navarea_relation?: 'INSIDE' | 'OUTSIDE' | 'PARTIALLY_OUTSIDE' | 'UNKNOWN';
  coordinate_validity?: 'VALID' | 'INVALID';
  geometry_validation?: 'VALID' | 'INVALID' | 'SUSPICIOUS' | 'CONFLICT';
  geometry_conflict?: boolean;
  conflict_reason?: string;
  escalation_triggers?: EscalationCondition[];
  review_required?: boolean;
}

/**
 * Converts degrees, minutes, seconds and direction to decimal degrees
 */
export function dmsToDecimal(deg: number, min: number, sec: number, dir: string): number {
  let val = deg + min / 60 + (sec || 0) / 3600;
  if (dir === 'S' || dir === 'W') {
    val = -val;
  }
  return Number(val.toFixed(5));
}

/**
 * Parses coordinate pair strings with comprehensive support for DMS, decimal, hyphenated, compact, and hemisphere rules.
 * Never silently guesses hemispheres when missing (returns null or flags AMBIGUOUS_HEMISPHERE).
 */
export function parseSingleCoordinatePair(
  text: string,
  globalHemisphereConvention?: { latDir: string; lonDir: string } | null
): { lngLat: [number, number] | null; hemisphereAmbiguous: boolean; raw: string } {
  if (!text || typeof text !== 'string') return { lngLat: null, hemisphereAmbiguous: false, raw: text };

  const raw = text;
  const clean = text
    .replace(/Â°/g, '°')
    .replace(/&deg;/g, '°')
    .replace(/\bPt\s*\d+:\s*/gi, '')
    .replace(/\([^\)]+\)/g, '')
    .trim();

  // Pattern 1: Explicit DMS with N/S and E/W
  const pattern1 = /(\d{1,3})(?:[°\s\-]|Â°)+(\d{1,2}(?:\.\d+)?)['′"]?\s*(?:(\d{1,2}(?:\.\d+)?)\s*["″]\s*)?([NS])[\s,]+(?:\bPt\s*\d+:\s*)?(\d{1,3})(?:[°\s\-]|Â°)+(\d{1,2}(?:\.\d+)?)['′"]?\s*(?:(\d{1,2}(?:\.\d+)?)\s*["″]\s*)?([EW])/i;
  const match1 = clean.match(pattern1);
  if (match1) {
    const lat = dmsToDecimal(parseFloat(match1[1]), parseFloat(match1[2]), match1[3] ? parseFloat(match1[3]) : 0, match1[4].toUpperCase());
    const lng = dmsToDecimal(parseFloat(match1[5]), parseFloat(match1[6]), match1[7] ? parseFloat(match1[7]) : 0, match1[8].toUpperCase());
    return { lngLat: [lng, lat], hemisphereAmbiguous: false, raw };
  }

  // Pattern 2: Decimal degrees with optional N/S E/W
  const patternDec = /(-?\d{1,3}\.\d+)\s*°?\s*([NS])?[\s,]+(-?\d{1,3}\.\d+)\s*°?\s*([EW])?/i;
  const matchDec = clean.match(patternDec);
  if (matchDec) {
    let lat = parseFloat(matchDec[1]);
    let latDir = matchDec[2]?.toUpperCase();
    let lng = parseFloat(matchDec[3]);
    let lonDir = matchDec[4]?.toUpperCase();

    if (!latDir || !lonDir) {
      if (globalHemisphereConvention) {
        if (!latDir) latDir = globalHemisphereConvention.latDir;
        if (!lonDir) lonDir = globalHemisphereConvention.lonDir;
      } else {
        return { lngLat: null, hemisphereAmbiguous: true, raw };
      }
    }

    if (latDir === 'S') lat = -Math.abs(lat);
    if (lonDir === 'W') lng = -Math.abs(lng);
    return { lngLat: [Number(lng.toFixed(5)), Number(lat.toFixed(5))], hemisphereAmbiguous: false, raw };
  }

  // Pattern 3: Integer degrees + minutes without explicit symbols (e.g. 20-28N 072-28E or 20-28 072-28)
  const pattern3 = /(\d{1,3})[-°\s]+(\d{1,2}(?:\.\d+)?)\s*([NS])?[\s,]+(\d{1,3})[-°\s]+(\d{1,2}(?:\.\d+)?)\s*([EW])?/i;
  const match3 = clean.match(pattern3);
  if (match3) {
    let latDeg = parseFloat(match3[1]);
    let latMin = parseFloat(match3[2]);
    let latDir = match3[3] ? match3[3].toUpperCase() : null;

    let lonDeg = parseFloat(match3[4]);
    let lonMin = parseFloat(match3[5]);
    let lonDir = match3[6] ? match3[6].toUpperCase() : null;

    if (!latDir || !lonDir) {
      if (globalHemisphereConvention) {
        if (!latDir) latDir = globalHemisphereConvention.latDir;
        if (!lonDir) lonDir = globalHemisphereConvention.lonDir;
      } else {
        return { lngLat: null, hemisphereAmbiguous: true, raw };
      }
    }

    const lat = dmsToDecimal(latDeg, latMin, 0, latDir || 'N');
    const lng = dmsToDecimal(lonDeg, lonMin, 0, lonDir || 'E');
    return { lngLat: [lng, lat], hemisphereAmbiguous: false, raw };
  }

  // Check if numbers exist but hemispheres are completely missing
  const hasNumbers = /\d{1,3}/.test(clean);
  if (hasNumbers && !/[NS]/i.test(clean) && !/[EW]/i.test(clean)) {
    if (globalHemisphereConvention) {
      const fallbackCleanMatch = clean.match(/(\d{1,3})[^0-9]+(\d{1,2}(?:\.\d+)?)[\s,]+(\d{1,3})[^0-9]+(\d{1,2}(?:\.\d+)?)/);
      if (fallbackCleanMatch) {
        const lat = dmsToDecimal(parseFloat(fallbackCleanMatch[1]), parseFloat(fallbackCleanMatch[2]), 0, globalHemisphereConvention.latDir);
        const lng = dmsToDecimal(parseFloat(fallbackCleanMatch[3]), parseFloat(fallbackCleanMatch[4]), 0, globalHemisphereConvention.lonDir);
        return { lngLat: [lng, lat], hemisphereAmbiguous: false, raw };
      }
    }
    return { lngLat: null, hemisphereAmbiguous: true, raw };
  }

  return { lngLat: null, hemisphereAmbiguous: false, raw };
}

/**
 * TIER 1: Evidence-based Deterministic NAVWARN Spatial Interpretation Engine
 */
export function parseCoordinatesDeterministic(rawText: string, navarea?: NavAreaId): EnhancedSpatialData {
  const geometries: EnhancedSpatialGeometry[] = [];
  const circles: SpatialCircle[] = [];
  const rawCoordinateText: string[] = [];
  const evidenceTrail: EvidenceItem[] = [];
  const spatialGroups: CoordinateGroup[] = [];
  const escalationTriggers: EscalationCondition[] = [];

  if (!rawText || typeof rawText !== 'string') {
    return {
      geometries: [],
      circles: [],
      raw_coordinate_text: [],
      validation_status: 'not_present',
      hemisphere_status: 'EXPLICIT',
      navarea_relation: 'UNKNOWN',
      coordinate_validity: 'VALID',
      geometry_validation: 'VALID',
      escalation_triggers: [],
    };
  }

  const sanitizedText = rawText.replace(/Â°/g, '°').replace(/&deg;/g, '°');
  const upperText = sanitizedText.toUpperCase();

  // Check for global hemisphere convention statement
  let globalConvention: { latDir: string; lonDir: string } | null = null;
  if (/ALL POSITIONS ARE IN NORTH AND EAST/i.test(sanitizedText)) {
    globalConvention = { latDir: 'N', lonDir: 'E' };
    evidenceTrail.push({ rule: 'EXPLICIT_HEMISPHERE_CONVENTION', matched_text: 'ALL POSITIONS ARE IN NORTH AND EAST' });
  }

  let hemisphereAmbiguousFound = false;

  // 1. Check for Multi-Area Lettered Sub-blocks (e.g. (A), (B), (C), (D) as in NAVWARN 977/26)
  const subAreaRegex = /\(([A-Z])\)\s*([^()]+(?:,|\s)[^()]+(?:\([^)]+\))?)/gi;
  let subMatch;
  let subAreaCount = 0;
  const subBlocks: { label: string; text: string }[] = [];

  while ((subMatch = subAreaRegex.exec(sanitizedText)) !== null) {
    subAreaCount++;
    subBlocks.push({ label: subMatch[1], text: subMatch[2] });
  }

  if (subBlocks.length > 0) {
    evidenceTrail.push({ rule: 'MULTI_AREA_SUB_BLOCKS_DETECTED', matched_text: `Found ${subBlocks.length} lettered sub-areas` });
    
    for (const block of subBlocks) {
      const coordPattern = /(\d{1,3}(?:[°\s\-]|Â°)+\d{1,2}(?:\.\d+)?[^\d,]*[NS][\s,]+\d{1,3}(?:[°\s\-]|Â°)+\d{1,2}(?:\.\d+)?[^\d,]*[EW]|\d{1,3}\.\d+\s*[NS]?[\s,]+\d{1,3}\.\d+\s*[EW]?)/gi;
      const matches = block.text.match(coordPattern) || [];
      const groupCoords: [number, number][] = [];
      const groupRoles: CoordinateRole[] = [];

      for (const m of matches) {
        const parsed = parseSingleCoordinatePair(m, globalConvention);
        if (parsed.hemisphereAmbiguous) hemisphereAmbiguousFound = true;
        if (parsed.lngLat) {
          groupCoords.push(parsed.lngLat);
          groupRoles.push('BOUNDARY_VERTEX');
          rawCoordinateText.push(m);
        }
      }

      if (groupCoords.length >= 3) {
        const polyCoords = [...groupCoords];
        const first = polyCoords[0];
        const last = polyCoords[polyCoords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          polyCoords.push(first); // Close explicitly
        }

        const groupId = `group-${block.label}-${Math.random().toString(36).substr(2, 6)}`;
        spatialGroups.push({
          group_id: groupId,
          group_label: block.label,
          coordinates: polyCoords,
          relationship: 'BOUNDED_BY',
          roles: groupRoles,
          sequence: polyCoords.map((_, i) => i + 1),
          evidence: [{ rule: 'LETTERED_SUB_BLOCK_POLYGON', matched_text: `Area (${block.label})` }],
        });

        geometries.push({
          type: 'Polygon',
          semantic_type: 'POLYGON',
          coordinates: [polyCoords],
          label: `Area (${block.label})`,
          inference_mode: 'EXPLICIT',
          confidence_level: 'VERIFIED',
          spatial_group_id: groupId,
          group_label: block.label,
          evidence: [{ rule: 'STRONG_POLYGON_INDICATOR', matched_text: 'AREAS BOUNDED BY' }],
        });
      }
    }
  }

  // If no multi-area lettered sub-blocks were parsed, fallback to standard geometry extraction rules
  if (geometries.length === 0) {
    // A. Circle / Radius
    const circlePattern = /(?:WITHIN|RADIUS|CIRCLE OF RADIUS|EXTENDING)\s+(\d+(?:\.\d+)?)\s*(?:NM|NAUTICAL MILES)?\s*(?:OF|CENTRED ON|CENTERED ON|FROM)?\s*([0-9\-\.°\s'″NS]+[EW])/gi;
    let circleMatch;
    while ((circleMatch = circlePattern.exec(sanitizedText)) !== null) {
      const radius = parseFloat(circleMatch[1]);
      const coordStr = circleMatch[2];
      const parsed = parseSingleCoordinatePair(coordStr, globalConvention);
      if (parsed.hemisphereAmbiguous) hemisphereAmbiguousFound = true;
      if (parsed.lngLat) {
        circles.push({
          center: parsed.lngLat,
          radius_nm: radius,
          label: `Danger Zone (${radius} NM Radius)`,
        });
        geometries.push({
          type: 'Circle',
          semantic_type: 'POINT_WITH_RADIUS',
          coordinates: parsed.lngLat,
          radius_nm: radius,
          label: `${radius} NM Radius Area`,
          inference_mode: 'EXPLICIT',
          confidence_level: 'VERIFIED',
          evidence: [{ rule: 'EXPLICIT_RADIUS_STATEMENT', matched_text: circleMatch[0] }],
        });
        rawCoordinateText.push(circleMatch[0]);
        evidenceTrail.push({ rule: 'EXPLICIT_GEOMETRY_CIRCLE', matched_text: circleMatch[0] });
      }
    }

    // B. Diameter Rule
    const diameterPattern = /(?:DIAMETER|AREA OF DIAMETER|CIRCLE WITH DIAMETER)\s+(\d+(?:\.\d+)?)\s*(?:NM|NAUTICAL MILES)?/gi;
    let diamMatch = diameterPattern.exec(sanitizedText);
    let derivedRadius: number | undefined;
    let diameterVal: number | undefined;
    if (diamMatch) {
      diameterVal = parseFloat(diamMatch[1]);
      derivedRadius = diameterVal / 2;
      evidenceTrail.push({ rule: 'DIAMETER_RULE_APPLIED', matched_text: diamMatch[0], result: { diameter: diameterVal, radius: derivedRadius } });
    }

    // C. Line Width / Corridor Rule
    const corridorPattern = /(\d+(?:\.\d+)?)\s*(?:NM|NAUTICAL MILES)?\s*(?:EITHER SIDE|ON EITHER SIDE|OF THE TRACK|OF TRACK|CORRIDOR)/gi;
    let corridorMatch = corridorPattern.exec(sanitizedText);
    let corridorWidth: number | undefined;
    if (corridorMatch) {
      corridorWidth = parseFloat(corridorMatch[1]);
      evidenceTrail.push({ rule: 'LINE_WIDTH_CORRIDOR_RULE', matched_text: corridorMatch[0], result: { offset_nm: corridorWidth } });
    }

    // D. Extract All Standard Coordinate Pairs
    const globalCoordPattern = /(\d{1,3}(?:[°\s\-]|Â°)+\d{1,2}(?:\.\d+)?[^\d,]*[NS][\s,]+(?:\bPt\s*\d+:\s*)?\d{1,3}(?:[°\s\-]|Â°)+\d{1,2}(?:\.\d+)?[^\d,]*[EW])/gi;
    const allPairMatches = sanitizedText.match(globalCoordPattern) || [];
    const parsedPoints: { lngLat: [number, number]; raw: string; role: CoordinateRole }[] = [];

    for (const matchStr of allPairMatches) {
      const parsed = parseSingleCoordinatePair(matchStr, globalConvention);
      if (parsed.hemisphereAmbiguous) hemisphereAmbiguousFound = true;
      if (parsed.lngLat) {
        let role: CoordinateRole = 'UNKNOWN';
        if (/CENTRE|CENTER/i.test(matchStr) || /CENTRED ON/i.test(sanitizedText)) role = 'CENTER';
        else if (/FROM/i.test(matchStr)) role = 'START_POINT';
        else if (/TO/i.test(matchStr)) role = 'END_POINT';
        else role = 'WAYPOINT';

        parsedPoints.push({ lngLat: parsed.lngLat, raw: matchStr, role });
        rawCoordinateText.push(matchStr);
      }
    }

    const uniquePoints: { lngLat: [number, number]; raw: string; role: CoordinateRole }[] = [];
    parsedPoints.forEach((pt) => {
      const isExactDup = uniquePoints.some((u) => u.lngLat[0] === pt.lngLat[0] && u.lngLat[1] === pt.lngLat[1]);
      if (!isExactDup) {
        uniquePoints.push(pt);
      }
    });

    const rawCoordsOnly = uniquePoints.map((p) => p.lngLat);

    const hasStrongPolygonIndicator = /BOUNDED BY|AREA BOUNDED BY|BOUNDARIES ARE|LIMITED BY|AREA ENCLOSED BY|WITHIN THE AREA ENCLOSED BY/i.test(upperText);
    const hasLineIndicator = /JOINING|CONNECTING|LINE FROM|LINE BETWEEN|TRACK FROM|TRACK JOINING|ROUTE FROM|SUBMARINE CABLE|CABLE BETWEEN|PIPELINE/i.test(upperText);

    if (rawCoordsOnly.length > 0) {
      if (hasStrongPolygonIndicator && rawCoordsOnly.length >= 3) {
        const polyCoords = [...rawCoordsOnly];
        const first = polyCoords[0];
        const last = polyCoords[polyCoords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          polyCoords.push(first);
        }
        const groupId = `group-std-${Math.random().toString(36).substr(2, 6)}`;
        spatialGroups.push({
          group_id: groupId,
          coordinates: polyCoords,
          relationship: 'BOUNDED_BY',
          roles: uniquePoints.map(p => p.role),
          sequence: polyCoords.map((_, i) => i + 1),
          evidence: [{ rule: 'STRONG_POLYGON_INDICATOR', matched_text: 'BOUNDED BY' }],
        });
        geometries.push({
          type: 'Polygon',
          semantic_type: 'POLYGON',
          coordinates: [polyCoords],
          label: 'Area Bounded by Coordinates',
          inference_mode: 'EXPLICIT',
          confidence_level: 'VERIFIED',
          spatial_group_id: groupId,
          evidence: [{ rule: 'STRONG_POLYGON_INDICATOR', matched_text: 'BOUNDED BY' }],
        });
      } else if (hasLineIndicator || rawCoordsOnly.length === 2) {
        const geomType = corridorWidth ? 'LINE_WITH_WIDTH' : 'LINE';
        const groupId = `group-line-${Math.random().toString(36).substr(2, 6)}`;
        spatialGroups.push({
          group_id: groupId,
          coordinates: rawCoordsOnly,
          relationship: 'JOINING',
          roles: uniquePoints.map(p => p.role),
          sequence: rawCoordsOnly.map((_, i) => i + 1),
          evidence: [{ rule: 'EXPLICIT_LINE_INDICATOR', matched_text: 'JOINING' }],
        });
        geometries.push({
          type: 'LineString',
          semantic_type: geomType as SemanticGeometryType,
          coordinates: rawCoordsOnly,
          label: corridorWidth ? `Corridor (${corridorWidth} NM Wide)` : 'Line / Track / Route',
          inference_mode: 'EXPLICIT',
          confidence_level: 'HIGH_CONFIDENCE',
          offset_each_side_nm: corridorWidth,
          spatial_group_id: groupId,
          evidence: [{ rule: 'EXPLICIT_LINE_INDICATOR' }],
        });
      } else if (rawCoordsOnly.length === 1) {
        geometries.push({
          type: 'Point',
          semantic_type: derivedRadius ? 'POINT_WITH_RADIUS' : 'POINT',
          coordinates: rawCoordsOnly[0],
          radius_nm: derivedRadius,
          label: derivedRadius ? `Point with Radius (${derivedRadius} NM)` : 'Reported Hazard Position',
          inference_mode: 'EXPLICIT',
          confidence_level: 'VERIFIED',
          evidence: [{ rule: 'SINGLE_COORDINATE_POINT' }],
        });
      } else if (rawCoordsOnly.length > 1) {
        geometries.push({
          type: 'Point',
          semantic_type: 'MULTI_POINT',
          coordinates: rawCoordsOnly,
          label: 'Multiple Independent Positions',
          inference_mode: 'INFERRED',
          confidence_level: 'PARTIAL',
          evidence: [{ rule: 'MULTIPLE_INDEPENDENT_POINTS' }],
        });
      }
    }
  }

  // Check Escalation Conditions
  if (hemisphereAmbiguousFound) {
    escalationTriggers.push('AMBIGUOUS_HEMISPHERE');
  }
  if (geometries.length === 0 && /\d{1,3}/.test(sanitizedText)) {
    escalationTriggers.push('COORDINATES_PRESENT_BUT_NOT_PARSED');
  }

  // Validation & NAVAREA Relation
  let validation_status: EnhancedSpatialData['validation_status'] = 'not_present';
  let navareaRelation: EnhancedSpatialData['navarea_relation'] = 'INSIDE';
  let coordinateValidity: EnhancedSpatialData['coordinate_validity'] = 'VALID';
  let geometryValidation: EnhancedSpatialData['geometry_validation'] = 'VALID';

  const allPts: [number, number][] = [];
  spatialGroups.forEach(g => g.coordinates.forEach(c => allPts.push(c)));
  circles.forEach(c => allPts.push(c.center));
  geometries.forEach(g => {
    const pt = findFirstPoint(g.coordinates);
    if (pt) allPts.push(pt);
  });

  if (allPts.length > 0 || circles.length > 0) {
    validation_status = 'passed';
    if (navarea && NAVAREA_BOUNDS[navarea]) {
      const bounds = NAVAREA_BOUNDS[navarea];
      const outOfBounds = allPts.some(
        ([lng, lat]) => lat < bounds.minLat || lat > bounds.maxLat || lng < bounds.minLng || lng > bounds.maxLng
      );
      if (outOfBounds) {
        navareaRelation = 'OUTSIDE';
        validation_status = 'out_of_bounds';
      }
    }
  }

  if (hemisphereAmbiguousFound) {
    coordinateValidity = 'INVALID';
    geometryValidation = 'INVALID';
    validation_status = 'invalid_format';
  }

  return {
    geometries,
    circles,
    spatial_groups: spatialGroups,
    raw_coordinate_text: Array.from(new Set(rawCoordinateText)),
    validation_status,
    hemisphere_status: hemisphereAmbiguousFound ? 'AMBIGUOUS_HEMISPHERE' : 'EXPLICIT',
    navarea_relation: navareaRelation,
    coordinate_validity: coordinateValidity,
    geometry_validation: geometryValidation,
    escalation_triggers: escalationTriggers,
    review_required: escalationTriggers.length > 0,
  };
}

export function findFirstPoint(coords: any): [number, number] | null {
  if (!coords || !Array.isArray(coords) || coords.length === 0) return null;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number' && !isNaN(coords[0]) && !isNaN(coords[1])) {
    return [coords[0], coords[1]];
  }
  for (const item of coords) {
    const pt = findFirstPoint(item);
    if (pt) return pt;
  }
  return null;
}

export function formatSpatialCoordinates(spatial: SpatialData | undefined | null): string {
  if (!spatial) return 'N/A';
  if (spatial.circles && spatial.circles.length > 0 && Array.isArray(spatial.circles[0].center)) {
    const [lng, lat] = spatial.circles[0].center;
    if (typeof lng === 'number' && typeof lat === 'number') {
      return `${lng.toFixed(2)}, ${lat.toFixed(2)}`;
    }
  }
  if (spatial.geometries && spatial.geometries.length > 0) {
    for (const g of spatial.geometries) {
      const pt = findFirstPoint(g?.coordinates);
      if (pt && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
        return `${pt[0].toFixed(2)}, ${pt[1].toFixed(2)}`;
      }
    }
  }
  return 'N/A';
}

export function getLeafletLatLng(
  spatial: SpatialData | undefined | null,
  directLat?: number | null,
  directLng?: number | null
): [number, number] {
  if (
    typeof directLat === 'number' &&
    typeof directLng === 'number' &&
    !isNaN(directLat) &&
    !isNaN(directLng) &&
    (directLat !== 0 || directLng !== 0)
  ) {
    return [directLat, directLng];
  }
  if (!spatial) return [0, 0];
  if (spatial.circles && spatial.circles.length > 0 && Array.isArray(spatial.circles[0].center)) {
    const [lng, lat] = spatial.circles[0].center;
    if (typeof lng === 'number' && typeof lat === 'number') {
      return [lat, lng];
    }
  }
  if (spatial.geometries && spatial.geometries.length > 0) {
    for (const g of spatial.geometries) {
      const pt = findFirstPoint(g?.coordinates);
      if (pt && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
        return [pt[1], pt[0]];
      }
    }
  }
  return [0, 0];
}

export function parseWithFallback(rawText: string, navarea: NavAreaId | string) {
  const regexResult = parseCoordinatesDeterministic(rawText, navarea as NavAreaId);

  // Determine if Tier 2 escalation is needed based on escalation triggers
  const needsEscalation =
    regexResult.escalation_triggers &&
    regexResult.escalation_triggers.length > 0 &&
    (regexResult.escalation_triggers.includes('COORDINATES_PRESENT_BUT_NOT_PARSED') ||
     regexResult.escalation_triggers.includes('AMBIGUOUS_HEMISPHERE'));

  if (needsEscalation) {
    return {
      source: 'llm_fallback' as const,
      needsGeminiParse: true,
      rawText,
      regexResult,
    };
  }

  return {
    source: 'regex' as const,
    needsGeminiParse: false,
    regexResult,
  };
}

export function isPointInNavArea(
  lat: number,
  lng: number,
  navarea: NavAreaId | string | null,
  bufferDeg = 0.5
): boolean {
  if (!navarea || !NAVAREA_BOUNDS[navarea as NavAreaId]) return true;
  const b = NAVAREA_BOUNDS[navarea as NavAreaId];

  const minLat = b.minLat - bufferDeg;
  const maxLat = b.maxLat + bufferDeg;
  let minLng = b.minLng - bufferDeg;
  let maxLng = b.maxLng + bufferDeg;

  if (lat < minLat || lat > maxLat) return false;

  if (minLng > maxLng) {
    return lng >= minLng || lng <= maxLng;
  }
  return lng >= minLng && lng <= maxLng;
}

export function testFourWayInference(
  latVal: number,
  lngVal: number,
  navarea: NavAreaId | string | null
): {
  coords: [number, number];
  inference: FeatureInference;
  confidence: FeatureConfidence;
  errors: string[];
} {
  const candidates: { signLat: number; signLng: number; coords: [number, number] }[] = [
    { signLat: 1, signLng: 1, coords: [lngVal, latVal] },
    { signLat: 1, signLng: -1, coords: [-lngVal, latVal] },
    { signLat: -1, signLng: 1, coords: [lngVal, -latVal] },
    { signLat: -1, signLng: -1, coords: [-lngVal, -latVal] },
  ];

  const validMatches = candidates.filter(c =>
    isPointInNavArea(c.coords[1], c.coords[0], navarea)
  );

  if (validMatches.length === 1) {
    return {
      coords: validMatches[0].coords,
      inference: 'inferred',
      confidence: 'verified',
      errors: [],
    };
  }

  return {
    coords: [0, 0],
    inference: 'explicit',
    confidence: 'rejected',
    errors: ['COORD_UNSIGNED_AMBIGUOUS'],
  };
}

export function classifyGeometryIntent(
  rawText: string,
  featureCount: number,
  isRangedArea: boolean
): GeometryIntent {
  if (isRangedArea) return 'area';

  const text = rawText.toUpperCase();

  const areaRegex = /BOUNDED BY|AREA BOUNDED|BOUNDED WITHIN|AREA BETWEEN|WITHIN LIMITS|FOUR CORNERS|POLYGON|QUADRILATERAL|AREA ENCLOSED|REGION BOUNDED/i;
  if (areaRegex.test(text)) return 'area';

  const routeRegex = /FROM .* TO|ROUTE BETWEEN|TRACKLINE|ALONG TRACK|LINE JOINING|WAYPOINTS|TRANSIT ROUTE|LINE CONNECTING/i;
  if (routeRegex.test(text)) return 'route';

  const pointsRegex = /DRIFTING|WRECK|SHOAL|LIGHT UNLIT|BUOY OFF STATION|HAZARD AT|SINGLE POSITION|BUOY MOORED|OBJECT/i;
  if (pointsRegex.test(text) || featureCount === 1) return 'points';

  if (featureCount >= 3) return 'area';
  if (featureCount === 2) return 'route';

  return 'unknown';
}

export function extractEcdisIntermediateLayer(
  warningId: string,
  navarea: NavAreaId | string | null,
  rawText: string
): EcdisIntermediateLayer {
  const features: EcdisPointFeature[] = [];
  const parsed = parseCoordinatesDeterministic(rawText, navarea as NavAreaId);
  let seq = 1;

  if (parsed.spatial_groups && parsed.spatial_groups.length > 0) {
    parsed.spatial_groups.forEach(g => {
      g.coordinates.forEach(coord => {
        const isInside = isPointInNavArea(coord[1], coord[0], navarea);
        features.push({
          type: 'Feature',
          id: `feat-${warningId}-${seq}-${Math.random().toString(36).substr(2, 6)}`,
          geometry: {
            type: 'Point',
            coordinates: coord,
          },
          properties: {
            sequence_index: seq++,
            raw_text: rawText.slice(0, 50),
            inference: 'explicit',
            confidence: isInside ? 'verified' : 'partial',
            modification_state: 'original',
            user_notes: '',
            errors: isInside ? [] : ['COORD_OUTSIDE_NAVAREA'],
            role_hint: 'vertex',
          },
        });
      });
    });
  } else {
    parsed.geometries.forEach(geom => {
      const pt = findFirstPoint(geom.coordinates);
      if (pt) {
        const isInside = isPointInNavArea(pt[1], pt[0], navarea);
        features.push({
          type: 'Feature',
          id: `feat-${warningId}-${seq}-${Math.random().toString(36).substr(2, 6)}`,
          geometry: {
            type: 'Point',
            coordinates: pt,
          },
          properties: {
            sequence_index: seq++,
            raw_text: rawText.slice(0, 50),
            inference: 'explicit',
            confidence: isInside ? 'verified' : 'partial',
            modification_state: 'original',
            user_notes: '',
            errors: isInside ? [] : ['COORD_OUTSIDE_NAVAREA'],
            role_hint: 'vertex',
          },
        });
      }
    });
  }

  const intent = classifyGeometryIntent(rawText, features.length, false);

  return {
    warningId,
    navarea: navarea || null,
    editable: true,
    geometry_intent: intent,
    features,
  };
}


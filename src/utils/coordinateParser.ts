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
  FeatureRoleHint,
  DataQualityRating,
  AmbiguousPosition,
  RadiusSpecification,
} from '../types.js';

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
  data_quality?: DataQualityRating;
  ambiguous_positions?: AmbiguousPosition[];
  radius_specifications?: RadiusSpecification[];
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
 * P0 Safety: Broadened radius normalisation pattern covering:
 * - RADIUS OF 0.6 MILES
 * - WITHIN A RADIUS OF 500 METRES
 * - WITHIN 0.6 MILES
 * - RADIUS 500 METRES
 * Converts metres to nautical miles (1 NM = 1852 m, rounded to 3 decimal places) and retains raw text/units.
 */
export function parseRadiusSpecification(text: string): RadiusSpecification | null {
  if (!text || typeof text !== 'string') return null;
  const regex = /(?:(?:WITHIN\s+(?:A\s+)?)?RADIUS\s*(?:OF\s+)?|WITHIN\s+)\s*([0-9]+(?:\.[0-9]+)?)\s*(MILES?|NAUTICAL\s+MILES?|NM|METRES?|METERS?|M)\b/i;
  const match = regex.exec(text);
  if (!match) return null;
  const val = parseFloat(match[1]);
  if (isNaN(val)) return null;
  const rawUnit = match[2];
  const unitStr = rawUnit.toUpperCase();
  const isMetres = unitStr.startsWith('M') && !unitStr.startsWith('MI');
  const radius_nm = isMetres ? Math.round((val / 1852) * 1000) / 1000 : Math.round(val * 1000) / 1000;
  return {
    raw_text: match[0],
    stated_value: val,
    stated_unit: isMetres ? 'METRE' : 'NM',
    raw_stated_unit: rawUnit,
    radius_nm,
  };
}

export interface ParseCoordinatePairResult {
  lngLat: [number, number] | null;
  hemisphereAmbiguous: boolean;
  raw: string;
  matchedTier?: string;
  defectReason?: 'AMBIGUOUS_HEMISPHERE' | 'PARTIAL_HEMISPHERE';
  hasLatHem?: boolean;
  hasLonHem?: boolean;
  dataQuality?: DataQualityRating;
}

/**
 * Parses coordinate pair strings with comprehensive 7-tier ordered precedence:
 * Tier 1A: Sub-Second DMS
 * Tier 1B: Standard DMS
 * Tier 1C: Decimal Minutes (High Precision)
 * Tier 1D: Integer Minutes
 * Tier 1E: Decimal Degrees
 * Tier 1F: Space/Punctuation Telex
 * Tier 1G: Hemisphere Integrity & Defect Quarantine with explicit boolean checks
 */
export function parseSingleCoordinatePair(
  text: string,
  globalHemisphereConvention?: { latDir: string; lonDir: string } | null
): ParseCoordinatePairResult {
  if (!text || typeof text !== 'string') return { lngLat: null, hemisphereAmbiguous: false, raw: text };

  const raw = text;
  const clean = text
    .replace(/Â°/g, '°')
    .replace(/&deg;/g, '°')
    .replace(/\bPt\s*\d+:\s*/gi, '')
    .replace(/\([^\)]+\)/g, '')
    .trim();

  // Tier 1A: Sub-Second DMS (e.g. 04-32-31.8S 114-01-36.0E)
  const tier1A = /(\d{1,3})[-°\s]+(\d{1,2})[-'′\s]+(\d{1,2}\.\d+)\s*["″]?\s*([NS])[\s,]+(\d{1,3})[-°\s]+(\d{1,2})[-'′\s]+(\d{1,2}\.\d+)\s*["″]?\s*([EW])/i;
  const m1A = clean.match(tier1A);
  if (m1A) {
    const lat = dmsToDecimal(parseFloat(m1A[1]), parseFloat(m1A[2]), parseFloat(m1A[3]), m1A[4].toUpperCase());
    const lng = dmsToDecimal(parseFloat(m1A[5]), parseFloat(m1A[6]), parseFloat(m1A[7]), m1A[8].toUpperCase());
    return { lngLat: [lng, lat], hemisphereAmbiguous: false, raw, matchedTier: 'Tier-1A-SubSecond-DMS', dataQuality: 'EXPLICIT', hasLatHem: true, hasLonHem: true };
  }

  // Tier 1B: Standard DMS (e.g. 28-15-15N 146-29-47E)
  const tier1B = /(\d{1,3})[-°\s]+(\d{1,2})[-'′\s]+(\d{1,2})\s*["″]?\s*([NS])[\s,]+(\d{1,3})[-°\s]+(\d{1,2})[-'′\s]+(\d{1,2})\s*["″]?\s*([EW])/i;
  const m1B = clean.match(tier1B);
  if (m1B) {
    const lat = dmsToDecimal(parseFloat(m1B[1]), parseFloat(m1B[2]), parseFloat(m1B[3]), m1B[4].toUpperCase());
    const lng = dmsToDecimal(parseFloat(m1B[5]), parseFloat(m1B[6]), parseFloat(m1B[7]), m1B[8].toUpperCase());
    return { lngLat: [lng, lat], hemisphereAmbiguous: false, raw, matchedTier: 'Tier-1B-Standard-DMS', dataQuality: 'EXPLICIT', hasLatHem: true, hasLonHem: true };
  }

  // Tier 1C: Decimal Minutes (High Precision e.g. 16-54.1N 134-39.5E or 05-05.79N 167-14.00E)
  const tier1C = /(\d{1,3})[-°\s]+(\d{1,2}\.\d+)['′]?\s*([NS])[\s,]+(\d{1,3})[-°\s]+(\d{1,2}\.\d+)['′]?\s*([EW])/i;
  const m1C = clean.match(tier1C);
  if (m1C) {
    const lat = dmsToDecimal(parseFloat(m1C[1]), parseFloat(m1C[2]), 0, m1C[3].toUpperCase());
    const lng = dmsToDecimal(parseFloat(m1C[4]), parseFloat(m1C[5]), 0, m1C[6].toUpperCase());
    return { lngLat: [lng, lat], hemisphereAmbiguous: false, raw, matchedTier: 'Tier-1C-Decimal-Minutes', dataQuality: 'EXPLICIT', hasLatHem: true, hasLonHem: true };
  }

  // Tier 1D: Integer Minutes (e.g. 11-52N 146-04E or 20-28N 072-28E)
  const tier1D = /(\d{1,3})[-°\s]+(\d{1,2})['′]?\s*([NS])[\s,]+(\d{1,3})[-°\s]+(\d{1,2})['′]?\s*([EW])/i;
  const m1D = clean.match(tier1D);
  if (m1D) {
    const lat = dmsToDecimal(parseFloat(m1D[1]), parseFloat(m1D[2]), 0, m1D[3].toUpperCase());
    const lng = dmsToDecimal(parseFloat(m1D[4]), parseFloat(m1D[5]), 0, m1D[6].toUpperCase());
    return { lngLat: [lng, lat], hemisphereAmbiguous: false, raw, matchedTier: 'Tier-1D-Integer-Minutes', dataQuality: 'EXPLICIT', hasLatHem: true, hasLonHem: true };
  }

  // Tier 1E: Decimal Degrees (e.g. 07.5N 080.8W or 7.5000N 80.8000W)
  const tier1E = /(-?\d{1,3}\.\d+)\s*°?\s*([NS])[\s,]+(-?\d{1,3}\.\d+)\s*°?\s*([EW])/i;
  const m1E = clean.match(tier1E);
  if (m1E) {
    let lat = parseFloat(m1E[1]);
    const latDir = m1E[2].toUpperCase();
    let lng = parseFloat(m1E[3]);
    const lonDir = m1E[4].toUpperCase();
    if (latDir === 'S') lat = -Math.abs(lat);
    if (lonDir === 'W') lng = -Math.abs(lng);
    return { lngLat: [Number(lng.toFixed(5)), Number(lat.toFixed(5))], hemisphereAmbiguous: false, raw, matchedTier: 'Tier-1E-Decimal-Degrees', dataQuality: 'EXPLICIT', hasLatHem: true, hasLonHem: true };
  }

  // Tier 1F: Space/Punctuation Telex (e.g. 11 52 N 146 04 E)
  const tier1F = /(\d{1,3})\s+(\d{1,2}(?:\.\d+)?)\s*([NS])[\s,]+(\d{1,3})\s+(\d{1,2}(?:\.\d+)?)\s*([EW])/i;
  const m1F = clean.match(tier1F);
  if (m1F) {
    const lat = dmsToDecimal(parseFloat(m1F[1]), parseFloat(m1F[2]), 0, m1F[3].toUpperCase());
    const lng = dmsToDecimal(parseFloat(m1F[4]), parseFloat(m1F[5]), 0, m1F[6].toUpperCase());
    return { lngLat: [lng, lat], hemisphereAmbiguous: false, raw, matchedTier: 'Tier-1F-Space-Telex', dataQuality: 'EXPLICIT', hasLatHem: true, hasLonHem: true };
  }

  // Tier 1G: Hemisphere Integrity & Defect Quarantine with explicit boolean checks
  // Detect candidate tuples containing coordinate numbers where hemisphere letters may be absent or partial
  const tier1GCandidate = /(?:(\d{1,3}(?:[-°\s]+\d{1,2}(?:[-'′\s]+\d{1,2}(?:\.\d+)?)?(?:\.\d+)?)[′'″"]?\s*([NS])?)[\s,]+(\d{1,3}(?:[-°\s]+\d{1,2}(?:[-'′\s]+\d{1,2}(?:\.\d+)?)?(?:\.\d+)?)[′'″"]?\s*([EW])?))/i;
  const m1G = clean.match(tier1GCandidate);
  if (m1G) {
    const latPart = m1G[1] || '';
    const lonPart = m1G[3] || '';
    // Critical boolean check as specified in plan Directive 1
    const hasLatHem = /[NS]/i.test(latPart);
    const hasLonHem = /[EW]/i.test(lonPart);

    if (!hasLatHem || !hasLonHem) {
      // Check if global convention rescues this
      if (globalHemisphereConvention) {
        const latNums = latPart.match(/\d+(?:\.\d+)?/g);
        const lonNums = lonPart.match(/\d+(?:\.\d+)?/g);
        if (latNums && lonNums) {
          const latDeg = parseFloat(latNums[0]);
          const latMin = latNums.length > 1 ? parseFloat(latNums[1]) : 0;
          const latSec = latNums.length > 2 ? parseFloat(latNums[2]) : 0;
          const lonDeg = parseFloat(lonNums[0]);
          const lonMin = lonNums.length > 1 ? parseFloat(lonNums[1]) : 0;
          const lonSec = lonNums.length > 2 ? parseFloat(lonNums[2]) : 0;

          const lat = dmsToDecimal(latDeg, latMin, latSec, hasLatHem ? (m1G[2] || 'N').toUpperCase() : globalHemisphereConvention.latDir);
          const lng = dmsToDecimal(lonDeg, lonMin, lonSec, hasLonHem ? (m1G[4] || 'E').toUpperCase() : globalHemisphereConvention.lonDir);
          return {
            lngLat: [lng, lat],
            hemisphereAmbiguous: false,
            raw,
            matchedTier: 'Tier-1G-Rescued-Convention',
            dataQuality: 'INFERRED',
            hasLatHem: Boolean(hasLatHem),
            hasLonHem: Boolean(hasLonHem),
          };
        }
      }

      // No convention -> Strict Quarantine!
      const defectReason: 'PARTIAL_HEMISPHERE' | 'AMBIGUOUS_HEMISPHERE' =
        (hasLatHem || hasLonHem) ? 'PARTIAL_HEMISPHERE' : 'AMBIGUOUS_HEMISPHERE';

      return {
        lngLat: null,
        hemisphereAmbiguous: true,
        raw,
        matchedTier: 'Tier-1G-Quarantine',
        defectReason,
        hasLatHem: Boolean(hasLatHem),
        hasLonHem: Boolean(hasLonHem),
        dataQuality: 'AMBIGUOUS',
      };
    }
  }

  // Bare numbers fallback check
  const hasNumbers = /\d{1,3}/.test(clean);
  if (hasNumbers) {
    const hasLatHem = /[NS]/i.test(clean);
    const hasLonHem = /[EW]/i.test(clean);
    if (!hasLatHem || !hasLonHem) {
      if (globalHemisphereConvention) {
        const fallbackNums = clean.match(/\d+(?:\.\d+)?/g);
        if (fallbackNums && fallbackNums.length >= 2) {
          const lat = dmsToDecimal(parseFloat(fallbackNums[0]), parseFloat(fallbackNums[1]), 0, globalHemisphereConvention.latDir);
          const lng = fallbackNums.length >= 4
            ? dmsToDecimal(parseFloat(fallbackNums[2]), parseFloat(fallbackNums[3]), 0, globalHemisphereConvention.lonDir)
            : dmsToDecimal(parseFloat(fallbackNums[2] || '0'), 0, 0, globalHemisphereConvention.lonDir);
          return {
            lngLat: [lng, lat],
            hemisphereAmbiguous: false,
            raw,
            matchedTier: 'Tier-1G-Fallback-Convention',
            dataQuality: 'INFERRED',
            hasLatHem: Boolean(hasLatHem),
            hasLonHem: Boolean(hasLonHem),
          };
        }
      }
      return {
        lngLat: null,
        hemisphereAmbiguous: true,
        raw,
        matchedTier: 'Tier-1G-Quarantine',
        defectReason: (hasLatHem || hasLonHem) ? 'PARTIAL_HEMISPHERE' : 'AMBIGUOUS_HEMISPHERE',
        hasLatHem: Boolean(hasLatHem),
        hasLonHem: Boolean(hasLonHem),
        dataQuality: 'AMBIGUOUS',
      };
    }
  }

  return { lngLat: null, hemisphereAmbiguous: false, raw };
}

/**
 * TIER 1: Evidence-based Deterministic NAVWARN Spatial Interpretation Engine
 */
export function parseCoordinatesDeterministic(
  rawText: string,
  navarea?: NavAreaId,
  options?: {
    defaultHemisphereConvention?: { latDir: 'N' | 'S'; lonDir: 'E' | 'W' };
    isSingleHemisphere?: boolean;
  }
): EnhancedSpatialData {
  const geometries: EnhancedSpatialGeometry[] = [];
  const circles: SpatialCircle[] = [];
  const rawCoordinateText: string[] = [];
  const evidenceTrail: EvidenceItem[] = [];
  const spatialGroups: CoordinateGroup[] = [];
  const escalationTriggers: EscalationCondition[] = [];
  const ambiguousPositions: AmbiguousPosition[] = [];
  const radiusSpecifications: RadiusSpecification[] = [];

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
      data_quality: 'EXPLICIT',
      ambiguous_positions: [],
      radius_specifications: [],
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

  // Parse radius specification if present (broadened pattern)
  const radiusSpec = parseRadiusSpecification(sanitizedText);
  if (radiusSpec) {
    radiusSpecifications.push(radiusSpec);
    evidenceTrail.push({
      rule: 'RADIUS_SPECIFICATION_DETECTED',
      matched_text: radiusSpec.raw_text,
      result: { radius_nm: radiusSpec.radius_nm, stated_value: radiusSpec.stated_value, unit: radiusSpec.stated_unit },
    });
  }

  // Pre-filter candidate detection for Tier 1G quarantine across the full text
  // Checks any pair of numbers that resemble coordinates but lack full or partial hemisphere indicators
  const candidateCoordRegex = /(?:(\d{1,3}(?:[-°\s]+\d{1,2}(?:[-'′\s]+\d{1,2}(?:\.\d+)?)?(?:\.\d+)?)[′'″"]?\s*([NS])?)[\s,]+(\d{1,3}(?:[-°\s]+\d{1,2}(?:[-'′\s]+\d{1,2}(?:\.\d+)?)?(?:\.\d+)?)[′'″"]?\s*([EW])?))/gi;
  let candidateMatch: RegExpExecArray | null;
  while ((candidateMatch = candidateCoordRegex.exec(sanitizedText)) !== null) {
    const candidateStr = candidateMatch[0];
    const parsedCandidate = parseSingleCoordinatePair(candidateStr, globalConvention);
    if (parsedCandidate.hemisphereAmbiguous) {
      const isSingleHemi = Boolean(options?.isSingleHemisphere);
      const defConv = options?.defaultHemisphereConvention;
      ambiguousPositions.push({
        raw_text: candidateStr,
        reason: parsedCandidate.defectReason || 'AMBIGUOUS_HEMISPHERE',
        has_lat_hem: Boolean(parsedCandidate.hasLatHem),
        has_lon_hem: Boolean(parsedCandidate.hasLonHem),
        // Suggested hemisphere ONLY populated if plugin explicitly declared a single-hemisphere convention
        suggested_lat_dir: isSingleHemi && defConv ? defConv.latDir : undefined,
        suggested_lon_dir: isSingleHemi && defConv ? defConv.lonDir : undefined,
      });
      evidenceTrail.push({
        rule: 'DEFECTIVE_HEMISPHERE_QUARANTINED',
        matched_text: candidateStr,
        result: {
          defect: parsedCandidate.defectReason,
          hasLatHem: parsedCandidate.hasLatHem,
          hasLonHem: parsedCandidate.hasLonHem,
        },
      });
    }
  }

  let hemisphereAmbiguousFound = ambiguousPositions.length > 0;

  // 1. Check for Multi-Area / Sector / Sub-Area / Rig Sub-blocks
  // Matches:
  // - (A), (B), (C)...
  // - AREA A, AREA 1, AREA ALFA, AREA BRAVO...
  // - SECTOR 1, SECTOR A, SECTOR ALFA...
  // - SUB-AREA 1, SUB-AREA A, ZONE 1, ZONE A...
  // - FIRING AREA 1, DANGER AREA A...
  // - Rig entries: "A. RIG_NAME ...", "1. RIG_NAME ..." or "RIG <name> ... IN <coords>"
  const subBlocks: { label: string; text: string; isRig?: boolean; statedRadius?: number }[] = [];

  // Match structured area/sector/sub-area/zone boundaries
  const subAreaHeaderRegex = /(?:^|\n|;\s+)(?:(?:(?:SUB-AREA|SUB\s+AREA|AREA|SECTOR|ZONE|FIRING\s+AREA|DANGER\s+AREA|DROP\s+ZONE)\s+([A-Z0-9]+|\([A-Z0-9]+\)|ALFA|BRAVO|CHARLIE|DELTA|ECHO|FOXTROT|GOLF|HOTEL|INDIA|JULIETT|KILO|LIMA|MIKE|NOVEMBER|OSCAR|PAPA|QUEBEC|ROMEO|SIERRA|TANGO|UNIFORM|VICTOR|WHISKEY|XRAY|YANKEE|ZULU)\b)|(?:\(([A-Z0-9]+)\))|(?:([A-Z0-9])\.\s+(?=[A-Z0-9'"])))/gi;

  const blockMatches: { label: string; index: number; fullMatch: string }[] = [];
  let headerMatch: RegExpExecArray | null;

  while ((headerMatch = subAreaHeaderRegex.exec(sanitizedText)) !== null) {
    const rawLabel = (headerMatch[1] || headerMatch[2] || headerMatch[3] || '').trim();
    if (rawLabel) {
      let cleanLabel = rawLabel;
      if (headerMatch[0].toUpperCase().includes('SECTOR')) cleanLabel = `Sector ${rawLabel}`;
      else if (headerMatch[0].toUpperCase().includes('SUB-AREA') || headerMatch[0].toUpperCase().includes('SUB AREA')) cleanLabel = `Sub-Area ${rawLabel}`;
      else if (headerMatch[0].toUpperCase().includes('ZONE')) cleanLabel = `Zone ${rawLabel}`;
      else if (headerMatch[0].toUpperCase().includes('FIRING')) cleanLabel = `Firing Area ${rawLabel}`;
      else cleanLabel = `Area ${rawLabel}`;

      blockMatches.push({
        label: cleanLabel,
        index: headerMatch.index,
        fullMatch: headerMatch[0],
      });
    }
  }

  // Also check if text is a RIGLIST or offshore rig warning with multiple rigs
  const isRigWarning = /\b(?:RIGLIST|RIG\s+LIST|DRILLING\s+RIGS?|MOBILE\s+OIL\s+RIGS?|MODU|DRILLSHIP)\b/i.test(upperText);
  if (isRigWarning && blockMatches.length < 2) {
    const rigLineRegex = /(?:^|\n)\s*(?:([A-Z0-9]+)\.\s+|NEW\s+)?([A-Z0-9 .&'-]+?)\s+(\d{1,3}[-°\s]+\d{1,2}(?:\.\d+)?[NS][\s,]+\d{1,3}[-°\s]+\d{1,2}(?:\.\d+)?[EW])/gi;
    let rigMatch: RegExpExecArray | null;
    while ((rigMatch = rigLineRegex.exec(sanitizedText)) !== null) {
      const rigName = (rigMatch[2] || 'Rig').replace(/^(?:RIG|MODU|DRILLSHIP)\s+/i, '').trim();
      if (rigName.length >= 3 && !/^(?:NAVAREA|NOTES?|CORRECT\s+AT)/i.test(rigName)) {
        subBlocks.push({
          label: `Rig: ${rigName}`,
          text: rigMatch[0],
          isRig: true,
          statedRadius: 0.27, // 500m safety exclusion zone
        });
      }
    }
  }

  if (blockMatches.length >= 2) {
    for (let i = 0; i < blockMatches.length; i++) {
      const curr = blockMatches[i];
      const start = curr.index;
      const end = i + 1 < blockMatches.length ? blockMatches[i + 1].index : sanitizedText.length;
      const textChunk = sanitizedText.slice(start, end).trim();
      subBlocks.push({
        label: curr.label,
        text: textChunk,
      });
    }
  }

  if (subBlocks.length > 0) {
    evidenceTrail.push({ rule: 'MULTI_AREA_SUB_BLOCKS_DETECTED', matched_text: `Found ${subBlocks.length} distinct sub-areas / sectors / rigs` });
    
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

      // Check for block-specific radius or safety clearance
      const blockRadiusMatch = block.text.match(/(?:WITHIN|RADIUS(?:\s+OF)?|CLEARANCE(?:\s+OF)?|SAFETY\s+ZONE(?:\s+OF)?)\s+(\d+(?:\.\d+)?)\s*(NM|NAUTICAL\s+MILES?|METERS?|M\b)?/i);
      let blockRadius = block.statedRadius || 0;
      if (blockRadiusMatch) {
        const val = parseFloat(blockRadiusMatch[1]);
        const unit = (blockRadiusMatch[2] || '').toUpperCase();
        blockRadius = /METERS?|M\b/.test(unit) ? val / 1852 : val;
      } else if (block.isRig || /\b(?:RIG|MODU|DRILLSHIP|PLATFORM)\b/i.test(block.text)) {
        blockRadius = 0.27; // 500m
      }

      // Case 1: Polygon Area (3+ coordinates)
      if (groupCoords.length >= 3) {
        const polyCoords = [...groupCoords];
        const first = polyCoords[0];
        const last = polyCoords[polyCoords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          polyCoords.push(first); // Close explicitly
        }

        const groupId = `group-${block.label.replace(/\s+/g, '-')}-${Math.random().toString(36).substr(2, 6)}`;
        spatialGroups.push({
          group_id: groupId,
          group_label: block.label,
          coordinates: polyCoords,
          relationship: 'BOUNDED_BY',
          roles: groupRoles,
          sequence: polyCoords.map((_, i) => i + 1),
          evidence: [{ rule: 'SUB_BLOCK_POLYGON', matched_text: block.label }],
        });

        geometries.push({
          type: 'Polygon',
          semantic_type: 'POLYGON',
          coordinates: [polyCoords],
          label: block.label,
          inference_mode: 'EXPLICIT',
          confidence_level: 'VERIFIED',
          spatial_group_id: groupId,
          group_label: block.label,
          evidence: [{ rule: 'STRONG_POLYGON_INDICATOR', matched_text: block.label }],
        });
      }
      // Case 2: Circle / Point with Radius
      else if (groupCoords.length >= 1 && blockRadius > 0) {
        const center = groupCoords[0];
        circles.push({
          center,
          radius_nm: blockRadius,
          label: `${block.label} (${blockRadius >= 1 ? blockRadius.toFixed(1) : (blockRadius * 1852).toFixed(0) + 'm'} Safety Zone)`,
        });
        geometries.push({
          type: 'Circle',
          semantic_type: 'POINT_WITH_RADIUS',
          coordinates: center,
          radius_nm: blockRadius,
          label: `${block.label} (${blockRadius >= 1 ? blockRadius.toFixed(1) + ' NM' : (blockRadius * 1852).toFixed(0) + 'm'})`,
          inference_mode: 'EXPLICIT',
          confidence_level: 'VERIFIED',
          evidence: [{ rule: 'EXPLICIT_RADIUS_STATEMENT', matched_text: block.text.slice(0, 50) }],
        });
        // Also add center point for clear marker/pin representation
        geometries.push({
          type: 'Point',
          semantic_type: 'POINT',
          coordinates: center,
          label: block.label,
          inference_mode: 'EXPLICIT',
          confidence_level: 'VERIFIED',
          evidence: [{ rule: 'SUB_BLOCK_CENTER_POINT', matched_text: block.label }],
        });
      }
      // Case 3: Line / Corridor
      else if (groupCoords.length >= 2 && /(?:LINE|TRACK|ROUTE|CABLE|PIPELINE|JOINING)/i.test(block.text)) {
        geometries.push({
          type: 'LineString',
          semantic_type: 'LINE',
          coordinates: groupCoords,
          label: block.label,
          inference_mode: 'EXPLICIT',
          confidence_level: 'VERIFIED',
          evidence: [{ rule: 'SUB_BLOCK_LINE', matched_text: block.label }],
        });
      }
      // Case 4: Single Point Hazard
      else if (groupCoords.length >= 1) {
        geometries.push({
          type: 'Point',
          semantic_type: 'POINT',
          coordinates: groupCoords[0],
          label: block.label,
          inference_mode: 'EXPLICIT',
          confidence_level: 'VERIFIED',
          evidence: [{ rule: 'SUB_BLOCK_POINT', matched_text: block.label }],
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

    // D. Extract All Standard Coordinate Pairs (DMS, DDM, DD, with hyphens or symbols)
    const globalCoordPattern = /(?:(?:(\d{1,2}(?:\.\d+)?)\s*°?\s*([NS])[\s,]+(\d{1,3}(?:\.\d+)?)\s*°?\s*([EW]))|(?:(\d{1,2})[-°\s]+(\d{1,2})[-'′\s]+(\d{1,2}(?:\.\d+)?)\s*["″]?\s*([NS])[\s,]+(\d{1,3})[-°\s]+(\d{1,2})[-'′\s]+(\d{1,2}(?:\.\d+)?)\s*["″]?\s*([EW]))|(?:(\d{1,2})[-°\s]+(\d{1,2}(?:\.\d+)?)\s*([NS])[\s,]+(\d{1,3})[-°\s]+(\d{1,2}(?:\.\d+)?)\s*([EW])))/gi;
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

    // Check for trailing radius statements or parsed radius normalisation (broadened pattern)
    const activeRadius = radiusSpec ? radiusSpec.radius_nm : undefined;

    if (activeRadius !== undefined && circles.length === 0 && uniquePoints.length > 0) {
      const centerPoint = uniquePoints[0].lngLat;
      circles.push({
        center: centerPoint,
        radius_nm: activeRadius,
        label: `Danger Zone (${activeRadius} NM Radius)`,
      });
      geometries.push({
        type: 'Circle',
        semantic_type: 'POINT_WITH_RADIUS',
        coordinates: centerPoint,
        radius_nm: activeRadius,
        label: `${activeRadius} NM Radius Area`,
        inference_mode: 'EXPLICIT',
        confidence_level: 'VERIFIED',
        evidence: [
          {
            rule: 'RADIUS_SPECIFICATION_APPLIED',
            matched_text: radiusSpec ? radiusSpec.raw_text : '',
          },
        ],
      });
      rawCoordinateText.push(radiusSpec ? radiusSpec.raw_text : '');
    }

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
        const effectiveCorridorNm = corridorWidth !== undefined ? corridorWidth : 1.0; // Rule 74: 1.0 NM default
        const corridorHalfWidthM = effectiveCorridorNm * 1852.0; // Rule 58 & 75
        const geomType = 'LINE_WITH_WIDTH';
        const groupId = `group-line-${Math.random().toString(36).substr(2, 6)}`;
        spatialGroups.push({
          group_id: groupId,
          coordinates: rawCoordsOnly,
          relationship: 'JOINING',
          roles: uniquePoints.map(p => p.role),
          sequence: rawCoordsOnly.map((_, i) => i + 1),
          evidence: [{ rule: corridorWidth !== undefined ? 'LINE_WIDTH_CORRIDOR_RULE' : 'CORRIDOR_DEFAULT_1NM_RULE', matched_text: corridorWidth !== undefined ? 'X NM EITHER SIDE' : 'IN VICINITY OF LINE JOINING' }],
        });
        geometries.push({
          type: 'LineString',
          semantic_type: geomType as SemanticGeometryType,
          coordinates: rawCoordsOnly,
          label: corridorWidth !== undefined ? `Corridor (${corridorWidth} NM Stated)` : 'Corridor (1.0 NM Default)',
          inference_mode: corridorWidth !== undefined ? 'EXPLICIT' : 'INFERRED',
          confidence_level: corridorWidth !== undefined ? 'HIGH_CONFIDENCE' : 'PARTIAL',
          offset_each_side_nm: effectiveCorridorNm,
          spatial_group_id: groupId,
          evidence: [{ rule: corridorWidth !== undefined ? 'EXPLICIT_LINE_INDICATOR' : 'CORRIDOR_DEFAULT_1NM_RULE' }],
        });
      } else if (rawCoordsOnly.length === 1 && activeRadius === undefined) {
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
      } else if (rawCoordsOnly.length > 1 && activeRadius === undefined) {
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

  // DUAL-LAYER SAFETY NET: LAYER 1 (Coordinate Parser)
  // If ambiguous or partial hemisphere defects exist without convention, mark for review
  // but preserve parsed geometries to allow rendering with appropriate warnings
  if (ambiguousPositions.length > 0 || hemisphereAmbiguousFound) {
    escalationTriggers.push('AMBIGUOUS_HEMISPHERE');
    // Note: We no longer wipe geometries here - instead we mark data_quality
    // and let downstream consumers decide how to handle ambiguous data
  }

  if (geometries.length === 0 && /\d{1,3}/.test(sanitizedText) && ambiguousPositions.length === 0) {
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

  if (hemisphereAmbiguousFound || ambiguousPositions.length > 0) {
    coordinateValidity = 'INVALID';
    geometryValidation = 'INVALID';
    // Keep validation_status as 'passed' if we have geometries, but mark data_quality as AMBIGUOUS
    // This allows rendering with appropriate warnings rather than silently dropping
    if (geometries.length === 0 && circles.length === 0) {
      validation_status = 'invalid_format';
    }
  }

  // DATA QUALITY WORST-OF ROLL-UP:
  // Priority hierarchy: INVALID > AMBIGUOUS > INFERRED > EXPLICIT
  let rolledUpQuality: DataQualityRating = 'EXPLICIT';
  if (validation_status === 'out_of_bounds' || coordinateValidity === 'INVALID' || geometryValidation === 'INVALID') {
    rolledUpQuality = (ambiguousPositions.length > 0 || hemisphereAmbiguousFound) ? 'AMBIGUOUS' : 'INVALID';
  } else if (ambiguousPositions.length > 0 || hemisphereAmbiguousFound) {
    rolledUpQuality = 'AMBIGUOUS';
  } else if (globalConvention !== null || geometries.some(g => g.inference_mode === 'INFERRED')) {
    rolledUpQuality = 'INFERRED';
  } else {
    rolledUpQuality = 'EXPLICIT';
  }

  // Tag feature-level data_quality on every geometry
  geometries.forEach((g) => {
    g.data_quality = rolledUpQuality;
  });

  return {
    geometries,
    circles,
    spatial_groups: spatialGroups,
    raw_coordinate_text: Array.from(new Set(rawCoordinateText)),
    validation_status,
    hemisphere_status: (hemisphereAmbiguousFound || ambiguousPositions.length > 0) ? 'AMBIGUOUS_HEMISPHERE' : 'EXPLICIT',
    navarea_relation: navareaRelation,
    coordinate_validity: coordinateValidity,
    geometry_validation: geometryValidation,
    escalation_triggers: escalationTriggers,
    review_required: escalationTriggers.length > 0 || ambiguousPositions.length > 0,
    data_quality: rolledUpQuality,
    ambiguous_positions: ambiguousPositions,
    radius_specifications: radiusSpecifications,
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

function calculatePolygonCentroid(coords: number[][][] | number[][]): [number, number] {
  // Calculate centroid of a polygon (first ring only if multi-ring)
  // coords can be Polygon ([[ring]]), MultiPolygon ([[ring1], [ring2]]), or just a ring
  let ring: number[][];
  if (Array.isArray(coords) && coords.length > 0) {
    const first = coords[0];
    if (Array.isArray(first) && first.length > 0 && Array.isArray(first[0])) {
      ring = first as number[][];
    } else {
      ring = coords as number[][];
    }
  } else {
    ring = coords as number[][];
  }
  
  if (!Array.isArray(ring) || ring.length === 0) return [0, 0];
  
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  
  for (const pt of ring) {
    if (Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
      sumLng += pt[0];
      sumLat += pt[1];
      count++;
    }
  }
  
  if (count === 0) return [0, 0];
  return [sumLat / count, sumLng / count];
}

function calculateLineMidpoint(coords: number[][]): [number, number] {
  // Calculate midpoint of a line
  if (!Array.isArray(coords) || coords.length === 0) return [0, 0];
  if (coords.length === 1) {
    const pt = coords[0];
    if (Array.isArray(pt) && pt.length >= 2) {
      return [pt[1] as number, pt[0] as number];
    }
    return [0, 0];
  }
  
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (Array.isArray(first) && first.length >= 2 && Array.isArray(last) && last.length >= 2) {
    return [(first[1] as number + last[1] as number) / 2, (first[0] as number + last[0] as number) / 2];
  }
  return [0, 0];
}

export function getLeafletLatLng(
  spatial: SpatialData | undefined | null,
  directLat?: number | null,
  directLng?: number | null
): [number, number] {
  // Priority: direct lat/lng > circles > polygons > lines > first point
  
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
  
  // Don't return [0,0] just because data_quality is AMBIGUOUS - we still want to show the geometry
  // The data_quality flag is for UI display purposes, not for preventing rendering
  if (spatial.data_quality === 'INVALID') {
    return [0, 0];
  }
  
  // Circles: return center
  if (spatial.circles && spatial.circles.length > 0) {
    for (const c of spatial.circles) {
      if (Array.isArray(c.center) && c.center.length >= 2 && typeof c.center[0] === 'number' && typeof c.center[1] === 'number') {
        return [c.center[1], c.center[0]];
      }
    }
  }
  
  // Geometries: prefer polygons, then lines, then points
  if (spatial.geometries && spatial.geometries.length > 0) {
    // Find first valid polygon and return its centroid
    for (const g of spatial.geometries) {
      if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
        const coords = g.coordinates as number[][][] | number[][];
        const centroid = calculatePolygonCentroid(coords);
        if (centroid[0] !== 0 || centroid[1] !== 0) {
          return centroid;
        }
      }
    }
    
    // Find first valid line and return its midpoint
    for (const g of spatial.geometries) {
      if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
        const coords = g.coordinates as number[][];
        const midpoint = calculateLineMidpoint(coords);
        if (midpoint[0] !== 0 || midpoint[1] !== 0) {
          return midpoint;
        }
      }
    }
    
    // Fall back to first point from any geometry
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


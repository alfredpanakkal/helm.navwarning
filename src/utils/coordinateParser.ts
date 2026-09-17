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
 * Parses coordinate pair strings like:
 * - "69° 37.437'N 135° 29.262'W"
 * - "69Â° 37.437'N 135Â° 29.262'W"
 * - "55-14.2N 003-45.1E"
 * - "69-37N 135-29W"
 * - "71 21.06N 096 53.90W"
 * - "64° 09.017'N 083° 22.367'W (Coral Harbour)"
 * - "13.70, 69.84"
 */
export function parseSingleCoordinatePair(text: string): [number, number] | null {
  if (!text || typeof text !== 'string') return null;

  // Clean noise, artifacts, and encoding issues
  const clean = text
    .replace(/Â°/g, '°')
    .replace(/&deg;/g, '°')
    .replace(/\bPt\s*\d+:\s*/gi, '')
    .replace(/\([^\)]+\)/g, '')
    .trim();

  // Regex 1: DD° MM.MMM' [NS] DDD° MM.MMM' [EW] or DD-MM.MM [NS] or DD MM.MM [NS] with optional seconds
  const pattern1 = /(\d{1,3})(?:[°\s\-]|Â°)+(\d{1,2}(?:\.\d+)?)['′"]?\s*(?:(\d{1,2}(?:\.\d+)?)\s*["″]\s*)?([NS])[\s,]+(?:\bPt\s*\d+:\s*)?(\d{1,3})(?:[°\s\-]|Â°)+(\d{1,2}(?:\.\d+)?)['′"]?\s*(?:(\d{1,2}(?:\.\d+)?)\s*["″]\s*)?([EW])/i;
  const match1 = clean.match(pattern1);
  if (match1) {
    const latDeg = parseFloat(match1[1]);
    const latMin = parseFloat(match1[2]);
    const latSec = match1[3] ? parseFloat(match1[3]) : 0;
    const latDir = match1[4].toUpperCase();
    const lngDeg = parseFloat(match1[5]);
    const lngMin = parseFloat(match1[6]);
    const lngSec = match1[7] ? parseFloat(match1[7]) : 0;
    const lngDir = match1[8].toUpperCase();

    const lat = dmsToDecimal(latDeg, latMin, latSec, latDir);
    const lng = dmsToDecimal(lngDeg, lngMin, lngSec, lngDir);
    return [lng, lat];
  }

  // Regex 2: Pure decimal degrees: e.g. "69.62395, -135.48770" or "69.62395 N, 135.48770 W"
  const patternDec = /(-?\d{1,3}\.\d+)\s*°?\s*([NS])?[\s,]+(-?\d{1,3}\.\d+)\s*°?\s*([EW])?/i;
  const matchDec = clean.match(patternDec);
  if (matchDec) {
    let lat = parseFloat(matchDec[1]);
    if (matchDec[2]?.toUpperCase() === 'S') lat = -Math.abs(lat);
    let lng = parseFloat(matchDec[3]);
    if (matchDec[4]?.toUpperCase() === 'W') lng = -Math.abs(lng);
    return [Number(lng.toFixed(5)), Number(lat.toFixed(5))];
  }

  // Regex 3: DD MM N, DDD MM E (without minutes decimals)
  const pattern3 = /(\d{1,2})\s+(\d{1,2})\s+([NS])[\s,]+(\d{1,3})\s+(\d{1,2})\s+([EW])/i;
  const match3 = clean.match(pattern3);
  if (match3) {
    const lat = dmsToDecimal(parseFloat(match3[1]), parseFloat(match3[2]), 0, match3[3].toUpperCase());
    const lng = dmsToDecimal(parseFloat(match3[4]), parseFloat(match3[5]), 0, match3[6].toUpperCase());
    return [lng, lat];
  }

  return null;
}

/**
 * Extract circles, points, and polygons deterministically from warning text
 */
export function parseCoordinatesDeterministic(rawText: string, navarea?: NavAreaId): SpatialData {
  const geometries: SpatialGeometry[] = [];
  const circles: SpatialCircle[] = [];
  const rawCoordinateText: string[] = [];

  if (!rawText || typeof rawText !== 'string') {
    return {
      geometries: [],
      circles: [],
      raw_coordinate_text: [],
      validation_status: 'not_present',
    };
  }

  // Normalize text for encoding glitches (Â° -> °)
  const sanitizedText = rawText.replace(/Â°/g, '°').replace(/&deg;/g, '°');

  // Check for circle pattern: e.g. "within 5 NM of 55-14.2N 003-45.1E" or "RADIUS 10NM CENTRED ON 24-15N 068-30E"
  const circlePattern = /(?:WITHIN|RADIUS)\s+(\d+(?:\.\d+)?)\s*(?:NM|NAUTICAL MILES)?\s*(?:OF|CENTRED ON|CENTERED ON)\s+([0-9\-\.°\s'″NS]+[EW])/gi;
  let circleMatch;
  while ((circleMatch = circlePattern.exec(sanitizedText)) !== null) {
    const radius = parseFloat(circleMatch[1]);
    const coordStr = circleMatch[2];
    const pt = parseSingleCoordinatePair(coordStr);
    if (pt) {
      circles.push({
        center: pt,
        radius_nm: radius,
        label: `Danger Zone (${radius} NM Radius)`,
      });
      geometries.push({
        type: 'Circle',
        coordinates: pt,
        radius_nm: radius,
        label: `${radius} NM Radius Area`,
      });
      rawCoordinateText.push(circleMatch[0]);
    }
  }

  // Extract all coordinate pairs found in the text (supporting DD° MM.MMM' [NS] DDD° MM.MMM' [EW] with any delimiters)
  const globalCoordPattern = /(\d{1,3}(?:[°\s\-]|Â°)+\d{1,2}(?:\.\d+)?['′"]?\s*(?:(\d{1,2}(?:\.\d+)?)\s*["″]\s*)?[NS][\s,]+(?:\bPt\s*\d+:\s*)?\d{1,3}(?:[°\s\-]|Â°)+\d{1,2}(?:\.\d+)?['′"]?\s*(?:(\d{1,2}(?:\.\d+)?)\s*["″]\s*)?[EW])/gi;
  const allPairMatches = sanitizedText.match(globalCoordPattern) || [];
  const parsedPoints: [number, number][] = [];

  for (const matchStr of allPairMatches) {
    const pt = parseSingleCoordinatePair(matchStr);
    if (pt) {
      parsedPoints.push(pt);
      rawCoordinateText.push(matchStr);
    }
  }

  // Also check decimal degree pairs if no degree-minute matches were found
  if (parsedPoints.length === 0) {
    const decimalPattern = /(\b\d{1,2}\.\d+°?\s*[NS][\s,]+\d{1,3}\.\d+°?\s*[EW]\b)/gi;
    const decMatches = sanitizedText.match(decimalPattern) || [];
    for (const matchStr of decMatches) {
      const pt = parseSingleCoordinatePair(matchStr);
      if (pt) {
        parsedPoints.push(pt);
        rawCoordinateText.push(matchStr);
      }
    }
  }

  // Deduplicate points with precision tolerance (approx ~10 meters)
  const uniquePoints: [number, number][] = [];
  parsedPoints.forEach((pt) => {
    if (!uniquePoints.some((u) => Math.abs(u[0] - pt[0]) < 0.0005 && Math.abs(u[1] - pt[1]) < 0.0005)) {
      uniquePoints.push(pt);
    }
  });

  // If 3 or more points and text hints at area/polygon
  const isPolygonText = /BOUNDED BY|AREA BOUNDED|JOINING|IN AREA|LINE CONNECTING|POLYGON|HAZARD AREA|FALLOUT/i.test(sanitizedText);
  if (uniquePoints.length >= 3 && isPolygonText) {
    // Close polygon if not closed
    const polyCoords = [...uniquePoints];
    const first = polyCoords[0];
    const last = polyCoords[polyCoords.length - 1];
    if (Math.abs(first[0] - last[0]) > 0.001 || Math.abs(first[1] - last[1]) > 0.001) {
      polyCoords.push(first);
    }
    geometries.push({
      type: 'Polygon',
      coordinates: [polyCoords],
      label: 'Affected Maritime Area',
    });
  } else if (uniquePoints.length === 2 && /LINE|TRACK|CABLE|PIPE/i.test(sanitizedText)) {
    geometries.push({
      type: 'LineString',
      coordinates: uniquePoints,
      label: 'Maritime Line / Track',
    });
  } else {
    // Treat remaining individual points as Point geometries
    uniquePoints.forEach((pt, idx) => {
      // Don't add if already part of a circle center
      if (!circles.some((c) => Math.abs(c.center[0] - pt[0]) < 0.0001 && Math.abs(c.center[1] - pt[1]) < 0.0001)) {
        geometries.push({
          type: 'Point',
          coordinates: pt,
          label: uniquePoints.length === 1 ? 'Reported Hazard Position' : `Position #${idx + 1}`,
        });
      }
    });
  }

  // Validate bounds if NAVAREA provided
  let validation_status: SpatialData['validation_status'] = 'not_present';
  if (geometries.length > 0 || circles.length > 0) {
    validation_status = 'passed';
    if (navarea && NAVAREA_BOUNDS[navarea]) {
      const bounds = NAVAREA_BOUNDS[navarea];
      const allPts: [number, number][] = [];
      circles.forEach((c) => allPts.push(c.center));
      geometries.forEach((g) => {
        if (g.type === 'Point') allPts.push(g.coordinates as [number, number]);
        if (g.type === 'LineString') (g.coordinates as [number, number][]).forEach((p) => allPts.push(p));
        if (g.type === 'Polygon') (g.coordinates as [number, number][][])[0].forEach((p) => allPts.push(p));
      });

      const outOfBounds = allPts.some(
        ([lng, lat]) => lat < bounds.minLat || lat > bounds.maxLat || lng < bounds.minLng || lng > bounds.maxLng
      );
      if (outOfBounds) {
        validation_status = 'out_of_bounds';
      }
    }
  }

  return {
    geometries,
    circles,
    raw_coordinate_text: Array.from(new Set(rawCoordinateText)),
    validation_status,
  };
}

/**
 * Safely find the first [lng, lat] point from any geometry coordinates array structure,
 * handling Point [lng, lat], LineString [[lng, lat], ...], Polygon [[[lng, lat], ...]], etc.
 */
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

/**
 * Safely formats spatial data coordinates into a human readable "lng, lat" string.
 */
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

/**
 * Safely extracts [lat, lng] for Leaflet map markers.
 */
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

/**
 * Checks if a [lat, lng] point lies within the declared NAVAREA boundary (with 0.5° buffer).
 */

export function isPointInNavArea(
  lat: number,
  lng: number,
  navarea: NavAreaId | string | null,
  bufferDeg = 0.5
): boolean {
  if (!navarea || !NAVAREA_BOUNDS[navarea as NavAreaId]) return true; // Default fallback if NAVAREA unlisted
  const b = NAVAREA_BOUNDS[navarea as NavAreaId];

  const minLat = b.minLat - bufferDeg;
  const maxLat = b.maxLat + bufferDeg;
  let minLng = b.minLng - bufferDeg;
  let maxLng = b.maxLng + bufferDeg;

  if (lat < minLat || lat > maxLat) return false;

  // Handle Pacific / Anti-Meridian wraparound (e.g., minLng > maxLng)
  if (minLng > maxLng) {
    return lng >= minLng || lng <= maxLng;
  }
  return lng >= minLng && lng <= maxLng;
}

/**
 * Executes WWNWS 4-Way Inference Test for unsigned coordinate pairs.
 */
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

  // Zero or >1 matches: Never guess silently!
  return {
    coords: [0, 0],
    inference: 'explicit',
    confidence: 'rejected',
    errors: ['COORD_UNSIGNED_AMBIGUOUS'],
  };
}

/**
 * Classifies Geometry Intent based on source text language.
 */
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

/**
 * Main NAVWARN Extraction Engine:
 * Converts raw navigational warning text into an IMO ECDIS-Ready Intermediate Layer GeoJSON FeatureCollection.
 */
export function extractEcdisIntermediateLayer(
  warningId: string,
  navarea: NavAreaId | string | null,
  rawText: string
): EcdisIntermediateLayer {
  const features: EcdisPointFeature[] = [];
  let isRangedArea = false;

  // 1. Ranged Bounds Extractor (e.g. LAT 55-10N TO 55-20N, LON 003-10E TO 003-40E)
  const rangePattern = /LAT(?:ITUDE)?S?\s*(\d{1,2})[-°\s](\d{1,2}(?:\.\d+)?)\s*([NS])?\s*(?:TO|AND|-|\s+)\s*(\d{1,2})[-°\s](\d{1,2}(?:\.\d+)?)\s*([NS])?[\s,]+LON(?:GITUDE)?S?\s*(\d{1,3})[-°\s](\d{1,2}(?:\.\d+)?)\s*([EW])?\s*(?:TO|AND|-|\s+)\s*(\d{1,3})[-°\s](\d{1,2}(?:\.\d+)?)\s*([EW])?/i;
  const rangeMatch = rawText.match(rangePattern);

  if (rangeMatch) {
    isRangedArea = true;
    const lat1Deg = parseFloat(rangeMatch[1]);
    const lat1Min = parseFloat(rangeMatch[2]);
    const lat1Dir = (rangeMatch[3] || 'N').toUpperCase();

    const lat2Deg = parseFloat(rangeMatch[4]);
    const lat2Min = parseFloat(rangeMatch[5]);
    const lat2Dir = (rangeMatch[6] || lat1Dir).toUpperCase();

    const lon1Deg = parseFloat(rangeMatch[7]);
    const lon1Min = parseFloat(rangeMatch[8]);
    const lon1Dir = (rangeMatch[9] || 'E').toUpperCase();

    const lon2Deg = parseFloat(rangeMatch[10]);
    const lon2Min = parseFloat(rangeMatch[11]);
    const lon2Dir = (rangeMatch[12] || lon1Dir).toUpperCase();

    const lat1 = dmsToDecimal(lat1Deg, lat1Min, 0, lat1Dir);
    const lat2 = dmsToDecimal(lat2Deg, lat2Min, 0, lat2Dir);
    const lon1 = dmsToDecimal(lon1Deg, lon1Min, 0, lon1Dir);
    const lon2 = dmsToDecimal(lon2Deg, lon2Min, 0, lon2Dir);

    // Create 4 corner Point features in clockwise sequence
    const corners: [number, number][] = [
      [lon1, lat1],
      [lon2, lat1],
      [lon2, lat2],
      [lon1, lat2],
    ];

    corners.forEach((coord, idx) => {
      const isInside = isPointInNavArea(coord[1], coord[0], navarea);
      features.push({
        type: 'Feature',
        id: `feat-${warningId}-corner-${idx + 1}-${Math.random().toString(36).substr(2, 6)}`,
        geometry: {
          type: 'Point',
          coordinates: coord,
        },
        properties: {
          sequence_index: idx + 1,
          raw_text: rangeMatch[0],
          inference: 'explicit',
          confidence: isInside ? 'verified' : 'partial',
          modification_state: 'original',
          user_notes: '',
          errors: isInside ? [] : ['COORD_OUTSIDE_NAVAREA'],
          role_hint: 'vertex',
        },
      });
    });
  } else {
    // 2. Standard Point Extractor
    // Global regex matching coordinate pairs with or without direction letters
    const coordPairRegex = /(?:LAT|LATITUDE|POSITION|POS)?\s*(\d{1,3})[-°\s](\d{1,2}(?:\.\d+)?)['′"]?\s*([NS])?[\s,]+(?:LON|LONGITUDE)?\s*(\d{1,3})[-°\s](\d{1,2}(?:\.\d+)?)['′"]?\s*([EW])?/gi;

    let match: RegExpExecArray | null;
    let sequenceIndex = 1;

    while ((match = coordPairRegex.exec(rawText)) !== null) {
      const rawSnippet = match[0];
      const latDeg = parseFloat(match[1]);
      const latMin = parseFloat(match[2]);
      const latDir = match[3] ? match[3].toUpperCase() : null;

      const lonDeg = parseFloat(match[4]);
      const lonMin = parseFloat(match[5]);
      const lonDir = match[6] ? match[6].toUpperCase() : null;

      // Mathematical Limits Validation
      if (latDeg > 90 || lonDeg > 180 || latMin >= 60 || lonMin >= 60) {
        features.push({
          type: 'Feature',
          id: `feat-${warningId}-${sequenceIndex}-${Math.random().toString(36).substr(2, 6)}`,
          geometry: {
            type: 'Point',
            coordinates: [0, 0],
          },
          properties: {
            sequence_index: sequenceIndex++,
            raw_text: rawSnippet,
            inference: 'explicit',
            confidence: 'rejected',
            modification_state: 'original',
            user_notes: '',
            errors: ['COORD_MALFORMED'],
            role_hint: null,
          },
        });
        continue;
      }

      let coords: [number, number];
      let inference: FeatureInference = 'explicit';
      let confidence: FeatureConfidence = 'verified';
      let errors: string[] = [];

      if (latDir && lonDir) {
        // Explicit N/S/E/W
        const lat = dmsToDecimal(latDeg, latMin, 0, latDir);
        const lng = dmsToDecimal(lonDeg, lonMin, 0, lonDir);
        coords = [lng, lat];

        const isInside = isPointInNavArea(lat, lng, navarea);
        if (!isInside) {
          confidence = 'partial';
          errors.push('COORD_OUTSIDE_NAVAREA');
        }
      } else {
        // Unsigned Coordinate Pair -> Execute 4-Way Inference Test
        const testRes = testFourWayInference(
          latDeg + latMin / 60,
          lonDeg + lonMin / 60,
          navarea
        );
        coords = testRes.coords;
        inference = testRes.inference;
        confidence = testRes.confidence;
        errors = testRes.errors;
      }

      features.push({
        type: 'Feature',
        id: `feat-${warningId}-${sequenceIndex}-${Math.random().toString(36).substr(2, 6)}`,
        geometry: {
          type: 'Point',
          coordinates: coords,
        },
        properties: {
          sequence_index: sequenceIndex++,
          raw_text: rawSnippet,
          inference,
          confidence,
          modification_state: 'original',
          user_notes: '',
          errors,
          role_hint: null,
        },
      });
    }
  }

  // Deduplicate identical points if standard parsing produced identical pairs
  const uniqueFeatures: EcdisPointFeature[] = [];
  features.forEach((feat, idx) => {
    feat.properties.sequence_index = idx + 1;
    uniqueFeatures.push(feat);
  });

  const intent = classifyGeometryIntent(rawText, uniqueFeatures.length, isRangedArea);

  // Set role_hints if intent is route or area
  if (intent === 'route' && uniqueFeatures.length >= 2) {
    uniqueFeatures.forEach((f, idx) => {
      if (idx === 0) f.properties.role_hint = 'start';
      else if (idx === uniqueFeatures.length - 1) f.properties.role_hint = 'end';
      else f.properties.role_hint = 'intermediate';
    });
  } else if (intent === 'area') {
    uniqueFeatures.forEach(f => {
      f.properties.role_hint = 'vertex';
    });
  }

  return {
    warningId,
    navarea: navarea || null,
    editable: true,
    geometry_intent: intent,
    features: uniqueFeatures,
  };
}

/**
 * Executes deterministic coordinate parsing with a confidence check.
 * If regex finds 0 coordinates/geometries in a non-empty text payload (>100 chars),
 * flags the result for LLM auto-escalation.
 */
export function parseWithFallback(rawText: string, navarea: NavAreaId | string) {
  const regexResult = parseCoordinatesDeterministic(rawText, navarea as NavAreaId);

  // Confidence check: did regex find anything plausible?
  const looksIncomplete =
    regexResult.geometries.length === 0 &&
    regexResult.circles.length === 0 &&
    rawText.trim().length > 100;

  if (looksIncomplete) {
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



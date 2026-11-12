// src/core/coordinates.ts
// Maritime Spatial Geodesic Engine for S-124 / NAVAREA warnings

import {
  ClearanceDirective,
  CorridorGeometry,
  DriftVector,
  GeodesicMeasurement,
} from '../types/maritime';

// WGS84 Mean Earth Radius in Nautical Miles (1 NM = 1852 metres, R = 6371008.8m / 1852m)
export const EARTH_RADIUS_NM = 3440.065;
export const METRES_PER_NM = 1852;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Computes great-circle nautical distance between two points [lat, lng] in Nautical Miles (NM)
 * using the Haversine formula.
 */
export function computeDistanceNm(
  p1: [number, number],
  p2: [number, number]
): number {
  const [lat1, lng1] = p1;
  const [lat2, lng2] = p2;

  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const deltaPhi = (lat2 - lat1) * DEG_TO_RAD;
  const deltaLambda = (lng2 - lng1) * DEG_TO_RAD;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return Number((EARTH_RADIUS_NM * c).toFixed(2));
}

/**
 * Computes initial bearing in degrees (0..360) from p1 to p2.
 */
export function computeBearingDeg(
  p1: [number, number],
  p2: [number, number]
): number {
  const [lat1, lng1] = p1;
  const [lat2, lng2] = p2;

  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const deltaLambda = (lng2 - lng1) * DEG_TO_RAD;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return Number(((theta * RAD_TO_DEG + 360) % 360).toFixed(1));
}

/**
 * Computes destination point given start point, bearing in degrees, and distance in Nautical Miles.
 */
export function computeDestinationPoint(
  start: [number, number],
  bearingDeg: number,
  distanceNm: number
): [number, number] {
  if (
    !start ||
    !Number.isFinite(start[0]) ||
    !Number.isFinite(start[1]) ||
    !Number.isFinite(bearingDeg) ||
    !Number.isFinite(distanceNm)
  ) {
    return [0, 0];
  }

  const [lat1, lng1] = start;
  const delta = distanceNm / EARTH_RADIUS_NM;
  const theta = bearingDeg * DEG_TO_RAD;

  const phi1 = lat1 * DEG_TO_RAD;
  const lambda1 = lng1 * DEG_TO_RAD;

  const sinPhi2 =
    Math.sin(phi1) * Math.cos(delta) +
    Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
  const clampedSin = Math.max(-1, Math.min(1, sinPhi2));
  const phi2 = Math.asin(clampedSin);

  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );

  return [
    Number((phi2 * RAD_TO_DEG).toFixed(5)),
    Number((((lambda2 * RAD_TO_DEG + 540) % 360) - 180).toFixed(5)),
  ];
}

/**
 * Calculates the geodesic surface area of a closed polygon in square Nautical Miles (sq NM)
 * accounting for spherical latitude distortion.
 */
export function computePolygonAreaSqNm(coords: [number, number][]): number {
  if (!coords || coords.length < 3) return 0;

  // Clean ring: remove duplicate closure point if present for spherical sum
  const ring = [...coords];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (
    ring.length > 3 &&
    Math.abs(first[0] - last[0]) < 1e-6 &&
    Math.abs(first[1] - last[1]) < 1e-6
  ) {
    ring.pop();
  }

  if (ring.length < 3) return 0;

  let totalExcess = 0;
  const n = ring.length;

  for (let i = 0; i < n; i++) {
    const [lat1, lng1] = ring[i];
    const [lat2, lng2] = ring[(i + 1) % n];

    const lambda1 = lng1 * DEG_TO_RAD;
    const lambda2 = lng2 * DEG_TO_RAD;
    const phi1 = lat1 * DEG_TO_RAD;
    const phi2 = lat2 * DEG_TO_RAD;

    totalExcess += (lambda2 - lambda1) * (2 + Math.sin(phi1) + Math.sin(phi2));
  }

  const area = (Math.abs(totalExcess) * EARTH_RADIUS_NM * EARTH_RADIUS_NM) / 2;
  return Number(area.toFixed(2));
}

/**
 * Calculates the geometric centroid [lat, lng] of a collection of coordinates.
 */
export function computeCentroid(coords: [number, number][]): [number, number] {
  if (!coords || coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];

  let sumLat = 0;
  let sumLng = 0;
  coords.forEach(([lat, lng]) => {
    sumLat += lat;
    sumLng += lng;
  });

  return [
    Number((sumLat / coords.length).toFixed(5)),
    Number((sumLng / coords.length).toFixed(5)),
  ];
}

/**
 * Generates a two-dimensional corridor polygon flanking a track line by widthNm / 2
 * on either side, or asymmetric port/starboard offsets if specified.
 */
export function computeLineCorridor(
  points: [number, number][],
  widthNm: number = 3.0,
  portWidthNm?: number,
  stbdWidthNm?: number
): CorridorGeometry {
  if (!points || !Array.isArray(points) || points.length < 2) {
    return {
      centerLine: points || [],
      boundaryPolygon: points || [],
      widthNm: Number.isFinite(widthNm) ? widthNm : 3.0,
      lengthNm: 0,
    };
  }

  const validPoints = points.filter(
    (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
  );
  if (validPoints.length < 2) {
    return {
      centerLine: validPoints,
      boundaryPolygon: validPoints,
      widthNm: Number.isFinite(widthNm) ? widthNm : 3.0,
      lengthNm: 0,
    };
  }

  const effectivePortWidth = portWidthNm !== undefined ? Math.max(0.05, portWidthNm) : Math.max(0.1, widthNm / 2);
  const effectiveStbdWidth = stbdWidthNm !== undefined ? Math.max(0.05, stbdWidthNm) : Math.max(0.1, widthNm / 2);
  const totalWidthNm = portWidthNm !== undefined && stbdWidthNm !== undefined
    ? Number((portWidthNm + stbdWidthNm).toFixed(2))
    : widthNm;

  const leftBank: [number, number][] = [];
  const rightBank: [number, number][] = [];
  let totalLengthNm = 0;

  for (let i = 0; i < validPoints.length; i++) {
    let bearing: number;
    if (i === 0) {
      bearing = computeBearingDeg(validPoints[0], validPoints[1]);
      totalLengthNm += computeDistanceNm(validPoints[0], validPoints[1]);
    } else if (i === validPoints.length - 1) {
      bearing = computeBearingDeg(validPoints[i - 1], validPoints[i]);
    } else {
      const b1 = computeBearingDeg(validPoints[i - 1], validPoints[i]);
      const b2 = computeBearingDeg(validPoints[i], validPoints[i + 1]);
      totalLengthNm += computeDistanceNm(validPoints[i], validPoints[i + 1]);
      // Average bearing at vertices
      const avgSin = (Math.sin(b1 * DEG_TO_RAD) + Math.sin(b2 * DEG_TO_RAD)) / 2;
      const avgCos = (Math.cos(b1 * DEG_TO_RAD) + Math.cos(b2 * DEG_TO_RAD)) / 2;
      bearing = (Math.atan2(avgSin, avgCos) * RAD_TO_DEG + 360) % 360;
    }

    // Left bank (Port offset: bearing - 90), Right bank (Starboard offset: bearing + 90)
    const leftPoint = computeDestinationPoint(
      validPoints[i],
      (bearing - 90 + 360) % 360,
      effectivePortWidth
    );
    const rightPoint = computeDestinationPoint(
      validPoints[i],
      (bearing + 90) % 360,
      effectiveStbdWidth
    );

    leftBank.push(leftPoint);
    rightBank.push(rightPoint);
  }

  // Construct closed polygon: start along left bank, then return along reversed right bank
  const boundaryPolygon = [...leftBank, ...rightBank.reverse(), leftBank[0]];

  return {
    centerLine: validPoints,
    boundaryPolygon,
    widthNm: totalWidthNm,
    lengthNm: Number(totalLengthNm.toFixed(2)),
  };
}

/**
 * Calculates a closed geodesic sector (sweep arc) polygon from center, radius,
 * and start/end bearings in degrees clockwise from True North.
 * Handles boundary crossing through 0°/360° north seamlessly.
 */
export function computeSectorPolygon(
  center: [number, number],
  radiusNm: number,
  startBearingDeg: number,
  endBearingDeg: number,
  stepDeg: number = 4
): [number, number][] {
  if (
    !center ||
    !Array.isArray(center) ||
    !Number.isFinite(center[0]) ||
    !Number.isFinite(center[1]) ||
    !Number.isFinite(radiusNm) ||
    radiusNm <= 0 ||
    !Number.isFinite(startBearingDeg) ||
    !Number.isFinite(endBearingDeg)
  ) return [];

  const normStart = ((startBearingDeg % 360) + 360) % 360;
  const normEnd = ((endBearingDeg % 360) + 360) % 360;

  // Angular distance clockwise from start to end
  let sweepDeg = normEnd >= normStart
    ? normEnd - normStart
    : normEnd - normStart + 360;

  if (sweepDeg === 0) {
    sweepDeg = 360; // full circle sweep
  }

  const arcPoints: [number, number][] = [];
  const validStep = Math.max(1, Math.min(15, stepDeg));
  const stepsCount = Math.ceil(sweepDeg / validStep);

  for (let i = 0; i <= stepsCount; i++) {
    const fraction = i / stepsCount;
    const currentBearing = (normStart + fraction * sweepDeg) % 360;
    const pt = computeDestinationPoint(center, currentBearing, radiusNm);
    arcPoints.push(pt);
  }

  // If full circle (sweep = 360), return closed circular ring
  if (sweepDeg >= 359.9) {
    return arcPoints;
  }

  // Otherwise, construct pie wedge: center -> arc points -> back to center
  return [center, ...arcPoints, center];
}

export interface SectorDirective {
  startBearing: number;
  endBearing: number;
  radiusNm?: number;
  rawText: string;
}

/**
 * Extracts directional sector bearing and radius clauses from text.
 * Examples:
 * - "BETWEEN BEARINGS 045 AND 135 OUT TO 10 NM"
 * - "SECTOR OF A CIRCLE RADIUS 5 NM BETWEEN BEARINGS 270 AND 360"
 * - "IN A SECTOR BOUNDED BY BEARINGS 180 DEG AND 240 DEG"
 */
export function parseSectorDirective(rawText: string): SectorDirective | null {
  if (!rawText) return null;
  const upper = rawText.toUpperCase();

  // Pattern 1: SECTOR ... BETWEEN (BEARINGS) B1 AND B2
  const sectorMatch = upper.match(
    /(?:SECTOR\s+(?:OF\s+A\s+CIRCLE\s+)?(?:BOUNDED\s+BY\s+)?|BETWEEN\s+(?:TRUE\s+)?BEARINGS?\s+)(\d{1,3}(?:\.\d+)?)\s*(?:DEG|DEGREES|°)?\s*(?:AND|TO|-)\s*(\d{1,3}(?:\.\d+)?)\s*(?:DEG|DEGREES|°)?/i
  );

  let startBearing: number | null = null;
  let endBearing: number | null = null;
  let matchedSnippet = '';

  if (sectorMatch) {
    startBearing = parseFloat(sectorMatch[1]);
    endBearing = parseFloat(sectorMatch[2]);
    matchedSnippet = sectorMatch[0];
  } else {
    // Pattern 2: BETWEEN B1 DEG AND B2 DEG
    const betweenMatch = upper.match(
      /BETWEEN\s+(\d{1,3}(?:\.\d+)?)\s*(?:DEG|DEGREES|°)\s*(?:AND|TO)\s*(\d{1,3}(?:\.\d+)?)\s*(?:DEG|DEGREES|°)/i
    );
    if (betweenMatch) {
      startBearing = parseFloat(betweenMatch[1]);
      endBearing = parseFloat(betweenMatch[2]);
      matchedSnippet = betweenMatch[0];
    }
  }

  if (startBearing === null || endBearing === null) return null;

  // Extract optional radius if specified nearby
  const radiusMatch = upper.match(
    /(?:RADIUS\s*(?:OF\s*)?|OUT\s+TO\s+|DISTANCE\s*(?:OF\s*)?)(\d+(?:\.\d+)?)\s*(?:NM|NAUTICAL\s*MILES?|MILES?)/i
  );
  const radiusNm = radiusMatch ? parseFloat(radiusMatch[1]) : undefined;

  return {
    startBearing: ((startBearing % 360) + 360) % 360,
    endBearing: ((endBearing % 360) + 360) % 360,
    radiusNm,
    rawText: matchedSnippet,
  };
}

/**
 * Computes multi-leg measurements (total distance, leg distances, area, centroid)
 * for a line or polygon.
 */
export function computeMeasurements(
  coords: [number, number][],
  isClosed: boolean = false
): GeodesicMeasurement {
  if (!coords || coords.length < 2) {
    return {
      totalDistanceNm: 0,
      legDistancesNm: [],
      surfaceAreaSqNm: 0,
      centroid: coords[0] || [0, 0],
    };
  }

  let totalDist = 0;
  const legDists: number[] = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const d = computeDistanceNm(coords[i], coords[i + 1]);
    legDists.push(d);
    totalDist += d;
  }

  if (isClosed && coords.length >= 3) {
    const closureDist = computeDistanceNm(coords[coords.length - 1], coords[0]);
    if (closureDist > 0.05) {
      legDists.push(closureDist);
      totalDist += closureDist;
    }
  }

  const surfaceAreaSqNm = isClosed ? computePolygonAreaSqNm(coords) : undefined;
  const centroid = computeCentroid(coords);

  return {
    totalDistanceNm: Number(totalDist.toFixed(2)),
    legDistancesNm: legDists,
    surfaceAreaSqNm,
    centroid,
  };
}

/**
 * Detects circular clearance directives and safety buffers from raw bulletin text.
 * Examples:
 * - "WIDE BERTH OF 3 MILES REQUESTED"
 * - "500 METRE SAFETY ZONE"
 * - "SAFETY ZONE OF 500M"
 * - "RADIUS OF 1.5 NM"
 * - "WITHIN 2 NM OF"
 */
export function parseClearanceDirective(
  rawText: string
): ClearanceDirective | null {
  if (!rawText) return null;
  const upper = rawText.toUpperCase();

  // 1. Wide Berth (e.g., "WIDE BERTH OF 3.0 MILES", "WIDE BERTH OF 2 NM")
  const berthMatch = upper.match(
    /WIDE\s+BERTH\s+(?:OF\s+)?(\d+(?:\.\d+)?)\s*(MILES?|NM|NAUTICAL\s+MILES?)/i
  );
  if (berthMatch) {
    const val = parseFloat(berthMatch[1]);
    return {
      type: 'wide_berth',
      value: val,
      unit: 'nm',
      radiusNm: val,
      rawText: berthMatch[0],
    };
  }

  // 2. Metre Safety Zone (e.g. "500 METRE SAFETY ZONE", "SAFETY ZONE OF 500 METRES", "500 MTR CLEARANCE")
  const metreMatch = upper.match(
    /(?:(\d+)\s*(?:METRES?|METERS?|MTR|M)\s*(?:SAFETY\s*ZONE|CLEARANCE)|SAFETY\s*ZONE\s*(?:OF\s*)?(\d+)\s*(?:METRES?|METERS?|M))/i
  );
  if (metreMatch) {
    const val = parseFloat(metreMatch[1] || metreMatch[2]);
    const radiusNm = Number((val / METRES_PER_NM).toFixed(3));
    return {
      type: 'safety_zone',
      value: val,
      unit: 'metres',
      radiusNm,
      rawText: metreMatch[0],
    };
  }

  // 3. Radial distance (e.g. "RADIUS OF 2.5 NM", "WITHIN 1 NM OF")
  const radiusMatch = upper.match(
    /(?:RADIUS\s*(?:OF\s*)?|WITHIN\s+)(\d+(?:\.\d+)?)\s*(NM|NAUTICAL\s*MILES?|MILES?)/i
  );
  if (radiusMatch) {
    const val = parseFloat(radiusMatch[1]);
    return {
      type: 'radius',
      value: val,
      unit: 'nm',
      radiusNm: val,
      rawText: radiusMatch[0],
    };
  }

  return null;
}

/**
 * Detects drift vectors for unmoored containers, derelicts, or floating hazards.
 * Examples:
 * - "DRIFTING EASTWARD AT 1.5 KTS"
 * - "DRIFT 090 DEGREES 2.0 KNOTS"
 * - "DRIFTING NORTH-EAST"
 */
export function parseDriftVector(
  origin: [number, number],
  rawText: string
): DriftVector | null {
  if (!rawText || !origin) return null;
  const upper = rawText.toUpperCase();

  const compassMap: Record<string, number> = {
    NORTH: 0,
    NORTHWARD: 0,
    N: 0,
    'NORTH-EAST': 45,
    NORTHEAST: 45,
    NE: 45,
    EAST: 90,
    EASTWARD: 90,
    E: 90,
    'SOUTH-EAST': 135,
    SOUTHEAST: 135,
    SE: 135,
    SOUTH: 180,
    SOUTHWARD: 180,
    S: 180,
    'SOUTH-WEST': 225,
    SOUTHWEST: 225,
    SW: 225,
    WEST: 270,
    WESTWARD: 270,
    W: 270,
    'NORTH-WEST': 315,
    NORTHWEST: 315,
    NW: 315,
  };

  // Match: DRIFTING [DIR] or DRIFT [DEG]
  let bearingDeg: number | null = null;
  let directionLabel = 'Drifting Hazard Track';

  const degMatch = upper.match(/DRIFT(?:ING)?\s+(?:TOWARDS?\s+)?(\d{1,3})\s*(?:DEG|DEGREES|°)/i);
  if (degMatch) {
    bearingDeg = parseFloat(degMatch[1]) % 360;
    directionLabel = `Drift ${bearingDeg}°`;
  } else {
    for (const [dir, deg] of Object.entries(compassMap)) {
      const reg = new RegExp(`\\bDRIFT(?:ING)?\\s+(?:TOWARDS?\\s+)?${dir}\\b`, 'i');
      if (reg.test(upper)) {
        bearingDeg = deg;
        directionLabel = `Drift ${dir}`;
        break;
      }
    }
  }

  if (bearingDeg === null) return null;

  // Match optional speed (e.g. "AT 2.0 KTS" or "1.5 KNOTS")
  const speedMatch = upper.match(/(\d+(?:\.\d+)?)\s*(?:KTS|KNOTS)/i);
  const speedKts = speedMatch ? parseFloat(speedMatch[1]) : undefined;

  // Project estimated 6-hour or standard 5 NM drift line if speed unknown
  const isFallback = !speedKts;
  const projectionHours = speedKts ? 6 : undefined;
  const distanceNm = speedKts ? Number((speedKts * 6).toFixed(1)) : 5.0;
  const destination = computeDestinationPoint(origin, bearingDeg, distanceNm);

  return {
    origin,
    destination,
    bearingDeg,
    speedKts,
    distanceNm,
    directionLabel,
    isEstimated: true,
    isFallback,
    projectionHours,
  };
}

/**
 * Formats a coordinate pair into the site-wide display standard (e.g., 58° 12.34' N 011° 15.67' E).
 */
export function formatWgs84Dms(lat: number, lng: number): string {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return 'N/A';
  }

  const latHem = lat >= 0 ? 'N' : 'S';
  const lngHem = lng >= 0 ? 'E' : 'W';

  const absLat = Math.abs(lat);
  const absLng = Math.abs(lng);

  const latDeg = Math.floor(absLat);
  const latMin = (absLat - latDeg) * 60;

  const lngDeg = Math.floor(absLng);
  const lngMin = (absLng - lngDeg) * 60;

  const latStr = `${latDeg.toString().padStart(2, '0')}° ${latMin.toFixed(2)}' ${latHem}`;
  const lngStr = `${lngDeg.toString().padStart(3, '0')}° ${lngMin.toFixed(2)}' ${lngHem}`;

  return `${latStr} ${lngStr}`;
}

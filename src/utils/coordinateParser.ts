import { BoundingBox, NavAreaId, SpatialData, SpatialGeometry, SpatialCircle } from '../types';

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
 * Parses coordinate pair strings like "55-14.2N 003-45.1E" or "55°14.2'N, 003°45.1'E"
 */
export function parseSingleCoordinatePair(text: string): [number, number] | null {
  // Regex 1: DD-MM.M N/S DDD-MM.M E/W or DD-MM.MMN DDD-MM.MME
  const pattern1 = /(\d{1,3})[-°\s](\d{1,2}(?:\.\d+)?)['′]?\s*([NS])[\s,]+(\d{1,3})[-°\s](\d{1,2}(?:\.\d+)?)['′]?\s*([EW])/i;
  const match1 = text.match(pattern1);
  if (match1) {
    const latDeg = parseFloat(match1[1]);
    const latMin = parseFloat(match1[2]);
    const latDir = match1[3].toUpperCase();
    const lngDeg = parseFloat(match1[4]);
    const lngMin = parseFloat(match1[5]);
    const lngDir = match1[6].toUpperCase();

    const lat = dmsToDecimal(latDeg, latMin, 0, latDir);
    const lng = dmsToDecimal(lngDeg, lngMin, 0, lngDir);
    return [lng, lat];
  }

  // Regex 2: DD MM N, DDD MM E (without minutes decimals)
  const pattern2 = /(\d{1,2})\s+(\d{1,2})\s+([NS])[\s,]+(\d{1,3})\s+(\d{1,2})\s+([EW])/i;
  const match2 = text.match(pattern2);
  if (match2) {
    const lat = dmsToDecimal(parseFloat(match2[1]), parseFloat(match2[2]), 0, match2[3].toUpperCase());
    const lng = dmsToDecimal(parseFloat(match2[4]), parseFloat(match2[5]), 0, match2[6].toUpperCase());
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

  // Check for circle pattern: e.g. "within 5 NM of 55-14.2N 003-45.1E" or "RADIUS 10NM CENTRED ON 24-15N 068-30E"
  const circlePattern = /(?:WITHIN|RADIUS)\s+(\d+(?:\.\d+)?)\s*(?:NM|NAUTICAL MILES)?\s*(?:OF|CENTRED ON|CENTERED ON)\s+([0-9\-\.°\s'″NS]+[EW])/gi;
  let circleMatch;
  while ((circleMatch = circlePattern.exec(rawText)) !== null) {
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

  // Extract all coordinate pairs found in the text
  const globalCoordPattern = /(\d{1,3}[-°\s]\d{1,2}(?:\.\d+)?['′]?\s*[NS][\s,]+\d{1,3}[-°\s]\d{1,2}(?:\.\d+)?['′]?\s*[EW])/gi;
  const allPairMatches = rawText.match(globalCoordPattern) || [];
  const parsedPoints: [number, number][] = [];

  for (const matchStr of allPairMatches) {
    const pt = parseSingleCoordinatePair(matchStr);
    if (pt) {
      parsedPoints.push(pt);
      rawCoordinateText.push(matchStr);
    }
  }

  // Deduplicate points
  const uniquePoints: [number, number][] = [];
  parsedPoints.forEach((pt) => {
    if (!uniquePoints.some((u) => Math.abs(u[0] - pt[0]) < 0.0001 && Math.abs(u[1] - pt[1]) < 0.0001)) {
      uniquePoints.push(pt);
    }
  });

  // If 3 or more points and text hints at area/polygon
  const isPolygonText = /BOUNDED BY|AREA BOUNDED|JOINING|IN AREA|LINE CONNECTING|POLYGON/i.test(rawText);
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
  } else if (uniquePoints.length === 2 && /LINE|TRACK|CABLE|PIPE/i.test(rawText)) {
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
          label: `Point Position #${idx + 1}`,
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
export function getLeafletLatLng(spatial: SpatialData | undefined | null): [number, number] {
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

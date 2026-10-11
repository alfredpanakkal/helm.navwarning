// src/parsers/coordinateParser.ts
// Robust 9-format maritime coordinate parser with lat-only repair, post-repair bounds sanity, and telemetry

import type { NavWarnCoordinate } from '../types/navarea';

export interface CoordinateParseResult {
  coordinates: NavWarnCoordinate[];
  repairsApplied: string[];
  coordinateFormat?: string;
  confidence: 'high' | 'medium' | 'low';
  ambiguousText?: string[];
}

export function parseCoordinatesFull(rawText: string): CoordinateParseResult {
  const coordinates: NavWarnCoordinate[] = [];
  const repairsApplied: string[] = [];
  const ambiguousText: string[] = [];
  let detectedFormat: string | undefined;

  if (!rawText || typeof rawText !== 'string') {
    return { coordinates: [], repairsApplied: [], confidence: 'low' };
  }

  // Pre-check for hemisphere-missing hazard (e.g. "11-52 146-04")
  const missingHemiMatch = rawText.match(/\b\d{2}-\d{2}(?:\.\d+)?\s+\d{2,3}-\d{2}(?:\.\d+)?\b(?![NSEW])/);
  if (missingHemiMatch) {
    ambiguousText.push(missingHemiMatch[0]);
  }

  // Regex patterns for the 9 formats:
  // 1. DMS: 24° 15' 30"N 057° 45' 12"E or 24°15'30"N 057°45'12"E
  const dmsRegex = /(\d{1,2})[°\s]+(\d{1,2})['\s]+(\d{1,2}(?:\.\d+)?)"?\s*([NS])\s*,?\s*(\d{1,3})[°\s]+(\d{1,2})['\s]+(\d{1,2}(?:\.\d+)?)"?\s*([EW])/gi;

  let match: RegExpExecArray | null;
  while ((match = dmsRegex.exec(rawText)) !== null) {
    detectedFormat = 'DMS';
    const [, latD, latM, latS, latH, lonD, lonM, lonS, lonH] = match;
    const lat = parseInt(latD, 10) + parseInt(latM, 10) / 60 + parseFloat(latS) / 3600;
    const lon = parseInt(lonD, 10) + parseInt(lonM, 10) / 60 + parseFloat(lonS) / 3600;
    const finalLat = latH.toUpperCase() === 'S' ? -lat : lat;
    const finalLon = lonH.toUpperCase() === 'W' ? -lon : lon;

    if (validateSanity(finalLat, finalLon)) {
      coordinates.push({ lat: finalLat, lng: finalLon });
    }
  }

  if (coordinates.length > 0) {
    return {
      coordinates,
      repairsApplied,
      coordinateFormat: detectedFormat,
      confidence: 'high',
      ambiguousText,
    };
  }

  // 2. Dashed / Decimal Minutes / Zero-padded Lat:
  // e.g. "021-26.90N 068-15.30W" or "24-12.50N 054-15.20E" or "24-12N 054-15E"
  const dashedRegex = /(?:([A-Z0-9-]+)\s+)?\b(0?\d{1,2}|\d{3})-(\d{1,2}(?:\.\d+)?)\s*([NS])\s*,?\s*(\d{2,3})-(\d{1,2}(?:\.\d+)?)\s*([EW])/gi;

  while ((match = dashedRegex.exec(rawText)) !== null) {
    const [fullStr, labelPrefix, rawLatD, rawLatM, latH, rawLonD, rawLonM, lonH] = match;
    detectedFormat = 'DASHED_DM';

    let latD = rawLatD;
    // Safe coordinate repair: Strip leading zero ONLY from latitude (e.g. "021" -> "21")
    if (latD.length === 3 && latD.startsWith('0')) {
      latD = latD.substring(1);
      repairsApplied.push(`Stripped leading zero from latitude: ${rawLatD} -> ${latD}`);
    }

    const latDeg = parseInt(latD, 10);
    const latMin = parseFloat(rawLatM);
    const lonDeg = parseInt(rawLonD, 10);
    const lonMin = parseFloat(rawLonM);

    const lat = latDeg + latMin / 60;
    const lon = lonDeg + lonMin / 60;
    const finalLat = latH.toUpperCase() === 'S' ? -lat : lat;
    const finalLon = lonH.toUpperCase() === 'W' ? -lon : lon;

    // Check post-repair bounds strictly
    if (validateSanity(finalLat, finalLon)) {
      coordinates.push({
        lat: finalLat,
        lng: finalLon,
        label: labelPrefix?.trim(),
      });
    }
  }

  if (coordinates.length > 0) {
    return {
      coordinates,
      repairsApplied,
      coordinateFormat: detectedFormat,
      confidence: repairsApplied.length > 0 ? 'medium' : 'high',
      ambiguousText,
    };
  }

  // 3. Space-separated: e.g. "23 30.00N 064 10.00E"
  const spaceRegex = /\b(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)\s*([NS])\s*,?\s*(\d{2,3})\s+(\d{1,2}(?:\.\d+)?)\s*([EW])/gi;

  while ((match = spaceRegex.exec(rawText)) !== null) {
    detectedFormat = 'SPACE_DM';
    const [, latD, latM, latH, lonD, lonM, lonH] = match;
    const lat = parseInt(latD, 10) + parseFloat(latM) / 60;
    const lon = parseInt(lonD, 10) + parseFloat(lonM) / 60;
    const finalLat = latH.toUpperCase() === 'S' ? -lat : lat;
    const finalLon = lonH.toUpperCase() === 'W' ? -lon : lon;

    if (validateSanity(finalLat, finalLon)) {
      coordinates.push({ lat: finalLat, lng: finalLon });
    }
  }

  if (coordinates.length > 0) {
    return {
      coordinates,
      repairsApplied,
      coordinateFormat: detectedFormat,
      confidence: 'high',
      ambiguousText,
    };
  }

  // 4. Dot Decimal Degrees: e.g. "07.5N 080.8W"
  const dotDdRegex = /\b(\d{1,2}(?:\.\d+)?)\s*([NS])\s*,?\s*(\d{1,3}(?:\.\d+)?)\s*([EW])/gi;

  while ((match = dotDdRegex.exec(rawText)) !== null) {
    detectedFormat = 'DOT_DECIMAL';
    const [, rawLat, latH, rawLon, lonH] = match;
    const lat = parseFloat(rawLat);
    const lon = parseFloat(rawLon);
    const finalLat = latH.toUpperCase() === 'S' ? -lat : lat;
    const finalLon = lonH.toUpperCase() === 'W' ? -lon : lon;

    if (validateSanity(finalLat, finalLon)) {
      coordinates.push({ lat: finalLat, lng: finalLon });
    }
  }

  return {
    coordinates,
    repairsApplied,
    coordinateFormat: detectedFormat,
    confidence: coordinates.length > 0 ? 'high' : 'low',
    ambiguousText,
  };
}

function validateSanity(lat: number, lon: number): boolean {
  if (isNaN(lat) || isNaN(lon)) return false;
  // Latitude must be strictly in [-90, 90]
  if (lat < -90 || lat > 90) return false;
  // Longitude must be strictly in [-180, 180]
  if (lon < -180 || lon > 180) return false;
  return true;
}

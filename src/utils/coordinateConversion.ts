/**
 * Nautical Coordinate Conversion, Parsing, and Navigation Utilities
 * World-Wide Navigational Warning Service (WWNWS / IMO / IHO)
 */

export interface CoordinateParseSuccess {
  success: true;
  lat: number;
  lng: number;
  format: 'DMM' | 'DD';
  nauticalFormatted: string;
  decimalFormatted: string;
  raw: string;
}

export interface CoordinateParseError {
  success: false;
  error: string;
  raw: string;
}

export type CoordinateParseResult = CoordinateParseSuccess | CoordinateParseError;

/**
 * Converts decimal degrees to standard nautical Degree-Minute (DMM) notation:
 * "DD-MM.MM'N DDD-MM.MM'E"
 * - Two-digit zero padding for latitude degrees (00 to 90)
 * - Three-digit zero padding for longitude degrees (000 to 180)
 * - Two decimal places for minutes with two-digit integer minute zero padding (00.00 to 59.99)
 */
export function formatNauticalCoordinates(lat: number, lng: number): string {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return '';
  }

  // Latitude conversion
  const latHem = lat >= 0 ? 'N' : 'S';
  let absLat = Math.abs(lat);
  let latDeg = Math.floor(absLat);
  let latMin = (absLat - latDeg) * 60;

  // Handle rounding overflow (e.g. 59.999 minutes rounding to 60.00)
  if (Number(latMin.toFixed(2)) >= 60) {
    latDeg += 1;
    latMin = 0;
  }
  const latDegStr = String(latDeg).padStart(2, '0');
  const latMinStr = latMin.toFixed(2).padStart(5, '0');

  // Longitude conversion
  const lngHem = lng >= 0 ? 'E' : 'W';
  let absLng = Math.abs(lng);
  let lngDeg = Math.floor(absLng);
  let lngMin = (absLng - lngDeg) * 60;

  // Handle rounding overflow
  if (Number(lngMin.toFixed(2)) >= 60) {
    lngDeg += 1;
    lngMin = 0;
  }
  const lngDegStr = String(lngDeg).padStart(3, '0');
  const lngMinStr = lngMin.toFixed(2).padStart(5, '0');

  return `${latDegStr}-${latMinStr}'${latHem} ${lngDegStr}-${lngMinStr}'${lngHem}`;
}

/**
 * Formats coordinates into standard decimal degree string: e.g. "55.3983, 003.8116"
 */
export function formatDecimalCoordinates(lat: number, lng: number, decimals: number = 4): string {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return '';
  }
  const absLat = Math.abs(lat);
  const latHem = lat >= 0 ? 'N' : 'S';
  const absLng = Math.abs(lng);
  const lngHem = lng >= 0 ? 'E' : 'W';
  return `${absLat.toFixed(decimals)}° ${latHem}, ${absLng.toFixed(decimals)}° ${lngHem}`;
}

/**
 * Two-tier flexible coordinate parsing strategy:
 *
 * Tier 1: Nautical DMM Format:
 *   Handles variations such as:
 *   - "55-23.90N 003-48.70E"
 *   - "55-23.90'N 003-48.70'E"
 *   - "55° 23.90' N, 003° 48.70' E"
 *   - "N 55 23.90, E 003 48.70"
 *   - "5523.90N 00348.70E"
 *   Converts minutes to decimal fractions (deg + min/60) with proper cardinal hemisphere sign.
 *
 * Tier 2: Standard Decimal Format (DD):
 *   Handles plain numeric comma/space-separated coordinates:
 *   - "55.3983, 3.8116"
 *   - "55.3983, -3.8116"
 *   - "55.3983 3.8116"
 *   - "55.3983° N, 3.8116° E"
 *
 * Validation:
 *   Verifies coordinates fall within valid geographic bounds:
 *   Latitude: -90 to 90
 *   Longitude: -180 to 180
 */
export function parseCoordinatesFlexible(input: string): CoordinateParseResult {
  if (!input || typeof input !== 'string') {
    return { success: false, error: 'Empty or invalid input string', raw: String(input || '') };
  }

  const str = input.trim();
  if (!str) {
    return { success: false, error: 'Coordinate input cannot be blank', raw: str };
  }

  // --- TIER 1: Nautical Format (DMM) ---
  // Standard nautical regex matching:
  // [optional N/S] DD [sep] MM.MM [optional N/S] [separator] [optional E/W] DDD [sep] MM.MM [optional E/W]
  const dmmRegex = /(?:([NS])\s*)?(\d{1,2})[\s°\-_]+(\d{1,2}(?:\.\d+)?)['′"]?\s*([NS])?[\s,\/|;]+(?:([EW])\s*)?(\d{1,3})[\s°\-_]+(\d{1,2}(?:\.\d+)?)['′"]?\s*([EW])?/i;
  const dmmMatch = str.match(dmmRegex);

  if (dmmMatch) {
    const preLatHem = dmmMatch[1]?.toUpperCase();
    const latDeg = parseFloat(dmmMatch[2]);
    const latMin = parseFloat(dmmMatch[3]);
    const postLatHem = dmmMatch[4]?.toUpperCase();
    const latHem = postLatHem || preLatHem;

    const preLngHem = dmmMatch[5]?.toUpperCase();
    const lngDeg = parseFloat(dmmMatch[6]);
    const lngMin = parseFloat(dmmMatch[7]);
    const postLngHem = dmmMatch[8]?.toUpperCase();
    const lngHem = postLngHem || preLngHem;

    if (latHem && lngHem) {
      if (latMin >= 60 || lngMin >= 60) {
        return { success: false, error: 'Minutes component must be strictly less than 60', raw: str };
      }

      let lat = latDeg + latMin / 60;
      if (latHem === 'S') lat = -lat;

      let lng = lngDeg + lngMin / 60;
      if (lngHem === 'W') lng = -lng;

      // Geographic bounds validation
      if (lat < -90 || lat > 90) {
        return { success: false, error: `Latitude ${lat.toFixed(4)}° is outside valid bounds (-90° to +90°)`, raw: str };
      }
      if (lng < -180 || lng > 180) {
        return { success: false, error: `Longitude ${lng.toFixed(4)}° is outside valid bounds (-180° to +180°)`, raw: str };
      }

      const finalLat = Number(lat.toFixed(6));
      const finalLng = Number(lng.toFixed(6));

      return {
        success: true,
        lat: finalLat,
        lng: finalLng,
        format: 'DMM',
        nauticalFormatted: formatNauticalCoordinates(finalLat, finalLng),
        decimalFormatted: formatDecimalCoordinates(finalLat, finalLng),
        raw: str,
      };
    }
  }

  // Compact DMM without separator: e.g. "5523.90N 00348.70E"
  const compactDmmRegex = /(\d{2})(\d{2}\.\d+)\s*([NS])[\s,\/|;]+(\d{3})(\d{2}\.\d+)\s*([EW])/i;
  const compactMatch = str.match(compactDmmRegex);
  if (compactMatch) {
    const latDeg = parseFloat(compactMatch[1]);
    const latMin = parseFloat(compactMatch[2]);
    const latHem = compactMatch[3].toUpperCase();
    const lngDeg = parseFloat(compactMatch[4]);
    const lngMin = parseFloat(compactMatch[5]);
    const lngHem = compactMatch[6].toUpperCase();

    if (latMin < 60 && lngMin < 60) {
      let lat = latDeg + latMin / 60;
      if (latHem === 'S') lat = -lat;
      let lng = lngDeg + lngMin / 60;
      if (lngHem === 'W') lng = -lng;

      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        const finalLat = Number(lat.toFixed(6));
        const finalLng = Number(lng.toFixed(6));
        return {
          success: true,
          lat: finalLat,
          lng: finalLng,
          format: 'DMM',
          nauticalFormatted: formatNauticalCoordinates(finalLat, finalLng),
          decimalFormatted: formatDecimalCoordinates(finalLat, finalLng),
          raw: str,
        };
      }
    }
  }

  // --- TIER 2: Standard Decimal Format (DD) ---
  // Matches "55.3983, 3.8116" or "55.3983 -3.8116" or "55.3983° N, 3.8116° E"
  const ddRegex = /^[\s\(]*([+-]?\d{1,3}(?:\.\d+)?)\s*°?\s*([NS])?[\s,;/|]+([+-]?\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])?[\s\)]*$/i;
  const ddMatch = str.match(ddRegex);

  if (ddMatch) {
    let lat = parseFloat(ddMatch[1]);
    const latHem = ddMatch[2]?.toUpperCase();
    let lng = parseFloat(ddMatch[3]);
    const lngHem = ddMatch[4]?.toUpperCase();

    if (!isNaN(lat) && !isNaN(lng)) {
      if (latHem === 'S' && lat > 0) lat = -lat;
      if (latHem === 'N' && lat < 0) lat = Math.abs(lat);
      if (lngHem === 'W' && lng > 0) lng = -lng;
      if (lngHem === 'E' && lng < 0) lng = Math.abs(lng);

      if (lat < -90 || lat > 90) {
        return { success: false, error: `Latitude ${lat.toFixed(4)}° is outside valid bounds (-90° to +90°)`, raw: str };
      }
      if (lng < -180 || lng > 180) {
        return { success: false, error: `Longitude ${lng.toFixed(4)}° is outside valid bounds (-180° to +180°)`, raw: str };
      }

      const finalLat = Number(lat.toFixed(6));
      const finalLng = Number(lng.toFixed(6));

      return {
        success: true,
        lat: finalLat,
        lng: finalLng,
        format: 'DD',
        nauticalFormatted: formatNauticalCoordinates(finalLat, finalLng),
        decimalFormatted: formatDecimalCoordinates(finalLat, finalLng),
        raw: str,
      };
    }
  }

  return {
    success: false,
    error: 'Unrecognized format. Enter DMM (e.g. 55-23.90N 003-48.70E) or Decimal (e.g. 55.3983, 3.8116)',
    raw: str,
  };
}

/**
 * Robust clipboard copy utility with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    // Fallback below
  }

  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    }
  } catch {
    return false;
  }

  return false;
}

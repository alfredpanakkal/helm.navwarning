// src/parsers/coordinateLexer.ts
// Comprehensive Rules v3.0 Coordinate Lexer & Token Recognizer

import type { NavWarnCoordinate } from '../types/navarea';
import { FieldState } from './common/provenance';
import { ParserFlag } from './common/flags';

export interface LexedPosition {
  lat: number;
  lng: number;
  state: FieldState;
  flags: ParserFlag[];
  raw: string;
  span: [number, number];
  label?: string;
}

export interface CoordinateLexerResult {
  coordinates: NavWarnCoordinate[];
  positions: LexedPosition[];
  hasUnresolved: boolean;
  confidence: 'high' | 'medium' | 'low';
  repairsApplied: string[];
  flags: ParserFlag[];
}

/**
 * Parses DMS, DM, or DD string segment into signed decimal degrees.
 */
function parseSegment(degStr: string, minStr?: string, secStr?: string, hemStr?: string): number | null {
  const deg = parseFloat(degStr);
  const min = minStr ? parseFloat(minStr) : 0;
  const sec = secStr ? parseFloat(secStr) : 0;

  if (isNaN(deg) || min >= 60 || sec >= 60) return null;

  let val = deg + min / 60 + sec / 3600;
  if (hemStr) {
    const h = hemStr.toUpperCase();
    if (h === 'S' || h === 'W') val = -val;
  }
  return val;
}

export function lexCoordinates(rawText: string): CoordinateLexerResult {
  const positions: LexedPosition[] = [];
  const repairsApplied: string[] = [];
  const flags: ParserFlag[] = [];
  let hasUnresolved = false;

  if (!rawText || typeof rawText !== 'string') {
    return { coordinates: [], positions: [], hasUnresolved: false, confidence: 'low', repairsApplied: [], flags: [] };
  }

  // 1. DMS Hyphenated / Symbol Format: e.g. "51-27-57N 023-10-30E" or "51°27'57"N 023°10'30"E"
  const dmsRegex = /\b(\d{1,3})[-°\s]+(\d{1,2})['-\s]+(\d{1,2}(?:\.\d+)?)"?\s*([NS])\s*,?\s*(\d{1,3})[-°\s]+(\d{1,2})['-\s]+(\d{1,2}(?:\.\d+)?)"?\s*([EW])\b/gi;
  let match: RegExpExecArray | null;

  while ((match = dmsRegex.exec(rawText)) !== null) {
    const [fullStr, latD, latM, latS, latH, lonD, lonM, lonS, lonH] = match;
    const lat = parseSegment(latD, latM, latS, latH);
    const lon = parseSegment(lonD, lonM, lonS, lonH);

    if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      positions.push({
        lat,
        lng: lon,
        state: 'explicit',
        flags: [],
        raw: fullStr,
        span: [match.index, match.index + fullStr.length],
      });
    } else {
      hasUnresolved = true;
      flags.push('INVALID_LATITUDE');
    }
  }

  // 2. DM Hyphenated / Decimal Minutes Format: e.g. "53-31.70N 003-45.20E" or "24-12.50N 054-15.20E"
  const dmRegex = /\b(\d{1,3})-(\d{1,2}(?:\.\d+)?)\s*([NS])\s*,?\s*(\d{1,3})-(\d{1,2}(?:\.\d+)?)\s*([EW])\b/gi;

  while ((match = dmRegex.exec(rawText)) !== null) {
    const [fullStr, latD, latM, latH, lonD, lonM, lonH] = match;
    // Check if position was already matched by DMS
    const startIdx = match.index;
    if (positions.some(p => Math.abs(p.span[0] - startIdx) < 5)) continue;

    const lat = parseSegment(latD, latM, undefined, latH);
    const lon = parseSegment(lonD, lonM, undefined, lonH);

    if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      positions.push({
        lat,
        lng: lon,
        state: 'explicit',
        flags: [],
        raw: fullStr,
        span: [startIdx, startIdx + fullStr.length],
      });
    }
  }

  // 3. Space-Separated / Standard DM Format: e.g. "23 30.00N 064 10.00E"
  const spaceDmRegex = /\b(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)\s*([NS])\s*,?\s*(\d{2,3})\s+(\d{1,2}(?:\.\d+)?)\s*([EW])\b/gi;

  while ((match = spaceDmRegex.exec(rawText)) !== null) {
    const [fullStr, latD, latM, latH, lonD, lonM, lonH] = match;
    const startIdx = match.index;
    if (positions.some(p => Math.abs(p.span[0] - startIdx) < 5)) continue;

    const lat = parseSegment(latD, latM, undefined, latH);
    const lon = parseSegment(lonD, lonM, undefined, lonH);

    if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      positions.push({
        lat,
        lng: lon,
        state: 'explicit',
        flags: [],
        raw: fullStr,
        span: [startIdx, startIdx + fullStr.length],
      });
    }
  }

  // 4. Glued Tokens Format: e.g. "1530N06045E" or "1530.5N06045.2E"
  const gluedRegex = /\b(\d{2})(\d{2}(?:\.\d+)?)\s*([NS])\s*(\d{3})(\d{2}(?:\.\d+)?)\s*([EW])\b/gi;

  while ((match = gluedRegex.exec(rawText)) !== null) {
    const [fullStr, latD, latM, latH, lonD, lonM, lonH] = match;
    const startIdx = match.index;
    if (positions.some(p => Math.abs(p.span[0] - startIdx) < 5)) continue;

    const lat = parseSegment(latD, latM, undefined, latH);
    const lon = parseSegment(lonD, lonM, undefined, lonH);

    if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      positions.push({
        lat,
        lng: lon,
        state: 'repaired',
        flags: ['GLUED_TOKENS_SPLIT'],
        raw: fullStr,
        span: [startIdx, startIdx + fullStr.length],
      });
      repairsApplied.push(`Split glued tokens: ${fullStr}`);
    }
  }

  // 5. Bounding Box Form (Rule R56): "BOUNDED WITHIN lat1 TO lat2 AND lon1 TO lon2"
  const bboxRegex = /BOUNDED\s+WITHIN\s+(\d{1,2}-\d{1,2}(?:\.\d+)?[NS]|\d{1,2}(?:\.\d+)?[NS])\s+TO\s+(\d{1,2}-\d{1,2}(?:\.\d+)?[NS]|\d{1,2}(?:\.\d+)?[NS])\s+AND\s+(\d{1,3}-\d{1,2}(?:\.\d+)?[EW]|\d{1,3}(?:\.\d+)?[EW])\s+TO\s+(\d{1,3}-\d{1,2}(?:\.\d+)?[EW]|\d{1,3}(?:\.\d+)?[EW])/i;
  const bboxMatch = rawText.match(bboxRegex);

  if (bboxMatch) {
    const parseCoordToken = (tok: string, isLon: boolean) => {
      const m = tok.match(/^(\d{1,3})(?:-(\d{1,2}(?:\.\d+)?))?\s*([NSEW])$/i);
      if (!m) return null;
      const deg = parseFloat(m[1]);
      const min = m[2] ? parseFloat(m[2]) : 0;
      let val = deg + min / 60;
      if (m[3].toUpperCase() === 'S' || m[3].toUpperCase() === 'W') val = -val;
      return val;
    };

    const lat1 = parseCoordToken(bboxMatch[1], false);
    const lat2 = parseCoordToken(bboxMatch[2], false);
    const lon1 = parseCoordToken(bboxMatch[3], true);
    const lon2 = parseCoordToken(bboxMatch[4], true);

    if (lat1 !== null && lat2 !== null && lon1 !== null && lon2 !== null) {
      const minLat = Math.min(lat1, lat2);
      const maxLat = Math.max(lat1, lat2);
      const minLon = Math.min(lon1, lon2);
      const maxLon = Math.max(lon1, lon2);

      // Construct rectangle 4 vertices
      const rectCoords: [number, number][] = [
        [minLat, minLon],
        [maxLat, minLon],
        [maxLat, maxLon],
        [minLat, maxLon],
      ];

      rectCoords.forEach(([lat, lng], idx) => {
        positions.push({
          lat,
          lng,
          state: 'inferred',
          flags: [],
          raw: bboxMatch[0],
          span: [bboxMatch.index || 0, (bboxMatch.index || 0) + bboxMatch[0].length],
          label: `BBox Vertex ${idx + 1}`,
        });
      });
    }
  }

  const coordinates: NavWarnCoordinate[] = positions.map(p => ({
    lat: p.lat,
    lng: p.lng,
    label: p.label,
  }));

  const confidence = hasUnresolved
    ? 'low'
    : positions.some(p => p.state === 'repaired' || p.state === 'inferred')
    ? 'medium'
    : positions.length > 0
    ? 'high'
    : 'low';

  return {
    coordinates,
    positions,
    hasUnresolved,
    confidence,
    repairsApplied,
    flags,
  };
}

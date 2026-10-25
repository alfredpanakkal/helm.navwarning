// src/parsers/coordinateParser.ts
// Delegating wrapper onto canonical spatial engine in src/utils/coordinateParser.ts

import type { NavWarnCoordinate } from '../types/navarea';
import { parseCoordinatesDeterministic } from '../utils/coordinateParser';

export interface CoordinateParseResult {
  coordinates: NavWarnCoordinate[];
  repairsApplied: string[];
  coordinateFormat?: string;
  confidence: 'high' | 'medium' | 'low';
  ambiguousText?: string[];
}

export function parseCoordinatesFull(rawText: string): CoordinateParseResult {
  if (!rawText || typeof rawText !== 'string') {
    return { coordinates: [], repairsApplied: [], confidence: 'low' };
  }

  const deterministicResult = parseCoordinatesDeterministic(rawText);

  const coordinates: NavWarnCoordinate[] = [];
  
  if (deterministicResult.geometries && deterministicResult.geometries.length > 0) {
    deterministicResult.geometries.forEach(g => {
      const rawCoords: any = g.coordinates;
      // P0 safety: Circle geometries store a bare [lng, lat] center pair. The generic
      // flatten helper below skips bare numeric pairs, which silently dropped the
      // center of any circle-only notice (e.g. "WITHIN 500 METRES OF ...",
      // "SAFETY ZONE RADIUS 1 NM") and left the hazard unplotted.
      if (g.type === 'Circle' && Array.isArray(rawCoords) && typeof rawCoords[0] === 'number' && typeof rawCoords[1] === 'number') {
        coordinates.push({
          lat: rawCoords[1],
          lng: rawCoords[0],
          label: g.label,
        });
        return;
      }
      if (g.type === 'Point' && Array.isArray(rawCoords) && typeof rawCoords[0] === 'number') {
        // [lng, lat] to { lat, lng }
        coordinates.push({
          lat: rawCoords[1],
          lng: rawCoords[0],
          label: g.label,
        });
      } else if (Array.isArray(rawCoords)) {
        // Line or Polygon ring
        const flatten = (arr: any[]) => {
          for (const item of arr) {
            if (Array.isArray(item) && typeof item[0] === 'number' && typeof item[1] === 'number') {
              coordinates.push({ lat: item[1], lng: item[0] });
            } else if (Array.isArray(item)) {
              flatten(item);
            }
          }
        };
        flatten(rawCoords);
      }
    });
  }

  const ambiguousText = (deterministicResult.ambiguous_positions || []).map(p => p.raw_text);

  return {
    coordinates,
    repairsApplied: [],
    coordinateFormat: deterministicResult.data_quality || 'EXPLICIT',
    confidence: deterministicResult.data_quality === 'EXPLICIT' ? 'high' : deterministicResult.data_quality === 'INFERRED' ? 'medium' : 'low',
    ambiguousText,
  };
}

export function validateSanity(lat: number, lon: number): boolean {
  if (isNaN(lat) || isNaN(lon)) return false;
  // Latitude must be strictly in [-90, 90]
  if (lat < -90 || lat > 90) return false;
  // Longitude must be strictly in [-180, 180] evaluated on signed decimal
  if (lon < -180 || lon > 180) return false;
  return true;
}

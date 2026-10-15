// src/parsers/geometryExtractor.ts
// 11-archetype disambiguation ladder for nautical hazard geometries

import type { Archetype, NavWarnGeometry, NavWarnCoordinate } from '../types/navarea';
import { parseCoordinatesFull, CoordinateParseResult } from './coordinateParser';
import { parseBerthAndRadius } from './berthParser';
import { extractGroupLabels } from './labelExtractor';

export interface ExtractedGeometryResult {
  geometry: NavWarnGeometry;
  disambiguationRung: number;
  confidence: 'high' | 'medium' | 'low';
  repairsApplied: string[];
}

export function extractGeometry(rawText: string): ExtractedGeometryResult {
  const coordResult = parseCoordinatesFull(rawText);
  const coords = coordResult.coordinates;
  const berth = parseBerthAndRadius(rawText);
  const labels = extractGroupLabels(rawText);

  // 1. Relocation check: "RELOCATED FROM ... TO NEW POSITION ..."
  const isRelocation = /RELOCATED\s+FROM[\s\S]+?TO\s+(?:NEW\s+POSITION\s+)?/i.test(rawText);
  if (isRelocation && coords.length >= 2) {
    return {
      geometry: {
        archetype: 'relocation',
        coordinates: [coords[1]], // primary is new position
        displacementVector: {
          from: { ...coords[0], isGhost: true },
          to: coords[1],
        },
      },
      disambiguationRung: 1,
      confidence: 'high',
      repairsApplied: coordResult.repairsApplied,
    };
  }

  // 2. Multi-Zone / Geometry Group check: "AREA A ... AREA B" or "ZONE 1 ... ZONE 2"
  const hasMultiZones = /(?:AREA\s+[A-Z0-9]+|ZONE\s+[A-Z0-9]+)[\s\S]+?(?:AREA\s+[A-Z0-9]+|ZONE\s+[A-Z0-9]+)/i.test(rawText);
  if (hasMultiZones && coords.length >= 6) {
    // Split coords into groups (e.g. 4 coords each)
    const polyGroups: NavWarnCoordinate[][] = [];
    const groupSize = Math.floor(coords.length / 2);
    polyGroups.push(coords.slice(0, groupSize));
    polyGroups.push(coords.slice(groupSize));

    return {
      geometry: {
        archetype: 'geometry_group',
        coordinates: coords,
        polygons: polyGroups,
      },
      disambiguationRung: 2,
      confidence: 'high',
      repairsApplied: coordResult.repairsApplied,
    };
  }

  // 3. Multi-Point Array / Table check: discrete labeled points (drifter buoys, point clouds)
  const hasDiscretePointLabels = labels.some(l => l.kind === 'point' || l.kind === 'buoy');
  const hasPolygonKeywords = /(?:AREA\s+BOUNDED\s+BY|IN\s+AREA(?:\s+BOUNDED\s+BY)?|FOOTPRINT|HAZARD\s+AREAS?|IN\s+AREA:)\b/i.test(rawText);

  if (coords.length >= 2 && hasDiscretePointLabels && !hasPolygonKeywords) {
    return {
      geometry: {
        archetype: 'multipoint',
        coordinates: coords,
      },
      disambiguationRung: 3,
      confidence: 'high',
      repairsApplied: coordResult.repairsApplied,
    };
  }

  // 4. Polygon check: 3+ coordinates with boundary wording or 4+ closed boundary points
  if (coords.length >= 3 && (hasPolygonKeywords || coords.length >= 4)) {
    return {
      geometry: {
        archetype: 'polygon',
        coordinates: coords,
        polygons: [coords],
      },
      disambiguationRung: 4,
      confidence: 'high',
      repairsApplied: coordResult.repairsApplied,
    };
  }

  // 4. Linear Corridor check: cable, tow convoy, pipeline with safety berth / width
  const isCorridorLine = /(?:CABLE|PIPELINE|TOWING|TOW\s+CONVOY)\b/i.test(rawText) && /(?:ALONG\s+(?:ROUTE|TRACK|LINE)|ROUTE:|TRACK:)/i.test(rawText);
  const hasCorridorClearance = Boolean(berth?.clearanceNm || berth?.radiusNm || /(?:BUFFER|WIDTH|CORRIDOR|SAFETY\s+ZONE|WIDE\s+BERTH)\b/i.test(rawText));
  if (isCorridorLine && hasCorridorClearance && coords.length >= 2) {
    const clearance = berth?.clearanceNm ?? berth?.radiusNm ?? 0.5;
    return {
      geometry: {
        archetype: 'corridor',
        coordinates: coords,
        clearanceNm: clearance,
      },
      disambiguationRung: 4,
      confidence: 'high',
      repairsApplied: coordResult.repairsApplied,
    };
  }

  // 5. Polyline check: 2+ coordinates with line / trackline wording
  const isPolyline = /(?:LIMIT\s+OF\s+ALL\s+KNOWN\s+ICE|ALONG\s+LINE\s+JOINING|TRACK\s+JOINING|ALONG\s+TRACK)\b/i.test(rawText);
  if ((isPolyline || coords.length >= 2) && coords.length >= 2 && !berth?.radiusNm) {
    return {
      geometry: {
        archetype: 'polyline',
        coordinates: coords,
      },
      disambiguationRung: 5,
      confidence: 'high',
      repairsApplied: coordResult.repairsApplied,
    };
  }

  // 6. Point with Radius check: single coordinate with radius or stated clearance
  if (coords.length === 1 && (berth?.radiusNm || berth?.clearanceNm)) {
    const radius = berth.radiusNm ?? berth.clearanceNm;
    return {
      geometry: {
        archetype: 'point_radius',
        coordinates: coords,
        radiusNm: radius,
        clearanceNm: berth.clearanceNm,
        statedRadiusNm: radius,
      },
      disambiguationRung: 6,
      confidence: 'high',
      repairsApplied: coordResult.repairsApplied,
    };
  }

  // 7. Multi-Point Array / Table check: multiple labeled points (e.g. drifter buoys)
  if (coords.length >= 2 && labels.some(l => l.kind === 'point' || l.kind === 'buoy')) {
    return {
      geometry: {
        archetype: 'multipoint',
        coordinates: coords,
      },
      disambiguationRung: 7,
      confidence: 'high',
      repairsApplied: coordResult.repairsApplied,
    };
  }

  // 8. Solitary Point check: exactly 1 coordinate
  if (coords.length === 1) {
    return {
      geometry: {
        archetype: 'point',
        coordinates: coords,
        clearanceNm: berth?.clearanceNm,
      },
      disambiguationRung: 8,
      confidence: coordResult.confidence,
      repairsApplied: coordResult.repairsApplied,
    };
  }

  // 9. Region / Gazetteer Fallback: No coordinates, but known landmarks
  const hasPlaceName = /(?:JIZAN\s+PORT|QUOIN\s+ISLAND|TANGIER\s+SOUND|GWADAR|BAB\s+EL\s+MANDEB|STRAIT\s+OF\s+HORMUZ)/i.test(rawText);
  if (coords.length === 0 && hasPlaceName) {
    const placeMatch = rawText.match(/(?:JIZAN\s+PORT|QUOIN\s+ISLAND|TANGIER\s+SOUND|GWADAR|BAB\s+EL\s+MANDEB|STRAIT\s+OF\s+HORMUZ)/i);
    return {
      geometry: {
        archetype: 'region',
        coordinates: [],
        regionName: placeMatch ? placeMatch[0].toUpperCase() : undefined,
      },
      disambiguationRung: 9,
      confidence: 'medium',
      repairsApplied: [],
    };
  }

  // 10. Default None (e.g. meta in-force lists, administrative notices, pure service outages)
  return {
    geometry: {
      archetype: 'none',
      coordinates: [],
    },
    disambiguationRung: 10,
    confidence: 'low',
    repairsApplied: [],
  };
}

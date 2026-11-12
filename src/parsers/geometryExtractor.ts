// src/parsers/geometryExtractor.ts
// 11-archetype disambiguation ladder for nautical hazard geometries

import type { Archetype, NavWarnGeometry, NavWarnCoordinate } from '../types/navarea';
import { parseCoordinatesFull, CoordinateParseResult } from './coordinateParser';
import { parseBerthAndRadius } from './berthParser';
import { extractGroupLabels } from './labelExtractor';
import { parseSectorDirective, computeSectorPolygon } from '../core/coordinates';

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

  // 5b. Sector / Arc check: coordinate with directional bearing range
  const sectorDirective = parseSectorDirective(rawText);
  if (coords.length >= 1 && sectorDirective) {
    const radius = sectorDirective.radiusNm ?? berth?.radiusNm ?? berth?.clearanceNm ?? 5.0;
    return {
      geometry: {
        archetype: 'sector_wedge',
        coordinates: coords,
        radiusNm: radius,
        startBearing: sectorDirective.startBearing,
        endBearing: sectorDirective.endBearing,
        statedRadiusNm: radius,
      },
      disambiguationRung: 5.5,
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

import type { MaritimePlot, PlotType, HazardType } from '../types/maritime';
import type { NavWarning } from '../types';
import { computePolygonAreaSqNm, computeDistanceNm, computeLineCorridor } from '../core/coordinates';
import { parseRiglist } from '../riglistParser';
import type { LabeledPoint } from '../riglistParser';

export function extractMaritimePlots(
  warning: NavWarning | { warning_id?: string; warningId?: string; navarea?: string; raw_text?: string; rawText?: string; latitude?: number | null; longitude?: number | null; spatial?: any; title?: string | null; riglist?: any; points?: any; archetype?: string }
): MaritimePlot[] {
  const warningId = warning.warning_id || (warning as any).warningId || 'WARN-001';
  const navarea = warning.navarea || 'IV';
  const rawText = warning.raw_text || (warning as any).rawText || (warning as any).text || '';
  const upper = rawText.toUpperCase();
  const plots: MaritimePlot[] = [];

  // 1. Prefer already-parsed riglist data or alternative keys
  let rigPoints: LabeledPoint[] =
    (warning as any).riglist?.points ??
    (warning as any).points ??
    ((warning as any).archetype === 'multipoint' ? (warning as any).points : []) ??
    [];

  // 2. Fallback: if text contains RIGLIST / MODU keywords and we don't have points yet, parse raw text
  const isRiglistText = /\bRIGLIST\b|\bRIG LIST\b|\bMOBILE OIL RIGS\b|\bMODU\b/i.test(upper);
  if (rigPoints.length === 0 && isRiglistText && rawText.length > 20) {
    try {
      const parsedRig = parseRiglist(rawText);
      if (parsedRig && parsedRig.points && parsedRig.points.length > 0) {
        rigPoints = parsedRig.points;
      }
    } catch (e) {
      console.warn('Failed to parse riglist from text:', e);
    }
  }

  if (rigPoints.length > 0) {
    rigPoints.forEach((pt: LabeledPoint, idx: number) => {
      // Platform point marker
      plots.push({
        id: `${warningId}-rig-${idx}`,
        warningId,
        navarea,
        hazardType: 'platform',
        plotType: 'point',
        coordinates: [pt.position], // [lat, lng]
        label: `${pt.label}${pt.meta ? ' ' + pt.meta : ''}`.trim(),
        rawTextSnippet: rawText.slice(0, 120),
      });

      // 500m safety clearance zone circle
      const clearanceNm = (warning as any).riglist?.clearanceNm ?? 0.27;
      if (clearanceNm > 0) {
        plots.push({
          id: `${warningId}-rig-${idx}-sz`,
          warningId,
          navarea,
          hazardType: 'platform',
          plotType: 'circle',
          coordinates: [pt.position],
          radiusNm: clearanceNm,
          label: `500m safety zone – ${pt.label}`,
          rawTextSnippet: '',
        });
      }
    });
    return plots;
  }

  let hazardType: HazardType = 'other';
  if (/\b(?:FIRING|GUNNERY|MISSILE|ROCKET)\b/i.test(upper)) hazardType = 'firing';
  else if (/\bBOMBING\b/i.test(upper)) hazardType = 'bombing';
  else if (/\b(?:DANGER\s+AREA|RESTRICTED\s+AREA|EXCLUSION\s+ZONE)\b/i.test(upper)) hazardType = 'danger_area';
  else if (/\b(?:SUBMARINE\s+CABLE|CABLE\s+LAYING|CABLE\s+REPAIR)\b/i.test(upper)) hazardType = 'submarine_cable';
  else if (/\b(?:PIPELINE|PIPE\s+SURVEY)\b/i.test(upper)) hazardType = 'pipeline';
  else if (/\bSEISMIC\s+SURVEY\b/i.test(upper)) hazardType = 'seismic_survey';
  else if (/\b(?:WRECK|SUNKEN\s+WRECK|OBSTRUCTION)\b/i.test(upper)) hazardType = 'wreck';
  else if (/\b(?:BUOY|LIGHT|BEACON)\b/i.test(upper)) hazardType = 'buoy';
  else if (/\b(?:RIG|DRILLSHIP|PLATFORM)\b/i.test(upper)) hazardType = 'platform';
  else if (/\b(?:DRIFTING|DERELICT|ADRIFT)\b/i.test(upper)) hazardType = 'drifting_hazard';

  const geomResult = extractGeometry(rawText);
  const geom = geomResult.geometry;

  // 1. Direct extraction from pre-computed PostGIS spatial.geometries and circles
  if (warning.spatial?.circles && warning.spatial.circles.length > 0) {
    warning.spatial.circles.forEach((circ: any, idx: number) => {
      const centerLat = circ.center[1];
      const centerLng = circ.center[0];
      plots.push({
        id: `${warningId}-circle-${idx}`,
        warningId,
        navarea,
        hazardType,
        plotType: 'circle',
        coordinates: [[centerLat, centerLng]],
        radiusNm: circ.radius_nm,
        label: circ.label || `Safety Clearance (${circ.radius_nm} NM)`,
        rawTextSnippet: rawText.slice(0, 80),
      });
    });
  }

  if (warning.spatial?.geometries && warning.spatial.geometries.length > 0) {
    warning.spatial.geometries.forEach((g: any, idx: number) => {
      if ((g.type === 'Polygon' || g.type === 'MultiPolygon') && Array.isArray(g.coordinates)) {
        const ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0]?.[0];
        if (Array.isArray(ring) && ring.length >= 3) {
          const latLngs: [number, number][] = ring.map(([lng, lat]: [number, number]) => [lat, lng]);
          const areaSqNm = computePolygonAreaSqNm(latLngs);
          plots.push({
            id: `${warningId}-spatial-poly-${idx}`,
            warningId,
            navarea,
            hazardType: hazardType === 'other' ? 'danger_area' : hazardType,
            plotType: 'polygon',
            coordinates: latLngs,
            areaSqNm,
            label: g.label || `Danger Area (${areaSqNm} sq NM)`,
            rawTextSnippet: rawText.slice(0, 80),
          });
        }
      } else if ((g.type === 'LineString' || g.type === 'MultiLineString') && Array.isArray(g.coordinates)) {
        const lineCoords = g.type === 'LineString' ? g.coordinates : g.coordinates[0];
        if (Array.isArray(lineCoords) && lineCoords.length >= 2) {
          const latLngs: [number, number][] = lineCoords.map(([lng, lat]: [number, number]) => [lat, lng]);
          const bufferNm = g.buffer_nm || 1.5;
          plots.push({
            id: `${warningId}-spatial-line-${idx}`,
            warningId,
            navarea,
            hazardType: hazardType === 'other' ? 'submarine_cable' : hazardType,
            plotType: bufferNm > 0 ? 'corridor' : 'line',
            coordinates: latLngs,
            bufferNm,
            label: g.label || `Corridor (${bufferNm} NM)`,
            rawTextSnippet: rawText.slice(0, 80),
          });
        }
      } else if (g.type === 'Circle') {
        const center = Array.isArray(g.coordinates) ? g.coordinates : [0, 0];
        const centerLat = center[1];
        const centerLng = center[0];
        const radius = Number(g.radius_nm || g.buffer_nm) || 1.0;
        plots.push({
          id: `${warningId}-spatial-circle-${idx}`,
          warningId,
          navarea,
          hazardType,
          plotType: 'circle',
          coordinates: [[centerLat, centerLng]],
          radiusNm: radius,
          label: g.label || `Safety Zone (${radius} NM)`,
          rawTextSnippet: rawText.slice(0, 80),
        });
      } else if (g.type === 'Point') {
        const coords = Array.isArray(g.coordinates) ? g.coordinates : [0, 0];
        const lat = coords[1];
        const lng = coords[0];
        if (lat !== 0 || lng !== 0) {
          plots.push({
            id: `${warningId}-spatial-point-${idx}`,
            warningId,
            navarea,
            hazardType,
            plotType: 'point',
            coordinates: [[lat, lng]],
            label: g.label || `Hazard Location`,
            rawTextSnippet: rawText.slice(0, 80),
          });
          const buf = Number(g.buffer_nm) || 0;
          if (buf > 0) {
            plots.push({
              id: `${warningId}-spatial-point-buf-${idx}`,
              warningId,
              navarea,
              hazardType,
              plotType: 'circle',
              coordinates: [[lat, lng]],
              radiusNm: buf,
              label: `${g.label || 'Point'} (${buf} NM Safety Zone)`,
              rawTextSnippet: rawText.slice(0, 80),
            });
          }
        }
      }
    });
  }

  if (plots.length > 0) {
    return plots;
  }

  if (geom.polygons && geom.polygons.length > 0) {
    geom.polygons.forEach((poly, idx) => {
      const latLngs: [number, number][] = poly.map(p => [p.lat, p.lng]);
      if (latLngs.length >= 3) {
        const areaSqNm = computePolygonAreaSqNm(latLngs);
        plots.push({
          id: `${warningId}-poly-${idx}`,
          warningId,
          navarea,
          hazardType: hazardType === 'other' ? 'danger_area' : hazardType,
          plotType: 'polygon',
          coordinates: latLngs,
          areaSqNm,
          label: `Danger Area (${areaSqNm} sq NM)`,
          rawTextSnippet: rawText.slice(0, 80),
        });
      }
    });
  } else if (geom.archetype === 'polygon' && geom.coordinates.length >= 3) {
    const latLngs: [number, number][] = geom.coordinates.map(p => [p.lat, p.lng]);
    const areaSqNm = computePolygonAreaSqNm(latLngs);
    plots.push({
      id: `${warningId}-poly-0`,
      warningId,
      navarea,
      hazardType: hazardType === 'other' ? 'danger_area' : hazardType,
      plotType: 'polygon',
      coordinates: latLngs,
      areaSqNm,
      label: `Danger Area (${areaSqNm} sq NM)`,
      rawTextSnippet: rawText.slice(0, 80),
    });
  }

  if (geom.archetype === 'corridor' && geom.coordinates.length >= 2) {
    const latLngs: [number, number][] = geom.coordinates.map(p => [p.lat, p.lng]);
    const corridor = computeLineCorridor(latLngs, geom.clearanceNm || 3.0);
    plots.push({
      id: `${warningId}-corridor-0`,
      warningId,
      navarea,
      hazardType: hazardType === 'other' ? 'submarine_cable' : hazardType,
      plotType: 'corridor',
      coordinates: latLngs,
      bufferNm: geom.clearanceNm || 1.5,
      lengthNm: corridor.lengthNm,
      label: `Corridor Swath (${corridor.lengthNm} NM)`,
      rawTextSnippet: rawText.slice(0, 80),
    });
  } else if ((geom.archetype === 'polyline' || geom.archetype === 'corridor') && geom.coordinates.length >= 2) {
    const latLngs: [number, number][] = geom.coordinates.map(p => [p.lat, p.lng]);
    const lengthNm = computeDistanceNm(latLngs[0], latLngs[latLngs.length - 1]);
    const isCorridor = /(?:BERTH|BUFFER|WIDTH|CORRIDOR)\b/i.test(upper);
    plots.push({
      id: `${warningId}-line-0`,
      warningId,
      navarea,
      hazardType: hazardType === 'other' ? 'submarine_cable' : hazardType,
      plotType: isCorridor ? 'corridor' : 'line',
      coordinates: latLngs,
      lengthNm,
      bufferNm: isCorridor ? 1.5 : undefined,
      label: `${isCorridor ? 'Corridor' : 'Subsea Line'} (${lengthNm} NM)`,
      rawTextSnippet: rawText.slice(0, 80),
    });
  }

  if (geom.archetype === 'sector_wedge' && geom.coordinates.length >= 1 && geom.startBearing != null && geom.endBearing != null) {
    const center: [number, number] = [geom.coordinates[0].lat, geom.coordinates[0].lng];
    const radius = geom.radiusNm || 5.0;
    const sectorPoly = computeSectorPolygon(center, radius, geom.startBearing, geom.endBearing);
    if (sectorPoly.length >= 3) {
      plots.push({
        id: `${warningId}-sector-0`,
        warningId,
        navarea,
        hazardType: hazardType === 'other' ? 'danger_area' : hazardType,
        plotType: 'polygon',
        coordinates: sectorPoly,
        radiusNm: radius,
        bearingDeg: geom.startBearing,
        label: `Sector Arc (${geom.startBearing}°–${geom.endBearing}°, ${radius} NM)`,
        rawTextSnippet: rawText.slice(0, 80),
      });
    }
  }

  if (geom.archetype === 'point_radius' && geom.coordinates.length === 1) {
    const latLngs: [number, number][] = geom.coordinates.map(p => [p.lat, p.lng]);
    plots.push({
      id: `${warningId}-circle-pr`,
      warningId,
      navarea,
      hazardType,
      plotType: 'circle',
      coordinates: latLngs,
      radiusNm: geom.radiusNm || 1.0,
      label: `Clearance Radius (${geom.radiusNm || 1.0} NM)`,
      rawTextSnippet: rawText.slice(0, 80),
    });
  }

  if (plots.length === 0) {
    const lat = warning.latitude != null ? Number(warning.latitude) : (geom.coordinates[0]?.lat ?? null);
    const lng = warning.longitude != null ? Number(warning.longitude) : (geom.coordinates[0]?.lng ?? null);
    if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
      const isDrift = /(?:DRIFTING|ADRIFT|DERELICT)\b/i.test(upper);
      plots.push({
        id: `${warningId}-point-0`,
        warningId,
        navarea,
        hazardType,
        plotType: isDrift ? 'drift_vector' : 'point',
        coordinates: [[lat, lng]],
        bearingDeg: isDrift ? 90 : undefined,
        label: warning.title || `Hazard Point (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
        rawTextSnippet: rawText.slice(0, 80),
      });
    }
  }

  return plots;
}

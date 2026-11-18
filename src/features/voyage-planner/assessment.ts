import {
  booleanIntersects,
  booleanValid,
  distance,
  lineString,
  point,
  pointToLineDistance,
  pointToPolygonDistance,
  polygon,
} from '@turf/turf';
import { calculateRhumbLeg } from './rhumb';
import type { Position, VoyageRoute, Waypoint } from './types';

type Coordinate = [number, number];
type Ring = Coordinate[];
type PolygonCoordinates = Ring[];
const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_METRES = 6_371_008.8;
const METRES_PER_NM = 1_852;
const SAMPLE_STEP_NM = 0.5;
const MAX_ROUTE_SAMPLE_POINTS = 100_000;
const INTERSECTION_TOLERANCE_NM = 0.001;

export type WarningAssessmentStatus = 'INTERSECTS' | 'WITHIN_RANGE' | 'NOT_ASSESSED';

export interface WarningAssessmentGeometryInput {
  feature_type?: string | null;
  buffer_nm?: number | null;
  corridor_half_width_nm?: number | null;
  zone_label?: string | null;
  geojson_blob?: unknown;
}

export interface WarningAssessmentWarningInput {
  id?: string;
  warning_id?: string;
  canonical_id?: string;
  navarea?: string;
  title?: string;
  severity?: string;
  status?: string;
  triage_tier?: string;
  data_quality?: string;
  is_verified?: boolean;
  qa_flags?: string[];
  valid_from?: string | null;
  valid_to?: string | null;
  geometries?: WarningAssessmentGeometryInput[];
}

export interface WarningAssessment {
  warningId: string;
  title: string;
  navarea: string;
  severity: string;
  status: WarningAssessmentStatus;
  nearestLegIndex: number | null;
  nearestFromWaypoint: string | null;
  nearestToWaypoint: string | null;
  nearestDistanceNm: number | null;
  nearestZone: string | null;
  dataQuality: string;
  triageTier: string;
  isVerified: boolean;
  qaFlags: string[];
  validFrom: string | null;
  validTo: string | null;
  hasUnassessedGeometry: boolean;
  hasUnassessedRouteLeg: boolean;
  reason: string | null;
}

export interface RouteWarningAssessment {
  ready: boolean;
  rangeNm: number;
  examinedWarnings: number;
  assessedWarnings: number;
  intersectsCount: number;
  withinRangeCount: number;
  notAssessedCount: number;
  results: WarningAssessment[];
  reason: string | null;
}

interface ParsedGeometry {
  kind: 'point' | 'line' | 'polygon';
  featureType: string;
  zoneLabel: string;
  point?: Coordinate;
  radiusNm: number;
  line?: Coordinate[];
  polygons?: PolygonCoordinates[];
}

interface LegPath {
  index: number;
  from: Waypoint;
  to: Waypoint;
  distanceNm: number;
  centerLongitude: number;
  samples: Coordinate[];
  routeLine: any | null;
  projectedRoute: any;
  unassessedReason: string | null;
}

interface GeometryMeasurement {
  intersects: boolean;
  distanceNm: number;
  legIndex: number;
  zoneLabel: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length >= 2
    && Number.isFinite(value[0]) && Number.isFinite(value[1])
    && value[0] >= -180 && value[0] <= 180
    && value[1] >= -90 && value[1] <= 90;
}

function parseCoordinate(value: unknown): Coordinate | null {
  return isCoordinate(value) ? [value[0], value[1]] : null;
}

function isRing(value: unknown): value is Ring {
  if (!Array.isArray(value) || value.length < 4 || !value.every(isCoordinate)) return false;
  const first = value[0] as Coordinate;
  const last = value[value.length - 1] as Coordinate;
  return first[0] === last[0] && first[1] === last[1];
}

function isPolygonCoordinates(value: unknown): value is PolygonCoordinates {
  return Array.isArray(value) && value.length > 0 && value.every(isRing);
}

function normalizeDeltaLongitude(delta: number): number {
  const full = 360;
  return ((delta + 180) % full + full) % full - 180;
}

function nearestLongitude(longitude: number, reference: number): number {
  return longitude + 360 * Math.round((reference - longitude) / 360);
}

function meanLongitude(coordinates: Coordinate[]): number {
  if (coordinates.length === 0) return 0;
  return coordinates.reduce((sum, coordinate) => sum + coordinate[0], 0) / coordinates.length;
}

function unwrapLine(coordinates: Coordinate[], reference: number): Coordinate[] {
  if (coordinates.length === 0) return [];
  const result: Coordinate[] = [];
  let previous = nearestLongitude(coordinates[0][0], reference);
  result.push([previous, coordinates[0][1]]);
  for (let index = 1; index < coordinates.length; index += 1) {
    previous = nearestLongitude(coordinates[index][0], previous);
    result.push([previous, coordinates[index][1]]);
  }
  return result;
}

function unwrapRing(ring: Ring, reference: number): Ring {
  const result = unwrapLine(ring, reference);
  if (result.length > 1) result[result.length - 1] = [...result[0]];
  const shift = 360 * Math.round((reference - meanLongitude(result)) / 360);
  return result.map(([longitude, latitude]) => [longitude + shift, latitude]);
}

function mercator(coordinate: Coordinate): Coordinate | null {
  const [longitude, latitude] = coordinate;
  if (Math.abs(latitude) >= 90) return null;
  const latitudeRadians = latitude * DEG_TO_RAD;
  const x = EARTH_RADIUS_METRES * longitude * DEG_TO_RAD;
  const y = EARTH_RADIUS_METRES * Math.asinh(Math.tan(latitudeRadians));
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

function interpolateRhumb(from: Position, to: Position, fraction: number, endLongitude: number): Coordinate {
  const latitude1 = from.lat * DEG_TO_RAD;
  const latitude2 = to.lat * DEG_TO_RAD;
  const psi1 = Math.asinh(Math.tan(latitude1));
  const psi2 = Math.asinh(Math.tan(latitude2));
  const psi = psi1 + (psi2 - psi1) * fraction;
  const latitude = Math.atan(Math.sinh(psi)) / DEG_TO_RAD;
  const longitude = from.lon + (endLongitude - from.lon) * fraction;
  return [longitude, latitude];
}

function buildLegPaths(route: VoyageRoute): { legs: LegPath[]; reason: string | null } {
  const calculated = [];
  let totalSamples = 0;

  for (let index = 1; index < route.waypoints.length; index += 1) {
    const from = route.waypoints[index - 1];
    const to = route.waypoints[index];
    const rhumb = calculateRhumbLeg(from.position, to.position);
    const sampleCount = rhumb.status === 'same_position'
      ? 1
      : rhumb.status === 'ok' && rhumb.distanceNm !== null
        ? Math.max(1, Math.ceil(rhumb.distanceNm / SAMPLE_STEP_NM))
        : 0;
    totalSamples += sampleCount + 1;
    calculated.push({ index: index - 1, from, to, rhumb, sampleCount });
  }

  if (totalSamples > MAX_ROUTE_SAMPLE_POINTS) {
    return { legs: [], reason: 'The route exceeds the local geometry-assessment sampling limit.' };
  }

  const legs: LegPath[] = calculated.map(({ index, from, to, rhumb, sampleCount }) => {
    if (rhumb.status !== 'ok' && rhumb.status !== 'same_position') {
      return {
        index, from, to, distanceNm: 0, centerLongitude: from.position.lon,
        samples: [], routeLine: null, projectedRoute: null,
        unassessedReason: 'This route leg cannot be calculated (' + rhumb.status + ').',
      };
    }

    const endLongitude = from.position.lon + normalizeDeltaLongitude(to.position.lon - from.position.lon);
    const centerLongitude = (from.position.lon + endLongitude) / 2;
    if (rhumb.status === 'same_position') {
      const coordinate: Coordinate = [from.position.lon, from.position.lat];
      const projected = mercator(coordinate);
      return {
        index, from, to, distanceNm: 0, centerLongitude,
        samples: [coordinate], routeLine: null,
        projectedRoute: projected ? point(projected) : null,
        unassessedReason: projected ? null : 'The route leg reaches the Mercator projection limit.',
      };
    }

    const samples: Coordinate[] = [];
    for (let step = 0; step <= sampleCount; step += 1) {
      samples.push(interpolateRhumb(from.position, to.position, step / sampleCount, endLongitude));
    }
    const projectedStart = mercator([from.position.lon, from.position.lat]);
    const projectedEnd = mercator([endLongitude, to.position.lat]);
    if (!projectedStart || !projectedEnd) {
      return {
        index, from, to, distanceNm: rhumb.distanceNm ?? 0, centerLongitude,
        samples, routeLine: lineString(samples), projectedRoute: null,
        unassessedReason: 'The route leg reaches the Mercator projection limit.',
      };
    }
    return {
      index, from, to, distanceNm: rhumb.distanceNm ?? 0, centerLongitude,
      samples,
      routeLine: lineString(samples),
      // A spherical rhumb line is straight in Mercator coordinates.
      projectedRoute: lineString([projectedStart, projectedEnd]),
      unassessedReason: null,
    };
  });

  return { legs, reason: null };
}

function parseWarningGeometry(input: unknown): { geometry: ParsedGeometry | null; reason: string | null } {
  if (!isRecord(input)) return { geometry: null, reason: 'Geometry row is malformed.' };
  const featureType = String(input.feature_type ?? '').toUpperCase();
  const zoneLabel = typeof input.zone_label === 'string' && input.zone_label.trim()
    ? input.zone_label
    : featureType || 'Unlabelled zone';
  const bufferNm = input.buffer_nm == null ? 0 : Number(input.buffer_nm);
  const corridorWidth = input.corridor_half_width_nm == null ? 0 : Number(input.corridor_half_width_nm);

  if (!Number.isFinite(bufferNm) || bufferNm < 0 || !Number.isFinite(corridorWidth) || corridorWidth < 0) {
    return { geometry: null, reason: 'Geometry buffer metadata is invalid.' };
  }
  if (!isRecord(input.geojson_blob)) return { geometry: null, reason: 'GeoJSON geometry is missing or malformed.' };

  const blob = input.geojson_blob;
  if (featureType === 'POINT' && blob.type === 'Point') {
    const coordinate = parseCoordinate(blob.coordinates);
    if (!coordinate) return { geometry: null, reason: 'Point coordinates are invalid.' };
    if (corridorWidth > 0) return { geometry: null, reason: 'Point corridor-width metadata is unsupported.' };
    if (!booleanValid(blob as any)) return { geometry: null, reason: 'Point geometry failed GeoJSON validation.' };
    return {
      geometry: { kind: 'point', featureType, zoneLabel, point: coordinate, radiusNm: bufferNm },
      reason: null,
    };
  }

  if (featureType === 'LINE' && blob.type === 'LineString') {
    if (!Array.isArray(blob.coordinates) || blob.coordinates.length < 2) {
      return { geometry: null, reason: 'LineString coordinates are invalid.' };
    }
    const coordinates = blob.coordinates.map(parseCoordinate);
    if (coordinates.some((coordinate) => coordinate === null || Math.abs(coordinate[1]) >= 90)) {
      return { geometry: null, reason: 'LineString coordinates are invalid.' };
    }
    if (bufferNm > 0 || corridorWidth > 0) {
      return { geometry: null, reason: 'Buffered line or corridor-width semantics are not verified.' };
    }
    if (!booleanValid(blob as any)) return { geometry: null, reason: 'LineString failed GeoJSON validation.' };
    return {
      geometry: { kind: 'line', featureType, zoneLabel, line: coordinates as Coordinate[], radiusNm: 0 },
      reason: null,
    };
  }

  if ((featureType === 'POLYGON' && (blob.type === 'Polygon' || blob.type === 'MultiPolygon'))
    || (featureType === 'BOUNDING_BOX' && blob.type === 'Polygon')) {
    let polygons: PolygonCoordinates[];
    if (blob.type === 'Polygon') {
      if (!isPolygonCoordinates(blob.coordinates)) {
        return { geometry: null, reason: 'Polygon rings are invalid.' };
      }
      polygons = [blob.coordinates as PolygonCoordinates];
    } else {
      if (!Array.isArray(blob.coordinates) || blob.coordinates.length === 0
        || !blob.coordinates.every(isPolygonCoordinates)) {
        return { geometry: null, reason: 'MultiPolygon rings are invalid.' };
      }
      polygons = blob.coordinates as PolygonCoordinates[];
    }
    if (polygons.some((rings) => rings.some((ring) => ring.some((coordinate) => Math.abs(coordinate[1]) >= 90)))) {
      return { geometry: null, reason: 'Polygon geometry reaches the exact pole and is not supported by this assessment.' };
    }
    if (bufferNm > 0 || corridorWidth > 0) {
      return { geometry: null, reason: 'Buffered polygon or corridor-width semantics are not verified.' };
    }
    if (!booleanValid(blob as any)) return { geometry: null, reason: 'Polygon topology failed GeoJSON validation.' };
    return {
      geometry: { kind: 'polygon', featureType, zoneLabel, polygons, radiusNm: 0 },
      reason: null,
    };
  }

  return {
    geometry: null,
    reason: 'Unsupported or mismatched feature type (' + (featureType || 'missing') + ' / ' + String(blob.type ?? 'missing') + ').',
  };
}

function makePolygonForLeg(rings: PolygonCoordinates, referenceLongitude: number): { feature: any; projected: any; coordinates: PolygonCoordinates } | null {
  const outer = unwrapRing(rings[0], referenceLongitude);
  const outerCenter = meanLongitude(outer);
  const holes = rings.slice(1).map((ring) => unwrapRing(ring, outerCenter));
  const coordinates = [outer, ...holes];
  const projectedCoordinates: PolygonCoordinates = [];
  for (const ring of coordinates) {
    const projectedRing: Coordinate[] = [];
    for (const coordinate of ring) {
      const projected = mercator(coordinate);
      if (!projected) return null;
      projectedRing.push(projected);
    }
    projectedCoordinates.push(projectedRing);
  }
  return {
    feature: polygon(coordinates),
    projected: polygon(projectedCoordinates),
    coordinates,
  };
}

function measureGeometryOnLeg(geometry: ParsedGeometry, leg: LegPath): GeometryMeasurement {
  if (geometry.kind === 'point' && geometry.point) {
    const aligned: Coordinate = [nearestLongitude(geometry.point[0], leg.centerLongitude), geometry.point[1]];
    const pointFeature = point(aligned);
    const projectedPoint = mercator(aligned);
    const projectedIntersection = Boolean(projectedPoint && leg.projectedRoute
      && booleanIntersects(leg.projectedRoute, point(projectedPoint)));
    const centerDistance = leg.routeLine
      ? pointToLineDistance(pointFeature, leg.routeLine, { units: 'nauticalmiles', method: 'geodesic' })
      : distance(pointFeature, point(leg.samples[0]), { units: 'nauticalmiles' });
    const distanceToFootprint = projectedIntersection ? 0 : Math.max(0, centerDistance - geometry.radiusNm);
    return {
      intersects: projectedIntersection || centerDistance <= geometry.radiusNm + INTERSECTION_TOLERANCE_NM,
      distanceNm: distanceToFootprint,
      legIndex: leg.index,
      zoneLabel: geometry.zoneLabel,
    };
  }

  if (geometry.kind === 'line' && geometry.line) {
    const coordinates = unwrapLine(geometry.line, leg.centerLongitude);
    const lineFeature = lineString(coordinates);
    const projectedCoordinates = coordinates.map(mercator);
    if (projectedCoordinates.some((coordinate) => coordinate === null) || !leg.projectedRoute) {
      return {
        intersects: false, distanceNm: Number.POSITIVE_INFINITY,
        legIndex: leg.index, zoneLabel: geometry.zoneLabel,
      };
    }
    const projectedLine = lineString(projectedCoordinates as Coordinate[]);
    const intersects = booleanIntersects(leg.projectedRoute, projectedLine);
    if (intersects) {
      return { intersects: true, distanceNm: 0, legIndex: leg.index, zoneLabel: geometry.zoneLabel };
    }

    let minimum = Number.POSITIVE_INFINITY;
    for (const sample of leg.samples) {
      const aligned: Coordinate = [nearestLongitude(sample[0], leg.centerLongitude), sample[1]];
      minimum = Math.min(minimum, pointToLineDistance(point(aligned), lineFeature, {
        units: 'nauticalmiles', method: 'geodesic',
      }));
    }
    if (leg.routeLine) {
      for (const coordinate of coordinates) {
        minimum = Math.min(minimum, pointToLineDistance(point(coordinate), leg.routeLine, {
          units: 'nauticalmiles', method: 'geodesic',
        }));
      }
    }
    return {
      intersects: false, distanceNm: minimum,
      legIndex: leg.index, zoneLabel: geometry.zoneLabel,
    };
  }

  if (geometry.kind === 'polygon' && geometry.polygons) {
    let minimum = Number.POSITIVE_INFINITY;
    for (const rings of geometry.polygons) {
      const prepared = makePolygonForLeg(rings, leg.centerLongitude);
      if (!prepared || !leg.projectedRoute) continue;
      if (booleanIntersects(leg.projectedRoute, prepared.projected)) {
        return { intersects: true, distanceNm: 0, legIndex: leg.index, zoneLabel: geometry.zoneLabel };
      }
      const polygonFeature = prepared.feature;
      for (const sample of leg.samples) {
        const aligned: Coordinate = [nearestLongitude(sample[0], leg.centerLongitude), sample[1]];
        const distanceToPolygon = pointToPolygonDistance(point(aligned), polygonFeature, {
          units: 'nauticalmiles', method: 'geodesic',
        });
        minimum = Math.min(minimum, Math.max(0, distanceToPolygon));
      }
      if (leg.routeLine) {
        for (const ring of prepared.coordinates) {
          for (let index = 0; index < ring.length - 1; index += 1) {
            minimum = Math.min(minimum, pointToLineDistance(point(ring[index]), leg.routeLine, {
              units: 'nauticalmiles', method: 'geodesic',
            }));
          }
        }
      }
    }
    return {
      intersects: false, distanceNm: minimum,
      legIndex: leg.index, zoneLabel: geometry.zoneLabel,
    };
  }

  return {
    intersects: false, distanceNm: Number.POSITIVE_INFINITY,
    legIndex: leg.index, zoneLabel: geometry.zoneLabel,
  };
}

function warningIdentity(warning: WarningAssessmentWarningInput): string {
  return warning.canonical_id || warning.warning_id || warning.id || 'Unknown warning';
}

function notAssessedResult(
  warning: WarningAssessmentWarningInput,
  reason: string,
  hasUnassessedGeometry = true,
  hasUnassessedRouteLeg = false,
): WarningAssessment {
  return {
    warningId: warningIdentity(warning),
    title: warning.title || warningIdentity(warning),
    navarea: warning.navarea || 'Unknown NAVAREA',
    severity: warning.severity || 'unknown',
    status: 'NOT_ASSESSED',
    nearestLegIndex: null,
    nearestFromWaypoint: null,
    nearestToWaypoint: null,
    nearestDistanceNm: null,
    nearestZone: null,
    dataQuality: warning.data_quality || 'unknown',
    triageTier: warning.triage_tier || 'unknown',
    isVerified: warning.is_verified === true,
    qaFlags: Array.isArray(warning.qa_flags) ? warning.qa_flags : [],
    validFrom: warning.valid_from ?? null,
    validTo: warning.valid_to ?? null,
    hasUnassessedGeometry,
    hasUnassessedRouteLeg,
    reason,
  };
}

export function assessRouteWarnings(
  route: VoyageRoute,
  warnings: WarningAssessmentWarningInput[],
): RouteWarningAssessment {
  const safeWarnings = Array.isArray(warnings)
    ? warnings.filter((warning) => isRecord(warning)) as WarningAssessmentWarningInput[]
    : [];

  if (route.waypoints.length < 2) {
    return {
      ready: false, rangeNm: route.warningRangeNm,
      examinedWarnings: safeWarnings.length, assessedWarnings: 0,
      intersectsCount: 0, withinRangeCount: 0, notAssessedCount: 0,
      results: [], reason: 'Add at least two waypoints before assessing warnings.',
    };
  }

  const built = buildLegPaths(route);
  if (built.reason) {
    const results = safeWarnings.map((warning) => notAssessedResult(warning, built.reason!, false, true));
    return {
      ready: true, rangeNm: route.warningRangeNm,
      examinedWarnings: safeWarnings.length, assessedWarnings: 0,
      intersectsCount: 0, withinRangeCount: 0, notAssessedCount: results.length,
      results, reason: built.reason,
    };
  }

  const legs = built.legs;
  const hasUnassessedRouteLeg = legs.some((leg) => Boolean(leg.unassessedReason));
  const routeLegReason = legs.find((leg) => leg.unassessedReason)?.unassessedReason ?? null;
  const results: WarningAssessment[] = [];
  let assessedWarnings = 0;

  for (const warning of safeWarnings) {
    if (warning.status !== 'active' || warning.triage_tier !== 'A'
      || warning.data_quality !== 'EXPLICIT' || warning.is_verified !== true) {
      results.push(notAssessedResult(
        warning,
        'Warning quality or verification state does not meet the assessment gate.',
        false,
        false,
      ));
      continue;
    }

    if (!Array.isArray(warning.geometries) || warning.geometries.length === 0) {
      results.push(notAssessedResult(warning, 'No valid warning geometry was loaded.'));
      continue;
    }

    const parsed = warning.geometries.map((input) => parseWarningGeometry(input));
    const unsupported = parsed.find((item) => !item.geometry);
    const validGeometries = parsed
      .map((item) => item.geometry)
      .filter((geometry): geometry is ParsedGeometry => geometry !== null);
    if (validGeometries.length === 0) {
      results.push(notAssessedResult(warning, unsupported?.reason || 'No supported warning geometry was loaded.'));
      continue;
    }

    let best: GeometryMeasurement | null = null;
    let intersects = false;
    let measurementFailure = false;
    for (const geometry of validGeometries) {
      for (const leg of legs) {
        if (leg.unassessedReason) continue;
        try {
          const measured = measureGeometryOnLeg(geometry, leg);
          if (!Number.isFinite(measured.distanceNm)) {
            measurementFailure = true;
            continue;
          }
          if (!best || measured.distanceNm < best.distanceNm) best = measured;
          if (measured.intersects) {
            intersects = true;
            best = measured;
            break;
          }
        } catch {
          measurementFailure = true;
        }
      }
      if (intersects) break;
    }

    if (intersects) {
      if (!unsupported && !measurementFailure && !hasUnassessedRouteLeg) assessedWarnings += 1;
      results.push({
        warningId: warningIdentity(warning),
        title: warning.title || warningIdentity(warning),
        navarea: warning.navarea || 'Unknown NAVAREA',
        severity: warning.severity || 'unknown',
        status: 'INTERSECTS',
        nearestLegIndex: best?.legIndex == null ? null : best.legIndex + 1,
        nearestFromWaypoint: best ? legs[best.legIndex]?.from.name ?? null : null,
        nearestToWaypoint: best ? legs[best.legIndex]?.to.name ?? null : null,
        nearestDistanceNm: 0,
        nearestZone: best?.zoneLabel ?? null,
        dataQuality: warning.data_quality || 'unknown',
        triageTier: warning.triage_tier || 'unknown',
        isVerified: warning.is_verified === true,
        qaFlags: Array.isArray(warning.qa_flags) ? warning.qa_flags : [],
        validFrom: warning.valid_from ?? null,
        validTo: warning.valid_to ?? null,
        hasUnassessedGeometry: Boolean(unsupported) || measurementFailure,
        hasUnassessedRouteLeg,
        reason: unsupported?.reason || (measurementFailure ? 'A geometry could not be safely measured.' : routeLegReason),
      });
      continue;
    }

    if (unsupported || measurementFailure || hasUnassessedRouteLeg || !best) {
      results.push({
        ...notAssessedResult(
          warning,
          unsupported?.reason || (measurementFailure ? 'A geometry could not be safely measured.' : null)
            || routeLegReason || 'No supported geometry could be assessed.',
          Boolean(unsupported) || measurementFailure,
          hasUnassessedRouteLeg,
        ),
        nearestLegIndex: best ? best.legIndex + 1 : null,
        nearestFromWaypoint: best ? legs[best.legIndex]?.from.name ?? null : null,
        nearestToWaypoint: best ? legs[best.legIndex]?.to.name ?? null : null,
        nearestDistanceNm: best ? Number(best.distanceNm.toFixed(2)) : null,
        nearestZone: best?.zoneLabel ?? null,
      });
      continue;
    }

    assessedWarnings += 1;
    if (best.distanceNm <= route.warningRangeNm) {
      results.push({
        warningId: warningIdentity(warning),
        title: warning.title || warningIdentity(warning),
        navarea: warning.navarea || 'Unknown NAVAREA',
        severity: warning.severity || 'unknown',
        status: 'WITHIN_RANGE',
        nearestLegIndex: best.legIndex + 1,
        nearestFromWaypoint: legs[best.legIndex]?.from.name ?? null,
        nearestToWaypoint: legs[best.legIndex]?.to.name ?? null,
        nearestDistanceNm: Number(best.distanceNm.toFixed(2)),
        nearestZone: best.zoneLabel,
        dataQuality: warning.data_quality || 'unknown',
        triageTier: warning.triage_tier || 'unknown',
        isVerified: warning.is_verified === true,
        qaFlags: Array.isArray(warning.qa_flags) ? warning.qa_flags : [],
        validFrom: warning.valid_from ?? null,
        validTo: warning.valid_to ?? null,
        hasUnassessedGeometry: false,
        hasUnassessedRouteLeg: false,
        reason: null,
      });
    }
  }

  const priority: Record<WarningAssessmentStatus, number> = {
    INTERSECTS: 0,
    WITHIN_RANGE: 1,
    NOT_ASSESSED: 2,
  };
  results.sort((a, b) => priority[a.status] - priority[b.status]
    || (a.nearestDistanceNm ?? Number.POSITIVE_INFINITY) - (b.nearestDistanceNm ?? Number.POSITIVE_INFINITY)
    || a.warningId.localeCompare(b.warningId));

  return {
    ready: true,
    rangeNm: route.warningRangeNm,
    examinedWarnings: safeWarnings.length,
    assessedWarnings,
    intersectsCount: results.filter((result) => result.status === 'INTERSECTS').length,
    withinRangeCount: results.filter((result) => result.status === 'WITHIN_RANGE').length,
    notAssessedCount: results.filter((result) => result.status === 'NOT_ASSESSED').length,
    results,
    reason: hasUnassessedRouteLeg ? routeLegReason : null,
  };
}

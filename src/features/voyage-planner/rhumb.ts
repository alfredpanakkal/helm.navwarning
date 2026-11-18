import type { LegResult, Position } from './types';

export const EARTH_RADIUS_METRES = 6_371_008.8;
export const METRES_PER_NAUTICAL_MILE = 1_852;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EPSILON = 1e-12;

function isValidPosition(position: Position): boolean {
  return Number.isFinite(position.lat) && Number.isFinite(position.lon)
    && position.lat >= -90 && position.lat <= 90
    && position.lon >= -180 && position.lon <= 180;
}

function isometricLatitude(latitudeRadians: number): number {
  return Math.asinh(Math.tan(latitudeRadians));
}

function normalizeDeltaLongitude(delta: number): number {
  const full = 2 * Math.PI;
  return ((delta + Math.PI) % full + full) % full - Math.PI;
}

export interface RhumbResult {
  status: LegResult['status'];
  distanceNm: number | null;
  courseDeg: number | null;
}

/** Spherical rhumb-line calculation. Exact poles and 180° longitude ties are deliberately not guessed. */
export function calculateRhumbLeg(from: Position, to: Position): RhumbResult {
  if (!isValidPosition(from) || !isValidPosition(to)) {
    return { status: 'invalid_position', distanceNm: null, courseDeg: null };
  }
  if (from.lat === to.lat && from.lon === to.lon) {
    return { status: 'same_position', distanceNm: 0, courseDeg: null };
  }
  if (Math.abs(from.lat) === 90 || Math.abs(to.lat) === 90) {
    return { status: 'pole', distanceNm: null, courseDeg: null };
  }

  const phi1 = from.lat * DEG_TO_RAD;
  const phi2 = to.lat * DEG_TO_RAD;
  const rawDeltaLambda = (to.lon - from.lon) * DEG_TO_RAD;
  if (Math.abs(Math.abs(rawDeltaLambda) - Math.PI) <= EPSILON) {
    return { status: 'ambiguous_longitude', distanceNm: null, courseDeg: null };
  }

  const deltaLambda = normalizeDeltaLongitude(rawDeltaLambda);
  const deltaPhi = phi2 - phi1;
  const deltaPsi = isometricLatitude(phi2) - isometricLatitude(phi1);
  const q = Math.abs(deltaPsi) > EPSILON ? deltaPhi / deltaPsi : Math.cos(phi1);
  const angularDistance = Math.hypot(deltaPhi, q * deltaLambda);
  const distanceNm = (angularDistance * EARTH_RADIUS_METRES) / METRES_PER_NAUTICAL_MILE;
  const course = (Math.atan2(deltaLambda, deltaPsi) * RAD_TO_DEG + 360) % 360;

  return {
    status: 'ok',
    distanceNm,
    courseDeg: Number.isFinite(course) ? course : null,
  };
}

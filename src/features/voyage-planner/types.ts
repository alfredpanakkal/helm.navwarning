export interface Position {
  lat: number;
  lon: number;
}

export interface Waypoint {
  id: string;
  name: string;
  position: Position;
  /** Optional speed for the leg arriving at this waypoint. */
  speedKn?: number;
}

export interface VoyageRoute {
  id: string;
  name: string;
  waypoints: Waypoint[];
  defaultSpeedKn: number;
  warningRangeNm: number;
  departureTimeUtc?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Ok<T> {
  ok: true;
  value: T;
}

export interface Err<E> {
  ok: false;
  error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export type ParseResult<T = Position> = Result<T, string>;

export type LegStatus =
  | 'ok'
  | 'same_position'
  | 'pole'
  | 'ambiguous_longitude'
  | 'invalid_position';

export interface LegResult {
  fromWaypointId: string;
  toWaypointId: string;
  status: LegStatus;
  distanceNm: number | null;
  courseDeg: number | null;
  speedKn: number | null;
  durationHours: number | null;
  etaUtc: string | null;
}

export interface RouteCalculation {
  legs: LegResult[];
  totalDistanceNm: number;
  arrivalTimeUtc: string | null;
  status: 'ok' | 'incomplete';
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type RouteLoadResult =
  | { status: 'empty'; routes: VoyageRoute[] }
  | { status: 'loaded'; routes: VoyageRoute[] }
  | { status: 'corrupt'; routes: []; reason: string }
  | { status: 'unsupported_version'; routes: []; version: unknown }
  | { status: 'storage_error'; routes: []; reason: string };

export type RouteSaveResult =
  | { ok: true }
  | { ok: false; reason: 'storage_unavailable' | 'storage_error' | 'invalid_routes'; detail?: string };

export interface OperationContext {
  idFactory: () => string;
  now: () => string;
}

export const MAX_WAYPOINTS = 200;
export const MIN_SPEED_KN = 0;
export const MAX_SPEED_KN = 50;
export const MIN_WARNING_RANGE_NM = 1;
export const MAX_WARNING_RANGE_NM = 100;
export const DEFAULT_WARNING_RANGE_NM = 10;
export const MAX_WAYPOINT_NAME_LENGTH = 40;
export const MAX_ROUTE_NAME_LENGTH = 80;
export const MAX_ID_LENGTH = 64;

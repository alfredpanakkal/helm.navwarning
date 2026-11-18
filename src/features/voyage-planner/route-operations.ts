import { voyageRouteSchema, waypointSchema } from './schema';
import type { OperationContext, Result, VoyageRoute, Waypoint } from './types';
import { MAX_WAYPOINTS } from './types';

export type RouteOperationError =
  | 'invalid_route'
  | 'invalid_waypoint'
  | 'route_not_found'
  | 'waypoint_not_found'
  | 'duplicate_id'
  | 'waypoint_limit'
  | 'invalid_index';

function validRoute(route: VoyageRoute): boolean {
  return voyageRouteSchema.safeParse(route).success;
}

function fail<T>(error: RouteOperationError): Result<T, RouteOperationError> {
  return { ok: false, error };
}

function succeed<T>(value: T): Result<T, RouteOperationError> {
  return { ok: true, value };
}

export function createRoute(
  name: string,
  defaultSpeedKn: number,
  context: OperationContext,
  warningRangeNm = 25,
): Result<VoyageRoute, RouteOperationError> {
  const now = context.now();
  const route: VoyageRoute = {
    id: context.idFactory(),
    name,
    waypoints: [],
    defaultSpeedKn,
    warningRangeNm,
    createdAt: now,
    updatedAt: now,
  };
  return validRoute(route) ? succeed(route) : fail('invalid_route');
}

export function renameRoute(route: VoyageRoute, name: string, context: OperationContext): Result<VoyageRoute, RouteOperationError> {
  const next = { ...route, name, updatedAt: context.now() };
  return validRoute(next) ? succeed(next) : fail('invalid_route');
}

export function addWaypoint(route: VoyageRoute, waypoint: Omit<Waypoint, 'id'> & { id?: string }, context: OperationContext): Result<VoyageRoute, RouteOperationError> {
  if (!validRoute(route)) return fail('invalid_route');
  if (route.waypoints.length >= MAX_WAYPOINTS) return fail('waypoint_limit');
  const nextWaypoint: Waypoint = { ...waypoint, id: waypoint.id ?? context.idFactory() };
  if (!waypointSchema.safeParse(nextWaypoint).success) return fail('invalid_waypoint');
  if (route.waypoints.some((item) => item.id === nextWaypoint.id)) return fail('duplicate_id');
  const next = { ...route, waypoints: [...route.waypoints, nextWaypoint], updatedAt: context.now() };
  return succeed(next);
}

export function updateWaypoint(route: VoyageRoute, waypointId: string, changes: Partial<Omit<Waypoint, 'id'>>, context: OperationContext): Result<VoyageRoute, RouteOperationError> {
  if (!validRoute(route)) return fail('invalid_route');
  const index = route.waypoints.findIndex((item) => item.id === waypointId);
  if (index < 0) return fail('waypoint_not_found');
  const updated = { ...route.waypoints[index], ...changes, id: waypointId };
  if (!waypointSchema.safeParse(updated).success) return fail('invalid_waypoint');
  const waypoints = route.waypoints.map((item, i) => i === index ? updated : item);
  return succeed({ ...route, waypoints, updatedAt: context.now() });
}

export function removeWaypoint(route: VoyageRoute, waypointId: string, context: OperationContext): Result<VoyageRoute, RouteOperationError> {
  if (!validRoute(route)) return fail('invalid_route');
  if (!route.waypoints.some((item) => item.id === waypointId)) return fail('waypoint_not_found');
  return succeed({
    ...route,
    waypoints: route.waypoints.filter((item) => item.id !== waypointId),
    updatedAt: context.now(),
  });
}

export function reorderWaypoint(route: VoyageRoute, fromIndex: number, toIndex: number, context: OperationContext): Result<VoyageRoute, RouteOperationError> {
  if (!validRoute(route)) return fail('invalid_route');
  const length = route.waypoints.length;
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || toIndex < 0 || fromIndex >= length || toIndex >= length) {
    return fail('invalid_index');
  }
  if (fromIndex === toIndex) return succeed(route);
  const waypoints = [...route.waypoints];
  const [moved] = waypoints.splice(fromIndex, 1);
  waypoints.splice(toIndex, 0, moved);
  return succeed({ ...route, waypoints, updatedAt: context.now() });
}

export function deleteRoute(routes: VoyageRoute[], routeId: string): Result<VoyageRoute[], RouteOperationError> {
  if (!routes.some((route) => route.id === routeId)) return fail('route_not_found');
  return succeed(routes.filter((route) => route.id !== routeId));
}

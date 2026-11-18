import { z } from 'zod';
import {
  DEFAULT_WARNING_RANGE_NM,
  MAX_ID_LENGTH,
  MAX_ROUTE_NAME_LENGTH,
  MAX_SPEED_KN,
  MAX_WAYPOINT_NAME_LENGTH,
  MAX_WAYPOINTS,
  MIN_SPEED_KN,
  MAX_WARNING_RANGE_NM,
  MIN_WARNING_RANGE_NM,
} from './types';
import type { Position, VoyageRoute, Waypoint } from './types';

const idSchema = z.string().min(1).max(MAX_ID_LENGTH).regex(/^[A-Za-z0-9_-]+$/);
const nameSchema = (max: number) => z.string().trim().min(1).max(max);
const speedSchema = z.number().finite().gt(MIN_SPEED_KN).max(MAX_SPEED_KN);
const positionSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
}).strict();

const utcDateTimeSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/, 'Expected an ISO 8601 UTC timestamp ending in Z')
  .refine((value) => {
    if (!Number.isFinite(Date.parse(value))) return false;
    const canonical = new Date(value).toISOString().replace(/\.000Z$/, 'Z');
    return canonical === value;
  }, 'Invalid UTC timestamp');

export const waypointSchema = z.object({
  id: idSchema,
  name: nameSchema(MAX_WAYPOINT_NAME_LENGTH),
  position: positionSchema,
  speedKn: speedSchema.optional(),
}).strict();

export const voyageRouteSchema = z.object({
  id: idSchema,
  name: nameSchema(MAX_ROUTE_NAME_LENGTH),
  waypoints: z.array(waypointSchema).max(MAX_WAYPOINTS),
  defaultSpeedKn: speedSchema,
  warningRangeNm: z.number().finite().min(MIN_WARNING_RANGE_NM).max(MAX_WARNING_RANGE_NM)
    .default(DEFAULT_WARNING_RANGE_NM),
  departureTimeUtc: utcDateTimeSchema.optional(),
  createdAt: utcDateTimeSchema,
  updatedAt: utcDateTimeSchema,
}).strict().superRefine((route, ctx) => {
  const ids = new Set<string>();
  route.waypoints.forEach((waypoint, index) => {
    if (ids.has(waypoint.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['waypoints', index, 'id'],
        message: 'Waypoint IDs must be unique within a route',
      });
    }
    ids.add(waypoint.id);
  });
});

export const routeCollectionSchema = z.object({
  version: z.literal(1),
  routes: z.array(voyageRouteSchema),
}).strict();

export type PositionInput = z.infer<typeof positionSchema>;
export type WaypointInput = z.infer<typeof waypointSchema>;
export type VoyageRouteInput = z.infer<typeof voyageRouteSchema>;

export function isPosition(value: unknown): value is Position {
  return positionSchema.safeParse(value).success;
}

export function isWaypoint(value: unknown): value is Waypoint {
  return waypointSchema.safeParse(value).success;
}

export function isVoyageRoute(value: unknown): value is VoyageRoute {
  return voyageRouteSchema.safeParse(value).success;
}

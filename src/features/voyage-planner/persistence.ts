import { routeCollectionSchema } from './schema';
import type { RouteLoadResult, RouteSaveResult, StorageLike, VoyageRoute } from './types';

export const VOYAGE_PLANNER_STORAGE_KEY = 'helm_voyage_planner_v1';
const STORAGE_VERSION = 1;

export function loadRoutes(storage: StorageLike): RouteLoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(VOYAGE_PLANNER_STORAGE_KEY);
  } catch (error) {
    return { status: 'storage_error', routes: [], reason: error instanceof Error ? error.message : 'Storage read failed' };
  }
  if (raw === null) return { status: 'empty', routes: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', routes: [], reason: 'Stored route data is not valid JSON; original data was preserved.' };
  }

  if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version !== STORAGE_VERSION) {
    return { status: 'unsupported_version', routes: [], version: parsed.version };
  }
  const result = routeCollectionSchema.safeParse(parsed);
  if (!result.success) {
    return { status: 'corrupt', routes: [], reason: 'Stored route data failed validation; original data was preserved.' };
  }
  return result.data.routes.length
    ? { status: 'loaded', routes: result.data.routes }
    : { status: 'empty', routes: [] };
}

export function saveRoutes(storage: StorageLike, routes: VoyageRoute[]): RouteSaveResult {
  const validation = routeCollectionSchema.safeParse({ version: STORAGE_VERSION, routes });
  if (!validation.success) return { ok: false, reason: 'invalid_routes', detail: validation.error.issues[0]?.message };
  try {
    storage.setItem(VOYAGE_PLANNER_STORAGE_KEY, JSON.stringify(validation.data));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'storage_error', detail: error instanceof Error ? error.message : 'Storage write failed' };
  }
}

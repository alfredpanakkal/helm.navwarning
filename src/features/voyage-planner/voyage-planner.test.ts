import { describe, expect, it } from 'vitest';
import {
  addWaypoint,
  calculateRhumbLeg,
  calculateRoute,
  createRoute,
  formatLatitude,
  formatLongitude,
  loadRoutes,
  parseCoordinates,
  reorderWaypoint,
  saveRoutes,
  VOYAGE_PLANNER_STORAGE_KEY,
  wrapLongitudeForChart,
  MAX_WAYPOINTS,
  type StorageLike,
  type VoyageRoute,
} from './index';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

const context = { idFactory: () => 'wp_1', now: () => '2026-11-18T00:00:00Z' };
const route: VoyageRoute = {
  id: 'route_1',
  name: 'Test route',
  waypoints: [
    { id: 'a', name: 'A', position: { lat: 0, lon: 0 } },
    { id: 'b', name: 'B', position: { lat: 1, lon: 1 } },
  ],
  defaultSpeedKn: 10,
  warningRangeNm: 25,
  departureTimeUtc: '2026-11-18T00:00:00Z',
  createdAt: '2026-11-18T00:00:00Z',
  updatedAt: '2026-11-18T00:00:00Z',
};

describe('voyage planner coordinates', () => {
  it('requires hemispheres and rejects invalid minutes/ranges', () => {
    expect(parseCoordinates('12° 30.00', '045° 15.00 E').ok).toBe(false);
    expect(parseCoordinates('12° 60.00 N', '045° 15.00 E').ok).toBe(false);
    expect(parseCoordinates('91° 00.00 N', '045° 15.00 E').ok).toBe(false);
    expect(parseCoordinates('12° 30.00 N', '181° 00.00 E').ok).toBe(false);
    expect(parseCoordinates('12° 30.00 N', '045° 15.00 E')).toEqual({
      ok: true, value: { lat: 12.5, lon: 45.25 },
    });
  });

  it('formats with padding and carries rounded minutes', () => {
    expect(formatLatitude(9 + 59.999 / 60)).toBe("10° 00.00' N");
    expect(formatLongitude(-45.5)).toBe("045° 30.00' W");
  });

  it('wraps chart longitude without changing the stored coordinate', () => {
    expect(wrapLongitudeForChart(181)).toBe(-179);
    expect(wrapLongitudeForChart(180)).toBe(-180);
    expect(route.waypoints[1].position.lon).toBe(1);
  });
});

describe('rhumb calculations', () => {
  it('returns zero distance and no course for identical positions', () => {
    expect(calculateRhumbLeg({ lat: 10, lon: 20 }, { lat: 10, lon: 20 })).toEqual({
      status: 'same_position', distanceNm: 0, courseDeg: null,
    });
  });

  it('rejects exact poles and exact 180-degree longitude ties', () => {
    expect(calculateRhumbLeg({ lat: 90, lon: 0 }, { lat: 89, lon: 1 }).status).toBe('pole');
    expect(calculateRhumbLeg({ lat: 0, lon: 0 }, { lat: 0, lon: 180 }).status).toBe('ambiguous_longitude');
  });

  it('calculates finite rhumb distances close to, but not at, the poles', () => {
    for (const latitude of [89.9, 89.99, 89.999]) {
      const result = calculateRhumbLeg({ lat: latitude, lon: 0 }, { lat: latitude, lon: 1 });
      expect(result.status).toBe('ok');
      expect(Number.isFinite(result.distanceNm)).toBe(true);
      expect(Number.isFinite(result.courseDeg)).toBe(true);
    }
  });

  it('rejects impossible calendar dates in route timestamps', () => {
    const storage = new MemoryStorage();
    const invalid = { ...route, departureTimeUtc: '2026-02-30T00:00:00Z' };
    expect(saveRoutes(storage, [invalid])).toEqual(expect.objectContaining({ ok: false, reason: 'invalid_routes' }));
    expect(saveRoutes(storage, [route])).toEqual({ ok: true });
  });

  it('uses the destination waypoint speed for its inbound leg', () => {
    const result = calculateRoute({
      ...route,
      waypoints: [
        route.waypoints[0],
        { ...route.waypoints[1], speedKn: 5 },
      ],
    });
    expect(result.legs[0].speedKn).toBe(5);
    expect(result.arrivalTimeUtc).toBeTruthy();
  });
});

describe('route operations and persistence', () => {
  it('creates routes with injected ID and clock and preserves inputs immutably', () => {
    const created = createRoute('New route', 12, context);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.id).toBe('wp_1');
    expect(created.value.warningRangeNm).toBe(10);
    expect(created.value.waypoints).toEqual([]);
  });

  it('adds and reorders waypoints without mutating the original route', () => {
    const added = addWaypoint(route, { name: 'C', position: { lat: 2, lon: 2 } }, context);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(route.waypoints).toHaveLength(2);
    expect(added.value.waypoints).toHaveLength(3);
    const reordered = reorderWaypoint(added.value, 2, 0, context);
    expect(reordered.ok && reordered.value.waypoints[0].name).toBe('C');
  });

  it('enforces the waypoint limit', () => {
    const full = { ...route, waypoints: Array.from({ length: MAX_WAYPOINTS }, (_, i) => ({
      id: `w_${i}`, name: 'W', position: { lat: 0, lon: 0 },
    })) };
    expect(addWaypoint(full, { name: 'Extra', position: { lat: 1, lon: 1 } }, context)).toEqual({
      ok: false, error: 'waypoint_limit',
    });
  });

  it('round-trips storage and preserves corrupt or old data', () => {
    const storage = new MemoryStorage();
    expect(saveRoutes(storage, [route])).toEqual({ ok: true });
    expect(storage.getItem(VOYAGE_PLANNER_STORAGE_KEY)).toContain('"version":1');
    expect(loadRoutes(storage)).toEqual({ status: 'loaded', routes: [route] });

    storage.setItem(VOYAGE_PLANNER_STORAGE_KEY, '{broken');
    expect(loadRoutes(storage).status).toBe('corrupt');
    expect(storage.getItem(VOYAGE_PLANNER_STORAGE_KEY)).toBe('{broken');

    storage.setItem(VOYAGE_PLANNER_STORAGE_KEY, JSON.stringify({ version: 99, routes: [] }));
    expect(loadRoutes(storage).status).toBe('unsupported_version');
    expect(storage.getItem(VOYAGE_PLANNER_STORAGE_KEY)).toContain('"version":99');
  });
});

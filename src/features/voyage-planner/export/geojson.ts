import { voyageRouteSchema } from '../schema';
import type { VoyageRoute } from '../types';

function validatedRoute(route: VoyageRoute): VoyageRoute {
  const parsed = voyageRouteSchema.safeParse(route);
  if (!parsed.success) throw new TypeError('Cannot export an invalid voyage route.');
  return parsed.data;
}

type RouteLineGeometry =
  | { type: 'LineString'; coordinates: number[][] }
  | { type: 'MultiLineString'; coordinates: number[][][] };

function isometricLatitude(latitude: number): number {
  return Math.asinh(Math.tan(latitude * Math.PI / 180));
}

function interpolateRhumbLatitude(from: number, to: number, fraction: number): number {
  const psi = isometricLatitude(from)
    + (isometricLatitude(to) - isometricLatitude(from)) * fraction;
  return Math.atan(Math.sinh(psi)) * 180 / Math.PI;
}

function normalizeDeltaLongitude(delta: number): number {
  return ((delta + 180) % 360 + 360) % 360 - 180;
}

function routeLineGeometry(waypoints: VoyageRoute['waypoints']): RouteLineGeometry {
  const segments: number[][][] = [[[
    waypoints[0].position.lon,
    waypoints[0].position.lat,
  ]]];

  for (let index = 1; index < waypoints.length; index += 1) {
    const previous = waypoints[index - 1].position;
    const current = waypoints[index].position;
    const adjustedLongitude = previous.lon + normalizeDeltaLongitude(current.lon - previous.lon);

    if (adjustedLongitude > 180 || adjustedLongitude < -180) {
      const boundaryLongitude = adjustedLongitude > 180 ? 180 : -180;
      const fraction = (boundaryLongitude - previous.lon) / (adjustedLongitude - previous.lon);
      const crossingLatitude = interpolateRhumbLatitude(previous.lat, current.lat, fraction);
      const currentSegment = segments[segments.length - 1];

      if (fraction <= Number.EPSILON) {
        if (currentSegment.length === 1) segments.pop();
        segments.push([[-boundaryLongitude, crossingLatitude], [current.lon, current.lat]]);
      } else {
        currentSegment.push([boundaryLongitude, crossingLatitude]);
        segments.push([[-boundaryLongitude, crossingLatitude], [current.lon, current.lat]]);
      }
    } else {
      segments[segments.length - 1].push([adjustedLongitude, current.lat]);
    }
  }

  return segments.length > 1
    ? { type: 'MultiLineString', coordinates: segments }
    : { type: 'LineString', coordinates: segments[0] };
}
export function exportRouteGeoJson(input: VoyageRoute): string {
  const route = validatedRoute(input);
  const features = [];

  if (route.waypoints.length >= 2) {
    features.push({
      type: 'Feature' as const,
      properties: {
        featureType: 'route',
        routeId: route.id,
        routeName: route.name,
        defaultSpeedKn: route.defaultSpeedKn,
        warningRangeNm: route.warningRangeNm,
        departureTimeUtc: route.departureTimeUtc ?? null,
      },
      geometry: routeLineGeometry(route.waypoints),
    });
  }

  route.waypoints.forEach((waypoint, index) => {
    features.push({
      type: 'Feature' as const,
      properties: {
        featureType: 'waypoint',
        routeId: route.id,
        routeName: route.name,
        waypointId: waypoint.id,
        name: waypoint.name,
        sequence: index + 1,
        speedKn: waypoint.speedKn ?? null,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [waypoint.position.lon, waypoint.position.lat],
      },
    });
  });

  return JSON.stringify({
    type: 'FeatureCollection',
    name: route.name,
    properties: {
      routeId: route.id,
      defaultSpeedKn: route.defaultSpeedKn,
      warningRangeNm: route.warningRangeNm,
      departureTimeUtc: route.departureTimeUtc ?? null,
    },
    features,
  }, null, 2);
}

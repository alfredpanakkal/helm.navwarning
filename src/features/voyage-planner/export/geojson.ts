import { voyageRouteSchema } from '../schema';
import type { VoyageRoute } from '../types';

function validatedRoute(route: VoyageRoute): VoyageRoute {
  const parsed = voyageRouteSchema.safeParse(route);
  if (!parsed.success) throw new TypeError('Cannot export an invalid voyage route.');
  return parsed.data;
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
      geometry: {
        type: 'LineString' as const,
        coordinates: route.waypoints.map(({ position }) => [position.lon, position.lat]),
      },
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

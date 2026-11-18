import { calculateRhumbLeg } from './rhumb';
import type { LegResult, RouteCalculation, VoyageRoute } from './types';

export function calculateRoute(route: VoyageRoute): RouteCalculation {
  const legs: LegResult[] = [];
  let elapsedHours = 0;
  let totalDistanceNm = 0;
  let complete = true;
  let etaKnown = Boolean(route.departureTimeUtc);

  for (let index = 1; index < route.waypoints.length; index += 1) {
    const from = route.waypoints[index - 1];
    const to = route.waypoints[index];
    const rhumb = calculateRhumbLeg(from.position, to.position);
    if (rhumb.status !== 'ok' && rhumb.status !== 'same_position') {
      complete = false;
      etaKnown = false;
      legs.push({
        fromWaypointId: from.id,
        toWaypointId: to.id,
        status: rhumb.status,
        distanceNm: null,
        courseDeg: null,
        speedKn: null,
        durationHours: null,
        etaUtc: null,
      });
      continue;
    }

    const distanceNm = rhumb.distanceNm ?? 0;
    const speedKn = to.speedKn ?? route.defaultSpeedKn;
    const durationHours = distanceNm / speedKn;
    elapsedHours += durationHours;
    totalDistanceNm += distanceNm;
    const etaUtc = etaKnown && route.departureTimeUtc
      ? new Date(Date.parse(route.departureTimeUtc) + elapsedHours * 3_600_000).toISOString()
      : null;

    legs.push({
      fromWaypointId: from.id,
      toWaypointId: to.id,
      status: rhumb.status,
      distanceNm,
      courseDeg: rhumb.courseDeg,
      speedKn,
      durationHours,
      etaUtc,
    });
  }

  return {
    legs,
    totalDistanceNm,
    arrivalTimeUtc: route.departureTimeUtc && complete && legs.length > 0
      ? legs[legs.length - 1].etaUtc
      : null,
    status: complete ? 'ok' : 'incomplete',
  };
}

import { calculateRoute } from '../calculation';
import { formatLatitude, formatLongitude } from '../coordinates';
import { voyageRouteSchema } from '../schema';
import type { VoyageRoute } from '../types';

function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function validatedRoute(route: VoyageRoute): VoyageRoute {
  const parsed = voyageRouteSchema.safeParse(route);
  if (!parsed.success) throw new TypeError('Cannot export an invalid voyage route.');
  return parsed.data;
}

export function exportRouteCsv(input: VoyageRoute): string {
  const route = validatedRoute(input);
  const calculation = calculateRoute(route);
  const headers = [
    'route_id', 'route_name', 'sequence', 'waypoint_id', 'waypoint_name',
    'latitude_decimal', 'longitude_decimal', 'latitude_dmd', 'longitude_dmd',
    'inbound_distance_nm', 'inbound_true_course_deg', 'inbound_speed_kn',
    'inbound_duration_hours', 'eta_utc',
  ];
  const rows = route.waypoints.map((waypoint, index) => {
    const leg = index > 0 ? calculation.legs[index - 1] : null;
    return [
      route.id,
      route.name,
      index + 1,
      waypoint.id,
      waypoint.name,
      waypoint.position.lat,
      waypoint.position.lon,
      formatLatitude(waypoint.position.lat),
      formatLongitude(waypoint.position.lon),
      leg?.distanceNm === null || !leg ? null : leg.distanceNm.toFixed(2),
      leg?.courseDeg === null || !leg ? null : leg.courseDeg.toFixed(1),
      leg?.speedKn === null || !leg ? null : leg.speedKn.toFixed(1),
      leg?.durationHours === null || !leg ? null : leg.durationHours.toFixed(3),
      leg?.etaUtc ?? (index === 0 ? route.departureTimeUtc ?? null : null),
    ];
  });
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

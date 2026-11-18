import { calculateRoute } from '../calculation';
import { voyageRouteSchema } from '../schema';
import type { VoyageRoute } from '../types';

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function validatedRoute(route: VoyageRoute): VoyageRoute {
  const parsed = voyageRouteSchema.safeParse(route);
  if (!parsed.success) throw new TypeError('Cannot export an invalid voyage route.');
  return parsed.data;
}

export function exportRouteGpx(input: VoyageRoute): string {
  const route = validatedRoute(input);
  const calculation = calculateRoute(route);
  const points = route.waypoints.map((waypoint, index) => {
    const eta = index === 0 ? route.departureTimeUtc : calculation.legs[index - 1]?.etaUtc;
    const speed = waypoint.speedKn ?? (index > 0 ? route.defaultSpeedKn : null);
    const description = [
      'Waypoint ' + (index + 1),
      speed === null ? null : 'Inbound speed ' + speed + ' kn',
    ].filter(Boolean).join(' · ');
    return [
      '    <rtept lat="' + waypoint.position.lat + '" lon="' + waypoint.position.lon + '">',
      '      <name>' + xmlEscape(waypoint.name) + '</name>',
      description ? '      <desc>' + xmlEscape(description) + '</desc>' : '',
      eta ? '      <time>' + xmlEscape(eta) + '</time>' : '',
      '    </rtept>',
    ].filter(Boolean).join('\n');
  }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Helm.Warning Voyage Planner" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata>',
    '    <name>' + xmlEscape(route.name) + '</name>',
    '    <desc>Default speed: ' + route.defaultSpeedKn + ' kn; warning search range: ' + route.warningRangeNm + ' NM</desc>',
    route.departureTimeUtc ? '    <time>' + xmlEscape(route.departureTimeUtc) + '</time>' : '',
    '  </metadata>',
    '  <rte>',
    '    <name>' + xmlEscape(route.name) + '</name>',
    points,
    '  </rte>',
    '</gpx>',
  ].filter(Boolean).join('\n');
}

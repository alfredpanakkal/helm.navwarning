import type { ParseResult, Position } from './types';

type Axis = 'lat' | 'lon';

function parseDmd(value: string, axis: Axis): ParseResult<number> {
  const match = value.trim().match(/^(\d{1,3})\s*°?\s*(\d{1,2}(?:\.\d+)?)\s*['′]?\s*([NSEW])$/i);
  if (!match) return { ok: false, error: 'Use degrees and decimal minutes with an explicit hemisphere (N/S/E/W).' };

  const degrees = Number(match[1]);
  const minutes = Number(match[2]);
  const hemisphere = match[3].toUpperCase();
  const maxDegrees = axis === 'lat' ? 90 : 180;
  const validHemisphere = axis === 'lat' ? hemisphere === 'N' || hemisphere === 'S' : hemisphere === 'E' || hemisphere === 'W';

  if (!validHemisphere) return { ok: false, error: axis === 'lat' ? 'Latitude requires N or S.' : 'Longitude requires E or W.' };
  if (!Number.isFinite(minutes) || minutes < 0 || minutes >= 60) return { ok: false, error: 'Minutes must be at least 0 and less than 60.' };
  if (degrees > maxDegrees || (degrees === maxDegrees && minutes !== 0)) {
    return { ok: false, error: axis === 'lat' ? 'Latitude is outside 0–90 degrees.' : 'Longitude is outside 0–180 degrees.' };
  }

  const magnitude = degrees + minutes / 60;
  const signed = hemisphere === 'S' || hemisphere === 'W' ? -magnitude : magnitude;
  return { ok: true, value: signed };
}

/** Parse latitude and longitude independently; both require explicit hemispheres. */
export function parseCoordinates(latitude: string, longitude: string): ParseResult<Position> {
  const lat = parseDmd(latitude, 'lat');
  if (!lat.ok) return lat;
  const lon = parseDmd(longitude, 'lon');
  if (!lon.ok) return lon;
  return { ok: true, value: { lat: lat.value, lon: lon.value } };
}

function formatDmd(value: number, axis: Axis): string {
  if (!Number.isFinite(value) || (axis === 'lat' ? Math.abs(value) > 90 : Math.abs(value) > 180)) {
    throw new RangeError(`Invalid ${axis === 'lat' ? 'latitude' : 'longitude'}`);
  }
  const hemisphere = axis === 'lat'
    ? (value < 0 ? 'S' : 'N')
    : (value < 0 ? 'W' : 'E');
  const degreeWidth = axis === 'lat' ? 2 : 3;
  let degrees = Math.floor(Math.abs(value));
  let minutes = Number(((Math.abs(value) - degrees) * 60).toFixed(2));
  if (minutes >= 60) {
    degrees += 1;
    minutes = 0;
  }
  if (degrees > (axis === 'lat' ? 90 : 180)) throw new RangeError('Rounded coordinate is outside its valid range');
  return `${String(degrees).padStart(degreeWidth, '0')}° ${minutes.toFixed(2).padStart(5, '0')}' ${hemisphere}`;
}

export function formatLatitude(latitude: number): string {
  return formatDmd(latitude, 'lat');
}

export function formatLongitude(longitude: number): string {
  return formatDmd(longitude, 'lon');
}

export function formatPosition(position: Position): { latitude: string; longitude: string } {
  return {
    latitude: formatLatitude(position.lat),
    longitude: formatLongitude(position.lon),
  };
}

/** Wrap longitude to [-180, 180) for chart display; stored values are unchanged. */
export function wrapLongitudeForChart(longitude: number): number {
  if (!Number.isFinite(longitude)) throw new RangeError('Longitude must be finite');
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

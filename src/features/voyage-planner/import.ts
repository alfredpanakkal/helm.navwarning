import type { Position, Waypoint } from './types';

export type ImportedWaypoint = Pick<Waypoint, 'name' | 'position'>;
export type RouteImportResult =
  | { ok: true; name: string; waypoints: ImportedWaypoint[] }
  | { ok: false; error: string };

const MAX_IMPORTED_WAYPOINTS = 200;
const NUMERIC = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePosition(value: unknown): Position | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  if (typeof value[0] !== 'number' || typeof value[1] !== 'number') return null;
  const lon = value[0];
  const lat = value[1];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)
    || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function fallbackName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim().slice(0, 80) || 'Imported route';
}

function parseGeoJson(value: unknown, fileName: string): RouteImportResult {
  if (!isRecord(value)) return { ok: false, error: 'GeoJSON must contain a Feature or FeatureCollection.' };
  const features = value.type === 'FeatureCollection' && Array.isArray(value.features)
    ? value.features
    : value.type === 'Feature' ? [value] : [];
  const points: Array<{ sequence: number; waypoint: ImportedWaypoint }> = [];
  const linePositions: Position[] = [];
  let skipped = 0;

  features.forEach((feature, index) => {
    if (!isRecord(feature) || !isRecord(feature.geometry)) return;
    const properties = isRecord(feature.properties) ? feature.properties : {};
    const geometry = feature.geometry;
    const featureType = typeof properties.featureType === 'string' ? properties.featureType.toLowerCase() : null;
    if (featureType === 'route') {
      if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
        geometry.coordinates.forEach((coordinate) => {
          if (!parsePosition(coordinate)) skipped += 1;
        });
      } else if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
        geometry.coordinates.forEach((line) => {
          if (!Array.isArray(line)) { skipped += 1; return; }
          line.forEach((coordinate) => {
            if (!parsePosition(coordinate)) skipped += 1;
          });
        });
      }
      return;
    }
    if (featureType && featureType !== 'waypoint') return;
    if (geometry.type === 'Point') {
      const position = parsePosition(geometry.coordinates);
      if (!position) { skipped += 1; return; }
      const sequence = typeof properties.sequence === 'number' ? properties.sequence : Number.NaN;
      points.push({
        sequence: Number.isFinite(sequence) ? sequence : index + 1,
        waypoint: {
          name: typeof properties.name === 'string' && properties.name.trim()
            ? properties.name.trim().slice(0, 40)
            : 'WP ' + (points.length + 1),
          position,
        },
      });
    } else if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
      geometry.coordinates.forEach((coordinate) => {
        const position = parsePosition(coordinate);
        if (position) linePositions.push(position);
        else skipped += 1;
      });
    } else if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
      geometry.coordinates.forEach((line) => {
        if (!Array.isArray(line)) return;
        line.forEach((coordinate) => {
          const position = parsePosition(coordinate);
          if (position) linePositions.push(position);
          else skipped += 1;
        });
      });
    }
  });

  if (skipped > 0) return { ok: false, error: skipped + ' route point(s) have invalid coordinates. Nothing was imported.' };

  const waypoints = points.length
    ? points.sort((a, b) => a.sequence - b.sequence).map((item) => item.waypoint)
    : linePositions.map((position, index) => ({ name: 'WP ' + (index + 1), position }));
  if (waypoints.length < 2) return { ok: false, error: 'The file must contain at least two valid route points.' };
  if (waypoints.length > MAX_IMPORTED_WAYPOINTS) return { ok: false, error: 'The route exceeds the 200-waypoint limit.' };

  const properties = isRecord(value.properties) ? value.properties : {};
  const name = typeof value.name === 'string' && value.name.trim()
    ? value.name.trim().slice(0, 80)
    : typeof properties.routeName === 'string' && properties.routeName.trim()
      ? properties.routeName.trim().slice(0, 80)
      : fallbackName(fileName);
  return { ok: true, name, waypoints };
}

function parseGpx(text: string, fileName: string): RouteImportResult {
  if (typeof DOMParser === 'undefined') {
    return { ok: false, error: 'GPX import requires a browser XML parser.' };
  }
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.querySelector('parsererror')) return { ok: false, error: 'The GPX file contains invalid XML.' };
  const points = Array.from(document.getElementsByTagNameNS('*', 'rtept'));
  const routePoints = points.length ? points : Array.from(document.getElementsByTagNameNS('*', 'wpt'));
  const waypoints: ImportedWaypoint[] = [];
  let skipped = 0;
  routePoints.forEach((element, index) => {
    const latAttribute = element.getAttribute('lat');
    const lonAttribute = element.getAttribute('lon');
    if (latAttribute === null || lonAttribute === null
      || !NUMERIC.test(latAttribute.trim()) || !NUMERIC.test(lonAttribute.trim())) { skipped += 1; return; }
    const lat = Number(latAttribute);
    const lon = Number(lonAttribute);
    const position = parsePosition([lon, lat]);
    if (!position) { skipped += 1; return; }
    const name = element.getElementsByTagNameNS('*', 'name')[0]?.textContent?.trim();
    waypoints.push({ name: name ? name.slice(0, 40) : 'WP ' + (index + 1), position });
  });
  if (skipped > 0) return { ok: false, error: skipped + ' route point(s) have invalid coordinates. Nothing was imported.' };
  if (waypoints.length < 2) return { ok: false, error: 'The GPX file must contain at least two valid route points.' };
  if (waypoints.length > MAX_IMPORTED_WAYPOINTS) return { ok: false, error: 'The route exceeds the 200-waypoint limit.' };
  const routeName = document.getElementsByTagNameNS('*', 'rte')[0]
    ?.getElementsByTagNameNS('*', 'name')[0]?.textContent?.trim()
    || document.getElementsByTagNameNS('*', 'metadata')[0]
      ?.getElementsByTagNameNS('*', 'name')[0]?.textContent?.trim();
  return { ok: true, name: routeName?.slice(0, 80) || fallbackName(fileName), waypoints };
}

export function parseRouteImport(text: string, fileName: string): RouteImportResult {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'gpx') return parseGpx(text, fileName);
  if (extension !== 'json' && extension !== 'geojson') {
    return { ok: false, error: 'Choose a GPX, GeoJSON or JSON route file.' };
  }
  try {
    return parseGeoJson(JSON.parse(text), fileName);
  } catch {
    return { ok: false, error: 'The GeoJSON file is not valid JSON.' };
  }
}

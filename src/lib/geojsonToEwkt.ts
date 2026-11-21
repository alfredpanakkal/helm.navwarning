/**
 * Convert supported GeoJSON geometry coordinates to validated PostGIS EWKT.
 * Coordinates are WGS84 [longitude, latitude].
 */
export interface EwktGeometryResult {
  ewkt: string;
  featureType: 'POINT' | 'LINE' | 'POLYGON';
}

function positionText(value: unknown): string | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  if (typeof value[0] !== 'number' || typeof value[1] !== 'number') return null;
  const lng = value[0];
  const lat = value[1];
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  return `${lng} ${lat}`;
}

function lineText(value: unknown): string | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const positions = value.map(positionText);
  return positions.every((p): p is string => p !== null) ? positions.join(', ') : null;
}

function ringText(value: unknown): string | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const positions = value.map(positionText);
  if (!positions.every((p): p is string => p !== null)) return null;
  if (positions[0] !== positions[positions.length - 1]) return null;
  return `(${positions.join(', ')})`;
}

function polygonText(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const rings = value.map(ringText);
  return rings.every((ring): ring is string => ring !== null) ? `(${rings.join(', ')})` : null;
}

export function geojsonToEwkt(geometry: unknown): EwktGeometryResult | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const candidate = geometry as { type?: unknown; coordinates?: unknown };
  const coordinates = candidate.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length === 0) return null;

  let wkt: string | null = null;
  let featureType: EwktGeometryResult['featureType'] | null = null;

  switch (candidate.type) {
    case 'Point': {
      const position = positionText(coordinates);
      if (position) wkt = `POINT(${position})`;
      featureType = 'POINT';
      break;
    }
    case 'MultiPoint': {
      const points = coordinates.map(positionText);
      if (points.every((point): point is string => point !== null)) {
        wkt = `MULTIPOINT(${points.map((point) => `(${point})`).join(', ')})`;
      }
      featureType = 'POINT';
      break;
    }
    case 'LineString': {
      const line = lineText(coordinates);
      if (line) wkt = `LINESTRING(${line})`;
      featureType = 'LINE';
      break;
    }
    case 'MultiLineString': {
      const lines = coordinates.map(lineText);
      if (lines.every((line): line is string => line !== null)) {
        wkt = `MULTILINESTRING(${lines.map((line) => `(${line})`).join(', ')})`;
      }
      featureType = 'LINE';
      break;
    }
    case 'Polygon': {
      const polygon = polygonText(coordinates);
      if (polygon) wkt = `POLYGON${polygon}`;
      featureType = 'POLYGON';
      break;
    }
    case 'MultiPolygon': {
      const polygons = coordinates.map(polygonText);
      if (polygons.every((polygon): polygon is string => polygon !== null)) {
        wkt = `MULTIPOLYGON(${polygons.join(', ')})`;
      }
      featureType = 'POLYGON';
      break;
    }
    default:
      return null;
  }

  return wkt && featureType ? { ewkt: `SRID=4326;${wkt}`, featureType } : null;
}

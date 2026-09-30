import { NavWarning } from '../types';
import { formatNauticalCoordinates, formatDecimalCoordinates } from './coordinateConversion';

/**
 * Calculates initial Great-Circle True Bearing (°T) and Distance (NM)
 * between two lat/lng points.
 */
export function calculateBearingAndDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): { bearingDeg: number; bearingStr: string; distanceNm: number; distanceStr: string } {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  // Initial Bearing Formula
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  let theta = Math.atan2(y, x);
  let bearingDeg = (toDeg(theta) + 360) % 360;

  // Haversine Distance Formula in Nautical Miles
  // Mean Earth Radius in NM = 3440.065
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceNm = 3440.065 * c;

  const roundedBearing = Math.round(bearingDeg);
  const bearingStr = `${String(roundedBearing).padStart(3, '0')}°T`;
  const distanceStr = `${distanceNm.toFixed(1)} NM`;

  return {
    bearingDeg,
    bearingStr,
    distanceNm: Number(distanceNm.toFixed(2)),
    distanceStr,
  };
}

/**
 * Extracts maritime operational hazard keywords from warning text
 */
export function extractWarningKeywords(text: string): string[] {
  if (!text) return ['Navigational Warning'];
  const upper = text.toUpperCase();
  const found: string[] = [];

  const catalog: { name: string; patterns: RegExp[] }[] = [
    { name: 'Seismic Survey', patterns: [/SEISMIC/, /SURVEY VESSEL/, /STREAMER/, /RAMFORM/] },
    { name: 'Submarine Cable', patterns: [/CABLE/, /SUBMARINE CABLE/, /CABLE INSTALLATION/, /CABLE REPAIR/] },
    { name: 'Pipeline Operations', patterns: [/PIPELINE/, /PIPE LAYING/, /PIPE INSTALLATION/] },
    { name: 'Restricted Area', patterns: [/RESTRICTED AREA/, /EXCLUSION ZONE/, /KEEP CLEAR/, /PROHIBITED/] },
    { name: 'Gunnery / Firing', patterns: [/FIRING/, /GUNNERY/, /MILITARY EXERCISE/, /MISSILE/, /ROCKET LAUNCH/, /WEAPONS/] },
    { name: 'Drilling Rig', patterns: [/DRILLING RIG/, /OIL RIG/, /DRILLSHIP/, /JACK-UP/, /SEMI-SUBMERSIBLE/, /RIG /] },
    { name: 'Aids to Navigation', patterns: [/LIGHT UNLIT/, /BUOY OFF STATION/, /BUOY DAMAGED/, /BEACON DESTROYED/, /LIGHT DISCONTINUED/, /UNLIT/] },
    { name: 'Derelict / Hazard', patterns: [/DERELICT/, /DRIFTING/, /UNEXPLODED ORDNANCE/, /MINE /, /OBSTRUCTION/, /CONTAINER AFLOAT/] },
    { name: 'Search & Rescue', patterns: [/SEARCH AND RESCUE/, /SAR OPERATION/, /DISTRESS/] },
    { name: 'Offshore Wind Farm', patterns: [/WIND FARM/, /TURBINE/, /OFFSHORE WIND/] },
    { name: 'Dredging Operations', patterns: [/DREDGING/, /DREDGER/] },
    { name: 'Space Debris', patterns: [/SPACE DEBRIS/, /SPLASHDOWN/, /DEORBIT/] },
  ];

  for (const item of catalog) {
    if (item.patterns.some((p) => p.test(upper))) {
      found.push(item.name);
    }
  }

  if (found.length === 0) {
    // Default fallback based on general context
    found.push('General Maritime Notice');
  }

  return found;
}

export interface GeometryCoordinatePoint {
  index: number;
  lat: number;
  lng: number;
  nauticalLat: string;
  nauticalLng: string;
  decimalLat: string;
  decimalLng: string;
  bearingToNext?: string;
  distanceToNext?: string;
}

/**
 * Parses all points from a warning's spatial geometries into a structured coordinate table
 */
export function extractWarningCoordinateList(warning: NavWarning): GeometryCoordinatePoint[] {
  const points: { lat: number; lng: number }[] = [];

  if (warning.spatial?.geometries && warning.spatial.geometries.length > 0) {
    warning.spatial.geometries.forEach((geom) => {
      if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
        const ring = Array.isArray(geom.coordinates[0]) ? geom.coordinates[0] : geom.coordinates;
        (ring as any[]).forEach((pt) => {
          if (Array.isArray(pt) && pt.length >= 2) {
            points.push({ lat: Number(pt[1]), lng: Number(pt[0]) });
          }
        });
      } else if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
        points.push({ lat: Number(geom.coordinates[1]), lng: Number(geom.coordinates[0]) });
      } else if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
        (geom.coordinates as any[]).forEach((pt) => {
          if (Array.isArray(pt) && pt.length >= 2) {
            points.push({ lat: Number(pt[1]), lng: Number(pt[0]) });
          }
        });
      }
    });
  }

  // If spatial geometries had no points, fallback to warning.latitude and longitude
  if (points.length === 0 && warning.latitude !== null && warning.latitude !== undefined &&
      warning.longitude !== null && warning.longitude !== undefined &&
      (warning.latitude !== 0 || warning.longitude !== 0)) {
    points.push({ lat: warning.latitude, lng: warning.longitude });
  }

  // Deduplicate consecutive identical points if polygon closed loop
  const filteredPoints: { lat: number; lng: number }[] = [];
  points.forEach((pt, i) => {
    if (i === 0 || Math.abs(pt.lat - points[i - 1].lat) > 0.00001 || Math.abs(pt.lng - points[i - 1].lng) > 0.00001) {
      filteredPoints.push(pt);
    }
  });

  return filteredPoints.map((pt, idx) => {
    const isLast = idx === filteredPoints.length - 1;
    let bearingToNext: string | undefined;
    let distanceToNext: string | undefined;

    if (!isLast) {
      const nextPt = filteredPoints[idx + 1];
      const calc = calculateBearingAndDistance(pt.lat, pt.lng, nextPt.lat, nextPt.lng);
      bearingToNext = calc.bearingStr;
      distanceToNext = calc.distanceStr;
    } else if (filteredPoints.length > 2) {
      // Loop back to point #1 for polygons
      const firstPt = filteredPoints[0];
      const calc = calculateBearingAndDistance(pt.lat, pt.lng, firstPt.lat, firstPt.lng);
      bearingToNext = `${calc.bearingStr} (to #1)`;
      distanceToNext = calc.distanceStr;
    }

    // Split formatNauticalCoordinates "DD-MM.MM'N DDD-MM.MM'E"
    const fullNautical = formatNauticalCoordinates(pt.lat, pt.lng);
    const parts = fullNautical.split(' ');
    const nauticalLat = parts[0] || '';
    const nauticalLng = parts[1] || '';

    const absLat = Math.abs(pt.lat);
    const latHem = pt.lat >= 0 ? 'N' : 'S';
    const absLng = Math.abs(pt.lng);
    const lngHem = pt.lng >= 0 ? 'E' : 'W';

    return {
      index: idx + 1,
      lat: pt.lat,
      lng: pt.lng,
      nauticalLat,
      nauticalLng,
      decimalLat: `${absLat.toFixed(4)}° ${latHem}`,
      decimalLng: `${absLng.toFixed(4)}° ${lngHem}`,
      bearingToNext,
      distanceToNext,
    };
  });
}

/**
 * Generates GeoJSON FeatureCollection string
 */
export function exportWarningAsGeoJSON(warning: NavWarning): string {
  const features: any[] = [];

  // Polygons / Lines / Points
  if (warning.spatial?.geometries) {
    warning.spatial.geometries.forEach((geom, i) => {
      features.push({
        type: 'Feature',
        id: `${warning.warning_id}-geom-${i + 1}`,
        geometry: {
          type: geom.type,
          coordinates: geom.coordinates,
        },
        properties: {
          warning_id: warning.warning_id,
          source_warning_id: warning.source_warning_id,
          navarea: warning.navarea,
          status: warning.status,
          issued_date: warning.issued_date,
          label: geom.label || `Geometry #${i + 1}`,
          type: geom.type,
        },
      });
    });
  }

  // Circles
  if (warning.spatial?.circles) {
    warning.spatial.circles.forEach((circ, i) => {
      features.push({
        type: 'Feature',
        id: `${warning.warning_id}-circle-${i + 1}`,
        geometry: {
          type: 'Point',
          coordinates: circ.center,
        },
        properties: {
          warning_id: warning.warning_id,
          source_warning_id: warning.source_warning_id,
          navarea: warning.navarea,
          hazard_type: 'Circle Buffer',
          radius_nm: circ.radius_nm,
          radius_meters: circ.radius_nm * 1852,
          label: circ.label || `Safety Radius (${circ.radius_nm} NM)`,
        },
      });
    });
  }

  // Anchor point fallback
  if (features.length === 0 && warning.latitude !== null && warning.longitude !== null) {
    features.push({
      type: 'Feature',
      id: `${warning.warning_id}-point`,
      geometry: {
        type: 'Point',
        coordinates: [warning.longitude, warning.latitude],
      },
      properties: {
        warning_id: warning.warning_id,
        source_warning_id: warning.source_warning_id,
        navarea: warning.navarea,
        status: warning.status,
        issued_date: warning.issued_date,
      },
    });
  }

  const collection = {
    type: 'FeatureCollection',
    metadata: {
      generated_by: 'Helm.Warning WWNWS Maritime Safety System',
      warning_id: warning.source_warning_id || warning.warning_id,
      navarea: warning.navarea,
      issued_date: warning.issued_date,
      exported_at: new Date().toISOString(),
    },
    features,
  };

  return JSON.stringify(collection, null, 2);
}

/**
 * Generates OGC KML 2.2 XML string
 */
export function exportWarningAsKML(warning: NavWarning): string {
  const title = (warning.source_warning_id || warning.warning_id).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const desc = (warning.raw_text || warning.issued_text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

  let placemarksXml = '';

  if (warning.spatial?.geometries) {
    warning.spatial.geometries.forEach((geom, idx) => {
      if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
        const ring = Array.isArray(geom.coordinates[0]) ? geom.coordinates[0] : geom.coordinates;
        const coordsStr = (ring as any[])
          .map((pt) => `${pt[0]},${pt[1]},0`)
          .join(' ');

        placemarksXml += `
    <Placemark>
      <name>${title} - Area #${idx + 1}</name>
      <description><![CDATA[${desc}]]></description>
      <Style>
        <LineStyle><color>ff0284c7</color><width>2.5</width></LineStyle>
        <PolyStyle><color>4d0284c7</color></PolyStyle>
      </Style>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordsStr}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
      } else if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
        placemarksXml += `
    <Placemark>
      <name>${title} - Feature #${idx + 1}</name>
      <description><![CDATA[${desc}]]></description>
      <Point>
        <coordinates>${geom.coordinates[0]},${geom.coordinates[1]},0</coordinates>
      </Point>
    </Placemark>`;
      }
    });
  }

  // Anchor fallback
  if (!placemarksXml && warning.latitude !== null && warning.longitude !== null) {
    placemarksXml += `
    <Placemark>
      <name>${title}</name>
      <description><![CDATA[${desc}]]></description>
      <Point>
        <coordinates>${warning.longitude},${warning.latitude},0</coordinates>
      </Point>
    </Placemark>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${title}</name>
    <description>Navigational Warning NAVAREA ${warning.navarea}</description>
    ${placemarksXml}
  </Document>
</kml>`;
}

/**
 * Generates Plain Coordinate Text formatted for bridge navigators
 */
export function exportWarningAsTextCoordinates(warning: NavWarning): string {
  const points = extractWarningCoordinateList(warning);
  const lines: string[] = [];

  lines.push(`=======================================================`);
  lines.push(`HELM.WARNING - NAVIGATIONAL WARNING COORDINATE LIST`);
  lines.push(`WARNING ID : ${warning.source_warning_id || warning.warning_id}`);
  lines.push(`NAVAREA    : NAVAREA ${warning.navarea}`);
  lines.push(`ISSUED UTC : ${warning.issued_date || 'N/A'}`);
  lines.push(`STATUS     : ${warning.status?.toUpperCase() || 'ACTIVE'}`);
  lines.push(`=======================================================`);
  lines.push('');
  lines.push(`INDEX | NAUTICAL (DMM)          | DECIMAL (DD)      | BEARING & DISTANCE TO NEXT`);
  lines.push(`--------------------------------------------------------------------------------`);

  if (points.length === 0) {
    lines.push(`No discrete point or polygon coordinates extracted.`);
  } else {
    points.forEach((pt) => {
      const idx = String(pt.index).padStart(2, '0');
      const naut = `${pt.nauticalLat} ${pt.nauticalLng}`.padEnd(24, ' ');
      const dec = `${pt.decimalLat}, ${pt.decimalLng}`.padEnd(18, ' ');
      const seg = pt.bearingToNext ? `${pt.bearingToNext} / ${pt.distanceToNext}` : '---';
      lines.push(`#${idx}  | ${naut} | ${dec} | ${seg}`);
    });
  }

  if (warning.spatial?.circles && warning.spatial.circles.length > 0) {
    lines.push('');
    lines.push(`SAFETY / EXCLUSION CIRCLE HAZARDS:`);
    warning.spatial.circles.forEach((c, i) => {
      const naut = formatNauticalCoordinates(c.center[1], c.center[0]);
      lines.push(`Circle #${i + 1}: Center: ${naut} | Radius: ${c.radius_nm} NM (${c.radius_nm * 1852} m)`);
    });
  }

  lines.push('');
  lines.push(`VERBATIM BROADCAST:`);
  lines.push(warning.raw_text || warning.issued_text || 'No message body');
  lines.push('');

  return lines.join('\n');
}

/**
 * Browser file download helper
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

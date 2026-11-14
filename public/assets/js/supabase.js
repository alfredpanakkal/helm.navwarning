// ════════════ SUPABASE INIT ════════════
// 20261019/20 backend schema contract:
//   - nav_warnings: canonical_id, categories TEXT[], triage_tier, data_quality,
//     status, valid_from/valid_to, issued_at, updated_at. NO severity / risk_level /
//     category / issued_date / latitude / longitude / is_verified columns.
//   - Geometry lives in nav_warning_geometries / the nav_warnings_active_spatial
//     view (geojson_blob), never in flat columns on nav_warnings.
//   - Stable human key is canonical_id; DB key is the uuid column "id".
// See docs/supabase-backend-contract.md and src/services/navWarningQueries.ts.

// Use environment variables if bundled, otherwise fallback to project keys
const SUPABASE_URL = (typeof process !== 'undefined' && process.env.VITE_SUPABASE_URL) || 'https://ocqpfbkuiomzhbxxvemi.supabase.co';
const SUPABASE_PUBLIC_KEY =
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)) ||
  'sb_publishable_mBu1kjX8d36QSDlgvNudvw_cztVRegR';

// Initialize Supabase client globally so public.js and admin.js can use it
window.hwSupabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY) : null;

if (!window.hwSupabase) {
  console.warn('⚠️ Supabase client failed to initialize. Check if supabase-js CDN is loaded.');
}

// ════════════ DATA FETCH HELPERS ════════════
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Computes the centroid [lat, lng] of a polygon ring.
 * Coordinates are GeoJSON format: [[lng, lat], ...]
 */
function computePolygonCentroid(coords) {
  if (!Array.isArray(coords) || coords.length === 0) return [0, 0];
  const ring = Array.isArray(coords[0]) && Array.isArray(coords[0][0]) ? coords[0] : coords;
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  for (const pt of ring) {
    if (Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
      sumLng += pt[0];
      sumLat += pt[1];
      count++;
    }
  }
  return count > 0 ? [sumLat / count, sumLng / count] : [0, 0];
}

// Reject malformed GeoJSON before it reaches the public Leaflet renderer.
function isValidPublicGeoJSON(blob) {
  if (!blob || typeof blob !== 'object') return false;
  const isPosition = (position) => Array.isArray(position) && position.length >= 2 &&
    Number.isFinite(position[0]) && Number.isFinite(position[1]) &&
    position[0] >= -180 && position[0] <= 180 && position[1] >= -90 && position[1] <= 90;
  const isLine = (line) => Array.isArray(line) && line.length >= 2 && line.every(isPosition);
  const isRing = (ring) => Array.isArray(ring) && ring.length >= 4 && ring.every(isPosition) &&
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];

  switch (blob.type) {
    case 'Point': return isPosition(blob.coordinates);
    case 'MultiPoint': return Array.isArray(blob.coordinates) && blob.coordinates.length > 0 && blob.coordinates.every(isPosition);
    case 'LineString': return isLine(blob.coordinates);
    case 'MultiLineString': return Array.isArray(blob.coordinates) && blob.coordinates.length > 0 && blob.coordinates.every(isLine);
    case 'Polygon': return Array.isArray(blob.coordinates) && blob.coordinates.length > 0 && blob.coordinates.every(isRing);
    case 'MultiPolygon': return Array.isArray(blob.coordinates) && blob.coordinates.length > 0 &&
      blob.coordinates.every((polygon) => Array.isArray(polygon) && polygon.length > 0 && polygon.every(isRing));
    default: return false;
  }
}

// Extract only an explicitly labelled issue date from the source bulletin.
// Invalid calendar dates are rejected; no dates are inferred from ingestion time.
function extractBulletinIssuedAt(rawText) {
  if (typeof rawText !== 'string') return null;
  const match = rawText.match(/\bDate\s*:\s*(\d{4})[\/. -](\d{1,2})[\/. -](\d{1,2})(?:\s+(\d{2})(?::?(\d{2}))?\s*UTC)?/i);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const hour = hourText === undefined ? 0 : Number(hourText);
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  return date.toISOString();
}

// Group authoritative spatial rows and hydrate their warning text.
function mergeSpatialAndTextRows(spatialData, textRows) {
  // Group geometries by canonical_id to prevent multi-row fragmentation
  const warningMap = new Map();

  for (const row of spatialData) {
    if (row.status !== 'active' || row.triage_tier !== 'A') continue;
    const key = row.canonical_id || row.warning_id;
    if (!key) continue;

    let entry = warningMap.get(key);
    if (!entry) {
      const primaryCategory = Array.isArray(row.categories) && row.categories.length > 0 ? row.categories[0] : 'general';
      entry = {
        id: row.warning_id,
        warning_id: row.canonical_id || row.warning_id,
        canonical_id: row.canonical_id || row.warning_id,
        navarea: row.navarea,
        title: row.title || row.canonical_id,
        area_text: row.area_text,
        severity: row.triage_tier === 'A' ? 'high' : 'caution',
        is_verified: false,
        category: primaryCategory,
        categories: Array.isArray(row.categories) && row.categories.length > 0 ? row.categories : [primaryCategory],
        status: row.status || 'active',
        triage_tier: row.triage_tier || 'A',
        data_quality: row.data_quality || 'EXPLICIT',
        valid_from: row.valid_from,
        valid_to: row.valid_to,
        radio_frequencies: row.radio_frequencies,
        space_launch_mission: row.space_launch_mission,
        geometries: [],
        latitude: null,
        longitude: null,
        buffer_nm: 0,
      };
      warningMap.set(key, entry);
    }

    if (isValidPublicGeoJSON(row.geojson_blob)) {
      entry.geometries.push({
        geom_id: row.geom_id,
        feature_type: row.feature_type || row.geojson_blob.type,
        buffer_nm: Number(row.buffer_nm) || 0,
        corridor_half_width_nm: Number(row.corridor_half_width_nm) || 0,
        zone_label: row.zone_label || row.title || entry.canonical_id,
        geojson_blob: row.geojson_blob,
      });
      if (row.buffer_nm && row.buffer_nm > entry.buffer_nm) {
        entry.buffer_nm = Number(row.buffer_nm);
      }
    }
  }

  // Merge source text and authoritative parser metadata from the master row.
  // Tier A + EXPLICIT + RULE is the backend's published verification contract.
  if (textRows.length > 0) {
    try {
      const textMap = new Map(textRows.map(t => [t.id, t]));
      for (const entry of warningMap.values()) {
        const tr = textMap.get(entry.id);
        if (tr) {
          const rawText = tr.raw_text || '';
          const flags = Array.isArray(tr.qa_flags) ? tr.qa_flags : [];
          entry.raw_text = rawText;
          entry.bulletin = rawText;
          entry.text = rawText;
          entry.parsing_method = tr.parsing_method || null;
          entry.qa_flags = flags;
          entry.is_verified = entry.status === 'active' &&
            entry.triage_tier === 'A' &&
            entry.data_quality === 'EXPLICIT' &&
            entry.parsing_method === 'RULE' &&
            !flags.some(flag => flag && !String(flag).startsWith('geometry_basis:'));

          const issuedAt = tr.issued_at || extractBulletinIssuedAt(rawText);
          entry.issued_at = issuedAt || null;
          entry.issued_date = issuedAt ? String(issuedAt).slice(0, 10) : null;
          entry.issued_text = issuedAt || null;
        }
      }
    } catch (textEx) {
      console.warn('Text hydration notice:', textEx);
    }
  }

  // Calculate representative latitude & longitude coordinates for each warning
  for (const entry of warningMap.values()) {
    for (const geom of entry.geometries) {
      const blob = geom.geojson_blob;
      if (!blob) continue;

      if (blob.type === 'Point' && Array.isArray(blob.coordinates)) {
        entry.longitude = blob.coordinates[0];
        entry.latitude = blob.coordinates[1];
        break;
      } else if ((blob.type === 'Polygon' || blob.type === 'MultiPolygon') && Array.isArray(blob.coordinates)) {
        const [cLat, cLng] = computePolygonCentroid(blob.coordinates);
        if (cLat !== 0 || cLng !== 0) {
          entry.latitude = cLat;
          entry.longitude = cLng;
          break;
        }
      } else if ((blob.type === 'LineString' || blob.type === 'MultiLineString') && Array.isArray(blob.coordinates)) {
        const coords = blob.coordinates;
        const mid = coords[Math.floor(coords.length / 2)];
        if (Array.isArray(mid)) {
          entry.longitude = mid[0];
          entry.latitude = mid[1];
          break;
        }
      }
    }

    // Build spatial contract object compatible with Leaflet & UI components
    entry.spatial = {
      geometries: entry.geometries.map(g => ({
        type: g.geojson_blob?.type || g.feature_type,
        coordinates: g.geojson_blob?.coordinates,
        label: g.zone_label,
        buffer_nm: g.buffer_nm,
      })),
      circles: entry.geometries
        .filter(g => (g.feature_type === 'POINT' || g.geojson_blob?.type === 'Point') && g.buffer_nm > 0)
        .map(g => ({
          center: g.geojson_blob?.coordinates,
          radius_nm: g.buffer_nm,
          label: g.zone_label,
        })),
      raw_coordinate_text: [],
      validation_status: entry.geometries.length > 0 ? 'passed' : 'not_present',
    };
  }

  return Array.from(warningMap.values());
}

const SPATIAL_PAGE_SIZE = 1000;

async function fetchActiveWarnings() {
  if (!window.hwSupabase) {
    throw new Error('Supabase client is unavailable');
  }

  let textPromise = null;
  try {
    textPromise = Promise.resolve(window.hwSupabase
      .from('nav_warnings')
      .select('id, raw_text, issued_at, parsing_method, qa_flags')
      .eq('status', 'active'))
      .catch((textQueryError) => {
        console.warn('Warning text hydration unavailable:', textQueryError);
        return { data: null, error: textQueryError };
      });
  } catch (textQueryError) {
    console.warn('Warning text hydration unavailable:', textQueryError);
  }

  const spatialRows = new Map();
  for (let from = 0; ; from += SPATIAL_PAGE_SIZE) {
    let result;
    try {
      result = await window.hwSupabase
        .from('nav_warnings_active_spatial')
        .select('warning_id, canonical_id, navarea, title, area_text, categories, status, triage_tier, data_quality, valid_from, valid_to, radio_frequencies, space_launch_mission, geom_id, zone_label, feature_type, buffer_nm, corridor_half_width_nm, geojson_blob')
        .order('geom_id', { ascending: true })
        .range(from, from + SPATIAL_PAGE_SIZE - 1);
    } catch (queryError) {
      throw new Error('Authoritative spatial query failed: ' + (queryError?.message || queryError));
    }

    if (result.error) {
      throw new Error('Authoritative spatial query failed: ' + result.error.message);
    }
    if (!Array.isArray(result.data)) {
      throw new Error('Authoritative spatial query returned an invalid response');
    }

    for (const row of result.data) {
      if (!row.geom_id) {
        throw new Error('Authoritative spatial row is missing geom_id');
      }
      if (!spatialRows.has(row.geom_id)) spatialRows.set(row.geom_id, row);
    }

    if (result.data.length < SPATIAL_PAGE_SIZE) break;
  }

  let textRows = [];
  if (textPromise) {
    try {
      const textResult = await textPromise;
      if (!textResult.error && Array.isArray(textResult.data)) {
        textRows = textResult.data;
      } else if (textResult.error) {
        console.warn('Warning text hydration unavailable:', textResult.error.message);
      }
    } catch (textError) {
      console.warn('Warning text hydration unavailable:', textError);
    }
  }

  return mergeSpatialAndTextRows(Array.from(spatialRows.values()), textRows);
}

async function fetchWarningDetails(identifier) {
  if (!identifier) return null;
  const isObj = typeof identifier === 'object' && identifier !== null;
  const targetId = isObj ? (identifier.id || identifier.canonical_id || identifier.warning_id) : identifier;
  const targetCanonical = isObj
    ? (identifier.canonical_id || identifier.warning_id || identifier.source_warning_id || identifier.id)
    : identifier;

  if (window.hwSupabase) {
    try {
      // New schema: no verified_at / warning_id / source_warning_id columns.
      // UUID -> match the "id" PK; anything else -> match canonical_id.
      const isUuid = typeof targetId === 'string' && UUID_RE.test(targetId);

      let query = window.hwSupabase
        .from('nav_warnings')
        .select('id, canonical_id, navarea, title, area_text, categories, status, triage_tier, data_quality, valid_from, valid_to, issued_at, raw_text, created_at, updated_at');

      if (isUuid) {
        query = query.eq('id', targetId);
      } else {
        query = query.eq('canonical_id', targetCanonical);
      }

      const { data, error } = (query.maybeSingle ? query.maybeSingle() : query.limit(1));
      const record = Array.isArray(data) ? data[0] : data;
      if (!error && record && record.raw_text) {
        return {
          ...record,
          raw_text: record.raw_text,
          bulletin: record.raw_text,
          text: record.raw_text,
        };
      }
      if (error) {
        console.warn('Supabase fetch details notice:', error.message);
      }
    } catch (e) {
      console.warn('Supabase fetch details notice:', e);
    }
  }

  // Fallback to local server API
  try {
    const res = await fetch('/api/warnings');
    if (res.ok) {
      const list = await res.json();
      const match = list.find(w => (
        w.warning_id === targetId ||
        w.id === targetId ||
        w.db_uuid === targetId ||
        w.source_warning_id === targetId ||
        w.warning_id === targetCanonical ||
        w.source_warning_id === targetCanonical
      ));
      if (match) {
        const raw = match.bulletin || match.raw_text || match.text || match.rawText || match.raw_nav_warning || match.body || match.details;
        return {
          raw_text: raw,
          bulletin: raw,
          text: raw,
          created_at: match.created_at || match.issued_at,
        };
      }
    }
  } catch (_) {}

  return null;
}

window.fetchActiveWarnings = fetchActiveWarnings;
window.fetchWarningDetails = fetchWarningDetails;

window.hwDb = {
  fetchActiveWarnings,
  fetchWarningDetails,
};

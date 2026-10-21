// ════════════ SUPABASE INIT ════════════
// 20261019/20 backend schema contract:
//   - nav_warnings: canonical_id, categories TEXT[], triage_tier, data_quality,
//     status, valid_from/valid_to, issued_at, updated_at. NO severity / risk_level /
//     category / issued_date / latitude / longitude / is_verified columns.
//   - Geometry lives in nav_warning_geometries / the nav_warnings_active_spatial
//     view (geojson_blob), never in flat columns on nav_warnings.
//   - Stable human key is canonical_id; DB key is the uuid column "id".
// See docs/supabase-backend-contract.md and src/services/navWarningQueries.ts.

// Columns that actually exist on nav_warnings (20261019/20 schema).
const LIGHT_COLUMNS =
  'id, canonical_id, navarea, source_id, title, area_text, categories, ' +
  'status, triage_tier, data_quality, valid_from, valid_to, issued_at, ' +
  'raw_text, created_at, updated_at';

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

async function fetchActiveWarnings() {
  if (window.hwSupabase) {
    // 1. Prioritize pre-calculated PostGIS dynamic spatial view (active + Tier A)
    try {
      const { data: spatialData, error: spatialErr } = await window.hwSupabase
        .from('nav_warnings_active_spatial')
        .select('*');

      if (!spatialErr && Array.isArray(spatialData) && spatialData.length > 0) {
        return spatialData.map(w => {
          let lat = null;
          let lng = null;
          if (w.geojson_blob && w.geojson_blob.type === 'Point' && Array.isArray(w.geojson_blob.coordinates)) {
            lng = w.geojson_blob.coordinates[0];
            lat = w.geojson_blob.coordinates[1];
          }

          const primaryCategory = Array.isArray(w.categories) && w.categories.length > 0 ? w.categories[0] : 'general';

          return {
            id: w.warning_id,
            warning_id: w.canonical_id || w.warning_id,
            canonical_id: w.canonical_id || w.warning_id,
            navarea: w.navarea,
            title: w.title || w.canonical_id,
            area_text: w.area_text,
            severity: w.triage_tier === 'A' ? 'high' : 'caution',
            category: primaryCategory,
            categories: w.categories || [primaryCategory],
            status: w.status,
            triage_tier: w.triage_tier,
            data_quality: w.data_quality,
            valid_from: w.valid_from,
            valid_to: w.valid_to,
            latitude: lat,
            longitude: lng,
            buffer_nm: w.buffer_nm,
            corridor_half_width_nm: w.corridor_half_width_nm,
            feature_type: w.feature_type,
            geojson_blob: w.geojson_blob,
            spatial: w.geojson_blob ? {
              geometries: [
                {
                  type: w.geojson_blob.type,
                  coordinates: w.geojson_blob.coordinates,
                  label: w.zone_label || w.title || w.canonical_id,
                }
              ]
            } : null,
          };
        });
      }
      if (spatialErr) {
        console.warn('nav_warnings_active_spatial query notice, falling back to master:', spatialErr.message);
      }
    } catch (spatialEx) {
      console.warn('nav_warnings_active_spatial query notice, falling back to master:', spatialEx);
    }

    // 2. Fallback to master nav_warnings table (new-schema columns only).
    //    Rows here have no geometry; the map draws markers only from the view.
    try {
      const { data, error } = await window.hwSupabase
        .from('nav_warnings')
        .select(LIGHT_COLUMNS)
        .eq('status', 'active')
        .order('updated_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(w => {
          const primaryCategory = Array.isArray(w.categories) && w.categories.length > 0 ? w.categories[0] : 'general';
          const raw = w.raw_text || '';
          return {
            ...w,
            id: w.id,
            warning_id: w.canonical_id || w.id,
            canonical_id: w.canonical_id || w.id,
            severity: w.triage_tier === 'A' ? 'high' : 'caution',
            category: primaryCategory,
            categories: w.categories || [primaryCategory],
            issued_date: w.issued_at ? String(w.issued_at).slice(0, 10) : null,
            issued_text: w.issued_at || null,
            latitude: null,
            longitude: null,
            raw_text: raw,
            bulletin: raw,
            text: raw,
          };
        });
      }
      if (error) {
        console.warn('Supabase direct query notice, checking server API cache:', error.message);
      }
    } catch (e) {
      console.warn('Supabase query error, checking server API cache:', e);
    }
  }

  // Resilient fallback: Query server API (/api/warnings) hydrated from Supabase
  try {
    const res = await fetch('/api/warnings?status=active');
    if (res.ok) {
      const serverData = await res.json();
      if (Array.isArray(serverData) && serverData.length > 0) {
        return serverData.map(w => {
          const raw = w.bulletin || w.raw_text || w.text || w.rawText || w.raw_nav_warning || w.body || w.details;
          const categories = Array.isArray(w.categories) ? w.categories : [];
          const primaryCategory = categories[0] || w.hazard_category || 'general';
          return {
            id: w.db_uuid || w.warning_id || w.id,
            warning_id: w.warning_id || w.source_warning_id || w.id,
            canonical_id: w.warning_id || w.source_warning_id,
            navarea: w.navarea,
            title: w.title,
            severity: w.risk_level || w.severity || 'high',
            category: primaryCategory,
            categories: categories.length ? categories : [primaryCategory],
            issued_date: w.issued_date || (w.issued_at ? w.issued_at.split('T')[0] : null) || w.issued,
            issued_text: w.issued_text || w.issued_date || w.issued,
            issued_at: w.issued_at,
            coordinates: w.spatial?.raw_coordinate_text?.[0] || w.coordinates,
            latitude: w.latitude ?? null,
            longitude: w.longitude ?? null,
            status: w.status,
            raw_text: raw,
            bulletin: raw,
            text: raw,
          };
        });
      }
    }
  } catch (err) {
    console.warn('Server API fallback notice:', err);
  }

  return [];
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

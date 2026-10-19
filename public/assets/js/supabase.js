// ═══════════ SUPABASE INIT ═══════════
const LIGHT_COLUMNS = 'id, warning_id, canonical_id, navarea, title, area_text, severity, risk_level, category, categories, hazard_category, issued_date, issued_text, coordinates, latitude, longitude, status, triage_tier, is_verified, raw_text';

// Use environment variables if bundled, otherwise fallback to project keys
const SUPABASE_URL = (typeof process !== 'undefined' && process.env.VITE_SUPABASE_URL) || 'https://ocqpfbkuiomzhbxxvemi.supabase.co';
const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env.VITE_SUPABASE_ANON_KEY) || 'sb_publishable_mBu1kjX8d36QSDlgvNudvw_cztVRegR';

// Initialize Supabase client globally so public.js and admin.js can use it
window.hwSupabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

if (!window.hwSupabase) {
  console.warn('⚠️ Supabase client failed to initialize. Check if supabase-js CDN is loaded.');
}

// ═══════════ DATA FETCH HELPERS ═══════════
async function fetchActiveWarnings() {
  if (window.hwSupabase) {
    // 1. Prioritize pre-calculated PostGIS dynamic spatial view
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

          const primaryCategory = Array.isArray(w.categories) && w.categories.length > 0 ? w.categories[0] : (w.category || 'general');

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
    } catch (spatialEx) {
      console.warn('nav_warnings_active_spatial query notice, falling back to master:', spatialEx);
    }

    // 2. Fallback to master nav_warnings table
    try {
      const { data, error } = await window.hwSupabase
        .from('nav_warnings')
        .select(LIGHT_COLUMNS)
        .eq('status', 'active')
        .order('issued_date', { ascending: false });
      
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(w => ({
          ...w,
          id: w.id || w.warning_id,
          warning_id: w.canonical_id || w.warning_id,
          canonical_id: w.canonical_id || w.warning_id,
          raw_text: w.raw_text || w.bulletin || w.text || w.rawText,
          bulletin: w.bulletin || w.raw_text || w.text,
          text: w.text || w.raw_text,
        }));
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
          return {
            id: w.warning_id || w.id,
            warning_id: w.source_warning_id || w.warning_number || w.warning_id,
            navarea: w.navarea,
            title: w.title,
            severity: w.risk_level || w.severity || 'high',
            category: w.hazard_category || w.category || 'general',
            issued_date: w.issued_date || (w.issued_at ? w.issued_at.split('T')[0] : null) || w.issued,
            issued_text: w.issued_text || w.issued_date || w.issued,
            issued_at: w.issued_at,
            coordinates: w.spatial?.raw_coordinate_text?.[0] || w.coordinates,
            latitude: w.latitude,
            longitude: w.longitude,
            status: w.status,
            is_verified: Boolean(w.is_verified),
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
  const targetId = isObj ? (identifier.id || identifier.warning_id) : identifier;
  const targetWarnId = isObj ? (identifier.warning_id || identifier.source_warning_id || identifier.id) : identifier;

  if (window.hwSupabase) {
    try {
      const isUuid = typeof targetId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);

      let query = window.hwSupabase
        .from('nav_warnings')
        .select('raw_text, verified_at, created_at');

      if (isUuid) {
        query = query.eq('id', targetId);
      } else {
        query = query.or(`warning_id.eq."${targetWarnId}",source_warning_id.eq."${targetWarnId}"`);
      }

      const { data, error } = await (query.maybeSingle ? query.maybeSingle() : query.limit(1));
      const record = Array.isArray(data) ? data[0] : data;
      if (!error && record && (record.raw_text || record.bulletin || record.text)) {
        const raw = record.bulletin || record.raw_text || record.text;
        return {
          ...record,
          raw_text: raw,
          bulletin: raw,
          text: raw,
        };
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
        w.source_warning_id === targetId ||
        w.warning_id === targetWarnId ||
        w.source_warning_id === targetWarnId
      ));
      if (match) {
        const raw = match.bulletin || match.raw_text || match.text || match.rawText || match.raw_nav_warning || match.body || match.details;
        return {
          raw_text: raw,
          bulletin: raw,
          text: raw,
          verified_at: match.verified_at || match.last_seen_at,
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


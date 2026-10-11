// ═══════════ SUPABASE INIT ═══════════
const LIGHT_COLUMNS = 'id, warning_id, navarea, title, severity, category, issued_date, issued_text, coordinates, latitude, longitude, status, is_verified';

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
    try {
      const { data, error } = await window.hwSupabase
        .from('nav_warnings')
        .select(LIGHT_COLUMNS)
        .eq('status', 'active')
        .order('issued_date', { ascending: false });
      
      if (!error && Array.isArray(data) && data.length > 0) {
        return data;
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
        return serverData.map(w => ({
          id: w.warning_id || w.id,
          warning_id: w.source_warning_id || w.warning_number || w.warning_id,
          navarea: w.navarea,
          title: w.title,
          severity: w.risk_level || w.severity || 'high',
          category: w.hazard_category || w.category || 'general',
          issued_date: w.issued_date,
          issued_text: w.issued_text,
          coordinates: w.spatial?.raw_coordinate_text?.[0] || w.coordinates,
          latitude: w.latitude,
          longitude: w.longitude,
          status: w.status,
          is_verified: Boolean(w.is_verified),
          raw_text: w.raw_text,
        }));
      }
    }
  } catch (err) {
    console.warn('Server API fallback notice:', err);
  }

  return [];
}

async function fetchWarningDetails(id) {
  if (window.hwSupabase) {
    try {
      const { data, error } = await window.hwSupabase
        .from('nav_warnings')
        .select('raw_text, verified_at, created_at')
        .eq('id', id)
        .single();
        
      if (!error && data) {
        return data;
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
      const match = list.find(w => (w.warning_id === id || w.id === id || w.source_warning_id === id));
      if (match) {
        return {
          raw_text: match.raw_text,
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


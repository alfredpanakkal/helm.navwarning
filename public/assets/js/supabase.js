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
  if (!window.hwSupabase) return [];
  try {
    const { data, error } = await window.hwSupabase
      .from('nav_warnings')
      .select(LIGHT_COLUMNS)
      .eq('status', 'active')
      .order('issued_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching warnings:', error);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('Failed to fetch from Supabase:', e);
    return [];
  }
}

async function fetchWarningDetails(id) {
  if (!window.hwSupabase) return null;
  try {
    const { data, error } = await window.hwSupabase
      .from('nav_warnings')
      .select('raw_text, verified_at, created_at')
      .eq('id', id)
      .single();
      
    if (error) {
      console.error('Error fetching details:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.error('Failed to fetch details:', e);
    return null;
  }
}

window.fetchActiveWarnings = fetchActiveWarnings;
window.fetchWarningDetails = fetchWarningDetails;

window.hwDb = {
  fetchActiveWarnings,
  fetchWarningDetails,
};


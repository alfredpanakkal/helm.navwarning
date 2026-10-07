// ═══════════ SUPABASE INIT ═══════════
// Use environment variables if bundled, otherwise fallback to project keys
const SUPABASE_URL = (typeof process !== 'undefined' && process.env.VITE_SUPABASE_URL) || 'https://ocqpfbkuiomzhbxxvemi.supabase.co';
const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env.VITE_SUPABASE_ANON_KEY) || 'sb_publishable_mBu1kjX8d36QSDlgvNudvw_cztVRegR';

// Initialize Supabase client globally so public.js and admin.js can use it
window.hwSupabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

if (!window.hwSupabase) {
  console.warn('⚠️ Supabase client failed to initialize. Check if supabase-js CDN is loaded.');
}

// ═══════════ DATA FETCH HELPERS ═══════════
window.hwDb = {
  async fetchActiveWarnings() {
    if (!window.hwSupabase) return [];
    try {
      const { data, error } = await window.hwSupabase
        .from('nav_warnings')
        .select('*')
        .eq('status', 'active');
      
      if (error) {
        console.error('Supabase fetch error:', error);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Failed to fetch from Supabase:', e);
      return [];
    }
  },

  async fetchUnverified() {
    if (!window.hwSupabase) return [];
    try {
      const { data, error } = await window.hwSupabase
        .from('nav_warnings')
        .select('*')
        .eq('is_verified', false)
        .eq('status', 'active');
      return data || [];
    } catch (e) {
      return [];
    }
  },

  async verifyWarning(id) {
    if (!window.hwSupabase) return { error: 'No db connection' };
    return await window.hwSupabase
      .from('nav_warnings')
      .update({ is_verified: true, verified_at: new Date().toISOString() })
      .eq('warning_id', id);
  },

  async rejectWarning(id) {
    if (!window.hwSupabase) return { error: 'No db connection' };
    return await window.hwSupabase
      .from('nav_warnings')
      .update({ status: 'rejected' })
      .eq('warning_id', id);
  },

  async publishImport(warnings) {
    if (!window.hwSupabase) return { error: 'No db connection' };
    return await window.hwSupabase
      .from('nav_warnings')
      .upsert(warnings, { onConflict: 'source_id, warning_id', ignoreDuplicates: true });
  }
};

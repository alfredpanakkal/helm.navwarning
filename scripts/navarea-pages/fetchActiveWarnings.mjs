// scripts/navarea-pages/fetchActiveWarnings.mjs
// Build-time read of active warnings through the SAME public anon Supabase
// access the site uses at runtime (publishable key only — no service role,
// no secrets). Returns null on failure so callers can preserve the last
// generated snapshots; an empty array is a successful, genuinely empty result.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ocqpfbkuiomzhbxxvemi.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_mBu1kjX8d36QSDlgvNudvw_cztVRegR';

const COLUMNS = 'canonical_id,navarea,title,area_text,categories,status,triage_tier,data_quality,valid_from,valid_to,issued_at,raw_text,updated_at';
const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

export async function fetchActiveWarnings() {
  const rows = [];
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = SUPABASE_URL + '/rest/v1/nav_warnings?select=' + encodeURIComponent(COLUMNS) +
        '&status=eq.active&order=updated_at.desc&limit=' + PAGE_SIZE + '&offset=' + (page * PAGE_SIZE);
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
          Accept: 'application/json'
        }
      });
      if (!res.ok) throw new Error('Supabase REST ' + res.status);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Supabase REST returned a non-array response');
      if (data.length === 0) break;
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    return rows;
  } catch (e) {
    console.warn('Warning snapshot refresh skipped; preserving previous snapshots: ' + e.message);
    return null;
  }
}

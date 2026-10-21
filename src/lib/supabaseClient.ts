import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key] as string;
  }
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');

// New-style Supabase publishable key first (sb_publishable_...), legacy anon
// names kept as fallbacks. .env.example defines SUPABASE_PUBLISHABLE_KEY, so it
// MUST be accepted here or the client silently stays null and the app falls
// back to local mock data.
const supabasePublicKey =
  getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') ||
  getEnvVar('SUPABASE_PUBLISHABLE_KEY') ||
  getEnvVar('VITE_SUPABASE_ANON_KEY') ||
  getEnvVar('SUPABASE_ANON_KEY') ||
  getEnvVar('SUPABASE_KEY');

if (!supabaseUrl || !supabasePublicKey) {
  console.warn('⚠️ Supabase environment variables missing (expected SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY). The application will fall back to local mock data.', {
    urlLength: supabaseUrl.length,
    keyLength: supabasePublicKey.length
  });
}

// Only create the client if both keys are present.
// If missing, export null so API services know to cleanly fallback.
export const supabase = supabaseUrl && supabasePublicKey ? createClient(supabaseUrl, supabasePublicKey) : null;

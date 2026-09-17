import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase environment variables missing. The application will fall back to local mock data.', {
    urlLength: supabaseUrl.length,
    keyLength: supabaseAnonKey.length
  });
}

// Only create the client if both keys are present.
// If missing, export null so API services know to cleanly fallback.
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

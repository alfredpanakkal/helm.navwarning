import { createClient } from '@supabase/supabase-js';

/*
  Run this SQL in your Supabase project to create the table:

  CREATE TABLE nav_warnings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_id TEXT NOT NULL,
    warning_id TEXT NOT NULL,
    title TEXT,
    raw_text TEXT NOT NULL,
    issued_date DATE,
    navarea TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_id, warning_id)
  );
*/

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

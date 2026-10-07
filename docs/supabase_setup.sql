-- ══════════════════════════════════════════════════════════════
-- HELM.WARNING SUPABASE SETUP & MIGRATION SCRIPT
-- Phase 4 & Phase 5: Database Setup & Security Hardening
-- ══════════════════════════════════════════════════════════════

-- 1. Main warnings table
CREATE TABLE IF NOT EXISTS public.nav_warnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warning_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  navarea TEXT NOT NULL,
  title TEXT,
  severity TEXT DEFAULT 'high',
  issued_date TEXT,
  issued_text TEXT,
  coordinates TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status TEXT DEFAULT 'active',
  category TEXT,
  raw_text TEXT,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, warning_id)
);

-- 2. Generation log
CREATE TABLE IF NOT EXISTS public.ingestion_generations (
  id TEXT PRIMARY KEY,
  generation_id TEXT,
  source_id TEXT,
  total_warnings INT DEFAULT 0,
  active_count INT DEFAULT 0,
  status TEXT DEFAULT 'COMPLETE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Sources registry
CREATE TABLE IF NOT EXISTS public.sources_registry (
  source_id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  publisher TEXT,
  url TEXT,
  status TEXT DEFAULT 'unverified',
  warning_count INT DEFAULT 0
);

-- 4. Pipeline logs
CREATE TABLE IF NOT EXISTS public.pipeline_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  level TEXT,
  message TEXT
);

-- ═══════════════ PHASE 5: SECURITY HARDENING ═══════════════

-- ⚠️ POLICIES FIRST, ENABLE LAST ⚠️

-- 1. Create policies
CREATE POLICY "public_read_active" ON public.nav_warnings
  FOR SELECT USING (status = 'active');

CREATE POLICY "admin_write" ON public.nav_warnings
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "public_read_generations" ON public.ingestion_generations
  FOR SELECT USING (true);

CREATE POLICY "admin_write_generations" ON public.ingestion_generations
  FOR ALL USING (auth.role() = 'authenticated');

-- 2. Enable RLS LAST
ALTER TABLE public.nav_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_generations ENABLE ROW LEVEL SECURITY;

-- ═══════════════ EMERGENCY UNLOCK (Keep safe) ═══════════════
-- If locked out or testing APIs directly without auth header:
-- ALTER TABLE public.nav_warnings DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.ingestion_generations DISABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- HELM.WARNING SUPABASE SETUP & MIGRATION SCRIPT
-- Phase 4 & Phase 5: Database Setup, NAVAREA Segregation & Security
-- ══════════════════════════════════════════════════════════════

-- 1. Main public warnings table (Unified Master View & Fallback)
CREATE TABLE IF NOT EXISTS public.nav_warnings (
  id UUID DEFAULT gen_random_uuid(),
  warning_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  publisher_id TEXT,
  navarea TEXT NOT NULL,
  source_warning_id TEXT,
  series TEXT,
  warning_number TEXT,
  warning_year INT,
  title TEXT,
  authority TEXT,
  sub_area TEXT,
  area_text TEXT,
  risk_level TEXT DEFAULT 'high',
  urgency_score INT,
  issued_date TEXT,
  issued_text TEXT,
  issued_at TIMESTAMPTZ,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  valid_until_utc TIMESTAMPTZ,
  coordinates TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  spatial JSONB,
  spatial_groups JSONB,
  status TEXT DEFAULT 'active',
  status_basis TEXT,
  category TEXT,
  categories TEXT,
  hazard_category TEXT,
  charts TEXT,
  web_link TEXT,
  source_url TEXT,
  raw_text TEXT NOT NULL,
  is_cancelled BOOLEAN DEFAULT false,
  cancellation_text TEXT,
  extraction_method TEXT DEFAULT 'deterministic',
  generation_id TEXT,
  evidence_trail JSONB,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (source_id, warning_id),
  CONSTRAINT nav_warnings_source_id_warning_id_key UNIQUE (source_id, warning_id)
);

-- 2. Verbatim Raw Messages Audit Store
CREATE TABLE IF NOT EXISTS public.raw_messages (
  message_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warning_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  full_raw_text TEXT NOT NULL,
  subject_header TEXT,
  received_timestamp TIMESTAMPTZ DEFAULT NOW(),
  checksum_sha256 TEXT
);

-- 3. Raw Artifacts Storage (Immutable HTTP / feed payloads)
CREATE TABLE IF NOT EXISTS public.raw_artifacts (
  id TEXT PRIMARY KEY,
  artifact_id TEXT,
  source_id TEXT NOT NULL,
  navarea TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  path TEXT NOT NULL,
  content_type TEXT,
  content_hash TEXT,
  raw_text TEXT,
  preview_text TEXT,
  http_status INT DEFAULT 200,
  evidence_hash TEXT,
  artifact_ref TEXT
);

-- 4. Generation log (Atomic publishing transactions)
CREATE TABLE IF NOT EXISTS public.ingestion_generations (
  id TEXT PRIMARY KEY,
  generation_id TEXT,
  source_id TEXT,
  navarea TEXT,
  total_warnings INT DEFAULT 0,
  total_warnings_found INT DEFAULT 0,
  active_count INT DEFAULT 0,
  status TEXT DEFAULT 'COMPLETE',
  completeness_status TEXT DEFAULT 'verified',
  evidence_hash TEXT,
  artifact_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Sources registry
CREATE TABLE IF NOT EXISTS public.sources_registry (
  source_id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL,
  publisher_name TEXT NOT NULL,
  navareas JSONB,
  scope TEXT,
  discovery_url TEXT NOT NULL,
  format TEXT NOT NULL,
  publication_semantics TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  verification JSONB,
  health JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Pipeline logs
CREATE TABLE IF NOT EXISTS public.pipeline_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  level TEXT,
  message TEXT
);

-- ══════════════════════════════════════════════════════════════
-- NAVAREA SEGREGATED SCHEMAS & COMPLETE PARAMETER STORES
-- Creates dedicated PostgreSQL schemas for all 21 NAVAREAs + Baltic
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  areas TEXT[] := ARRAY[
    'navarea_1', 'navarea_baltic', 'navarea_2', 'navarea_3', 'navarea_4',
    'navarea_5', 'navarea_6', 'navarea_7', 'navarea_8', 'navarea_9',
    'navarea_10', 'navarea_11', 'navarea_12', 'navarea_13', 'navarea_14',
    'navarea_15', 'navarea_16', 'navarea_17', 'navarea_18', 'navarea_19',
    'navarea_20', 'navarea_21'
  ];
  schema_name TEXT;
BEGIN
  FOREACH schema_name IN ARRAY areas LOOP
    -- Create schema for individual navigation area
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

    -- 1. Create fully segregated nav_warnings table with all 6 parameter domains
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.nav_warnings (
        id UUID DEFAULT gen_random_uuid(),
        warning_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        publisher_id TEXT,
        navarea TEXT NOT NULL,
        source_warning_id TEXT,
        series TEXT,
        warning_number TEXT,
        warning_year INT,
        title TEXT,
        authority TEXT,
        sub_area TEXT,
        area_text TEXT,
        risk_level TEXT DEFAULT ''high'',
        urgency_score INT,
        issued_date TEXT,
        issued_text TEXT,
        issued_at TIMESTAMPTZ,
        valid_from TIMESTAMPTZ,
        valid_to TIMESTAMPTZ,
        valid_until_utc TIMESTAMPTZ,
        coordinates TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        spatial JSONB,
        spatial_groups JSONB,
        status TEXT DEFAULT ''active'',
        status_basis TEXT,
        category TEXT,
        categories TEXT,
        hazard_category TEXT,
        charts TEXT,
        web_link TEXT,
        source_url TEXT,
        raw_text TEXT NOT NULL,
        is_cancelled BOOLEAN DEFAULT false,
        cancellation_text TEXT,
        extraction_method TEXT DEFAULT ''deterministic'',
        generation_id TEXT,
        evidence_trail JSONB,
        is_verified BOOLEAN DEFAULT false,
        verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (source_id, warning_id),
        CONSTRAINT %I UNIQUE (source_id, warning_id)
      )', schema_name, schema_name || '_uniq_warn');

    -- 2. Create segregated raw_messages audit store
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.raw_messages (
        message_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        warning_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        full_raw_text TEXT NOT NULL,
        subject_header TEXT,
        received_timestamp TIMESTAMPTZ DEFAULT NOW(),
        checksum_sha256 TEXT
      )', schema_name);

    -- 3. Enable Row Level Security on segregated schema tables
    EXECUTE format('ALTER TABLE %I.nav_warnings ENABLE ROW LEVEL SECURITY', schema_name);
    EXECUTE format('ALTER TABLE %I.raw_messages ENABLE ROW LEVEL SECURITY', schema_name);

    -- 4. Create RLS policies for segregated schema
    EXECUTE format('
      DROP POLICY IF EXISTS %I ON %I.nav_warnings;
      CREATE POLICY %I ON %I.nav_warnings FOR SELECT USING (status = ''active'');
      
      DROP POLICY IF EXISTS %I ON %I.nav_warnings;
      CREATE POLICY %I ON %I.nav_warnings FOR ALL USING (auth.role() = ''authenticated'');

      DROP POLICY IF EXISTS %I ON %I.raw_messages;
      CREATE POLICY %I ON %I.raw_messages FOR ALL USING (auth.role() = ''authenticated'');
    ', 
      schema_name || '_pub_read', schema_name, schema_name || '_pub_read', schema_name,
      schema_name || '_adm_all', schema_name, schema_name || '_adm_all', schema_name,
      schema_name || '_msg_adm', schema_name, schema_name || '_msg_adm', schema_name
    );
  END LOOP;
END $$;

-- ═══════════════ SECURITY HARDENING (PUBLIC SCHEMA) ═══════════════

-- 1. Create policies on public schema tables
DROP POLICY IF EXISTS "public_read_active" ON public.nav_warnings;
CREATE POLICY "public_read_active" ON public.nav_warnings
  FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "admin_write" ON public.nav_warnings;
CREATE POLICY "admin_write" ON public.nav_warnings
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "public_read_generations" ON public.ingestion_generations;
CREATE POLICY "public_read_generations" ON public.ingestion_generations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_write_generations" ON public.ingestion_generations;
CREATE POLICY "admin_write_generations" ON public.ingestion_generations
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "public_read_sources" ON public.sources_registry;
CREATE POLICY "public_read_sources" ON public.sources_registry
  FOR SELECT USING (enabled = true);

DROP POLICY IF EXISTS "admin_write_sources" ON public.sources_registry;
CREATE POLICY "admin_write_sources" ON public.sources_registry
  FOR ALL USING (auth.role() = 'authenticated');

-- 2. Enable RLS
ALTER TABLE public.nav_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources_registry ENABLE ROW LEVEL SECURITY;

-- ═══════════════ IN-FORCE SNAPSHOTS TABLE (PHASE 3) ═══════════════

CREATE TABLE IF NOT EXISTS public.in_force_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  navarea TEXT NOT NULL,
  snapshot_warning_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  issue_date TEXT,
  entries JSONB NOT NULL,
  cancelled_refs TEXT[] DEFAULT '{}',
  is_partial BOOLEAN DEFAULT false,
  is_authoritative BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_source CHECK (source_id <> ''),
  CONSTRAINT fk_navarea CHECK (navarea ~ '^[A-Z0-9]+$'),
  CONSTRAINT uq_in_force_snapshots_navarea_warning UNIQUE (navarea, snapshot_warning_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_in_force_snapshots_navarea
ON public.in_force_snapshots(navarea);

CREATE INDEX IF NOT EXISTS idx_in_force_snapshots_issued_at
ON public.in_force_snapshots(issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_in_force_snapshots_authoritative
ON public.in_force_snapshots(navarea, is_authoritative)
WHERE is_authoritative = true;

CREATE INDEX IF NOT EXISTS idx_in_force_snapshots_navarea_issued
ON public.in_force_snapshots(navarea, issued_at DESC);

-- Enable Row Level Security
ALTER TABLE public.in_force_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public read access to in_force_snapshots"
ON public.in_force_snapshots
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow authenticated insert to in_force_snapshots"
ON public.in_force_snapshots
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update to in_force_snapshots"
ON public.in_force_snapshots
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Notify PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';


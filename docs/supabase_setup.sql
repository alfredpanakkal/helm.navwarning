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

-- ══════════════════════════════════════════════════════════════
-- POSTGIS RELATIONAL SCHEMA: MASTER, CHILD TABLES & VIEWS
-- ══════════════════════════════════════════════════════════════

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add categories column to master table
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS canonical_id TEXT;
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS triage_tier TEXT DEFAULT 'B';
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS data_quality TEXT DEFAULT 'EXPLICIT';
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS parsing_method TEXT DEFAULT 'RULE';
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS unplotted_reason TEXT;
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS shoal_depth_m DOUBLE PRECISION;
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS is_depth_unknown BOOLEAN DEFAULT false;
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS space_launch_mission TEXT;
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS altitude_ceiling_fl INT;
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS radio_frequencies TEXT[] DEFAULT '{}';
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS radio_communications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS cancels_ids TEXT[] DEFAULT '{}';
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS qa_flags TEXT[] DEFAULT '{}';
ALTER TABLE public.nav_warnings ADD COLUMN IF NOT EXISTS duplicate_of_id UUID REFERENCES public.nav_warnings(id);

-- Child Table 1: Geometries
CREATE TABLE IF NOT EXISTS public.nav_warning_geometries (
  geom_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_id UUID NOT NULL REFERENCES public.nav_warnings(id) ON DELETE CASCADE,
  zone_label TEXT,
  feature_type TEXT NOT NULL,
  geom_postgis geography(Geometry, 4326) NOT NULL,
  buffer_nm DOUBLE PRECISION DEFAULT 0.0,
  corridor_half_width_nm DOUBLE PRECISION,
  altitude_floor_m DOUBLE PRECISION DEFAULT 0.0,
  altitude_ceiling_fl INTEGER,
  sweep_start_azimuth DOUBLE PRECISION,
  sweep_end_azimuth DOUBLE PRECISION,
  sweep_radius_nm DOUBLE PRECISION,
  snapping_rule TEXT DEFAULT 'NONE'
);
CREATE INDEX IF NOT EXISTS idx_nav_warning_geometries_postgis ON public.nav_warning_geometries USING GIST (geom_postgis);

-- Child Table 2: Entities
CREATE TABLE IF NOT EXISTS public.nav_warning_entities (
  entity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_id UUID NOT NULL REFERENCES public.nav_warnings(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  role TEXT DEFAULT 'PRIMARY',
  callsign TEXT,
  mmsi TEXT,
  tow_length_m DOUBLE PRECISION,
  tow_speed_kts DOUBLE PRECISION,
  streamer_count INTEGER,
  streamer_length_m DOUBLE PRECISION,
  streamer_breadth_m DOUBLE PRECISION,
  streamer_depth_m DOUBLE PRECISION,
  clearance_requested_nm DOUBLE PRECISION,
  depth_m DOUBLE PRECISION,
  depth_status TEXT,
  datum_ref TEXT DEFAULT 'LAT',
  radio_channels JSONB DEFAULT '[]'::jsonb
);

-- Child Table 3: Charts
CREATE TABLE IF NOT EXISTS public.nav_warning_charts (
  chart_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_id UUID NOT NULL REFERENCES public.nav_warnings(id) ON DELETE CASCADE,
  authority TEXT DEFAULT 'BA',
  chart_number TEXT NOT NULL,
  int_equivalent TEXT,
  is_international BOOLEAN DEFAULT false,
  raw_citation TEXT
);

-- Child Table 4: Schedules
CREATE TABLE IF NOT EXISTS public.nav_warning_schedules (
  schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_id UUID NOT NULL REFERENCES public.nav_warnings(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  is_alternate BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  days_of_week INTEGER[]
);

-- Child Table 5: Cancellations
CREATE TABLE IF NOT EXISTS public.nav_warning_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancelling_warning_id UUID NOT NULL REFERENCES public.nav_warnings(id) ON DELETE CASCADE,
  target_canonical_id TEXT NOT NULL,
  target_warning_id UUID REFERENCES public.nav_warnings(id) ON DELETE SET NULL,
  cancellation_type TEXT DEFAULT 'EXPLICIT_NOTICE',
  paragraph_ref TEXT
);

-- Child Table 6: Audits
CREATE TABLE IF NOT EXISTS public.nav_warning_audits (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_id UUID NOT NULL REFERENCES public.nav_warnings(id) ON DELETE CASCADE,
  operator_id TEXT NOT NULL,
  previous_tier TEXT,
  new_tier TEXT,
  action TEXT NOT NULL,
  reason TEXT,
  signature_hash TEXT NOT NULL,
  diff_patch JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Views
CREATE OR REPLACE VIEW public.nav_warnings_active_spatial AS
  SELECT 
    w.id AS warning_id,
    w.canonical_id,
    w.navarea,
    w.title,
    w.area_text,
    w.categories,
    w.status,
    w.triage_tier,
    w.data_quality,
    w.valid_from,
    w.valid_to,
    w.radio_frequencies,
    w.space_launch_mission,
    g.geom_id,
    g.zone_label,
    g.feature_type,
    g.buffer_nm,
    g.corridor_half_width_nm,
    g.altitude_floor_m,
    g.altitude_ceiling_fl,
    g.geom_postgis,
    ST_AsGeoJSON(g.geom_postgis)::jsonb AS geojson_blob
  FROM public.nav_warnings w
  JOIN public.nav_warning_geometries g ON w.id = g.warning_id
  WHERE w.status = 'active'
    AND w.triage_tier = 'A';

CREATE OR REPLACE VIEW public.nav_warnings_review_queue AS
  SELECT
    w.id AS warning_id,
    w.canonical_id,
    w.navarea,
    w.raw_text,
    w.triage_tier,
    w.data_quality,
    w.unplotted_reason,
    w.qa_flags,
    w.issued_at
  FROM public.nav_warnings w
  WHERE w.status = 'active'
    AND w.triage_tier IN ('B', 'C')
  ORDER BY w.issued_at DESC NULLS LAST;


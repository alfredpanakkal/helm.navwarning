-- ============================================
-- UP MIGRATION: IN-FORCE SNAPSHOTS TABLE
-- ============================================

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

-- ============================================
-- DOWN MIGRATION (COMMENTED OUT FOR SAFETY)
-- ============================================
-- DROP POLICY IF EXISTS "Allow authenticated update to in_force_snapshots" ON public.in_force_snapshots;
-- DROP POLICY IF EXISTS "Allow authenticated insert to in_force_snapshots" ON public.in_force_snapshots;
-- DROP POLICY IF EXISTS "Allow public read access to in_force_snapshots" ON public.in_force_snapshots;
-- DROP INDEX IF EXISTS idx_in_force_snapshots_navarea_issued;
-- DROP INDEX IF EXISTS idx_in_force_snapshots_authoritative;
-- DROP INDEX IF EXISTS idx_in_force_snapshots_issued_at;
-- DROP INDEX IF EXISTS idx_in_force_snapshots_navarea;
-- DROP TABLE IF EXISTS public.in_force_snapshots;

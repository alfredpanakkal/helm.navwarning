-- ============================================================================
-- Supabase anon-read diagnostics & repair (helm.navwarning PR #9 companion)
-- Run in the Supabase SQL Editor (as postgres / service role).
--
-- Symptom: frontend queries succeed (no 42501 permission denied) but every
-- table/view returns [] to the anon/publishable key.
-- Cause: RLS is ENABLED on the tables but the "public read" SELECT policies
-- from Helm.Warning.Backend migrations/20261020_realtime_and_audit.sql are
-- missing (or were dropped). RLS with no policy = zero visible rows, silently.
-- Note: GRANTs (20261021_restore_anon_read_grants.sql) control table ACCESS;
-- policies control ROW VISIBILITY. Both are required.
-- ============================================================================

-- ── 1. DIAGNOSE: what does anon currently have? ────────────────────────────
SELECT has_table_privilege('anon', 'public.nav_warnings', 'SELECT')               AS anon_can_select_nav_warnings,
       has_table_privilege('anon', 'public.nav_warnings_active_spatial', 'SELECT') AS anon_can_select_spatial_view,
       has_table_privilege('anon', 'public.nav_warnings_review_queue', 'SELECT')  AS anon_can_select_review_queue,
       has_table_privilege('anon', 'public.raw_messages', 'SELECT')               AS anon_can_select_raw_messages;

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('nav_warnings', 'nav_warning_geometries', 'raw_messages')
ORDER BY tablename;

-- How many rows exist at all (run as postgres; if 0, the pipeline has not
-- published anything yet and the frontend is correctly showing nothing):
SELECT count(*) AS total_rows,
       count(*) FILTER (WHERE status = 'active')       AS active_rows,
       count(*) FILTER (WHERE triage_tier = 'A')        AS tier_a_rows
FROM public.nav_warnings;

-- ── 2. REPAIR: (re)create the public read policies if missing ───────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nav_warnings' AND policyname = 'public read nav_warnings') THEN
    CREATE POLICY "public read nav_warnings" ON public.nav_warnings
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nav_warning_geometries' AND policyname = 'public read geometries') THEN
    CREATE POLICY "public read geometries" ON public.nav_warning_geometries
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nav_warning_entities' AND policyname = 'public read entities') THEN
    CREATE POLICY "public read entities" ON public.nav_warning_entities
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nav_warning_charts' AND policyname = 'public read charts') THEN
    CREATE POLICY "public read charts" ON public.nav_warning_charts
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'raw_messages' AND policyname = 'public read raw_messages') THEN
    CREATE POLICY "public read raw_messages" ON public.raw_messages
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- ── 3. REPAIR: re-assert the anon grants (idempotent) ────────────────────────
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;

-- Keep audit data out of public reach (matches 20261021 migration):
REVOKE SELECT ON public.nav_warning_audits FROM anon, authenticated;

-- ── 4. VERIFY ───────────────────────────────────────────────────────────────
-- All should be true:
SELECT has_table_privilege('anon', 'nav_warnings', 'SELECT')              AS grant_ok,
       EXISTS (SELECT 1 FROM pg_policies
               WHERE tablename = 'nav_warnings'
                 AND policyname = 'public read nav_warnings')            AS policy_ok;

-- Optional stricter policy (anon sees ONLY active rows instead of everything).
-- The frontend Data Bank intentionally lists cancelled/expired rows too, so
-- only apply this if you want the public API surface restricted:
-- DROP POLICY "public read nav_warnings" ON public.nav_warnings;
-- CREATE POLICY "public read nav_warnings" ON public.nav_warnings
--   FOR SELECT TO anon, authenticated USING (status = 'active');

-- ── 5. ANON SIMULATION ─────────────────────────────────────────────────────
-- Count what the anon role would actually see (should equal active_rows+):
SET LOCAL ROLE anon;
SELECT count(*) AS rows_visible_to_anon FROM public.nav_warnings;
RESET ROLE;

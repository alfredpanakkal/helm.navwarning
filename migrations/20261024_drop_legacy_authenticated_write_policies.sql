-- ================================================================================
-- 20261024_drop_legacy_authenticated_write_policies.sql
-- SECURITY FIX: remove legacy permissive write policies from docs/supabase_setup.sql
-- that allowed ANY signed-in (authenticated) user to write.
--
-- Postgres combines permissive policies with OR. The 20261024 admin-lineage
-- migration adds admin-only write policies, but if these legacy policies are
-- still live they OR-bypass the admin restriction entirely.
--
-- VERIFY FIRST (read-only, Supabase SQL editor):
--   select tablename, policyname, cmd, roles, qual, with_check
--   from pg_policies where schemaname = 'public' order by 1, 2;
-- Look for: auth.role() = 'authenticated' on any ALL / INSERT / UPDATE / DELETE policy.
-- Also confirm the 20261024 admin policies exist (nav_warnings write = admin only,
-- nav_warning_audits no_update / no_delete) before dropping anything.
--
-- This migration is idempotent (IF EXISTS) and safe to run if the policies
-- are already gone. It does NOT create replacement policies — the 20261024
-- migration is the authoritative admin policy set.
-- ================================================================================

BEGIN;

-- Legacy broad write policies created by docs/supabase_setup.sql (superseded script)
DROP POLICY IF EXISTS "admin_write" ON public.nav_warnings;
DROP POLICY IF EXISTS "admin_write_generations" ON public.ingestion_generations;
DROP POLICY IF EXISTS "admin_write_sources" ON public.sources_registry;

-- raw_messages: the legacy setup created its policy via a DO block with a
-- generated name (pattern: allows ALL to authenticated). Find its live name:
--   select policyname from pg_policies
--   where schemaname='public' and tablename='raw_messages'
--     and cmd='ALL' and qual::text like '%authenticated%';
-- and drop it explicitly. Left as a manual step rather than a dynamic DROP,
-- so this migration never removes a policy it cannot fully identify.

-- in_force_snapshots: authenticated insert/update policies from the legacy
-- script. Only drop these if nothing in the current backend writes snapshots
-- with a user token (the server uses the service role, which bypasses RLS).
-- Commented out pending maintainer confirmation:
-- DROP POLICY IF EXISTS "Allow authenticated insert to in_force_snapshots" ON public.in_force_snapshots;
-- DROP POLICY IF EXISTS "Allow authenticated update to in_force_snapshots" ON public.in_force_snapshots;

COMMIT;

-- POST-CHECK (read-only):
--   select tablename, policyname, cmd, qual from pg_policies
--   where schemaname='public' and qual::text like '%authenticated%'
--   order by 1, 2;
-- Expected: no write-granting policies referencing 'authenticated' remain.
-- Then verify the public site still loads warnings (public_read_active stays)
-- and admin edit still works (20261024 admin policies).
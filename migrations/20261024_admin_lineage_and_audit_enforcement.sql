-- 20261024_admin_lineage_and_audit_enforcement.sql
-- Admin console E-series follow-up: DB-enforced supersede lineage + audit integrity.
-- Applies to the 20261019/20 schema (docs/supabase-backend-contract.md).
-- NOTE: the service-role key used by the Vercel functions bypasses RLS by design;
-- the policies below enforce the same rules for direct admin-client (JWT) writes
-- and make nav_warning_audits append-only for every non-service role.

-- ═══ 1. superseded_by lineage ═══════════════════════════════════════════
-- The NAVAREA "move" operation (supersede + recreate, E1) previously recorded
-- lineage only in qa_flags ('moved_from:…') and audit rows. This adds the hard,
-- queryable lineage column: set on the superseded row, pointing at the copy.
alter table public.nav_warnings
  add column if not exists superseded_by uuid references public.nav_warnings (id);

create index if not exists idx_nav_warnings_superseded_by
  on public.nav_warnings (superseded_by);

-- Backfill lineage for moves already made (copy carries moved_from:<old canonical>).
-- qa_flags is TEXT[] in docs/supabase_setup.sql but may exist as jsonb/json in
-- projects provisioned from the backend migrations, so try each shape in turn.
do $
begin
  update public.nav_warnings old
  set superseded_by = moved.id
  from public.nav_warnings moved
  where old.status = 'superseded'
    and moved.qa_flags is not null
    and ('moved_from:' || old.canonical_id) = any (moved.qa_flags::text[]);
exception when others then
  begin
    update public.nav_warnings old
    set superseded_by = moved.id
    from public.nav_warnings moved
    where old.status = 'superseded'
      and moved.qa_flags is not null
      and ('moved_from:' || old.canonical_id) = any (select jsonb_array_elements_text(moved.qa_flags::jsonb));
  exception when others then
    update public.nav_warnings old
    set superseded_by = moved.id
    from public.nav_warnings moved
    where old.status = 'superseded'
      and moved.qa_flags is not null
      and strpos(moved.qa_flags::text, 'moved_from:' || old.canonical_id) > 0;
  end;
end $;

-- ═══ 2. nav_warning_audits: append-only + admin-only ═══════════════════
-- Reproducible definition of the audit table (matches the inserts written by
-- api/admin/warning-edit.ts; no-op when the table already exists).
create table if not exists public.nav_warning_audits (
  audit_id uuid primary key default gen_random_uuid(),
  warning_id uuid not null references public.nav_warnings (id) on delete cascade,
  operator_id text not null default 'unknown-admin',
  action text not null,
  reason text not null default '',
  previous_tier text not null default 'B',
  new_tier text not null default 'B',
  signature_hash text,
  diff_patch jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_nav_warning_audits_warning_id
  on public.nav_warning_audits (warning_id, created_at desc);

alter table public.nav_warning_audits enable row level security;

-- Admins (app_metadata.role = 'admin') may read + append; nobody may update/delete.
drop policy if exists "admin_read_audits" on public.nav_warning_audits;
create policy "admin_read_audits" on public.nav_warning_audits
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admin_insert_audits" on public.nav_warning_audits;
create policy "admin_insert_audits" on public.nav_warning_audits
  for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "audits_no_update" on public.nav_warning_audits;
create policy "audits_no_update" on public.nav_warning_audits
  for update using (false) with check (false);

drop policy if exists "audits_no_delete" on public.nav_warning_audits;
create policy "audits_no_delete" on public.nav_warning_audits
  for delete using (false);

-- ═══ 3. nav_warnings: admin-only direct writes (JWT clients) ════════════
-- Service-role writes (Vercel functions) bypass RLS; this closes the door for
-- any other client that authenticates directly against Supabase.
drop policy if exists "admin_write_nav_warnings" on public.nav_warnings;
create policy "admin_write_nav_warnings" on public.nav_warnings
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

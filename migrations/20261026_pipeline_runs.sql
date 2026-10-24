-- 20261026_pipeline_runs.sql
-- Pipeline run observability ledger: one row per scraper invocation (parent,
-- source_id='all') and one child row per source, linked by parent_run_id.
-- Child rows are inserted at run start (status 'running') and updated on
-- completion, so a crash mid-run leaves a visible stuck row instead of the
-- failure silently vanishing — partial failures are always persisted.
-- Separate from ingestion_generations (per-sync counts) and
-- nav_warning_audits (per-edit provenance); this ledger explains what
-- happened during each scraper run, by source and NAVAREA.
-- NOTE: service-role writes (Vercel functions) bypass RLS by design; the
-- policies below govern JWT clients. Deletes are forbidden: no run can be
-- erased from history.

create table if not exists public.pipeline_runs (
  run_id uuid primary key default gen_random_uuid(),
  parent_run_id uuid references public.pipeline_runs (run_id) on delete set null,
  retry_of uuid references public.pipeline_runs (run_id) on delete set null,
  trigger text not null default 'manual'
    check (trigger in ('cron', 'admin', 'manual', 'edge_function')),
  source_id text not null,
  navarea text,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed', 'partial')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetch_status int,
  fetch_bytes bigint,
  artifact_id text,
  content_hash text,
  counts jsonb not null default '{}'::jsonb,
  stage_errors jsonb not null default '[]'::jsonb,
  error text
);

create index if not exists idx_pipeline_runs_started_at
  on public.pipeline_runs (started_at desc);
create index if not exists idx_pipeline_runs_parent_run_id
  on public.pipeline_runs (parent_run_id);
create index if not exists idx_pipeline_runs_source_id
  on public.pipeline_runs (source_id, started_at desc);

alter table public.pipeline_runs enable row level security;

drop policy if exists "admin_read_pipeline_runs" on public.pipeline_runs;
create policy "admin_read_pipeline_runs" on public.pipeline_runs
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admin_insert_pipeline_runs" on public.pipeline_runs;
create policy "admin_insert_pipeline_runs" on public.pipeline_runs
  for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Status transitions running -> succeeded/failed/partial require update.
drop policy if exists "admin_update_pipeline_runs" on public.pipeline_runs;
create policy "admin_update_pipeline_runs" on public.pipeline_runs
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "no_delete_pipeline_runs" on public.pipeline_runs;
create policy "no_delete_pipeline_runs" on public.pipeline_runs
  for delete using (false);

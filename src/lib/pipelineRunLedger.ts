// src/lib/pipelineRunLedger.ts
// Pipeline run ledger persistence (public.pipeline_runs, 20261026 migration).
// One parent row per scraper invocation (source_id='all') plus one child row
// per source. Fail-open by design: an observability outage must never break
// or delay ingestion — every ledger error is logged and swallowed.

import { getSupabaseClient } from './supabaseServer.js';

export interface PipelineStageError {
  stage: string;
  message: string;
  source?: string;
}

export interface StartRunInput {
  trigger: 'cron' | 'admin' | 'manual' | 'edge_function';
  source_id: string;
  navarea?: string | null;
  parent_run_id?: string;
  retry_of?: string;
}

export interface FinishRunInput {
  status: 'succeeded' | 'failed' | 'partial';
  fetch_status?: number | null;
  fetch_bytes?: number | null;
  artifact_id?: string | null;
  content_hash?: string | null;
  counts?: Record<string, number>;
  stage_errors?: PipelineStageError[];
  error?: string | null;
}

/** Inserts a 'running' row and returns its run_id (null on failure). */
export async function startRun(input: StartRunInput): Promise<string | null> {
  try {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client
      .from('pipeline_runs')
      .insert({
        trigger: input.trigger,
        source_id: input.source_id,
        navarea: input.navarea ?? null,
        parent_run_id: input.parent_run_id ?? null,
        retry_of: input.retry_of ?? null,
        status: 'running',
      })
      .select('run_id')
      .single();
    if (error || !data) {
      console.warn('[pipelineRunLedger] startRun failed:', error?.message);
      return null;
    }
    return String(data.run_id);
  } catch (err: any) {
    console.warn('[pipelineRunLedger] startRun exception:', err?.message || err);
    return null;
  }
}

/** Transitions a run row to a terminal status with counts and stage errors. */
export async function finishRun(runId: string | null, result: FinishRunInput): Promise<void> {
  if (!runId) return;
  try {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client
      .from('pipeline_runs')
      .update({
        status: result.status,
        finished_at: new Date().toISOString(),
        fetch_status: result.fetch_status ?? null,
        fetch_bytes: result.fetch_bytes ?? null,
        artifact_id: result.artifact_id ?? null,
        content_hash: result.content_hash ?? null,
        counts: result.counts ?? {},
        stage_errors: result.stage_errors ?? [],
        error: result.error ?? null,
      })
      .eq('run_id', runId);
    if (error) console.warn('[pipelineRunLedger] finishRun failed:', error.message);
  } catch (err: any) {
    console.warn('[pipelineRunLedger] finishRun exception:', err?.message || err);
  }
}

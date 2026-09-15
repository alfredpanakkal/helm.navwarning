import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NavWarning, SourceRegistryItem, IngestionGeneration, RawArtifact } from '../types';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      supabaseClient = createClient(url, key, {
        auth: { persistSession: false },
      });
      return supabaseClient;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return null;
}

export async function checkSupabaseHealth(): Promise<{
  connected: boolean;
  url: string | null;
  counts: {
    warnings: number;
    sources: number;
    generations: number;
    artifacts: number;
  };
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      connected: false,
      url: process.env.SUPABASE_URL || null,
      counts: { warnings: 0, sources: 0, generations: 0, artifacts: 0 },
      error: 'Supabase URL or Key not configured in environment variables',
    };
  }

  try {
    const [warnRes, srcRes, genRes, artRes] = await Promise.all([
      client.from('nav_warnings').select('warning_id', { count: 'exact', head: true }),
      client.from('sources_registry').select('source_id', { count: 'exact', head: true }),
      client.from('ingestion_generations').select('generation_id', { count: 'exact', head: true }),
      client.from('raw_artifacts').select('artifact_id', { count: 'exact', head: true }),
    ]);

    return {
      connected: !warnRes.error,
      url: process.env.SUPABASE_URL || null,
      counts: {
        warnings: warnRes.count || 0,
        sources: srcRes.count || 0,
        generations: genRes.count || 0,
        artifacts: artRes.count || 0,
      },
      error: warnRes.error ? warnRes.error.message : undefined,
    };
  } catch (err: any) {
    return {
      connected: false,
      url: process.env.SUPABASE_URL || null,
      counts: { warnings: 0, sources: 0, generations: 0, artifacts: 0 },
      error: err.message || String(err),
    };
  }
}

export async function syncWarningsToSupabase(warnings: NavWarning[]): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || warnings.length === 0) return false;

  try {
    const payload = warnings.map((w) => ({
      warning_id: w.warning_id,
      publisher_id: w.publisher_id,
      source_id: w.source_id,
      navarea: w.navarea,
      source_warning_id: w.source_warning_id,
      issued_date: w.issued_date,
      issued_text: w.issued_text,
      status: w.status,
      status_basis: w.status_basis,
      area_text: w.area_text,
      raw_text: w.raw_text,
      spatial: w.spatial,
      source_url: w.source_url,
      extraction_method: w.extraction_method,
      generation_id: w.generation_id,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await client.from('nav_warnings').upsert(payload, { onConflict: 'warning_id' });
    if (error) {
      console.warn('Supabase warnings upsert warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase syncWarnings exception:', err);
    return false;
  }
}

export async function syncArtifactsToSupabase(artifacts: RawArtifact[]): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || artifacts.length === 0) return false;

  try {
    const payload = artifacts.map((a) => ({
      artifact_id: a.artifact_id,
      source_id: a.source_id,
      timestamp: a.timestamp,
      path: a.path,
      content_type: a.content_type,
      content_hash: a.content_hash,
      size_bytes: a.size_bytes,
      preview_text: a.preview_text,
    }));

    const { error } = await client.from('raw_artifacts').upsert(payload, { onConflict: 'artifact_id' });
    if (error) {
      console.warn('Supabase raw_artifacts upsert warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase syncArtifacts exception:', err);
    return false;
  }
}

export async function syncGenerationsToSupabase(generations: IngestionGeneration[]): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || generations.length === 0) return false;

  try {
    const payload = generations.map((g) => ({
      generation_id: g.generation_id,
      source_id: g.source_id,
      created_at: g.created_at,
      publication_kind: g.publication_kind,
      parsed_count: g.parsed_count,
      active_count: g.active_count,
      completeness_status: g.completeness_status,
      evidence_hash: g.evidence_hash,
      artifact_ref: g.artifact_ref,
    }));

    const { error } = await client.from('ingestion_generations').upsert(payload, { onConflict: 'generation_id' });
    if (error) {
      console.warn('Supabase ingestion_generations upsert warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase syncGenerations exception:', err);
    return false;
  }
}

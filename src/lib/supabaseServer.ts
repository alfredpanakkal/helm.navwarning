import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NavWarning, SourceRegistryItem, IngestionGeneration, RawArtifact } from '../types';

let supabaseClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    supabaseClient = null;
    return null;
  }

  // If client exists and config hasn't changed, reuse it
  if (supabaseClient && url === lastUsedUrl && key === lastUsedKey) {
    return supabaseClient;
  }

  try {
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false },
    });
    lastUsedUrl = url;
    lastUsedKey = key;
    return supabaseClient;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    supabaseClient = null;
    return null;
  }
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
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null,
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

    const errors: string[] = [];
    if (warnRes.error) errors.push(`nav_warnings: ${warnRes.error.message}`);
    if (srcRes.error) errors.push(`sources_registry: ${srcRes.error.message}`);
    if (genRes.error) errors.push(`ingestion_generations: ${genRes.error.message}`);
    if (artRes.error) errors.push(`raw_artifacts: ${artRes.error.message}`);

    const isConnected = errors.length === 0;

    return {
      connected: isConnected,
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null,
      counts: {
        warnings: warnRes.count || 0,
        sources: srcRes.count || 0,
        generations: genRes.count || 0,
        artifacts: artRes.count || 0,
      },
      error: isConnected ? undefined : errors.join(' | '),
    };
  } catch (err: any) {
    return {
      connected: false,
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null,
      counts: { warnings: 0, sources: 0, generations: 0, artifacts: 0 },
      error: err.message || String(err),
    };
  }
}

export async function syncWarningsToSupabase(warnings: NavWarning[]): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };
  if (warnings.length === 0) return { success: true };

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
      console.warn('Supabase warnings upsert error:', error.message);
      return { success: false, error: `nav_warnings: ${error.message}` };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase syncWarnings exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function syncArtifactsToSupabase(artifacts: RawArtifact[]): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };
  if (artifacts.length === 0) return { success: true };

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
      console.warn('Supabase raw_artifacts upsert error:', error.message);
      return { success: false, error: `raw_artifacts: ${error.message}` };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase syncArtifacts exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function syncGenerationsToSupabase(generations: IngestionGeneration[]): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };
  if (generations.length === 0) return { success: true };

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
      console.warn('Supabase ingestion_generations upsert error:', error.message);
      return { success: false, error: `ingestion_generations: ${error.message}` };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase syncGenerations exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function syncSourcesToSupabase(sources: SourceRegistryItem[]): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase client not initialized' };
  if (sources.length === 0) return { success: true };

  try {
    const payload = sources.map((s) => ({
      source_id: s.source_id,
      publisher_id: s.publisher_id,
      publisher_name: s.publisher_name,
      navareas: s.navareas,
      scope: s.scope,
      discovery_url: s.discovery_url,
      format: s.format,
      publication_semantics: s.publication_semantics,
      enabled: s.enabled,
      verification: s.verification,
      health: s.health,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await client.from('sources_registry').upsert(payload, { onConflict: 'source_id' });
    if (error) {
      console.warn('Supabase sources_registry upsert error:', error.message);
      return { success: false, error: `sources_registry: ${error.message}` };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase syncSources exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

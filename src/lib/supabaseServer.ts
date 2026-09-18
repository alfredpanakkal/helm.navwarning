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
      client.from('ingestion_generations').select('id', { count: 'exact', head: true }),
      client.from('raw_artifacts').select('id', { count: 'exact', head: true }),
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
    const payload = warnings.map((w) => {
      let lat = w.latitude != null && !isNaN(Number(w.latitude)) ? Number(w.latitude) : null;
      let lng = w.longitude != null && !isNaN(Number(w.longitude)) ? Number(w.longitude) : null;

      if (lat == null && w.spatial?.geometries?.length > 0) {
        const pt = w.spatial.geometries[0];
        if (pt.type === 'Point' && Array.isArray(pt.coordinates) && pt.coordinates.length >= 2) {
          lng = Number(pt.coordinates[0]);
          lat = Number(pt.coordinates[1]);
        }
      }

      return {
        source_id: w.source_id || 'manual-import',
        warning_id: w.source_warning_id || w.warning_number || w.warning_id,
        title: w.title || null,
        raw_text: w.raw_text || '',
        issued_date: w.issued_date || new Date().toISOString().slice(0, 10),
        navarea: w.navarea || 'IV',
        area_text: w.area_text || null,
        sub_area: w.sub_area || null,
        authority: w.authority || null,
        source_url: w.source_url || w.web_link || null,
        risk_level: w.risk_level || null,
        extraction_method: w.extraction_method || 'deterministic',
        generation_id: w.generation_id || null,
        issued_text: w.issued_text || w.issued_date || null,
        latitude: lat,
        longitude: lng,
        valid_until: w.valid_until || w.valid_to || null,
        validity: w.validity || null,
        charts: w.charts || null,
        categories: w.categories || null,
        web_link: w.web_link || w.source_url || null,
        spatial: w.spatial?.geometries?.length ? { geometries: w.spatial.geometries } : null,
        spatial_groups: (w as any).spatial_groups || (w.spatial as any)?.spatial_groups || null,
        evidence_trail: (w as any).evidence_trail || (w.spatial as any)?.evidence_trail || null,
        valid_until_utc: (w as any).valid_until_utc || w.valid_to || null,
        is_cancelled: (w as any).is_cancelled ?? (w.status === 'cancelled'),
        cancellation_text: (w as any).cancellation_text || null,
      };
    });

    // Also persist raw messages
    const rawRows = warnings
      .filter(w => Boolean(w.raw_text))
      .map(w => ({
        warning_id: w.source_warning_id || w.warning_number || w.warning_id,
        source_id: w.source_id || 'manual-import',
        full_raw_text: w.raw_text,
        subject_header: w.title || `${w.series || 'WARNING'} ${w.warning_number || ''}`,
      }));

    if (rawRows.length > 0) {
      try {
        await client.from('raw_messages').insert(rawRows);
      } catch (err) {
        console.warn('raw_messages insert notice:', err);
      }
    }

    // Chunk in batches of 100
    const CHUNK_SIZE = 100;
    for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
      const chunk = payload.slice(i, i + CHUNK_SIZE);
      let { error } = await client.from('nav_warnings').upsert(chunk, { onConflict: 'source_id,warning_id' });
      if (error && error.message.includes('conflict')) {
        const fallback = await client.from('nav_warnings').upsert(chunk, { onConflict: 'warning_id' });
        error = fallback.error;
      }

      if (error) {
        console.warn('Supabase warnings upsert error:', error.message);
        return { success: false, error: `nav_warnings: ${error.message}` };
      }
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
    const payload = artifacts.map((a) => {
      const navarea =
        (a as any).navarea ||
        (a.source_id?.includes('navarea-') ? a.source_id.split('-')[1]?.toUpperCase() : 'GLOBAL') ||
        'GLOBAL';
      return {
        id: a.artifact_id || (a as any).id,
        artifact_id: a.artifact_id,
        source_id: a.source_id,
        navarea,
        fetched_at: a.timestamp || new Date().toISOString(),
        path: a.path,
        content_type: a.content_type || 'text/plain',
        content_hash: a.content_hash || '',
        raw_text: a.preview_text || a.full_content || (a as any).raw_text || '',
        http_status: (a as any).http_status ?? 200,
        evidence_hash: (a as any).evidence_hash || a.content_hash || '',
        artifact_ref: (a as any).artifact_ref || a.path || '',
      };
    });

    const { error } = await client.from('raw_artifacts').upsert(payload, { onConflict: 'id' });
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
    const payload = generations.map((g) => {
      const navarea =
        (g as any).navarea ||
        (g.source_id?.includes('navarea-') ? g.source_id.split('-')[1]?.toUpperCase() : 'GLOBAL') ||
        'GLOBAL';
      return {
        id: g.generation_id || (g as any).id,
        navarea,
        timestamp: g.created_at || new Date().toISOString(),
        created_at: g.created_at || new Date().toISOString(),
        total_warnings_found: g.parsed_count ?? (g as any).total_warnings_found ?? 0,
        active_count: g.active_count ?? 0,
        status: g.completeness_status || 'COMPLETE',
        completeness_status: g.completeness_status || 'verified',
        evidence_hash: g.evidence_hash || '',
        artifact_ref: g.artifact_ref || '',
      };
    });

    const { error } = await client.from('ingestion_generations').upsert(payload, { onConflict: 'id' });
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

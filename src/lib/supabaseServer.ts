import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NavWarning, SourceRegistryItem, IngestionGeneration, RawArtifact } from '../types';

let supabaseClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export function getNavareaSchemaName(navarea: string): string {
  const clean = (navarea || '').trim().toUpperCase();
  if (clean === 'BALTIC') return 'navarea_baltic';
  const romanMap: Record<string, string> = {
    'I': 'navarea_1', 'II': 'navarea_2', 'III': 'navarea_3', 'IV': 'navarea_4',
    'V': 'navarea_5', 'VI': 'navarea_6', 'VII': 'navarea_7', 'VIII': 'navarea_8',
    'IX': 'navarea_9', 'X': 'navarea_10', 'XI': 'navarea_11', 'XII': 'navarea_12',
    'XIII': 'navarea_13', 'XIV': 'navarea_14', 'XV': 'navarea_15', 'XVI': 'navarea_16',
    'XVII': 'navarea_17', 'XVIII': 'navarea_18', 'XIX': 'navarea_19', 'XX': 'navarea_20',
    'XXI': 'navarea_21'
  };
  return romanMap[clean] || `navarea_${clean.toLowerCase()}`;
}

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

    // If the primary nav_warnings table is accessible, the database connection is fundamentally operational
    const isConnected = !warnRes.error;

    return {
      connected: isConnected,
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null,
      counts: {
        warnings: warnRes.count || 0,
        sources: srcRes.count || 0,
        generations: genRes.count || 0,
        artifacts: artRes.count || 0,
      },
      error: errors.length > 0 ? errors.join(' | ') : undefined,
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

      const issuedDateStr = w.issued_date || (w.issued_at ? w.issued_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
      const year = w.warning_year || (issuedDateStr ? parseInt(issuedDateStr.slice(0, 4), 10) : new Date().getFullYear());

      return {
        source_id: w.source_id || 'manual-import',
        warning_id: w.source_warning_id || w.warning_number || w.warning_id,
        publisher_id: w.publisher_id || null,
        series: w.series || `NAVAREA ${w.navarea || 'IV'}`,
        warning_number: w.warning_number || null,
        warning_year: year,
        title: w.title || null,
        raw_text: w.raw_text || '',
        issued_date: issuedDateStr,
        issued_text: w.issued_text || w.issued_date || null,
        issued_at: w.issued_at || null,
        valid_from: w.valid_from || null,
        valid_to: w.valid_to || null,
        valid_until_utc: (w as any).valid_until_utc || w.valid_to || null,
        navarea: w.navarea || 'IV',
        area_text: w.area_text || null,
        sub_area: w.sub_area || null,
        authority: w.authority || null,
        source_url: w.source_url || w.web_link || null,
        risk_level: w.risk_level || w.ai_triage?.risk_level || 'high',
        urgency_score: w.urgency_score || null,
        extraction_method: w.extraction_method || 'deterministic',
        generation_id: w.generation_id || null,
        latitude: lat,
        longitude: lng,
        valid_until: w.valid_until || w.valid_to || null,
        validity: w.validity || null,
        charts: w.charts || null,
        categories: w.categories || null,
        category: (w as any).category || w.categories || null,
        hazard_category: w.hazard_category || w.ai_triage?.hazard_category || null,
        web_link: w.web_link || w.source_url || null,
        spatial: w.spatial?.geometries?.length ? { geometries: w.spatial.geometries } : null,
        spatial_groups: (w as any).spatial_groups || (w.spatial as any)?.spatial_groups || null,
        evidence_trail: (w as any).evidence_trail || (w.spatial as any)?.evidence_trail || null,
        is_cancelled: (w as any).is_cancelled ?? (w.status === 'cancelled'),
        cancellation_text: (w as any).cancellation_text || null,
        is_verified: (w as any).is_verified ?? false,
        verified_at: (w as any).verified_at || null,
        updated_at: new Date().toISOString(),
      };
    });

    // Also persist raw messages with SHA-256 hash
    const rawRows = warnings
      .filter((w) => Boolean(w.raw_text))
      .map((w) => {
        let checksum: string | null = null;
        try {
          // Dynamic crypto import/require
          const crypto = require('crypto');
          checksum = crypto.createHash('sha256').update(w.raw_text).digest('hex');
        } catch {
          checksum = null;
        }

        return {
          warning_id: w.source_warning_id || w.warning_number || w.warning_id,
          source_id: w.source_id || 'manual-import',
          full_raw_text: w.raw_text,
          subject_header: w.title || `${w.series || 'WARNING'} ${w.warning_number || ''}`,
          checksum_sha256: checksum,
        };
      });

    if (rawRows.length > 0) {
      try {
        await client.from('raw_messages').insert(rawRows);
      } catch (err) {
        console.warn('raw_messages insert notice:', err);
      }
    }

    // Chunk in batches of 100 for public.nav_warnings
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

    // Attempt NAVAREA-segregated schema routing for isolated storage
    try {
      const areaGroups = new Map<string, typeof payload>();
      for (const row of payload) {
        const schema = getNavareaSchemaName(row.navarea);
        if (!areaGroups.has(schema)) areaGroups.set(schema, []);
        areaGroups.get(schema)!.push(row);
      }

      for (const [schemaName, schemaRows] of areaGroups.entries()) {
        try {
          await client.schema(schemaName).from('nav_warnings').upsert(schemaRows, { onConflict: 'source_id,warning_id' });
        } catch {
          // Non-blocking: will populate when individual NAVAREA schema migration is executed
        }
      }
    } catch {
      // Non-blocking error handling for custom schemas
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

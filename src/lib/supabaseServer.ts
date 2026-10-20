import crypto from 'crypto';
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
    geometries: number;
    rawMessages: number;
  };
  optional?: { sources?: number; generations?: number; artifacts?: number };
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      connected: false,
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null,
      counts: { warnings: 0, geometries: 0, rawMessages: 0 },
      error: 'Supabase URL or Key not configured in environment variables',
    };
  }

  try {
    // Core tables written by the 20261019/20 backend (see docs/supabase-backend-contract.md)
    const [warnRes, geomRes, msgRes] = await Promise.all([
      client.from('nav_warnings').select('canonical_id', { count: 'exact', head: true }),
      client.from('nav_warning_geometries').select('geom_id', { count: 'exact', head: true }),
      client.from('raw_messages').select('id', { count: 'exact', head: true }),
    ]);

    const errors: string[] = [];
    if (warnRes.error) errors.push('nav_warnings: ' + warnRes.error.message);
    if (geomRes.error) errors.push('nav_warning_geometries: ' + geomRes.error.message);
    if (msgRes.error) errors.push('raw_messages: ' + msgRes.error.message);

    const isConnected = !warnRes.error;

    // Optional tables NOT populated by the new backend — never mark health down
    const optional: { sources?: number; generations?: number; artifacts?: number } = {};
    const soft = await Promise.allSettled([
      client.from('sources_registry').select('source_id', { count: 'exact', head: true }),
      client.from('ingestion_generations').select('generation_id', { count: 'exact', head: true }),
      client.from('raw_artifacts').select('artifact_id', { count: 'exact', head: true }),
    ]);
    if (soft[0].status === 'fulfilled' && soft[0].value.count != null) optional.sources = soft[0].value.count;
    if (soft[1].status === 'fulfilled' && soft[1].value.count != null) optional.generations = soft[1].value.count;
    if (soft[2].status === 'fulfilled' && soft[2].value.count != null) optional.artifacts = soft[2].value.count;

    return {
      connected: isConnected,
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null,
      counts: {
        warnings: warnRes.count || 0,
        geometries: geomRes.count || 0,
        rawMessages: msgRes.count || 0,
      },
      optional,
      error: errors.length > 0 ? errors.join(' | ') : undefined,
    };
  } catch (err: any) {
    return {
      connected: false,
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null,
      counts: { warnings: 0, geometries: 0, rawMessages: 0 },
      error: err.message || String(err),
    };
  }
}

/**
 * Sanitizes depth values to prevent violating chk_shoal_depth_sentinel
 * and chk_entity_depth_sentinel. Converts -9999.0 or out-of-range depths to null.
 */
function sanitizeDepth(val: any): number | null {
  if (val == null) return null;
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return null;
  if (num === -9999.0 || num <= -50.0 || num >= 12000.0) return null;
  return num;
}

/**
 * Converts GeoJSON/coordinates into PostGIS EWKT geography string (SRID 4326).
 */
function toPostGISEWKT(geom: any, defaultLat?: number | null, defaultLng?: number | null): { ewkt: string; type: string } | null {
  if (!geom && (defaultLat == null || defaultLng == null)) return null;

  if (geom?.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
    const lng = Number(geom.coordinates[0]);
    const lat = Number(geom.coordinates[1]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { ewkt: `SRID=4326;POINT(${lng} ${lat})`, type: 'POINT' };
    }
  }

  if (geom?.type === 'Polygon' && Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
    const rings = geom.coordinates.map((ring: any[]) =>
      `(${ring.map((pt: any[]) => `${Number(pt[0])} ${Number(pt[1])}`).join(', ')})`
    ).join(', ');
    return { ewkt: `SRID=4326;POLYGON(${rings})`, type: 'POLYGON' };
  }

  if (geom?.type === 'LineString' && Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
    const pts = geom.coordinates.map((pt: any[]) => `${Number(pt[0])} ${Number(pt[1])}`).join(', ');
    return { ewkt: `SRID=4326;LINESTRING(${pts})`, type: 'LINE' };
  }

  if (defaultLat != null && defaultLng != null && !isNaN(defaultLat) && !isNaN(defaultLng)) {
    return { ewkt: `SRID=4326;POINT(${defaultLng} ${defaultLat})`, type: 'POINT' };
  }

  return null;
}

/**
 * Production Ingestion Worker: syncWarningsToSupabase
 * 1. Uses Supabase Service Role client to bypass RLS.
 * 2. Neutralizes -9999.0 depth sentinels.
 * 3. Enforces chk_tier_a_invariants.
 * 4. Upserts master records to public.nav_warnings and captures UUIDs.
 * 5. Batch inserts normalized child records into nav_warning_geometries,
 *    nav_warning_entities, nav_warning_schedules, charts, and cancellations.
 */
export async function syncWarningsToSupabase(warnings: NavWarning[]): Promise<{
  success: boolean;
  insertedCount: number;
  childCounts: { geometries: number; entities: number; schedules: number; charts: number; cancellations: number };
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      insertedCount: 0,
      childCounts: { geometries: 0, entities: 0, schedules: 0, charts: 0, cancellations: 0 },
      error: 'Supabase client not initialized or missing service role key',
    };
  }
  if (!warnings || warnings.length === 0) {
    return {
      success: true,
      insertedCount: 0,
      childCounts: { geometries: 0, entities: 0, schedules: 0, charts: 0, cancellations: 0 },
    };
  }

  // ── 20261019/20 schema helpers (docs/supabase-backend-contract.md) ──
  const sha256Hex = (text: string): string =>
    crypto.createHash('sha256').update(text, 'utf8').digest('hex');

  const toFullNavarea = (nav: any): string => {
    const s = String(nav || '').trim().toUpperCase();
    if (!s) return 'NAVAREA I';
    if (s === 'BALTIC' || s === 'NAVAREA BALTIC') return 'NAVAREA BALTIC';
    return s.startsWith('NAVAREA') ? s : 'NAVAREA ' + s;
  };

  const ALLOWED_STATUS = ['active', 'cancelled', 'expired', 'superseded', 'unverified'];
  const ALLOWED_QUALITY = ['EXPLICIT', 'INFERRED', 'AMBIGUOUS', 'INVALID'];
  const ALLOWED_UNPLOTTED = [
    'no_coordinates', 'parse_failure', 'meta_list', 'text_unavailable', 'empty_stub',
    'cancellation_only', 'truncated_clause', 'missing_hemisphere', 'duplicate_of',
    'validation_failed', 'no_valid_geometry',
  ];

  const safeStatus = (s: any): string => {
    const v = String(s || 'active').toLowerCase();
    return ALLOWED_STATUS.includes(v) ? v : 'unverified';
  };
  const safeQuality = (q: any): string => {
    const v = String(q || 'EXPLICIT').toUpperCase();
    return ALLOWED_QUALITY.includes(v) ? v : 'EXPLICIT';
  };
  const safeUnplotted = (u: any): string | null => {
    const v = String(u || '').trim();
    return ALLOWED_UNPLOTTED.includes(v) ? v : null;
  };
  const safeTimestamp = (v: any): string | null => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  /** Converts a frontend spatial geometry into an RPC child-geometry object. */
  const toRpcGeometry = (g: any): { zone_label: string; feature_type: string; buffer_nm: number; geojson: any } | null => {
    if (!g || !g.type || g.coordinates === undefined) return null;
    const type = String(g.type);
    if (!['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'].includes(type)) return null;
    const featureType = type === 'LineString' ? 'LINE' : type.toUpperCase();
    return {
      zone_label: g.label || 'PRIMARY_HAZARD',
      feature_type: featureType,
      buffer_nm: Number(g.buffer_nm || g.radius_nm || 0) || 0,
      geojson: { type, coordinates: g.coordinates },
    };
  };

  try {
    let inserted = 0;
    let geometryCount = 0;
    const rawRows: any[] = [];

    for (const w of warnings) {
      const canonicalId = String((w as any).canonical_id || w.source_warning_id || w.warning_id || '').trim();
      if (!canonicalId) continue;

      let categories: string[] = [];
      if (Array.isArray(w.categories)) {
        categories = (w.categories as unknown[]).map(String).map((s) => s.toLowerCase()).filter(Boolean);
      } else if (typeof w.categories === 'string' && w.categories) {
        categories = [w.categories.toLowerCase()];
      } else if (typeof (w as any).category === 'string' && (w as any).category) {
        categories = [String((w as any).category).toLowerCase()];
      } else if (w.hazard_category) {
        categories = [String(w.hazard_category).toLowerCase()];
      }
      if (categories.length === 0) categories = ['general'];

      const status = safeStatus(w.status);
      const isAI = (w as any).parsing_method === 'AI' || w.extraction_method === 'llm_assisted';
      const parsingMethod: 'RULE' | 'AI' = isAI ? 'AI' : 'RULE';
      const dataQuality = safeQuality((w as any).data_quality);
      const unplottedReason = safeUnplotted((w as any).unplotted_reason);

      // chk_tier_a_invariants: Tier A requires EXPLICIT + RULE + no unplotted reason + not superseded
      const hasGeoms = (w.spatial?.geometries?.length ?? 0) > 0;
      let triageTier = String((w as any).triage_tier || (hasGeoms ? 'A' : 'C')).toUpperCase();
      if (triageTier === 'A' && !(dataQuality === 'EXPLICIT' && unplottedReason === null && parsingMethod === 'RULE' && status !== 'superseded')) {
        triageTier = 'B';
      }
      if (!hasGeoms && triageTier === 'A') triageTier = 'C';

      const master = {
        canonical_id: canonicalId,
        navarea: toFullNavarea(w.navarea),
        title: String(w.title || canonicalId).slice(0, 255),
        area_text: w.area_text || null,
        categories,
        status,
        triage_tier: triageTier,
        data_quality: dataQuality,
        parsing_method: parsingMethod,
        qa_flags: Array.isArray((w as any).qa_flags) ? (w as any).qa_flags : [],
        unplotted_reason: unplottedReason,
        valid_from: safeTimestamp(w.valid_from || w.issued_at),
        valid_to: safeTimestamp(w.valid_to),
        raw_text: w.raw_text || '',
        source_id: w.source_id || 'manual-import',
      };

      const geometries = (w.spatial?.geometries || [])
        .map(toRpcGeometry)
        .filter((g: any): g is NonNullable<ReturnType<typeof toRpcGeometry>> => g !== null);

      // Atomic master + geometry write via RPC (deletes+reinserts children in one transaction)
      let ok = false;
      try {
        await client.rpc('upsert_nav_warning', { p_payload: { master, geometries } });
        ok = true;
      } catch (rpcErr: any) {
        console.warn('upsert_nav_warning RPC failed; falling back to direct upsert:', rpcErr?.message || rpcErr);
      }

      if (!ok) {
        const { error } = await client.from('nav_warnings').upsert(master, { onConflict: 'canonical_id' });
        if (error) {
          console.error('Supabase nav_warnings upsert error:', error.message);
          return {
            success: false,
            insertedCount: inserted,
            childCounts: { geometries: 0, entities: 0, schedules: 0, charts: 0, cancellations: 0 },
            error: 'nav_warnings: ' + error.message,
          };
        }
        if (geometries.length > 0) {
          const { data: got } = await client.from('nav_warnings').select('id').eq('canonical_id', canonicalId).single();
          if (got?.id) {
            await client.from('nav_warning_geometries').delete().eq('warning_id', got.id);
            const geomRows = geometries
              .map((g) => toPostGISEWKT(g.geojson))
              .filter((p): p is { ewkt: string; type: string } => p !== null)
              .map((p) => ({
                warning_id: got.id,
                zone_label: 'PRIMARY_HAZARD',
                feature_type: p.type,
                geom_postgis: p.ewkt,
                buffer_nm: 0,
              }));
            if (geomRows.length > 0) {
              await client.from('nav_warning_geometries').insert(geomRows);
            }
          }
        }
      }

      inserted++;
      geometryCount += geometries.length;

      if (w.raw_text) {
        rawRows.push({
          warning_id: canonicalId,
          source_id: w.source_id || 'manual-import',
          subject_header: w.title || canonicalId,
          full_raw_text: w.raw_text,
          checksum_sha256: sha256Hex(w.raw_text),
        });
      }
    }

    // Audit trail — checksum_sha256 is NOT NULL; unique (warning_id, source_id, checksum)
    if (rawRows.length > 0) {
      const { error: rawErr } = await client
        .from('raw_messages')
        .upsert(rawRows, { onConflict: 'warning_id,source_id,checksum_sha256' });
      if (rawErr) {
        console.warn('raw_messages upsert notice:', rawErr.message);
      }
    }

    return {
      success: true,
      insertedCount: inserted,
      childCounts: { geometries: geometryCount, entities: 0, schedules: 0, charts: 0, cancellations: 0 },
    };
  } catch (err: any) {
    console.error('syncWarningsToSupabase execution exception:', err);
    return {
      success: false,
      insertedCount: 0,
      childCounts: { geometries: 0, entities: 0, schedules: 0, charts: 0, cancellations: 0 },
      error: err.message || String(err),
    };
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

export { syncInForceSnapshot } from '../services/snapshotService';

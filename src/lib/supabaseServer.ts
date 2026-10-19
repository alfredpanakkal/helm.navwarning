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

  try {
    // ─── 1. PREPARE MASTER ENVELOPES ───
    const masterRows = warnings.map((w) => {
      let lat = w.latitude != null && !isNaN(Number(w.latitude)) ? Number(w.latitude) : null;
      let lng = w.longitude != null && !isNaN(Number(w.longitude)) ? Number(w.longitude) : null;

      if (lat == null && w.spatial?.geometries?.length > 0) {
        const pt = w.spatial.geometries[0];
        if (pt.type === 'Point' && Array.isArray(pt.coordinates) && pt.coordinates.length >= 2) {
          lng = Number(pt.coordinates[0]);
          lat = Number(pt.coordinates[1]);
        }
      }

      const canonicalId = (w as any).canonical_id || w.source_warning_id || w.warning_number || w.warning_id;
      const rawText = w.raw_text || '';
      const issuedDateStr = w.issued_date || (w.issued_at ? w.issued_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
      const year = w.warning_year || parseInt(issuedDateStr.slice(0, 4), 10) || new Date().getFullYear();

      // Normalize Categories array (Fix 1)
      let categories: string[] = [];
      if (Array.isArray(w.categories)) {
        categories = w.categories.map(String);
      } else if (typeof w.categories === 'string') {
        categories = [w.categories];
      } else if (typeof (w as any).category === 'string') {
        categories = [(w as any).category];
      } else if (w.hazard_category) {
        categories = [w.hazard_category];
      }

      // Check depth sentinel for master table (Fix 3: shoal_depth_m != -9999.0)
      const shoalDepth = sanitizeDepth((w as any).shoal_depth_m);
      const isDepthUnknown = (w as any).is_depth_unknown ?? ((w as any).shoal_depth_m === -9999.0);

      // Determine parsing method & data quality (Fix 2: 'RULE' | 'AI')
      const isAI = (w as any).parsing_method === 'AI' || (w.extraction_method as string) === 'llm' || w.extraction_method === 'llm_assisted';
      const parsingMethod: 'RULE' | 'AI' = isAI ? 'AI' : 'RULE';
      let dataQuality = (w as any).data_quality || 'EXPLICIT';
      let unplottedReason = (w as any).unplotted_reason || null;
      let status = w.status || 'active';

      // Enforce chk_tier_a_invariants guardrail:
      // Tier A must strictly have EXPLICIT quality, no unplotted reason, and RULE parsing
      let triageTier = (w as any).triage_tier || ((w as any).risk_level === 'critical' || w.status === 'active' ? 'A' : 'B');
      if (triageTier === 'A') {
        const isValidTierA = dataQuality === 'EXPLICIT' && unplottedReason === null && parsingMethod === 'RULE' && (status as string) !== 'superseded';
        if (!isValidTierA) {
          triageTier = 'B'; // Automatically safeguard to Tier B review queue
        }
      }

      return {
        canonical_id: canonicalId,
        source_id: w.source_id || 'manual-import',
        warning_id: w.source_warning_id || w.warning_number || w.warning_id,
        publisher_id: w.publisher_id || null,
        series: w.series || `NAVAREA ${w.navarea || 'IV'}`,
        warning_number: w.warning_number || canonicalId,
        warning_year: year,
        title: w.title || null,
        raw_text: rawText,
        issued_date: issuedDateStr,
        issued_text: w.issued_text || issuedDateStr,
        issued_at: w.issued_at || new Date().toISOString(),
        valid_from: w.valid_from || null,
        valid_to: w.valid_to || w.valid_until || null,
        valid_until_utc: (w as any).valid_until_utc || w.valid_to || null,
        navarea: w.navarea || 'IV',
        area_text: w.area_text || null,
        sub_area: w.sub_area || null,
        authority: w.authority || null,
        source_url: w.source_url || w.web_link || null,
        risk_level: w.risk_level || w.ai_triage?.risk_level || 'high',
        urgency_score: w.urgency_score || null,
        status: status,
        triage_tier: triageTier,
        data_quality: dataQuality,
        parsing_method: parsingMethod,
        unplotted_reason: unplottedReason,
        categories: categories,
        hazard_category: w.hazard_category || w.ai_triage?.hazard_category || (categories[0] || null),
        shoal_depth_m: shoalDepth,
        is_depth_unknown: isDepthUnknown,
        space_launch_mission: (w as any).space_launch_mission || null,
        altitude_ceiling_fl: (w as any).altitude_ceiling_fl != null ? Number((w as any).altitude_ceiling_fl) : null,
        radio_frequencies: Array.isArray((w as any).radio_frequencies) ? (w as any).radio_frequencies : [],
        radio_communications: (w as any).radio_communications || [],
        cancels_ids: Array.isArray((w as any).cancels_ids) ? (w as any).cancels_ids : (w.cancels ? [w.cancels].flat() : []),
        qa_flags: Array.isArray((w as any).qa_flags) ? (w as any).qa_flags : [],
        latitude: lat,
        longitude: lng,
        spatial: w.spatial?.geometries?.length ? { geometries: w.spatial.geometries } : null,
        spatial_groups: (w as any).spatial_groups || (w.spatial as any)?.spatial_groups || null,
        evidence_trail: (w as any).evidence_trail || (w.spatial as any)?.evidence_trail || null,
        is_cancelled: (w as any).is_cancelled ?? (status === 'cancelled'),
        cancellation_text: (w as any).cancellation_text || null,
        is_verified: (w as any).is_verified ?? false,
        verified_at: (w as any).verified_at || null,
        updated_at: new Date().toISOString(),
      };
    });

    // ─── 2. UPSERT MASTER ENVELOPES & CAPTURE RETURNED UUIDS ───
    const CHUNK_SIZE = 50;
    const insertedMasterMap = new Map<string, string>(); // canonical_id or warning_id -> UUID

    for (let i = 0; i < masterRows.length; i += CHUNK_SIZE) {
      const chunk = masterRows.slice(i, i + CHUNK_SIZE);
      let { data, error } = await client
        .from('nav_warnings')
        .upsert(chunk, { onConflict: 'canonical_id' })
        .select('id, canonical_id, warning_id');

      // Fallback on legacy composite conflict if table lacks standalone canonical_id constraint
      if (error && (error.message.includes('canonical_id') || error.message.includes('conflict'))) {
        const fallback = await client
          .from('nav_warnings')
          .upsert(chunk, { onConflict: 'source_id,warning_id' })
          .select('id, canonical_id, warning_id');
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error('Supabase master nav_warnings upsert error:', error.message);
        return {
          success: false,
          insertedCount: insertedMasterMap.size,
          childCounts: { geometries: 0, entities: 0, schedules: 0, charts: 0, cancellations: 0 },
          error: `nav_warnings: ${error.message}`,
        };
      }

      if (data) {
        for (const row of data) {
          if (row.canonical_id) insertedMasterMap.set(row.canonical_id, row.id);
          if (row.warning_id) insertedMasterMap.set(row.warning_id, row.id);
        }
      }
    }

    // ─── 3. PREPARE CHILD TABLE ROWS ───
    const geometryRows: any[] = [];
    const entityRows: any[] = [];
    const scheduleRows: any[] = [];
    const chartRows: any[] = [];
    const cancellationRows: any[] = [];

    for (const w of warnings) {
      const canonicalId = (w as any).canonical_id || w.source_warning_id || w.warning_number || w.warning_id;
      const warnId = w.source_warning_id || w.warning_number || w.warning_id;
      const masterId = insertedMasterMap.get(canonicalId) || insertedMasterMap.get(warnId);
      if (!masterId) continue;

      // Geometries (nav_warning_geometries)
      const rawGeom = w.spatial?.geometries?.[0];
      const parsedGeom = toPostGISEWKT(rawGeom, w.latitude, w.longitude);
      if (parsedGeom) {
        geometryRows.push({
          warning_id: masterId,
          zone_label: rawGeom?.label || (w as any).zone_label || 'PRIMARY_HAZARD',
          feature_type: (w as any).feature_type || parsedGeom.type,
          geom_postgis: parsedGeom.ewkt,
          buffer_nm: (w as any).buffer_nm != null ? Number((w as any).buffer_nm) : ((w as any).clearanceNm || 0.0),
          corridor_half_width_nm: (w as any).corridor_half_width_nm != null ? Number((w as any).corridor_half_width_nm) : null,
          altitude_floor_m: (w as any).altitude_floor_m != null ? Number((w as any).altitude_floor_m) : 0.0,
          altitude_ceiling_fl: (w as any).altitude_ceiling_fl != null ? Number((w as any).altitude_ceiling_fl) : null,
        });
      }

      // Entities (nav_warning_entities: vessels, rigs, buoys, wrecks)
      const rawEntities = Array.isArray((w as any).entities) ? (w as any).entities : [];
      if (rawEntities.length > 0) {
        for (const ent of rawEntities) {
          entityRows.push({
            warning_id: masterId,
            entity_type: ent.entity_type || 'VESSEL',
            entity_name: ent.entity_name || 'UNKNOWN',
            role: ent.role || 'PRIMARY',
            callsign: ent.callsign || null,
            mmsi: ent.mmsi || null,
            tow_length_m: ent.tow_length_m != null ? Number(ent.tow_length_m) : null,
            tow_speed_kts: ent.tow_speed_kts != null ? Number(ent.tow_speed_kts) : null,
            streamer_count: ent.streamer_count != null ? Number(ent.streamer_count) : null,
            streamer_length_m: ent.streamer_length_m != null ? Number(ent.streamer_length_m) : null,
            streamer_breadth_m: ent.streamer_breadth_m != null ? Number(ent.streamer_breadth_m) : null,
            clearance_requested_nm: ent.clearance_requested_nm != null ? Number(ent.clearance_requested_nm) : null,
            depth_m: sanitizeDepth(ent.depth_m),
            depth_status: ent.depth_status || null,
            radio_channels: ent.radio_channels || [],
          });
        }
      } else if (w.hazard_category === 'rig' || (w as any).categories?.includes('rig')) {
        // Derive platform entity row if rig detected
        entityRows.push({
          warning_id: masterId,
          entity_type: 'OFFSHORE_RIG',
          entity_name: w.title || canonicalId,
          role: 'PRIMARY',
          clearance_requested_nm: (w as any).clearanceNm || 0.5,
          depth_m: sanitizeDepth((w as any).shoal_depth_m),
          radio_channels: [],
        });
      }

      // Operational Schedules (nav_warning_schedules)
      const rawSchedules = Array.isArray((w as any).schedules) ? (w as any).schedules : [];
      for (const sch of rawSchedules) {
        if (sch.window_start && sch.window_end) {
          scheduleRows.push({
            warning_id: masterId,
            window_start: sch.window_start,
            window_end: sch.window_end,
            is_alternate: sch.is_alternate ?? false,
            recurrence_rule: sch.recurrence_rule || null,
            days_of_week: Array.isArray(sch.days_of_week) ? sch.days_of_week : null,
          });
        }
      }

      // Charts (nav_warning_charts)
      const rawCharts = Array.isArray((w as any).charts) ? (w as any).charts : (w.charts ? [w.charts].flat() : []);
      for (const chart of rawCharts) {
        if (!chart) continue;
        const chartNum = typeof chart === 'object' ? (chart.chart_number || chart.number) : String(chart);
        if (chartNum) {
          chartRows.push({
            warning_id: masterId,
            authority: typeof chart === 'object' ? (chart.authority || 'BA') : 'BA',
            chart_number: chartNum,
            int_equivalent: typeof chart === 'object' ? chart.int_equivalent : null,
            is_international: typeof chart === 'object' ? (chart.is_international ?? false) : false,
          });
        }
      }

      // Cancellations (nav_warning_cancellations)
      const rawCancels = Array.isArray((w as any).cancels_ids) ? (w as any).cancels_ids : (w.cancels ? [w.cancels].flat() : []);
      for (const targetId of rawCancels) {
        if (!targetId) continue;
        cancellationRows.push({
          cancelling_warning_id: masterId,
          target_canonical_id: String(targetId).trim(),
          cancellation_type: 'EXPLICIT_NOTICE',
        });
      }
    }

    // ─── 4. EXECUTE BATCH CHILD INSERTS ───
    await Promise.allSettled([
      geometryRows.length > 0 ? client.from('nav_warning_geometries').insert(geometryRows) : Promise.resolve(),
      entityRows.length > 0 ? client.from('nav_warning_entities').insert(entityRows) : Promise.resolve(),
      scheduleRows.length > 0 ? client.from('nav_warning_schedules').insert(scheduleRows) : Promise.resolve(),
      chartRows.length > 0 ? client.from('nav_warning_charts').insert(chartRows) : Promise.resolve(),
      cancellationRows.length > 0 ? client.from('nav_warning_cancellations').insert(cancellationRows) : Promise.resolve(),
    ]);

    return {
      success: true,
      insertedCount: insertedMasterMap.size,
      childCounts: {
        geometries: geometryRows.length,
        entities: entityRows.length,
        schedules: scheduleRows.length,
        charts: chartRows.length,
        cancellations: cancellationRows.length,
      },
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

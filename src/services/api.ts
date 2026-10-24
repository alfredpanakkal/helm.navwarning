import {
  NavWarning,
  SourceRegistryItem,
  IngestionGeneration,
  RawArtifact,
  PipelineSystemStatus,
  PipelineRunRecord,
} from '../types';

export async function fetchSources(): Promise<SourceRegistryItem[]> {
  try {
    const res = await fetch('/api/sources');
    if (!res.ok) throw new Error('Failed to fetch sources');
    return await res.json();
  } catch (err) {
    console.warn('API fetchSources error, falling back to local:', err);
    return [];
  }
}

/**
 * Normalizes backend navarea names ('NAVAREA XI', 'NAVAREA BALTIC') into the
 * short ids used by the UI dropdowns ('XI', 'Baltic').
 */
export function normalizeNavarea(name: unknown): string {
  const raw = String(name ?? '').trim();
  if (!raw) return 'I';
  const upper = raw.toUpperCase();
  if (upper === 'NAVAREA BALTIC' || upper === 'BALTIC') return 'Baltic';
  if (upper.startsWith('NAVAREA ')) return upper.slice('NAVAREA '.length);
  return upper;
}

/**
 * Derives a triage-based confidence score from the 20261019/20 backend
 * signals (triage_tier / data_quality / qa_flags) instead of the removed
 * risk_level column:
 *   Tier A + EXPLICIT + no flags + active  -> 1.0 (matches the Critical filter)
 *   Tier A with inferred data or qa_flags -> 0.9  (matches the High filter)
 *   Tier B (review queue)                 -> 0.6  (below the 0.8 verify threshold)
 *   Tier C (blocked)                      -> 0.3
 * The legacy confidence-threshold UI (>= 0.8, >= 1.0 bands) keeps working
 * and now reflects actual backend data quality.
 */
function deriveExtractionConfidence(row: any, status: string): number {
  const tier = row.triage_tier || 'C';
  const quality = row.data_quality || 'EXPLICIT';
  const flags = Array.isArray(row.qa_flags) ? row.qa_flags : [];
  if (tier === 'A') {
    if (quality === 'EXPLICIT' && flags.length === 0 && status === 'active') return 1.0;
    return 0.9;
  }
  if (tier === 'B') return 0.6;
  return 0.3;
}

/**
 * Extracts the sequential warning number and year from a canonical_id
 * ('NAVAREA XI 0451/26' -> { number: '451', year: 2026 }). Returns nulls
 * when the id has no 'NNNN/YY' tail so callers can fall back safely —
 * previously parseInt(canonicalId) yielded NaN for every backend row.
 */
function parseCanonicalIdentity(canonicalId: string): { number: string | null; year: number | null } {
  const m = /(\d{1,4})\s*\/\s*(\d{2,4})\s*$/.exec(canonicalId || '');
  if (!m) return { number: null, year: null };
  const number = String(parseInt(m[1], 10));
  let year = parseInt(m[2], 10);
  if (year < 100) year += 2000;
  return { number, year };
}

/**
 * Maps a raw Supabase nav_warnings row (20261019/20 schema) into a fully
 * typed NavWarning. Contract: docs/supabase-backend-contract.md
 * - Stable key is canonical_id; row may carry db uuid under `id`.
 * - Geometry comes from geojson_blob (active_spatial view) or a grouped
 *   `_geometries` array; flat latitude/longitude/spatial columns do NOT exist.
 * - categories is TEXT[]; there is no category/severity/risk_level.
 * - valid_to NULL means "in force until cancelled".
 */
export function mapSupabaseRowToNavWarning(
  row: any,
  fallbackStatus: string = 'active'
): NavWarning {
  const canonicalId = row.canonical_id || row.id || `warn-${Date.now()}`;
  const navarea = normalizeNavarea(row.navarea) as any;
  const rawText = row.raw_text || row.issued_text || '';
  const categories: string[] = Array.isArray(row.categories)
    ? row.categories.map((c: any) => String(c)).filter(Boolean)
    : [];
  const effectiveStatus = row.status || fallbackStatus;
  const issuedIso = row.issued_at || row.created_at || new Date().toISOString();
  const issuedDateStr = String(issuedIso).slice(0, 10);
  const identity = parseCanonicalIdentity(canonicalId);
  // Bulletin subject for the title column: the schema has no issued_text
  // column, and raw ISO timestamps must never render as the "title".
  const subjectLine = rawText.split('\n').map((l: string) => l.trim()).find((l: string) => l.length > 0) || '';
  const displaySubject = row.title
    || (row.area_text && row.area_text !== 'Unknown Navigational Area' ? row.area_text : null)
    || (subjectLine ? subjectLine.slice(0, 200) : null)
    || issuedDateStr;

  // 1) Geometry from geojson_blob (nav_warnings_active_spatial view row)
  let spatial: any = null;
  if (row.geojson_blob && typeof row.geojson_blob === 'object' && row.geojson_blob.type) {
    const isPointWithBuffer = (row.geojson_blob.type === 'Point' || row.feature_type === 'POINT') && Number(row.buffer_nm) > 0;
    spatial = {
      geometries: [
        {
          type: row.geojson_blob.type,
          coordinates: row.geojson_blob.coordinates,
          label: row.zone_label || row.title || canonicalId,
          buffer_nm: Number(row.buffer_nm) || 0,
        },
      ],
      circles: isPointWithBuffer ? [
        {
          center: row.geojson_blob.coordinates,
          radius_nm: Number(row.buffer_nm),
          label: row.zone_label || row.title || canonicalId,
        }
      ] : [],
      raw_coordinate_text: [],
      validation_status: 'passed',
    };
  }

  // 2) Geometry pre-grouped by fetchActiveSpatialRows (one warning, many geometries)
  if ((!spatial || spatial.geometries.length === 0) && Array.isArray(row._geometries) && row._geometries.length > 0) {
    const circles: any[] = [];
    row._geometries.forEach((g: any) => {
      if ((g.type === 'Point' || g.feature_type === 'POINT') && Number(g.buffer_nm) > 0) {
        circles.push({
          center: g.coordinates,
          radius_nm: Number(g.buffer_nm),
          label: g.label || row.title || canonicalId,
        });
      }
    });

    spatial = {
      geometries: row._geometries,
      circles,
      raw_coordinate_text: [],
      validation_status: 'passed',
    };
  }

  // 3) Fallback: deterministic coordinate parse from raw text (legacy safety net)
  if (!spatial || spatial.geometries.length === 0) {
    try {
      const coordsMatch = rawText.match(/(\d{1,2})[-°](\d{1,2}(?:\.\d+)?)[ '"]*([NS])\s*(\d{1,3})[-°](\d{1,2}(?:\.\d+)?)[ '"]*([EW])/i);
      if (coordsMatch) {
        let lat = parseFloat(coordsMatch[1]) + parseFloat(coordsMatch[2]) / 60;
        if (coordsMatch[3].toUpperCase() === 'S') lat = -lat;
        let lng = parseFloat(coordsMatch[4]) + parseFloat(coordsMatch[5]) / 60;
        if (coordsMatch[6].toUpperCase() === 'W') lng = -lng;
        spatial = {
          geometries: [
            { type: 'Point', coordinates: [lng, lat], label: row.title || canonicalId },
          ],
          circles: [],
          raw_coordinate_text: [coordsMatch[0]],
          // Regex-derived geometry is NOT validated PostGIS geometry; flag it
          // so the coords filter can distinguish text parses from real shapes.
          validation_status: 'parsed_from_text',
        };
      }
    } catch {
      // fallback
    }
  }

  if (!spatial) {
    spatial = { geometries: [], circles: [], raw_coordinate_text: [], validation_status: 'not_present' };
  }

  // Calculate representative anchor latitude & longitude coordinates
  let repLat: number | null = null;
  let repLng: number | null = null;
  if (spatial.circles && spatial.circles.length > 0) {
    repLng = spatial.circles[0].center[0];
    repLat = spatial.circles[0].center[1];
  } else if (spatial.geometries && spatial.geometries.length > 0) {
    for (const g of spatial.geometries) {
      if (g.type === 'Point' && Array.isArray(g.coordinates)) {
        repLng = g.coordinates[0];
        repLat = g.coordinates[1];
        break;
      } else if ((g.type === 'Polygon' || g.type === 'MultiPolygon') && Array.isArray(g.coordinates)) {
        const ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0]?.[0];
        if (Array.isArray(ring) && ring.length > 0) {
          let sLat = 0, sLng = 0, cnt = 0;
          for (const pt of ring) {
            if (Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
              sLng += pt[0];
              sLat += pt[1];
              cnt++;
            }
          }
          if (cnt > 0) {
            repLat = sLat / cnt;
            repLng = sLng / cnt;
            break;
          }
        }
      } else if ((g.type === 'LineString' || g.type === 'MultiLineString') && Array.isArray(g.coordinates)) {
        const coords = g.type === 'LineString' ? g.coordinates : g.coordinates[0];
        if (Array.isArray(coords) && coords.length > 0) {
          const mid = coords[Math.floor(coords.length / 2)];
          if (Array.isArray(mid)) {
            repLng = mid[0];
            repLat = mid[1];
            break;
          }
        }
      }
    }
  }

  return {
    schema_version: 2,
    warning_id: canonicalId,
    db_uuid: row.id ?? (typeof row.warning_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.warning_id) ? row.warning_id : null),
    publisher_id: row.publisher_id || (row.source_id ? String(row.source_id).split('-')[0] : 'unknown'),
    source_id: row.source_id || 'unknown',
    navarea,
    series: row.series || `NAVAREA ${navarea}`,
    source_warning_id: canonicalId,
    warning_number: identity.number ?? (row.warning_number != null ? String(row.warning_number) : canonicalId),
    warning_year: identity.year ?? (Number(row.warning_year) || new Date(issuedIso).getFullYear()),
    issued_at: row.issued_at || null,
    issued_date: issuedDateStr,
    issued_time_precision: 'day',
    issued_text: displaySubject,
    valid_from: row.valid_from || null,
    valid_to: row.valid_to ?? null,
    status_changed_at: row.status_changed_at || null,
    cancelled_at: effectiveStatus === 'cancelled' ? (row.status_changed_at || row.updated_at || null) : null,
    status: effectiveStatus as any,
    status_basis: row.status_basis || 'listed_in_complete_in_force_publication',
    area_text: row.area_text || 'Unknown Navigational Area',
    original_language: 'en',
    raw_text: rawText,
    translated_text: null,
    spatial,
    supersedes: [],
    cancels: Array.isArray(row.cancels_ids) ? row.cancels_ids : [],
    title: row.title || null,
    authority: row.authority || null,
    sub_area: row.sub_area || null,
    risk_level: null,
    latitude: repLat,
    longitude: repLng,
    valid_until: row.valid_to || null,
    validity: null,
    charts: null,
    categories: categories.length > 0 ? categories : ['general'],
    hazard_category: categories[0] || 'general',
    web_link: row.web_link || null,
    source_url: row.source_url || '',
    raw_artifact_ref: '',
    content_hash: '',
    parser_version: 'v2.0',
    extraction_method: row.parsing_method === 'AI' ? 'llm_assisted' : 'deterministic',
    extraction_confidence: deriveExtractionConfidence(row, effectiveStatus),
    first_seen_at: row.created_at || new Date().toISOString(),
    last_seen_at: row.updated_at || new Date().toISOString(),
    not_in_force_observed_at: null,
    generation_id: row.generation_id || 'gen-auto',
    data_quality: row.data_quality || 'EXPLICIT',
    triage_tier: row.triage_tier || 'C',
    qa_flags: Array.isArray(row.qa_flags) ? row.qa_flags : [],
    unplotted_reason: row.unplotted_reason || undefined,
    duplicate_of_id: row.duplicate_of_id || undefined,
    validation: {
      identity: 'valid',
      dates: row.valid_from || row.valid_to ? 'valid' : 'unknown',
      geometry: spatial.geometries.length ? 'valid' : 'pending',
    },
  } as NavWarning;
}

export async function fetchWarnings(params?: {
  sourceId?: string;
  navarea?: string;
  status?: string;
  triageTiers?: string[]; // default ['A','B']: blocked Tier C never reaches the public bank
}): Promise<NavWarning[]> {
  try {
    const { supabase } = await import('../lib/supabaseClient');

    if (supabase) {
      // Single source of truth for nav_warnings reads: src/services/navWarningQueries.ts
      // (new 20261019/20 schema columns, pagination, PostgREST filters).
      const { fetchNavWarningsList } = await import('./navWarningQueries');
      const allRows = await fetchNavWarningsList({
        sourceId: params?.sourceId,
        navarea: params?.navarea,
        status: params?.status,
        triageTiers: params?.triageTiers ?? ['A', 'B'],
      });

      if (allRows.length > 0) {
        // Map database row to NavWarning interface with full field fidelity
        return allRows.map((row: any) =>
          mapSupabaseRowToNavWarning(row, params?.status || 'active')
        );
      } else {
        console.warn('Supabase fetch returned no data or error, falling back to local api/memory.');
      }
    }

    // Fallback to local server API if Supabase fetch failed or returned nothing
    const query = new URLSearchParams();
    if (params?.sourceId) query.set('sourceId', params.sourceId);
    if (params?.navarea) query.set('navarea', params.navarea);
    if (params?.status) query.set('status', params.status);

    const res = await fetch(`/api/warnings?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch warnings from local API');
    return await res.json();
  } catch (err) {
    console.warn('API fetchWarnings error:', err);
    return [];
  }
}

/**
 * Archived / cancelled / expired / superseded warnings from the backend's
 * nav_warnings_archive view (20261023_lifecycle_safety migration). Powers
 * the Data Bank archive lane. Returns [] when the view is unavailable.
 */
export async function fetchArchivedWarnings(): Promise<NavWarning[]> {
  try {
    const { fetchArchivedNavWarnings } = await import('./navWarningQueries');
    const rows = await fetchArchivedNavWarnings();
    return rows.map((row: any) => mapSupabaseRowToNavWarning(row, row.status || 'cancelled'));
  } catch (err) {
    console.warn('API fetchArchivedWarnings error:', err);
    return [];
  }
}

/**
 * Maps an ingestion_generations ledger row (backend 20261023_lifecycle_safety
 * migration) onto the frontend IngestionGeneration contract. Legacy consumers
 * read created_at / parsed_count / active_count / evidence_hash /
 * completeness_status, so ledger values are normalized into those fields.
 */
function mapIngestionGenerationRow(row: Record<string, unknown>): IngestionGeneration {
  const runStatus = (row.status as IngestionGeneration['run_status']) ?? 'succeeded';
  const startedAt = (row.started_at as string) || new Date().toISOString();
  const completeness: IngestionGeneration['completeness_status'] =
    runStatus === 'succeeded' ? 'verified' : runStatus === 'failed' ? 'failed' : 'unverified';
  const details = row.details && typeof row.details === 'object'
    ? (row.details as Record<string, unknown>)
    : null;
  return {
    generation_id: String(row.generation_id ?? ''),
    source_id: String(row.source_id ?? 'unknown'),
    created_at: startedAt,
    navarea: (row.navarea as string | null) ?? null,
    started_at: startedAt,
    completed_at: (row.completed_at as string | null) ?? null,
    run_status: runStatus,
    details,
    parsed_count: Number(row.parsed_count) || 0,
    active_count: row.active_count == null ? null : Number(row.active_count),
    evidence_hash: String(row.evidence_hash ?? ''),
    completeness_status: completeness,
  };
}

/**
 * Ingestion run ledger read straight from Supabase (ingestion_generations,
 * 20261023_lifecycle_safety migration): one row per sync run with parsed /
 * active counts and pipeline status, so the Data Bank can answer "where did
 * the warnings go?". Falls back to the legacy /api/generations endpoint when
 * the table is empty or unreachable, then to an empty list.
 */
export async function fetchGenerations(): Promise<IngestionGeneration[]> {
  try {
    const { fetchIngestionGenerations } = await import('./navWarningQueries');
    const rows = await fetchIngestionGenerations();
    if (rows.length > 0) return rows.map(mapIngestionGenerationRow);
  } catch (err) {
    console.warn('Supabase ingestion_generations read failed, trying legacy /api/generations:', err);
  }
  try {
    const res = await fetch('/api/generations');
    if (!res.ok) throw new Error('Failed to fetch generations');
    return await res.json();
  } catch (err) {
    console.warn('API fetchGenerations error:', err);
    return [];
  }
}

export async function fetchArtifacts(): Promise<RawArtifact[]> {
  try {
    const res = await fetch('/api/artifacts');
    if (!res.ok) throw new Error('Failed to fetch artifacts');
    return await res.json();
  } catch (err) {
    console.warn('API fetchArtifacts error:', err);
    return [];
  }
}



export async function adminLogin(
  emailOrPasscode: string,
  password?: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const { supabase } = await import('../lib/supabaseClient');
    
    // Scenario A: Email + Password Supabase Auth login
    if (password) {
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailOrPasscode.trim(),
          password: password.trim(),
        });

        if (error || !data.session || !data.user) {
          return { success: false, error: error?.message || 'Invalid administrator credentials' };
        }

        // Verify unalterable app_metadata admin role
        const appMeta = data.user.app_metadata || {};
        const isAdmin = appMeta.role === 'admin' || appMeta.role === 'superadmin' || appMeta.is_admin === true;

        if (!isAdmin) {
          return {
            success: false,
            error: 'Access Denied (403): Account does not possess administrative privileges (app_metadata.role must be admin).',
          };
        }

        const token = data.session.access_token;
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('helm_admin_token', token);
        }
        return { success: true, token };
      }
    }

    // Scenario B: Server-side login route fallback
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        password
          ? { email: emailOrPasscode, password }
          : { email: emailOrPasscode, passcode: emailOrPasscode }
      ),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Authentication failed' };
    }

    if (data.token) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('helm_admin_token', data.token);
      }
      return { success: true, token: data.token };
    }

    return { success: false, error: 'No authentication token returned by server' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Login request failed' };
  }
}

export async function adminLogout(): Promise<void> {
  try {
    const { supabase } = await import('../lib/supabaseClient');
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('helm_admin_token') : null;
    if (token) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }).catch(() => {});
    }
  } finally {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('helm_admin_token');
      localStorage.removeItem('helm_admin_passcode');
    }
  }
}

/**
 * Retrieves authorization headers with the active Supabase admin access token.
 * Does NOT auto-acquire passkeys or bypass authentication.
 */
export async function getAdminHeaders(): Promise<Record<string, string>> {
  let token: string | null = null;

  if (typeof window !== 'undefined') {
    // 1. Check live Supabase Auth session first
    try {
      const { supabase } = await import('../lib/supabaseClient');
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          token = session.access_token;
        }
      }
    } catch {}

    // 2. Fall back to stored session token
    if (!token) {
      token = sessionStorage.getItem('helm_admin_token');
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}



export async function triggerPipelineRefresh(sourceId?: string): Promise<{
  success: boolean;
  message: string;
  run?: PipelineRunRecord;
  results?: any[];
}> {
  if (!sourceId) {
    throw new Error('A specific source/navarea must be selected to run its scraper.');
  }

  const { supabase } = await import('../lib/supabaseClient');
  if (!supabase) throw new Error('Supabase client not initialized');

  const sources = await fetchSources();
  const source = sources.find(s => s.source_id === sourceId);
  
  if (!source || !source.navareas || source.navareas.length === 0) {
     throw new Error('Source or NAVAREA mapping not found for ' + sourceId);
  }

  const navareaName = source.navareas[0].toString().toLowerCase(); // e.g. "xix"
  const functionName = `scrape-navarea-${navareaName}`;

  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      method: 'POST',
      body: { sourceId }
    });

    if (error) {
      throw new Error(`Edge Function ${functionName} failed: ` + error.message);
    }

    return {
      success: true,
      message: `Successfully triggered Supabase Edge Function: ${functionName}`,
      results: data?.results || [],
      run: {
        run_id: `run-${Date.now()}`,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        status: 'SUCCESS',
        sources_processed: 1,
        records_found: data?.inserted || 0,
        records_stored: data?.inserted || 0,
        records_updated: 0,
        records_unchanged: 0,
        records_failed: 0,
        events: [
          {
            timestamp: new Date().toLocaleTimeString(),
            stage: 'DONE',
            message: `Edge function ${functionName} completed successfully.`
          }
        ]
      }
    };
  } catch (err: any) {
    throw new Error(err.message || 'Failed to trigger ingestion pipeline Edge Function');
  }
}

export interface JhodParseResponse {
  success: boolean;
  warning?: NavWarning;
  jhodOutput?: any;
  hallucinationGuardTriggered?: boolean;
  extractionMethod?: string;
  auditNotes?: string[];
  error?: string;
}

export async function parseJhodWarning(
  rawText: string,
  navarea = 'XI',
  aiModel = 'gemini-3.1-flash-lite'
): Promise<JhodParseResponse> {
  const headers = await getAdminHeaders();
  const res = await fetch('/api/ai/parse-jhod', {
    method: 'POST',
    headers,
    body: JSON.stringify({ rawText, navarea, aiModel }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to parse JHOD telex with Gemini Structured Output');
  }
  return await res.json();
}

export interface JhodBatchParseResponse {
  success: boolean;
  total: number;
  warnings: NavWarning[];
  manifestSummary?: {
    manifestId: string;
    inForceNumbers: string[];
    cancelledByManifest: string[];
    reconciledActiveCount: number;
    newlyDeactivatedCount: number;
    deactivatedIds: string[];
  } | null;
  groundedCount: number;
  fallbackCount: number;
  error?: string;
}

export async function parseJhodBatch(
  rawText: string,
  navarea = 'XI',
  aiModel = 'gemini-3.1-flash-lite',
  autoReconcile = true
): Promise<JhodBatchParseResponse> {
  const headers = await getAdminHeaders();
  const res = await fetch('/api/pipeline/parse-jhod-batch', {
    method: 'POST',
    headers,
    body: JSON.stringify({ rawText, navarea, aiModel, autoReconcile }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to parse batch JHOD bulletins');
  }
  return await res.json();
}

export async function parseManualWarning(
  rawText: string,
  navarea?: string,
  mode: 'hybrid' | 'llm' | 'regex' | 'jhod_structured' = 'hybrid',
  aiModel: string = 'mistral-small-latest'
): Promise<{
  warning: NavWarning;
  extraction_method: 'deterministic' | 'llm_assisted' | 'gemini_structured_output' | 'deterministic_hallucination_fallback';
  ai_parsing_failed?: boolean;
  ai_error?: string | null;
  jhodOutput?: any;
}> {
  const headers = await getAdminHeaders();
  const res = await fetch('/api/pipeline/parse-manual', {
    method: 'POST',
    headers,
    body: JSON.stringify({ rawText, navarea, mode, aiModel }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to parse warning text');
  }
  return await res.json();
}


export async function fetchSupabaseStatus(): Promise<{
  connected: boolean;
  url: string | null;
  counts: { warnings: number; geometries: number; rawMessages: number; sources?: number; generations?: number; artifacts?: number };
  localCounts: { warnings: number; sources: number; generations: number; artifacts: number };
  error?: string;
  ok?: boolean;
}> {
  try {
    const headers = await getAdminHeaders();
    const res = await fetch('/api/supabase/status', { headers });
    if (!res.ok) throw new Error('Failed to fetch Supabase status');
    const data = await res.json();
    return {
      connected: Boolean(data.connected ?? data.ok),
      url: data.url || null,
      counts: data.counts || { warnings: 0, geometries: 0, rawMessages: 0 },
      localCounts: data.localCounts || { warnings: 0, sources: 0, generations: 0, artifacts: 0 },
      error: data.error,
      ok: Boolean(data.ok ?? data.connected),
    };
  } catch (err: any) {
    return {
      connected: false,
      url: null,
      counts: { warnings: 0, geometries: 0, rawMessages: 0 },
      localCounts: { warnings: 0, sources: 0, generations: 0, artifacts: 0 },
      error: err.message || String(err),
      ok: false,
    };
  }
}

export async function triggerSupabaseSync(): Promise<{
  success: boolean;
  synced: { warnings: boolean; artifacts: boolean; generations: boolean };
  counts: { warnings: number; artifacts: number; generations: number };
}> {
  const headers = await getAdminHeaders();
  const res = await fetch('/api/supabase/sync', {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to trigger Supabase sync');
  }
  return await res.json();
}

export async function testGeminiIntegration(prompt?: string): Promise<{
  success: boolean;
  hasKey: boolean;
  model?: string;
  latency_ms?: number;
  response?: string;
  prompt_used?: string;
  timestamp?: string;
  error?: string;
}> {
  const headers = await getAdminHeaders();
  const res = await fetch('/api/admin/test-gemini', {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      hasKey: data.hasKey ?? false,
      error: data.error || 'Failed to trigger Gemini API verification',
      timestamp: new Date().toISOString(),
    };
  }
  return data;
}

export async function testMistralIntegration(prompt?: string, model?: string): Promise<{
  success: boolean;
  hasKey: boolean;
  model?: string;
  latency_ms?: number;
  response?: string;
  prompt_used?: string;
  timestamp?: string;
  error?: string;
}> {
  const headers = await getAdminHeaders();
  const res = await fetch('/api/admin/test-mistral', {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, model }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      hasKey: data.hasKey ?? false,
      error: data.error || 'Failed to trigger Mistral API verification',
      timestamp: new Date().toISOString(),
    };
  }
  return data;
}

export async function saveImportedWarningsToSupabase(warnings: NavWarning[]): Promise<{
  success: boolean;
  insertedCount: number;
  error?: string;
}> {
  if (!warnings || warnings.length === 0) {
    return { success: true, insertedCount: 0 };
  }

  // 1. First attempt via server endpoint which handles service_role and memory cache
  try {
    const res = await fetch('/api/supabase/save-warnings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warnings }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return { success: true, insertedCount: data.savedCount || warnings.length };
      }
    }
  } catch {
    // If server route is unavailable, proceed to direct client SDK attempt
  }

  // 2. Direct browser-side client SDK attempt (20261019/20 schema; canonical_id keyed)
  try {
    const { supabase } = await import('../lib/supabaseClient');
    if (!supabase) {
      return { success: false, insertedCount: 0, error: 'Supabase client not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in settings.' };
    }

    const sha256Hex = async (text: string): Promise<string> => {
      const data = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    };

    const toFullNavarea = (nav: any): string => {
      const s = String(nav || 'IV').trim().toUpperCase();
      if (s === 'BALTIC' || s === 'NAVAREA BALTIC') return 'NAVAREA BALTIC';
      return s.startsWith('NAVAREA') ? s : 'NAVAREA ' + s;
    };

    const rows = warnings.map((w) => {
      const canonicalId = String((w as any).canonical_id || w.warning_id || w.source_warning_id || '').trim();

      let categories: string[] = [];
      if (Array.isArray(w.categories)) {
        categories = (w.categories as unknown[]).map(String).map((s) => s.toLowerCase()).filter(Boolean);
      } else if (typeof w.categories === 'string' && w.categories) {
        categories = [w.categories.toLowerCase()];
      } else if (w.hazard_category) {
        categories = [String(w.hazard_category).toLowerCase()];
      }
      if (categories.length === 0) categories = ['general'];

      const hasGeoms = (w.spatial?.geometries?.length ?? 0) > 0;
      const status = ['active', 'cancelled', 'expired', 'superseded', 'unverified'].includes(String(w.status || 'active').toLowerCase())
        ? String(w.status).toLowerCase()
        : 'unverified';

      return {
        canonical_id: canonicalId,
        navarea: toFullNavarea(w.navarea),
        source_id: w.source_id || 'manual-import',
        title: String(w.title || canonicalId).slice(0, 255),
        area_text: w.area_text || null,
        raw_text: w.raw_text || '',
        status,
        categories,
        triage_tier: (w as any).triage_tier || (hasGeoms ? 'A' : 'C'),
        data_quality: 'EXPLICIT',
        parsing_method: 'RULE',
        qa_flags: Array.isArray((w as any).qa_flags) ? (w as any).qa_flags : [],
        unplotted_reason: (w as any).unplotted_reason || null,
        valid_from: w.valid_from || w.issued_at || null,
        valid_to: w.valid_to || null,
      };
    });

    // Audit rows — checksum_sha256 is NOT NULL on raw_messages
    const rawRows = await Promise.all(
      warnings
        .filter((w) => Boolean(w.raw_text))
        .map(async (w) => ({
          warning_id: String((w as any).canonical_id || w.warning_id || w.source_warning_id),
          source_id: w.source_id || 'manual-import',
          full_raw_text: w.raw_text,
          subject_header: w.title || (w.series || 'WARNING') + ' ' + (w.warning_number || ''),
          checksum_sha256: await sha256Hex(w.raw_text),
        }))
    );

    if (rawRows.length > 0) {
      try {
        await supabase.from('raw_messages').upsert(rawRows, { onConflict: 'warning_id,source_id,checksum_sha256' });
      } catch (err) {
        console.warn('raw_messages insert notice:', err);
      }
    }

    const CHUNK_SIZE = 100;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from('nav_warnings').upsert(chunk, { onConflict: 'canonical_id' });
      if (error) {
        console.warn('Failed to upsert warnings to Supabase:', error.message);
        return { success: false, insertedCount: inserted, error: error.message };
      }
      inserted += chunk.length;
    }

    return { success: true, insertedCount: inserted };
  } catch (err: any) {
    console.warn('saveImportedWarningsToSupabase error:', err);
    return { success: false, insertedCount: 0, error: err.message };
  }
}

export async function parseMarkdownWithAI(
  markdown: string,
  navarea = 'AUTO',
  aiModel = 'gemini-3.1-flash-lite'
): Promise<{
  warnings: NavWarning[];
  engine: string;
  count: number;
}> {
  const res = await fetch('/api/pipeline/parse-markdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown, navarea, aiModel }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to parse markdown with AI');
  }

  return res.json();
}

export interface RejectedTriageItem {
  id: string;
  raw_snippet: string;
  decision: 'REJECTED' | 'NEEDS_REVIEW';
  confidence: number;
  understanding_summary: string;
  rejection_code: string;
  rejection_reason: string;
  warning_id?: string | null;
  navarea?: string | null;
  hazard_category?: string | null;
  timestamp: string;
}

export interface BulkIngestAiResponse {
  success: boolean;
  acceptedWarnings: NavWarning[];
  rejectedItems: RejectedTriageItem[];
  allEvaluations: any[];
  stats: {
    total: number;
    accepted: number;
    rejected: number;
    needsReview: number;
    gpsCount: number;
  };
  aiModelUsed: string;
  duration_ms: number;
  error?: string;
}

export async function bulkIngestWithAI(
  rawText: string,
  navarea = 'AUTO',
  aiModel = 'gemini-3.1-flash-lite',
  strictness = 'standard'
): Promise<BulkIngestAiResponse> {
  const res = await fetch('/api/pipeline/bulk-ingest-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText, navarea, aiModel, strictness }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to ingest bulk data with Gemini');
  }

  return res.json();
}

export async function auditBatchWithAI(
  warnings: NavWarning[],
  aiModel = 'gemini-3.1-flash-lite'
): Promise<{
  success: boolean;
  auditedWarnings: NavWarning[];
  stats: {
    total: number;
    accepted: number;
    rejected: number;
    needsReview: number;
  };
  aiModelUsed: string;
  duration_ms: number;
}> {
  const res = await fetch('/api/pipeline/bulk-audit-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ warnings, aiModel }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to audit batch with Gemini');
  }

  return res.json();
}






export interface PipelineRunLedgerRow {
  run_id: string;
  parent_run_id: string | null;
  retry_of: string | null;
  trigger: 'cron' | 'admin' | 'manual' | 'edge_function';
  source_id: string;
  navarea: string | null;
  status: 'running' | 'succeeded' | 'failed' | 'partial';
  started_at: string;
  finished_at: string | null;
  fetch_status: number | null;
  fetch_bytes: number | null;
  artifact_id: string | null;
  content_hash: string | null;
  counts: Record<string, number>;
  stage_errors: Array<{ stage: string; message: string; source?: string }>;
  error: string | null;
}

/**
 * Reads the pipeline_runs ingestion ledger (20261026 migration) via the
 * admin-guarded /api/pipeline/runs endpoint. Degrades to [] when the
 * endpoint or the ledger is unavailable so the console view stays usable.
 */
export async function fetchPipelineRuns(params?: {
  limit?: number;
  source_id?: string;
  status?: string;
}): Promise<PipelineRunLedgerRow[]> {
  try {
    const headers = await getAdminHeaders();
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.source_id) query.set('source_id', params.source_id);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    const res = await fetch('/api/pipeline/runs' + (qs ? '?' + qs : ''), { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.runs) ? data.runs : [];
  } catch (err) {
    console.warn('fetchPipelineRuns error:', err);
    return [];
  }
}

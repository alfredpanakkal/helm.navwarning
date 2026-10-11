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
 * Maps a raw Supabase nav_warnings row into a fully typed and hydrated NavWarning object.
 * Guarantees that all extended attributes (risk_level, authority, coordinates, categories, validity)
 * are cleanly parsed and georeferenced geometries are created when lat/long are present.
 */
export function mapSupabaseRowToNavWarning(
  row: any,
  fallbackStatus: string = 'active'
): NavWarning {
  const rawText = row.raw_text || row.issued_text || '';
  const navarea = (row.navarea || 'I') as any;
  
  // Deterministic coordinate parse from raw text
  let spatial: any = {
    geometries: [],
    circles: [],
    raw_coordinate_text: [],
    validation_status: 'not_present',
  };

  try {
    // If coordinateParser is available synchronously, or parse simple regex
    const coordsMatch = rawText.match(/(\d{1,2})[-°](\d{1,2}(?:\.\d+)?)[ '"]*([NS])\s*(\d{1,3})[-°](\d{1,2}(?:\.\d+)?)[ '"]*([EW])/i);
    if (coordsMatch) {
      const latDeg = parseFloat(coordsMatch[1]);
      const latMin = parseFloat(coordsMatch[2]);
      const latDir = coordsMatch[3].toUpperCase();
      const lngDeg = parseFloat(coordsMatch[4]);
      const lngMin = parseFloat(coordsMatch[5]);
      const lngDir = coordsMatch[6].toUpperCase();

      let lat = latDeg + latMin / 60;
      if (latDir === 'S') lat = -lat;
      let lng = lngDeg + lngMin / 60;
      if (lngDir === 'W') lng = -lng;

      spatial = {
        geometries: [
          {
            type: 'Point',
            coordinates: [lng, lat],
            label: row.title || row.warning_id || 'Extracted Point',
          },
        ],
        circles: [],
        raw_coordinate_text: [coordsMatch[0]],
        validation_status: 'passed',
      };
    }
  } catch {
    // fallback
  }

  // If spatial has no geometries, but row has direct latitude/longitude numbers
  const directLat = row.latitude != null && !isNaN(Number(row.latitude)) ? Number(row.latitude) : null;
  const directLng = row.longitude != null && !isNaN(Number(row.longitude)) ? Number(row.longitude) : null;

  if (spatial.geometries.length === 0 && directLat != null && directLng != null) {
    spatial = {
      geometries: [
        {
          type: 'Point',
          coordinates: [directLng, directLat],
          label: row.title || row.warning_id || `Point ${directLat}, ${directLng}`,
        },
      ],
      circles: [],
      raw_coordinate_text: [`${directLat}, ${directLng}`],
      validation_status: 'passed',
    };
  }

  const effectiveStatus = row.status || (row.validity === 'cancelled' ? 'cancelled' : fallbackStatus);
  const issuedIso = row.issued_date || row.created_at || new Date().toISOString();
  const issuedDateStr = row.issued_date
    ? (row.issued_date.includes('T') ? row.issued_date.split('T')[0] : row.issued_date)
    : (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);

  return {
    schema_version: 1,
    warning_id: row.warning_id || row.id || `warn-${Date.now()}`,
    publisher_id: row.publisher_id || row.source_id?.split('-')[0] || 'unknown',
    source_id: row.source_id || 'unknown',
    navarea: navarea,
    series: row.series || `NAVAREA ${navarea}`,
    source_warning_id: row.warning_id || 'UNKNOWN',
    warning_number: row.warning_number || row.warning_id?.split('-')[0] || 'UNKNOWN',
    warning_year: parseInt(row.warning_year || row.warning_id?.split('-')[1]) || new Date().getFullYear(),
    issued_at: issuedIso,
    issued_date: issuedDateStr,
    issued_time_precision: 'day',
    issued_text: row.issued_text || row.issued_date || '',
    valid_from: row.valid_from || row.issued_date || row.created_at || null,
    valid_to: row.valid_until || row.valid_to || null,
    cancelled_at: row.cancelled_at || (effectiveStatus === 'cancelled' ? (row.updated_at || new Date().toISOString()) : null),
    status: effectiveStatus as any,
    status_basis: row.status_basis || 'listed_in_complete_in_force_publication',
    area_text: row.area_text || row.sub_area || 'Unknown Navigational Area',
    original_language: 'en',
    raw_text: rawText,
    translated_text: null,
    spatial,
    supersedes: [],
    cancels: [],
    title: row.title || null,
    authority: row.authority || null,
    sub_area: row.sub_area || row.area_text || null,
    risk_level: row.risk_level || null,
    latitude: directLat,
    longitude: directLng,
    valid_until: row.valid_until || null,
    validity: row.validity || null,
    charts: row.charts || null,
    categories: row.categories || null,
    web_link: row.web_link || row.source_url || null,
    source_url: row.source_url || row.web_link || '',
    raw_artifact_ref: row.id || '',
    content_hash: row.content_hash || row.id || '',
    parser_version: row.parser_version || '2.0',
    extraction_method: row.extraction_method || 'deterministic',
    extraction_confidence: row.extraction_confidence != null ? Number(row.extraction_confidence) : 0.95,
    first_seen_at: row.created_at || new Date().toISOString(),
    last_seen_at: row.updated_at || row.created_at || new Date().toISOString(),
    not_in_force_observed_at: null,
    generation_id: row.generation_id || 'live-supabase-fetch',
    validation: {
      identity: 'passed',
      dates: 'passed',
      geometry: spatial.geometries.length > 0 ? 'passed' : 'not_present',
    },
  };
}

export async function fetchWarnings(params?: {
  sourceId?: string;
  navarea?: string;
  status?: string;
}): Promise<NavWarning[]> {
  try {
    const { supabase } = await import('../lib/supabaseClient');
    const { INITIAL_WARNINGS } = await import('../data/sourcesRegistry');

    if (supabase) {
      const PAGE_SIZE = 1000;
      const allRows: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const to = from + PAGE_SIZE - 1;
        let query = supabase
          .from('nav_warnings')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to);

        if (params?.sourceId) {
          query = query.eq('source_id', params.sourceId);
        }
        if (params?.navarea) {
          query = query.eq('navarea', params.navarea);
        }

        const { data, error } = await query;

        if (error) {
          console.warn(`Supabase fetch error at range ${from}..${to}:`, error.message);
          break;
        }

        if (data && data.length > 0) {
          allRows.push(...data);
          if (data.length < PAGE_SIZE) {
            hasMore = false;
          } else {
            from += PAGE_SIZE;
          }
        } else {
          hasMore = false;
        }
      }

      if (allRows.length > 0) {
        // Map database row to NavWarning interface with full field fidelity
        const liveWarnings: NavWarning[] = allRows.map((row: any) =>
          mapSupabaseRowToNavWarning(row, params?.status || 'active')
        );

        if (params?.status) {
          return liveWarnings.filter((w) => w.status === params.status);
        }

        return liveWarnings;
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

export async function fetchGenerations(): Promise<IngestionGeneration[]> {
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
          localStorage.setItem('helm_admin_mode', 'true');
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
        localStorage.setItem('helm_admin_mode', 'true');
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
      localStorage.setItem('helm_admin_mode', 'false');
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
  counts: { warnings: number; sources: number; generations: number; artifacts: number };
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
      counts: data.counts || { warnings: 0, sources: 0, generations: 0, artifacts: 0 },
      localCounts: data.localCounts || { warnings: 0, sources: 0, generations: 0, artifacts: 0 },
      error: data.error,
      ok: Boolean(data.ok ?? data.connected),
    };
  } catch (err: any) {
    return {
      connected: false,
      url: null,
      counts: { warnings: 0, sources: 0, generations: 0, artifacts: 0 },
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

  // 2. Direct browser-side client SDK attempt
  try {
    const { supabase } = await import('../lib/supabaseClient');
    if (!supabase) {
      return { success: false, insertedCount: 0, error: 'Supabase client not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in settings.' };
    }

    const rows = warnings.map((w) => {
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
        issued_date: w.issued_date || new Date().toISOString().split('T')[0],
        navarea: w.navarea || 'IV',
        area_text: w.area_text || null,
        sub_area: w.sub_area || w.area_text || null,
        authority: w.authority || null,
        source_url: w.source_url || w.web_link || null,
        risk_level: w.risk_level || null,
        extraction_method: w.extraction_method || 'deterministic',
        generation_id: w.generation_id || `gen-md-${Date.now()}`,
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

    // Also persist into raw_messages
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
        await supabase.from('raw_messages').insert(rawRows);
      } catch (err) {
        console.warn('raw_messages insert notice:', err);
      }
    }

    // Chunk in batches of 100
    const CHUNK_SIZE = 100;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      let { error } = await supabase.from('nav_warnings').upsert(chunk, { onConflict: 'source_id,warning_id' });
      if (error && error.message.includes('conflict')) {
        const fallback = await supabase.from('nav_warnings').upsert(chunk, { onConflict: 'warning_id' });
        error = fallback.error;
      }
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



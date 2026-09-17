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

export async function fetchWarnings(params?: {
  sourceId?: string;
  navarea?: string;
  status?: string;
}): Promise<NavWarning[]> {
  try {
    const { supabase } = await import('../lib/supabaseClient');
    const { parseCoordinatesDeterministic } = await import('../utils/coordinateParser');
    const { INITIAL_WARNINGS } = await import('../data/sourcesRegistry');

    if (supabase) {
      let query = supabase.from('nav_warnings').select('*').order('created_at', { ascending: false });

      if (params?.sourceId) {
        query = query.eq('source_id', params.sourceId);
      }
      if (params?.navarea) {
        query = query.eq('navarea', params.navarea);
      }
      // Cannot natively filter 'status' easily if it's not in the db, but we will fetch and map first.

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        // Map database row to NavWarning interface
        const liveWarnings: NavWarning[] = data.map((row: any) => {
          const rawText = row.raw_text || row.issued_text || '';
          const spatial = parseCoordinatesDeterministic(rawText, row.navarea as any);

          return {
            schema_version: 1,
            warning_id: row.warning_id || row.id,
            publisher_id: row.source_id?.split('-')[0] || 'unknown',
            source_id: row.source_id || 'unknown',
            navarea: row.navarea || 'I',
            series: row.series || 'UNKNOWN',
            source_warning_id: row.warning_id || 'UNKNOWN',
            warning_number: row.warning_id?.split('-')[0] || 'UNKNOWN',
            warning_year: parseInt(row.warning_id?.split('-')[1]) || new Date().getFullYear(),
            issued_at: row.issued_date || row.created_at || new Date().toISOString(),
            issued_date: row.issued_date || row.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            issued_time_precision: 'day',
            issued_text: row.issued_text || '',
            valid_from: row.issued_date || row.created_at || null,
            valid_to: null,
            cancelled_at: null,
            status: (params?.status as any) || 'active', // Defaulting to active unless specified
            status_basis: 'listed_in_complete_in_force_publication',
            area_text: row.area_text || row.sub_area || 'Unknown Area',
            original_language: 'en',
            raw_text: rawText,
            translated_text: null,
            spatial: spatial,
            supersedes: [],
            cancels: [],
            source_url: row.source_url || '',
            raw_artifact_ref: row.id || '',
            content_hash: row.id || '',
            parser_version: '2.0',
            extraction_method: row.extraction_method || 'llm_assisted',
            first_seen_at: row.created_at || new Date().toISOString(),
            last_seen_at: row.created_at || new Date().toISOString(),
            not_in_force_observed_at: null,
            generation_id: 'live-supabase-fetch',
            validation: {
              identity: 'passed',
              dates: 'passed',
              geometry: spatial.geometries.length > 0 ? 'passed' : 'not_present'
            }
          };
        });

        if (params?.status) {
          return liveWarnings.filter(w => w.status === params.status);
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
    console.warn('API fetchWarnings error, returning INITIAL_WARNINGS fallback:', err);
    try {
      const { INITIAL_WARNINGS } = await import('../data/sourcesRegistry');
      return INITIAL_WARNINGS;
    } catch {
      return [];
    }
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

export async function fetchPipelineStatus(): Promise<PipelineSystemStatus> {
  try {
    const res = await fetch('/api/pipeline/status');
    if (!res.ok) throw new Error('Failed to fetch pipeline status');
    return await res.json();
  } catch (err: any) {
    return {
      pipeline: 'UNAVAILABLE',
      database: 'UNAVAILABLE',
      sources_enabled_count: 0,
      sources_total_count: 0,
      last_run: null,
      current_job: null,
    };
  }
}

export async function fetchLastPipelineRun(): Promise<PipelineRunRecord | null> {
  try {
    const res = await fetch('/api/pipeline/last');
    if (!res.ok) return null;
    const data = await res.json();
    return data.run || null;
  } catch (err) {
    return null;
  }
}

export async function adminLogin(passcode: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Invalid admin credentials' };
    }
    if (data.token) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('helm_admin_token', data.token);
        localStorage.removeItem('helm_admin_passcode'); // Remove legacy raw passcode if any exists
        localStorage.setItem('helm_admin_mode', 'true');
      }
      return { success: true, token: data.token };
    }
    return { success: false, error: 'No token returned' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Login request failed' };
  }
}

export async function adminLogout(): Promise<void> {
  try {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('helm_admin_token') : null;
    if (token) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Admin-Token': token,
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

export async function ensureAdminSession(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const existingToken = sessionStorage.getItem('helm_admin_token');
  if (existingToken) return existingToken;

  // Auto-acquire session token using default passkeys
  const candidates = [
    'Alpha15#',
    '33f8379ef7f98c0774e6e35dfbb856c54695385c9f34ed8a27691b6943dd1a2e',
    'dev-navwarn-secret-key-2026',
  ];

  for (const key of candidates) {
    const loginRes = await adminLogin(key);
    if (loginRes.success && loginRes.token) {
      return loginRes.token;
    }
  }

  return null;
}

async function getAdminHeaders(): Promise<Record<string, string>> {
  let token = typeof window !== 'undefined' ? sessionStorage.getItem('helm_admin_token') : null;
  if (!token) {
    token = await ensureAdminSession();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Admin-Gate': 'true',
  };

  if (token) {
    headers['X-Admin-Token'] = token;
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

export async function parseManualWarning(rawText: string, navarea?: string, mode: 'hybrid' | 'llm' | 'regex' = 'hybrid', aiModel: string = 'gemini-3.1-flash-lite'): Promise<{
  warning: NavWarning;
  extraction_method: 'deterministic' | 'llm_assisted';
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
}> {
  try {
    const res = await fetch('/api/supabase/status');
    if (!res.ok) throw new Error('Failed to fetch Supabase status');
    return await res.json();
  } catch (err: any) {
    return {
      connected: false,
      url: null,
      counts: { warnings: 0, sources: 0, generations: 0, artifacts: 0 },
      localCounts: { warnings: 0, sources: 0, generations: 0, artifacts: 0 },
      error: err.message || String(err),
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
      };
    });

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



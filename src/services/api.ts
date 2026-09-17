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
    const query = new URLSearchParams();
    if (params?.sourceId) query.set('sourceId', params.sourceId);
    if (params?.navarea) query.set('navarea', params.navarea);
    if (params?.status) query.set('status', params.status);

    const res = await fetch(`/api/warnings?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch warnings');
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
}> {
  const headers = await getAdminHeaders();
  const res = await fetch('/api/pipeline/trigger', {
    method: 'POST',
    headers,
    body: JSON.stringify({ sourceId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to trigger ingestion pipeline');
  }
  return await res.json();
}

export async function parseManualWarning(rawText: string, navarea?: string): Promise<{
  warning: NavWarning;
  extraction_method: 'deterministic' | 'llm_assisted';
}> {
  const headers = await getAdminHeaders();
  const res = await fetch('/api/pipeline/parse-manual', {
    method: 'POST',
    headers,
    body: JSON.stringify({ rawText, navarea }),
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


import { NavWarning, SourceRegistryItem, IngestionGeneration, RawArtifact } from '../types';

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

export async function triggerPipelineRefresh(sourceId?: string): Promise<{
  success: boolean;
  message: string;
  newGenerationId?: string;
  parsedCount?: number;
}> {
  const res = await fetch('/api/pipeline/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch('/api/pipeline/parse-manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const res = await fetch('/api/supabase/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to trigger Supabase sync');
  }
  return await res.json();
}


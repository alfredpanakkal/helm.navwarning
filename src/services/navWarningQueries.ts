// src/services/navWarningQueries.ts
// Single source of truth for all Supabase reads (20261019/20 schema).
// See docs/supabase-backend-contract.md — geometry lives in
// nav_warning_geometries / the nav_warnings_active_spatial view, NOT in
// flat latitude/longitude columns on nav_warnings (those do not exist).

import { supabase as anonClient } from '../lib/supabaseClient';
import { getSupabaseClient } from '../lib/supabaseServer';

export interface ActiveSpatialRow {
  warning_id: string; // uuid = nav_warnings.id
  canonical_id: string;
  navarea: string;
  title: string;
  area_text: string | null;
  categories: string[] | null;
  status: string;
  triage_tier: string;
  data_quality: string;
  valid_from: string | null;
  valid_to: string | null;
  radio_frequencies: string[] | null;
  space_launch_mission: string | null;
  geom_id: string;
  zone_label: string | null;
  feature_type: string;
  buffer_nm: number;
  corridor_half_width_nm: number | null;
  altitude_floor_m: number;
  altitude_ceiling_fl: number | null;
  geom_postgis: unknown;
  geojson_blob: Record<string, unknown> | null;
}

export interface NavWarningListFilters {
  sourceId?: string;
  navarea?: string;
  status?: string;
  triageTier?: string;
  triageTiers?: string[]; // multi-tier filter; public reads pass ['A','B'] to hide blocked Tier C
  category?: string; // categories[] contains
  limit?: number;
}

const VIEW_COLUMNS =
  'warning_id, canonical_id, navarea, title, area_text, categories, status, ' +
  'triage_tier, data_quality, valid_from, valid_to, feature_type, zone_label, ' +
  'buffer_nm, geojson_blob';

const LIST_COLUMNS =
  'id, canonical_id, navarea, source_id, title, area_text, raw_text, categories, ' +
  'status, triage_tier, data_quality, parsing_method, qa_flags, unplotted_reason, ' +
  'valid_from, valid_to, issued_at, created_at, updated_at';

const PAGE_SIZE = 1000; // PostgREST server-side max range

function resolveClient(serverClient?: boolean) {
  if (serverClient) return getSupabaseClient();
  return anonClient;
}

/**
 * Fetches all rows of the map view (active + Tier A), paginated.
 * One row PER GEOMETRY — group by canonical_id before rendering.
 */
export async function fetchActiveSpatialRows(opts?: { serverClient?: boolean }): Promise<ActiveSpatialRow[]> {
  const client = resolveClient(opts?.serverClient);
  if (!client) return [];
  const rows: ActiveSpatialRow[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await client
      .from('nav_warnings_active_spatial')
      .select(VIEW_COLUMNS)
      .range(from, to);
    if (error) {
      console.warn('[navWarningQueries] active_spatial query notice:', error.message);
      break;
    }
    if (data && data.length > 0) {
      rows.push(...(data as unknown as ActiveSpatialRow[]));
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return rows;
}

/** Converts a view geojson_blob into a frontend SpatialGeometry-like entry. */
export function geojsonBlobToGeometry(blob: unknown, label?: string | null): Record<string, unknown> | null {
  if (!blob || typeof blob !== 'object') return null;
  const g = blob as { type?: string; coordinates?: unknown };
  if (!g.type || g.coordinates === undefined) return null;
  const type = g.type;
  if (type === 'Point' || type === 'Polygon' || type === 'LineString' || type === 'MultiPoint' || type === 'MultiPolygon' || type === 'MultiLineString') {
    return { type, coordinates: g.coordinates, label: label || undefined };
  }
  return null;
}

export interface GroupedSpatialWarning extends ActiveSpatialRow {
  _geometries: Record<string, unknown>[];
  _geojson: Record<string, unknown> | null;
}
/**
 * Groups view rows (one per geometry) into one record per warning, with
 * all geometries collected under _geometries and the first geometry under
 * _geojson. Never cache geom_id — it is deleted/reinserted every sync.
 */
export function groupSpatialRowsByCanonicalId(rows: ActiveSpatialRow[]): GroupedSpatialWarning[] {
  const byCanonical = new Map<string, GroupedSpatialWarning>();
  for (const r of rows) {
    const geom = geojsonBlobToGeometry(r.geojson_blob, r.zone_label);
    let grouped = byCanonical.get(r.canonical_id);
    if (!grouped) {
      grouped = { ...r, _geometries: [], _geojson: null };
      byCanonical.set(r.canonical_id, grouped);
    }
    if (geom) {
      (grouped._geometries as Record<string, unknown>[]).push(geom);
      if (!grouped._geojson) grouped._geojson = geom;
    }
  }
  return Array.from(byCanonical.values());
}

/**
 * Databank listing query against nav_warnings with explicit new-schema
 * columns. Supports PostgREST filters; categories uses array `contains`.
 */
export async function fetchNavWarningsList(params?: NavWarningListFilters & { serverClient?: boolean }): Promise<Record<string, unknown>[]> {
  const client = resolveClient(params?.serverClient);
  if (!client) return [];
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const to = from + PAGE_SIZE - 1;
    let query = client.from('nav_warnings').select(LIST_COLUMNS).order('updated_at', { ascending: false }).range(from, to);
    if (params?.sourceId) query = query.eq('source_id', params.sourceId);
    if (params?.navarea) query = query.eq('navarea', params.navarea);
    if (params?.status) query = query.eq('status', params.status);
    if (params?.triageTier) query = query.eq('triage_tier', params.triageTier);
    if (params?.triageTiers && params.triageTiers.length > 0) query = query.in('triage_tier', params.triageTiers);
    if (params?.category) query = query.contains('categories', [params.category]);
    const { data, error } = await query;
    if (error) {
      console.warn('[navWarningQueries] nav_warnings list query notice:', error.message);
      break;
    }
    if (data && data.length > 0) {
      rows.push(...(data as unknown as Record<string, unknown>[]));
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return rows;
}

/**
 * Single-warning refetch: the master row (LIST_COLUMNS, incl. raw_text) plus
 * its geometries from the active_spatial view, converted with
 * geojsonBlobToGeometry (buffer_nm carried along for buffered points).
 * Used by the edit-save repaint and the debounced realtime handler so one
 * admin edit never triggers a full-dataset reload.
 */
export async function fetchSingleWarning(canonicalId: string): Promise<{
  row: Record<string, unknown> | null;
  geometries: Record<string, unknown>[];
}> {
  if (!anonClient) return { row: null, geometries: [] };
  const { data: row, error } = await anonClient
    .from('nav_warnings')
    .select(LIST_COLUMNS)
    .eq('canonical_id', canonicalId)
    .maybeSingle();
  if (error || !row) {
    console.warn('[navWarningQueries] single warning query notice:', error?.message);
    return { row: null, geometries: [] };
  }
  const { data: spatial }: any = await anonClient
    .from('nav_warnings_active_spatial')
    .select(VIEW_COLUMNS)
    .eq('canonical_id', canonicalId);
  const geometries: Record<string, unknown>[] = [];
  for (const r of (spatial || []) as ActiveSpatialRow[]) {
    const g = geojsonBlobToGeometry(r.geojson_blob, r.zone_label);
    if (g) geometries.push({ ...g, buffer_nm: Number(r.buffer_nm) || 0 });
  }
  return { row, geometries };
}

const ARCHIVE_COLUMNS =
  'id, canonical_id, navarea, source_id, title, area_text, raw_text, categories, ' +
  'status, status_basis, status_changed_at, triage_tier, data_quality, parsing_method, ' +
  'qa_flags, unplotted_reason, valid_from, valid_to, created_at, updated_at';

/**
 * Archived warnings (status <> 'active') from the nav_warnings_archive view
 * created by the backend 20261023_lifecycle_safety migration: cancelled,
 * expired and superseded records stay searchable without a geometry join.
 * Powers the Data Bank "Archived / Cancelled" lane.
 */
export async function fetchArchivedNavWarnings(opts?: { serverClient?: boolean }): Promise<Record<string, unknown>[]> {
  const client = resolveClient(opts?.serverClient);
  if (!client) return [];
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await client
      .from('nav_warnings_archive')
      .select(ARCHIVE_COLUMNS)
      .order('status_changed_at', { ascending: false, nullsFirst: false })
      .range(from, to);
    if (error) {
      console.warn('[navWarningQueries] archive query notice:', error.message);
      break;
    }
    if (data && data.length > 0) {
      rows.push(...(data as unknown as Record<string, unknown>[]));
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return rows;
}

const GENERATION_COLUMNS =
  'generation_id, source_id, navarea, started_at, completed_at, status, parsed_count, active_count, evidence_hash, details';

/**
 * Ingestion run ledger (20261023_lifecycle_safety migration): one row per
 * sync run in ingestion_generations, newest first. Public anon reads are
 * granted by the "public read ingestion_generations" RLS policy. This is
 * what lets the Data Bank Summary answer "where did the warnings go?".
 */
export async function fetchIngestionGenerations(
  opts?: { serverClient?: boolean; limit?: number }
): Promise<Record<string, unknown>[]> {
  const client = resolveClient(opts?.serverClient);
  if (!client) return [];
  const rows: Record<string, unknown>[] = [];
  const limit = opts?.limit ?? 200;
  let from = 0;
  let hasMore = true;
  while (hasMore && from < limit) {
    const to = Math.min(from + PAGE_SIZE, limit) - 1;
    const { data, error } = await client
      .from('ingestion_generations')
      .select(GENERATION_COLUMNS)
      .order('started_at', { ascending: false })
      .range(from, to);
    if (error) {
      console.warn('[navWarningQueries] ingestion_generations query notice:', error.message);
      break;
    }
    if (data && data.length > 0) {
      rows.push(...(data as unknown as Record<string, unknown>[]));
      hasMore = data.length === to - from + 1;
      from += PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return rows;
}

/** Tier B review queue rows for the admin triage UI. */
export async function fetchReviewQueueRows(opts?: { serverClient?: boolean }): Promise<Record<string, unknown>[]> {
  const client = resolveClient(opts?.serverClient);
  if (!client) return [];
  const { data, error } = await client
    .from('nav_warnings_review_queue')
    .select('warning_id: id, canonical_id, navarea, title, area_text, categories, status, triage_tier, data_quality, parsing_method, qa_flags, unplotted_reason, duplicate_of_id, raw_text, valid_from, valid_to, created_at, updated_at');
  if (error) {
    console.warn('[navWarningQueries] review_queue query notice:', error.message);
    return [];
  }
  return (data ?? []) as unknown as Record<string, unknown>[];
}

export interface RealtimeChangeInfo {
  table: 'nav_warnings' | 'nav_warning_geometries';
  canonicalId?: string;
  warningId?: string;
}

/**
 * Realtime subscription covering both tables in the supabase_realtime
 * publication. Geometry changes without master changes must also refresh.
 * Events are coalesced with a trailing 1.5s debounce (a geometry save is a
 * delete+insert burst) and the changed row's identity is passed through so
 * the caller can refetch a single warning instead of the whole dataset.
 */
export function subscribeToNavWarnings(
  onChange: (info: RealtimeChangeInfo) => void
): { unsubscribe: () => void } | null {
  if (!anonClient) return null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const pending = new Map<string, RealtimeChangeInfo>();
  const fire = () => {
    timer = null;
    for (const info of pending.values()) onChange(info);
    pending.clear();
  };
  const queue = (info: RealtimeChangeInfo) => {
    pending.set(info.table + ':' + (info.canonicalId || info.warningId), info);
    if (timer) clearTimeout(timer);
    timer = setTimeout(fire, 1500);
  };
  const channel = anonClient
    .channel('nav-warnings-v2')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nav_warnings' },
      (payload: any) => queue({ table: 'nav_warnings', canonicalId: payload?.new?.canonical_id || payload?.old?.canonical_id }))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nav_warning_geometries' },
      (payload: any) => queue({ table: 'nav_warning_geometries', warningId: payload?.new?.warning_id || payload?.old?.warning_id }));
  channel.subscribe();
  return {
    unsubscribe: () => {
      if (timer) clearTimeout(timer);
      anonClient.removeChannel(channel);
    },
  };
}



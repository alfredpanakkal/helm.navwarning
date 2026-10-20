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
      rows.push(...(data as ActiveSpatialRow[]));
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

export interface GroupedSpatialWarning {
  row: Record<string, unknown> & { _geometries?: Record<string, unknown>[]; _geojson?: Record<string, unknown> | null };
}

/**
 * Groups view rows (one per geometry) into one record per warning, with
 * all geometries collected under _geometries and the first geometry under
 * _geojson. Never cache geom_id — it is deleted/reinserted every sync.
 */
export function groupSpatialRowsByCanonicalId(rows: ActiveSpatialRow[]): GroupedSpatialWarning[] {
  const byCanonical = new Map<string, GroupedSpatialWarning['row']>();
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
    if (params?.category) query = query.contains('categories', [params.category]);
    const { data, error } = await query;
    if (error) {
      console.warn('[navWarningQueries] nav_warnings list query notice:', error.message);
      break;
    }
    if (data && data.length > 0) {
      rows.push(...(data as Record<string, unknown>[]));
      hasMore = data.length === PAGE_SIZE;
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
  return (data ?? []) as Record<string, unknown>[];
}

/**
 * Realtime subscription covering both tables in the supabase_realtime
 * publication. Geometry changes without master changes must also refresh.
 */
export function subscribeToNavWarnings(onChange: () => void): { unsubscribe: () => void } | null {
  if (!anonClient) return null;
  const channel = anonClient
    .channel('nav-warnings-v2')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nav_warnings' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nav_warning_geometries' }, () => onChange());
  channel.subscribe();
  return {
    unsubscribe: () => {
      anonClient.removeChannel(channel);
    },
  };
}

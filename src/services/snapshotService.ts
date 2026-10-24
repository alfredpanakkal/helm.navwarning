// src/services/snapshotService.ts
// In-Force Snapshots persistence, validation, date extraction, and PostgREST query layer

import { supabase } from '../lib/supabaseClient.js';
import { getSupabaseClient } from '../lib/supabaseServer.js';
import { FEATURE_FLAGS } from '../lib/featureFlags.js';
import type { ParsedInForceList } from '../parsers/inForceListParser.js';
import type {
  InForceSnapshot,
  InForceSnapshotRow,
  CreateSnapshotInput,
  SnapshotQueryOptions,
} from '../types/snapshot.js';

// ESM-safe test hook: Allows tests to inject a mock Supabase client without module mocking
let isOverrideSet = false;
let testClientOverride: any = null;

const MONTH_MAP: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

function normalizeYearToFull(yr: number): number {
  if (yr < 100) {
    return yr >= 70 ? 1900 + yr : 2000 + yr;
  }
  return yr;
}

/**
 * Extracts issued_at Date from raw in-force list text supporting:
 * 1. DTG format: "151200Z OCT 24" -> UTC Date
 * 2. Header date format: "ON 15 OCT 2024" or "15 OCT 2024" -> UTC Date
 * 3. JHOD format: "Date:2026/10/10 12 UTC" -> UTC Date
 */
export function extractIssuedAtFromList(text: string): Date | null {
  if (!text || typeof text !== 'string') return null;

  // 1. JHOD format: "Date:2026/10/10 12 UTC" or "Date: 2026/10/10 12 UTC" or "2026/10/10 12 UTC"
  const jhodMatch = text.match(
    /(?:Date\s*:\s*)(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2})(?::(\d{2}))?\s*(?:UTC|Z)?)?/i
  ) || text.match(/\b(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2})(?::(\d{2}))?\s*(?:UTC|Z)\b/i);

  if (jhodMatch) {
    const yr = parseInt(jhodMatch[1], 10);
    const mo = parseInt(jhodMatch[2], 10) - 1;
    const dy = parseInt(jhodMatch[3], 10);
    const hr = jhodMatch[4] ? parseInt(jhodMatch[4], 10) : 0;
    const mn = jhodMatch[5] ? parseInt(jhodMatch[5], 10) : 0;

    if (mo >= 0 && mo <= 11 && dy >= 1 && dy <= 31 && hr >= 0 && hr <= 23 && mn >= 0 && mn <= 59) {
      return new Date(Date.UTC(yr, mo, dy, hr, mn, 0));
    }
  }

  // 2. DTG format: "151200Z OCT 24" or "151200Z OCT 2024" or "151200 UTC OCT 24"
  const dtgMatch = text.match(
    /(?:^|\s|[([<])(\d{2})(\d{2})(\d{2})\s*(?:Z|UTC)\s+([A-Za-z]{3})\s+(\d{2}|\d{4})\b/i
  );

  if (dtgMatch) {
    const dy = parseInt(dtgMatch[1], 10);
    const hr = parseInt(dtgMatch[2], 10);
    const mn = parseInt(dtgMatch[3], 10);
    const moStr = dtgMatch[4].toUpperCase();
    const rawYr = parseInt(dtgMatch[5], 10);

    if (moStr in MONTH_MAP) {
      const mo = MONTH_MAP[moStr];
      const yr = normalizeYearToFull(rawYr);
      if (dy >= 1 && dy <= 31 && hr >= 0 && hr <= 23 && mn >= 0 && mn <= 59) {
        return new Date(Date.UTC(yr, mo, dy, hr, mn, 0));
      }
    }
  }

  // 3. Header date format: "ON 15 OCT 2024", "AS OF 15 OCT 2024", or standalone "15 OCT 2024"
  const headerMatch = text.match(
    /(?:ON|AS\s+OF|DATE:?)\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2}|\d{4})\b/i
  ) || text.match(/\b(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\b/i);

  if (headerMatch) {
    const dy = parseInt(headerMatch[1], 10);
    const moStr = headerMatch[2].toUpperCase();
    const rawYr = parseInt(headerMatch[3], 10);

    if (moStr in MONTH_MAP) {
      const mo = MONTH_MAP[moStr];
      const yr = normalizeYearToFull(rawYr);
      if (dy >= 1 && dy <= 31) {
        return new Date(Date.UTC(yr, mo, dy, 0, 0, 0));
      }
    }
  }

  return null;
}

/**
 * Validates in-force snapshot payload integrity across camelCase and snake_case structures.
 */
export function validateInForceSnapshot(snapshot: any): boolean {
  if (!snapshot || typeof snapshot !== 'object') return false;

  const navarea = snapshot.navarea || snapshot.nav_area;
  if (!navarea || typeof navarea !== 'string' || !navarea.trim()) return false;

  const snapshotWarningId =
    snapshot.snapshotWarningId ||
    snapshot.snapshot_warning_id ||
    snapshot.warningId ||
    snapshot.warning_id;
  if (!snapshotWarningId || typeof snapshotWarningId !== 'string' || !snapshotWarningId.trim())
    return false;

  const sourceId = snapshot.sourceId || snapshot.source_id;
  if (!sourceId || typeof sourceId !== 'string' || !sourceId.trim()) return false;

  const issuedAt = snapshot.issuedAt || snapshot.issued_at;
  if (!issuedAt) return false;
  const parsedDate = issuedAt instanceof Date ? issuedAt : new Date(issuedAt);
  if (isNaN(parsedDate.getTime())) return false;

  const entries = snapshot.entries || snapshot.inForceEntries;
  if (!Array.isArray(entries)) return false;

  return true;
}

/**
 * Injects a custom Supabase client for testing (ESM-safe hook).
 */
export function setSnapshotSupabaseClient(client: any): void {
  isOverrideSet = true;
  testClientOverride = client;
}

/**
 * Resets the custom test client hook.
 */
export function resetSnapshotSupabaseClient(): void {
  isOverrideSet = false;
  testClientOverride = null;
}

/**
 * Resolves the active Supabase client (Test Override -> Server Client -> Client-side Singleton).
 */
export function getActiveSupabaseClient(): any {
  if (isOverrideSet) {
    return testClientOverride;
  }
  // Try server client in Node environment, fallback to browser client
  try {
    const serverClient = getSupabaseClient();
    if (serverClient) return serverClient;
  } catch {
    // Ignore in pure client environment
  }
  return supabase;
}

/**
 * Converts a database snake_case row into the hydrated InForceSnapshot domain model.
 */
export function mapRowToSnapshot(row: InForceSnapshotRow): InForceSnapshot {
  return {
    id: row.id || '',
    navarea: row.navarea,
    snapshotWarningId: row.snapshot_warning_id,
    sourceId: row.source_id,
    issuedAt: row.issued_at,
    issueDate: row.issue_date || null,
    entries: Array.isArray(row.entries) ? row.entries : [],
    cancelledRefs: Array.isArray(row.cancelled_refs) ? row.cancelled_refs : [],
    isPartial: Boolean(row.is_partial),
    isAuthoritative: Boolean(row.is_authoritative),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Converts domain input payload to PostgreSQL snake_case row format.
 */
export function mapInputToRow(input: CreateSnapshotInput): InForceSnapshotRow {
  const issuedAtISO =
    input.issuedAt instanceof Date
      ? input.issuedAt.toISOString()
      : new Date(input.issuedAt).toISOString();

  return {
    navarea: input.navarea.trim().toUpperCase(),
    snapshot_warning_id: input.snapshotWarningId.trim(),
    source_id: input.sourceId.trim(),
    issued_at: issuedAtISO,
    issue_date: input.issueDate || null,
    entries: input.entries || [],
    cancelled_refs: input.cancelledRefs || [],
    is_partial: Boolean(input.isPartial),
    is_authoritative: Boolean(input.isAuthoritative),
  };
}

/**
 * Upserts an in-force snapshot record into PostgreSQL.
 * Uses PostgREST upsert with unique constraint onConflict: 'navarea,snapshot_warning_id'.
 */
export async function saveSnapshot(
  input: CreateSnapshotInput
): Promise<InForceSnapshot | null> {
  if (!FEATURE_FLAGS.inForceSnapshots) {
    console.warn('In-force snapshots feature is disabled via FEATURE_FLAGS.inForceSnapshots');
    return null;
  }

  const client = getActiveSupabaseClient();
  if (!client) {
    console.warn('Supabase client unavailable. Cannot save in-force snapshot.');
    return null;
  }

  const row = mapInputToRow(input);

  try {
    const { data, error } = await client
      .from('in_force_snapshots')
      .upsert(row, { onConflict: 'navarea,snapshot_warning_id' })
      .select()
      .single();

    if (error) {
      console.error('Error saving in-force snapshot to Supabase:', error);
      return null;
    }

    return data ? mapRowToSnapshot(data) : null;
  } catch (err) {
    console.error('Unexpected exception saving in-force snapshot:', err);
    return null;
  }
}

/**
 * Syncs an in-force snapshot into Supabase:
 * - Accepts either camelCase (CreateSnapshotInput) or snake_case (InForceSnapshotRow)
 * - If isAuthoritative is true, demotes existing authoritative snapshots for the NAVAREA
 * - Upserts via saveSnapshot
 * - Returns { success, snapshot, error }
 */
export async function syncInForceSnapshot(
  snapshot: any
): Promise<{ success: boolean; snapshot?: InForceSnapshot; error?: string }> {
  if (!FEATURE_FLAGS.inForceSnapshots) {
    return { success: false, error: 'In-force snapshots feature is disabled via feature flag' };
  }

  if (!validateInForceSnapshot(snapshot)) {
    return { success: false, error: 'Invalid in-force snapshot payload' };
  }

  const navarea = (snapshot.navarea || snapshot.nav_area || '').trim().toUpperCase();
  const snapshotWarningId = (
    snapshot.snapshotWarningId ||
    snapshot.snapshot_warning_id ||
    snapshot.warningId ||
    snapshot.warning_id ||
    ''
  ).trim();
  const sourceId = (snapshot.sourceId || snapshot.source_id || '').trim();
  const issuedAt = snapshot.issuedAt || snapshot.issued_at;
  const issueDate = snapshot.issueDate || snapshot.issue_date || snapshot.asOfDate || null;
  const entries = snapshot.entries || snapshot.inForceEntries || [];
  const cancelledRefs = snapshot.cancelledRefs || snapshot.cancelled_refs || [];
  const isPartial = Boolean(snapshot.isPartial ?? snapshot.is_partial ?? snapshot.isPartialList);
  const isAuthoritative = Boolean(snapshot.isAuthoritative ?? snapshot.is_authoritative);

  const client = getActiveSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client unavailable' };
  }

  try {
    // If marking as authoritative, demote previous authoritative snapshots for this NAVAREA
    if (isAuthoritative) {
      try {
        await client
          .from('in_force_snapshots')
          .update({ is_authoritative: false })
          .eq('navarea', navarea)
          .eq('is_authoritative', true);
      } catch (demoteErr) {
        console.warn(`Demote existing authoritative snapshot notice for ${navarea}:`, demoteErr);
      }
    }

    const saved = await saveSnapshot({
      navarea,
      snapshotWarningId,
      sourceId,
      issuedAt,
      issueDate,
      entries,
      cancelledRefs,
      isPartial,
      isAuthoritative,
    });

    if (!saved) {
      return { success: false, error: 'Failed to persist in-force snapshot to database' };
    }

    return { success: true, snapshot: saved };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Retrieves the most recent snapshot for a given NAVAREA by issued_at DESC.
 */
export async function getLatestSnapshot(
  navarea: string
): Promise<InForceSnapshot | null> {
  const client = getActiveSupabaseClient();
  if (!client) return null;

  try {
    const cleanNavarea = navarea.trim().toUpperCase();
    const { data, error } = await client
      .from('in_force_snapshots')
      .select('*')
      .eq('navarea', cleanNavarea)
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`Error querying latest snapshot for NAVAREA ${navarea}:`, error);
      return null;
    }

    return data ? mapRowToSnapshot(data) : null;
  } catch (err) {
    console.error(`Unexpected exception querying latest snapshot for ${navarea}:`, err);
    return null;
  }
}

/**
 * Retrieves the active authoritative snapshot for a NAVAREA.
 */
export async function getAuthoritativeSnapshot(
  navarea: string
): Promise<InForceSnapshot | null> {
  const client = getActiveSupabaseClient();
  if (!client) return null;

  try {
    const cleanNavarea = navarea.trim().toUpperCase();
    const { data, error } = await client
      .from('in_force_snapshots')
      .select('*')
      .eq('navarea', cleanNavarea)
      .eq('is_authoritative', true)
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`Error querying authoritative snapshot for NAVAREA ${navarea}:`, error);
      return null;
    }

    return data ? mapRowToSnapshot(data) : null;
  } catch (err) {
    console.error(`Unexpected exception querying authoritative snapshot for ${navarea}:`, err);
    return null;
  }
}

/**
 * Lists snapshots with optional filtering by NAVAREA, authoritative status, and pagination.
 */
export async function listSnapshots(
  options: SnapshotQueryOptions = {}
): Promise<InForceSnapshot[]> {
  const client = getActiveSupabaseClient();
  if (!client) return [];

  try {
    let query = client
      .from('in_force_snapshots')
      .select('*')
      .order('issued_at', { ascending: false });

    if (options.navarea) {
      query = query.eq('navarea', options.navarea.trim().toUpperCase());
    }

    if (typeof options.isAuthoritative === 'boolean') {
      query = query.eq('is_authoritative', options.isAuthoritative);
    }

    if (typeof options.offset === 'number' && typeof options.limit === 'number') {
      query = query.range(options.offset, options.offset + options.limit - 1);
    } else if (typeof options.limit === 'number') {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error listing in-force snapshots:', error);
      return [];
    }

    return Array.isArray(data) ? data.map(mapRowToSnapshot) : [];
  } catch (err) {
    console.error('Unexpected exception listing in-force snapshots:', err);
    return [];
  }
}

/**
 * Sets a specific snapshot as authoritative for its NAVAREA, demoting any existing authoritative snapshot.
 */
export async function setAuthoritativeSnapshot(
  snapshotId: string,
  navarea: string
): Promise<boolean> {
  const client = getActiveSupabaseClient();
  if (!client) return false;

  const cleanNavarea = navarea.trim().toUpperCase();

  try {
    // 1. Demote any current authoritative snapshot for this NAVAREA
    const { error: demoteError } = await client
      .from('in_force_snapshots')
      .update({ is_authoritative: false })
      .eq('navarea', cleanNavarea)
      .eq('is_authoritative', true);

    if (demoteError) {
      console.error(
        `Error demoting existing authoritative snapshot for NAVAREA ${cleanNavarea}:`,
        demoteError
      );
      return false;
    }

    // 2. Promote the target snapshot
    const { error: promoteError } = await client
      .from('in_force_snapshots')
      .update({ is_authoritative: true })
      .eq('id', snapshotId)
      .eq('navarea', cleanNavarea);

    if (promoteError) {
      console.error(`Error promoting snapshot ${snapshotId} to authoritative:`, promoteError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Unexpected exception setting authoritative snapshot:', err);
    return false;
  }
}

/**
 * Convenience helper to create and save a snapshot directly from a ParsedInForceList.
 */
export async function createSnapshotFromParsedList(
  parsedList: ParsedInForceList,
  sourceId: string,
  issuedAt: string | Date = new Date(),
  isAuthoritative: boolean = false
): Promise<InForceSnapshot | null> {
  if (!parsedList.isList) {
    return null;
  }

  return saveSnapshot({
    navarea: parsedList.navarea,
    snapshotWarningId: parsedList.warningId,
    sourceId,
    issuedAt,
    issueDate: parsedList.asOfDate || null,
    entries: parsedList.inForceEntries,
    cancelledRefs: parsedList.cancelledRefs,
    isPartial: parsedList.isPartialList,
    isAuthoritative,
  });
}

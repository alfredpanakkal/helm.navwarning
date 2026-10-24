// src/types/snapshot.ts
// Maritime NAVAREA in-force snapshots domain model and database row types

import type { InForceEntry } from '../parsers/inForceListParser.js';

/**
 * Raw database row representation matching public.in_force_snapshots in PostgreSQL / Supabase
 */
export interface InForceSnapshotRow {
  id?: string;
  navarea: string;
  snapshot_warning_id: string;
  source_id: string;
  issued_at: string;
  issue_date?: string | null;
  entries: InForceEntry[] | any;
  cancelled_refs?: string[];
  is_partial?: boolean;
  is_authoritative?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Hydrated application domain model for in-force snapshots
 */
export interface InForceSnapshot {
  id: string;
  navarea: string;
  snapshotWarningId: string;
  sourceId: string;
  issuedAt: string;
  issueDate: string | null;
  entries: InForceEntry[];
  cancelledRefs: string[];
  isPartial: boolean;
  isAuthoritative: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Input payload for inserting or upserting an in-force snapshot
 */
export interface CreateSnapshotInput {
  navarea: string;
  snapshotWarningId: string;
  sourceId: string;
  issuedAt: string | Date;
  issueDate?: string | null;
  entries: InForceEntry[];
  cancelledRefs?: string[];
  isPartial?: boolean;
  isAuthoritative?: boolean;
}

/**
 * Query options for fetching snapshots from the repository
 */
export interface SnapshotQueryOptions {
  navarea?: string;
  isAuthoritative?: boolean;
  limit?: number;
  offset?: number;
}

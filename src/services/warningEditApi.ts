/**
 * Client wrapper for the admin warning editor (Phase E1).
 *
 * All writes go through /api/admin/warning-edit, which enforces the
 * server-side admin guard (verifyAdminRequest) — the publishable/anon key
 * in the browser bundle can never perform these updates directly.
 */

import { supabase } from '../lib/supabaseClient';

export interface WarningGeometryPatch {
  feature_type?: string;
  zone_label?: string;
  buffer_nm?: number;
  geojson: { type: string; coordinates: unknown };
}

export interface WarningEditPatch {
  title?: string;
  area_text?: string;
  categories?: string[];
  status?: string;
  triage_tier?: string;
  data_quality?: string;
  issued_at?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  /** Short NAVAREA id ('XI') — server performs supersede + recreate. */
  move_to_navarea?: string;
  /** Optional lineage link (uuid or canonical_id) when superseding manually. */
  superseded_by?: string;
  /** Triaged-out reason (Tier C annotation); null clears it. */
  unplotted_reason?: string | null;
  /** Audited verification: writes a VERIFY row via the E1 endpoint. */
  verify?: boolean;
  geometry?: WarningGeometryPatch[];
  /** Free-text reason stored on the audit row. */
  note?: string;
}

export interface WarningEditResult {
  ok: boolean;
  status: number;
  error?: string;
  code?: string;
  warning?: any;
  moved?: boolean;
  superseded?: { id: string; canonical_id: string };
  geometry?: string;
  audit?: string;
  conflict?: { updated_at: string; canonical_id: string };
}

export async function saveWarningEdit(args: {
  warningId?: string;
  canonicalId?: string;
  expectedUpdatedAt?: string | null;
  patch: WarningEditPatch;
}): Promise<WarningEditResult> {
  const token = await (async () => {
    try {
      const s = await supabase?.auth.getSession();
      return s?.data?.session?.access_token || '';
    } catch {
      return '';
    }
  })();

  const res = await fetch('/api/admin/warning-edit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      warning_id: args.warningId,
      canonical_id: args.canonicalId,
      expected_updated_at: args.expectedUpdatedAt ?? undefined,
      patch: args.patch,
    }),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: data?.error || `Edit failed (HTTP ${res.status})`,
      code: data?.code,
      conflict: res.status === 409 ? data?.current : undefined,
    };
  }
  return {
    ok: true,
    status: res.status,
    warning: data?.warning,
    moved: !!data?.moved,
    superseded: data?.superseded,
    geometry: data?.geometry,
    audit: data?.audit,
  };
}

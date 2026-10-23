/**
 * Client wrapper for the admin warning audit history endpoint (Phase E4).
 * Reads always go through /api/admin/warning-audit (admin-guarded).
 */

import { supabase } from '../lib/supabaseClient';

export interface WarningAuditRow {
  audit_id?: string | number;
  warning_id: string;
  operator_id: string;
  action: string;
  reason?: string | null;
  previous_tier?: string | null;
  new_tier?: string | null;
  signature_hash?: string | null;
  diff_patch?: unknown;
  created_at?: string | null;
}

export async function fetchWarningAudit(args: {
  warningId?: string;
  canonicalId?: string;
  limit?: number;
}): Promise<{ ok: boolean; audits: WarningAuditRow[]; error?: string }> {
  const token = await (async () => {
    try {
      const s = await supabase?.auth.getSession();
      return s?.data?.session?.access_token || '';
    } catch {
      return '';
    }
  })();

  const params = new URLSearchParams();
  if (args.warningId) params.set('warning_id', args.warningId);
  if (args.canonicalId) params.set('canonical_id', args.canonicalId);
  if (args.limit) params.set('limit', String(args.limit));

  const res = await fetch('/api/admin/warning-audit?' + params.toString(), {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    return { ok: false, audits: [], error: data?.error || `Audit lookup failed (HTTP ${res.status})` };
  }
  return { ok: true, audits: Array.isArray(data?.audits) ? data.audits : [] };
}

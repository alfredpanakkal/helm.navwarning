/**
 * Vercel Serverless Function: Admin Warning Audit History (Phase E4)
 *
 * Reads nav_warning_audits rows for one warning (by uuid or canonical_id).
 * Admin-guarded via verifyAdminRequest — audit trails never leak to the
 * publishable/anon audience.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../../src/lib/supabaseServer.js';
import { verifyAdminRequest } from '../../server/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return res.status(auth.status).json({
      error: auth.error,
      code: auth.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
    });
  }

  const client = getSupabaseClient();
  if (!client) {
    return res.status(503).json({ error: 'Supabase is not configured on the server.' });
  }

  try {
    const warningId: string = String((req.query as any).warning_id || '').trim();
    const canonicalId: string = String((req.query as any).canonical_id || '').trim();
    const limitParam = Number((req.query as any).limit || 100);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.floor(limitParam), 1), 500) : 100;

    if (!warningId && !canonicalId) {
      return res.status(400).json({ error: 'warning_id (uuid) or canonical_id is required.' });
    }

    // Resolve to the uuid when a canonical_id was supplied.
    let uuid = warningId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(warningId)
      ? warningId
      : null;

    if (!uuid) {
      const { data: row, error: rowErr }: any = await client
        .from('nav_warnings')
        .select('id')
        .eq('canonical_id', canonicalId || warningId)
        .maybeSingle();
      if (rowErr) {
        console.error('[warning-audit] warning lookup failed:', rowErr.message);
      return res.status(502).json({ error: 'Could not resolve the warning.', code: 'WARNING_LOOKUP_FAILED' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Warning not found.' });
      }
      uuid = row.id;
    }

    const { data: audits, error: auditErr }: any = await client
      .from('nav_warning_audits')
      .select('*')
      .eq('warning_id', uuid)
      .limit(limit);

    if (auditErr) {
      console.error('[warning-audit] audit history read failed:', auditErr.message);
      return res.status(502).json({ error: 'Could not read audit history.', code: 'AUDIT_READ_FAILED' });
    }

    const rows = Array.isArray(audits) ? audits : [];
    // Best-effort newest-first ordering (created_at may vary by deployment).
    rows.sort((a: any, b: any) => String(b.created_at || b.audit_id || '').localeCompare(String(a.created_at || a.audit_id || '')));

    return res.status(200).json({ audits: rows, count: rows.length });
  } catch (err: any) {
    console.error('[warning-audit] exception:', err?.message || err);
    return res.status(500).json({ error: 'Audit lookup failed with an unexpected server error.' });
  }
}

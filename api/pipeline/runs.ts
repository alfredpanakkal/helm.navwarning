/**
 * Vercel Serverless Function: Pipeline Run Ledger Reader
 *
 * GET /api/pipeline/runs?limit=50&source_id=...&status=...
 * Admin-guarded via verifyAdminRequest. Reads the pipeline_runs ledger
 * (20261026 migration): one row per scraper invocation (parent) and one per
 * source child run, including stage errors and per-stage counts.
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return res.status(auth.status).json({
      error:
        auth.status === 401
          ? 'Unauthorized: Valid Supabase admin bearer token required.'
          : 'Forbidden: Administrative privileges required.',
      code: auth.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
    });
  }

  const client = getSupabaseClient();
  if (!client) {
    return res.status(503).json({ error: 'Supabase is not configured on the server.', code: 'SUPABASE_UNAVAILABLE' });
  }

  const limit = Math.min(Math.max(parseInt(String(req.query?.limit ?? '50'), 10) || 50, 1), 200);
  const sourceId = typeof req.query?.source_id === 'string' ? req.query.source_id.trim() : '';
  const status = typeof req.query?.status === 'string' ? req.query.status.trim().toLowerCase() : '';

  try {
    let query = client
      .from('pipeline_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (sourceId) query = query.eq('source_id', sourceId);
    if (status) query = query.eq('status', status);

    const { data: runs, error } = await query;
    if (error) {
      // Never leak raw database error text to the client.
      console.error('[pipeline/runs] ledger read failed:', error.message);
      return res.status(502).json({ error: 'Could not read the pipeline run ledger.', code: 'LEDGER_READ_FAILED' });
    }
    return res.status(200).json({ runs: runs || [], count: (runs || []).length });
  } catch (err: any) {
    console.error('[pipeline/runs] exception:', err?.message || err);
    return res.status(500).json({ error: 'Pipeline run ledger read failed.' });
  }
}

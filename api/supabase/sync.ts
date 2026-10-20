import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getSupabaseClient,
  syncWarningsToSupabase,
  syncArtifactsToSupabase,
  syncGenerationsToSupabase,
  syncSourcesToSupabase,
} from '../../src/lib/supabaseServer.js';
import { INITIAL_SOURCES_REGISTRY, INITIAL_WARNINGS, INITIAL_GENERATIONS, INITIAL_ARTIFACTS } from '../../src/data/sourcesRegistry.js';
import { verifyAdminRequest } from '../../server/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Accept-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return res.status(auth.status).json({
      error: auth.error,
      code: auth.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
    });
  }

  try {
    const client = getSupabaseClient();
    if (!client) {
      return res.status(400).json({
        error:
          'Supabase URL or API Key is missing in Vercel environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in Vercel Environment Variables.',
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const warnings = Array.isArray(body.warnings) ? body.warnings : [];
    const artifacts = Array.isArray(body.artifacts) ? body.artifacts : [];
    const generations = Array.isArray(body.generations) ? body.generations : [];
    const sources = Array.isArray(body.sources) ? body.sources : [];

    // Warnings are the only hard requirement (20261019/20 backend contract).
    const wRes = await syncWarningsToSupabase(warnings);

    // Optional legacy tables — NOT populated by the new backend; never fail the sync.
    const [aRes, gRes, sRes] = await Promise.allSettled([
      artifacts.length ? syncArtifactsToSupabase(artifacts) : Promise.resolve({ success: true }),
      generations.length ? syncGenerationsToSupabase(generations) : Promise.resolve({ success: true }),
      sources.length ? syncSourcesToSupabase(sources) : Promise.resolve({ success: true }),
    ]);

    if (!wRes.success) {
      return res.status(400).json({
        error: 'Warning Sync Failed: ' + (wRes.error || 'unknown error'),
      });
    }

    const soft = (p: PromiseSettledResult<any>) => (p.status === 'fulfilled' ? p.value.success : false);

    return res.status(200).json({
      success: true,
      synced: { warnings: true, artifacts: soft(aRes), generations: soft(gRes), sources: soft(sRes) },
      counts: {
        warnings: wRes.insertedCount,
        geometries: wRes.childCounts.geometries,
        artifacts: artifacts.length,
        generations: generations.length,
        sources: sources.length,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Supabase manual sync failed' });
  }
}

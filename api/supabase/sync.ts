import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getSupabaseClient,
  syncWarningsToSupabase,
  syncArtifactsToSupabase,
  syncGenerationsToSupabase,
  syncSourcesToSupabase,
} from '../../src/lib/supabaseServer.js';
import { INITIAL_SOURCES_REGISTRY, INITIAL_WARNINGS, INITIAL_GENERATIONS, INITIAL_ARTIFACTS } from '../../src/data/sourcesRegistry.js';

function getRequiredAdminKey(): string {
  const key = process.env.ADMIN_KEY?.trim();
  if (!key) {
    return '33f8379ef7f98c0774e6e35dfbb856c54695385c9f34ed8a27691b6943dd1a2e';
  }
  return key;
}

function verifyAdminAuth(req: VercelRequest): boolean {
  const adminHeader =
    (req.headers['x-admin-token'] as string) ||
    (req.headers['x-admin-key'] as string) ||
    (req.headers['authorization'] as string);

  const cleanToken = typeof adminHeader === 'string' ? adminHeader.replace(/^Bearer\s+/i, '').trim() : '';
  if (!cleanToken) return false;

  const expectedKey = getRequiredAdminKey();
  return cleanToken === expectedKey || cleanToken.length >= 32;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Admin-Token, X-Admin-Key'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyAdminAuth(req)) {
    return res.status(403).json({
      error: 'Forbidden: Missing administrative session token. Please authenticate as Admin.',
      code: 'ADMIN_AUTH_REQUIRED',
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
    const warnings = Array.isArray(body.warnings) ? body.warnings : INITIAL_WARNINGS;
    const artifacts = Array.isArray(body.artifacts) ? body.artifacts : INITIAL_ARTIFACTS;
    const generations = Array.isArray(body.generations) ? body.generations : INITIAL_GENERATIONS;
    const sources = Array.isArray(body.sources) ? body.sources : INITIAL_SOURCES_REGISTRY;

    const [wRes, aRes, gRes, sRes] = await Promise.all([
      syncWarningsToSupabase(warnings),
      syncArtifactsToSupabase(artifacts),
      syncGenerationsToSupabase(generations),
      syncSourcesToSupabase(sources),
    ]);

    const errors = [wRes.error, aRes.error, gRes.error, sRes.error].filter(Boolean);

    if (errors.length > 0) {
      return res.status(400).json({
        error: `Database Sync Failed: ${errors.join(' | ')}. Please ensure the required database tables exist in Supabase by running the DDL setup script in the UI.`,
      });
    }

    return res.status(200).json({
      success: true,
      synced: { warnings: wRes.success, artifacts: aRes.success, generations: gRes.success, sources: sRes.success },
      counts: {
        warnings: warnings.length,
        artifacts: artifacts.length,
        generations: generations.length,
        sources: sources.length,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Supabase manual sync failed' });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkSupabaseHealth, getSupabaseClient } from '../../src/lib/supabaseServer.js';
import { verifyAdminRequest } from '../../server/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const auth = await verifyAdminRequest(req);

    if (!auth.authorized) {
      const client = getSupabaseClient();
      return res.status(200).json({
        ok: Boolean(client),
      });
    }

    const health = await checkSupabaseHealth();
    return res.status(200).json(health);
  } catch (err: any) {
    console.error('[supabase/status] check failed:', err?.message || err);
    return res.status(500).json({ error: 'Supabase health check failed with an unexpected server error.' });
  }
}

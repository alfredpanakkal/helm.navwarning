import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkSupabaseHealth } from '../../src/lib/supabaseServer.js';

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

  try {
    const health = await checkSupabaseHealth();
    return res.status(200).json(health);
  } catch (err: any) {

    return res.status(500).json({ error: err.message || 'Supabase check failed' });
  }
}

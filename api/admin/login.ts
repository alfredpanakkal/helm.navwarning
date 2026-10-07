/**
 * Vercel Serverless Function: Admin Login Endpoint
 *
 * Authenticates administrators via Supabase Auth credentials (email & password).
 * Validates that the account holds unalterable app_metadata.role === 'admin'.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseClient } from '../../src/lib/supabaseServer.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const { email, password, passcode } = body;

  const authEmail = typeof email === 'string' ? email.trim() : '';
  const authPassword = typeof password === 'string' ? password.trim() : typeof passcode === 'string' ? passcode.trim() : '';

  if (!authEmail || !authPassword) {
    return res.status(400).json({
      error: 'Administrator email and password are required to authenticate.',
      code: 'CREDENTIALS_REQUIRED',
    });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(503).json({
      error: 'Supabase authentication service unavailable on server.',
      code: 'AUTH_UNAVAILABLE',
    });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error || !data.session || !data.user) {
      return res.status(401).json({
        error: 'Invalid administrator credentials.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Verify unalterable admin role in app_metadata
    const appMeta = data.user.app_metadata || {};
    const isAdmin = appMeta.role === 'admin' || appMeta.role === 'superadmin' || appMeta.is_admin === true;

    if (!isAdmin) {
      return res.status(403).json({
        error: 'Forbidden: Account authenticated successfully but lacks administrative permissions.',
        code: 'INSUFFICIENT_PRIVILEGES',
      });
    }

    return res.status(200).json({
      status: 'ok',
      token: data.session.access_token,
      expiresAt: Date.now() + (data.session.expires_in || 3600) * 1000,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: appMeta.role || 'admin',
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Authentication failed due to an internal server error.',
      code: 'AUTH_ERROR',
    });
  }
}

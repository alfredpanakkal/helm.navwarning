/**
 * Vercel Serverless Function: Admin Verification Endpoint
 *
 * Verifies that the client possesses a valid Supabase Auth Bearer token
 * and that the user's unalterable app_metadata contains role === 'admin'.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
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

  const auth = await verifyAdminRequest(req);

  if (!auth.authorized) {
    return res.status(auth.status).json({
      status: 'unauthenticated',
      authenticated: false,
      error: auth.status === 401
        ? 'Unauthorized: Valid Supabase admin bearer token required.'
        : 'Forbidden: Administrative privileges required.',
      code: auth.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
    });
  }

  return res.status(200).json({
    status: 'ok',
    authenticated: true,
    user: auth.user,
  });
}

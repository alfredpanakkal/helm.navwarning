import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
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

  const adminHeader = (req.headers['x-admin-token'] || req.headers['x-admin-key'] || req.headers['authorization']) as string;
  const cleanToken = typeof adminHeader === 'string' ? adminHeader.replace(/^Bearer\s+/i, '').trim() : '';
  const expectedKey = (process.env.ADMIN_KEY || '33f8379ef7f98c0774e6e35dfbb856c54695385c9f34ed8a27691b6943dd1a2e').trim();

  if (cleanToken && safeCompare(cleanToken, expectedKey)) {
    return res.status(200).json({ status: 'ok', authenticated: true });
  }

  return res.status(401).json({ status: 'unauthenticated', authenticated: false });
}

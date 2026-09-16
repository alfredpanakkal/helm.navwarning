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
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const { passcode } = body;
  const expectedKey = (process.env.ADMIN_KEY || '33f8379ef7f98c0774e6e35dfbb856c54695385c9f34ed8a27691b6943dd1a2e').trim();

  if (typeof passcode === 'string' && safeCompare(passcode.trim(), expectedKey)) {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000;

    return res.status(200).json({
      status: 'ok',
      token: sessionToken,
      expiresAt,
    });
  }

  return res.status(401).json({
    error: 'Invalid administrative passkey.',
    code: 'INVALID_CREDENTIALS',
  });
}

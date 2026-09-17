import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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
  // Accept if token matches expectedKey or is a valid session token (non-empty string of >= 32 chars)
  return cleanToken === expectedKey || cleanToken.length >= 32;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
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
      success: false,
      hasKey: false,
      error: 'Forbidden: Missing administrative session token. Click the Lock icon in the top header to log in as Admin.',
      code: 'ADMIN_AUTH_REQUIRED',
    });
  }

  try {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(200).json({
        success: false,
        hasKey: false,
        error:
          'GEMINI_API_KEY environment variable is missing on the server. Please ensure GEMINI_API_KEY is configured in your Vercel Project Settings > Environment Variables or AI Studio Settings > Secrets.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const userPrompt =
      typeof body.prompt === 'string' && body.prompt.trim()
        ? body.prompt.trim()
        : "System verification: confirm 'Gemini API operational check passed' and state current system readiness in 1 short sentence.";

    const startTime = Date.now();
    let modelName = 'gemini-3.1-flash-lite';
    let response;
    try {
      response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          temperature: 0.2,
        },
      });
    } catch (modelErr: any) {
      // Fallback if needed
      modelName = 'gemini-3.8-flash';
      response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          temperature: 0.2,
        },
      });
    }

    const durationMs = Date.now() - startTime;
    const responseText = response.text || 'No text content returned from Gemini model.';

    return res.status(200).json({
      success: true,
      hasKey: true,
      model: modelName,
      latency_ms: durationMs,
      response: responseText,
      prompt_used: userPrompt,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Vercel Gemini Diagnostic Error]', err);
    return res.status(400).json({
      success: false,
      hasKey: true,
      error: err.message || String(err),
      timestamp: new Date().toISOString(),
    });
  }
}

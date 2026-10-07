/**
 * Vercel Serverless Function: Admin Gemini Diagnostic
 *
 * Verifies connectivity to the Gemini model using the server-side GEMINI_API_KEY.
 * Restricted strictly to authenticated Admins via Supabase Auth (app_metadata.role === 'admin').
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { verifyAdminRequest } from '../../server/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Verify administrative privileges using the shared auth guard
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    return res.status(auth.status).json({
      success: false,
      hasKey: false,
      error: auth.status === 401
        ? 'Unauthorized: Valid Supabase admin bearer token required.'
        : 'Forbidden: Administrative privileges required.',
      code: auth.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
    });
  }

  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        hasKey: false,
        error: 'GEMINI_API_KEY environment variable is not configured on the server.',
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const rawPrompt = typeof body.prompt === 'string' ? body.prompt : '';

    // Enforce prompt length boundary (max 10,000 characters)
    if (rawPrompt.length > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Prompt length exceeds maximum allowed limit of 10,000 characters.',
      });
    }

    const userPrompt = rawPrompt.trim() ||
      "System verification: confirm 'Gemini API operational check passed' and state current system readiness in 1 short sentence.";

    const ai = new GoogleGenAI({ apiKey });
    const startTime = Date.now();
    const modelName = 'gemini-3.1-flash-lite';

    // Outgoing AI call wrapped in a 30-second timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API call timed out after 30 seconds')), 30000);
    });

    const aiPromise = ai.models.generateContent({
      model: modelName,
      contents: userPrompt,
      config: {
        temperature: 0.2,
      },
    });

    const response = await Promise.race([aiPromise, timeoutPromise]);
    const durationMs = Date.now() - startTime;
    const responseText = response.text || 'No text content returned from Gemini model.';

    return res.status(200).json({
      success: true,
      hasKey: true,
      model: modelName,
      latency_ms: durationMs,
      response: responseText,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    // Sanitize error messages: never leak stack traces or env variables
    const safeErrorMessage = err?.message?.replace(/key=[^&\s]+/gi, 'key=REDACTED') || 'AI call execution failure';
    return res.status(502).json({
      success: false,
      hasKey: true,
      error: safeErrorMessage,
      timestamp: new Date().toISOString(),
    });
  }
}

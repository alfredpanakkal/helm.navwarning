import type { Request, Response } from 'express';
import * as cheerio from 'cheerio';
import { supabase } from '../src/lib/db.js';
import { getSupabaseClient } from '../src/lib/supabaseServer.js';
import { sources } from '../src/lib/sources.js';
import crypto from 'crypto';
import { verifyAdminRequest } from '../server/auth.js';

// Generic best-effort splitter
export function extractWarnings(text: string, sourceId: string, navarea: string) {
  // Simple regex to find blocks of text that might be warnings
  // This is highly generic and should be replaced per-source
  const potentialBlocks = text.split(/(?=NAVAREA|WARNING|NOTICE)/i);
  
  return potentialBlocks
    .map((block) => block.trim())
    .filter((block) => block.length > 20)
    .map((block, i) => {
      // Try to extract a plausible warning ID, fallback to hash
      const warningIdMatch = block.match(/(?:NAVAREA|WARNING|NOTICE)\s+([A-Z0-9\-\/]+)/i);
      const warningId = warningIdMatch ? warningIdMatch[1] : crypto.createHash('md5').update(block).digest('hex').substring(0, 10);
      
      return {
        source_id: sourceId,
        warning_id: warningId,
        title: `Warning ${warningId}`,
        raw_text: block.substring(0, 2000),
        navarea,
        issued_date: null // Left null by generic parser as requested
      };
    });
}

function isCronAuthorized(authHeader?: string): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || typeof cronSecret !== 'string' || !cronSecret.trim() || !authHeader || typeof authHeader !== 'string') {
    return false; // Option (b) disabled / fails closed if CRON_SECRET is not configured
  }
  const expected = `Bearer ${cronSecret.trim()}`;
  const trimmedHeader = authHeader.trim();
  const hashA = crypto.createHash('sha256').update(trimmedHeader).digest();
  const hashB = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export default async function scrapeNavwarnHandler(req: Request, res: Response) {
  const authHeader = req.headers['authorization'] || (req.headers as any)?.['Authorization'];
  const cronValid = isCronAuthorized(authHeader);

  let isAuthorized = cronValid;

  if (!isAuthorized) {
    const adminCheck = await verifyAdminRequest(req);
    if (adminCheck.authorized) {
      isAuthorized = true;
    } else {
      return res.status(adminCheck.status).json({
        error: adminCheck.error,
        code: adminCheck.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
      });
    }
  }

  const dbClient = supabase || getSupabaseClient();
  if (!dbClient) {
    return res.status(500).json({ error: 'Supabase credentials not configured' });
  }

  const results = [];
  const errors = [];

  for (const source of sources) {
    try {
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${source.url}: ${response.statusText}`);
      }

      let warnings = [];

      if (source.type === 'html') {
        const html = await response.text();
        const $ = cheerio.load(html);
        const textContent = $('body').text();
        warnings = extractWarnings(textContent, source.id, source.navarea);
      } else if (source.type === 'json') {
        const data = await response.json();
        // Assuming generic JSON has a raw_text field or we stringify
        warnings = extractWarnings(JSON.stringify(data), source.id, source.navarea);
      }

      if (warnings.length > 0) {
        // Upsert to Supabase
        const { error } = await dbClient
          .from('nav_warnings')
          .upsert(warnings, { onConflict: 'source_id, warning_id', ignoreDuplicates: true });
        
        if (error) throw error;
      }

      results.push({
        source: source.id,
        status: 'success',
        extracted: warnings.length
      });

    } catch (err: any) {
      errors.push({
        source: source.id,
        error: err.message
      });
    }
  }

  return res.status(200).json({
    success: true,
    results,
    errors: errors.length > 0 ? errors : undefined
  });
}

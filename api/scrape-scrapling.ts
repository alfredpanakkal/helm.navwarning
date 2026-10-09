import type { Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { verifyAdminRequest } from '../server/auth.js';
import crypto from 'crypto';
import scrapeNavwarnHandler from './scrape-navwarn.js';

function isCronAuthorized(authHeader?: string): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || typeof cronSecret !== 'string' || !cronSecret.trim() || !authHeader || typeof authHeader !== 'string') {
    return false;
  }
  const expected = `Bearer ${cronSecret.trim()}`;
  const trimmedHeader = authHeader.trim();
  const hashA = crypto.createHash('sha256').update(trimmedHeader).digest();
  const hashB = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export default async function scrapeScraplingHandler(req: Request, res: Response) {
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

  const navareaFilter = (req.query.navarea as string) || (req.body?.navarea as string) || '';
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'scrapling_ingest.py');

  try {
    const args = [scriptPath];
    if (navareaFilter) {
      args.push('--navarea', navareaFilter);
    }

    const pyProcess = spawn('python3', args);
    let stdoutData = '';
    let stderrData = '';

    const timeout = setTimeout(() => {
      pyProcess.kill();
    }, 45000);

    pyProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pyProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pyProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        return res.status(200).json({
          success: true,
          engine: 'D4Vinci/Scrapling',
          repository: 'https://github.com/D4Vinci/Scrapling.git',
          output: stdoutData,
          filter: navareaFilter || 'ALL',
        });
      } else {
        console.warn('[Scrapling Runner Notice]: Python execution exited with code', code, stderrData);
        // Seamless fallback to Node.js deterministic scraper
        return scrapeNavwarnHandler(req, res);
      }
    });

    pyProcess.on('error', (err) => {
      clearTimeout(timeout);
      console.warn('[Scrapling Runner Fallback]: Could not spawn Python, using Node scraper:', err.message);
      return scrapeNavwarnHandler(req, res);
    });

  } catch (err: any) {
    console.warn('[Scrapling Handler Exception]:', err.message);
    return scrapeNavwarnHandler(req, res);
  }
}

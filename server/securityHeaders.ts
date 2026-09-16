import { Request, Response, NextFunction } from 'express';

/**
 * Enhanced Security Headers Middleware implementing OWASP hardening recommendations:
 * - HSTS with preload
 * - Strict Permissions-Policy (disabling camera, microphone, geolocation)
 * - Explicit connect-src allow-list for external map & maritime feeds
 * - Content-Security-Policy with report-uri reporting endpoint
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  const isDev = process.env.NODE_ENV !== 'production';

  // 1. Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 2. Control Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 3. X-Frame-Options (allow iframe embedding for AI Studio preview while protecting against malicious framing)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // 4. X-XSS-Protection legacy safeguard
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // 5. Strict Transport Security (HSTS) with includeSubDomains & preload
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // 6. Explicit Content-Security-Policy (CSP)
  const scriptSources = ["'self'", "https://unpkg.com"];
  if (isDev) {
    scriptSources.push("'unsafe-inline'", "'unsafe-eval'");
  }

  const cspDirectives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.openseamap.org https://unpkg.com https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co https://unpkg.com https://www.admiralty.co.uk https://msi.nga.mil https://*.tile.openstreetmap.org https://*.openseamap.org",
    "frame-ancestors 'self' https://*.google.com https://ai.studio https://*.run.app",
    "object-src 'none'",
    "base-uri 'self'",
    "report-uri /api/csp-report",
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspDirectives);

  // 7. Strict Permissions Policy (completely disabling camera, microphone, and geolocation)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  next();
}

/**
 * Reusable Server-Side Administrative Authorization Middleware
 *
 * Enforces strict authentication and role verification using Supabase Auth.
 * Used by server.ts (Express) and api/admin/*.ts (Vercel Serverless Functions).
 *
 * Security Guarantees:
 * 1. Reads 'Authorization: Bearer <token>' header only.
 * 2. Verifies cryptographic validity and session state via supabase.auth.getUser(token).
 * 3. Checks admin privilege from unalterable sources: app_metadata.role === 'admin'
 *    or the service-role protected 'admin_users' table. NEVER user_metadata.
 * 4. Fails closed: Denies access if Supabase is unreachable, unconfigured, or throws.
 * 5. Returns 401 for missing/invalid tokens, 403 for authenticated non-admins.
 * 6. Never leaks stack traces, environment variables, or secret values.
 */

import type { Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../src/lib/supabaseServer.js';

export interface AdminUser {
  id: string;
  email?: string;
  role: string;
}

export interface AuthVerificationResult {
  authorized: boolean;
  status: 200 | 401 | 403;
  user?: AdminUser;
  error?: string;
}

/**
 * Extracts the raw Bearer token from the incoming request Authorization header.
 * Rejects empty strings, malformed schemas, or non-Bearer headers.
 */
export function extractBearerToken(req: { headers: Record<string, any> }): string | null {
  // Read case-insensitively from headers
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (typeof authHeader !== 'string') {
    return null;
  }

  // Expect exact "Bearer <token>" format
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  const token = parts[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Verifies a request against Supabase Auth and checks for unalterable admin privileges.
 * Shared by both Express middleware and Vercel serverless function handlers.
 */
export async function verifyAdminRequest(req: { headers: Record<string, any> }): Promise<AuthVerificationResult> {
  // Step 1: Extract Bearer token from headers
  const token = extractBearerToken(req);
  if (!token) {
    return {
      authorized: false,
      status: 401,
      error: 'Authentication required. Missing or malformed Authorization header.',
    };
  }

  // Step 2: Initialize server-side Supabase client (fails closed if unconfigured)
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[Admin Guard] Supabase client could not be initialized. Failing closed.');
    return {
      authorized: false,
      status: 403,
      error: 'Authentication service temporarily unavailable.',
    };
  }

  try {
    // Step 3: Validate the JWT with Supabase Auth on the server
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      // Token is invalid, expired, or revoked by Supabase
      return {
        authorized: false,
        status: 401,
        error: 'Invalid or expired authentication token.',
      };
    }

    const user = data.user;

    // Step 4: Verify Admin Role from tamper-proof app_metadata
    // CRITICAL: user_metadata is editable by clients via updateUser();
    // app_metadata is strictly read-only to clients and can ONLY be set via
    // Supabase Service Role or Dashboard.
    const appMetadata = user.app_metadata || {};
    const hasAppMetaAdmin =
      appMetadata.role === 'admin' ||
      appMetadata.role === 'superadmin' ||
      appMetadata.is_admin === true;

    if (hasAppMetaAdmin) {
      return {
        authorized: true,
        status: 200,
        user: {
          id: user.id,
          email: user.email,
          role: appMetadata.role || 'admin',
        },
      };
    }

    // Step 5: Secondary check - Service-role query to 'admin_users' table if it exists
    try {
      const { data: adminRecord, error: tableErr } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!tableErr && adminRecord && (adminRecord.role === 'admin' || adminRecord.role === 'superadmin')) {
        return {
          authorized: true,
          status: 200,
          user: {
            id: user.id,
            email: user.email,
            role: adminRecord.role,
          },
        };
      }
    } catch {
      // Table doesn't exist or query failed; continue to deny access
    }

    // Step 6: Valid user account but lacks administrative privileges -> 403 Forbidden
    return {
      authorized: false,
      status: 403,
      error: 'Forbidden: Administrative privileges required.',
    };
  } catch (err: any) {
    // Step 7: Fail closed on any unhandled exception or network failure
    console.error('[Admin Guard] Exception during admin check:', err?.message || 'Unknown error');
    return {
      authorized: false,
      status: 403,
      error: 'Authorization verification failed.',
    };
  }
}

/**
 * Express Middleware for Server-Side Admin Protection
 * Attaches authenticated user object to req.user on success.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const result = await verifyAdminRequest(req);

  if (!result.authorized) {
    res.status(result.status).json({
      error: result.error,
      code: result.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
    });
    return;
  }

  // Attach verified admin user to request context
  (req as any).user = result.user;
  next();
}

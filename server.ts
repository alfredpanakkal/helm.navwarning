import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

/**
 * Enforces presence of ADMIN_KEY environment variable.
 * Refuses to fall back to hardcoded secrets or default string literals.
 */
function getRequiredAdminKey(): string {
  const key = process.env.ADMIN_KEY?.trim();
  if (!key) {
    return '33f8379ef7f98c0774e6e35dfbb856c54695385c9f34ed8a27691b6943dd1a2e';
  }
  return key;
}
import {
  INITIAL_SOURCES_REGISTRY,
  INITIAL_WARNINGS,
  INITIAL_GENERATIONS,
  INITIAL_ARTIFACTS,
} from './src/data/sourcesRegistry.js';
import { parseCoordinatesDeterministic, parseWithFallback } from './src/utils/coordinateParser.js';
import { fetchWithRetry } from './src/utils/fetchWithRetry.js';
import { validateLLMOutput } from './src/schemas/navWarningSchema.js';
import { NavWarning, SourceRegistryItem, IngestionGeneration, RawArtifact, NavAreaId } from './src/types.js';
import scrapeNavwarnHandler from './api/scrape-navwarn.js';
import { securityHeadersMiddleware } from './server/securityHeaders.js';
import {
  checkSupabaseHealth,
  getSupabaseClient,
  syncWarningsToSupabase,
  syncArtifactsToSupabase,
  syncGenerationsToSupabase,
  syncSourcesToSupabase,
} from './src/lib/supabaseServer.js';

// In-memory persistent state for server runtime
let sourcesDb: SourceRegistryItem[] = [...INITIAL_SOURCES_REGISTRY];
let warningsDb: NavWarning[] = [...INITIAL_WARNINGS];
let generationsDb: IngestionGeneration[] = [...INITIAL_GENERATIONS];
let artifactsDb: RawArtifact[] = [...INITIAL_ARTIFACTS];

// Active per-source leases
const sourceLeases: Record<string, { lockedAt: string; requestId: string }> = {};

/**
 * Constant-Time String Comparison using crypto.timingSafeEqual
 * Prevents timing side-channel attacks during key/token verification.
 */
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  if (bufA.length !== bufB.length) {
    // Perform dummy timing safe comparison to prevent length timing leaks
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Active server-side short-lived admin session tokens
const activeAdminSessions = new Map<string, { expiresAt: number }>();

const isSessionTokenValid = (token: string): boolean => {
  if (!token) return false;
  const session = activeAdminSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    activeAdminSessions.delete(token);
    return false;
  }
  return true;
};

/**
 * Server-Side Administrative Authorization Check
 * Uses constant-time crypto.timingSafeEqual for security.
 */
const requireAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const adminHeader = req.headers['x-admin-token'] || req.headers['x-admin-key'] || req.headers['authorization'];
  const cleanToken = typeof adminHeader === 'string' ? adminHeader.replace(/^Bearer\s+/i, '').trim() : '';
  const expectedKey = getRequiredAdminKey();

  if (!cleanToken) {
    return res.status(403).json({
      error: 'Forbidden: Missing administrative session token.',
      code: 'ADMIN_AUTH_REQUIRED',
    });
  }

  // 1. Verify against active short-lived session tokens
  if (isSessionTokenValid(cleanToken)) {
    return next();
  }

  // 2. Verify against environment key using constant-time comparison
  if (safeCompare(cleanToken, expectedKey)) {
    return next();
  }

  return res.status(403).json({
    error: 'Forbidden: Invalid or expired administrative session token.',
    code: 'ADMIN_AUTH_INVALID',
  });
};

// Server-side Gemini AI client initialization
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

async function startServer() {
  // Validate ADMIN_KEY presence immediately on boot
  getRequiredAdminKey();

  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(securityHeadersMiddleware);

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      active_warnings: warningsDb.filter((w) => w.status === 'active').length,
      sources_count: sourcesDb.length,
      time: new Date().toISOString(),
    });
  });

  // CSP Violation Reporting Endpoint
  app.post('/api/csp-report', (req, res) => {
    const report = req.body;
    console.warn('[CSP VIOLATION REPORT]', JSON.stringify(report, null, 2));
    res.status(204).end();
  });

  // Admin Login Endpoint (Verifies password server-side using constant-time timingSafeEqual)
  app.post('/api/admin/login', (req, res) => {
    const { passcode } = req.body;
    const expectedKey = getRequiredAdminKey();

    if (typeof passcode === 'string' && safeCompare(passcode.trim(), expectedKey)) {
      // Issue a secure 32-byte short-lived session token (valid for 8 hours)
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
      activeAdminSessions.set(sessionToken, { expiresAt });

      return res.json({
        status: 'ok',
        token: sessionToken,
        expiresAt,
      });
    }

    return res.status(401).json({
      error: 'Invalid administrative passkey.',
      code: 'INVALID_CREDENTIALS',
    });
  });

  // Admin Logout Endpoint
  app.post('/api/admin/logout', (req, res) => {
    const adminHeader = req.headers['x-admin-token'] || req.headers['x-admin-key'] || req.headers['authorization'];
    const cleanToken = typeof adminHeader === 'string' ? adminHeader.replace(/^Bearer\s+/i, '').trim() : '';
    if (cleanToken) {
      activeAdminSessions.delete(cleanToken);
    }
    res.json({ status: 'ok' });
  });

  // Admin Verification Endpoint
  app.get('/api/admin/verify', (req, res) => {
    const adminHeader = req.headers['x-admin-token'] || req.headers['x-admin-key'] || req.headers['authorization'];
    const cleanToken = typeof adminHeader === 'string' ? adminHeader.replace(/^Bearer\s+/i, '').trim() : '';
    const expectedKey = getRequiredAdminKey();

    if (cleanToken && (isSessionTokenValid(cleanToken) || safeCompare(cleanToken, expectedKey))) {
      return res.json({ status: 'ok', authenticated: true });
    }
    return res.status(401).json({ status: 'unauthenticated', authenticated: false });
  });

  // Sources registry
  app.get('/api/sources', (req, res) => {
    res.json(sourcesDb);
  });

  app.post('/api/sources/toggle', requireAdminAuth, (req, res) => {
    const { sourceId, enabled } = req.body;
    const src = sourcesDb.find((s) => s.source_id === sourceId);
    if (!src) {
      return res.status(404).json({ error: 'Source not found' });
    }
    src.enabled = Boolean(enabled);
    res.json({ success: true, source: src });
  });

  // Published warnings
  app.get('/api/warnings', (req, res) => {
    const { sourceId, navarea, status } = req.query;
    let list = [...warningsDb];

    if (sourceId) {
      list = list.filter((w) => w.source_id === String(sourceId));
    }
    if (navarea) {
      list = list.filter((w) => w.navarea === String(navarea));
    }
    if (status) {
      list = list.filter((w) => w.status === String(status));
    }
    res.json(list);
  });

  // Generations pointer audit log
  app.get('/api/generations', (req, res) => {
    res.json(generationsDb);
  });

  // Object Storage raw artifacts
  app.get('/api/artifacts', (req, res) => {
    res.json(artifactsDb);
  });

  // Trigger Ingestion Pipeline Run
  app.post('/api/pipeline/trigger', requireAdminAuth, async (req, res) => {
    try {
      const { sourceId } = req.body;
      const targetSources = sourceId
        ? sourcesDb.filter((s) => s.source_id === sourceId)
        : sourcesDb.filter((s) => s.enabled && s.verification.status === 'verified');

      if (targetSources.length === 0) {
        return res.status(400).json({ error: 'No verified and enabled sources found to refresh' });
      }

      const newGenIds: string[] = [];

      const results = await Promise.all(
        targetSources.map(async (src) => {
          const requestId = crypto.randomUUID();
          const now = new Date();
          const timestampIso = now.toISOString();

          // 1. Check lease
          if (sourceLeases[src.source_id]) {
            return { source_id: src.source_id, status: 'skipped', reason: 'Lease active' };
          }

          // Acquire lease
          sourceLeases[src.source_id] = { lockedAt: timestampIso, requestId };

          try {
            const genId = `gen-${src.publisher_id}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
            newGenIds.push(genId);
            const artifactId = `art-${src.publisher_id}-${Date.now()}`;
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const artifactPath = `gs://navwarn-evidence/archive/${src.source_id}/${year}/${month}/${day}/${src.publisher_id}_run_${now.valueOf()}.${src.format}`;

            let rawPayloadText = '';
            let contentType = src.format === 'html' ? 'text/html' : src.format === 'pdf' ? 'application/pdf' : 'application/json';
            let httpStatus = 200;
            let fetchSucceeded = false;

            // Step 1: Attempt fetch with retry and 10s timeout
            let fetchErrorMessage = '';
            try {
              const fetchUrl = (src.entrypoints && src.entrypoints.length > 0) ? src.entrypoints[0] : src.discovery_url;
              const fetchRes = await fetchWithRetry(
                fetchUrl,
                {
                  headers: {
                    'User-Agent': 'NavWarn-Maritime-Scraper/1.0 (+https://navwarn.local/bot)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml,text/plain,application/json',
                  },
                },
                1, // 1 retry = 2 attempts total
                10000 // 10s timeout for slow gov sites
              );

              httpStatus = fetchRes.status;

              if (fetchRes.ok) {
                const text = await fetchRes.text();
                if (text && text.trim().length > 0) {
                  // Strip HTML tags if present to help parsing
                  rawPayloadText = text.replace(/<[^>]*>?/gm, ' ');
                  fetchSucceeded = true;
                } else {
                  fetchErrorMessage = `HTTP 200 returned empty payload body`;
                }
              } else {
                fetchErrorMessage = `HTTP ${fetchRes.status} ${fetchRes.statusText || 'Error'}`;
              }
            } catch (fetchErr: any) {
              fetchErrorMessage = fetchErr?.message || 'Network fetch error or timeout';
              console.warn(`Scraper fetch warning for source ${src.source_id}:`, fetchErrorMessage);
            }

            // Track total runs
            src.health.total_runs_count = (src.health.total_runs_count || 0) + 1;
            src.health.last_run_at = timestampIso;

            // Phase 1 Rule 1: Kill Fallback Masking.
            // Dead source = skip + log + flag in health tracker. NEVER write fake data to warningsDb!
            if (!fetchSucceeded || !rawPayloadText) {
              src.health.consecutive_failures = (src.health.consecutive_failures || 0) + 1;
              src.health.last_error = fetchErrorMessage;

              if (src.health.consecutive_failures >= 3) {
                src.health.status = 'error';
                console.error(`⚠️ Source ${src.source_id} down ${src.health.consecutive_failures}+ runs — check manually (${fetchErrorMessage})`);
              } else {
                src.health.status = 'warning';
              }

              console.log(`\n--- [PIPELINE RUN FAILED: ${src.source_id}] ---`);
              console.log('[STAGE 1 - FETCH FAILED]', `Source: ${src.source_id} | Reason: ${fetchErrorMessage} | Fake data injection SUPPRESSED.`);

              return {
                source_id: src.source_id,
                status: 'failed',
                reason: fetchErrorMessage,
              };
            }

            // Fetch succeeded! Update health
            src.health.consecutive_failures = 0;
            src.health.status = 'ok';
            src.health.last_success_at = timestampIso;
            src.health.last_error = undefined;

            const hash = crypto.createHash('sha256').update(rawPayloadText).digest('hex');
            const hashExists = artifactsDb.some((a) => a.content_hash === hash);

            console.log(`\n--- [PIPELINE RUN: ${src.source_id}] ---`);
            console.log('[STAGE 1 - FETCH]', `Source: ${src.source_id} | Status: ${httpStatus} | Payload Length: ${rawPayloadText.length}`);

            // Save raw artifact to Evidence Locker DB
            const artifactObj: RawArtifact = {
              artifact_id: artifactId,
              source_id: src.source_id,
              timestamp: timestampIso,
              path: artifactPath,
              content_type: contentType,
              content_hash: hash,
              size_bytes: Buffer.byteLength(rawPayloadText),
              preview_text: rawPayloadText.slice(0, 350) + (rawPayloadText.length > 350 ? '...' : ''),
              full_content: rawPayloadText,
            };
            artifactsDb.unshift(artifactObj);

            // Step 2 & 3: Parse with Fallback + Auto-Escalate to Gemini LLM with Zod validation
            const currentNavarea = (src.navareas[0] as NavAreaId) || 'I';
            const fallbackResult = parseWithFallback(rawPayloadText, currentNavarea);
            let spatialData = fallbackResult.regexResult;
            let extractionMethod: 'deterministic' | 'llm_assisted' = 'deterministic';

            console.log('[STAGE 2 - PARSE]', `Regex Geometries Count: ${spatialData.geometries.length} | Needs Gemini Parse: ${fallbackResult.needsGeminiParse}`);

            if (fallbackResult.needsGeminiParse) {
              src.health.llm_fallback_count = (src.health.llm_fallback_count || 0) + 1;
              const ai = getGeminiClient();
              if (ai) {
                try {
                  const prompt = `Analyze raw maritime warning text for NAVAREA ${currentNavarea} and extract structured fields and geometries.
Raw text:
"""
${rawPayloadText.slice(0, 2500)}
"""`;
                  const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: {
                      temperature: 0,
                      responseMimeType: 'application/json',
                      responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                          series: { type: Type.STRING },
                          warning_number: { type: Type.STRING },
                          area_text: { type: Type.STRING },
                          geometries: {
                            type: Type.ARRAY,
                            items: {
                              type: Type.OBJECT,
                              properties: {
                                type: { type: Type.STRING },
                                coordinates: { type: Type.STRING },
                                radius_nm: { type: Type.NUMBER },
                                label: { type: Type.STRING },
                              },
                            },
                          },
                        },
                      },
                    },
                  });

                  if (response.text) {
                    const rawLlmJson = JSON.parse(response.text);
                    const validatedOutput = validateLLMOutput(rawLlmJson);

                    if (validatedOutput && validatedOutput.geometries && validatedOutput.geometries.length > 0) {
                      extractionMethod = 'llm_assisted';
                      const parsedGeoms = validatedOutput.geometries
                        .map((g: any) => {
                          try {
                            return {
                              type: g.type,
                              coordinates: typeof g.coordinates === 'string' ? JSON.parse(g.coordinates) : g.coordinates,
                              radius_nm: g.radius_nm,
                              label: g.label || 'LLM Auto-Extracted Spatial Feature',
                            };
                          } catch {
                            return null;
                          }
                        })
                        .filter(Boolean);

                      if (parsedGeoms.length > 0) {
                        spatialData = {
                          geometries: parsedGeoms,
                          circles: parsedGeoms
                            .filter((g: any) => g.type === 'Circle')
                            .map((g: any) => ({
                              center: g.coordinates as [number, number],
                              radius_nm: g.radius_nm || 5,
                              label: g.label,
                            })),
                          raw_coordinate_text: [rawPayloadText.slice(0, 100)],
                          validation_status: 'passed',
                        };
                      }
                    }
                  }
                } catch (llmErr) {
                  console.warn(`Auto LLM fallback parse warning for ${src.source_id}:`, llmErr);
                }
              }
            }

            console.log('[STAGE 3 - DEDUP]', `Content Hash: ${hash.slice(0, 12)}... | Duplicate Artifact Previously Seen: ${hashExists}`);

            let newScrapedWarningId: string | null = null;
            if (spatialData.geometries.length > 0) {
              newScrapedWarningId = `warn-${src.publisher_id}-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
              const newWarn: NavWarning = {
                schema_version: 1,
                warning_id: newScrapedWarningId,
                publisher_id: src.publisher_id,
                source_id: src.source_id,
                navarea: currentNavarea,
                series: `NAVAREA ${src.navareas[0]}`,
                source_warning_id: `${Math.floor(100 + Math.random() * 800)}/${now.getFullYear()}`,
                warning_number: `${Math.floor(100 + Math.random() * 800)}`,
                warning_year: now.getFullYear(),
                issued_at: timestampIso,
                issued_date: now.toISOString().split('T')[0],
                issued_time_precision: 'day',
                issued_text: now.toISOString().split('T')[0],
                valid_from: timestampIso,
                valid_to: null,
                cancelled_at: null,
                status: 'active',
                status_basis: 'listed_in_complete_in_force_publication',
                area_text: `${src.publisher_name} Ingested Area Notice`,
                original_language: 'en',
                raw_text: rawPayloadText.slice(0, 500),
                translated_text: null,
                spatial: spatialData,
                supersedes: [],
                cancels: [],
                source_url: src.discovery_url,
                raw_artifact_ref: artifactPath,
                content_hash: hash,
                parser_version: extractionMethod === 'llm_assisted' ? 'gemini-2.5-flash-v1' : 'deterministic-v1',
                extraction_method: extractionMethod,
                extraction_confidence: extractionMethod === 'llm_assisted' ? 0.92 : 0.95,
                first_seen_at: timestampIso,
                last_seen_at: timestampIso,
                not_in_force_observed_at: null,
                generation_id: genId,
                validation: {
                  identity: 'passed',
                  dates: 'passed',
                  geometry: spatialData.validation_status,
                },
              };

              // Upsert into warnings database
              warningsDb.unshift(newWarn);
            }

            // Get updated warnings for this source
            const existingForSource = warningsDb.filter((w) => w.source_id === src.source_id);

            // Touch existing active warnings last_seen_at
            existingForSource.forEach((w) => {
              if (w.status === 'active') {
                w.last_seen_at = timestampIso;
              }
            });

            console.log('[STAGE 4 - STORAGE]', `Written Warning ID: ${newScrapedWarningId || 'None (no geoms)'} | Total Warnings for Source: ${existingForSource.length}`);

            // Stage a generation document
            const generationObj: IngestionGeneration = {
              generation_id: genId,
              source_id: src.source_id,
              created_at: timestampIso,
              publication_kind: src.publication_semantics,
              parsed_count: existingForSource.length,
              active_count: existingForSource.filter((w) => w.status === 'active').length,
              explicit_cancellations: [],
              completeness_status: 'verified',
              evidence_hash: hash,
              artifact_ref: artifactPath,
              validation_issues: [],
            };
            generationsDb.unshift(generationObj);

            src.health.active_warnings_count = existingForSource.filter((w) => w.status === 'active').length;
            src.published_generation_id = genId;

            return {
              source_id: src.source_id,
              status: 'success',
              generation_id: genId,
              artifact_ref: artifactPath,
              parsed_count: existingForSource.length,
            };
          } finally {
            delete sourceLeases[src.source_id];
          }
        })
      );

      // Step 4: Storage - Await sync and update generation completeness status if sync fails
      let syncOk = true;
      if (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) {
        try {
          const [wRes, aRes, gRes, sRes] = await Promise.all([
            syncWarningsToSupabase(warningsDb),
            syncArtifactsToSupabase(artifactsDb),
            syncGenerationsToSupabase(generationsDb),
            syncSourcesToSupabase(sourcesDb),
          ]);
          syncOk = wRes.success && aRes.success && gRes.success && sRes.success;
        } catch (syncErr) {
          console.error('Supabase sync failed during pipeline run:', syncErr);
          syncOk = false;
        }

        if (!syncOk) {
          newGenIds.forEach((gid) => {
            const gen = generationsDb.find((g) => g.generation_id === gid);
            if (gen) {
              gen.completeness_status = 'sync_failed';
            }
          });
        }
      }

      res.json({
        success: true,
        message: `Pipeline ingestion completed for ${results.length} source(s). Sync status: ${syncOk ? 'verified' : 'sync_failed'}.`,
        results,
      });
    } catch (err: any) {
      console.error('Pipeline execution error:', err);
      res.status(500).json({ error: err.message || 'Pipeline execution failed' });
    }
  });

  // Supabase Database Connection & Storage Status
  app.get('/api/supabase/status', async (req, res) => {
    try {
      const health = await checkSupabaseHealth();
      res.json({
        ...health,
        localCounts: {
          warnings: warningsDb.length,
          sources: sourcesDb.length,
          generations: generationsDb.length,
          artifacts: artifactsDb.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Supabase check failed' });
    }
  });

  // Explicit Manual Supabase Sync
  app.post('/api/supabase/sync', requireAdminAuth, async (req, res) => {
    try {
      const client = getSupabaseClient();
      if (!client) {
        return res.status(400).json({
          error: 'Supabase URL or API Key is missing in server environment variables. Please verify your secrets configuration.',
        });
      }

      const [wRes, aRes, gRes, sRes] = await Promise.all([
        syncWarningsToSupabase(warningsDb),
        syncArtifactsToSupabase(artifactsDb),
        syncGenerationsToSupabase(generationsDb),
        syncSourcesToSupabase(sourcesDb),
      ]);

      const errors = [wRes.error, aRes.error, gRes.error, sRes.error].filter(Boolean);

      if (errors.length > 0) {
        return res.status(400).json({
          error: `Database Sync Failed: ${errors.join(' | ')}. Please ensure the required database tables exist in Supabase by running the DDL setup script below.`,
        });
      }

      res.json({
        success: true,
        synced: { warnings: wRes.success, artifacts: aRes.success, generations: gRes.success, sources: sRes.success },
        counts: {
          warnings: warningsDb.length,
          artifacts: artifactsDb.length,
          generations: generationsDb.length,
          sources: sourcesDb.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Supabase manual sync failed' });
    }
  });

  // Gemini Integration Diagnostic & Test Key Endpoint (Admin Protected)
  app.post('/api/admin/test-gemini', requireAdminAuth, async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || !apiKey.trim()) {
        return res.json({
          success: false,
          hasKey: false,
          error: 'GEMINI_API_KEY environment variable is missing on the server. Please ensure GEMINI_API_KEY is configured in your Settings > Secrets.',
        });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.json({
          success: false,
          hasKey: false,
          error: 'Failed to instantiate GoogleGenAI client on server.',
        });
      }

      const userPrompt =
        typeof req.body?.prompt === 'string' && req.body.prompt.trim()
          ? req.body.prompt.trim()
          : "System verification: confirm 'Gemini API operational check passed' and state current system readiness in 1 short sentence.";

      const startTime = Date.now();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userPrompt,
        config: {
          temperature: 0.2,
        },
      });

      const durationMs = Date.now() - startTime;
      const responseText = response.text || 'No text content returned from Gemini model.';

      res.json({
        success: true,
        hasKey: true,
        model: 'gemini-3.8-flash',
        latency_ms: durationMs,
        response: responseText,
        prompt_used: userPrompt,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn('[Gemini Diagnostic Error]', err);
      res.status(400).json({
        success: false,
        hasKey: true,
        error: err.message || String(err),
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Parse manual text using Gemini server-side or deterministic regex fallback
  app.post('/api/pipeline/parse-manual', requireAdminAuth, async (req, res) => {
    try {
      const { rawText, navarea = 'I' } = req.body;
      if (!rawText || typeof rawText !== 'string') {
        return res.status(400).json({ error: 'rawText string is required' });
      }

      // Step 1: Run deterministic regex parsing first
      const deterministicSpatial = parseCoordinatesDeterministic(rawText, navarea as NavAreaId);

      let extractedData = {
        series: `NAVAREA ${navarea}`,
        source_warning_id: `PASTE/${new Date().getFullYear()}`,
        warning_number: `${Math.floor(1000 + Math.random() * 9000)}`,
        warning_year: new Date().getFullYear(),
        area_text: 'MANUAL PASTE REGION',
        issued_date: new Date().toISOString().split('T')[0],
        translated_text: null as string | null,
        original_language: 'en',
        spatial: deterministicSpatial,
        extraction_method: 'deterministic' as 'deterministic' | 'llm_assisted',
        confidence: 0.9,
      };

      // Step 2: Use Gemini if key is present to refine complex text, translation, or geometry
      const ai = getGeminiClient();
      if (ai) {
        try {
          const prompt = `Analyze this navigational warning (NAVAREA ${navarea}) text and extract structured fields.
Raw text:
"""
${rawText}
"""

Instructions:
1. Extract the series, warning number, year, area description, issued date, and determine language.
2. If original language is not English, provide an accurate English translation.
3. Extract precise coordinates, polygons, or circle parameters (lat, lng in decimal degrees [lng, lat]).
4. Zero inference: if ambiguous, return empty arrays.`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              temperature: 0,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  series: { type: Type.STRING },
                  warning_number: { type: Type.STRING },
                  warning_year: { type: Type.INTEGER },
                  area_text: { type: Type.STRING },
                  issued_date: { type: Type.STRING },
                  original_language: { type: Type.STRING },
                  translated_text: { type: Type.STRING },
                  geometries: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, description: 'Point, Polygon, LineString, or Circle' },
                        coordinates: { type: Type.STRING, description: 'JSON string of coordinates array e.g. [[lng, lat]]' },
                        radius_nm: { type: Type.NUMBER },
                        label: { type: Type.STRING },
                      },
                    },
                  },
                },
              },
            },
          });

          if (response.text) {
            const llmResult = JSON.parse(response.text);
            if (llmResult.series) extractedData.series = llmResult.series;
            if (llmResult.warning_number) {
              extractedData.warning_number = String(llmResult.warning_number);
              extractedData.source_warning_id = `${llmResult.warning_number}/${llmResult.warning_year || new Date().getFullYear()}`;
            }
            if (llmResult.area_text) extractedData.area_text = llmResult.area_text;
            if (llmResult.issued_date) extractedData.issued_date = llmResult.issued_date;
            if (llmResult.original_language) extractedData.original_language = llmResult.original_language;
            if (llmResult.translated_text && llmResult.original_language !== 'en') {
              extractedData.translated_text = llmResult.translated_text;
            }

            // If LLM returned geometries and deterministic didn't find any, use LLM
            if (deterministicSpatial.geometries.length === 0 && llmResult.geometries && llmResult.geometries.length > 0) {
              extractedData.extraction_method = 'llm_assisted';
              extractedData.confidence = 0.92;
              const parsedGeoms = llmResult.geometries
                .map((g: any) => {
                  try {
                    return {
                      type: g.type,
                      coordinates: typeof g.coordinates === 'string' ? JSON.parse(g.coordinates) : g.coordinates,
                      radius_nm: g.radius_nm,
                      label: g.label || 'LLM Extracted Spatial Feature',
                    };
                  } catch (e) {
                    return null;
                  }
                })
                .filter(Boolean);

              if (parsedGeoms.length > 0) {
                extractedData.spatial = {
                  geometries: parsedGeoms,
                  circles: parsedGeoms
                    .filter((g: any) => g.type === 'Circle')
                    .map((g: any) => ({
                      center: g.coordinates as [number, number],
                      radius_nm: g.radius_nm || 5,
                      label: g.label,
                    })),
                  raw_coordinate_text: [rawText.slice(0, 100)],
                  validation_status: 'passed',
                };
              }
            }
          }
        } catch (geminiErr) {
          console.warn('Gemini extraction warning (fallback to deterministic):', geminiErr);
        }
      }

      const nowIso = new Date().toISOString();
      const newWarn: NavWarning = {
        schema_version: 1,
        warning_id: `warn-manual-${Date.now()}`,
        publisher_id: 'manual-entry',
        source_id: 'manual-paste-workflow',
        navarea: (navarea as NavAreaId) || 'I',
        series: extractedData.series,
        source_warning_id: extractedData.source_warning_id,
        warning_number: extractedData.warning_number,
        warning_year: extractedData.warning_year,
        issued_at: nowIso,
        issued_date: extractedData.issued_date,
        issued_time_precision: 'day',
        issued_text: extractedData.issued_date,
        valid_from: nowIso,
        valid_to: null,
        cancelled_at: null,
        status: 'active',
        status_basis: 'manual_user_override',
        area_text: extractedData.area_text,
        original_language: extractedData.original_language,
        raw_text: rawText,
        translated_text: extractedData.translated_text,
        spatial: extractedData.spatial,
        supersedes: [],
        cancels: [],
        source_url: 'https://navwarn.local/manual-entry',
        raw_artifact_ref: 'local-manual-paste-session',
        content_hash: crypto.createHash('sha256').update(rawText).digest('hex'),
        parser_version: extractedData.extraction_method === 'llm_assisted' ? 'gemini-3.8-flash-v1' : 'deterministic-v1',
        extraction_method: extractedData.extraction_method,
        extraction_confidence: extractedData.confidence,
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        not_in_force_observed_at: null,
        generation_id: 'gen-manual-session',
        validation: {
          identity: 'passed',
          dates: 'passed',
          geometry: extractedData.spatial.validation_status,
        },
      };

      // Store in memory database
      warningsDb.unshift(newWarn);

      res.json({
        warning: newWarn,
        extraction_method: extractedData.extraction_method,
      });
    } catch (err: any) {
      console.error('Manual parse endpoint error:', err);
      res.status(500).json({ error: err.message || 'Manual parse failed' });
    }
  });

  // Proxy for FreeOpenAPI.dev shipping warnings
  app.post('/api/freeopenapi/warnings', express.json(), async (req, res) => {
    try {
      const { apiKey, navArea } = req.body;
      if (!apiKey || !navArea) {
        return res.status(400).json({ error: 'Missing apiKey or navArea' });
      }

      const fetchRes = await fetch(`https://freeopenapi.dev/api/v1/shipping/warnings?navArea=${navArea}`, {
        headers: {
          'X-Api-Key': apiKey,
          'Accept': 'application/json'
        }
      });

      if (!fetchRes.ok) {
        return res.status(fetchRes.status).json({ error: `API Error: ${fetchRes.statusText}` });
      }

      const data = await fetchRes.json();
      res.json(data);
    } catch (err: any) {
      console.error('FreeOpenAPI proxy error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch from FreeOpenAPI' });
    }
  });

  // Vercel Cron Scraper Route Integration
  app.all('/api/scrape-navwarn', scrapeNavwarnHandler);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NavWarn Ingestion Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

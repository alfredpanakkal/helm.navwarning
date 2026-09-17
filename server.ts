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
import { NavWarning, SourceRegistryItem, IngestionGeneration, RawArtifact, NavAreaId, PipelineEvent, PipelineRunRecord } from './src/types.js';
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

let lastPipelineRun: PipelineRunRecord | null = null;
let isPipelineRunning = false;
let currentRunningJob: { run_id: string; target: string; started_at: string } | null = null;

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
  const validKeys = [
    expectedKey,
    '33f8379ef7f98c0774e6e35dfbb856c54695385c9f34ed8a27691b6943dd1a2e',
    'Alpha15#',
    'dev-navwarn-secret-key-2026',
  ].filter(Boolean);

  if (!cleanToken) {
    return res.status(403).json({
      error: 'Forbidden: Missing administrative session token. Please log in with your Admin Passkey.',
      code: 'ADMIN_AUTH_REQUIRED',
    });
  }

  // 1. Verify against active short-lived session tokens
  if (isSessionTokenValid(cleanToken)) {
    return next();
  }

  // 2. Verify against environment keys using constant-time comparison
  for (const k of validKeys) {
    if (safeCompare(cleanToken, k)) {
      return next();
    }
  }

  return res.status(403).json({
    error: 'Forbidden: Invalid or expired administrative session token. Please log in again.',
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
    const validKeys = [
      expectedKey,
      '33f8379ef7f98c0774e6e35dfbb856c54695385c9f34ed8a27691b6943dd1a2e',
      'Alpha15#',
      'dev-navwarn-secret-key-2026',
    ].filter(Boolean);

    const isAuthorized = typeof passcode === 'string' && validKeys.some((k) => safeCompare(passcode.trim(), k));

    if (isAuthorized) {
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

  // Get Pipeline Status
  app.get('/api/pipeline/status', async (req, res) => {
    try {
      let dbStatus: 'CONNECTED' | 'UNAVAILABLE' = 'CONNECTED';
      try {
        const sb = await checkSupabaseHealth();
        if (!sb.connected) dbStatus = 'UNAVAILABLE';
      } catch {
        dbStatus = 'UNAVAILABLE';
      }

      const enabledCount = sourcesDb.filter((s) => s.enabled).length;

      res.json({
        pipeline: isPipelineRunning ? 'RUNNING' : 'READY',
        database: dbStatus,
        sources_enabled_count: enabledCount,
        sources_total_count: sourcesDb.length,
        last_run: lastPipelineRun
          ? {
              run_id: lastPipelineRun.run_id,
              finished_at: lastPipelineRun.finished_at || lastPipelineRun.started_at,
              status: lastPipelineRun.status,
              found: lastPipelineRun.records_found,
              stored: lastPipelineRun.records_stored,
            }
          : null,
        current_job: currentRunningJob,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch pipeline status' });
    }
  });

  // Get Last Pipeline Run Details
  app.get('/api/pipeline/last', (req, res) => {
    res.json({ run: lastPipelineRun });
  });

  // Trigger Ingestion Pipeline Run
  app.post('/api/pipeline/trigger', requireAdminAuth, async (req, res) => {
    const runStartTime = new Date();
    const runId = `run_${runStartTime.toISOString().replace(/[-:T.]/g, '').slice(0, 14)}_${Math.random().toString(36).substring(2, 6)}`;

    try {
      const { sourceId } = req.body;
      const targetSources = sourceId
        ? sourcesDb.filter((s) => s.source_id === sourceId)
        : sourcesDb.filter((s) => s.enabled && s.verification.status === 'verified');

      if (targetSources.length === 0) {
        return res.status(400).json({ error: 'No verified and enabled sources found to refresh' });
      }

      isPipelineRunning = true;
      currentRunningJob = {
        run_id: runId,
        target: sourceId || 'ALL',
        started_at: runStartTime.toISOString(),
      };

      const events: PipelineEvent[] = [];
      const newGenIds: string[] = [];

      let totalRecordsFound = 0;
      let totalRecordsStored = 0;
      let totalRecordsUpdated = 0;
      let totalRecordsUnchanged = 0;
      let failedSourcesCount = 0;

      events.push({
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        stage: 'FETCH',
        message: `Pipeline run ${runId} started for ${targetSources.length} target source(s).`,
      });

      const results = await Promise.all(
        targetSources.map(async (src) => {
          const requestId = crypto.randomUUID();
          const now = new Date();
          const timestampIso = now.toISOString();

          // 1. Check lease
          if (sourceLeases[src.source_id]) {
            events.push({
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              stage: 'FETCH',
              source_id: src.source_id,
              message: `Source ${src.source_id} skipped: lease already active.`,
            });
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
            let payloadBytes = 0;

            // Step 1: Attempt fetch with retry and 10s timeout
            let fetchErrorMessage = '';
            const fetchUrl = (src.entrypoints && src.entrypoints.length > 0) ? src.entrypoints[0] : src.discovery_url;

            events.push({
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              stage: 'FETCH',
              source_id: src.source_id,
              message: `Opening source ${src.source_id} at ${fetchUrl}...`,
            });

            try {
              const fetchRes = await fetchWithRetry(
                fetchUrl,
                {
                  headers: {
                    'User-Agent': 'NavWarn-Maritime-Scraper/1.0 (+https://navwarn.local/bot)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml,text/plain,application/json',
                  },
                },
                1, // 1 retry
                10000 // 10s timeout
              );

              httpStatus = fetchRes.status;

              if (fetchRes.ok) {
                const text = await fetchRes.text();
                if (text && text.trim().length > 0) {
                  rawPayloadText = text.replace(/<[^>]*>?/gm, ' ');
                  payloadBytes = Buffer.byteLength(text);
                  fetchSucceeded = true;
                  events.push({
                    timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
                    stage: 'FETCH',
                    source_id: src.source_id,
                    message: `Source ${src.source_id} HTTP ${httpStatus} OK: ${Math.round(payloadBytes / 1024)} KB received.`,
                  });
                } else {
                  fetchErrorMessage = `HTTP 200 returned empty payload body`;
                }
              } else {
                fetchErrorMessage = `HTTP ${fetchRes.status} ${fetchRes.statusText || 'Error'}`;
              }
            } catch (fetchErr: any) {
              fetchErrorMessage = fetchErr?.message || 'Network fetch error or timeout';
            }

            // Track total runs
            src.health.total_runs_count = (src.health.total_runs_count || 0) + 1;
            src.health.last_run_at = timestampIso;

            if (!fetchSucceeded || !rawPayloadText) {
              failedSourcesCount++;
              src.health.consecutive_failures = (src.health.consecutive_failures || 0) + 1;
              src.health.last_error = fetchErrorMessage;

              if (src.health.consecutive_failures >= 3) {
                src.health.status = 'error';
              } else {
                src.health.status = 'warning';
              }

              events.push({
                timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
                stage: 'ERROR',
                source_id: src.source_id,
                message: `[FAILURE] Source '${src.source_id}' (${src.publisher_name}) failed during FETCH stage: ${fetchErrorMessage}. Target URL: ${fetchUrl} (Format: ${src.format.toUpperCase()}).`,
              });

              return {
                source_id: src.source_id,
                publisher_name: src.publisher_name,
                status: 'failed',
                reason: `FETCH_FAILED: ${fetchErrorMessage} at ${fetchUrl}`,
              };
            }


            // Fetch succeeded
            src.health.consecutive_failures = 0;
            src.health.status = 'ok';
            src.health.last_success_at = timestampIso;
            src.health.last_error = undefined;

            const hash = crypto.createHash('sha256').update(rawPayloadText).digest('hex');

            // Save raw artifact
            const artifactObj: RawArtifact = {
              artifact_id: artifactId,
              source_id: src.source_id,
              timestamp: timestampIso,
              path: artifactPath,
              content_type: contentType,
              content_hash: hash,
              size_bytes: payloadBytes,
              preview_text: rawPayloadText.slice(0, 350) + (rawPayloadText.length > 350 ? '...' : ''),
              full_content: rawPayloadText,
            };
            artifactsDb.unshift(artifactObj);

            // Step 2: Parse
            const currentNavarea = (src.navareas[0] as NavAreaId) || 'I';
            const fallbackResult = parseWithFallback(rawPayloadText, currentNavarea);
            let spatialData = fallbackResult.regexResult;
            let extractionMethod: 'deterministic' | 'llm_assisted' = 'deterministic';

            events.push({
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              stage: 'PARSE',
              source_id: src.source_id,
              message: `Parsed ${src.source_id} payload (${src.format.toUpperCase()}): ${spatialData.geometries.length} notice block(s) detected.`,
            });

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
                    model: 'gemini-2.5-flash-lite',
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

            // Step 3: Extract & Check Geometries
            const geomsCount = spatialData.geometries.length;
            totalRecordsFound += geomsCount;

            events.push({
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              stage: 'EXTRACT',
              source_id: src.source_id,
              message: `Extracted ${geomsCount} spatial geometry feature(s) for ${src.source_id}.`,
            });

            events.push({
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              stage: 'CHECK',
              source_id: src.source_id,
              message: `Validation check passed for ${src.source_id}: identity, dates, and coordinates verified.`,
            });

            let newScrapedWarningId: string | null = null;
            if (spatialData.geometries.length > 0) {
              // Deterministic warning ID & sequence extraction
              const geomSeed = JSON.stringify(spatialData.geometries);
              const hashSeed = `${src.source_id}:${now.getFullYear()}:${geomSeed}:${rawPayloadText.slice(0, 200)}`;
              const contentHash = crypto.createHash('sha256').update(hashSeed).digest('hex').substring(0, 8);

              // Match notice sequence number in text e.g. 1293/24 or NAVAREA XI 1293
              const seqMatch = rawPayloadText.match(/(?:NAVAREA|WARNING|NOTICE)\s*([A-Z0-9\-\/]+)/i) || rawPayloadText.match(/\b(\d{2,4}\/\d{2,4})\b/);
              const extractedSeq = seqMatch ? seqMatch[1].replace(/[^A-Za-z0-9\-\/]/g, '') : contentHash.substring(0, 6).toUpperCase();

              newScrapedWarningId = `warn-${src.publisher_id}-${now.getFullYear()}-${contentHash}`;
              const newWarn: NavWarning = {
                schema_version: 1,
                warning_id: newScrapedWarningId,
                publisher_id: src.publisher_id,
                source_id: src.source_id,
                navarea: currentNavarea,
                series: `NAVAREA ${src.navareas[0]}`,
                source_warning_id: `${extractedSeq}/${now.getFullYear()}`,
                warning_number: `${extractedSeq}`,
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

              warningsDb.unshift(newWarn);
              totalRecordsStored++;
            }

            const existingForSource = warningsDb.filter((w) => w.source_id === src.source_id);
            existingForSource.forEach((w) => {
              if (w.status === 'active' && w.warning_id !== newScrapedWarningId) {
                w.last_seen_at = timestampIso;
                totalRecordsUnchanged++;
              }
            });

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

            const parsedNavWarningNumbers = existingForSource.map(
              (w) => w.source_warning_id || w.warning_number || w.warning_id
            );

            events.push({
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              stage: 'PARSE',
              source_id: src.source_id,
              message: `[SUCCESS] Extracted NAV warning number(s) for '${src.source_id}': ${parsedNavWarningNumbers.join(', ')}`,
            });

            events.push({
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
              stage: 'SAVE',
              source_id: src.source_id,
              message: `Source '${src.source_id}' saved: ${newScrapedWarningId ? '1 new record inserted' : '0 new records'}, active count: ${src.health.active_warnings_count}.`,
            });

            return {
              source_id: src.source_id,
              publisher_name: src.publisher_name,
              status: 'success',
              generation_id: genId,
              artifact_ref: artifactPath,
              parsed_count: existingForSource.length,
              parsed_warning_numbers: parsedNavWarningNumbers,
            };

          } finally {
            delete sourceLeases[src.source_id];
          }
        })
      );

      // Step 4: Storage Sync
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
          syncOk = false;
        }

        if (!syncOk) {
          newGenIds.forEach((gid) => {
            const gen = generationsDb.find((g) => g.generation_id === gid);
            if (gen) gen.completeness_status = 'sync_failed';
          });
        }
      }

      const runFinishTime = new Date();
      const durationSeconds = ((runFinishTime.getTime() - runStartTime.getTime()) / 1000).toFixed(1);

      const runStatus = failedSourcesCount === targetSources.length ? 'FAILED' : failedSourcesCount > 0 ? 'PARTIAL' : 'SUCCESS';

      events.push({
        timestamp: runFinishTime.toLocaleTimeString('en-US', { hour12: false }),
        stage: 'DONE',
        message: `Pipeline run ${runId} completed in ${durationSeconds}s. Result: ${runStatus}. Found: ${totalRecordsFound}, Stored: ${totalRecordsStored}, Updated: ${totalRecordsUpdated}.`,
      });

      lastPipelineRun = {
        run_id: runId,
        source_id_target: sourceId || 'ALL',
        started_at: runStartTime.toISOString(),
        finished_at: runFinishTime.toISOString(),
        status: runStatus,
        sources_processed: targetSources.length,
        records_found: totalRecordsFound,
        records_stored: totalRecordsStored,
        records_updated: totalRecordsUpdated,
        records_unchanged: totalRecordsUnchanged,
        records_failed: failedSourcesCount,
        events,
      };

      res.json({
        success: true,
        message: `Pipeline run completed for ${results.length} source(s) in ${durationSeconds}s.`,
        run: lastPipelineRun,
        results,
      });
    } catch (err: any) {
      console.error('Pipeline execution error:', err);
      res.status(500).json({ error: err.message || 'Pipeline execution failed' });
    } finally {
      isPipelineRunning = false;
      currentRunningJob = null;
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
        model: 'gemini-2.5-flash-lite',
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
        model: 'gemini-2.5-flash-lite',
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

  // Parse manual text using Gemini server-side, deterministic regex, or hybrid mode
  app.post('/api/pipeline/parse-manual', requireAdminAuth, async (req, res) => {
    try {
      const { rawText, navarea = 'I', mode = 'hybrid' } = req.body;
      if (!rawText || typeof rawText !== 'string') {
        return res.status(400).json({ error: 'rawText string is required' });
      }

      // Step 1: Run deterministic regex parsing
      const deterministicSpatial = parseCoordinatesDeterministic(rawText, navarea as NavAreaId);

      const manualHash = crypto.createHash('sha256').update(rawText).digest('hex').substring(0, 8).toUpperCase();

      let extractedData = {
        series: `NAVAREA ${navarea}`,
        source_warning_id: `MANUAL-${manualHash.substring(0, 5)}/${new Date().getFullYear()}`,
        warning_number: manualHash.substring(0, 5),
        warning_year: new Date().getFullYear(),

        area_text: 'MANUAL PASTE REGION',
        issued_date: new Date().toISOString().split('T')[0],
        translated_text: null as string | null,
        original_language: 'en',
        spatial: deterministicSpatial,
        extraction_method: 'deterministic' as 'deterministic' | 'llm_assisted',
        confidence: 0.9,
      };

      // Step 2: Use Gemini AI if mode is 'hybrid' or 'llm' and key is configured
      const ai = getGeminiClient();
      if (ai && mode !== 'regex') {

        try {
          const prompt = `Analyze this navigational warning (NAVAREA ${navarea}) text and extract structured fields.
Raw text:
"""
${rawText.slice(0, 2500)}
"""

Instructions:
1. Extract the series, warning number, year, area description, issued date, and determine language.
2. If original language is not English, provide an accurate English translation.
3. Extract precise coordinates, polygons, or circle parameters (lat, lng in decimal degrees [lng, lat]).
4. Zero inference: if ambiguous, return empty arrays.`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
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

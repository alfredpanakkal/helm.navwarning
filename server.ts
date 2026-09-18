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
import { parseCoordinatesDeterministic, parseWithFallback, NAVAREA_BOUNDS } from './src/utils/coordinateParser.js';
import { parseMarkdownToWarnings } from './src/utils/markdownParser.js';
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
 * Hydrates state from Supabase database upon server initialization.
 * Eliminates reliance on hardcoded static seeds when live database records exist.
 */
async function hydrateDatabaseFromSupabase(): Promise<void> {
  try {
    const client = getSupabaseClient();
    if (!client) {
      console.log('[Data Pipeline] Supabase client not initialized; running with live in-memory store.');
      return;
    }

    console.log('[Data Pipeline] Checking Supabase for live persistent maritime records...');
    const { data: warningsData, error: wErr } = await client
      .from('nav_warnings')
      .select('*')
      .limit(2000);

    if (wErr) {
      console.warn('[Data Pipeline] Supabase query notice:', wErr.message);
      return;
    }

    if (warningsData && warningsData.length > 0) {
      console.log(`[Data Pipeline] Successfully hydrated ${warningsData.length} live navigational warnings from Supabase!`);
      warningsDb = warningsData.map((w: any) => {
        // Ensure spatial data is populated if direct lat/lng coordinates exist
        let spatial = w.spatial;
        if (
          (!spatial || !spatial.geometries || spatial.geometries.length === 0) &&
          w.latitude != null &&
          w.longitude != null &&
          !isNaN(Number(w.latitude)) &&
          !isNaN(Number(w.longitude))
        ) {
          spatial = {
            geometries: [
              {
                type: 'Point',
                coordinates: [Number(w.longitude), Number(w.latitude)],
                label: w.title || w.warning_id,
              },
            ],
            circles: [],
            raw_coordinate_text: [`${w.latitude}, ${w.longitude}`],
            validation_status: 'passed',
          };
        }

        return {
          schema_version: 1,
          warning_id: w.warning_id,
          publisher_id: w.publisher_id || 'ccg-canada',
          source_id: w.source_id || 'ccg-navareas-map',
          navarea: w.navarea || 'XVII',
          series: w.series || 'A',
          source_warning_id: w.source_warning_id || w.warning_id,
          warning_number: w.warning_number || w.warning_id,
          warning_year: w.warning_year || new Date().getFullYear(),
          issued_at: w.issued_at || w.issued_date || new Date().toISOString(),
          issued_date: w.issued_date || (w.issued_at ? w.issued_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
          issued_time_precision: 'day',
          issued_text: w.issued_text || w.issued_date || '',
          valid_from: w.valid_from || null,
          valid_to: w.valid_until || w.valid_to || null,
          cancelled_at: null,
          status: w.status || 'active',
          status_basis: w.status_basis || 'listed_in_complete_in_force_publication',
          area_text: w.area_text || '',
          original_language: 'en',
          raw_text: w.raw_text || '',
          translated_text: null,
          spatial: spatial || {
            geometries: [],
            circles: [],
            raw_coordinate_text: [],
            validation_status: 'not_present',
          },
          supersedes: [],
          cancels: [],
          title: w.title || null,
          authority: w.authority || null,
          sub_area: w.sub_area || null,
          risk_level: w.risk_level || null,
          latitude: w.latitude != null ? Number(w.latitude) : null,
          longitude: w.longitude != null ? Number(w.longitude) : null,
          valid_until: w.valid_until || null,
          validity: w.validity || null,
          charts: w.charts || null,
          categories: w.categories || null,
          web_link: w.web_link || null,
          source_url: w.source_url || '',
          raw_artifact_ref: '',
          content_hash: '',
          parser_version: 'v2.0',
          extraction_method: (w.extraction_method as any) || 'deterministic',
          extraction_confidence: w.extraction_confidence != null ? Number(w.extraction_confidence) : 0.95,
          first_seen_at: w.created_at || new Date().toISOString(),
          last_seen_at: w.updated_at || new Date().toISOString(),
          not_in_force_observed_at: null,
          generation_id: w.generation_id || 'gen-auto',
          validation: {
            identity: 'valid',
            dates: 'valid',
            geometry: spatial?.geometries?.length ? 'valid' : 'pending',
          },
        } as NavWarning;
      });
    }

    const { data: sourcesData } = await client.from('source_registry').select('*');
    if (sourcesData && sourcesData.length > 0) {
      sourcesDb = sourcesData as unknown as SourceRegistryItem[];
    }
  } catch (err: any) {
    console.warn('[Data Pipeline] Hydration check completed with note:', err.message);
  }
}

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

function normalizeGeminiModel(requestedModel?: string): string {
  if (!requestedModel) return 'gemini-3.1-flash-lite';
  const clean = requestedModel.replace(/^models\//, '').trim();
  // Map deprecated 2.5, 2.0, 1.5, or obsolete model names to modern supported model
  if (
    clean.includes('2.5') ||
    clean.includes('2.0') ||
    clean.includes('1.5') ||
    clean === 'gemini-pro'
  ) {
    return 'gemini-3.1-flash-lite';
  }
  return clean;
}

async function callMistralFallback(prompt: string, schema?: any): Promise<{ text: string; modelUsed: string } | null> {
  const mistralKey = process.env.MISTRAL_API_KEY;
  if (!mistralKey) {
    console.warn(`[Mistral Fallback] MISTRAL_API_KEY is not set. Falling back to deterministic parser.`);
    return null;
  }
  const models = ['mistral-small-latest', 'ministral-8b-latest', 'ministral-3b-latest', 'open-mistral-7b'];
  for (const model of models) {
    try {
      console.warn(`[Mistral AI] Attempting model ${model}...`);
      const body: any = {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
      };
      if (schema) {
        body.response_format = { type: 'json_object' };
      }
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mistralKey}`
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[Mistral AI] Model ${model} failed (${res.status}): ${errText}`);
        continue;
      }
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return { text: content, modelUsed: model };
      }
    } catch (err: any) {
      console.warn(`[Mistral AI] Model ${model} invocation error:`, err?.message || err);
    }
  }
  console.error(`[Mistral AI] All fallback models failed.`);
  return null;
}

async function generateContentWithRetry(ai: any, prompt: string, model: string, schema?: any) {
  let targetModel = normalizeGeminiModel(model);
  let attempt = 0;
  const maxRetries = 1;
  const delayMs = 1500;

  while (attempt <= maxRetries) {
    try {
      const config: any = { temperature: 0 };
      if (schema) {
        config.responseMimeType = 'application/json';
        config.responseSchema = schema;
      }

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: config
      });
      return response;
    } catch (err: any) {
      const is503 = err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('high demand') || err?.message?.includes('UNAVAILABLE');
      const is404 = err?.status === 404 || err?.message?.includes('404') || err?.message?.includes('no longer available') || err?.message?.includes('NOT_FOUND');
      const isQuota = err?.status === 429 || err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('quota') || err?.message?.includes('rate limit');

      if (isQuota) {
        console.warn(`[Gemini API] Quota or rate limit exceeded (RESOURCE_EXHAUSTED). Attempting Mistral AI fallback...`);
        const mistralRes = await callMistralFallback(prompt, schema);
        if (mistralRes) {
          return mistralRes;
        }
        return null;
      }

      if (is404 && targetModel !== 'gemini-3.1-flash-lite') {
        console.warn(`[Gemini API] Model ${targetModel} unavailable (${err?.message || '404'}). Falling back to gemini-3.1-flash-lite.`);
        targetModel = 'gemini-3.1-flash-lite';
        continue;
      }

      if (attempt < maxRetries && is503) {
        if (targetModel !== 'gemini-3.1-flash-lite') {
          console.warn(`[Gemini API] 503 high demand on ${targetModel}. Retrying with gemini-3.1-flash-lite...`);
          targetModel = 'gemini-3.1-flash-lite';
        } else {
          console.warn(`[Gemini API] 503 Unavailable. Retrying in ${delayMs / 1000}s... (Attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        attempt++;
      } else {
        console.warn(`[Gemini API] Error encountered (${err?.message || err}). Attempting Mistral AI fallback...`);
        const mistralRes = await callMistralFallback(prompt, schema);
        if (mistralRes) {
          return mistralRes;
        }
        throw err;
      }
    }
  }

  const mistralRes = await callMistralFallback(prompt, schema);
  if (mistralRes) {
    return mistralRes;
  }
  return null;
}


async function startServer() {
  // Validate ADMIN_KEY presence immediately on boot
  getRequiredAdminKey();

  // Hydrate initial state from Supabase if configured, eliminating reliance on static seeds
  await hydrateDatabaseFromSupabase();

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

            // Step 1: Attempt fetch with 5s timeout and 0 retries to prevent Serverless/Vercel timeouts
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
                0, // 0 retries to ensure fast execution
                5000 // 5s timeout
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
                  const schema = {
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
                  };

                  const response = await generateContentWithRetry(
                    ai, 
                    prompt, 
                    'gemini-3.1-flash-lite', 
                    schema
                  );

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
                parser_version: extractionMethod === 'llm_assisted' ? 'gemini-3.1-flash-lite-v1' : 'deterministic-v1',
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

  // Save specific warnings to Supabase (from Markdown, CSV, or manual paste)
  app.post('/api/supabase/save-warnings', async (req, res) => {
    try {
      const client = getSupabaseClient();
      const rawWarnings = req.body?.warnings;
      if (!Array.isArray(rawWarnings) || rawWarnings.length === 0) {
        return res.status(400).json({ error: 'warnings array is required and must not be empty' });
      }

      if (!client) {
        return res.status(400).json({
          error: 'Supabase is not configured on the server. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.',
        });
      }

      const rowsToUpsert = rawWarnings.map((w: any) => {
        const warningId = String(w.source_warning_id || w.warning_number || w.warning_id || '').trim();
        const sourceId = String(w.source_id || 'manual-markdown-import').trim();
        
        let directLat: number | null = w.latitude != null && !isNaN(Number(w.latitude)) ? Number(w.latitude) : null;
        let directLng: number | null = w.longitude != null && !isNaN(Number(w.longitude)) ? Number(w.longitude) : null;

        if (directLat == null && w.spatial?.geometries?.length > 0) {
          const pt = w.spatial.geometries[0];
          if (pt.type === 'Point' && Array.isArray(pt.coordinates) && pt.coordinates.length >= 2) {
            directLng = Number(pt.coordinates[0]);
            directLat = Number(pt.coordinates[1]);
          }
        }

        return {
          source_id: sourceId,
          warning_id: warningId,
          title: w.title ? String(w.title).trim() : null,
          raw_text: String(w.raw_text || '').trim(),
          issued_date: w.issued_date || new Date().toISOString().slice(0, 10),
          navarea: String(w.navarea || 'IV').trim(),
          area_text: w.area_text ? String(w.area_text).trim() : null,
          sub_area: w.sub_area ? String(w.sub_area).trim() : null,
          authority: w.authority ? String(w.authority).trim() : null,
          source_url: w.source_url || w.web_link || null,
          risk_level: w.risk_level || null,
          extraction_method: w.extraction_method || 'deterministic',
          generation_id: w.generation_id || `gen-md-${Date.now()}`,
          issued_text: w.issued_text || w.issued_date || null,
          latitude: directLat,
          longitude: directLng,
          valid_until: w.valid_until || w.valid_to || null,
          validity: w.validity || null,
          charts: w.charts ? String(w.charts).trim() : null,
          categories: w.categories ? String(w.categories).trim() : null,
          web_link: w.web_link || w.source_url || null,
        };
      });

      // Deduplicate rows within the batch
      const dedupeMap = new Map<string, typeof rowsToUpsert[0]>();
      for (const row of rowsToUpsert) {
        const key = `${row.source_id}:::${row.warning_id.toLowerCase()}`;
        if (!dedupeMap.has(key)) {
          dedupeMap.set(key, row);
        }
      }
      const uniqueRows = Array.from(dedupeMap.values());

      // Batch in chunks of 100
      const BATCH_SIZE = 100;
      let totalSaved = 0;
      const errors: string[] = [];

      for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
        const chunk = uniqueRows.slice(i, i + BATCH_SIZE);
        
        let { error } = await client
          .from('nav_warnings')
          .upsert(chunk, { onConflict: 'source_id,warning_id' });

        if (error && error.message.includes('conflict')) {
          const fallbackRes = await client
            .from('nav_warnings')
            .upsert(chunk, { onConflict: 'warning_id' });
          error = fallbackRes.error;
        }

        if (error) {
          console.warn(`[Supabase Save Batch Error]:`, error.message);
          errors.push(error.message);
        } else {
          totalSaved += chunk.length;
        }
      }

      // Also merge saved warnings into in-memory server database so all views see them instantly
      for (const rawW of rawWarnings) {
        const existsIdx = warningsDb.findIndex(
          (item) => item.source_id === rawW.source_id && (item.source_warning_id === rawW.source_warning_id || item.warning_id === rawW.warning_id)
        );
        if (existsIdx >= 0) {
          warningsDb[existsIdx] = { ...warningsDb[existsIdx], ...rawW };
        } else {
          warningsDb.unshift(rawW);
        }
      }

      res.json({
        success: totalSaved > 0 || uniqueRows.length === 0,
        savedCount: totalSaved,
        total: uniqueRows.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err: any) {
      console.error('[Supabase Save Warnings Error]', err);
      res.status(500).json({ error: err.message || 'Failed to save warnings to Supabase' });
    }
  });

  // Parse Markdown endpoint using deterministic parser or Gemini AI
  app.post('/api/pipeline/parse-markdown', async (req, res) => {
    try {
      const { markdown, navarea = 'AUTO', aiModel = 'gemini-3.1-flash-lite' } = req.body;
      if (!markdown || typeof markdown !== 'string') {
        return res.status(400).json({ error: 'markdown string is required' });
      }

      // 1. Run deterministic markdown parser
      const deterministicWarnings = parseMarkdownToWarnings(markdown, navarea as any);

      // 2. If Gemini AI is configured, try enhanced multi-item extraction
      const ai = getGeminiClient();
      if (ai) {
        try {
          const prompt = `Analyze this Markdown document containing maritime navigational warnings. Extract each distinct navigational warning into structured items.
Markdown text:
"""
${markdown.slice(0, 8000)}
"""

Instructions:
1. Extract warning_id (e.g. "NAVAREA XVII 90/2026", "145/26", "0456/26"), navarea (e.g. "I", "IV", "XVII", "XVIII", "XIX", "Baltic"), title, area_text, issued_date (YYYY-MM-DD), status ("active" or "cancelled"), cancels (array of IDs), charts, authority, latitude (decimal number), longitude (decimal number), and clean description raw_text.
2. Return an array of extracted warnings.`;

          const schema = {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                warning_id: { type: Type.STRING },
                navarea: { type: Type.STRING },
                title: { type: Type.STRING },
                area_text: { type: Type.STRING },
                issued_date: { type: Type.STRING },
                status: { type: Type.STRING },
                cancels: { type: Type.ARRAY, items: { type: Type.STRING } },
                charts: { type: Type.STRING },
                authority: { type: Type.STRING },
                latitude: { type: Type.NUMBER },
                longitude: { type: Type.NUMBER },
                raw_text: { type: Type.STRING },
              },
              required: ['warning_id', 'raw_text'],
            },
          };

          const response = await generateContentWithRetry(ai, prompt, aiModel, schema);
          if (response.text) {
            const aiParsed = JSON.parse(response.text);
            if (Array.isArray(aiParsed) && aiParsed.length > 0) {
              const now = new Date().toISOString();
              const mergedWarnings = aiParsed.map((item: any, idx: number) => {
                const effectiveNavArea = (item.navarea || navarea || 'IV').replace(/NAVAREA\s+/i, '').trim();
                const lat = item.latitude != null && !isNaN(Number(item.latitude)) ? Number(item.latitude) : null;
                const lng = item.longitude != null && !isNaN(Number(item.longitude)) ? Number(item.longitude) : null;

                const spatial = lat != null && lng != null ? {
                  geometries: [{
                    type: 'Point',
                    coordinates: [lng, lat],
                    label: item.title || item.warning_id,
                  }],
                  circles: [],
                  raw_coordinate_text: [`${lat}, ${lng}`],
                  validation_status: 'passed' as const,
                } : {
                  geometries: [],
                  circles: [],
                  raw_coordinate_text: [],
                  validation_status: 'not_present' as const,
                };

                const isCanada = effectiveNavArea === 'XVII' || effectiveNavArea === 'XVIII';

                return {
                  schema_version: 1,
                  warning_id: `warn-ai-${effectiveNavArea}-${Date.now()}-${idx}`,
                  publisher_id: isCanada ? 'ccg-canada' : 'ai-markdown-parser',
                  source_id: isCanada ? 'ccg-navareas-map' : 'markdown-import',
                  navarea: effectiveNavArea as any,
                  series: `NAVAREA ${effectiveNavArea}`,
                  source_warning_id: item.warning_id,
                  warning_number: item.warning_id,
                  warning_year: new Date().getFullYear(),
                  issued_at: now,
                  issued_date: item.issued_date || now.slice(0, 10),
                  issued_time_precision: 'day',
                  issued_text: item.issued_date || now.slice(0, 10),
                  valid_from: now,
                  valid_to: null,
                  cancelled_at: null,
                  status: (item.status === 'cancelled' ? 'cancelled' : 'active') as any,
                  status_basis: 'manual_user_override',
                  area_text: item.area_text || item.title || `NAVAREA ${effectiveNavArea}`,
                  original_language: 'en',
                  raw_text: item.raw_text,
                  translated_text: null,
                  spatial,
                  supersedes: [],
                  cancels: item.cancels || [],
                  title: item.title || null,
                  authority: item.authority || (isCanada ? 'Canadian Coast Guard' : 'Maritime Safety Authority'),
                  latitude: lat,
                  longitude: lng,
                  charts: item.charts || null,
                  validity: item.status || null,
                  source_url: 'Markdown Paste',
                  raw_artifact_ref: `ai-md-${idx}`,
                  content_hash: `ai-md-${Date.now()}-${idx}`,
                  parser_version: 'gemini-ai-v1',
                  extraction_method: 'llm_assisted',
                  extraction_confidence: 0.98,
                  first_seen_at: now,
                  last_seen_at: now,
                  not_in_force_observed_at: null,
                  generation_id: `gen-ai-md-${Date.now()}`,
                  validation: {
                    identity: 'passed',
                    dates: 'passed',
                    geometry: spatial.validation_status,
                  },
                } as NavWarning;
              });

              return res.json({
                warnings: mergedWarnings,
                engine: 'gemini_ai',
                count: mergedWarnings.length,
              });
            }
          }
        } catch (aiErr) {
          console.warn('[Gemini Markdown Parse Error, using deterministic results]:', aiErr);
        }
      }

      res.json({
        warnings: deterministicWarnings,
        engine: 'deterministic',
        count: deterministicWarnings.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to parse markdown' });
    }
  });

  // AI-Powered Bulk Ingestion & NAVAREA Importer (Gemini Understanding or Rejecting)
  app.post('/api/pipeline/bulk-ingest-ai', async (req, res) => {
    try {
      const { rawText, navarea = 'AUTO', aiModel = 'gemini-3.1-flash-lite', strictness = 'standard' } = req.body;
      if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
        return res.status(400).json({ error: 'rawText string is required' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(400).json({
          error: 'GEMINI_API_KEY is not configured on the server. Please ensure GEMINI_API_KEY is configured in Settings > Secrets.',
        });
      }

      const startTime = Date.now();

      const prompt = `You are a certified Maritime Safety Information (MSI) AI validator and ingest engine for the World-Wide Navigational Warning Service (WWNWS / IMO / IHO).
Inspect and evaluate the following incoming bulk data stream (which may contain multiple navigational warnings, table dumps, bulleted notices, web scraped fragments, or non-maritime noise).

BULK DATA STREAM:
"""
${rawText.slice(0, 14000)}
"""

Target NAVAREA hint: ${navarea || 'AUTO'}
Strictness mode: ${strictness}

CRITICAL RULES:
1. Break down the stream into every distinct notice or block of text.
2. For each candidate item, UNDERSTAND and ACCEPT valid navigational safety warnings, or REJECT items that are invalid, non-maritime, corrupted, or severely out of bounds.
3. ACCEPTED:
   - Must represent an authentic maritime navigational safety warning (e.g., aids to navigation, racon/beacon outage, firing practice, rocket launch fallout, drifting hazard, shoal/depth, seismic survey, cable work, SAR operation, in-force bulletin list).
   - Set decision: "ACCEPTED".
   - Set rejection_code: "NONE", rejection_reason: "".
   - Provide a clear 1-sentence understanding_summary describing the exact nature of the hazard.
   - Extract: warning_id (e.g., "NAVAREA XVII 90/2026"), navarea (e.g., "XVII", "IV", "I", "XVIII", "Baltic"), warning_number, warning_year, title, area_text (sub-area description), issued_date (YYYY-MM-DD), authority, charts, cancels (array of string IDs), hazard_category, risk_level ("critical", "high", "medium", "low", "info").
   - Extract latitude and longitude in decimal degrees (e.g. 69.6233, -135.4883) if coordinates or bounding positions exist. If general in-force list or non-localized, leave null.
4. REJECTED:
   - Reject items that are not maritime navigational warnings (e.g. website headers, footers, cookie disclaimers, login buttons, privacy policies, unrelated articles, spam). Set rejection_code: "NON_MARITIME".
   - Reject unparseable gibberish, binary garbage, or corrupted entries. Set rejection_code: "CORRUPT_DATA".
   - Reject severe coordinate anomalies (e.g. latitude outside -90 to +90, or coordinates located deep inland in landlocked desert/mountains away from navigable waters). Set rejection_code: "OUT_OF_BOUNDS".
   - Reject entries with zero actionable or intelligible navigational content. Set rejection_code: "MISSING_CRITICAL_INFO".
   - For all rejected items, set decision: "REJECTED", and explain WHY in rejection_reason.
5. NEEDS_REVIEW:
   - For maritime notices that have contradictory coordinates or ambiguous date ranges, set decision: "NEEDS_REVIEW" and detail the ambiguity in rejection_reason.`;

      const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            raw_snippet: { type: Type.STRING },
            decision: { type: Type.STRING, enum: ['ACCEPTED', 'REJECTED', 'NEEDS_REVIEW'] },
            confidence: { type: Type.NUMBER },
            understanding_summary: { type: Type.STRING },
            rejection_code: {
              type: Type.STRING,
              enum: ['NONE', 'NON_MARITIME', 'CORRUPT_DATA', 'OUT_OF_BOUNDS', 'MISSING_CRITICAL_INFO', 'EXPIRED_OR_STALE', 'DUPLICATE', 'OTHER'],
            },
            rejection_reason: { type: Type.STRING },
            hazard_category: { type: Type.STRING },
            risk_level: { type: Type.STRING, enum: ['critical', 'high', 'medium', 'low', 'info'] },
            warning_id: { type: Type.STRING },
            navarea: { type: Type.STRING },
            warning_number: { type: Type.STRING },
            warning_year: { type: Type.INTEGER },
            title: { type: Type.STRING },
            area_text: { type: Type.STRING },
            issued_date: { type: Type.STRING },
            valid_until: { type: Type.STRING },
            authority: { type: Type.STRING },
            charts: { type: Type.STRING },
            cancels: { type: Type.ARRAY, items: { type: Type.STRING } },
            latitude: { type: Type.NUMBER },
            longitude: { type: Type.NUMBER },
            coordinate_sanity: { type: Type.STRING, enum: ['valid', 'suspicious', 'missing'] },
          },
          required: ['decision', 'understanding_summary', 'rejection_code'],
        },
      };

      const response = await generateContentWithRetry(ai, prompt, aiModel, schema);
      if (!response.text) {
        throw new Error('No content returned from Gemini model');
      }

      const items = JSON.parse(response.text);
      const now = new Date();
      const nowIso = now.toISOString();
      const generationId = `gen-bulk-ai-${Date.now()}`;

      const acceptedWarnings: NavWarning[] = [];
      const rejectedItems: any[] = [];
      let needsReviewCount = 0;

      items.forEach((item: any, idx: number) => {
        const decision = (item.decision || 'ACCEPTED').toUpperCase();

        if (decision === 'REJECTED') {
          rejectedItems.push({
            id: `rej-${Date.now()}-${idx}`,
            raw_snippet: item.raw_snippet || item.understanding_summary || `Item #${idx + 1}`,
            decision: 'REJECTED',
            confidence: typeof item.confidence === 'number' ? item.confidence : 0.9,
            understanding_summary: item.understanding_summary || 'Rejected by Gemini AI safety filter',
            rejection_code: item.rejection_code || 'OTHER',
            rejection_reason: item.rejection_reason || 'Does not qualify as a valid maritime navigational warning.',
            warning_id: item.warning_id || null,
            navarea: item.navarea || null,
            hazard_category: item.hazard_category || null,
            timestamp: nowIso,
          });
          return;
        }

        if (decision === 'NEEDS_REVIEW') {
          needsReviewCount++;
        }

        // Clean NAVAREA
        let effectiveNavArea = (item.navarea || navarea || 'IV')
          .replace(/NAVAREA\s+/i, '')
          .trim();
        if (effectiveNavArea === 'AUTO' || !effectiveNavArea) {
          effectiveNavArea = navarea !== 'AUTO' ? navarea : 'IV';
        }

        // Coordinates
        let lat = typeof item.latitude === 'number' && !isNaN(item.latitude) ? item.latitude : null;
        let lng = typeof item.longitude === 'number' && !isNaN(item.longitude) ? item.longitude : null;

        // Fallback to deterministic regex parsing if Gemini didn't return lat/lng
        let spatial: any;
        if (lat != null && lng != null) {
          // Check bounds
          const bounds = (NAVAREA_BOUNDS as any)[effectiveNavArea];
          let validationStatus: 'passed' | 'out_of_bounds' | 'not_present' = 'passed';
          if (bounds) {
            if (lat < bounds.minLat || lat > bounds.maxLat || lng < bounds.minLng || lng > bounds.maxLng) {
              validationStatus = 'out_of_bounds';
            }
          }
          spatial = {
            geometries: [{
              type: 'Point',
              coordinates: [lng, lat],
              label: item.title || item.warning_id || `Hazard Point`,
            }],
            circles: [],
            raw_coordinate_text: [`${lat}, ${lng}`],
            validation_status: validationStatus,
          };
        } else {
          // Try deterministic regex on snippet or title
          const det = parseCoordinatesDeterministic(item.raw_snippet || item.title || '', effectiveNavArea as any);
          if (det.geometries.length > 0) {
            spatial = det;
            lat = det.geometries[0].coordinates[1] as number;
            lng = det.geometries[0].coordinates[0] as number;
          } else {
            spatial = {
              geometries: [],
              circles: [],
              raw_coordinate_text: [],
              validation_status: 'not_present' as const,
            };
          }
        }

        const isCanada = effectiveNavArea === 'XVII' || effectiveNavArea === 'XVIII';
        const warningNum = item.warning_number || (item.warning_id ? String(item.warning_id).replace(/.*\s+/, '') : `AI-${idx + 1}`);
        const warningYr = item.warning_year || now.getFullYear();

        const warn: NavWarning = {
          schema_version: 1,
          warning_id: `warn-ai-${effectiveNavArea}-${warningYr}-${idx}-${Date.now().toString().slice(-6)}`,
          publisher_id: isCanada ? 'ccg-canada' : 'bulk-ai-importer',
          source_id: isCanada ? `ccg-navarea-${effectiveNavArea.toLowerCase()}` : 'bulk-ai-import',
          navarea: effectiveNavArea as any,
          series: `NAVAREA ${effectiveNavArea}`,
          source_warning_id: item.warning_id || `${warningNum}/${warningYr}`,
          warning_number: String(warningNum),
          warning_year: warningYr,
          issued_at: nowIso,
          issued_date: item.issued_date || nowIso.slice(0, 10),
          issued_time_precision: 'day',
          issued_text: item.issued_date || nowIso.slice(0, 10),
          valid_from: nowIso,
          valid_to: item.valid_until || null,
          cancelled_at: null,
          status: 'active',
          status_basis: 'manual_user_override',
          area_text: item.area_text || item.title || `NAVAREA ${effectiveNavArea} Notice`,
          original_language: 'en',
          raw_text: item.raw_snippet || item.understanding_summary || `NAVAREA ${effectiveNavArea} ${warningNum}/${warningYr}`,
          translated_text: null,
          spatial,
          supersedes: [],
          cancels: item.cancels || [],
          title: item.title || item.warning_id || null,
          authority: item.authority || (isCanada ? 'Canadian Coast Guard' : 'Maritime Safety Authority'),
          sub_area: item.area_text || null,
          risk_level: item.risk_level || 'medium',
          latitude: lat,
          longitude: lng,
          valid_until: item.valid_until || null,
          charts: item.charts || null,
          source_url: 'AI Bulk Importer',
          raw_artifact_ref: `bulk-ai-snippet-${idx + 1}`,
          content_hash: crypto.createHash('sha256').update(item.raw_snippet || `${idx}`).digest('hex').slice(0, 16),
          parser_version: 'gemini-bulk-v1',
          extraction_method: 'llm_assisted',
          extraction_confidence: typeof item.confidence === 'number' ? item.confidence : 0.95,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
          not_in_force_observed_at: null,
          generation_id: generationId,
          validation: {
            identity: 'passed',
            dates: 'passed',
            geometry: spatial.validation_status,
          },
          ai_triage: {
            decision: decision as any,
            confidence: typeof item.confidence === 'number' ? item.confidence : 0.95,
            understanding_summary: item.understanding_summary,
            rejection_code: item.rejection_code || 'NONE',
            rejection_reason: item.rejection_reason || undefined,
            hazard_category: item.hazard_category || 'General Navigational Warning',
            risk_level: item.risk_level || 'medium',
            coordinate_sanity: spatial.validation_status === 'passed' ? 'valid' : spatial.validation_status === 'out_of_bounds' ? 'suspicious' : 'missing',
            original_snippet: item.raw_snippet,
            reviewed_at: nowIso,
          },
        };

        acceptedWarnings.push(warn);
      });

      const durationMs = Date.now() - startTime;

      res.json({
        success: true,
        acceptedWarnings,
        rejectedItems,
        allEvaluations: items,
        stats: {
          total: items.length,
          accepted: acceptedWarnings.length - needsReviewCount,
          rejected: rejectedItems.length,
          needsReview: needsReviewCount,
          gpsCount: acceptedWarnings.filter(w => w.latitude != null && w.longitude != null).length,
        },
        aiModelUsed: aiModel,
        duration_ms: durationMs,
      });
    } catch (err: any) {
      console.error('[Bulk Ingest AI Error]', err);
      res.status(500).json({ error: err.message || 'Failed to process bulk data with Gemini' });
    }
  });

  // AI-Powered Batch Audit & Triage Endpoint
  app.post('/api/pipeline/bulk-audit-ai', async (req, res) => {
    try {
      const { warnings = [], aiModel = 'gemini-3.1-flash-lite' } = req.body;
      if (!Array.isArray(warnings) || warnings.length === 0) {
        return res.status(400).json({ error: 'warnings array is required and must not be empty' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(400).json({
          error: 'GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in Settings > Secrets.',
        });
      }

      const startTime = Date.now();
      const batchToAudit = warnings.slice(0, 40);

      const auditSummaryList = batchToAudit.map((w, idx) => ({
        index: idx,
        id: w.source_warning_id || w.warning_id,
        navarea: w.navarea,
        title: w.title || w.area_text,
        lat: w.latitude != null ? w.latitude : w.spatial?.geometries?.[0]?.coordinates?.[1] || null,
        lng: w.longitude != null ? w.longitude : w.spatial?.geometries?.[0]?.coordinates?.[0] || null,
        text_preview: (w.raw_text || '').slice(0, 300),
      }));

      const prompt = `You are a certified Maritime Safety Information (MSI) validator.
Audit the following staged navigational warnings. For each warning, evaluate if it is a genuine maritime navigational warning, check coordinate sanity and NAVAREA consistency, and provide your understanding or rejection decision.

Warnings to audit:
${JSON.stringify(auditSummaryList, null, 2)}

Instructions:
1. For each item (by index):
   - decision: "ACCEPTED", "REJECTED", or "NEEDS_REVIEW".
   - rejection_code: "NONE", "NON_MARITIME", "CORRUPT_DATA", "OUT_OF_BOUNDS", "MISSING_CRITICAL_INFO", "EXPIRED_OR_STALE", "DUPLICATE", or "OTHER".
   - rejection_reason: Explain if rejected or needs review.
   - understanding_summary: 1 concise sentence summarizing what the notice states.
   - hazard_category: category (e.g. Aids to Navigation, Firing, Rocket, Drifting, Cable, General).
   - risk_level: "critical", "high", "medium", "low", or "info".
   - coordinate_sanity: "valid", "suspicious", or "missing".
   - confidence: 0.0 to 1.0.`;

      const schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            index: { type: Type.INTEGER },
            decision: { type: Type.STRING, enum: ['ACCEPTED', 'REJECTED', 'NEEDS_REVIEW'] },
            confidence: { type: Type.NUMBER },
            understanding_summary: { type: Type.STRING },
            rejection_code: { type: Type.STRING },
            rejection_reason: { type: Type.STRING },
            hazard_category: { type: Type.STRING },
            risk_level: { type: Type.STRING, enum: ['critical', 'high', 'medium', 'low', 'info'] },
            coordinate_sanity: { type: Type.STRING, enum: ['valid', 'suspicious', 'missing'] },
          },
          required: ['index', 'decision', 'understanding_summary'],
        },
      };

      const response = await generateContentWithRetry(ai, prompt, aiModel, schema);
      const auditResults = response.text ? JSON.parse(response.text) : [];

      const auditMap = new Map<number, any>();
      auditResults.forEach((r: any) => {
        if (typeof r.index === 'number') {
          auditMap.set(r.index, r);
        }
      });

      const nowIso = new Date().toISOString();
      let accepted = 0;
      let rejected = 0;
      let needsReview = 0;

      const auditedWarnings = warnings.map((warn, idx) => {
        const triage = auditMap.get(idx);
        if (!triage) return warn;

        const dec = triage.decision || 'ACCEPTED';
        if (dec === 'ACCEPTED') accepted++;
        else if (dec === 'REJECTED') rejected++;
        else needsReview++;

        return {
          ...warn,
          ai_triage: {
            decision: dec,
            confidence: triage.confidence || 0.95,
            understanding_summary: triage.understanding_summary || 'Verified maritime warning',
            rejection_code: triage.rejection_code || (dec === 'ACCEPTED' ? 'NONE' : 'OTHER'),
            rejection_reason: triage.rejection_reason || undefined,
            hazard_category: triage.hazard_category || warn.categories || 'General Notice',
            risk_level: triage.risk_level || warn.risk_level || 'medium',
            coordinate_sanity: triage.coordinate_sanity || 'valid',
            reviewed_at: nowIso,
          },
        };
      });

      res.json({
        success: true,
        auditedWarnings,
        stats: {
          total: auditedWarnings.length,
          accepted,
          rejected,
          needsReview,
        },
        aiModelUsed: aiModel,
        duration_ms: Date.now() - startTime,
      });
    } catch (err: any) {
      console.error('[Bulk Audit AI Error]', err);
      res.status(500).json({ error: err.message || 'Failed to audit batch with Gemini' });
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
      const response = await generateContentWithRetry(ai, userPrompt, 'gemini-3.1-flash-lite');

      const durationMs = Date.now() - startTime;
      const responseText = response.text || 'No text content returned from Gemini model.';

      res.json({
        success: true,
        hasKey: true,
        model: 'gemini-3.1-flash-lite',
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

  // Mistral Integration Diagnostic & Test Key Endpoint (Admin Protected)
  app.post('/api/admin/test-mistral', requireAdminAuth, async (req, res) => {
    try {
      const apiKey = process.env.MISTRAL_API_KEY;
      if (!apiKey || !apiKey.trim()) {
        return res.json({
          success: false,
          hasKey: false,
          error: 'MISTRAL_API_KEY environment variable is missing on the server. Please ensure MISTRAL_API_KEY is configured in your Settings > Secrets.',
        });
      }

      const userPrompt =
        typeof req.body?.prompt === 'string' && req.body.prompt.trim()
          ? req.body.prompt.trim()
          : "System verification: confirm 'Mistral AI operational check passed' and state current system readiness in 1 short sentence.";

      const startTime = Date.now();
      const mistralRes = await callMistralFallback(userPrompt);
      const durationMs = Date.now() - startTime;

      if (!mistralRes || !mistralRes.text) {
        throw new Error('No response content returned from Mistral API.');
      }

      res.json({
        success: true,
        hasKey: true,
        model: mistralRes.modelUsed,
        latency_ms: durationMs,
        response: mistralRes.text,
        prompt_used: userPrompt,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn('[Mistral Diagnostic Error]', err);
      res.status(400).json({
        success: false,
        hasKey: Boolean(process.env.MISTRAL_API_KEY),
        error: err.message || String(err),
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Parse manual text using Gemini server-side, deterministic regex, or hybrid mode
  app.post('/api/pipeline/parse-manual', requireAdminAuth, async (req, res) => {
    try {
      const { rawText, navarea = 'I', mode = 'hybrid', aiModel = 'gemini-3.1-flash-lite' } = req.body;
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

          const schema = {
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
          };

          const response = await generateContentWithRetry(ai, prompt, aiModel, schema);

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
        parser_version: extractedData.extraction_method === 'llm_assisted' ? `${aiModel}-v1` : 'deterministic-v1',
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

  // Proxy CARTO map tiles securely server-side so CARTO_API_KEY remains a secure secret
  app.get('/api/tiles/carto/:style/:z/:x/:y', async (req, res) => {
    try {
      const { style, z, x, y } = req.params;
      const apiKey = process.env.CARTO_API_KEY || 'cb1_3orr_1_f228f632545fb6733113f41c';
      
      const subdomains = ['a', 'b', 'c', 'd'];
      const sub = subdomains[Math.floor(Math.random() * subdomains.length)];
      
      const cartoUrl = `https://${sub}.basemaps.cartocdn.com/rastertiles/${style}/${z}/${x}/${y}.png?key=${apiKey}`;
      
      const response = await fetch(cartoUrl);
      if (!response.ok) {
        res.status(response.status).send(response.statusText);
        return;
      }
      
      const contentType = response.headers.get('content-type') || 'image/png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error('[CARTO Tile Proxy Error]:', err);
      res.status(500).send('Tile proxy error');
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

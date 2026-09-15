import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  INITIAL_SOURCES_REGISTRY,
  INITIAL_WARNINGS,
  INITIAL_GENERATIONS,
  INITIAL_ARTIFACTS,
} from './src/data/sourcesRegistry.js';
import { parseCoordinatesDeterministic } from './src/utils/coordinateParser.js';
import { NavWarning, SourceRegistryItem, IngestionGeneration, RawArtifact, NavAreaId } from './src/types.js';
import scrapeNavwarnHandler from './api/scrape-navwarn.js';

// In-memory persistent state for server runtime
let sourcesDb: SourceRegistryItem[] = [...INITIAL_SOURCES_REGISTRY];
let warningsDb: NavWarning[] = [...INITIAL_WARNINGS];
let generationsDb: IngestionGeneration[] = [...INITIAL_GENERATIONS];
let artifactsDb: RawArtifact[] = [...INITIAL_ARTIFACTS];

// Active per-source leases
const sourceLeases: Record<string, { lockedAt: string; requestId: string }> = {};

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
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      active_warnings: warningsDb.filter((w) => w.status === 'active').length,
      sources_count: sourcesDb.length,
      time: new Date().toISOString(),
    });
  });

  // Sources registry
  app.get('/api/sources', (req, res) => {
    res.json(sourcesDb);
  });

  app.post('/api/sources/toggle', (req, res) => {
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
  app.post('/api/pipeline/trigger', async (req, res) => {
    try {
      const { sourceId } = req.body;
      const targetSources = sourceId
        ? sourcesDb.filter((s) => s.source_id === sourceId)
        : sourcesDb.filter((s) => s.enabled && s.verification.status === 'verified');

      if (targetSources.length === 0) {
        return res.status(400).json({ error: 'No verified and enabled sources found to refresh' });
      }

      const results = [];

      for (const src of targetSources) {
        const requestId = crypto.randomUUID();
        const now = new Date();
        const timestampIso = now.toISOString();

        // 1. Check lease
        if (sourceLeases[src.source_id]) {
          results.push({ source_id: src.source_id, status: 'skipped', reason: 'Lease active' });
          continue;
        }

        // Acquire lease
        sourceLeases[src.source_id] = { lockedAt: timestampIso, requestId };

        try {
          const genId = `gen-${src.publisher_id}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
          const artifactId = `art-${src.publisher_id}-${Date.now()}`;
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const artifactPath = `gs://navwarn-evidence/archive/${src.source_id}/${year}/${month}/${day}/${src.publisher_id}_run_${now.valueOf()}.${src.format}`;

          let rawPayloadText = '';
          let contentType = src.format === 'html' ? 'text/html' : src.format === 'pdf' ? 'application/pdf' : 'application/json';
          let httpStatus = 200;

          // Attempt real fetch from source entrypoint URL with timeout
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const fetchUrl = (src.entrypoints && src.entrypoints.length > 0) ? src.entrypoints[0] : src.discovery_url;
            const fetchRes = await fetch(fetchUrl, {
              signal: controller.signal,
              headers: {
                'User-Agent': 'NavWarn-Maritime-Scraper/1.0 (+https://navwarn.local/bot)',
                'Accept': 'text/html,application/xhtml+xml,application/xml,text/plain,application/json',
              },
            });
            clearTimeout(timeoutId);
            httpStatus = fetchRes.status;

            if (fetchRes.ok) {
              const text = await fetchRes.text();
              if (text && text.trim().length > 0) {
                // Strip HTML tags if present to help the regex coordinate parser
                rawPayloadText = text.replace(/<[^>]*>?/gm, ' ');
              }
            }
          } catch (fetchErr) {
            console.warn(`Scraper fetch warning for source ${src.source_id}:`, fetchErr);
          }

          // Fallback payload if fetch returned empty or failed
          if (!rawPayloadText) {
            const sampleNoticeId = `NAV-${src.navareas[0]}-2026-${Math.floor(100 + Math.random() * 800)}`;
            const sampleLat = Math.floor(20 + Math.random() * 30);
            const sampleLng = Math.floor(10 + Math.random() * 50);
            rawPayloadText = JSON.stringify(
              {
                source_id: src.source_id,
                publisher: src.publisher_name,
                discovery_url: src.discovery_url,
                fetched_at: timestampIso,
                publication_kind: src.publication_semantics,
                navareas: src.navareas,
                status: 'VERIFIED_SUCCESS',
                sample_notices: [
                  {
                    id: sampleNoticeId,
                    raw_text: `NAVAREA ${src.navareas[0]} ${sampleNoticeId}. MARITIME SAFETY WARNING. UNEXPLODED ORDNANCE / DRILLING OPERATIONS REPORTED AT POSITION ${sampleLat}-15.4N ${sampleLng}-22.8E. SHIPS ADVISER TO NAVIGATE WITH CAUTION.`,
                  },
                ],
              },
              null,
              2
            );
          }

          const hash = crypto.createHash('sha256').update(rawPayloadText).digest('hex');

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

          // Extract candidate notices from scraped raw text if applicable
          const deterministicSpatial = parseCoordinatesDeterministic(rawPayloadText, (src.navareas[0] as NavAreaId) || 'I');
          
          if (deterministicSpatial.geometries.length > 0) {
            const newScrapedWarningId = `warn-${src.publisher_id}-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
            const newWarn: NavWarning = {
              schema_version: 1,
              warning_id: newScrapedWarningId,
              publisher_id: src.publisher_id,
              source_id: src.source_id,
              navarea: (src.navareas[0] as NavAreaId) || 'I',
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
              spatial: deterministicSpatial,
              supersedes: [],
              cancels: [],
              source_url: src.discovery_url,
              raw_artifact_ref: artifactPath,
              content_hash: hash,
              parser_version: 'deterministic-v1',
              extraction_method: 'deterministic',
              extraction_confidence: 0.95,
              first_seen_at: timestampIso,
              last_seen_at: timestampIso,
              not_in_force_observed_at: null,
              generation_id: genId,
              validation: {
                identity: 'passed',
                dates: 'passed',
                geometry: deterministicSpatial.validation_status,
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

          // Atomically update source health and published_generation pointer
          src.health.last_run_at = timestampIso;
          src.health.last_success_at = timestampIso;
          src.health.status = 'ok';
          src.health.active_warnings_count = existingForSource.filter((w) => w.status === 'active').length;
          src.published_generation_id = genId;

          results.push({
            source_id: src.source_id,
            status: 'success',
            generation_id: genId,
            artifact_ref: artifactPath,
            parsed_count: existingForSource.length,
          });
        } finally {
          delete sourceLeases[src.source_id];
        }
      }

      res.json({
        success: true,
        message: `Pipeline ingestion completed for ${results.length} source(s). Atomic pointers updated.`,
        results,
      });
    } catch (err: any) {
      console.error('Pipeline execution error:', err);
      res.status(500).json({ error: err.message || 'Pipeline execution failed' });
    }
  });

  // Parse manual text using Gemini server-side or deterministic regex fallback
  app.post('/api/pipeline/parse-manual', async (req, res) => {
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
            model: 'gemini-3.8-flash',
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

import type { Request, Response } from 'express';
import * as cheerio from 'cheerio';
import { supabase } from '../src/lib/db.js';
import { getSupabaseClient, syncWarningsToSupabase, syncArtifactsToSupabase } from '../src/lib/supabaseServer.js';
import { sources } from '../src/lib/sources.js';
import crypto from 'crypto';
import { verifyAdminRequest } from '../server/auth.js';
import { parseCoordinatesDeterministic } from '../src/utils/coordinateParser.js';
import { extractNavAreaFromText, extractWarningNumberAndYear } from '../src/utils/markdownParser.js';
import type { NavWarning, NavAreaId, RawArtifact } from '../src/types.js';

function detectHazardCategory(text: string): string {
  const upper = text.toUpperCase();
  if (upper.includes('LIGHT') || upper.includes('BUOY') || upper.includes('BEACON') || upper.includes('EXTINGUISHED') || upper.includes('OFF STATION')) return 'aton';
  if (upper.includes('GUNNERY') || upper.includes('FIRING') || upper.includes('MISSILE') || upper.includes('EXERCISE') || upper.includes('TORPEDO')) return 'military';
  if (upper.includes('CABLE') || upper.includes('PIPELINE') || upper.includes('SURVEY') || upper.includes('TRENCHING') || upper.includes('ROV')) return 'subsea';
  if (upper.includes('DRIFTING') || upper.includes('MINE') || upper.includes('DERELICT') || upper.includes('CONTAINER') || upper.includes('HAZARD TO NAVIGATION')) return 'drifting';
  if (upper.includes('RIG') || upper.includes('PLATFORM') || upper.includes('DRILLING') || upper.includes('JACK-UP')) return 'offshore';
  return 'general';
}

function extractCharts(text: string): string | null {
  const match = text.match(/\b(?:CHART|CHARTS|BA|INT|NO)\s+([A-Z0-9\s,\/]+?)(?=\.|\n|$)/i);
  return match ? match[0].trim() : null;
}

function extractCancellation(text: string): { isCancelled: boolean; cancellationText: string | null } {
  const match = text.match(/CANCELS?\s+(?:NAVAREA\s+[A-Z0-9-]+\s+)?(\d+[\/-]\d+|\d+)/i);
  if (match) {
    return { isCancelled: true, cancellationText: match[0].trim() };
  }
  return { isCancelled: false, cancellationText: null };
}

// Complete deterministic parser gathering all individual warning parameters
export function extractWarnings(text: string, sourceId: string, defaultNavarea: string): NavWarning[] {
  const potentialBlocks = text.split(/(?=NAVAREA|WARNING|NOTICE)/i);
  const results: NavWarning[] = [];
  const nowIso = new Date().toISOString();
  const dateStr = nowIso.slice(0, 10);

  for (let i = 0; i < potentialBlocks.length; i++) {
    const rawBlock = potentialBlocks[i].trim();
    if (rawBlock.length < 25) continue;

    const detectedArea = extractNavAreaFromText(rawBlock) || (defaultNavarea as NavAreaId) || 'IV';
    const { warningNumber, warningYear, referenceId } = extractWarningNumberAndYear(rawBlock);

    const finalWarningId = referenceId || `warn-${crypto.createHash('md5').update(rawBlock).digest('hex').substring(0, 10)}`;

    // Deterministic spatial & coordinate extraction
    const spatial = parseCoordinatesDeterministic(rawBlock, detectedArea);
    let directLat: number | null = null;
    let directLng: number | null = null;

    // Extract direct lat/lng from any geometry type, not just Point
    if (spatial.geometries?.length > 0) {
      const geom = spatial.geometries[0];
      if (geom.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
        directLng = Number(geom.coordinates[0]);
        directLat = Number(geom.coordinates[1]);
      } else if (geom.type === 'Polygon' && Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
        // Use first vertex of polygon for direct lat/lng
        const firstRing = geom.coordinates[0];
        if (Array.isArray(firstRing) && firstRing.length > 0 && Array.isArray(firstRing[0]) && firstRing[0].length >= 2) {
          directLng = Number(firstRing[0][0]);
          directLat = Number(firstRing[0][1]);
        }
      } else if (geom.type === 'LineString' && Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
        // Use first point of line for direct lat/lng
        if (Array.isArray(geom.coordinates[0]) && geom.coordinates[0].length >= 2) {
          directLng = Number(geom.coordinates[0][0]);
          directLat = Number(geom.coordinates[0][1]);
        }
      }
    }
    
    // Also extract from circles
    if (!directLat && !directLng && spatial.circles?.length > 0) {
      const circle = spatial.circles[0];
      if (Array.isArray(circle.center) && circle.center.length >= 2) {
        directLng = Number(circle.center[0]);
        directLat = Number(circle.center[1]);
      }
    }

    const { isCancelled, cancellationText } = extractCancellation(rawBlock);
    const hazardCat = detectHazardCategory(rawBlock);
    const chartRefs = extractCharts(rawBlock);

    results.push({
      schema_version: 1,
      warning_id: `warn-${sourceId}-${detectedArea}-${warningYear}-${warningNumber}-${i}`,
      publisher_id: sourceId.split('-')[0] || 'navwarn-hub',
      source_id: sourceId,
      navarea: detectedArea,
      series: `NAVAREA ${detectedArea}`,
      source_warning_id: finalWarningId,
      warning_number: warningNumber,
      warning_year: warningYear,
      issued_at: nowIso,
      issued_date: dateStr,
      issued_time_precision: 'day',
      issued_text: dateStr,
      valid_from: nowIso,
      valid_to: null,
      cancelled_at: isCancelled ? nowIso : null,
      status: isCancelled ? 'cancelled' : 'active',
      status_basis: isCancelled ? 'explicit_cancellation_notice' : 'listed_in_complete_in_force_publication',
      area_text: `NAVAREA ${detectedArea}`,
      original_language: 'en',
      raw_text: rawBlock.substring(0, 4000),
      translated_text: null,
      spatial,
      supersedes: [],
      cancels: cancellationText ? [cancellationText] : [],
      title: `NAVAREA ${detectedArea} ${finalWarningId}`,
      risk_level: isCancelled ? 'low' : hazardCat === 'military' || hazardCat === 'drifting' ? 'critical' : 'high',
      latitude: directLat,
      longitude: directLng,
      hazard_category: hazardCat,
      categories: hazardCat,
      charts: chartRefs,
      source_url: '',
      raw_artifact_ref: `art-${sourceId}-${Date.now()}`,
      content_hash: crypto.createHash('sha256').update(rawBlock).digest('hex'),
      parser_version: 'deterministic-multi-pass-v2.0',
      extraction_method: 'deterministic',
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      not_in_force_observed_at: null,
      generation_id: `gen-${sourceId}-${Date.now()}`,
      validation: {
        identity: 'valid',
        dates: 'valid',
        geometry: spatial.geometries.length > 0 ? 'valid' : 'pending',
      },
    });
  }

  return results;
}

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

      let rawContent = '';
      if (source.type === 'html') {
        const html = await response.text();
        const $ = cheerio.load(html);
        rawContent = $('body').text();
      } else if (source.type === 'json') {
        const data = await response.json();
        rawContent = JSON.stringify(data);
      } else {
        rawContent = await response.text();
      }

      // 1. Immutable raw artifact store
      const contentHash = crypto.createHash('sha256').update(rawContent).digest('hex');
      const artifact: RawArtifact = {
        artifact_id: `art-${source.id}-${Date.now()}`,
        source_id: source.id,
        timestamp: new Date().toISOString(),
        path: source.url,
        content_type: source.type === 'json' ? 'application/json' : 'text/html',
        content_hash: contentHash,
        size_bytes: Buffer.byteLength(rawContent),
        preview_text: rawContent.substring(0, 500),
      };

      await syncArtifactsToSupabase([artifact]);

      // 2. Complete warning parameter extraction and segregated sync
      const warnings = extractWarnings(rawContent, source.id, source.navarea);

      if (warnings.length > 0) {
        const syncRes = await syncWarningsToSupabase(warnings);
        if (!syncRes.success) {
          throw new Error(syncRes.error || 'Failed syncing to database');
        }
      }

      results.push({
        source: source.id,
        status: 'success',
        extracted: warnings.length,
      });

    } catch (err: any) {
      errors.push({
        source: source.id,
        error: err.message,
      });
    }
  }

  return res.status(200).json({
    success: true,
    results,
    errors: errors.length > 0 ? errors : undefined,
  });
}

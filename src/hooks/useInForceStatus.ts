// src/hooks/useInForceStatus.ts
// Phase 5: In-Force Status Computation engine, normalization, caching, and React hook

import { useState, useEffect, useMemo } from 'react';
import type { NavWarning } from '../types';
import type { InForceSnapshot } from '../types/snapshot';
import type { InForceEntry } from '../parsers/inForceListParser';
import { FEATURE_FLAGS } from '../lib/featureFlags';
import { getLatestSnapshot } from '../services/snapshotService';

export interface InForceWarningStatus {
  warningId: string;
  status: 'held_with_geometry' | 'held_without_geometry' | 'held_text_only' | 'not_held';
  hasGeometry: boolean;
  isVerified: boolean;
  inForceEntry?: {
    series_year: number;
    number: number;
    warning_id: string;
  };
  heldWarning?: NavWarning;
}

export interface InForceCoverageSummary {
  listedCount: number;        // Total unique warnings in the in-force list
  heldCount: number;          // Warnings from list that are held in DB
  withGeometryCount: number;  // Held warnings with spatial geometry/coordinates
  verifiedCount: number;      // Held warnings that are verified
  missingCount: number;       // Listed warnings not held in DB
  extraCount: number;         // Active warnings in DB but not in latest snapshot
  coveragePercentage: number; // Math.round((heldCount / listedCount) * 100)
}

export interface InForceStatusResult {
  snapshot: InForceSnapshot | null;
  warnings: InForceWarningStatus[];
  summary: InForceCoverageSummary;
  missingWarningIds: string[];
  extraWarningIds: string[];
  computedAt: Date;
  isLoading: boolean;
  error?: string;
}

/**
 * Normalizes all warning ID format variations into canonical:
 * NAVAREA {AREA} {NUMBER}/{2-DIGIT-YEAR}
 *
 * Handles:
 * - Standard: "NAVAREA IX 364/24" -> "NAVAREA IX 364/24"
 * - 4-digit year: "NAVAREA IX 364/2024" -> "NAVAREA IX 364/24"
 * - Dash-separated without prefix: "IX-364-24" -> "NAVAREA IX 364/24"
 * - Leading zeroes in warning numbers: "NAVAREA IX 001/26" -> "NAVAREA IX 1/26" (strips leading zeroes)
 * - Simple Number/Year only: "364/24" or "364/2024" -> "NAVAREA {defaultNavarea || 'UNKNOWN'} 364/24"
 */
export function normalizeWarningId(warningId: string, defaultNavarea?: string): string {
  if (!warningId || typeof warningId !== 'string') {
    return '';
  }
  const trimmed = warningId.trim();
  if (!trimmed) return '';

  // 1. Full NAVAREA prefix: "NAVAREA IX 364/24", "NAVAREA IX 364/2024", "NAVAREA IX 001/26", "NAVAREA-IX-364-24"
  const navareaPrefixMatch = trimmed.match(
    /^NAVAREA[\s\-_]+([A-Za-z0-9]+)[\s\-_]+(?:NO\.?\s*)?0*(\d+)[/_\-](\d{2,4})$/i
  );
  if (navareaPrefixMatch) {
    const area = navareaPrefixMatch[1].toUpperCase();
    const num = parseInt(navareaPrefixMatch[2], 10);
    const rawYr = parseInt(navareaPrefixMatch[3], 10);
    const yr = String(rawYr % 100).padStart(2, '0');
    return `NAVAREA ${area} ${num}/${yr}`;
  }

  // 2. Dash/slash/underscore separated with area prefix: "IX-364-24", "IX/364/24", "IX_364_2024"
  const areaDashMatch = trimmed.match(
    /^([A-Za-z0-9]+)[-_/]0*(\d+)[-_/](\d{2,4})$/i
  );
  if (areaDashMatch) {
    const area = areaDashMatch[1].toUpperCase();
    const num = parseInt(areaDashMatch[2], 10);
    const rawYr = parseInt(areaDashMatch[3], 10);
    const yr = String(rawYr % 100).padStart(2, '0');
    return `NAVAREA ${area} ${num}/${yr}`;
  }

  // 3. Simple Number/Year only: "364/24", "364/2024", "001/26", "364-24"
  const numYearMatch = trimmed.match(
    /^0*(\d+)[/-](\d{2,4})$/
  );
  if (numYearMatch) {
    const num = parseInt(numYearMatch[1], 10);
    const rawYr = parseInt(numYearMatch[2], 10);
    const yr = String(rawYr % 100).padStart(2, '0');
    const area = (defaultNavarea || 'UNKNOWN').trim().toUpperCase();
    return `NAVAREA ${area} ${num}/${yr}`;
  }

  // 4. Flexible match with NAVAREA embedded or slightly divergent punctuation
  const flexibleMatch = trimmed.match(
    /(?:NAVAREA\s+)?([A-Za-z0-9]+)[\s\-_:]+0*(\d+)[/_\-](\d{2,4})/i
  );
  if (flexibleMatch) {
    const area = flexibleMatch[1].toUpperCase();
    const num = parseInt(flexibleMatch[2], 10);
    const rawYr = parseInt(flexibleMatch[3], 10);
    const yr = String(rawYr % 100).padStart(2, '0');
    return `NAVAREA ${area} ${num}/${yr}`;
  }

  return trimmed;
}

/**
 * Checks whether a warning record contains valid spatial geometry or coordinates.
 */
export function hasGeometry(warning: NavWarning | any): boolean {
  if (!warning) return false;

  if (warning.spatial) {
    if (Array.isArray(warning.spatial.geometries) && warning.spatial.geometries.length > 0) {
      return true;
    }
    if (Array.isArray(warning.spatial.circles) && warning.spatial.circles.length > 0) {
      return true;
    }
  }

  if (
    warning.latitude != null &&
    warning.longitude != null &&
    !isNaN(Number(warning.latitude)) &&
    !isNaN(Number(warning.longitude))
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether a warning record is verified or possesses high extraction confidence.
 */
export function isWarningVerified(warning: NavWarning | any): boolean {
  if (!warning) return false;
  if (warning.is_verified === true) return true;
  if (warning.status === 'verified') return true;
  if (typeof warning.extraction_confidence === 'number' && warning.extraction_confidence >= 0.8) {
    return true;
  }
  return false;
}

/**
 * Classifies an in-force entry into one of four coverage states:
 * - not_held: heldWarning is undefined.
 * - held_with_geometry: heldWarning exists and hasGeometry is true.
 * - held_without_geometry: heldWarning exists, hasGeometry is false, and isWarningVerified is true.
 * - held_text_only: heldWarning exists, hasGeometry is false, and isWarningVerified is false.
 */
export function computeWarningStatus(
  heldWarning: NavWarning | undefined,
  inForceEntry?: any
): InForceWarningStatus['status'] {
  if (!heldWarning) {
    return 'not_held';
  }
  if (hasGeometry(heldWarning)) {
    return 'held_with_geometry';
  }
  if (isWarningVerified(heldWarning)) {
    return 'held_without_geometry';
  }
  return 'held_text_only';
}

/**
 * Computes coverage statistics between a persisted in-force snapshot and database warnings.
 */
export function computeInForceStatus(
  snapshot: InForceSnapshot | null,
  heldWarnings: NavWarning[],
  navarea: string
): InForceStatusResult {
  const cleanNavarea = (navarea || '').trim().toUpperCase();

  // 1. Deduplicate snapshot.entries by normalized warning_id
  const uniqueEntriesMap = new Map<string, InForceEntry>();
  if (snapshot && Array.isArray(snapshot.entries)) {
    for (const entry of snapshot.entries) {
      if (!entry) continue;
      const entryId = entry.warningId || (entry as any).warning_id;
      if (!entryId) continue;
      const normId = normalizeWarningId(entryId, cleanNavarea);
      if (!uniqueEntriesMap.has(normId)) {
        uniqueEntriesMap.set(normId, entry);
      }
    }
  }

  // 2. Index held warnings for that NAVAREA by normalized warning ID
  const heldWarningsMap = new Map<string, NavWarning>();
  const activeHeldWarningsInArea: NavWarning[] = [];

  for (const w of heldWarnings) {
    const wArea = (w.navarea || '').trim().toUpperCase();
    if (cleanNavarea && cleanNavarea !== 'ALL' && wArea && wArea !== cleanNavarea) {
      continue;
    }

    if (w.warning_id) {
      const norm1 = normalizeWarningId(w.warning_id, cleanNavarea);
      if (!heldWarningsMap.has(norm1)) heldWarningsMap.set(norm1, w);
    }
    if (w.source_warning_id) {
      const norm2 = normalizeWarningId(w.source_warning_id, cleanNavarea);
      if (!heldWarningsMap.has(norm2)) heldWarningsMap.set(norm2, w);
    }

    // Extra Warnings Filtering:
    // Exclude cancelled/expired warnings and self-cancelling in-force bulletin messages
    const isCancelledOrExpired = w.status === 'cancelled' || w.status === 'expired';
    const isInForceBulletin =
      /IN\s*FORCE/i.test(w.raw_text || '') ||
      /IN\s*FORCE/i.test(w.issued_text || '') ||
      /IN\s*FORCE/i.test(w.title || '');

    if (!isCancelledOrExpired && !isInForceBulletin) {
      activeHeldWarningsInArea.push(w);
    }
  }

  // 3. Match each deduplicated entry against held database warnings
  const warningStatuses: InForceWarningStatus[] = [];
  const missingWarningIds: string[] = [];
  let heldCount = 0;
  let withGeometryCount = 0;
  let verifiedCount = 0;

  for (const [normId, entry] of uniqueEntriesMap.entries()) {
    const held = heldWarningsMap.get(normId);
    const status = computeWarningStatus(held, entry);
    const hasGeom = held ? hasGeometry(held) : false;
    const isVer = held ? isWarningVerified(held) : false;
    const entryId = entry.warningId || (entry as any).warning_id || '';
    const entryYr = entry.seriesYear ?? (entry as any).series_year ?? 0;

    if (held) {
      heldCount++;
      if (hasGeom) withGeometryCount++;
      if (isVer) verifiedCount++;
    } else {
      missingWarningIds.push(entryId);
    }

    warningStatuses.push({
      warningId: entryId,
      status,
      hasGeometry: hasGeom,
      isVerified: isVer,
      inForceEntry: {
        series_year: entryYr,
        number: entry.number,
        warning_id: entryId,
      },
      heldWarning: held,
    });
  }

  // 4. Calculate extraWarningIds (active DB warnings for that NAVAREA not in the snapshot)
  const extraWarningIds: string[] = [];
  const listedNormalizedIds = new Set(uniqueEntriesMap.keys());
  for (const w of activeHeldWarningsInArea) {
    const id1 = w.warning_id ? normalizeWarningId(w.warning_id, cleanNavarea) : '';
    const id2 = w.source_warning_id ? normalizeWarningId(w.source_warning_id, cleanNavarea) : '';
    const isListed = (id1 && listedNormalizedIds.has(id1)) || (id2 && listedNormalizedIds.has(id2));
    if (!isListed) {
      extraWarningIds.push(w.warning_id || w.source_warning_id);
    }
  }

  const listedCount = uniqueEntriesMap.size;
  const coveragePercentage = listedCount > 0
    ? Math.round((heldCount / listedCount) * 100)
    : 100;

  const summary: InForceCoverageSummary = {
    listedCount,
    heldCount,
    withGeometryCount,
    verifiedCount,
    missingCount: missingWarningIds.length,
    extraCount: extraWarningIds.length,
    coveragePercentage,
  };

  return {
    snapshot,
    warnings: warningStatuses,
    summary,
    missingWarningIds,
    extraWarningIds,
    computedAt: new Date(),
    isLoading: false,
  };
}

/**
 * Computes coverage with graceful lifecycle fallback when no snapshot exists.
 */
export function computeInForceStatusWithFallback(
  snapshot: InForceSnapshot | null,
  heldWarnings: NavWarning[],
  navarea: string
): InForceStatusResult {
  if (snapshot) {
    return computeInForceStatus(snapshot, heldWarnings, navarea);
  }

  const cleanNavarea = (navarea || '').trim().toUpperCase();
  if (FEATURE_FLAGS.inForceFallbackToLifecycle) {
    // Graceful lifecycle fallback: Report active held warnings for this NAVAREA
    const activeWarnings = heldWarnings.filter(w => {
      const wArea = (w.navarea || '').trim().toUpperCase();
      if (cleanNavarea && cleanNavarea !== 'ALL' && wArea && wArea !== cleanNavarea) {
        return false;
      }
      const isCancelledOrExpired = w.status === 'cancelled' || w.status === 'expired';
      const isInForceBulletin =
        /IN\s*FORCE/i.test(w.raw_text || '') ||
        /IN\s*FORCE/i.test(w.issued_text || '') ||
        /IN\s*FORCE/i.test(w.title || '');
      return !isCancelledOrExpired && !isInForceBulletin;
    });

    let withGeometryCount = 0;
    let verifiedCount = 0;
    const warningStatuses: InForceWarningStatus[] = activeWarnings.map(w => {
      const hasGeom = hasGeometry(w);
      const isVer = isWarningVerified(w);
      if (hasGeom) withGeometryCount++;
      if (isVer) verifiedCount++;
      return {
        warningId: w.warning_id || w.source_warning_id,
        status: computeWarningStatus(w),
        hasGeometry: hasGeom,
        isVerified: isVer,
        heldWarning: w,
      };
    });

    const count = activeWarnings.length;
    const summary: InForceCoverageSummary = {
      listedCount: count,
      heldCount: count,
      withGeometryCount,
      verifiedCount,
      missingCount: 0,
      extraCount: 0,
      coveragePercentage: 100,
    };

    return {
      snapshot: null,
      warnings: warningStatuses,
      summary,
      missingWarningIds: [],
      extraWarningIds: [],
      computedAt: new Date(),
      isLoading: false,
    };
  }

  // Fallback disabled: return empty
  const emptySummary: InForceCoverageSummary = {
    listedCount: 0,
    heldCount: 0,
    withGeometryCount: 0,
    verifiedCount: 0,
    missingCount: 0,
    extraCount: 0,
    coveragePercentage: 100,
  };

  return {
    snapshot: null,
    warnings: [],
    summary: emptySummary,
    missingWarningIds: [],
    extraWarningIds: [],
    computedAt: new Date(),
    isLoading: false,
  };
}

/**
 * Enhanced orchestrator checking feature flags and fallback logic.
 */
export function computeInForceStatusEnhanced(
  snapshot: InForceSnapshot | null,
  heldWarnings: NavWarning[],
  navarea: string
): InForceStatusResult {
  return computeInForceStatusWithFallback(snapshot, heldWarnings, navarea);
}

// ============================================
// MODULE-LEVEL CACHE & RETRIEVAL HELPERS
// ============================================

interface CacheEntry {
  result: InForceStatusResult;
  timestamp: number;
  warningsHash: string;
}

const statusCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

/**
 * Clears the in-memory module-level status cache (useful for tests and manual cache purges).
 */
export function clearInForceStatusCache(): void {
  statusCache.clear();
}

/**
 * Computes a granular identity hash for warnings ensuring verification and geometry edits invalidate cache.
 */
export function computeWarningsHash(warnings: NavWarning[]): string {
  return warnings
    .map(w => `${w.warning_id || w.source_warning_id}:${w.navarea}:${w.status}:${w.is_verified}:${hasGeometry(w)}`)
    .join('|');
}

/**
 * Retrieves computed status from cache or runs pure computation without triggering React state updates.
 */
export function getInForceStatusForNavarea(
  navarea: string,
  heldWarnings?: NavWarning[]
): InForceStatusResult | null {
  const cleanNavarea = (navarea || '').trim().toUpperCase();
  const cached = statusCache.get(cleanNavarea);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    if (heldWarnings) {
      const hash = computeWarningsHash(heldWarnings);
      if (cached.warningsHash === hash) {
        return cached.result;
      }
    } else {
      return cached.result;
    }
  }

  if (heldWarnings) {
    const existingSnapshot = cached?.result?.snapshot || null;
    const computed = computeInForceStatusWithFallback(existingSnapshot, heldWarnings, cleanNavarea);
    statusCache.set(cleanNavarea, {
      result: computed,
      timestamp: now,
      warningsHash: computeWarningsHash(heldWarnings),
    });
    return computed;
  }

  return cached?.result || null;
}

// ============================================
// REACT HOOK: useInForceStatus
// ============================================

/**
 * React hook to compute and observe in-force coverage status for a NAVAREA.
 */
export function useInForceStatus(
  navarea: string,
  warnings: NavWarning[]
): InForceStatusResult {
  const cleanNavarea = useMemo(() => (navarea || '').trim().toUpperCase(), [navarea]);
  const isEnabled = FEATURE_FLAGS.inForceUIDisplay;

  const warningsHash = useMemo(() => {
    return computeWarningsHash(warnings);
  }, [warnings]);

  // Initial state derived from valid cache if available
  const [result, setResult] = useState<InForceStatusResult>(() => {
    const cached = statusCache.get(cleanNavarea);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS && cached.warningsHash === warningsHash) {
      return cached.result;
    }
    return {
      snapshot: null,
      warnings: [],
      summary: {
        listedCount: 0,
        heldCount: 0,
        withGeometryCount: 0,
        verifiedCount: 0,
        missingCount: 0,
        extraCount: 0,
        coveragePercentage: 100,
      },
      missingWarningIds: [],
      extraWarningIds: [],
      computedAt: new Date(),
      isLoading: isEnabled && cleanNavarea !== 'ALL' && cleanNavarea !== '',
    };
  });

  useEffect(() => {
    if (!isEnabled || !cleanNavarea || cleanNavarea === 'ALL') {
      setResult({
        snapshot: null,
        warnings: [],
        summary: {
          listedCount: 0,
          heldCount: 0,
          withGeometryCount: 0,
          verifiedCount: 0,
          missingCount: 0,
          extraCount: 0,
          coveragePercentage: 100,
        },
        missingWarningIds: [],
        extraWarningIds: [],
        computedAt: new Date(),
        isLoading: false,
      });
      return;
    }

    const cached = statusCache.get(cleanNavarea);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      if (cached.warningsHash === warningsHash) {
        setResult(cached.result);
        return;
      } else if (cached.result.snapshot) {
        // Warnings modified: recompute immediately using cached snapshot without network fetch
        const recomputed = computeInForceStatusWithFallback(cached.result.snapshot, warnings, cleanNavarea);
        statusCache.set(cleanNavarea, {
          result: recomputed,
          timestamp: now,
          warningsHash,
        });
        setResult(recomputed);
        return;
      }
    }

    let isCancelled = false;
    setResult(prev => ({ ...prev, isLoading: true }));

    async function loadSnapshot() {
      try {
        let snapshot: InForceSnapshot | null = null;
        try {
          snapshot = await getLatestSnapshot(cleanNavarea);
        } catch (fetchErr: any) {
          console.warn(`[useInForceStatus] Notice querying snapshot for ${cleanNavarea}:`, fetchErr?.message || fetchErr);
        }

        if (isCancelled) return;

        const computed = computeInForceStatusWithFallback(snapshot, warnings, cleanNavarea);
        statusCache.set(cleanNavarea, {
          result: computed,
          timestamp: Date.now(),
          warningsHash,
        });

        setResult(computed);
      } catch (err: any) {
        if (isCancelled) return;
        const fallback = computeInForceStatusWithFallback(null, warnings, cleanNavarea);
        setResult({
          ...fallback,
          error: err?.message || 'Failed to compute in-force status',
          isLoading: false,
        });
      }
    }

    loadSnapshot();

    return () => {
      isCancelled = true;
    };
  }, [cleanNavarea, warningsHash, isEnabled, warnings]);

  return result;
}

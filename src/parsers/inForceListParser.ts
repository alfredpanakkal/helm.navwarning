// src/parsers/inForceListParser.ts
// Deterministic in-force list parser for NAVAREA maritime safety broadcasts
// Supports Format IX/IHO Series, Format IV comma/space separated, Format I JHOD space-separated,
// "AND" clause parsing, year suffix handling, range expansion, and rich cancellation context.

import type { RawMessageBlock } from '../types/navarea';
import { FEATURE_FLAGS } from '../lib/featureFlags';
import { parseInForceListWithAI } from '../services/aiStudioService';

export interface InForceEntry {
  seriesYear: number;
  number: number;
  warningId: string;
  rawToken?: string;
  yearSuffix?: string;
  isSelfCancelling?: boolean;
  isRangeExpansion?: boolean;
}

export interface CancelledReference {
  warningId: string;
  targetNumber: number;
  targetYear: number;
  navarea: string;
  rawRef: string;
  reason?: string;
  context?: string;
}

export interface ParsedInForceList {
  isList: boolean;
  warningId: string;
  navarea: string;
  inForceEntries: InForceEntry[];
  cancelledRefs: string[];
  cancellationDetails: CancelledReference[];
  isPartialList: boolean;
  entryCount: number;
  rawText: string;
  isSelfCancelling: boolean;
  selfCancellingCondition?: string;
  asOfDate?: string;
}

export interface InForceListParseOptions {
  navarea?: string;
  warningId?: string;
  year?: number;
  truncated?: boolean;
}

/**
 * Normalizes year numbers down to a 2-digit integer (e.g. 2026 -> 26, 26 -> 26).
 */
export function normalizeSeriesYear(
  rawYear: number | string | undefined | null,
  defaultYear: number = 24
): number {
  if (rawYear === undefined || rawYear === null || rawYear === '') {
    return defaultYear > 1900 ? defaultYear % 100 : defaultYear;
  }
  const parsed = typeof rawYear === 'number' ? rawYear : parseInt(String(rawYear).trim(), 10);
  if (isNaN(parsed)) {
    return defaultYear > 1900 ? defaultYear % 100 : defaultYear;
  }
  if (parsed >= 1900 && parsed <= 2099) {
    return parsed % 100;
  }
  if (parsed >= 0 && parsed <= 99) {
    return parsed;
  }
  return parsed % 100;
}

/**
 * Formats canonical NAVAREA identifier: "NAVAREA <navarea> <number>/<2-digit year>"
 */
export function formatWarningId(navarea: string, number: number, year: number): string {
  const normYear = normalizeSeriesYear(year);
  const yrFmt = normYear < 10 ? `0${normYear}` : `${normYear}`;
  return `NAVAREA ${navarea.toUpperCase()} ${number}/${yrFmt}`;
}

/**
 * Detects whether a broadcast block represents an in-force list bulletin.
 */
export function isInForceList(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const upper = text.toUpperCase();

  if (/IN\s+FORCE\b/.test(upper)) {
    if (/(?:WARNING\s+MESSAGES|WARNINGS|NOTICES|MESSAGES)?\s*IN\s+FORCE/.test(upper)) return true;
    if (/SERIES\s*:/.test(upper)) return true;
    if (/LISTED\s+HEREIN/.test(upper)) return true;
    if (/CHECKLIST/.test(upper)) return true;
    if (/BULLETIN/.test(upper)) return true;
  }

  if (/MESSAGES\s+ARE\s+LISTED\s+HEREIN/.test(upper)) return true;
  if (/SUMMARY\s+OF\s+WARNINGS\s+IN\s+FORCE/.test(upper)) return true;
  if (/(?:^|\n)\s*(?:20\d{2}|\d{2})\s+SERIES\s*:/.test(upper)) return true;

  return false;
}

/**
 * Detects self-cancelling notices or statements in the bulletin text.
 */
export function detectSelfCancelling(text: string): { isSelfCancelling: boolean; condition?: string } {
  if (!text) return { isSelfCancelling: false };

  const selfCancelRegex = /(?:THIS\s+(?:WARNING|BULLETIN|MESSAGE|MSG)\s+(?:IS|WILL\s+BE)\s+)?SELF[- ]CANCELL(?:ING|ED)/i;
  const cancelThisRegex = /CANCEL\s+THIS\s+(?:MSG|MESSAGE)\b([^.\n;]*)/i;

  const mSelf = text.match(selfCancelRegex);
  if (mSelf) {
    return {
      isSelfCancelling: true,
      condition: mSelf[0].trim(),
    };
  }

  const mCancel = text.match(cancelThisRegex);
  if (mCancel) {
    const detail = mCancel[1] ? mCancel[1].trim() : 'CANCEL THIS MSG';
    return {
      isSelfCancelling: true,
      condition: detail || 'CANCEL THIS MSG',
    };
  }

  return { isSelfCancelling: false };
}

/**
 * Parses tokens from a raw series text chunk into structured InForceEntry items.
 * Handles "AND" connectors, ranges ("001-010"), year suffixes ("222/26(24)"), and line wraps.
 */
function parseSeriesTokens(
  rawChunk: string,
  seriesYear: number,
  navarea: string
): InForceEntry[] {
  const entries: InForceEntry[] = [];
  if (!rawChunk || !rawChunk.trim()) return entries;

  // Use tokenPattern to extract all warning items, ranges, year specs, and parenthetical suffixes
  const tokenPattern = /\b(\d{1,4}(?:\s*[-–—]\s*\d{1,4})?(?:\/\d{2,4})?(?:\s*\([^)]*\))?)/g;
  const matches = rawChunk.match(tokenPattern) || [];

  for (const rawToken of matches) {
    const token = rawToken.trim();
    if (!token || !/\d/.test(token)) continue;

    // 1. Check for Range syntax: e.g. "001-010", "084-089", "001-010/26", "084-089(24)"
    const rangeMatch = token.match(/^(\d{1,4})\s*[-–—]\s*(\d{1,4})(?:\/(\d{2,4}))?(?:\s*\(([^)]+)\))?$/);
    if (rangeMatch) {
      const startNum = parseInt(rangeMatch[1], 10);
      const endNum = parseInt(rangeMatch[2], 10);
      const yr = rangeMatch[3] ? normalizeSeriesYear(rangeMatch[3], seriesYear) : seriesYear;
      const suffix = rangeMatch[4] ? `(${rangeMatch[4].trim()})` : undefined;

      if (startNum > 0 && endNum >= startNum && endNum - startNum <= 500) {
        for (let n = startNum; n <= endNum; n++) {
          entries.push({
            seriesYear: yr,
            number: n,
            warningId: formatWarningId(navarea, n, yr),
            rawToken: token,
            yearSuffix: suffix,
            isRangeExpansion: true,
          });
        }
        continue;
      }
    }

    // 2. Check for Single item syntax: e.g. "084", "222/26", "222/26(24)", "223/26 (25)", "085(22)"
    const singleMatch = token.match(/^(\d{1,4})(?:\/(\d{2,4}))?(?:\s*\(([^)]+)\))?$/);
    if (singleMatch) {
      const num = parseInt(singleMatch[1], 10);
      const yr = singleMatch[2] ? normalizeSeriesYear(singleMatch[2], seriesYear) : seriesYear;
      const suffix = singleMatch[3] ? `(${singleMatch[3].trim()})` : undefined;

      if (num > 0) {
        entries.push({
          seriesYear: yr,
          number: num,
          warningId: formatWarningId(navarea, num, yr),
          rawToken: token,
          yearSuffix: suffix,
          isRangeExpansion: false,
        });
      }
    }
  }

  return entries;
}

/**
 * Extracts explicit cancellation references along with optional reason and context.
 */
function extractCancellations(
  text: string,
  navarea: string,
  defaultYear: number
): { cancelledRefs: string[]; cancellationDetails: CancelledReference[] } {
  const cancelledRefs: string[] = [];
  const cancellationDetails: CancelledReference[] = [];
  const seenIds = new Set<string>();

  // Process text line by line to prevent cross-line bleed while supporting continuations
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const cancelMatch = line.match(/\bCANCEL\s+(.+)$/i);
    if (!cancelMatch) continue;

    let fullClause = cancelMatch[1].trim();

    // Check for multi-line continuation if line ended with comma or AND
    while (/(?:,|AND|&)\s*$/i.test(fullClause) && i + 1 < lines.length) {
      i++;
      fullClause += ' ' + lines[i].trim();
    }

    // Skip self-cancelling notices: CANCEL THIS MSG / MESSAGE
    if (/THIS\s+(?:MSG|MESSAGE)/i.test(fullClause)) {
      continue;
    }

    // Extract NAVAREA tag if explicitly specified: e.g. "NAVAREA IV 857/24"
    let targetNavarea = navarea.toUpperCase();
    let targetSection = fullClause;
    const navMatch = fullClause.match(/^NAVAREA\s+([A-Z0-9]+)\s+(.*)$/i);
    if (navMatch) {
      targetNavarea = navMatch[1].toUpperCase();
      targetSection = navMatch[2];
    }

    // Separate warning numbers from reason if separated by a period:
    // e.g. "328/24. NAVIGATION HAZARD AT QUOIN ISLAND REMOVED."
    let reason: string | undefined;
    const periodIdx = targetSection.search(/\.\s+[A-Za-z]/);
    if (periodIdx !== -1) {
      reason = targetSection.slice(periodIdx + 1).replace(/^[.\s]+/, '').replace(/[.\s]+$/, '').trim();
      targetSection = targetSection.slice(0, periodIdx);
    }

    // Extract all tokens
    const tokenPattern = /\b(\d{1,4}(?:\/\d{2,4})?(?:\s*\([^)]*\))?)/g;
    const tokens = targetSection.match(tokenPattern) || [];

    for (const rawTok of tokens) {
      const tok = rawTok.trim();
      const inlineMatch = tok.match(/^(\d{1,4})(?:\/(\d{2,4}))?(?:\s*\(([^)]+)\))?$/);
      if (inlineMatch) {
        const num = parseInt(inlineMatch[1], 10);
        const yr = inlineMatch[2] ? normalizeSeriesYear(inlineMatch[2], defaultYear) : defaultYear;
        const inlineReason = inlineMatch[3] ? inlineMatch[3].trim() : reason;

        if (num > 0) {
          const warningId = formatWarningId(targetNavarea, num, yr);
          if (!seenIds.has(warningId)) {
            seenIds.add(warningId);
            cancelledRefs.push(warningId);
            cancellationDetails.push({
              warningId,
              targetNumber: num,
              targetYear: yr,
              navarea: targetNavarea,
              rawRef: tok,
              reason: inlineReason,
              context: line,
            });
          }
        }
      }
    }
  }

  return { cancelledRefs, cancellationDetails };
}

/**
 * Parses in-force bulletin text into a structured ParsedInForceList.
 */
export function parseInForceListFromText(
  text: string,
  options: InForceListParseOptions = {}
): ParsedInForceList {
  const navarea = (options.navarea || 'IX').toUpperCase();
  const warningId = options.warningId || `NAVAREA ${navarea} 000/00`;
  const defaultYear = normalizeSeriesYear(options.year, 24);

  const isList = isInForceList(text);
  if (!isList) {
    return {
      isList: false,
      warningId,
      navarea,
      inForceEntries: [],
      cancelledRefs: [],
      cancellationDetails: [],
      isPartialList: false,
      entryCount: 0,
      rawText: text,
      isSelfCancelling: false,
    };
  }

  // As of date
  const asOfMatch = text.match(/IN\s+FORCE\s+(?:ON\s+|AT\s+)?([0-9]{1,2}\s+[A-Z]{3,9}\s+[0-9]{2,4}|[0-9]{6}Z\s+[A-Z]{3}\s+[0-9]{2,4})/i);
  const asOfDate = asOfMatch ? asOfMatch[1].trim() : undefined;

  // Self cancelling detection
  const selfCancel = detectSelfCancelling(text);

  const inForceEntries: InForceEntry[] = [];
  const seenWarningIds = new Set<string>();

  const addEntry = (entry: InForceEntry) => {
    if (!seenWarningIds.has(entry.warningId)) {
      seenWarningIds.add(entry.warningId);
      inForceEntries.push(entry);
    }
  };

  // 1. Format IX / Standard Series format:
  // e.g. "2024 SERIES: 084, 103, 189 ... AND 580."
  // or "SERIES 2024: 084, 103..."
  const seriesHeaderRegex = /(?:^|\n|\.\s*)(?:(\d{2,4})\s+SERIES\s*:|\bSERIES\s+(\d{2,4})\s*:?)/gi;
  const seriesHeaders: Array<{ index: number; year: number; headerLength: number }> = [];
  let hMatch: RegExpExecArray | null;

  while ((hMatch = seriesHeaderRegex.exec(text)) !== null) {
    const rawYear = hMatch[1] || hMatch[2];
    const seriesYear = normalizeSeriesYear(rawYear, defaultYear);
    seriesHeaders.push({
      index: hMatch.index,
      year: seriesYear,
      headerLength: hMatch[0].length,
    });
  }

  if (seriesHeaders.length > 0) {
    for (let i = 0; i < seriesHeaders.length; i++) {
      const current = seriesHeaders[i];
      const startContent = current.index + current.headerLength;
      const nextHeaderIndex = i + 1 < seriesHeaders.length ? seriesHeaders[i + 1].index : text.length;

      let rawSection = text.slice(startContent, nextHeaderIndex);

      // Truncate section if we reach a section boundary (e.g. CANCEL, TEXT OF, NOTES)
      const boundaryMatch = rawSection.match(/(?:\.\s*|\n\s*)(?:CANCEL\b|TEXT\s+OF|SUMMARY\b|NOTES?\b|PART\s+\d|SECTION\s+\d)/i);
      if (boundaryMatch && boundaryMatch.index !== undefined) {
        rawSection = rawSection.slice(0, boundaryMatch.index);
      }

      const parsedTokens = parseSeriesTokens(rawSection, current.year, navarea);
      for (const entry of parsedTokens) {
        addEntry(entry);
      }
    }
  }

  // 2. Format I & Format IV (Non-series-header formats: space-separated or comma/slash separated)
  if (inForceEntries.length === 0) {
    const headerMatch = text.match(/(?:WARNINGS?\s+IN\s+FORCE|IN\s+FORCE\b|MESSAGES\s+ARE\s+LISTED\s+HEREIN)[^.\n]*[.:\n]?/i);
    let contentToScan = text;
    if (headerMatch && headerMatch.index !== undefined) {
      const start = headerMatch.index + headerMatch[0].length;
      contentToScan = text.slice(start);
    }
    // Truncate at boundary keywords like CANCEL, TEXT OF, etc.
    const boundary = contentToScan.match(/(?:\.\s*|\n\s*)(?:CANCEL\b|TEXT\s+OF|SUMMARY\b|NOTES?\b)/i);
    if (boundary && boundary.index !== undefined) {
      contentToScan = contentToScan.slice(0, boundary.index);
    }

    // Check if any token has an explicit year (e.g. 0454/26) to propagate across the cluster
    const clusterYrMatch = contentToScan.match(/\/(\d{2,4})\b/);
    const clusterYear = clusterYrMatch ? normalizeSeriesYear(clusterYrMatch[1], defaultYear) : defaultYear;

    const parsedTokens = parseSeriesTokens(contentToScan, clusterYear, navarea);
    for (const entry of parsedTokens) {
      addEntry(entry);
    }
  }

  // 3. Extract explicit cancellation references
  const { cancelledRefs, cancellationDetails } = extractCancellations(text, navarea, defaultYear);

  // Truncation detection
  const isPartialList = Boolean(options.truncated) ||
    /\[MESSAGE TRUNCATED/i.test(text) ||
    /TRUNCATED BY TRANSMISSION/i.test(text) ||
    /\bINCOMPLETE\b/i.test(text);

  return {
    isList: true,
    warningId,
    navarea,
    inForceEntries,
    cancelledRefs,
    cancellationDetails,
    isPartialList,
    entryCount: inForceEntries.length,
    rawText: text,
    isSelfCancelling: selfCancel.isSelfCancelling,
    selfCancellingCondition: selfCancel.condition,
    asOfDate,
  };
}

/**
 * Adapter accepting RawMessageBlock to maintain 100% backward compatibility with pipeline calls.
 */
export function parseInForceList(block: RawMessageBlock): ParsedInForceList {
  return parseInForceListFromText(block.rawText, {
    navarea: block.navarea,
    warningId: block.warningId,
    year: block.year,
    truncated: block.truncated,
  });
}

/**
 * Async in-force list parser with AI Studio fallback support.
 * Checks FEATURE_FLAGS.aiStudioFallback; always runs deterministic parseInForceList first,
 * falling back to AI Studio only when an in-force list has zero extracted entries.
 */
export async function parseInForceListAsync(
  block: RawMessageBlock
): Promise<ParsedInForceList> {
  const deterministicResult = parseInForceList(block);

  if (!FEATURE_FLAGS.aiStudioFallback) {
    return deterministicResult;
  }

  if (deterministicResult.isList && deterministicResult.entryCount === 0) {
    try {
      const aiResult = await parseInForceListWithAI(block);
      if (aiResult && aiResult.entryCount > 0) {
        return aiResult;
      }
    } catch {
      return deterministicResult;
    }
  }

  return deterministicResult;
}


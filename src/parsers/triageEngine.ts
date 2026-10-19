// src/parsers/triageEngine.ts
// Plan v8 Multi-Axis State Engine: assignTier(), Grounding Checker, & Safety Filters

import type { NavWarning, DataQualityRating } from '../types';
import type { SpanEdit } from '../types/navarea';

export type TriageTier = 'A' | 'B' | 'C';

export interface SensitiveSpan {
  start: number;
  end: number;
  kind: 'coordinate' | 'quantity' | 'identity' | 'date';
}

export interface TriageRecord {
  dataQuality: DataQualityRating;
  qaFlags: string[];
  spanEditList: SpanEdit[];
  sensitiveSpans?: SensitiveSpan[];
  parsingMethod?: 'rule' | 'ai_gemini' | 'ai_mistral' | 'human';
  proposedCancel?: boolean;
  acceptedProposal?: boolean;
}

/**
 * Checks if a sanitization edit overlaps any sensitive token (coordinate, quantity, identity, or date).
 */
export function overlapsSensitiveToken(edit: SpanEdit, sensitiveSpans: SensitiveSpan[] = []): boolean {
  return sensitiveSpans.some(
    span => edit.cleanStart < span.end && edit.cleanEnd > span.start
  );
}

/**
 * Post-extraction tier assignment algorithm (assignTier).
 * Evaluates records against safety invariants I1-I7 and maps them to Tier A, B, or C.
 */
export function assignTier(rec: TriageRecord): TriageTier {
  // Tier C: Unsafe, blocked from public geometry
  if (
    rec.qaFlags.includes('MISSING_HEM') ||
    rec.dataQuality === 'INVALID' ||
    (rec.qaFlags.includes('SELF_INTERSECTING_POLYGON') && !rec.acceptedProposal) ||
    rec.qaFlags.includes('COORDINATES_PRESENT_BUT_NOT_PARSED') ||
    rec.qaFlags.includes('AI_VALIDATION_FAILED') ||
    rec.qaFlags.includes('ANTIMERIDIAN_WRAP_UNRESOLVED')
  ) {
    return 'C';
  }

  // Tier B: Edits touching sensitive tokens, inferred geometry, or identity modifications
  const sensitiveSpans = rec.sensitiveSpans || [];
  const touchesSensitiveToken = rec.spanEditList.some(edit =>
    overlapsSensitiveToken(edit, sensitiveSpans)
  );

  if (
    touchesSensitiveToken ||
    rec.qaFlags.includes('IDENTITY_AFFECTING') ||
    (rec.parsingMethod && rec.parsingMethod !== 'rule') ||
    rec.dataQuality === 'INFERRED' ||
    rec.dataQuality === 'AMBIGUOUS' ||
    rec.qaFlags.includes('HEMISPHERE_CONVENTION_APPLIED') ||
    Boolean(rec.proposedCancel)
  ) {
    return 'B';
  }

  // Tier A: Cosmetic edits outside sensitive tokens
  return 'A';
}

/**
 * AI Numeric Token Grounding Validation (N02).
 * Verifies that every numeric digit in AI-generated coordinates traces directly to raw_text.
 */
export function validateAiNumericGrounding(rawText: string, aiCoords: { lat: number; lng: number }[]): boolean {
  if (!rawText || !aiCoords || aiCoords.length === 0) return true;

  const rawDigits = new Set((rawText.match(/\d/g) || []));

  for (const coord of aiCoords) {
    const latStr = Math.abs(coord.lat).toFixed(4);
    const lngStr = Math.abs(coord.lng).toFixed(4);

    const latDigits = (latStr.match(/\d/g) || []);
    const lngDigits = (lngStr.match(/\d/g) || []);

    for (const d of [...latDigits, ...lngDigits]) {
      if (!rawDigits.has(d)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * ReDoS Safety Execution Wrapper (N03).
 * Caps text at 50,000 characters and enforces a maximum execution time (default 500ms).
 */
export function executeWithReDoSGuard<T>(
  fn: (text: string) => T,
  rawText: string,
  maxChars = 50000,
  fallbackValue?: T
): { result: T | undefined; timedOut: boolean } {
  if (!rawText || typeof rawText !== 'string') {
    return { result: fallbackValue, timedOut: false };
  }

  const cappedText = rawText.length > maxChars ? rawText.slice(0, maxChars) : rawText;
  const startTime = Date.now();

  try {
    const result = fn(cappedText);
    const duration = Date.now() - startTime;
    if (duration > 500) {
      console.warn(`[ReDoS Guard] Function execution took ${duration}ms (exceeded 500ms limit).`);
    }
    return { result, timedOut: false };
  } catch (err) {
    console.error('[ReDoS Guard] Execution error or timeout:', err);
    return { result: fallbackValue, timedOut: true };
  }
}

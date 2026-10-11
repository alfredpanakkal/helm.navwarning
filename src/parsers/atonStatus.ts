// src/parsers/atonStatus.ts
// Determines per-point AtoN operational status (alert, relocation, chart_correction, info, standard)

import type { AtoNStatus } from '../types/navarea';

export function evaluateAtoNStatus(rawText: string): AtoNStatus {
  if (!rawText) return 'standard';

  const upper = rawText.toUpperCase();

  // Relocation: moved to new position
  if (/\b(?:RELOCATED|MOVED\s+TO|REPOSITIONED)\b/i.test(upper)) {
    return 'relocation';
  }

  // Alert: unlit, damaged, destroyed, off-station
  if (/\b(?:UNLIT|OFF\s+STATION|DESTROYED|DAMAGED|MISSING|EXTINGUISHED)\b/i.test(upper)) {
    return 'alert';
  }

  // Chart Correction: permanently withdrawn, established, renamed
  if (/\b(?:PERMANENTLY\s+WITHDRAWN|PERMANENTLY\s+ESTABLISHED|CHART\s+CORRECTION)\b/i.test(upper)) {
    return 'chart_correction';
  }

  // Info: shoal depth, soundings, temporary changes
  if (/\b(?:SHOAL\s+DEPTH|SOUNDINGS?|TEMPORARY|RE-?ESTABLISHED)\b/i.test(upper)) {
    return 'info';
  }

  return 'standard';
}

import { classifyWarning } from '../parsers/warningClassifier';
import type { DisplayStyle } from '../types/navarea';
import { toPrimarySymbol, type PrimarySymbol } from './symbolMapping';

export type MaritimeSeverity = 'critical' | 'high' | 'moderate';

export interface WarningVisuals {
  category: string;
  symbol: PrimarySymbol;
  severity: MaritimeSeverity;
  legacySeverity: 'critical' | 'high' | 'caution';
  displayStyle: DisplayStyle;
}

/**
 * Resolve map presentation from persisted backend fields first. Raw-text
 * classification is a compatibility fallback for pre-migration rows only.
 * Parser triage is deliberately not consulted here.
 */
export function resolveWarningVisuals(
  categories: string[] | string | null | undefined,
  persistedSeverity: unknown,
  rawText: string
): WarningVisuals {
  const fallback = classifyWarning(rawText || '');
  const categoryList = Array.isArray(categories)
    ? categories
    : typeof categories === 'string' ? [categories] : [];
  const category = categoryList.find((value) => typeof value === 'string' && value.trim())?.trim()
    || fallback.category;

  const severity: MaritimeSeverity =
    persistedSeverity === 'critical' || persistedSeverity === 'high' || persistedSeverity === 'moderate'
      ? persistedSeverity
      : fallback.severity === 'critical'
        ? 'critical'
        : fallback.severity === 'high'
          ? 'high'
          : 'moderate';

  return {
    category,
    symbol: toPrimarySymbol(category),
    severity,
    legacySeverity: severity === 'moderate' ? 'caution' : severity,
    displayStyle: severity === 'moderate' ? 'active' : severity,
  };
}

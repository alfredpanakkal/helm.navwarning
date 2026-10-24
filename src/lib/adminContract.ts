/**
 * Shared admin contract constants (2026-10-24).
 *
 * Single source of truth for the enum whitelists enforced by
 * /api/admin/warning-edit (server-side re-validation stays in place)
 * and rendered by the WarningEditModal UI, so the dropdowns can never
 * drift from the endpoint contract.
 */

export const ALLOWED_STATUS: string[] = ['active', 'cancelled', 'expired', 'superseded', 'unverified'];
export const ALLOWED_TIERS: string[] = ['A', 'B', 'C'];
export const ALLOWED_QUALITY: string[] = ['EXPLICIT', 'INFERRED', 'AMBIGUOUS', 'INVALID'];
export const ALLOWED_CATEGORIES: string[] = ['military', 'aton', 'subsea', 'drifting', 'offshore', 'electronic', 'general'];

export const STATUS_OPTIONS = ALLOWED_STATUS;
export const TIER_OPTIONS = ALLOWED_TIERS;
export const QUALITY_OPTIONS = ALLOWED_QUALITY;

export const CATEGORY_OPTIONS = [
  { id: 'military', label: 'Military' },
  { id: 'aton', label: 'AtoN' },
  { id: 'subsea', label: 'Subsea' },
  { id: 'drifting', label: 'Drifting' },
  { id: 'offshore', label: 'Offshore' },
  { id: 'electronic', label: 'Electronic' },
  { id: 'general', label: 'General' },
];

export const NAVAREA_OPTIONS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII',
  'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'Baltic',
];

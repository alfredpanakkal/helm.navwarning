// src/utils/symbolMapping.ts
// Authoritative consolidation of 16 granular HazardCategory classifications
// into 6 primary display symbols, as specified in docs/COMPETITOR_WARNING_DESIGN_STUDY.md.

import type { HazardCategory } from '../types/navarea';

export type PrimarySymbol =
  | 'general'
  | 'military'
  | 'drifting'
  | 'aton'
  | 'subsea'
  | 'wreck';

export interface PrimarySymbolMeta {
  id: PrimarySymbol;
  label: string;
  description: string;
  /** Representative glyph from HAZARD_SVG_PATHS */
  canonicalGlyph: HazardCategory;
}

export const PRIMARY_SYMBOLS: Record<PrimarySymbol, PrimarySymbolMeta> = {
  general: {
    id: 'general',
    label: 'General Hazard',
    description: 'Navigational hazards, marine operations, weather warnings, and chart corrections',
    canonicalGlyph: 'general_chart',
  },
  military: {
    id: 'military',
    label: 'Military Operations',
    description: 'Naval firing exercises, rocket launches, gunnery, and unexploded ordnance',
    canonicalGlyph: 'mil_fire',
  },
  drifting: {
    id: 'drifting',
    label: 'Drifting Hazard',
    description: 'Derelict vessels, adrift containers, and floating navigational hazards',
    canonicalGlyph: 'drift',
  },
  aton: {
    id: 'aton',
    label: 'Aid to Navigation',
    description: 'Lights unlit, damaged beacons, and buoys destroyed or off-station',
    canonicalGlyph: 'aton',
  },
  subsea: {
    id: 'subsea',
    label: 'Subsea & Offshore',
    description: 'Submarine cables, pipelines, seismic/hydrographic surveys, and offshore rigs',
    canonicalGlyph: 'cable',
  },
  wreck: {
    id: 'wreck',
    label: 'Wreck / Obstruction',
    description: 'Dangerous sunken wrecks, submerged obstructions, and maritime security advisories',
    canonicalGlyph: 'wreck',
  },
};

/**
 * Soft-maps any of the 16 granular HazardCategory types to one of the 6 primary symbols.
 * Preserves high-resolution category in data while simplifying map presentation.
 */
export function toPrimarySymbol(category?: HazardCategory | string | null): PrimarySymbol {
  if (!category) return 'general';

  switch (category) {
    // 1. Military Operations & UXO
    case 'mil_fire':
    case 'uxo':
    case 'military':
    case 'military_ops':
    case 'mines area':
      return 'military';

    // 2. Drifting Hazards & Derelicts
    case 'drift':
    case 'drifting':
      return 'drifting';

    // 3. Aids to Navigation (AtoN)
    case 'aton':
      return 'aton';

    // 4. Subsea Infrastructure, Surveys & Offshore Rigs
    case 'cable':
    case 'survey':
    case 'rig':
    case 'subsea':
    case 'offshore':
    case 'drilling operations':
      return 'subsea';

    // 5. Wrecks, Submerged Obstructions & Security Advisories
    case 'wreck':
    case 'security':
      return 'wreck';

    // 6. General Navigational Hazards, Weather, Ice, SAR & Operations
    case 'general_chart':
    case 'general':
    case 'electronic':
    case 'in force':
    case 'ops':
    case 'service_status':
    case 'restricted':
    case 'sar':
    case 'weather':
    case 'ice':
    default:
      return 'general';
  }
}

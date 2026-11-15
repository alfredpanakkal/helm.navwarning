// src/utils/symbolMapping.ts
// Authoritative consolidation of 16 granular HazardCategory classifications
// into a compact set of primary display symbols.

import type { HazardCategory } from '../types/navarea';

export type PrimarySymbol =
  | 'general'
  | 'military'
  | 'drifting'
  | 'aton'
  | 'subsea'
  | 'cable'
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
    label: 'Offshore / Subsea Operations',
    description: 'Offshore structures, drilling operations, and subsea survey activity',
    canonicalGlyph: 'rig',
  },
  cable: {
    id: 'cable',
    label: 'Submarine Cable',
    description: 'Submarine cable routes, installation, repair, and maintenance',
    canonicalGlyph: 'cable',
  },
  wreck: {
    id: 'wreck',
    label: 'Wreck / Obstruction',
    description: 'Dangerous wrecks and submerged navigational obstructions',
    canonicalGlyph: 'wreck',
  },
};

/**
 * Soft-maps any of the 16 granular HazardCategory types to one of the primary symbols.
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

    // 4. Submarine cables use their own existing cable glyph.
    case 'cable':
      return 'cable';

    // 5. Offshore structures and subsea operations.
    case 'survey':
    case 'rig':
    case 'subsea':
    case 'offshore':
    case 'drilling operations':
      return 'subsea';

    // 6. Wrecks and submerged obstructions only.
    case 'wreck':
      return 'wreck';

    // 7. General Navigational Hazards, Weather, Ice, SAR & Operations
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

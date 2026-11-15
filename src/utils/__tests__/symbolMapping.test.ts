// src/utils/__tests__/symbolMapping.test.ts
import { describe, it, expect } from 'vitest';
import { isCableCategory, isRestrictedAreaCategory, toPrimarySymbol, PRIMARY_SYMBOLS, PrimarySymbol } from '../symbolMapping';
import type { HazardCategory } from '../../types/navarea';

describe('symbolMapping — primary warning symbols', () => {
  it('maps all 16 HazardCategory values to their correct PrimarySymbol', () => {
    // 1. Military
    expect(toPrimarySymbol('mil_fire')).toBe('military');
    expect(toPrimarySymbol('uxo')).toBe('military');
    expect(toPrimarySymbol('military')).toBe('military');
    expect(toPrimarySymbol('military_ops')).toBe('military');
    expect(toPrimarySymbol('mines area')).toBe('military');

    // 2. Drifting
    expect(toPrimarySymbol('drift')).toBe('drifting');
    expect(toPrimarySymbol('drifting')).toBe('drifting');

    // 3. AtoN
    expect(toPrimarySymbol('aton')).toBe('aton');

    // 4. Submarine cable has its own symbol.
    expect(toPrimarySymbol('cable')).toBe('cable');
    expect(toPrimarySymbol(' CABLE ')).toBe('cable');

    // 5. Offshore / subsea operations.
    expect(toPrimarySymbol('survey')).toBe('subsea');
    expect(toPrimarySymbol('rig')).toBe('subsea');
    expect(toPrimarySymbol('subsea')).toBe('subsea');
    expect(toPrimarySymbol('offshore')).toBe('subsea');
    expect(toPrimarySymbol('drilling operations')).toBe('subsea');

    // 6. Wreck / Obstruction (security is not a wreck).
    expect(toPrimarySymbol('wreck')).toBe('wreck');
    expect(toPrimarySymbol('security')).toBe('general');

    // 7. General
    expect(toPrimarySymbol('general_chart')).toBe('general');
    expect(toPrimarySymbol('ops')).toBe('general');
    expect(toPrimarySymbol('service_status')).toBe('general');
    expect(toPrimarySymbol('electronic')).toBe('general');
    expect(toPrimarySymbol('in force')).toBe('general');
    expect(toPrimarySymbol('restricted')).toBe('general');
    expect(toPrimarySymbol('sar')).toBe('general');
    expect(toPrimarySymbol('weather')).toBe('general');
    expect(toPrimarySymbol('ice')).toBe('general');
  });

  it('identifies cable routes and restricted areas without adding new point symbols', () => {
    expect(isCableCategory('cable')).toBe(true);
    expect(isCableCategory(' CABLE ')).toBe(true);
    expect(isCableCategory('subsea')).toBe(false);
    expect(isRestrictedAreaCategory('restricted')).toBe(true);
    expect(isRestrictedAreaCategory('RESTRICTED')).toBe(true);
    expect(isRestrictedAreaCategory('wreck')).toBe(false);
    expect(toPrimarySymbol('restricted')).toBe('general');
  });

  it('safely handles null, undefined, empty, and unknown category strings with general fallback', () => {
    expect(toPrimarySymbol(null)).toBe('general');
    expect(toPrimarySymbol(undefined)).toBe('general');
    expect(toPrimarySymbol('')).toBe('general');
    expect(toPrimarySymbol('unknown_hazard_type' as HazardCategory)).toBe('general');
  });

  it('ensures all 6 primary symbols have valid metadata and canonical glyphs', () => {
    const requiredSymbols: PrimarySymbol[] = ['general', 'military', 'drifting', 'aton', 'subsea', 'cable', 'wreck'];

    requiredSymbols.forEach((sym) => {
      const meta = PRIMARY_SYMBOLS[sym];
      expect(meta).toBeDefined();
      expect(meta.id).toBe(sym);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.canonicalGlyph).toBeDefined();
    });
  });
});

// src/utils/__tests__/symbolMapping.test.ts
import { describe, it, expect } from 'vitest';
import { toPrimarySymbol, PRIMARY_SYMBOLS, PrimarySymbol } from '../symbolMapping';
import type { HazardCategory } from '../../types/navarea';

describe('symbolMapping — 6 Primary Symbol System', () => {
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

    // 4. Subsea
    expect(toPrimarySymbol('cable')).toBe('subsea');
    expect(toPrimarySymbol('survey')).toBe('subsea');
    expect(toPrimarySymbol('rig')).toBe('subsea');
    expect(toPrimarySymbol('subsea')).toBe('subsea');
    expect(toPrimarySymbol('offshore')).toBe('subsea');
    expect(toPrimarySymbol('drilling operations')).toBe('subsea');

    // 5. Wreck / Obstruction
    expect(toPrimarySymbol('wreck')).toBe('wreck');
    expect(toPrimarySymbol('security')).toBe('wreck');

    // 6. General
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

  it('safely handles null, undefined, empty, and unknown category strings with general fallback', () => {
    expect(toPrimarySymbol(null)).toBe('general');
    expect(toPrimarySymbol(undefined)).toBe('general');
    expect(toPrimarySymbol('')).toBe('general');
    expect(toPrimarySymbol('unknown_hazard_type' as HazardCategory)).toBe('general');
  });

  it('ensures all 6 primary symbols have valid metadata and canonical glyphs', () => {
    const requiredSymbols: PrimarySymbol[] = ['general', 'military', 'drifting', 'aton', 'subsea', 'wreck'];

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

import { describe, expect, it } from 'vitest';
import { resolveWarningVisuals } from '../warningVisuals';

describe('resolveWarningVisuals', () => {
  it('uses the canonical persisted category for the symbol', () => {
    const result = resolveWarningVisuals(['mil_fire', 'military'], 'critical', 'ordinary notice');
    expect(result.category).toBe('mil_fire');
    expect(result.symbol).toBe('military');
  });

  it('supports legacy category values already stored in Supabase', () => {
    expect(resolveWarningVisuals(['military'], 'critical', '').symbol).toBe('military');
    expect(resolveWarningVisuals(['drifting'], 'high', '').symbol).toBe('drifting');
    expect(resolveWarningVisuals(['offshore'], 'moderate', '').symbol).toBe('subsea');
    expect(resolveWarningVisuals(['subsea'], 'moderate', '').symbol).toBe('subsea');
  });

  it('uses persisted severity instead of independently reclassifying the text', () => {
    const result = resolveWarningVisuals(['cable'], 'moderate', 'NAVAL GUNNERY EXERCISE');
    expect(result.severity).toBe('moderate');
    expect(result.legacySeverity).toBe('caution');
    expect(result.displayStyle).toBe('active');
  });

  it('falls back to text classification only when persisted severity is absent or invalid', () => {
    expect(resolveWarningVisuals(['mil_fire'], null, 'NAVAL FIRING EXERCISE').severity).toBe('critical');
    expect(resolveWarningVisuals(['aton'], 'unknown', 'LIGHT UNLIT').severity).toBe('high');
  });

  it('does not use parser triage as maritime severity', () => {
    const result = resolveWarningVisuals(['general_chart'], 'moderate', 'CHART CORRECTION');
    expect(result.severity).toBe('moderate');
  });

  it('keeps unknown categories visible as a raw category and uses the general symbol fallback', () => {
    const result = resolveWarningVisuals(['future_hazard_code'], 'moderate', '');
    expect(result.category).toBe('future_hazard_code');
    expect(result.symbol).toBe('general');
  });
});

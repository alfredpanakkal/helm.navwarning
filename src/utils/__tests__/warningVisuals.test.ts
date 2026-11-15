import { describe, expect, it } from 'vitest';
import { matchesSeverityFilter, resolveWarningVisuals } from '../warningVisuals';

describe('resolveWarningVisuals', () => {
  it('uses the canonical persisted category for the symbol', () => {
    const result = resolveWarningVisuals(['mil_fire', 'military'], 'critical', 'ordinary notice');
    expect(result.category).toBe('mil_fire');
    expect(result.symbol).toBe('military');
  });

  it('supports legacy category values already stored in Supabase', () => {
    expect(resolveWarningVisuals(['military'], 'critical', '').symbol).toBe('military');
    expect(resolveWarningVisuals(['drifting'], 'high', '').symbol).toBe('drifting');
    expect(resolveWarningVisuals(['cable'], 'moderate', '').symbol).toBe('cable');
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


describe('matchesSeverityFilter', () => {
  it('matches persisted severity, not parser confidence or bulletin keywords', () => {
    expect(matchesSeverityFilter(['general'], 'critical', 'CHART CORRECTION', 'critical')).toBe(true);
    expect(matchesSeverityFilter(['general'], 'moderate', 'NAVAL FIRING EXERCISE', 'moderate')).toBe(true);
    expect(matchesSeverityFilter(['general'], 'moderate', 'NAVAL FIRING EXERCISE', 'critical')).toBe(false);
  });

  it('uses text classification only for missing legacy severity and keeps All inclusive', () => {
    expect(matchesSeverityFilter(['mil_fire'], null, 'NAVAL FIRING EXERCISE', 'critical')).toBe(true);
    expect(matchesSeverityFilter(['general'], 'moderate', '', 'all')).toBe(true);
  });
});

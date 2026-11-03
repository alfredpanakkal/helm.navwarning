/**
 * WCAG 2.1 contrast regression suite for the Helm.Warning watch themes.
 *
 * Same approach as the Helm.Ports contrast tests: compute relative luminance
 * per WCAG 2.1 and require text pairs >= 4.5:1 and non-text pairs
 * (borders, status colours, focus rings) >= 3:1, for every theme.
 */
import { describe, expect, it } from 'vitest';
import { THEME_NAMES, THEME_PALETTES, type ThemePalette } from './themeTokens';

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length !== 6) throw new Error('expected 6-digit hex: ' + hex);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function severityPairs(p: ThemePalette): Array<[string, string]> {
  return [
    [p.sevCritical, p.background],
    [p.sevHigh, p.background],
    [p.sevModerate, p.background],
    [p.sevCritical, p.surface],
    [p.sevHigh, p.surface],
    [p.sevModerate, p.surface],
    [p.sevCritical, p.accentFill],
    [p.sevHigh, p.accentFill],
    [p.sevModerate, p.accentFill],
  ];
}

describe('watch-theme WCAG contrast', () => {
  it('every palette meets text and non-text thresholds on every surface', () => {
    for (const name of THEME_NAMES) {
      const p = THEME_PALETTES[name];
      const textPairs: Array<[string, string, string]> = [
        [p.foreground, p.background, name + ' foreground/background'],
        [p.foreground, p.surface, name + ' foreground/surface'],
        [p.mutedForeground, p.background, name + ' muted/background'],
        [p.mutedForeground, p.surface, name + ' muted/surface'],
        [p.accent, p.background, name + ' accent/background'],
        [p.accent, p.accentFill, name + ' accent/accentFill'],
        ...severityPairs(p).map(
          (pair) => [pair[0], pair[1], name + ' severity'] as [string, string, string],
        ),
      ];
      for (const [fg, bg, label] of textPairs) {
        expect(contrast(fg, bg), label + ' (' + fg + ' on ' + bg + ')').toBeGreaterThanOrEqual(4.5);
      }
      // Borders, control lines and status edges are non-text: >= 3:1.
      expect(contrast(p.line, p.background), name + ' line/background').toBeGreaterThanOrEqual(3);
      expect(contrast(p.line, p.surface), name + ' line/surface').toBeGreaterThanOrEqual(3);
    }
  });

  it('headline ratios match the reviewed design values', () => {
    expect(contrast('#1D211E', '#FAFAF7')).toBeCloseTo(15.59, 1);
    expect(contrast('#E9EDE9', '#0E1210')).toBeCloseTo(15.96, 1);
    expect(contrast('#E0857A', '#080404')).toBeCloseTo(7.58, 1);
    // The two Night pairs that were deliberately adjusted to pass:
    expect(contrast('#B5786B', '#120A08')).toBeCloseTo(5.47, 1);
    expect(contrast('#945E53', '#120A08')).toBeCloseTo(3.72, 1);
  });

  it('the lighter Helm.Ports amber fails 4.5:1 on the mint accent fill (regression guard)', () => {
    // Guards the deliberate choice of the darker High value #8C5208 in light
    // theme: the original #A16207 does not pass for text on --accent-fill.
    expect(contrast('#A16207', '#DDEFE0')).toBeLessThan(4.5);
    expect(contrast('#8C5208', '#DDEFE0')).toBeGreaterThanOrEqual(4.5);
  });

  it('night keeps the palette inside the red/brown family', () => {
    const p = THEME_PALETTES.night;
    for (const c of [p.background, p.surface, p.accentFill, p.line, p.mutedForeground]) {
      const h = c.replace('#', '');
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      expect(r, c + ' red-dominant').toBeGreaterThan(g);
      expect(g, c + ' brown not blue').toBeGreaterThanOrEqual(b);
    }
  });
});

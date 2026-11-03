/**
 * Helm.Warning watch-theme tokens — single source of truth.
 *
 * Mirrors the CSS token system in public/assets/css/tokens.css
 * (data-theme="light" | "dark" | "night" on <html>). Light is "Chart paper",
 * Dark is "Bridge", Night is "Red watch" (dim reds/browns on near-black to
 * protect night vision on the bridge).
 *
 * Every colour pair here is checked against WCAG 2.1 in
 * themeContrast.test.ts: text pairs >= 4.5:1, borders/status/focus >= 3:1.
 * If you change a value, change it here AND in tokens.css, then keep both
 * suites green.
 */

export type ThemeName = 'light' | 'dark' | 'night';

export interface ThemePalette {
  /** page background */
  background: string;
  /** cards, sheets */
  surface: string;
  /** primary text */
  foreground: string;
  /** secondary text */
  mutedForeground: string;
  /** links + active state */
  accent: string;
  /** chips / selected fills the accent sits on */
  accentFill: string;
  /** borders, control lines, status edges (non-text: >= 3:1) */
  line: string;
  /** severity colours — always paired with a shape and a word in markup */
  sevCritical: string;
  sevHigh: string;
  sevModerate: string;
}

export const THEME_PALETTES: Record<ThemeName, ThemePalette> = {
  light: {
    background: '#FAFAF7',
    surface: '#FFFFFF',
    foreground: '#1D211E',
    mutedForeground: '#5D665F',
    accent: '#2F6B4F',
    accentFill: '#DDEFE0',
    line: '#6F7770',
    sevCritical: '#B42318',
    sevHigh: '#8C5208',
    sevModerate: '#2E5C8A',
  },
  dark: {
    background: '#0E1210',
    surface: '#151A17',
    foreground: '#E9EDE9',
    mutedForeground: '#9FA69F',
    accent: '#8FCBA8',
    accentFill: '#1C2A22',
    line: '#6B756C',
    sevCritical: '#F08484',
    sevHigh: '#D9A24A',
    sevModerate: '#8DB4E2',
  },
  night: {
    background: '#080404',
    surface: '#120A08',
    foreground: '#E0857A',
    mutedForeground: '#B5786B',
    accent: '#E0857A',
    accentFill: '#2A1412',
    line: '#945E53',
    sevCritical: '#FF6B5E',
    sevHigh: '#D08A3E',
    sevModerate: '#BC8577',
  },
};

export const THEME_NAMES: readonly ThemeName[] = ['light', 'dark', 'night'];

/** localStorage key used by the pre-paint script and the About-page toggle. */
export const THEME_STORAGE_KEY = 'hw-theme';

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

/**
 * Console (React app) mapping — how the watch themes land on the console's
 * gw-* custom properties in src/index.css. The LIGHT values are the
 * console's historical palette (so the default console look is unchanged);
 * dark/night remap every token onto the Bridge / Red watch palettes.
 *
 * The console wires no theme switcher yet — these blocks are inert until
 * <html data-theme="dark|night"> is set. A console switcher lands after the
 * raw-palette migration (bg-white / slate-* classes -> gw-* tokens).
 */
export interface ConsoleTokens {
  /** main text (light theme: dark chrome ink; dark/night: foreground text) */
  primary: string;
  /** hairlines + muted text on light surfaces (dark/night: the design --line) */
  secondary: string;
  /** panels/chips on dark chrome */
  tertiary: string;
  /** page background */
  bg: string;
  /** muted text */
  accent: string;
  /** muted text lift for dark chrome surfaces */
  accentOnDark: string;
  /** panel/sheet surface (--bg-secondary) */
  bgSecondary: string;
  critical: string;
  high: string;
  moderate: string;
}

export const CONSOLE_TOKEN_MAP: Record<ThemeName, ConsoleTokens> = {
  light: {
    primary: '#0f172a',
    secondary: '#e2e8f0',
    tertiary: '#334155',
    bg: '#fafafa',
    accent: '#64748b',
    accentOnDark: '#94a3b8',
    bgSecondary: '#ffffff',
    critical: '#B42318',
    high: '#8C5208',
    moderate: '#2E5C8A',
  },
  dark: {
    primary: '#E9EDE9',
    secondary: '#6B756C',
    tertiary: '#1C2A22',
    bg: '#0E1210',
    accent: '#9FA69F',
    accentOnDark: '#9FA69F',
    bgSecondary: '#151A17',
    critical: '#F08484',
    high: '#D9A24A',
    moderate: '#8DB4E2',
  },
  night: {
    primary: '#E0857A',
    secondary: '#945E53',
    tertiary: '#2A1412',
    bg: '#080404',
    accent: '#B5786B',
    accentOnDark: '#B5786B',
    bgSecondary: '#120A08',
    critical: '#FF6B5E',
    high: '#D08A3E',
    moderate: '#BC8577',
  },
};

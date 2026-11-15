// src/utils/hazardIcons.ts
// Maritime SVG iconography and solid severity-filled marker badges.

import type { HazardCategory, DisplayStyle, Severity } from '../types/navarea';
import { type PrimarySymbol, toPrimarySymbol } from './symbolMapping';

/**
 * 3-tier severity tokens (+ neutral/info) adhering to Helm.Ports moss palette:
 * Critical: --sev-critical (#B42318)
 * High:     --sev-high (#8C5208)
 * Moderate: --accent (#2F6B4F)
 */
export const SEVERITY_FILL_COLORS: Record<'critical' | 'high' | 'moderate' | 'caution' | 'info', { stroke: string; fill: string; bg: string }> = {
  critical: { stroke: '#B42318', fill: 'rgba(180, 35, 24, 0.16)', bg: '#B42318' },
  high: { stroke: '#8C5208', fill: 'rgba(140, 82, 8, 0.16)', bg: '#8C5208' },
  moderate: { stroke: '#2F6B4F', fill: 'rgba(47, 107, 79, 0.16)', bg: '#2F6B4F' },
  caution: { stroke: '#2F6B4F', fill: 'rgba(47, 107, 79, 0.16)', bg: '#2F6B4F' },
  info: { stroke: '#2F6B4F', fill: 'rgba(47, 107, 79, 0.16)', bg: '#2F6B4F' },
};

export const SEVERITY_COLORS: Record<DisplayStyle, { stroke: string; fill: string; bg: string }> = {
  critical: { stroke: '#B42318', fill: 'rgba(180, 35, 24, 0.16)', bg: '#B42318' },
  high: { stroke: '#8C5208', fill: 'rgba(140, 82, 8, 0.16)', bg: '#8C5208' },
  active: { stroke: '#2F6B4F', fill: 'rgba(47, 107, 79, 0.16)', bg: '#2F6B4F' },
  verified: { stroke: '#2F6B4F', fill: 'rgba(47, 107, 79, 0.16)', bg: '#2F6B4F' },
  neutral: { stroke: '#687169', fill: 'rgba(104, 113, 105, 0.16)', bg: '#687169' },
  explicit: { stroke: '#475569', fill: 'rgba(71, 85, 105, 0.16)', bg: '#475569' },
  inferred: { stroke: '#8C5208', fill: 'rgba(140, 82, 8, 0.16)', bg: '#8C5208' },
  ambiguous: { stroke: '#8C5208', fill: 'rgba(140, 82, 8, 0.16)', bg: '#8C5208' },
  invalid: { stroke: '#B42318', fill: 'rgba(180, 35, 24, 0.16)', bg: '#B42318' },
  review: { stroke: '#2F6B4F', fill: 'rgba(47, 107, 79, 0.16)', bg: '#2F6B4F' },
};

/**
 * 7 Primary SVG Symbol Paths (24x24 viewBox)
 */
export const PRIMARY_SVG_PATHS: Record<PrimarySymbol, string> = {
  // 1. General Navigational Hazard: 8-point compass star
  general: `
    <polygon points="12,2 14.5,9.5 22,12 14.5,14.5 12,22 9.5,14.5 2,12 9.5,9.5" fill="currentColor"/>
  `,
  // 2. Military Operations & UXO: crosshair target burst
  military: `
    <circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.8" fill="none"/>
    <line x1="12" y1="2" x2="12" y2="7" stroke="currentColor" stroke-width="2"/>
    <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="2"/>
    <line x1="2" y1="12" x2="7" y2="12" stroke="currentColor" stroke-width="2"/>
    <line x1="17" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
  `,
  // 3. Drifting Hazard & Derelict: drifting vessel silhouette
  drifting: `
    <path d="M3 15 L21 15 L18 19 L6 19 Z" fill="currentColor"/>
    <path d="M12 4 L12 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 6 L17 10 L12 11 Z" fill="currentColor"/>
  `,
  // 4. Aids to Navigation (AtoN): lighthouse beacon
  aton: `
    <polygon points="9,20 15,20 13,8 11,8" stroke="currentColor" stroke-width="1.5" fill="currentColor"/>
    <rect x="10" y="5" width="4" height="3" fill="currentColor"/>
    <polygon points="12,2 8,5 16,5" fill="currentColor"/>
    <line x1="4" y1="6" x2="7" y2="7" stroke="currentColor" stroke-width="1.5"/>
    <line x1="20" y1="6" x2="17" y2="7" stroke="currentColor" stroke-width="1.5"/>
  `,
  // 5. Offshore / subsea operations: existing rig silhouette
  subsea: `
    <line x1="7" y1="19" x2="10" y2="7" stroke="currentColor" stroke-width="1.8"/>
    <line x1="17" y1="19" x2="14" y2="7" stroke="currentColor" stroke-width="1.8"/>
    <line x1="7" y1="15" x2="17" y2="15" stroke="currentColor" stroke-width="1.5"/>
    <line x1="9" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="1.5"/>
    <rect x="8" y="5" width="8" height="2.5" fill="currentColor"/>
    <line x1="12" y1="2" x2="12" y2="5" stroke="currentColor" stroke-width="2"/>
  `,
  // 6. Submarine cable: existing cable spool and route glyph
  cable: `
    <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="none"/>
    <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
    <path d="M4 17 Q8 10 12 12 T20 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
  `,
  // 7. Wreck / obstruction cue, not a literal S-52 symbol.
  // S-52 wreck portrayal is conditional on ENC attributes (e.g. depth, water level and wreck category).
  wreck: `
    <line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" stroke-width="2"/>
    <path d="M6 18 Q12 12 18 18" stroke="currentColor" stroke-width="2" fill="none"/>
    <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
    <line x1="9" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="2"/>
  `,
};

/**
 * Retained full 16-category granular dictionary for provenance & legacy compatibility
 */
export const HAZARD_SVG_PATHS: Record<HazardCategory, string> = {
  mil_fire: PRIMARY_SVG_PATHS.military,
  drift: PRIMARY_SVG_PATHS.drifting,
  uxo: `
    <circle cx="12" cy="12" r="5" fill="currentColor"/>
    <line x1="12" y1="3" x2="12" y2="6" stroke="currentColor" stroke-width="2"/>
    <line x1="12" y1="18" x2="12" y2="21" stroke="currentColor" stroke-width="2"/>
    <line x1="3" y1="12" x2="6" y2="12" stroke="currentColor" stroke-width="2"/>
    <line x1="18" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>
    <line x1="5.5" y1="5.5" x2="7.5" y2="7.5" stroke="currentColor" stroke-width="2"/>
    <line x1="16.5" y1="16.5" x2="18.5" y2="18.5" stroke="currentColor" stroke-width="2"/>
    <line x1="18.5" y1="5.5" x2="16.5" y2="7.5" stroke="currentColor" stroke-width="2"/>
    <line x1="7.5" y1="16.5" x2="5.5" y2="18.5" stroke="currentColor" stroke-width="2"/>
  `,
  sar: `
    <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="2" fill="none"/>
    <line x1="6.5" y1="6.5" x2="9.5" y2="9.5" stroke="currentColor" stroke-width="2.5"/>
    <line x1="17.5" y1="6.5" x2="14.5" y2="9.5" stroke="currentColor" stroke-width="2.5"/>
    <line x1="6.5" y1="17.5" x2="9.5" y2="14.5" stroke="currentColor" stroke-width="2.5"/>
    <line x1="17.5" y1="17.5" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="2.5"/>
  `,
  aton: PRIMARY_SVG_PATHS.aton,
  cable: PRIMARY_SVG_PATHS.cable,
  survey: `
    <circle cx="12" cy="17" r="2" fill="currentColor"/>
    <path d="M7 13 A7 7 0 0 1 17 13" stroke="currentColor" stroke-width="1.8" fill="none"/>
    <path d="M4 9 A11 11 0 0 1 20 9" stroke="currentColor" stroke-width="1.8" fill="none"/>
  `,
  rig: `
    <line x1="7" y1="19" x2="10" y2="7" stroke="currentColor" stroke-width="1.8"/>
    <line x1="17" y1="19" x2="14" y2="7" stroke="currentColor" stroke-width="1.8"/>
    <line x1="7" y1="15" x2="17" y2="15" stroke="currentColor" stroke-width="1.5"/>
    <line x1="9" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="1.5"/>
    <rect x="8" y="5" width="8" height="2.5" fill="currentColor"/>
    <line x1="12" y1="2" x2="12" y2="5" stroke="currentColor" stroke-width="2"/>
  `,
  weather: `
    <path d="M12 4 A8 8 0 0 1 20 12 A8 8 0 0 1 12 20 A4 4 0 0 1 8 16 A4 4 0 0 1 12 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
  `,
  ice: `
    <polygon points="12,3 17,9 15,19 9,19 7,9" stroke="currentColor" stroke-width="1.8" fill="none"/>
    <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="3" x2="12" y2="19" stroke="currentColor" stroke-width="1.5"/>
  `,
  security: `
    <path d="M12 3 L19 6 V12 C19 16.5 15.5 20 12 21 C8.5 20 5 16.5 5 12 V6 Z" stroke="currentColor" stroke-width="1.8" fill="none"/>
    <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="16" r="1" fill="currentColor"/>
  `,
  wreck: PRIMARY_SVG_PATHS.wreck,
  ops: `
    <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="none"/>
    <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" stroke-width="2"/>
    <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
  `,
  service_status: `
    <line x1="12" y1="7" x2="12" y2="21" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="6" r="2.5" fill="currentColor"/>
    <path d="M7 10 A7 7 0 0 1 17 10" stroke="currentColor" stroke-width="1.8" fill="none"/>
    <path d="M4 6 A11 11 0 0 1 20 6" stroke="currentColor" stroke-width="1.8" fill="none"/>
  `,
  general_chart: PRIMARY_SVG_PATHS.general,
  restricted: `
    <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/>
    <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" stroke="currentColor" stroke-width="2"/>
  `,
};

function isPrimarySymbol(val: any): val is PrimarySymbol {
  return ['general', 'military', 'drifting', 'aton', 'subsea', 'cable', 'wreck'].includes(val);
}

/**
 * Generates an SVG string for a primary symbol (e.g. for map legend or UI lists).
 */
export function renderPrimarySymbolSvg(symbol: PrimarySymbol, size = 16, color = 'currentColor'): string {
  const path = PRIMARY_SVG_PATHS[symbol] || PRIMARY_SVG_PATHS.general;
  return `
    <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" style="color: ${color};" xmlns="http://www.w3.org/2000/svg">
      ${path}
    </svg>
  `;
}

/**
 * Renders a circular map marker with severity as the solid fill.
 * Category glyph and warning geometry remain independent of severity.
 */
export function renderHazardBadgeHtml(
  categoryOrSymbol: HazardCategory | PrimarySymbol,
  displayStyle: DisplayStyle = 'critical',
  isPulsing = false,
  label?: string,
  customSeverity?: Severity
): string {
  // 1. Resolve the category glyph
  const primarySym: PrimarySymbol = isPrimarySymbol(categoryOrSymbol)
    ? categoryOrSymbol
    : toPrimarySymbol(categoryOrSymbol);

  // 2. Resolve the severity fill
  const colors = customSeverity
    ? (SEVERITY_FILL_COLORS[customSeverity] || SEVERITY_FILL_COLORS.moderate)
    : (SEVERITY_COLORS[displayStyle] || SEVERITY_COLORS.critical);

  const path = PRIMARY_SVG_PATHS[primarySym] || PRIMARY_SVG_PATHS.general;

  const pulseRing = isPulsing
    ? `<div class="nw-pulse-ring" style="position: absolute; inset: -4px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.9); opacity: 0.7; animation: pulse 2s infinite ease-out;"></div>`
    : '';

  const labelBadge = label
    ? `<span class="nw-marker-label" style="background:${colors.bg}; position: absolute; bottom: -14px; left: 50%; transform: translateX(-50%); font-size: 9px; font-family: monospace; font-weight: 500; color: #ffffff; padding: 1px 4px; border-radius: 4px; white-space: nowrap; pointer-events: none;">${label}</span>`
    : '';

  return `
    <div class="nw-hazard-badge ${isPulsing ? 'is-pulsing' : ''}" style="color: #ffffff; background: ${colors.bg}; width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #111827; display: flex; align-items: center; justify-content: center; position: relative; box-sizing: border-box; box-shadow: 0 0 0 1px rgba(255,255,255,0.95), 0 2px 6px rgba(0,0,0,0.45);">
      ${pulseRing}
      <svg viewBox="0 0 24 24" style="width: 14px; height: 14px;" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${path}
      </svg>
      ${labelBadge}
    </div>
  `;
}

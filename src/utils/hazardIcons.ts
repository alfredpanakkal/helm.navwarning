// src/utils/hazardIcons.ts
// Domain-authentic maritime SVG iconography registry for polymorphic NAVAREA hazards

import type { HazardCategory, DisplayStyle, Severity } from '../types/navarea';

export const SEVERITY_COLORS: Record<DisplayStyle, { stroke: string; fill: string; bg: string }> = {
  critical: { stroke: '#dc2626', fill: 'rgba(220, 38, 38, 0.18)', bg: '#dc2626' },
  high: { stroke: '#ea580c', fill: 'rgba(234, 88, 12, 0.18)', bg: '#ea580c' },
  active: { stroke: '#059669', fill: 'rgba(5, 150, 105, 0.18)', bg: '#059669' },
  verified: { stroke: '#0d9488', fill: 'rgba(13, 148, 136, 0.18)', bg: '#0d9488' },
  neutral: { stroke: '#64748b', fill: 'rgba(100, 116, 139, 0.18)', bg: '#64748b' },
  explicit: { stroke: '#475569', fill: 'rgba(71, 85, 105, 0.18)', bg: '#475569' },
  inferred: { stroke: '#d97706', fill: 'rgba(217, 119, 6, 0.18)', bg: '#d97706' },
  ambiguous: { stroke: '#7c3aed', fill: 'rgba(124, 58, 237, 0.18)', bg: '#7c3aed' },
  invalid: { stroke: '#b91c1c', fill: 'rgba(185, 28, 28, 0.18)', bg: '#b91c1c' },
  review: { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.18)', bg: '#3b82f6' },
};

export const HAZARD_SVG_PATHS: Record<HazardCategory, string> = {
  // Gunnery / Firing: crosshair burst
  mil_fire: `
    <circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.8" fill="none"/>
    <line x1="12" y1="2" x2="12" y2="7" stroke="currentColor" stroke-width="2"/>
    <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="2"/>
    <line x1="2" y1="12" x2="7" y2="12" stroke="currentColor" stroke-width="2"/>
    <line x1="17" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
  `,
  // Derelicts / Drifting hazards: drifting vessel silhouette
  drift: `
    <path d="M3 15 L21 15 L18 19 L6 19 Z" fill="currentColor"/>
    <path d="M12 4 L12 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 6 L17 10 L12 11 Z" fill="currentColor"/>
  `,
  // UXO / Mines: naval contact mine with spikes
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
  // Search and Rescue (SAR): lifebuoy ring
  sar: `
    <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="2" fill="none"/>
    <line x1="6.5" y1="6.5" x2="9.5" y2="9.5" stroke="currentColor" stroke-width="2.5"/>
    <line x1="17.5" y1="6.5" x2="14.5" y2="9.5" stroke="currentColor" stroke-width="2.5"/>
    <line x1="6.5" y1="17.5" x2="9.5" y2="14.5" stroke="currentColor" stroke-width="2.5"/>
    <line x1="17.5" y1="17.5" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="2.5"/>
  `,
  // Aids to Navigation (AtoN) / Lights: lighthouse
  aton: `
    <polygon points="9,20 15,20 13,8 11,8" stroke="currentColor" stroke-width="1.5" fill="currentColor"/>
    <rect x="10" y="5" width="4" height="3" fill="currentColor"/>
    <polygon points="12,2 8,5 16,5" fill="currentColor"/>
    <line x1="4" y1="6" x2="7" y2="7" stroke="currentColor" stroke-width="1.5"/>
    <line x1="20" y1="6" x2="17" y2="7" stroke="currentColor" stroke-width="1.5"/>
  `,
  // Submarine Cables & Pipelines: cable spool
  cable: `
    <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="none"/>
    <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
    <path d="M4 17 Q8 10 12 12 T20 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
  `,
  // Surveys: sonar acoustic waves
  survey: `
    <circle cx="12" cy="17" r="2" fill="currentColor"/>
    <path d="M7 13 A7 7 0 0 1 17 13" stroke="currentColor" stroke-width="1.8" fill="none"/>
    <path d="M4 9 A11 11 0 0 1 20 9" stroke="currentColor" stroke-width="1.8" fill="none"/>
  `,
  // Offshore Rigs: platform tower
  rig: `
    <line x1="7" y1="19" x2="10" y2="7" stroke="currentColor" stroke-width="1.8"/>
    <line x1="17" y1="19" x2="14" y2="7" stroke="currentColor" stroke-width="1.8"/>
    <line x1="7" y1="15" x2="17" y2="15" stroke="currentColor" stroke-width="1.5"/>
    <line x1="9" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="1.5"/>
    <rect x="8" y="5" width="8" height="2.5" fill="currentColor"/>
    <line x1="12" y1="2" x2="12" y2="5" stroke="currentColor" stroke-width="2"/>
  `,
  // Weather / Tropical Cyclones: spiral vortex
  weather: `
    <path d="M12 4 A8 8 0 0 1 20 12 A8 8 0 0 1 12 20 A4 4 0 0 1 8 16 A4 4 0 0 1 12 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
  `,
  // Ice patrol / icebergs: iceberg crystal
  ice: `
    <polygon points="12,3 17,9 15,19 9,19 7,9" stroke="currentColor" stroke-width="1.8" fill="none"/>
    <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" stroke-width="1.5"/>
    <line x1="12" y1="3" x2="12" y2="19" stroke="currentColor" stroke-width="1.5"/>
  `,
  // Security / Piracy: security alert shield
  security: `
    <path d="M12 3 L19 6 V12 C19 16.5 15.5 20 12 21 C8.5 20 5 16.5 5 12 V6 Z" stroke="currentColor" stroke-width="1.8" fill="none"/>
    <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="16" r="1" fill="currentColor"/>
  `,
  // Wrecks: submerged mast
  wreck: `
    <line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" stroke-width="2"/>
    <path d="M6 18 Q12 12 18 18" stroke="currentColor" stroke-width="2" fill="none"/>
    <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
    <line x1="9" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="2"/>
  `,
  // Marine Operations: nautical gear
  ops: `
    <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="none"/>
    <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" stroke-width="2"/>
    <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
  `,
  // Service outages: radio broadcast mast
  service_status: `
    <line x1="12" y1="7" x2="12" y2="21" stroke="currentColor" stroke-width="2"/>
    <circle cx="12" cy="6" r="2.5" fill="currentColor"/>
    <path d="M7 10 A7 7 0 0 1 17 10" stroke="currentColor" stroke-width="1.8" fill="none"/>
    <path d="M4 6 A11 11 0 0 1 20 6" stroke="currentColor" stroke-width="1.8" fill="none"/>
  `,
  // Chart corrections & Soundings: navigation compass star
  general_chart: `
    <polygon points="12,2 14.5,9.5 22,12 14.5,14.5 12,22 9.5,14.5 2,12 9.5,9.5" fill="currentColor"/>
  `,
  // Restricted areas: prohibition barrier
  restricted: `
    <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/>
    <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" stroke="currentColor" stroke-width="2"/>
  `,
};

export function renderHazardBadgeHtml(
  category: HazardCategory,
  displayStyle: DisplayStyle = 'critical',
  isPulsing = false,
  label?: string
): string {
  const colors = SEVERITY_COLORS[displayStyle] || SEVERITY_COLORS.critical;
  const path = HAZARD_SVG_PATHS[category] || HAZARD_SVG_PATHS.ops;

  const pulseRing = isPulsing
    ? `<div class="nw-pulse-ring" style="border-color: ${colors.stroke};"></div>`
    : '';

  const labelBadge = label
    ? `<span class="nw-marker-label" style="background:${colors.bg};">${label}</span>`
    : '';

  return `
    <div class="nw-hazard-badge ${isPulsing ? 'is-pulsing' : ''}" style="color: ${colors.stroke}; border-color: ${colors.stroke};">
      ${pulseRing}
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${path}
      </svg>
      ${labelBadge}
    </div>
  `;
}

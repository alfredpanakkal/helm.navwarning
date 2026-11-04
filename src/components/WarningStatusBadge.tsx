// src/components/WarningStatusBadge.tsx
// Phase 6: Color-coded badge displaying a warning's in-force coverage state with tooltip

import React from 'react';
import { MapPin, FileText, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import type { NavWarning } from '../types';
import { computeWarningStatus, type InForceWarningStatus } from '../hooks/useInForceStatus';
import { FEATURE_FLAGS } from '../lib/featureFlags';

export interface WarningStatusBadgeProps {
  status?: InForceWarningStatus['status'] | string;
  warningStatus?: InForceWarningStatus;
  warning?: NavWarning;
  compact?: boolean;
  className?: string;
}

interface BadgeConfig {
  label: string;
  shortLabel: string;
  tooltip: string;
  containerClass: string;
  icon: React.ElementType;
}

const BADGE_CONFIGS: Record<InForceWarningStatus['status'], BadgeConfig> = {
  held_with_geometry: {
    label: 'In-Force: Mapped',
    shortLabel: 'Mapped',
    tooltip: 'Listed in official in-force bulletin with validated spatial coordinates & geometry',
    containerClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-emerald-500/20',
    icon: MapPin,
  },
  held_without_geometry: {
    label: 'In-Force: Verified',
    shortLabel: 'Verified',
    tooltip: 'Listed in official in-force bulletin and verified, but lacks spatial coordinates',
    containerClass: 'bg-amber-50 text-amber-800 border-amber-300 ring-amber-500/20',
    icon: FileText,
  },
  held_text_only: {
    label: 'In-Force: Text Only',
    shortLabel: 'Text Only',
    tooltip: 'Listed in official in-force bulletin as raw/unverified text without coordinates',
    containerClass: 'bg-orange-50 text-orange-800 border-orange-300 ring-orange-500/20',
    icon: AlertTriangle,
  },
  not_held: {
    label: 'Missing from DB',
    shortLabel: 'Missing',
    tooltip: 'Active warning listed in official in-force bulletin, but not currently held in database',
    containerClass: 'bg-red-50 text-red-800 border-red-300 ring-red-500/20',
    icon: XCircle,
  },
};

/**
 * Safe fallback for undetermined or unknown statuses. Never render an unknown
 * state in the most-trusted green — unknown means "review", not "in-force".
 */
const NEEDS_REVIEW_CONFIG: BadgeConfig = {
  label: 'Needs Review',
  shortLabel: 'Review',
  tooltip: 'In-force status not determined - treat as unverified until reviewed',
  containerClass: 'bg-amber-50 text-amber-800 border-amber-300 ring-amber-500/20',
  icon: HelpCircle,
};

export const WarningStatusBadge: React.FC<WarningStatusBadgeProps> = ({
  status,
  warningStatus,
  warning,
  compact = false,
  className = '',
}) => {
  if (!FEATURE_FLAGS.inForceUIDisplay) {
    return null;
  }

  let effectiveStatus: InForceWarningStatus['status'] | string | null = null;
  if (warningStatus?.status) {
    effectiveStatus = warningStatus.status;
  } else if (status) {
    effectiveStatus = status;
  } else if (warning) {
    effectiveStatus = computeWarningStatus(warning);
  }
  // Unknown or undetermined statuses fall back to the amber Needs Review pill
  // instead of the green in-force config (safety: unknown is not "mapped").
  const config =
    (effectiveStatus && BADGE_CONFIGS[effectiveStatus as InForceWarningStatus['status']]) ||
    NEEDS_REVIEW_CONFIG;
  const Icon = config.icon;

  return (
    <span
      data-testid="warning-status-badge"
      data-status={effectiveStatus || 'needs_review'}
      title={config.tooltip}
      className={`inline-flex items-center gap-1 font-mono font-bold uppercase rounded border transition-all cursor-help select-none ${
        compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-[10px]'
      } ${config.containerClass} ${className}`}
    >
      <Icon className={compact ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 shrink-0'} />
      <span>{compact ? config.shortLabel : config.label}</span>
    </span>
  );
};

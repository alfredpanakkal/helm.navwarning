// src/components/InForceCoverageBanner.tsx
// Phase 6: Top banner displaying computed NAVAREA in-force coverage, metrics, and actions

import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Eye,
  MapPin,
  CheckCircle2,
  FileText,
  Clock,
  Layers,
} from 'lucide-react';
import type { InForceStatusResult } from '../hooks/useInForceStatus';
import { FEATURE_FLAGS } from '../lib/featureFlags';

export interface InForceCoverageBannerProps {
  status: InForceStatusResult | null;
  navarea: string;
  onViewMissing?: () => void;
  onTriggerRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
  className?: string;
}

export const InForceCoverageBanner: React.FC<InForceCoverageBannerProps> = ({
  status,
  navarea,
  onViewMissing,
  onTriggerRefresh,
  isRefreshing = false,
  className = '',
}) => {
  // Feature flag gating
  if (!FEATURE_FLAGS.inForceUIDisplay) {
    return null;
  }

  const cleanNavarea = (navarea || '').trim().toUpperCase();
  if (!cleanNavarea || cleanNavarea === 'ALL' || !status) {
    return null;
  }

  const { summary, snapshot, isLoading, error } = status;
  const pct = summary.coveragePercentage ?? 100;

  // Determine coverage tier color
  const isGood = pct >= 80;
  const isWarning = pct >= 50 && pct < 80;
  const isCritical = pct < 50;

  const barColor = isGood
    ? 'bg-emerald-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-red-500';

  const badgeBg = isGood
    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
    : isWarning
    ? 'bg-amber-50 text-amber-800 border-amber-300'
    : 'bg-red-50 text-red-800 border-red-300';

  const HeaderIcon = isGood ? ShieldCheck : isWarning ? AlertTriangle : AlertCircle;

  return (
    <div
      data-testid="in-force-coverage-banner"
      className={`border border-[var(--hairline,#eef1f4)] rounded-[8px] p-4 bg-transparent transition-colors ${className}`}
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--hairline,#eef1f4)]">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-7 h-7 rounded-[6px] border border-[var(--border-input,#dde2e8)] flex items-center justify-center shrink-0 text-[var(--accent,#2b6e8c)]">
            <HeaderIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-medium text-xs sm:text-sm tracking-wider uppercase text-[var(--ink-primary,#0b0e11)]">
                {`IN-FORCE STATUS: NAVAREA ${cleanNavarea}`}
              </span>
              {snapshot?.isAuthoritative && (
                <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium uppercase border border-[var(--border-input,#dde2e8)] text-[var(--ink-secondary,#5f6b7a)] font-mono">
                  Authoritative
                </span>
              )}
              {snapshot?.isPartial && (
                <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium uppercase border border-[var(--border-input,#dde2e8)] text-[var(--sev-high,#c07a2b)] font-mono">
                  Partial List
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--ink-secondary,#5f6b7a)] mt-0.5 font-mono">
              {snapshot?.snapshotWarningId
                ? `Based on Bulletin ${snapshot.snapshotWarningId} (${snapshot.issueDate || 'Recent'})`
                : 'Derived from live operational broadcast manifest'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {summary.missingCount > 0 && onViewMissing && (
            <button
              type="button"
              data-testid="view-missing-btn"
              onClick={onViewMissing}
              className="flex items-center gap-1.5 px-3 py-1 border border-[var(--sev-critical,#c44536)] text-[var(--sev-critical,#c44536)] hover:bg-[var(--surface-subtle,#fafbfc)] rounded-[6px] text-xs font-medium transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{`Missing (${summary.missingCount})`}</span>
            </button>
          )}

          {onTriggerRefresh && (
            <button
              type="button"
              data-testid="refresh-coverage-btn"
              onClick={() => onTriggerRefresh()}
              disabled={isRefreshing || isLoading}
              className="flex items-center gap-1.5 px-3 py-1 border border-[var(--border-input,#dde2e8)] text-[var(--ink-secondary,#5f6b7a)] hover:text-[var(--ink-primary,#0b0e11)] hover:border-[var(--accent,#2b6e8c)] rounded-[6px] text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
              title="Refresh in-force notices from coordinator source"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="my-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-[var(--ink-secondary,#5f6b7a)] flex items-center gap-1.5">
            Coverage rate
            {isLoading && <span className="text-[var(--ink-tertiary,#8b97a5)] font-normal text-[11px]">(recomputing...)</span>}
          </span>
          <span className={`text-sm font-medium ${isGood ? 'text-[var(--ink-primary,#0b0e11)]' : isWarning ? 'text-[var(--sev-high,#c07a2b)]' : 'text-[var(--sev-critical,#c44536)]'}`}>
            {pct}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-[var(--surface-subtle,#fafbfc)] rounded-full overflow-hidden border border-[var(--hairline,#eef1f4)]">
          <div
            className="h-full transition-all duration-300 rounded-full bg-[var(--accent,#2b6e8c)]"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2 text-left">
        <div>
          <span className="text-[0.7rem] uppercase tracking-[0.06em] font-medium text-[var(--ink-tertiary,#8b97a5)] block">Listed</span>
          <span className="text-lg font-medium text-[var(--ink-primary,#0b0e11)] tabular-nums">
            {summary.listedCount}
          </span>
        </div>

        <div>
          <span className="text-[0.7rem] uppercase tracking-[0.06em] font-medium text-[var(--ink-tertiary,#8b97a5)] block">Held in DB</span>
          <span className="text-lg font-medium text-[var(--ink-primary,#0b0e11)] tabular-nums">
            {summary.heldCount}
          </span>
        </div>

        <div>
          <span className="text-[0.7rem] uppercase tracking-[0.06em] font-medium text-[var(--ink-tertiary,#8b97a5)] block">
            With coords
          </span>
          <span className="text-lg font-medium text-[var(--ink-primary,#0b0e11)] tabular-nums">
            {summary.withGeometryCount}
          </span>
        </div>

        <div>
          <span className="text-[0.7rem] uppercase tracking-[0.06em] font-medium text-[var(--ink-tertiary,#8b97a5)] block">
            Verified
          </span>
          <span className="text-lg font-medium text-[var(--ink-primary,#0b0e11)] tabular-nums">
            {summary.verifiedCount}
          </span>
        </div>

        <div>
          <span className="text-[0.7rem] uppercase tracking-[0.06em] font-medium text-[var(--ink-tertiary,#8b97a5)] block">
            Missing
          </span>
          <span className={`text-lg font-medium tabular-nums ${summary.missingCount > 0 ? 'text-[var(--sev-critical,#c44536)]' : 'text-[var(--ink-primary,#0b0e11)]'}`}>
            {summary.missingCount}
          </span>
        </div>

        <div>
          <span className="text-[0.7rem] uppercase tracking-[0.06em] font-medium text-[var(--ink-tertiary,#8b97a5)] block" title="Active DB warnings not in in-force list">
            Extra active
          </span>
          <span className="text-lg font-medium text-[var(--ink-secondary,#5f6b7a)] tabular-nums">
            {summary.extraCount}
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-2.5 px-3 py-1.5 border border-[var(--border-input,#dde2e8)] text-[var(--sev-high,#c07a2b)] text-[11px] rounded-[6px]">
          Notice: {error}
        </div>
      )}
    </div>
  );
};

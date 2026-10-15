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
      className={`bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm transition-all ${className}`}
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gw-secondary/60">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${badgeBg}`}>
            <HeaderIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-black text-xs sm:text-sm tracking-wider uppercase text-gw-primary">
                {`IN-FORCE STATUS: NAVAREA ${cleanNavarea}`}
              </span>
              {snapshot?.isAuthoritative && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gw-primary text-white font-mono">
                  Authoritative
                </span>
              )}
              {snapshot?.isPartial && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300 font-mono">
                  Partial List
                </span>
              )}
            </div>
            <p className="text-[11px] text-gw-accent mt-0.5 font-mono">
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gw-primary text-gw-primary hover:bg-gw-bg rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary"
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
        <div className="flex items-center justify-between text-xs font-bold font-mono">
          <span className="text-gw-primary flex items-center gap-1.5">
            Coverage Rate
            {isLoading && <span className="text-gw-accent font-normal text-[11px]">(recomputing...)</span>}
          </span>
          <span className={`text-sm ${isGood ? 'text-emerald-700' : isWarning ? 'text-amber-700' : 'text-red-700'}`}>
            {pct}%
          </span>
        </div>
        <div className="w-full h-2.5 bg-gw-bg rounded-full overflow-hidden border border-gw-secondary">
          <div
            className={`h-full transition-all duration-500 rounded-full ${barColor}`}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-2.5 pt-1 text-center">
        <div className="p-2 rounded-lg bg-gw-bg/60 border border-gw-secondary/60">
          <span className="text-[10px] font-bold text-gw-accent uppercase block">Listed</span>
          <span className="text-sm sm:text-base font-black text-gw-primary font-mono tabular-nums">
            {summary.listedCount}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-gw-bg/60 border border-gw-secondary/60">
          <span className="text-[10px] font-bold text-gw-accent uppercase block">Held in DB</span>
          <span className="text-sm sm:text-base font-black text-gw-primary font-mono tabular-nums">
            {summary.heldCount}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-gw-bg/60 border border-gw-secondary/60">
          <span className="text-[10px] font-bold text-gw-accent uppercase flex items-center justify-center gap-1">
            <MapPin className="w-2.5 h-2.5" />
            <span>With Coords</span>
          </span>
          <span className="text-sm sm:text-base font-black text-emerald-700 font-mono tabular-nums">
            {summary.withGeometryCount}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-gw-bg/60 border border-gw-secondary/60">
          <span className="text-[10px] font-bold text-gw-accent uppercase flex items-center justify-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Verified</span>
          </span>
          <span className="text-sm sm:text-base font-black text-gw-primary font-mono tabular-nums">
            {summary.verifiedCount}
          </span>
        </div>

        <div className={`p-2 rounded-lg border ${summary.missingCount > 0 ? 'bg-red-50/70 border-red-200' : 'bg-gw-bg/60 border-gw-secondary/60'}`}>
          <span className={`text-[10px] font-bold uppercase block ${summary.missingCount > 0 ? 'text-red-700' : 'text-gw-accent'}`}>
            Missing
          </span>
          <span className={`text-sm sm:text-base font-black font-mono tabular-nums ${summary.missingCount > 0 ? 'text-red-700' : 'text-gw-primary'}`}>
            {summary.missingCount}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-gw-bg/60 border border-gw-secondary/60">
          <span className="text-[10px] font-bold text-gw-accent uppercase block" title="Active DB warnings not in in-force list">
            Extra Active
          </span>
          <span className="text-sm sm:text-base font-black text-gw-accent font-mono tabular-nums">
            {summary.extraCount}
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-2.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-lg">
          Notice: {error}
        </div>
      )}
    </div>
  );
};

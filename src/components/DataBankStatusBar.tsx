import React from 'react';
import { RotateCw, Activity, Globe, AlertTriangle, MapPin, Loader2 } from 'lucide-react';
import { SourceRegistryItem } from '../types';
import { ALL_NAVAREAS, DataBankModel } from '../hooks/useDataBankModel';

const lastCheckedFormatter = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'short',
});

export const formatLastChecked = (timestamp: number | null): string => {
  if (!timestamp) return 'not yet';
  return lastCheckedFormatter.format(new Date(timestamp));
};

/**
 * Data Bank Top Section: 4-card executive metric strip (parity with index.html)
 * and compact operational status bar with live feed sync.
 */
export const DataBankStatusBar: React.FC<{
  model: DataBankModel;
  sources?: SourceRegistryItem[];
  onTriggerRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
  /** True while the initial fetch is in flight: suppress false zero counts. */
  isLoading?: boolean;
}> = ({ model, sources = [], onTriggerRefresh, isRefreshing = false, isLoading = false }) => {
  const enabledFeeds = sources.filter((s) => s.enabled).length;
  const activeNavAreasCount = Object.keys(model.navareaCounts).length;
  const coveragePercent = Math.round((activeNavAreasCount / ALL_NAVAREAS.length) * 100);
  // Truth over optimism: with zero warnings loaded there is no coverage
  // ratio to state — render "—" instead of a false 100%.
  const geoPercent = model.warnings.length > 0
    ? Math.round((model.coordsCount / model.warnings.length) * 100)
    : null;
  const loadingEmpty = isLoading && model.warnings.length === 0;

  return (
    <div className="flex flex-col gap-2">
      {/* 4 Executive Metric Blocks — Helm.Ports minimalist layout */}
      <div className="stat-grid">
        {/* Active In-Force */}
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">Active</div>
            <div className="stat-value-row">
              <span className="stat-value tabular-nums">{loadingEmpty ? '—' : model.activeCount}</span>
              <span className="stat-sub">in-force</span>
            </div>
          </div>
        </div>

        {/* Global Regional Coverage */}
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">Coverage</div>
            <div className="stat-value-row">
              <span className="stat-value tabular-nums">{loadingEmpty ? '—' : `${activeNavAreasCount}/${ALL_NAVAREAS.length}`}</span>
              <span className="stat-sub">{loadingEmpty ? 'syncing' : `${coveragePercent}% global`}</span>
            </div>
          </div>
        </div>

        {/* Critical & High Priority */}
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">Critical / High</div>
            <div className="stat-value-row">
              <span className="stat-value tabular-nums">{loadingEmpty ? '—' : model.criticalCount}</span>
              <span className="stat-sub">warnings</span>
            </div>
          </div>
        </div>

        {/* Georeferenced Coordinates */}
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">Georeferenced</div>
            <div className="stat-value-row">
              <span className="stat-value tabular-nums">{geoPercent === null ? '—' : `${geoPercent}%`}</span>
              <span className="stat-sub">coordinates</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Status Row */}
      <div
        data-databank-status-bar
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 py-2 bg-transparent border-b border-hairline text-xs font-sans"
      >
        {loadingEmpty ? (
          <span className="font-medium text-ink-secondary flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin text-accent" aria-hidden="true" />
            Loading live data from Supabase — counts publish when the first fetch completes
          </span>
        ) : (
          <>
            <span className="font-medium text-ink-primary tabular-nums">
              {model.warnings.length} warnings
            </span>
            <span className="text-hairline" aria-hidden="true">·</span>
            <span className="font-medium text-ink-primary tabular-nums">
              {model.activeCount} active
            </span>
            <span className="text-hairline" aria-hidden="true">·</span>
            <span className="font-medium text-ink-primary tabular-nums">{model.criticalCount} high</span>
            <span className="text-hairline" aria-hidden="true">·</span>
            <span className="font-medium text-ink-primary tabular-nums">
              {activeNavAreasCount}/{ALL_NAVAREAS.length} NAVAREAs
            </span>
            <span className="text-hairline" aria-hidden="true">·</span>
            <span className="text-ink-secondary tabular-nums">
              Last checked {formatLastChecked(model.lastCheckedAt)}
            </span>
          </>
        )}

        <span className="ml-auto flex flex-wrap items-center gap-2">
          <span className="badge-simple badge-active text-[11px] py-0.5">
            <span className="dot" aria-hidden="true"></span>
            Live
          </span>
          <span className="badge-simple badge-neutral text-[11px] py-0.5">
            {enabledFeeds > 0 ? 'Pipeline active' : 'Manual data mode'}
          </span>
          {onTriggerRefresh && (
            <button
              type="button"
              onClick={() => onTriggerRefresh()}
              disabled={isRefreshing}
              title="Refresh live feeds now"
              className="btn btn-sm btn-secondary text-xs flex items-center gap-1.5 ml-2"
            >
              <RotateCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync live feeds'}</span>
            </button>
          )}
        </span>
      </div>
    </div>
  );
};

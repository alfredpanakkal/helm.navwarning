import React from 'react';
import { RotateCw, Activity, Globe, AlertTriangle, MapPin } from 'lucide-react';
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
}> = ({ model, sources = [], onTriggerRefresh, isRefreshing = false }) => {
  const enabledFeeds = sources.filter((s) => s.enabled).length;
  const activeNavAreasCount = Object.keys(model.navareaCounts).length;
  const coveragePercent = Math.round((activeNavAreasCount / ALL_NAVAREAS.length) * 100);
  const geoPercent = model.warnings.length > 0
    ? Math.round((model.coordsCount / model.warnings.length) * 100)
    : 100;

  return (
    <div className="flex flex-col gap-2">
      {/* 4-Card Executive Metric Grid — Parity with public index.html */}
      <div className="stat-grid">
        {/* Active In-Force */}
        <div className="stat-card">
          <div className="stat-icon active" aria-hidden="true">
            <Activity className="w-4 h-4" />
          </div>
          <div className="stat-content">
            <div className="stat-label">Active</div>
            <div className="stat-value-row">
              <span className="stat-value tabular-nums">{model.activeCount}</span>
              <span className="stat-sub">In-force</span>
            </div>
          </div>
        </div>

        {/* Global Regional Coverage */}
        <div className="stat-card">
          <div className="stat-icon coverage" aria-hidden="true">
            <Globe className="w-4 h-4" />
          </div>
          <div className="stat-content">
            <div className="stat-label">Coverage</div>
            <div className="stat-value-row">
              <span className="stat-value tabular-nums">{activeNavAreasCount}/{ALL_NAVAREAS.length}</span>
              <span className="stat-sub">{coveragePercent}% global</span>
            </div>
          </div>
        </div>

        {/* Critical & High Priority */}
        <div className="stat-card">
          <div className="stat-icon high" aria-hidden="true">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="stat-content">
            <div className="stat-label">Critical / High</div>
            <div className="stat-value-row">
              <span className="stat-value tabular-nums">{model.criticalCount}</span>
              <span className="stat-sub">warnings</span>
            </div>
          </div>
        </div>

        {/* Georeferenced Coordinates */}
        <div className="stat-card">
          <div className="stat-icon geo" aria-hidden="true">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="stat-content">
            <div className="stat-label">Georeferenced</div>
            <div className="stat-value-row">
              <span className="stat-value tabular-nums">{geoPercent}%</span>
              <span className="stat-sub">GPS Coords</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Status Row */}
      <div
        data-databank-status-bar
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2 bg-slate-50/80 border-b border-slate-200 text-xs rounded-t-lg"
      >
        <span className="font-bold text-slate-800 tabular-nums">
          {model.warnings.length} Warnings
        </span>
        <span className="text-slate-400" aria-hidden="true">·</span>
        <span className="font-bold text-slate-800 tabular-nums">
          {model.activeCount} Active
        </span>
        <span className="text-slate-400" aria-hidden="true">·</span>
        <span className="font-bold text-slate-800 tabular-nums">{model.criticalCount} High</span>
        <span className="text-slate-400" aria-hidden="true">·</span>
        <span className="font-bold text-slate-800 tabular-nums">
          {activeNavAreasCount}/{ALL_NAVAREAS.length} NAVAREAs
        </span>
        <span className="text-slate-400" aria-hidden="true">·</span>
        <span className="text-slate-500 tabular-nums">
          Last checked {formatLastChecked(model.lastCheckedAt)}
        </span>

        <span className="ml-auto flex flex-wrap items-center gap-2">
          <span className="badge-simple badge-active text-[10px] py-0.5">
            <span className="dot" aria-hidden="true"></span>
            Live
          </span>
          <span className="badge-simple badge-neutral text-[10px] py-0.5">
            {enabledFeeds > 0 ? 'Pipeline Active' : 'Manual Data Mode'}
          </span>
          {onTriggerRefresh && (
            <button
              type="button"
              onClick={() => onTriggerRefresh()}
              disabled={isRefreshing}
              title="Refresh live feeds now"
              className="btn btn-sm btn-primary text-xs py-1 px-2.5 h-auto min-h-0 flex items-center gap-1.5"
            >
              <RotateCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Live Feeds'}</span>
            </button>
          )}
        </span>
      </div>
    </div>
  );
};

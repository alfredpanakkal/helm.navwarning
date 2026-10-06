import React from 'react';
import { RotateCw } from 'lucide-react';
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
 * Compact one-row status bar. The classic layout shows these same numbers as
 * four stat cards; on the v2 path they fold into this single row so the
 * warning list can sit immediately under the controls.
 */
export const DataBankStatusBar: React.FC<{
  model: DataBankModel;
  sources?: SourceRegistryItem[];
  onTriggerRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
}> = ({ model, sources = [], onTriggerRefresh, isRefreshing = false }) => {
  const enabledFeeds = sources.filter((s) => s.enabled).length;
  return (
    <div
      data-databank-status-bar
      className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-3 py-2 border-b border-subtle text-xs"
    >
      <span className="font-bold text-gw-primary tabular-nums">
        {model.warnings.length} Warnings
      </span>
      <span className="text-gw-accent" aria-hidden="true">
        ·
      </span>
      <span className="font-bold text-gw-primary tabular-nums">
        {model.activeCount} Active
      </span>
      <span className="text-gw-accent" aria-hidden="true">
        ·
      </span>
      <span className="font-bold text-gw-primary tabular-nums">{model.criticalCount} High</span>
      <span className="text-gw-accent" aria-hidden="true">
        ·
      </span>
      <span className="font-bold text-gw-primary tabular-nums">
        {Object.keys(model.navareaCounts).length}/{ALL_NAVAREAS.length} NAVAREAs
      </span>
      <span className="text-gw-accent" aria-hidden="true">
        ·
      </span>
      <span className="text-gw-accent tabular-nums">
        Last checked {formatLastChecked(model.lastCheckedAt)}
      </span>

      <span className="ml-auto flex flex-wrap items-center gap-1.5">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-300">
          Live
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-300">
          {enabledFeeds > 0 ? 'Pipeline Active' : 'Manual Data Mode'}
        </span>
        {onTriggerRefresh && (
          <button
            type="button"
            onClick={() => onTriggerRefresh()}
            disabled={isRefreshing}
            title="Refresh live feeds now"
            className="px-2 py-1 rounded bg-gw-primary text-white font-bold uppercase tracking-wider text-[10px] border border-gw-primary hover:bg-gw-tertiary transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Live Feeds'}</span>
          </button>
        )}
      </span>
    </div>
  );
};

import React from 'react';
import { Globe, RotateCw } from 'lucide-react';
import { SourceRegistryItem } from '../types';

/**
 * One upstream-feed row in the procedure modals' sources tab.
 *
 * Task-5 fix round 1 (Important 1): the row markup was duplicated verbatim in
 * `IngestionProcedureModal` and `IngestionProcedureModalV2` except for the
 * refresh button's `title` text — both modals now render this component and
 * pass their own `refreshTitle`, so the row markup can't drift.
 * Headings/copy above the list stay per-modal (intentional plain-language
 * divergence).
 */
export interface IngestionSourceRowProps {
  src: SourceRegistryItem;
  refreshTitle: string;
  onTriggerRefresh?: (sourceId?: string) => Promise<void>;
  isRefreshing?: boolean;
}

export const IngestionSourceRow: React.FC<IngestionSourceRowProps> = ({
  src,
  refreshTitle,
  onTriggerRefresh,
  isRefreshing,
}) => {
  return (
    <div className="p-3 bg-white border border-gw-secondary rounded-xl hover:border-gw-primary transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-gw-primary">{src.publisher_name}</span>
          <span className="px-1.5 py-0.2 bg-gw-bg text-[10px] font-bold text-gw-accent rounded border border-gw-secondary uppercase">
            NAVAREA {src.navareas.join(', ')}
          </span>
          <span className="px-1.5 py-0.2 bg-sky-50 text-[10px] font-bold text-sky-800 rounded border border-sky-200 uppercase">
            {src.format.toUpperCase()}
          </span>
        </div>
        <div className="text-[11px] text-gw-accent flex items-center gap-1">
          <Globe className="w-3 h-3 text-gw-accent shrink-0" />
          <span className="truncate max-w-md">{src.discovery_url}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
            src.health.status === 'ok'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {src.health.status}
        </span>
        {onTriggerRefresh && (
          <button
            onClick={() => onTriggerRefresh(src.source_id)}
            disabled={isRefreshing}
            className="p-1.5 bg-gw-bg text-gw-primary rounded border border-gw-secondary hover:border-gw-primary text-[10px] font-bold uppercase transition-all"
            title={refreshTitle}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

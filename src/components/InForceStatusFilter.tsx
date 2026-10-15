// src/components/InForceStatusFilter.tsx
// Phase 6: In-force status filter control allowing mariners to isolate mapped, text-only, or missing notices

import React from 'react';
import { Filter, X, MapPin, FileText, AlertTriangle, XCircle } from 'lucide-react';
import { FEATURE_FLAGS } from '../lib/featureFlags';

export type InForceFilterType = 'ALL' | 'held_with_geometry' | 'held_without_geometry' | 'held_text_only' | 'missing';

export interface InForceStatusFilterProps {
  value: InForceFilterType;
  onChange: (val: InForceFilterType) => void;
  counts?: {
    all?: number;
    withGeometry?: number;
    withoutGeometry?: number;
    textOnly?: number;
    missing?: number;
  };
  className?: string;
}

export const InForceStatusFilter: React.FC<InForceStatusFilterProps> = ({
  value,
  onChange,
  counts,
  className = '',
}) => {
  if (!FEATURE_FLAGS.inForceUIDisplay) {
    return null;
  }

  const options: { id: InForceFilterType; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'ALL', label: 'All In-Force', icon: Filter, count: counts?.all },
    { id: 'held_with_geometry', label: 'Mapped', icon: MapPin, count: counts?.withGeometry },
    { id: 'held_without_geometry', label: 'Verified', icon: FileText, count: counts?.withoutGeometry },
    { id: 'held_text_only', label: 'Text Only', icon: AlertTriangle, count: counts?.textOnly },
    { id: 'missing', label: 'Missing', icon: XCircle, count: counts?.missing },
  ];

  return (
    <div
      data-testid="in-force-status-filter"
      className={`flex items-center gap-1 overflow-x-auto no-scrollbar py-1 ${className}`}
    >
      <span className="text-[10px] font-bold text-gw-accent uppercase font-mono mr-1 shrink-0">
        Status:
      </span>
      {options.map(({ id, label, icon: Icon, count }) => {
        const isActive = value === id;
        return (
          <button
            key={id}
            type="button"
            data-testid={`in-force-filter-${id}`}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold font-mono transition-all shrink-0 cursor-pointer ${
              isActive
                ? 'bg-gw-primary text-white shadow-xs'
                : 'bg-gw-bg text-gw-primary hover:bg-gw-secondary/60 border border-gw-secondary'
            }`}
          >
            <Icon className="w-3 h-3 shrink-0" />
            <span>{label}</span>
            {typeof count === 'number' && (
              <span
                className={`ml-0.5 px-1 py-0.2 rounded text-[9px] tabular-nums ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gw-secondary text-gw-primary'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}

      {value !== 'ALL' && (
        <button
          type="button"
          onClick={() => onChange('ALL')}
          title="Clear in-force status filter"
          className="p-1 text-gw-accent hover:text-gw-primary transition-colors cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

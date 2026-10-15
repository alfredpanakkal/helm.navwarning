// src/components/MissingWarningsDrawer.tsx
// Phase 6: Slide-over drawer displaying listed warnings missing from the local database

import React, { useEffect, useMemo, useState } from 'react';
import { X, AlertCircle, RefreshCw, ShieldAlert, ExternalLink, Filter } from 'lucide-react';
import { FEATURE_FLAGS } from '../lib/featureFlags';

export interface MissingWarningsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  navarea: string;
  missingIds: string[];
  onFetchMissing?: (id?: string) => Promise<void> | void;
  isFetching?: boolean;
  isAdmin?: boolean;
}

export const MissingWarningsDrawer: React.FC<MissingWarningsDrawerProps> = ({
  isOpen,
  onClose,
  navarea,
  missingIds = [],
  onFetchMissing,
  isFetching = false,
  isAdmin,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Check admin mode dynamically from prop or local session token
  const userIsAdmin = useMemo(() => {
    if (typeof isAdmin === 'boolean') return isAdmin;
    if (typeof window !== 'undefined') {
      return Boolean(
        sessionStorage.getItem('helm_admin_token') || localStorage.getItem('helm_admin_token')
      );
    }
    return false;
  }, [isAdmin]);

  // Handle escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Group missing warnings by year/series
  const groupedMissing = useMemo(() => {
    const groups: Record<string, string[]> = {};
    const filtered = missingIds.filter((id) =>
      searchTerm ? id.toLowerCase().includes(searchTerm.toLowerCase()) : true
    );

    for (const id of filtered) {
      // Extract year (e.g. from 364/24 or NAVAREA IX 364/24)
      const yrMatch = id.match(/[/_-](\d{2,4})$/);
      const yrKey = yrMatch ? `Year 20${yrMatch[1].slice(-2)}` : 'Other';
      if (!groups[yrKey]) {
        groups[yrKey] = [];
      }
      groups[yrKey].push(id);
    }

    return groups;
  }, [missingIds, searchTerm]);

  if (!FEATURE_FLAGS.inForceUIDisplay || !isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="missing-drawer-title"
      data-testid="missing-warnings-drawer"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        data-testid="drawer-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 border-l border-gw-primary/20">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gw-secondary flex items-center justify-between bg-gw-bg/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 border border-red-300 text-red-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 id="missing-drawer-title" className="text-sm sm:text-base font-black text-gw-primary font-mono uppercase">
                {`Missing Notices: NAVAREA ${navarea}`}
              </h2>
              <p className="text-[11px] text-gw-accent font-mono">
                {`${missingIds.length} listed in-force ${missingIds.length === 1 ? 'warning' : 'warnings'} absent from DB`}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-drawer-btn"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded-lg text-gw-accent hover:text-gw-primary hover:bg-gw-secondary/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-3 border-b border-gw-secondary bg-white">
          <input
            type="text"
            data-testid="search-missing-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter missing warning IDs (e.g. 364/24)..."
            className="w-full px-3 py-1.5 text-xs bg-gw-bg border border-gw-secondary rounded-lg font-mono text-gw-primary focus:outline-none focus:border-gw-primary"
          />
        </div>

        {/* Missing Warnings List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {missingIds.length === 0 ? (
            <div className="text-center py-12 text-gw-accent text-xs">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-emerald-600 opacity-80" />
              <p className="font-bold text-gw-primary">Zero Missing Warnings</p>
              <p className="mt-1">{`All in-force warnings for NAVAREA ${navarea} are held locally.`}</p>
            </div>
          ) : Object.keys(groupedMissing).length === 0 ? (
            <div className="text-center py-8 text-gw-accent text-xs">
              {`No missing warnings match "${searchTerm}"`}
            </div>
          ) : (
            Object.entries(groupedMissing).map(([groupTitle, ids]) => (
              <div key={groupTitle} className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent font-mono px-1">
                  {`${groupTitle} (${ids.length})`}
                </div>
                <div className="space-y-1.5">
                  {ids.map((id) => (
                    <div
                      key={id}
                      data-testid={`missing-warning-item-${id}`}
                      className="p-2.5 rounded-lg border border-red-200 bg-red-50/50 flex items-center justify-between text-xs hover:bg-red-50 transition-colors"
                    >
                      <div className="font-mono font-bold text-red-900">{id}</div>
                      {userIsAdmin && onFetchMissing ? (
                        <button
                          type="button"
                          onClick={() => onFetchMissing(id)}
                          disabled={isFetching}
                          className="px-2 py-1 bg-white border border-red-300 hover:border-red-500 text-red-700 text-[10px] font-bold rounded uppercase transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Fetch
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-red-600 font-bold uppercase">
                          Not Ingested
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gw-secondary bg-gw-bg/40 flex flex-col gap-2">
          {userIsAdmin && onFetchMissing && missingIds.length > 0 ? (
            <button
              type="button"
              data-testid="fetch-all-missing-btn"
              onClick={() => onFetchMissing()}
              disabled={isFetching}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gw-primary hover:bg-gw-primary/90 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span>{isFetching ? 'Fetching Missing Notices...' : `Fetch All Missing (${missingIds.length})`}</span>
            </button>
          ) : (
            <div className="text-[11px] text-center text-gw-accent font-mono">
              {userIsAdmin
                ? 'All broadcasted notices for this NAVAREA are held.'
                : 'Read-only view. Sign in as Administrator to trigger targeted ingestions.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

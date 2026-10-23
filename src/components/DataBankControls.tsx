import React, { useState } from 'react';
import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { HazardCategory, HAZARD_CATEGORIES } from '../utils/warningAnalyzer';
import { ALL_NAVAREAS, CoordFilterType, DataBankModel } from '../hooks/useDataBankModel';

const SMART_SORT_OPTIONS: { id: string; label: string }[] = [
  { id: 'urgency', label: 'Urgency First' },
  { id: 'recency', label: 'Recency (Newest)' },
  { id: 'navarea', label: 'NAVAREA Sequence' },
  { id: 'quality', label: 'Data Quality' },
  { id: 'custom', label: 'Standard Table Columns' },
];

const selectClass = (active: boolean) =>
  `appearance-none rounded border px-2.5 pr-7 py-1.5 text-xs font-bold cursor-pointer outline-none transition-all min-h-[36px] max-w-full ${
    active
      ? 'bg-gw-primary text-white border-gw-primary'
      : 'bg-gw-bg border-gw-secondary text-gw-primary focus:border-gw-primary'
  }`;

const selectChevron = (active: boolean) => (
  <span
    aria-hidden="true"
    className={`absolute right-2 w-1.5 h-1.5 border-r-2 border-b-2 rotate-45 pointer-events-none ${
      active ? 'border-white' : 'border-gw-primary'
    }`}
  />
);

/**
 * v2 primary controls: search + NAVAREA + Status + compact Category + More
 * filters, with the sort strip, quick filters and active pills folded into the
 * same block. The warning list sits immediately after this component.
 */
export const DataBankControls: React.FC<{ model: DataBankModel }> = ({ model }) => {
  const {
    warnings,
    searchTerm,
    setSearchTerm,
    selectedNavArea,
    setSelectedNavArea,
    selectedStatus,
    setSelectedStatus,
    selectedCategory,
    setSelectedCategory,
    selectedSeverity,
    setSelectedSeverity,
    smartSortMode,
    setSmartSortMode,
    groupByMode,
    setGroupByMode,
    coordFilter,
    setCoordFilter,
    sortField,
    sortDirection,
    setSortDirection,
    setCurrentPage,
    navareaCounts,
    extraNavAreas,
    activeCount,
    coordsCount,
    unverifiedCount,
    archivedCount,
    sortedWarnings,
    hasActiveFilters,
    handleResetFilters
  } = model;

  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const applyNavArea = (value: string) => {
    setSelectedNavArea(value);
    setCurrentPage(1);
  };
  const applyStatus = (value: string) => {
    setSelectedStatus(value);
    setCurrentPage(1);
  };
  const applyCategory = (value: string) => {
    setSelectedCategory(value as HazardCategory | 'ALL');
    setCurrentPage(1);
  };

  return (
    <div className="p-3 flex flex-col gap-2">
      {/* Primary row: search + compact filters + More filters */}
      <div className="flex flex-col lg:flex-row gap-2">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-gw-bg border-subtle rounded px-3 py-2 focus-within:border-gw-primary">
          <Search className="w-4 h-4 text-gw-accent shrink-0" />
          <input
            type="text"
            placeholder="Search records by ID, text, area, coords..."
            className="bg-transparent border-none outline-none text-xs sm:text-sm w-full text-gw-primary placeholder:text-gw-accent"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="text-xs text-gw-accent hover:text-gw-primary font-bold p-0.5"
              title="Clear search text"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex items-center">
            <select
              id="databank-navarea-filter"
              aria-label="Filter by NAVAREA"
              value={selectedNavArea}
              onChange={(e) => applyNavArea(e.target.value)}
              className={selectClass(selectedNavArea !== 'ALL')}
            >
              <option value="ALL">All NAVAREAs ({warnings.length})</option>
              {ALL_NAVAREAS.map(({ id, name }) => {
                const count = navareaCounts[id] || 0;
                return (
                  <option key={id} value={id}>
                    {name} {count > 0 ? `(${count})` : ''}
                  </option>
                );
              })}
              {extraNavAreas.map((na) => (
                <option key={na} value={na}>
                  NAVAREA {na} ({navareaCounts[na]})
                </option>
              ))}
            </select>
            {selectChevron(selectedNavArea !== 'ALL')}
          </div>

          <div className="relative flex items-center">
            <select
              aria-label="Filter by status"
              value={selectedStatus}
              onChange={(e) => applyStatus(e.target.value)}
              className={selectClass(selectedStatus !== 'ALL')}
            >
              <option value="ALL">All Status ({warnings.length})</option>
              <option value="active">Active ({activeCount})</option>
              <option value="unverified">Unverified ({unverifiedCount})</option>
              <option value="cancelled">Cancelled</option>
              <option value="superseded">Superseded</option>
              <option value="expired">Expired</option>
              <option value="archived">Archived / Cancelled ({archivedCount})</option>
            </select>
            {selectChevron(selectedStatus !== 'ALL')}
          </div>

          <div className="relative flex items-center">
            <select
              aria-label="Filter by hazard category"
              value={selectedCategory}
              onChange={(e) => applyCategory(e.target.value)}
              className={selectClass(selectedCategory !== 'ALL')}
            >
              <option value="ALL">All Categories ({warnings.length})</option>
              {Object.entries(HAZARD_CATEGORIES).map(([catKey, meta]) => {
                const count = model.analytics.categoryDistribution[catKey as HazardCategory] || 0;
                return (
                  <option key={catKey} value={catKey}>
                    {meta.shortLabel} ({count})
                  </option>
                );
              })}
            </select>
            {selectChevron(selectedCategory !== 'ALL')}
          </div>

          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            aria-expanded={showMoreFilters}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider transition-all min-h-[36px] cursor-pointer ${
              showMoreFilters
                ? 'bg-gw-primary text-white border-gw-primary'
                : 'bg-gw-bg text-gw-primary border-gw-secondary hover:bg-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>More filters</span>
          </button>
        </div>
      </div>

      {/* Feedback strip (not controls): result count, active sort, reset */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[11px] font-bold text-gw-accent">
          Matching: <strong className="text-gw-primary tabular-nums">{sortedWarnings.length}</strong>
        </span>

        <span className="text-[11px] font-bold text-gw-accent hidden sm:inline">
          Sorted by <strong className="text-gw-primary capitalize">{sortField}</strong>
        </span>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gw-bg border-subtle rounded text-xs font-bold uppercase hover:bg-gw-primary hover:border-gw-primary hover:text-white transition-colors min-h-[32px] cursor-pointer"
            title="Reset all filters"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
          <span className="text-[10px] font-bold uppercase text-gw-accent mr-1">
            Active Filters:
          </span>

          {searchTerm.trim() && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gw-bg border border-gw-primary/30 rounded text-gw-primary hover:bg-gw-primary hover:text-white transition-colors font-bold cursor-pointer"
              title="Remove text search"
            >
              <span>Search: &quot;{searchTerm}&quot;</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {selectedNavArea !== 'ALL' && (
            <button
              type="button"
              onClick={() => applyNavArea('ALL')}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gw-bg border border-gw-primary/30 rounded text-gw-primary hover:bg-gw-primary hover:text-white transition-colors font-bold cursor-pointer"
              title="Clear NAVAREA filter"
            >
              <span>NAVAREA: {selectedNavArea}</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {selectedSeverity !== 'ALL' && (
            <button
              type="button"
              onClick={() => {
                setSelectedSeverity('ALL');
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gw-bg border border-gw-primary/30 rounded text-gw-primary hover:bg-gw-primary hover:text-white transition-colors font-bold cursor-pointer"
              title="Clear severity filter"
            >
              <span>Severity: {selectedSeverity}</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {selectedStatus !== 'ALL' && (
            <button
              type="button"
              onClick={() => applyStatus('ALL')}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gw-bg border border-gw-primary/30 rounded text-gw-primary hover:bg-gw-primary hover:text-white transition-colors font-bold cursor-pointer"
              title="Clear status filter"
            >
              <span>Status: {selectedStatus}</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {selectedCategory !== 'ALL' && (
            <button
              type="button"
              onClick={() => applyCategory('ALL')}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gw-bg border border-gw-primary/30 rounded text-gw-primary hover:bg-gw-primary hover:text-white transition-colors font-bold cursor-pointer"
              title="Clear category filter"
            >
              <span>Category: {HAZARD_CATEGORIES[selectedCategory]?.shortLabel ?? selectedCategory}</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {coordFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => {
                setCoordFilter('ALL' as CoordFilterType);
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gw-bg border border-gw-primary/30 rounded text-gw-primary hover:bg-gw-primary hover:text-white transition-colors font-bold cursor-pointer"
              title="Clear coordinates filter"
            >
              <span>{coordFilter === 'with_coords' ? 'Mapped Geometry' : 'Text Only'}</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* More filters: sort, quick filters, secondary selects, category chips */}
      {showMoreFilters && (
        <div className="pt-2 border-t border-subtle flex flex-col gap-3">
          {/* Sort controls (secondary): dropdown + direction */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                Sort:
              </span>
              <select
                id="databank-sort"
                aria-label="Sort warnings"
                value={smartSortMode}
                onChange={(e) => {
                  const next = e.target.value;
                  setSmartSortMode(next as typeof smartSortMode);
                  if (next !== 'custom') setSortDirection('desc');
                  setCurrentPage(1);
                }}
                className={selectClass(false)}
              >
                {SMART_SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {selectChevron(false)}
            </div>

            <button
              type="button"
              onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
              title="Toggle sort direction"
              className="flex items-center gap-1 px-2 py-1.5 rounded border border-gw-secondary bg-gw-bg text-gw-primary text-xs font-bold hover:bg-white cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3 text-gw-accent shrink-0" />
              <span className="uppercase">{sortDirection === 'asc' ? 'Asc' : 'Desc'}</span>
              <span aria-hidden="true">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            </button>
          </div>

          {/* Quick filter presets (secondary) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gw-accent mr-1">
              Quick:
            </span>

            <button
              type="button"
              onClick={handleResetFilters}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                !hasActiveFilters
                  ? 'bg-gw-primary text-white shadow-xs'
                  : 'bg-gw-bg border border-gw-secondary text-gw-primary hover:bg-gw-bg/80'
              }`}
            >
              All ({warnings.length})
            </button>

            <button
              type="button"
              onClick={() => applyStatus('active')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                selectedStatus === 'active'
                  ? 'bg-green-700 text-white shadow-xs'
                  : 'bg-green-50 border border-green-200 text-green-800 hover:bg-green-100'
              }`}
            >
              Active Only ({activeCount})
            </button>

            <button
              type="button"
              onClick={() => {
                setCoordFilter(coordFilter === 'with_coords' ? 'ALL' : 'with_coords');
                setCurrentPage(1);
              }}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                coordFilter === 'with_coords'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100'
              }`}
            >
              Mapped ({coordsCount})
            </button>

            {unverifiedCount > 0 && (
              <button
                type="button"
                onClick={() => applyStatus('unverified')}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  selectedStatus === 'unverified'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                }`}
              >
                Unverified ({unverifiedCount})
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex items-center">
              <select
                aria-label="Filter by severity"
                value={selectedSeverity}
                onChange={(e) => {
                  setSelectedSeverity(e.target.value);
                  setCurrentPage(1);
                }}
                className={selectClass(selectedSeverity !== 'ALL')}
              >
                <option value="ALL">All Severities</option>
                <option value="critical">Critical (Tier A, no flags)</option>
                <option value="high">High (Tier A)</option>
              </select>
              {selectChevron(selectedSeverity !== 'ALL')}
            </div>

            <div className="relative flex items-center">
              <select
                aria-label="Filter by coordinates"
                value={coordFilter}
                onChange={(e) => {
                  setCoordFilter(e.target.value as CoordFilterType);
                  setCurrentPage(1);
                }}
                className={selectClass(coordFilter !== 'ALL')}
              >
                <option value="ALL">All Coordinates</option>
                <option value="with_coords">Mapped Geometry — PostGIS ({coordsCount})</option>
                <option value="without_coords">Text Only — No Validated Geometry ({warnings.length - coordsCount})</option>
              </select>
              {selectChevron(coordFilter !== 'ALL')}
            </div>

            <div className="relative flex items-center">
              <select
                aria-label="Group warnings"
                value={groupByMode}
                onChange={(e) => setGroupByMode(e.target.value as typeof groupByMode)}
                className={selectClass(groupByMode !== 'none')}
              >
                <option value="none">Flat Table View</option>
                <option value="category">Group by Hazard Category</option>
                <option value="navarea">Group by NAVAREA</option>
                <option value="urgency">Group by Urgency Level</option>
                <option value="authority">Group by Authority</option>
              </select>
              {selectChevron(groupByMode !== 'none')}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gw-accent flex items-center justify-between">
              <span>
                Filter by Hazard Category ({Object.keys(HAZARD_CATEGORIES).length} Standard Classes)
              </span>
              {selectedCategory !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => applyCategory('ALL')}
                  className="text-xs text-gw-primary hover:underline font-bold cursor-pointer"
                >
                  Clear Category Filter
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-gw-primary text-white border-gw-primary shadow-xs'
                    : 'bg-gw-bg text-gw-primary border-gw-secondary hover:bg-white'
                }`}
              >
                All Categories ({warnings.length})
              </button>
              {Object.entries(HAZARD_CATEGORIES).map(([catKey, meta]) => {
                const count = model.analytics.categoryDistribution[catKey as HazardCategory] || 0;
                const isSelected = selectedCategory === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => applyCategory(catKey)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-gw-primary text-white border-gw-primary shadow-xs'
                        : count === 0
                          ? meta.badgeClass + ' opacity-50'
                          : meta.badgeClass + ' hover:opacity-90'
                    }`}
                    title={count === 0 ? `${meta.label} — no warnings in this class right now` : meta.label}
                  >
                    <span>{meta.shortLabel}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-white/70 text-gw-primary'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

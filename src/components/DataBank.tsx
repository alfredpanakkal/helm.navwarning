import React from 'react';
import {
  Database,
  AlertTriangle,
  Layers,
  MapPin,
  Filter,
  Search,
  SlidersHorizontal,
  X,
  Compass,
  Server,
  RotateCw,
  Sparkles
} from 'lucide-react';
import { HAZARD_CATEGORIES, HazardCategory } from '../utils/warningAnalyzer';
import { IngestionProcedureModal } from './IngestionProcedureModal';
import { DataBankWarningList } from './DataBankWarningList';
import { InForceCoverageBanner } from './InForceCoverageBanner';
import { MissingWarningsDrawer } from './MissingWarningsDrawer';
import { useDataBankModel, ALL_NAVAREAS, CoordFilterType, type DataBankProps } from '../hooks/useDataBankModel';

export { ALL_NAVAREAS };
export type { DataBankProps };

/**
 * Classic ("hwUI=classic") Data Bank layout. The markup below is the original
 * information hierarchy and stays untouched; only the data model and the warning
 * list are shared with the v2 layout (see useDataBankModel / DataBankWarningList).
 */
export const DataBank: React.FC<DataBankProps> = ({
  warnings,
  archivedWarnings,
  onLocate,
  onVerifyWarning,
  initialStatusFilter = 'ALL',
  initialNavAreaFilter = 'ALL',
  onTriggerRefresh,
  isRefreshing = false,
  onCommitWarnings,
  sources = [],
  isOfflineMode = false,
  onOpenConsole,
  onNavigate
}) => {
  const [showMissingDrawer, setShowMissingDrawer] = React.useState(false);
  const model = useDataBankModel({ warnings, archivedWarnings, initialStatusFilter, initialNavAreaFilter });
  const {
    searchTerm,
    setSearchTerm,
    selectedNavArea,
    setSelectedNavArea,
    selectedSeverity,
    setSelectedSeverity,
    selectedStatus,
    setSelectedStatus,
    selectedCategory,
    setSelectedCategory,
    smartSortMode,
    setSmartSortMode,
    groupByMode,
    setGroupByMode,
    coordFilter,
    setCoordFilter,
    isProcedureModalOpen,
    setIsProcedureModalOpen,
    sortField,
    sortDirection,
    setSortDirection,
    setCurrentPage,
    pageSize,
    analytics,
    navareaCounts,
    extraNavAreas,
    activeCount,
    coordsCount,
    criticalCount,
    unverifiedCount,
    recent24hCount,
    sortedWarnings,
    hasActiveFilters,
    handleResetFilters
  } = model;

  return (
    <div className="flex flex-col gap-6 sm:gap-8 font-ui">
      {/* Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
        <div className="bg-secondary border-2 border-gw-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all shadow-hard shadow-hard-hover">
          <div className="text-xs font-bold uppercase tracking-wider text-gw-accent mb-2 sm:mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 border-primary rounded-sm flex items-center justify-center shrink-0">
                <Database className="w-3.5 h-3.5 text-gw-primary" />
              </div>
              Total Published
            </div>
            <button
              onClick={() => setIsProcedureModalOpen(true)}
              className="text-[10px] uppercase font-bold text-gw-primary hover:bg-gw-bg px-2 py-0.5 rounded border-subtle transition-all flex items-center gap-1 cursor-pointer"
              title="View Ingestion Procedure (SOP)"
            >
              <span>Procedure</span>
              <span>↗</span>
            </button>
          </div>
          <div className="text-3xl sm:text-4xl md:text-[2.75rem] font-black tracking-tight leading-none mb-2 sm:mb-3 text-gw-primary tabular-nums font-mono flex items-baseline gap-1.5">
            <span>{warnings.length.toLocaleString()}</span>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded ml-1">
              Live
            </span>
          </div>
          <div className="text-[11px] sm:text-xs text-gw-accent flex gap-1">
            {recent24hCount > 0 ? (
              <>
                <span className="text-emerald-700 font-bold">↑ {recent24hCount}</span> updated in last 24h
              </>
            ) : (
              <>
                <span className="text-gw-primary font-bold">{warnings.length}</span> live records loaded
              </>
            )}
          </div>
        </div>
        
        <div className="bg-secondary border-2 border-gw-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all shadow-hard shadow-hard-hover">
          <div className="text-xs font-bold uppercase tracking-wider text-gw-accent mb-2 sm:mb-4 flex items-center gap-2">
            <div className="w-6 h-6 border-primary rounded-sm flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-gw-primary" />
            </div>
            Active Warnings
          </div>
          <div className="text-3xl sm:text-4xl md:text-[2.75rem] font-black tracking-tight leading-none mb-2 sm:mb-3 text-gw-primary tabular-nums font-mono flex items-baseline gap-1.5">
            <span>{activeCount.toLocaleString()}</span>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gw-primary bg-gw-bg border-subtle px-1.5 py-0.5 rounded-sm ml-1">
              In-Force
            </span>
          </div>
          <div className="text-[11px] sm:text-xs text-gw-accent flex gap-1">
            <span className="text-emerald-700 font-bold">
              {warnings.length > 0 ? Math.round((activeCount / warnings.length) * 100) : 0}%
            </span>{' '}
            of data bank in force
          </div>
        </div>
        
        <div className="bg-secondary border-2 border-gw-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all shadow-hard shadow-hard-hover">
          <div className="text-xs font-bold uppercase tracking-wider text-gw-accent mb-2 sm:mb-4 flex items-center gap-2">
            <div className="w-6 h-6 border-primary rounded-sm flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5 text-gw-primary" />
            </div>
            Critical / High
          </div>
          <div className="text-3xl sm:text-4xl md:text-[2.75rem] font-black tracking-tight leading-none mb-2 sm:mb-3 text-gw-primary tabular-nums font-mono flex items-baseline gap-1.5">
            <span>{criticalCount.toLocaleString()}</span>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded ml-1">
              High Conf
            </span>
          </div>
          <div className="text-[11px] sm:text-xs text-gw-accent flex gap-1">
            <span className="text-amber-800 font-bold">
              {warnings.length > 0 ? Math.round((criticalCount / warnings.length) * 100) : 0}%
            </span>{' '}
            high priority / verified
          </div>
        </div>
        
        <div className="bg-secondary border-2 border-gw-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all shadow-hard shadow-hard-hover">
          <div className="text-xs font-bold uppercase tracking-wider text-gw-accent mb-2 sm:mb-4 flex items-center gap-2">
            <div className="w-6 h-6 border-primary rounded-sm flex items-center justify-center shrink-0">
              <MapPin className="w-3.5 h-3.5 text-gw-primary" />
            </div>
            NAVAREAs
          </div>
          <div className="text-3xl sm:text-4xl md:text-[2.75rem] font-black tracking-tight leading-none mb-2 sm:mb-3 text-gw-primary tabular-nums font-mono flex items-baseline gap-1">
            <span>{Object.keys(navareaCounts).length}</span>
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-gw-accent/70">/{ALL_NAVAREAS.length}</span>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-sky-800 bg-sky-100 border border-sky-300 px-1.5 py-0.5 rounded ml-1">
              Coverage
            </span>
          </div>
          <div className="text-[11px] sm:text-xs text-gw-accent">
            <span className="text-gw-primary font-bold">
              {Math.round((Object.keys(navareaCounts).length / ALL_NAVAREAS.length) * 100)}%
            </span>{' '}
            active world maritime coverage
          </div>
        </div>
      </div>

      {/* Dynamic Data Ingestion Procedure Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-3.5 bg-gw-bg border-2 border-gw-primary rounded-xl shadow-xs text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-[10px] uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            Dynamic Ingestion Pipeline Active
          </div>
          <span className="text-gw-accent hidden md:inline">•</span>
          <span className="text-gw-primary font-semibold hidden md:inline">
            Zero Hardcoded Data: Live WWNWS Hydrographic Feeds
          </span>
          <span className="text-gw-accent text-[11px]">
            ({sources.length > 0 ? `${sources.filter(s => s.enabled).length} Feeds Configured` : 'Deterministic Spatial Parser'})
          </span>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
          <button
            onClick={() => setIsProcedureModalOpen(true)}
            className="flex-1 sm:flex-none px-3 py-1.5 bg-secondary text-gw-primary font-bold uppercase tracking-wider text-[11px] rounded-lg border-primary hover:bg-gw-bg transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Server className="w-3.5 h-3.5 text-gw-primary" />
            <span>How Data is Taken (Procedure SOP)</span>
          </button>
          {onTriggerRefresh && (
            <button
              onClick={() => onTriggerRefresh()}
              disabled={isRefreshing}
              className="px-3 py-1.5 bg-gw-primary text-white font-bold uppercase tracking-wider text-[11px] rounded-lg border-primary hover:bg-gw-tertiary transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
              title="Trigger live pipeline fetch from hydrographic endpoints"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Live Feeds'}</span>
            </button>
          )}
        </div>
      </div>

      {/* In-Force Coverage Banner when NAVAREA is selected */}
      {selectedNavArea !== 'ALL' && model.inForceStatus && (
        <InForceCoverageBanner
          status={model.inForceStatus}
          navarea={selectedNavArea}
          onViewMissing={() => setShowMissingDrawer(true)}
          onTriggerRefresh={onTriggerRefresh ? () => onTriggerRefresh() : undefined}
          isRefreshing={isRefreshing}
        />
      )}

      {/* Executive Operational Brief Card & Category Filter Pills */}
      <div className="bg-secondary border-2 border-gw-primary rounded-xl p-4 sm:p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gw-secondary/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gw-primary text-white flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gw-primary flex items-center gap-2">
                <span>Executive Operational Brief</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-sm bg-gw-bg border-subtle text-gw-accent">
                  {analytics.geoReferencedPct}% GPS Georeferenced
                </span>
              </h2>
              <p className="text-xs text-gw-accent mt-0.5">{analytics.operationalBrief}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-gw-primary">Group By:</span>
            <select
              value={groupByMode}
              onChange={(e) => setGroupByMode(e.target.value as any)}
              className="bg-gw-bg border-subtle rounded-sm px-2.5 py-1 text-xs font-bold text-gw-primary outline-none focus:border-gw-primary cursor-pointer"
            >
              <option value="none">Flat Table View</option>
              <option value="category">Group by Hazard Category</option>
              <option value="navarea">Group by NAVAREA</option>
              <option value="urgency">Group by Urgency Level</option>
              <option value="authority">Group by Authority</option>
            </select>
          </div>
        </div>

        {analytics.actionableAlerts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {analytics.actionableAlerts.map((alertText, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-gw-bg border border-gw-secondary text-xs text-gw-primary">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-tight font-medium">{alertText}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gw-accent flex items-center justify-between">
            <span>Filter by Hazard Category ({Object.keys(HAZARD_CATEGORIES).length} Standard Classes)</span>
            {selectedCategory !== 'ALL' && (
              <button
                onClick={() => setSelectedCategory('ALL')}
                className="text-xs text-gw-primary hover:underline font-bold"
              >
                Clear Category Filter ✕
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-gw-primary text-white border-gw-primary shadow-xs'
                  : 'bg-gw-bg text-gw-primary border-gw-secondary hover:bg-white'
              }`}
            >
              All Categories ({warnings.length})
            </button>
            {Object.entries(HAZARD_CATEGORIES).map(([catKey, meta]) => {
              const count = analytics.categoryDistribution[catKey as HazardCategory] || 0;
              const isSelected = selectedCategory === catKey;
              return (
                <button
                  key={catKey}
                  onClick={() => setSelectedCategory(catKey as HazardCategory)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-gw-primary text-white border-gw-primary shadow-xs'
                      : meta.badgeClass + ' hover:opacity-90'
                  }`}
                >
                  <span>{meta.shortLabel}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-white/70 text-gw-primary'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter & Shifting Control Center */}
      <div className="flex flex-col gap-3 p-3.5 sm:p-4 bg-secondary border-2 border-gw-primary rounded-xl shadow-xs">
        {/* Top Controls Row: Search & Dropdowns */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 space-compact bg-gw-bg border-subtle rounded px-3 py-2 focus-within:border-gw-primary">
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
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }} 
                className="text-xs text-gw-accent hover:text-gw-primary font-bold p-0.5"
                title="Clear search text"
              >
                ✕
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            {/* NAVAREA Select */}
            <div className="relative flex items-center">
              <select 
                id="databank-navarea-filter"
                value={selectedNavArea}
                onChange={(e) => {
                  setSelectedNavArea(e.target.value);
                  setCurrentPage(1);
                }}
                className={`w-full appearance-none rounded-lg pl-3 pr-8 py-2 text-xs font-bold cursor-pointer outline-none transition-all duration-150 min-h-[38px] border-2 ${
                  selectedNavArea !== 'ALL'
                    ? 'bg-gw-primary text-white border-gw-primary shadow-xs ring-2 ring-gw-primary/20'
                    : 'bg-white border-gw-primary/60 text-gw-primary hover:border-gw-primary hover:bg-gw-bg/60 focus:border-gw-primary focus:ring-2 focus:ring-gw-primary/20 shadow-xs'
                }`}
              >
                <option value="ALL">All NAVAREAs ({warnings.length})</option>
                {ALL_NAVAREAS.map(({ id, name }) => {
                  const count = navareaCounts[id] || 0;
                  return (
                    <option key={id} value={id} className="text-gw-primary bg-white">
                      {name} {count > 0 ? `(${count})` : ''}
                    </option>
                  );
                })}
                {extraNavAreas.map((na) => (
                  <option key={na} value={na} className="text-gw-primary bg-white">
                    NAVAREA {na} ({navareaCounts[na]})
                  </option>
                ))}
              </select>
              <div
                className={`absolute right-2.5 w-1.5 h-1.5 border-r-2 border-b-2 rotate-45 pointer-events-none transition-colors ${
                  selectedNavArea !== 'ALL' ? 'border-white' : 'border-gw-primary'
                }`}
              ></div>
            </div>
            
            {/* Severity Select */}
            <div className="relative flex items-center">
              <select 
                value={selectedSeverity}
                onChange={(e) => {
                  setSelectedSeverity(e.target.value);
                  setCurrentPage(1);
                }}
                className={`w-full appearance-none rounded-lg pl-2.5 pr-7 py-2 text-xs font-bold cursor-pointer outline-none transition-all min-h-[38px] border ${
                  selectedSeverity !== 'ALL'
                    ? 'bg-gw-primary text-white border-gw-primary'
                    : 'bg-gw-bg border-gw-secondary text-gw-primary focus:border-gw-primary'
                }`}
              >
                <option value="ALL">All Severities</option>
                <option value="critical">Critical (Tier A, no flags)</option>
                <option value="high">High (Tier A)</option>
              </select>
              <div className={`absolute right-2.5 w-1.5 h-1.5 border-r-2 border-b-2 rotate-45 pointer-events-none ${
                selectedSeverity !== 'ALL' ? 'border-white' : 'border-gw-primary'
              }`}></div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            {/* Status Select */}
            <div className="relative flex-1 sm:flex-none items-center">
              <select 
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className={`w-full appearance-none rounded-lg pl-2.5 pr-7 py-2 text-xs font-bold cursor-pointer outline-none transition-all min-h-[38px] border ${
                  selectedStatus !== 'ALL'
                    ? 'bg-gw-primary text-white border-gw-primary'
                    : 'bg-gw-bg border-gw-secondary text-gw-primary focus:border-gw-primary'
                }`}
              >
                <option value="ALL">All Status ({warnings.length})</option>
                <option value="active">Active ({activeCount})</option>
                <option value="unverified">Unverified ({unverifiedCount})</option>
                <option value="cancelled">Cancelled</option>
                <option value="superseded">Superseded</option>
                <option value="expired">Expired</option>
                <option value="archived">Archived / Cancelled ({model.archivedCount})</option>
              </select>
              <div className={`absolute right-2.5 w-1.5 h-1.5 border-r-2 border-b-2 rotate-45 pointer-events-none ${
                selectedStatus !== 'ALL' ? 'border-white' : 'border-gw-primary'
              }`}></div>
            </div>

            {/* Spatial / Coordinates Filter */}
            <div className="relative flex-1 sm:flex-none items-center">
              <select 
                value={coordFilter}
                onChange={(e) => {
                  setCoordFilter(e.target.value as CoordFilterType);
                  setCurrentPage(1);
                }}
                className={`w-full appearance-none rounded-lg pl-2.5 pr-7 py-2 text-xs font-bold cursor-pointer outline-none transition-all min-h-[38px] border ${
                  coordFilter !== 'ALL'
                    ? 'bg-gw-primary text-white border-gw-primary'
                    : 'bg-gw-bg border-gw-secondary text-gw-primary focus:border-gw-primary'
                }`}
              >
                <option value="ALL">All Coordinates</option>
                <option value="with_coords">With Coordinates ({coordsCount})</option>
                <option value="without_coords">Text Only ({warnings.length - coordsCount})</option>
              </select>
              <div className={`absolute right-2.5 w-1.5 h-1.5 border-r-2 border-b-2 rotate-45 pointer-events-none ${
                coordFilter !== 'ALL' ? 'border-white' : 'border-gw-primary'
              }`}></div>
            </div>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gw-bg border-subtle rounded-lg text-xs font-bold uppercase hover:bg-gw-primary hover:border-gw-primary hover:text-white transition-colors min-h-[38px]"
            title="Reset all filters"
          >
                <Filter className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Second Row: Quick Filter Presets & Active Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gw-secondary/40 text-xs">
          {/* Quick Filter Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gw-accent mr-1">Quick:</span>
            
            <button
              type="button"
              onClick={() => {
                handleResetFilters();
              }}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                !hasActiveFilters
                  ? 'bg-gw-primary text-white shadow-xs'
                  : 'bg-gw-bg border border-gw-secondary text-gw-primary hover:bg-gw-bg/80'
              }`}
            >
              All ({warnings.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedStatus('active');
                setCurrentPage(1);
              }}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
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
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                coordFilter === 'with_coords'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100'
              }`}
            >
              With Coords ({coordsCount})
            </button>

            {unverifiedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedStatus('unverified');
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                  selectedStatus === 'unverified'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                }`}
              >
                Unverified ({unverifiedCount})
              </button>
            )}
          </div>

          {/* Active Sort & Record Count Shifter Summary */}
          <div className="flex items-center gap-2 text-[11px] font-bold text-gw-accent">
            <span className="flex items-center gap-1 bg-gw-bg px-2 py-1 rounded border border-gw-secondary text-gw-primary">
              <SlidersHorizontal className="w-3 h-3 text-gw-accent shrink-0" />
              <span>Sorted by <strong className="capitalize">{sortField}</strong></span>
              <button
                type="button"
                onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                className="text-gw-primary hover:text-gw-accent ml-0.5 underline inline-flex items-center gap-0.5"
                title="Toggle sort direction"
              >
                ({sortDirection.toUpperCase()} {sortDirection === 'asc' ? '↑' : '↓'})
              </button>
            </span>

            <span className="text-gw-accent">
              Matching: <strong className="text-gw-primary">{sortedWarnings.length}</strong>
            </span>
          </div>
        </div>

        {/* Active Filter Dismissible Pills */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
            <span className="text-[10px] font-bold uppercase text-gw-accent mr-1">Active Filters:</span>
            
            {searchTerm.trim() && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gw-bg border border-gw-primary/30 rounded text-gw-primary hover:bg-gw-primary hover:text-white transition-colors font-bold"
                title="Remove text search"
              >
                <span>Search: "{searchTerm}"</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {selectedNavArea !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedNavArea('ALL');
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gw-bg border border-gw-primary/30 rounded text-gw-primary hover:bg-gw-primary hover:text-white transition-colors font-bold"
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
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gw-bg border border-gw-primary/30 rounded text-gw-primary hover:bg-gw-primary hover:text-white transition-colors font-bold"
                title="Clear severity filter"
              >
                <span>Severity: {selectedSeverity}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {selectedStatus !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedStatus('ALL');
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gw-bg border border-gw-primary/30 rounded text-gw-primary hover:bg-gw-primary hover:text-white transition-colors font-bold"
                title="Clear status filter"
              >
                <span>Status: {selectedStatus}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {coordFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setCoordFilter('ALL');
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gw-bg border border-gw-primary/30 rounded text-gw-primary hover:bg-gw-primary hover:text-white transition-colors font-bold"
                title="Clear coordinates filter"
              >
                <span>Coords: {coordFilter === 'with_coords' ? 'With Coordinates' : 'Text Only'}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] text-gw-accent hover:text-gw-primary underline font-bold ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Smart Sort Presets Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white border-2 border-gw-primary rounded-xl text-xs shadow-xs">
        <span className="font-bold text-gw-accent uppercase tracking-wider text-[11px] flex items-center gap-1.5 mr-1">
          <Sparkles className="w-3.5 h-3.5 text-gw-primary" />
          Smart Sort Presets:
        </span>
        {[
          { id: 'urgency', label: '🚨 Urgency First' },
          { id: 'recency', label: '⏱️ Recency (Newest)' },
          { id: 'navarea', label: '🌐 NAVAREA Sequence' },
          { id: 'quality', label: '✨ Data Quality / Confidence' },
          { id: 'custom', label: '📋 Standard Table Columns' },
        ].map(preset => (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              setSmartSortMode(preset.id as any);
              if (preset.id !== 'custom') {
                setSortDirection('desc');
              }
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all border cursor-pointer ${
              smartSortMode === preset.id
                ? 'bg-gw-primary text-white border-gw-primary shadow-xs'
                : 'bg-gw-bg text-gw-primary border-gw-secondary hover:bg-white'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <DataBankWarningList model={model} onLocate={onLocate} onVerifyWarning={onVerifyWarning} />
      {/* Ingestion Procedure Modal */}
      <IngestionProcedureModal
        isOpen={isProcedureModalOpen}
        onClose={() => setIsProcedureModalOpen(false)}
        warningsCount={warnings.length}
        sources={sources}
        onTriggerRefresh={onTriggerRefresh}
        isRefreshing={isRefreshing}
        onCommitWarning={(newWarn) => {
          if (onCommitWarnings) {
            onCommitWarnings([newWarn]);
          }
        }}
      />

      {/* Missing Warnings Drawer */}
      <MissingWarningsDrawer
        isOpen={showMissingDrawer}
        onClose={() => setShowMissingDrawer(false)}
        navarea={selectedNavArea}
        missingIds={model.inForceStatus?.missingWarningIds || []}
        onFetchMissing={onTriggerRefresh ? () => onTriggerRefresh() : undefined}
        isFetching={isRefreshing}
      />
    </div>
  );
};

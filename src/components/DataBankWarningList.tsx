import React from 'react';
import { NavWarning, SourceRegistryItem } from '../types';
import {
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  Locate,
  MapPin,
  Search,
} from 'lucide-react';
import { formatSpatialCoordinates } from '../utils/coordinateParser';
import { DataBankModel, SortDirection, SortField } from '../hooks/useDataBankModel';
import { useUILegacy } from '../lib/uiFlags';
import { WarningHierarchyLines, WarningItemDetails } from './WarningItemV2';
import { WarningStatusBadge } from './WarningStatusBadge';
import { getWarningBulletinText, getWarningDate, getWarningPositionCount } from '../utils/warningHelpers';

export interface DataBankWarningListProps {
  model: DataBankModel;
  onLocate: (warning: NavWarning) => void;
  onVerifyWarning?: (warningId: string) => void;
  sources?: SourceRegistryItem[];
}

/** Sort columns kept reachable in the v2 header strip (coords moves into Details). */
const V2_SORT_BUTTONS: { field: SortField; label: string }[] = [
  { field: 'id', label: 'ID' },
  { field: 'area', label: 'AREA' },
  { field: 'title', label: 'TITLE' },
  { field: 'severity', label: 'SEVERITY' },
  { field: 'coords', label: 'COORDS' },
  { field: 'issued', label: 'ISSUED' },
  { field: 'status', label: 'STATUS' },
];

/**
 * Warning presentation shared by the classic and v2 Data Bank layouts:
 * grouped view, mobile cards and the desktop sortable table. The layout around
 * it differs per UI path; this markup does not. The classic path renders the
 * original rows byte-for-byte; the v2 path applies the warning-item hierarchy
 * (ID·NAVAREA / headline / validity·source / actions + expandable Details).
 */
export const DataBankWarningList: React.FC<DataBankWarningListProps> = ({
  model,
  onLocate,
  onVerifyWarning,
  sources,
}) => {
  const legacy = useUILegacy();
  const {
    warnings,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    setCurrentPage,
    groupByMode,
    groupedAnalyzed,
    sortedWarnings,
    expandedGroups,
    toggleGroup,
    paginatedWarnings,
    expandedCards,
    toggleExpand,
    totalPages,
    pageSize,
    setPageSize,
    validPage,
    startIndex,
    endIndex,
    pageNumbers,
    shiftPrevPage,
    shiftNextPage,
    shiftFirstPage,
    shiftLastPage,
    shiftToPage,
    handleSort,
    getSortLabel,
    handleResetFilters,
  } = model;

  if (groupByMode !== 'none' && groupedAnalyzed) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3.5 bg-white border-2 border-gw-primary rounded-xl text-xs shadow-xs">
          <span className="font-bold text-gw-primary uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-gw-primary" />
            Grouped View Mode: <strong className="capitalize text-gw-tertiary">{groupByMode}</strong> ({groupedAnalyzed.length} Active Groups)
          </span>
          <span className="text-gw-accent text-[11px]">
            Showing {sortedWarnings.length} records structured across groups
          </span>
        </div>

        {groupedAnalyzed.map(group => {
          const isExpanded = expandedGroups[group.groupKey] !== false;
          return (
            <div key={group.groupKey} className="bg-white border-2 border-gw-primary rounded-2xl overflow-hidden shadow-xs">
              {/* Group Header */}
              <div
                onClick={() => toggleGroup(group.groupKey)}
                className="p-4 bg-gw-bg border-b-2 border-gw-primary/30 flex items-center justify-between cursor-pointer hover:bg-gw-secondary/20 transition-colors select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gw-primary text-white flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                    {group.count}
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-gw-primary">
                      {group.groupLabel}
                    </h3>
                    <p className="text-[11px] text-gw-accent font-mono mt-0.5">
                      {group.count} warning{group.count === 1 ? '' : 's'} in this group
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-gw-primary">
                  <span>{isExpanded ? 'Collapse Group' : 'Expand Group'}</span>
                  <div className="p-1 rounded bg-white border border-gw-secondary text-gw-primary">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Group Content */}
              {isExpanded && (
                <div className="p-3 sm:p-4 space-y-3 bg-white">
                  {group.items.map((analyzedItem, gIdx) => {
                    const w = analyzedItem.warning;
                    const cardId = w.warning_id || w.source_warning_id || `group-${group.groupKey}-${gIdx}`;

                    if (!legacy) {
                      const isExpanded = !!expandedCards[cardId];
                      const canVerify =
                        !!onVerifyWarning &&
                        (w.status === 'unverified' ||
                          (typeof w.extraction_confidence === 'number' && w.extraction_confidence < 1));

                      return (
                        <div
                          key={cardId}
                          onClick={() => onLocate(w)}
                          className={`p-2.5 border rounded-md bg-white hover:bg-gw-bg/40 hover:border-gw-primary transition-colors cursor-pointer group ${
                            isExpanded ? 'border-gw-primary' : 'border-gw-secondary'
                          }`}
                        >
                          <WarningHierarchyLines warning={w} sources={sources} />
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onLocate(w);
                              }}
                              className="flex items-center gap-1 px-2 py-1 bg-white border border-gw-primary text-gw-primary rounded text-[10px] font-bold uppercase hover:bg-gw-primary hover:text-gw-bg transition-colors"
                            >
                              <Locate className="w-3 h-3" />
                              <span>View on map</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(cardId, e);
                              }}
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? 'Collapse warning details' : 'Expand warning details'}
                              className="flex items-center gap-1 px-2 py-1 bg-white border border-gw-secondary text-gw-accent rounded text-[10px] font-bold uppercase hover:border-gw-primary hover:text-gw-primary transition-colors"
                            >
                              <span>Details</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                            {canVerify && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onVerifyWarning!(w.warning_id);
                                }}
                                className="ml-auto px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold uppercase hover:bg-emerald-700 transition-colors"
                              >
                                ✓ Verify
                              </button>
                            )}
                          </div>
                          {isExpanded && <WarningItemDetails warning={w} />}
                        </div>
                      );
                    }

                    const isCritical = w.extraction_confidence === 1;
                    const positionCount = getWarningPositionCount(w);

                    return (
                      <div
                        key={cardId}
                        onClick={() => onLocate(w)}
                        className="p-3.5 border-2 border-gw-secondary rounded-xl bg-gw-bg/30 hover:bg-white hover:border-gw-primary transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs group"
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-white border border-gw-secondary flex items-center justify-center text-gw-primary shrink-0 font-bold text-xs font-mono">
                            {w.navarea || 'NA'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-xs text-gw-primary group-hover:underline font-mono">
                                {w.source_warning_id}
                              </span>
                              <WarningStatusBadge warning={w} compact />
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${analyzedItem.categoryMeta.badgeClass}`}>
                                {analyzedItem.categoryMeta.shortLabel}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${isCritical ? 'bg-gw-primary' : 'bg-gw-tertiary'}`}>
                                {isCritical ? 'CRITICAL' : 'HIGH'}
                              </span>
                              {positionCount > 1 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  Positions: {positionCount}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gw-primary font-medium mt-1 line-clamp-1">
                              {w.issued_text}
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-gw-accent mt-1 font-mono">
                              <span>{analyzedItem.coordinatesDisplay}</span>
                              <span>•</span>
                              <span>Issued: {getWarningDate(w)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {onVerifyWarning && (w.status === 'unverified' || w.extraction_confidence < 1) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onVerifyWarning(w.warning_id);
                              }}
                              className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-emerald-700 transition-colors"
                            >
                              ✓ Verify
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onLocate(w);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gw-primary text-white rounded-lg text-[10px] font-bold uppercase hover:bg-gw-accent transition-colors shadow-xs"
                          >
                            <Locate className="w-3 h-3" />
                            <span>Locate</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card List (visible on mobile < md) */}
      <div className="block md:hidden space-y-3">
        {/* Mobile Shifter & Sorting Header */}
        <div className="flex items-center justify-between p-2.5 bg-white border-2 border-gw-primary rounded-xl text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span className="text-gw-accent text-[11px]">Sort:</span>
            <select
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const [f, d] = e.target.value.split('-') as [SortField, SortDirection];
                setSortField(f);
                setSortDirection(d);
                setCurrentPage(1);
              }}
              className="bg-gw-bg border border-gw-secondary rounded px-2 py-1 text-xs font-bold text-gw-primary outline-none"
            >
              <option value="issued-desc">Date (Newest First)</option>
              <option value="issued-asc">Date (Oldest First)</option>
              <option value="id-asc">ID (A-Z / Low-High)</option>
              <option value="id-desc">ID (High-Low)</option>
              <option value="area-asc">NAVAREA (Asc)</option>
              <option value="severity-desc">Severity (High First)</option>
              <option value="status-asc">Status (Active First)</option>
            </select>
          </div>

          {pageSize !== 'ALL' && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={shiftPrevPage}
                disabled={validPage === 1}
                className="p-1.5 rounded border border-gw-secondary bg-gw-bg text-gw-primary disabled:opacity-30"
                title="Shift Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-gw-primary px-1">
                {validPage}/{totalPages}
              </span>
              <button
                type="button"
                onClick={shiftNextPage}
                disabled={validPage === totalPages}
                className="p-1.5 rounded border border-gw-secondary bg-gw-bg text-gw-primary disabled:opacity-30"
                title="Shift Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {paginatedWarnings.length === 0 ? (
          <div className="p-8 text-center bg-secondary border-2 border-gw-primary rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-gw-bg border-primary text-gw-primary flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold text-gw-primary uppercase tracking-wider">No Navigational Warnings Found</div>
            <p className="text-xs text-gw-accent max-w-sm mx-auto">
              No active warnings match your current search or filter criteria.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 bg-gw-primary text-white rounded text-xs font-bold hover:bg-gw-accent transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          paginatedWarnings.map((w, idx) => {
            const cardId = w.warning_id || w.source_warning_id || `card-${idx}`;
            const isExpanded = !!expandedCards[cardId];

            if (!legacy) {
              const canVerify =
                !!onVerifyWarning &&
                (w.status === 'unverified' ||
                  (typeof w.extraction_confidence === 'number' && w.extraction_confidence < 1));

              return (
                <div
                  key={cardId}
                  className="bg-white border border-gw-primary rounded-md overflow-hidden"
                >
                  <div className="p-2.5">
                    <WarningHierarchyLines warning={w} sources={sources} />
                  </div>
                  <div className="px-2.5 pb-2.5 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLocate(w);
                      }}
                      className="flex items-center gap-1 px-2 py-1.5 bg-white border border-gw-primary text-gw-primary rounded text-[10px] font-bold uppercase transition-colors hover:bg-gw-primary hover:text-gw-bg"
                      title="Locate on Map"
                    >
                      <Locate className="w-3 h-3" />
                      <span>View on map</span>
                    </button>
                    <button
                      onClick={(e) => toggleExpand(cardId, e)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Collapse warning details' : 'Expand warning details'}
                      className="flex items-center gap-1 px-2 py-1.5 bg-white border border-gw-secondary text-gw-accent rounded text-[10px] font-bold uppercase transition-colors hover:border-gw-primary hover:text-gw-primary"
                    >
                      <span>Details</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {canVerify && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onVerifyWarning!(w.warning_id);
                        }}
                        className="ml-auto flex items-center gap-1 px-2 py-1.5 bg-emerald-600 text-white rounded text-[10px] font-bold uppercase transition-colors hover:bg-emerald-700"
                        title="Quick Verify"
                      >
                        ✓ Verify
                      </button>
                    )}
                  </div>
                  {isExpanded && <WarningItemDetails warning={w} />}
                </div>
              );
            }

            const isCritical = w.extraction_confidence === 1;

            return (
              <div
                key={cardId}
                className="bg-white border-2 border-gw-primary rounded-xl overflow-hidden shadow-hard transition-all"
              >
                {/* Primary Visible Header */}
                <div className="p-3.5 flex items-center justify-between gap-2 bg-white">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-xs text-gw-primary truncate">
                      {w.source_warning_id}
                    </span>

                    {/* Severity Badge */}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white shrink-0 ${isCritical ? 'bg-gw-primary' : 'bg-gw-tertiary'}`}>
                      {isCritical ? 'CRITICAL' : 'HIGH'}
                    </span>
                  </div>

                  {/* Actions: Verify, Locate & Expand */}
                  <div className="flex items-center gap-1 shrink-0">
                    {onVerifyWarning && (w.status === 'unverified' || w.extraction_confidence < 1) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onVerifyWarning(w.warning_id);
                        }}
                        className="flex items-center gap-1 px-2 py-1.5 bg-emerald-600 text-white rounded text-[10px] font-bold uppercase transition-colors hover:bg-emerald-700"
                        title="Quick Verify"
                      >
                        ✓ Verify
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLocate(w);
                      }}
                      className="flex items-center gap-1 px-2 py-1.5 bg-gw-primary text-gw-bg rounded text-[10px] font-bold uppercase transition-colors hover:bg-gw-accent"
                      title="Locate on Map"
                    >
                      <Locate className="w-3 h-3" />
                      <span>Locate</span>
                    </button>

                    <button
                      onClick={(e) => toggleExpand(cardId, e)}
                      className="p-1.5 bg-gw-bg border border-gw-secondary rounded text-gw-primary hover:bg-gw-primary hover:text-gw-bg transition-colors"
                      aria-label={isExpanded ? 'Collapse warning details' : 'Expand warning details'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Primary Short Text Preview */}
                <div className="px-3.5 pb-3 text-xs font-bold text-gw-primary line-clamp-2 leading-snug border-b border-gw-secondary/40">
                  {w.issued_text}
                </div>

                {/* Expandable Secondary Metadata Panel */}
                {isExpanded && (
                  <div className="p-3.5 bg-gw-bg/60 border-t border-gw-secondary space-y-3 text-xs animate-in fade-in duration-150">
                    {/* NAVAREA & Status Row */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gw-accent block mb-0.5">NAVAREA Region</span>
                        <span className="font-bold text-gw-primary inline-block px-2 py-0.5 bg-white border border-gw-secondary rounded">
                          NAVAREA {w.navarea}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase text-gw-accent block mb-0.5">Status</span>
                        <span className="flex items-center gap-1.5 font-bold uppercase text-gw-primary mt-1">
                          <span className={`w-2 h-2 rounded-full ${w.status === 'active' ? 'bg-green-600' : 'bg-amber-600'}`}></span>
                          <span className={w.status === 'active' ? 'text-green-600' : 'text-amber-600'}>{w.status}</span>
                        </span>
                      </div>
                    </div>

                    {/* Coordinates & Issued Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-[10px] font-bold uppercase text-gw-accent">Parsed Coordinates</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(formatSpatialCoordinates(w.spatial));
                            }}
                            className="text-[10px] text-gw-primary hover:text-gw-accent font-bold uppercase underline"
                          >
                            Copy Coords
                          </button>
                        </div>
                        <div className="font-bold text-gw-primary bg-white px-2 py-1 border border-gw-secondary rounded flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-gw-accent shrink-0" />
                          <span className="truncate">{formatSpatialCoordinates(w.spatial)}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase text-gw-accent block mb-0.5">Issued Date</span>
                        <div className="font-bold text-gw-primary bg-white px-2 py-1 border border-gw-secondary rounded flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gw-accent shrink-0" />
                          <span>{getWarningDate(w)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Full Text Snippet */}
                    <div>
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[10px] font-bold uppercase text-gw-accent">Full Raw Telemetry</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(getWarningBulletinText(w));
                          }}
                          className="text-[10px] text-gw-primary hover:text-gw-accent font-bold uppercase underline"
                        >
                          Copy Raw Telemetry
                        </button>
                      </div>
                      <div className="p-2.5 bg-white border border-gw-secondary rounded text-[11px] text-gw-primary font-mono leading-relaxed max-h-36 overflow-y-auto no-scrollbar">
                        {getWarningBulletinText(w)}
                      </div>
                    </div>

                    {/* Confidence Score & Audit Info */}
                    <div className="flex justify-between items-center text-[10px] pt-1">
                      <span className="text-gw-accent font-bold">Extraction Confidence:</span>
                      <span className="font-bold text-gw-primary bg-white px-2 py-0.5 rounded border border-gw-secondary">
                        {(w.extraction_confidence * 100).toFixed(0)}% Match
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop / Tablet Grid Table (hidden on mobile < md) */}
      <div className="hidden md:block bg-secondary border-2 border-gw-primary rounded-2xl overflow-hidden overflow-x-auto shadow-sm">
        {/* v2 header: compact sort strip (all 8 sort fields stay reachable; coords moves into Details) */}
        {!legacy && (
          <div
            id="databank-table-header"
            className="flex flex-wrap items-center gap-1 p-2 bg-gw-primary text-gw-bg text-[10px] font-bold tracking-wider uppercase select-none sticky top-0 z-10 shadow-xs"
          >
            <span className="px-1.5 text-gw-bg/70 font-mono text-[9px]">SORT</span>
            {V2_SORT_BUTTONS.map(({ field, label }) => (
              <button
                key={field}
                type="button"
                onClick={() => handleSort(field)}
                className={`flex items-center gap-1 px-2 py-1 rounded transition-all font-mono cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  sortField === field
                    ? 'bg-white/20 text-white font-black ring-1 ring-white/40 shadow-xs'
                    : 'text-gw-bg/90 hover:bg-white/10 hover:text-white'
                }`}
                title={getSortLabel(field, field === 'area' ? 'NAVAREA' : label)}
                aria-sort={sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <span className="truncate">{label}</span>
                {sortField === field ? (
                  sortDirection === 'asc' ? (
                    <ArrowUp className="w-3 h-3 text-white shrink-0" />
                  ) : (
                    <ArrowDown className="w-3 h-3 text-white shrink-0" />
                  )
                ) : (
                  <ArrowUpDown className="w-3 h-3 opacity-30 shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Table Header: Selected Element - Interactive Column Sorting (classic path) */}
        {legacy && (
        <div
          id="databank-table-header"
          className="min-w-[900px] grid grid-cols-[140px_80px_1fr_90px_130px_110px_90px_60px] p-2.5 bg-gw-primary text-gw-bg text-[10px] font-bold tracking-wider uppercase gap-2.5 items-center border-b border-gw-primary/30 select-none sticky top-0 z-10 shadow-xs"
        >
          {/* ID Column */}
          <button
            type="button"
            onClick={() => handleSort('id')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-all font-mono group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              sortField === 'id'
                ? 'bg-white/20 text-white font-black ring-1 ring-white/40 shadow-xs'
                : 'text-gw-bg/90 hover:bg-white/10 hover:text-white'
            }`}
            title={getSortLabel('id', 'Warning ID')}
            aria-sort={sortField === 'id' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            <span className="truncate">ID</span>
            {sortField === 'id' ? (
              sortDirection === 'asc' ? (
                <ArrowUp className="w-3 h-3 text-white shrink-0" />
              ) : (
                <ArrowDown className="w-3 h-3 text-white shrink-0" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </button>

          {/* AREA Column */}
          <button
            type="button"
            onClick={() => handleSort('area')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-all font-mono group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              sortField === 'area'
                ? 'bg-white/20 text-white font-black ring-1 ring-white/40 shadow-xs'
                : 'text-gw-bg/90 hover:bg-white/10 hover:text-white'
            }`}
            title={getSortLabel('area', 'NAVAREA')}
            aria-sort={sortField === 'area' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            <span className="truncate">AREA</span>
            {sortField === 'area' ? (
              sortDirection === 'asc' ? (
                <ArrowUp className="w-3 h-3 text-white shrink-0" />
              ) : (
                <ArrowDown className="w-3 h-3 text-white shrink-0" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </button>

          {/* TITLE / SUMMARY Column */}
          <button
            type="button"
            onClick={() => handleSort('title')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-all font-mono group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              sortField === 'title'
                ? 'bg-white/20 text-white font-black ring-1 ring-white/40 shadow-xs'
                : 'text-gw-bg/90 hover:bg-white/10 hover:text-white'
            }`}
            title={getSortLabel('title', 'Title & Summary')}
            aria-sort={sortField === 'title' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            <span className="truncate">TITLE</span>
            {sortField === 'title' ? (
              sortDirection === 'asc' ? (
                <ArrowUp className="w-3 h-3 text-white shrink-0" />
              ) : (
                <ArrowDown className="w-3 h-3 text-white shrink-0" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </button>

          {/* SEVERITY Column */}
          <button
            type="button"
            onClick={() => handleSort('severity')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-all font-mono group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              sortField === 'severity'
                ? 'bg-white/20 text-white font-black ring-1 ring-white/40 shadow-xs'
                : 'text-gw-bg/90 hover:bg-white/10 hover:text-white'
            }`}
            title={getSortLabel('severity', 'Severity & Confidence')}
            aria-sort={sortField === 'severity' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            <span className="truncate">SEVERITY</span>
            {sortField === 'severity' ? (
              sortDirection === 'asc' ? (
                <ArrowUp className="w-3 h-3 text-white shrink-0" />
              ) : (
                <ArrowDown className="w-3 h-3 text-white shrink-0" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </button>

          {/* COORDS Column */}
          <button
            type="button"
            onClick={() => handleSort('coords')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-all font-mono group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              sortField === 'coords'
                ? 'bg-white/20 text-white font-black ring-1 ring-white/40 shadow-xs'
                : 'text-gw-bg/90 hover:bg-white/10 hover:text-white'
            }`}
            title={getSortLabel('coords', 'Coordinates')}
            aria-sort={sortField === 'coords' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            <span className="truncate">COORDS</span>
            {sortField === 'coords' ? (
              sortDirection === 'asc' ? (
                <ArrowUp className="w-3 h-3 text-white shrink-0" />
              ) : (
                <ArrowDown className="w-3 h-3 text-white shrink-0" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </button>

          {/* ISSUED Column */}
          <button
            type="button"
            onClick={() => handleSort('issued')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-all font-mono group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              sortField === 'issued'
                ? 'bg-white/20 text-white font-black ring-1 ring-white/40 shadow-xs'
                : 'text-gw-bg/90 hover:bg-white/10 hover:text-white'
            }`}
            title={getSortLabel('issued', 'Issued Date')}
            aria-sort={sortField === 'issued' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            <span className="truncate">ISSUED</span>
            {sortField === 'issued' ? (
              sortDirection === 'asc' ? (
                <ArrowUp className="w-3 h-3 text-white shrink-0" />
              ) : (
                <ArrowDown className="w-3 h-3 text-white shrink-0" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </button>

          {/* STATUS Column */}
          <button
            type="button"
            onClick={() => handleSort('status')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-all font-mono group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              sortField === 'status'
                ? 'bg-white/20 text-white font-black ring-1 ring-white/40 shadow-xs'
                : 'text-gw-bg/90 hover:bg-white/10 hover:text-white'
            }`}
            title={getSortLabel('status', 'Warning Status')}
            aria-sort={sortField === 'status' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            <span className="truncate">STATUS</span>
            {sortField === 'status' ? (
              sortDirection === 'asc' ? (
                <ArrowUp className="w-3 h-3 text-white shrink-0" />
              ) : (
                <ArrowDown className="w-3 h-3 text-white shrink-0" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </button>

          {/* ACTION Column Header */}
          <div className="sticky right-0 bg-gw-primary text-right pr-3 text-gw-bg/80 font-mono tracking-widest text-[9px] font-bold">
            ACTION
          </div>
        </div>
        )}

        {/* Table Body: Paginated Rows */}
        <div className={legacy ? 'min-w-[900px] max-h-[520px] overflow-y-auto no-scrollbar' : 'max-h-[600px] overflow-y-auto no-scrollbar'}>
          {paginatedWarnings.length === 0 ? (
            <div className="p-10 text-center bg-white space-y-3">
              <div className="w-12 h-12 rounded-full bg-gw-bg border border-gw-primary text-gw-primary flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-gw-primary uppercase tracking-wider">No Navigational Warnings Found</div>
              <p className="text-xs text-gw-accent max-w-sm mx-auto">
                No active warnings match your current search, NAVAREA, or status filter criteria.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 bg-gw-primary text-white rounded text-xs font-bold hover:bg-gw-accent transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          ) : legacy ? (
            paginatedWarnings.map((w, idx) => (
              <div
                key={w.warning_id || w.source_warning_id || idx}
                className="grid grid-cols-[140px_80px_1fr_90px_130px_110px_90px_60px] p-3 border-b border-gw-secondary text-xs items-center gap-2.5 hover:bg-gw-bg/60 transition-colors cursor-pointer group"
                onClick={() => onLocate(w)}
              >
                <div className="font-bold text-gw-primary group-hover:underline truncate flex items-center gap-1.5">
                  <span className="truncate">{w.source_warning_id}</span>
                  <WarningStatusBadge warning={w} compact />
                  {getWarningPositionCount(w) > 1 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0 font-mono">
                      Pos: {getWarningPositionCount(w)}
                    </span>
                  )}
                </div>
                <div>
                  <span className="inline-flex items-center justify-center px-2 py-0.5 bg-gw-bg border border-gw-secondary rounded text-[10px] font-bold text-gw-primary">
                    NA {w.navarea}
                  </span>
                </div>
                <div className="truncate text-gw-primary font-medium">{w.issued_text.substring(0, 70)}...</div>
                <div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${
                    w.extraction_confidence === 1 ? 'bg-gw-primary' : 'bg-gw-tertiary'
                  }`}>
                    {w.extraction_confidence === 1 ? 'HIGH' : 'MOD'}
                  </span>
                </div>
                <div className="text-[11px] text-gw-accent font-mono truncate">
                  {formatSpatialCoordinates(w.spatial)}
                </div>
                <div className="text-[11px] text-gw-accent whitespace-nowrap">{getWarningDate(w)}</div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    w.status === 'active' ? 'bg-green-600' : w.status === 'unverified' ? 'bg-amber-500' : 'bg-zinc-400'
                  }`}></span>
                  <span className={
                    w.status === 'active' ? 'text-green-700' : w.status === 'unverified' ? 'text-amber-700' : 'text-zinc-600'
                  }>
                    {w.status}
                  </span>
                </div>
                <div className="sticky right-0 bg-white group-hover:bg-gw-bg/60 flex justify-end gap-1 pr-1 transition-colors">
                  {onVerifyWarning && (w.status === 'unverified' || w.extraction_confidence < 1) && (
                    <button
                      aria-label={`Quick verify warning ${w.source_warning_id}`}
                      title="Quick Verify candidate"
                      onClick={(e) => {
                        e.stopPropagation();
                        onVerifyWarning(w.warning_id);
                      }}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      ✓ Verify
                    </button>
                  )}
                  <button
                    aria-label={`Locate warning ${w.source_warning_id} on map`}
                    title={`Locate warning ${w.source_warning_id} on map`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLocate(w);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded border border-gw-secondary bg-white hover:bg-gw-primary hover:text-gw-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary shrink-0"
                  >
                    <Locate className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            paginatedWarnings.map((w, idx) => {
              const cardId = w.warning_id || w.source_warning_id || String(idx);
              const isExpanded = !!expandedCards[cardId];
              const canVerify =
                !!onVerifyWarning &&
                (w.status === 'unverified' ||
                  (typeof w.extraction_confidence === 'number' && w.extraction_confidence < 1));

              return (
                <div
                  key={cardId}
                  onClick={() => onLocate(w)}
                  className={`p-2.5 border-b border-gw-secondary bg-white hover:bg-gw-bg/60 transition-colors cursor-pointer group ${
                    isExpanded ? 'bg-gw-bg/40' : ''
                  }`}
                >
                  <WarningHierarchyLines warning={w} sources={sources} />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      aria-label={`Locate warning ${w.source_warning_id} on map`}
                      title={`Locate warning ${w.source_warning_id} on map`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onLocate(w);
                      }}
                      className="flex items-center gap-1 px-2 py-1 bg-white border border-gw-primary text-gw-primary rounded text-[10px] font-bold uppercase hover:bg-gw-primary hover:text-gw-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary"
                    >
                      <Locate className="w-3 h-3" />
                      <span>View on map</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(cardId, e);
                      }}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Collapse warning details' : 'Expand warning details'}
                      className="flex items-center gap-1 px-2 py-1 bg-white border border-gw-secondary text-gw-accent rounded text-[10px] font-bold uppercase hover:border-gw-primary hover:text-gw-primary transition-colors"
                    >
                      <span>Details</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {canVerify && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onVerifyWarning!(w.warning_id);
                        }}
                        className="ml-auto px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold uppercase hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      >
                        ✓ Verify
                      </button>
                    )}
                  </div>
                  {isExpanded && <WarningItemDetails warning={w} />}
                </div>
              );
            })
          )}
        </div>

        {/* Shifting & Pagination Controls Footer */}
        <div className="min-w-[900px] flex items-center justify-between p-3.5 bg-gw-bg border-t border-gw-secondary text-xs font-mono select-none">
          {/* Left: Record Range Summary and Page Size Shifter */}
          <div className="flex items-center gap-4">
            <div className="text-gw-accent font-medium">
              Showing <span className="font-bold text-gw-primary">{sortedWarnings.length === 0 ? 0 : startIndex + 1}</span>–
              <span className="font-bold text-gw-primary">{endIndex}</span> of{' '}
              <span className="font-bold text-gw-primary">{sortedWarnings.length}</span> warnings
              {warnings.length !== sortedWarnings.length && (
                <span className="text-[11px] text-gw-accent ml-1.5">(filtered from {warnings.length})</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-gw-accent text-[11px] uppercase font-bold">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-gw-secondary rounded px-2 py-1 text-xs font-bold text-gw-primary outline-none focus:border-gw-primary cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value="ALL">All ({sortedWarnings.length})</option>
              </select>
            </div>
          </div>

          {/* Right: Page Shifter Navigation Controls */}
          {pageSize !== 'ALL' && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-gw-accent text-[11px] font-bold mr-2 hidden lg:inline">
                Page {validPage} of {totalPages}
              </span>

              {/* First Page */}
              <button
                type="button"
                onClick={shiftFirstPage}
                disabled={validPage === 1}
                className="p-1.5 rounded border border-gw-secondary bg-white text-gw-primary hover:bg-gw-primary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Shift to First Page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>

              {/* Prev Page */}
              <button
                type="button"
                onClick={shiftPrevPage}
                disabled={validPage === 1}
                className="flex items-center gap-1 px-2.5 py-1 rounded border border-gw-secondary bg-white text-gw-primary hover:bg-gw-primary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-bold"
                title="Shift Previous Page (or Shift+Left)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              {/* Page Number Pills */}
              <div className="flex items-center gap-1">
                {pageNumbers.map((p, i) => (
                  p === '...' ? (
                    <span key={`dots-${i}`} className="px-1 text-gw-accent font-bold">...</span>
                  ) : (
                    <button
                      key={`page-${p}`}
                      type="button"
                      onClick={() => shiftToPage(Number(p))}
                      className={`min-w-[28px] h-7 px-1 flex items-center justify-center rounded text-xs font-bold transition-all ${
                        validPage === p
                          ? 'bg-gw-primary text-white font-black shadow-xs'
                          : 'bg-white border border-gw-secondary text-gw-primary hover:bg-gw-bg'
                      }`}
                    >
                      {p}
                    </button>
                  )
                ))}
              </div>

              {/* Next Page */}
              <button
                type="button"
                onClick={shiftNextPage}
                disabled={validPage === totalPages}
                className="flex items-center gap-1 px-2.5 py-1 rounded border border-gw-secondary bg-white text-gw-primary hover:bg-gw-primary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs font-bold"
                title="Shift Next Page (or Shift+Right)"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Last Page */}
              <button
                type="button"
                onClick={shiftLastPage}
                disabled={validPage === totalPages}
                className="p-1.5 rounded border border-gw-secondary bg-white text-gw-primary hover:bg-gw-primary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Shift to Last Page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>

              {/* Keyboard Shortcut Hint */}
              <span className="hidden xl:inline text-[10px] text-gw-accent ml-2">
                (<kbd className="px-1 py-0.5 bg-white border border-gw-secondary rounded text-[9px] font-mono">Shift+←/→</kbd> to shift)
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { NavWarning, SourceRegistryItem, IngestionGeneration } from '../types';
import {
  analyzeDataset,
  sortAnalyzedWarnings,
  groupWarnings,
  HazardCategory,
  SmartSortMode,
  AnalyzedWarning,
  DataBankAnalytics,
} from '../utils/warningAnalyzer';
import {
  useInForceStatus,
  getInForceStatusForNavarea,
  clearInForceStatusCache,
  type InForceStatusResult,
} from './useInForceStatus';
import { FEATURE_FLAGS } from '../lib/featureFlags';
import { type DataBankRouteState } from '../lib/consoleRoute';

export interface DataBankProps {
  warnings: NavWarning[];
  archivedWarnings?: NavWarning[];
  onLocate: (warning: NavWarning) => void;
  onVerifyWarning?: (warningId: string) => void;
  initialStatusFilter?: string;
  initialNavAreaFilter?: string;
  /** Hash-synced Data Bank view state for deep links (search/sort/dir/page/NAVAREA). */
  routeState?: DataBankRouteState;
  /** Called whenever the view state changes so App can update the hash. */
  onRouteStateChange?: (state: DataBankRouteState) => void;
  onTriggerRefresh?: (sourceId?: string) => Promise<void>;
  isRefreshing?: boolean;
  onCommitWarnings?: (newWarnings: NavWarning[]) => void;
  sources?: SourceRegistryItem[];
  /** Ingestion run ledger (ingestion_generations) for the Summary panel. */
  generations?: IngestionGeneration[];
  isOfflineMode?: boolean;
  /** True while the initial collection fetch is in flight (honest loading UI). */
  isLoading?: boolean;
  /** Explicit admin flag threaded to the MissingWarningsDrawer fetch actions. */
  isAdmin?: boolean;
  onOpenConsole?: () => void;
  onNavigate?: (tab: any) => void;
}

export const ALL_NAVAREAS: { id: string; name: string }[] = [
  { id: 'I', name: 'NAVAREA I (UK / NE Atlantic)' },
  { id: 'Baltic', name: 'Baltic Sea (Sweden)' },
  { id: 'II', name: 'NAVAREA II (France / E Atlantic)' },
  { id: 'III', name: 'NAVAREA III (Spain / Med & Black Sea)' },
  { id: 'IV', name: 'NAVAREA IV (USA / NW Atlantic)' },
  { id: 'V', name: 'NAVAREA V (Brazil / SW Atlantic)' },
  { id: 'VI', name: 'NAVAREA VI (Argentina / S Atlantic)' },
  { id: 'VII', name: 'NAVAREA VII (South Africa / Indian Ocean)' },
  { id: 'VIII', name: 'NAVAREA VIII (India / North Indian Ocean)' },
  { id: 'IX', name: 'NAVAREA IX (Pakistan / Persian Gulf & Red Sea)' },
  { id: 'X', name: 'NAVAREA X (Australia)' },
  { id: 'XI', name: 'NAVAREA XI (Japan / East Asia)' },
  { id: 'XII', name: 'NAVAREA XII (USA / Eastern Pacific)' },
  { id: 'XIII', name: 'NAVAREA XIII (Russian Fed / NW Pacific)' },
  { id: 'XIV', name: 'NAVAREA XIV (New Zealand / South Pacific)' },
  { id: 'XV', name: 'NAVAREA XV (Chile / SE Pacific)' },
  { id: 'XVI', name: 'NAVAREA XVI (Peru / Eastern Pacific)' },
  { id: 'XVII', name: 'NAVAREA XVII (Canada / Arctic West & Beaufort)' },
  { id: 'XVIII', name: 'NAVAREA XVIII (Canada / Arctic East & Baffin)' },
  { id: 'XIX', name: 'NAVAREA XIX (Norway / Arctic)' },
  { id: 'XX', name: 'NAVAREA XX (Russian Fed / Arctic West)' },
  { id: 'XXI', name: 'NAVAREA XXI (Russian Fed / Arctic East)' },
];

export type SortField = 'id' | 'area' | 'title' | 'severity' | 'coords' | 'issued' | 'status';
const VALID_SORT_FIELDS: SortField[] = ['id', 'area', 'title', 'severity', 'coords', 'issued', 'status'];
const isSortField = (v: string): v is SortField => (VALID_SORT_FIELDS as string[]).includes(v);
export type SortDirection = 'asc' | 'desc';
export type CoordFilterType = 'ALL' | 'with_coords' | 'without_coords';
export type GroupByMode = 'none' | 'navarea' | 'category' | 'urgency' | 'authority';

export interface DataBankModel {
  warnings: NavWarning[];

  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  selectedNavArea: string;
  setSelectedNavArea: Dispatch<SetStateAction<string>>;
  selectedSeverity: string;
  setSelectedSeverity: Dispatch<SetStateAction<string>>;
  selectedStatus: string;
  setSelectedStatus: Dispatch<SetStateAction<string>>;
  selectedCategory: HazardCategory | 'ALL';
  setSelectedCategory: Dispatch<SetStateAction<HazardCategory | 'ALL'>>;
  smartSortMode: SmartSortMode | 'custom';
  setSmartSortMode: Dispatch<SetStateAction<SmartSortMode | 'custom'>>;
  groupByMode: GroupByMode;
  setGroupByMode: Dispatch<SetStateAction<GroupByMode>>;
  coordFilter: CoordFilterType;
  setCoordFilter: Dispatch<SetStateAction<CoordFilterType>>;
  isProcedureModalOpen: boolean;
  setIsProcedureModalOpen: Dispatch<SetStateAction<boolean>>;
  sortField: SortField;
  setSortField: Dispatch<SetStateAction<SortField>>;
  sortDirection: SortDirection;
  setSortDirection: Dispatch<SetStateAction<SortDirection>>;
  currentPage: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  pageSize: number | 'ALL';
  setPageSize: Dispatch<SetStateAction<number | 'ALL'>>;

  datasetAnalysis: ReturnType<typeof analyzeDataset>;
  analyzed: AnalyzedWarning[];
  analytics: DataBankAnalytics;
  navareaCounts: Record<string, number>;
  extraNavAreas: string[];
  activeCount: number;
  archivedCount: number;
  coordsCount: number;
  criticalCount: number;
  unverifiedCount: number;
  recent24hCount: number;
  lastCheckedAt: number | null;

  filteredAnalyzed: AnalyzedWarning[];
  sortedAnalyzed: AnalyzedWarning[];
  sortedWarnings: NavWarning[];
  groupedAnalyzed: ReturnType<typeof groupWarnings> | null;

  totalPages: number;
  validPage: number;
  startIndex: number;
  endIndex: number;
  paginatedWarnings: NavWarning[];
  pageNumbers: (number | '...')[];

  expandedCards: Record<string, boolean>;
  expandedGroups: Record<string, boolean>;
  hasActiveFilters: boolean;

  toggleExpand: (id: string, e: React.MouseEvent) => void;
  toggleGroup: (groupKey: string) => void;
  handleSort: (field: SortField) => void;
  handleResetFilters: () => void;
  getSortLabel: (field: SortField, label: string) => string;
  shiftPrevPage: () => void;
  shiftNextPage: () => void;
  shiftFirstPage: () => void;
  shiftLastPage: () => void;
  shiftToPage: (p: number) => void;

  inForceStatus: InForceStatusResult;
  getInForceStatus: (navarea: string) => InForceStatusResult | null;
}

/**
 * Single source of truth for the Data Bank page: data analysis, filters, quick
 * filters, sorting and pagination. The classic layout and the v2 layout are two
 * presentations of this one model — never fork the filtering/sorting logic into
 * a component.
 */
/**
 * Tier A + EXPLICIT data quality + no qa_flags: the "critical / verified"
 * band of the bank. Falls back to the legacy confidence threshold for
 * offline/locally-parsed rows that carry no triage metadata.
 */
function isTierAClean(w: NavWarning): boolean {
  const tier = (w as any).triage_tier;
  if (tier === undefined) return (w.extraction_confidence ?? 0) >= 0.8;
  const flags = (w as any).qa_flags;
  return tier === 'A'
    && (w.data_quality ?? 'EXPLICIT') === 'EXPLICIT'
    && (!Array.isArray(flags) || (flags as unknown[]).length === 0);
}

/** Review needed: explicit 'unverified' status, Tier B, or any qa_flags. */
function isUnverifiedRow(w: NavWarning): boolean {
  const tier = (w as any).triage_tier;
  if (tier === undefined) {
    return w.status === 'unverified' || (w.extraction_confidence !== undefined && w.extraction_confidence < 0.8);
  }
  const flags = (w as any).qa_flags;
  return w.status === 'unverified' || tier === 'B'
    || (Array.isArray(flags) && (flags as unknown[]).length > 0);
}

/**
 * True geometry = PostGIS-backed shapes (hydrated from the spatial view or
 * geojson_blob), NOT the raw-text regex fallback. The mapper flags regex
 * parses as validation_status 'parsed_from_text' precisely so "with coords"
 * means "actually mapped", not "mentions a coordinate pattern in text".
 */
function hasTrueGeometry(w: NavWarning): boolean {
  const sp: any = w.spatial;
  if (!sp) return false;
  if (sp.validation_status === 'parsed_from_text') return false;
  return (sp.geometries?.length > 0) || (sp.circles?.length > 0);
}

export function useDataBankModel({
  warnings,
  archivedWarnings = [],
  initialStatusFilter = 'ALL',
  initialNavAreaFilter = 'ALL',
  routeState,
  onRouteStateChange,
}: {
  warnings: NavWarning[];
  archivedWarnings?: NavWarning[];
  initialStatusFilter?: string;
  initialNavAreaFilter?: string;
  /** Hash-synced Data Bank view state for deep links (search/sort/dir/page/NAVAREA). */
  routeState?: DataBankRouteState;
  /** Called whenever the view state changes so App can update the hash. */
  onRouteStateChange?: (state: DataBankRouteState) => void;
}): DataBankModel {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNavArea, setSelectedNavArea] = useState(initialNavAreaFilter);
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState(initialStatusFilter);
  const [selectedCategory, setSelectedCategory] = useState<HazardCategory | 'ALL'>('ALL');
  const [smartSortMode, setSmartSortMode] = useState<SmartSortMode | 'custom'>('urgency');
  const [groupByMode, setGroupByMode] = useState<GroupByMode>('none');
  const [coordFilter, setCoordFilter] = useState<CoordFilterType>('ALL');
  const [isProcedureModalOpen, setIsProcedureModalOpen] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('issued');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Comprehensive Dataset Analysis via warningAnalyzer
  const datasetAnalysis = useMemo(() => analyzeDataset(warnings), [warnings]);
  const { analyzed, analytics } = datasetAnalysis;

  // Shifting / Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(25);

  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: prev[groupKey] === false ? true : false
    }));
  };

  useEffect(() => {
    if (initialStatusFilter) {
      setSelectedStatus(initialStatusFilter);
    }
  }, [initialStatusFilter]);

  useEffect(() => {
    if (initialNavAreaFilter) {
      setSelectedNavArea(initialNavAreaFilter);
    }
  }, [initialNavAreaFilter]);

  // Consume hash-synced route state pushed down from App (deep link, Back /
  // Forward). Absent keys arrive as defaults, so Back resets the view state
  // symmetrically with the URL. sortField is only consulted in custom sort
  // mode; setting it under smart-sort modes is harmless because they ignore it.
  useEffect(() => {
    if (!routeState) return;
    setSearchTerm(routeState.q);
    setCurrentPage(routeState.page);
    if (isSortField(routeState.sort)) {
      setSortField(routeState.sort);
      setSortDirection(routeState.dir);
    }
  }, [routeState]);

  const navareaCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    warnings.forEach((w) => {
      if (w.navarea) {
        counts[w.navarea] = (counts[w.navarea] || 0) + 1;
      }
    });
    return counts;
  }, [warnings]);

  const extraNavAreas = useMemo(() => {
    const knownIds = new Set(ALL_NAVAREAS.map((a) => a.id.toUpperCase()));
    return Object.keys(navareaCounts).filter((na) => !knownIds.has(na.toUpperCase()));
  }, [navareaCounts]);

  const activeCount = useMemo(() => warnings.filter(w => w.status === 'active').length, [warnings]);
  const coordsCount = useMemo(() => warnings.filter(w => hasTrueGeometry(w)).length, [warnings]);
  const criticalCount = useMemo(() => warnings.filter(w => isTierAClean(w)).length, [warnings]);
  const unverifiedCount = useMemo(() => warnings.filter(w => isUnverifiedRow(w)).length, [warnings]);
  // Archived lane count: prefer the dedicated archive dataset, fall back to
  // status-based counting when the archive view is unavailable (offline mode).
  const archivedCount = useMemo(() => archivedWarnings.length > 0
    ? archivedWarnings.length
    : warnings.filter(w => w.status === 'cancelled' || w.status === 'expired' || w.status === 'superseded').length,
    [archivedWarnings, warnings]);

  const recent24hCount = useMemo(() => {
    const now = Date.now();
    return warnings.filter((w) => {
      const dateStr = w.issued_at || w.issued_date;
      if (!dateStr) return false;
      const t = new Date(dateStr).getTime();
      return !isNaN(t) && (now - t) <= 86400000;
    }).length;
  }, [warnings]);

  // Most recent observation across the bank — the honest "last checked" stamp.
  const lastCheckedAt = useMemo(() => {
    let latest = 0;
    warnings.forEach((w) => {
      const dateStr = w.last_seen_at || w.first_seen_at || w.issued_at;
      if (!dateStr) return;
      const t = new Date(dateStr).getTime();
      if (!isNaN(t) && t > latest) latest = t;
    });
    return latest > 0 ? latest : null;
  }, [warnings]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'issued' || field === 'severity' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedNavArea('ALL');
    setSelectedSeverity('ALL');
    setSelectedStatus('ALL');
    setCoordFilter('ALL');
    setCurrentPage(1);
  };

  // 1. Filter analyzed warnings
  const filteredAnalyzed = useMemo(() => {
    return analyzed.filter(item => {
      const w = item.warning;
      if (selectedNavArea !== 'ALL' && w.navarea?.toUpperCase() !== selectedNavArea.toUpperCase()) return false;
      if (selectedStatus === 'archived') {
        // Archive lane: cancelled / expired / superseded records from the
        // backend nav_warnings_archive view. Falls back to plain status
        // matching when the archive dataset is unavailable.
        if (archivedWarnings.length > 0) {
          const inArchive = archivedWarnings.some(a => a.warning_id === w.warning_id);
          if (!inArchive) return false;
        } else if (w.status === 'active' || w.status === 'unverified') {
          return false;
        }
      } else if (selectedStatus !== 'ALL') {
        const sLower = selectedStatus.toLowerCase();
        if (sLower === 'unverified') {
          if (!isUnverifiedRow(w)) return false;
        } else if (w.status !== sLower) {
          return false;
        }
      }
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      // Confidence bands are derived from backend triage signals (parser
      // quality, NOT maritime hazard severity):
      // clean = Tier A + EXPLICIT + no flags; high = any Tier A.
      if (selectedSeverity === 'critical' && !isTierAClean(w)) return false;
      if (selectedSeverity === 'high') {
        const tier = (w as any).triage_tier;
        const inBand = tier === undefined
          ? ((w.extraction_confidence ?? 0) >= 0.8 && (w.extraction_confidence ?? 0) < 1)
          : tier === 'A';
        if (!inBand) return false;
      }

      if (coordFilter === 'with_coords') {
        if (!hasTrueGeometry(w)) return false;
      } else if (coordFilter === 'without_coords') {
        if (hasTrueGeometry(w)) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchId = w.source_warning_id.toLowerCase().includes(q);
        const matchText = w.issued_text.toLowerCase().includes(q);
        const matchTitle = (w.title || '').toLowerCase().includes(q);
        const matchRaw = (w.raw_text || '').toLowerCase().includes(q);
        const matchAreaText = (w.area_text || '').toLowerCase().includes(q);
        const matchArea = `navarea ${w.navarea}`.toLowerCase().includes(q);
        const matchStatus = w.status.toLowerCase().includes(q);
        const matchAuth = item.issuingAuthorityLabel.toLowerCase().includes(q);
        const matchCat = item.categoryMeta.label.toLowerCase().includes(q);
        return matchId || matchText || matchTitle || matchRaw || matchAreaText || matchArea || matchStatus || matchAuth || matchCat;
      }

      return true;
    });
  }, [analyzed, archivedWarnings, selectedNavArea, selectedStatus, selectedCategory, selectedSeverity, coordFilter, searchTerm]);

  // 2. Sort analyzed warnings
  const sortedAnalyzed = useMemo(() => {
    if (smartSortMode !== 'custom') {
      return sortAnalyzedWarnings(filteredAnalyzed, smartSortMode, sortDirection);
    } else {
      const list = filteredAnalyzed.map(i => i.warning);
      const sortedRaw = [...list].sort((a, b) => {
        let cmp = 0;
        if (sortField === 'id') {
          const aNum = parseInt(a.warning_number || '0', 10);
          const bNum = parseInt(b.warning_number || '0', 10);
          const aYr = a.warning_year || 0;
          const bYr = b.warning_year || 0;
          if (aYr !== bYr) {
            cmp = aYr - bYr;
          } else if (!isNaN(aNum) && !isNaN(bNum) && aNum !== bNum) {
            cmp = aNum - bNum;
          } else {
            cmp = a.source_warning_id.localeCompare(b.source_warning_id);
          }
        } else if (sortField === 'area') {
          cmp = (a.navarea || '').localeCompare(b.navarea || '');
        } else if (sortField === 'title') {
          cmp = (a.issued_text || '').localeCompare(b.issued_text || '');
        } else if (sortField === 'severity') {
          cmp = (a.extraction_confidence ?? 0) - (b.extraction_confidence ?? 0);
        } else if (sortField === 'coords') {
          const aHas = hasTrueGeometry(a) ? 1 : 0;
          const bHas = hasTrueGeometry(b) ? 1 : 0;
          cmp = aHas - bHas;
        } else if (sortField === 'issued') {
          const aTime = a.issued_at ? new Date(a.issued_at).getTime() : (a.issued_date ? new Date(a.issued_date).getTime() : 0);
          const bTime = b.issued_at ? new Date(b.issued_at).getTime() : (b.issued_date ? new Date(b.issued_date).getTime() : 0);
          cmp = aTime - bTime;
        } else if (sortField === 'status') {
          cmp = (a.status || '').localeCompare(b.status || '');
        }
        return sortDirection === 'asc' ? cmp : -cmp;
      });
      const map = new Map(filteredAnalyzed.map(i => [i.warning.warning_id, i]));
      return sortedRaw.map(w => map.get(w.warning_id)!).filter(Boolean);
    }
  }, [filteredAnalyzed, smartSortMode, sortDirection, sortField]);

  const sortedWarnings = useMemo(() => sortedAnalyzed.map(i => i.warning), [sortedAnalyzed]);
  const groupedAnalyzed = useMemo(() => {
    if (groupByMode === 'none') return null;
    return groupWarnings(sortedAnalyzed, groupByMode);
  }, [sortedAnalyzed, groupByMode]);

  // 3. Shifting / Pagination Math
  const pageSizeNum = pageSize === 'ALL' ? Math.max(1, sortedWarnings.length) : Number(pageSize);
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(sortedWarnings.length / pageSizeNum));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = pageSize === 'ALL' ? 0 : (validPage - 1) * pageSizeNum;
  const endIndex = pageSize === 'ALL' ? sortedWarnings.length : Math.min(sortedWarnings.length, startIndex + pageSizeNum);
  const paginatedWarnings = useMemo(() => {
    return sortedWarnings.slice(startIndex, endIndex);
  }, [sortedWarnings, startIndex, endIndex]);

  const shiftPrevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const shiftNextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));
  const shiftFirstPage = () => setCurrentPage(1);
  const shiftLastPage = () => setCurrentPage(totalPages);
  const shiftToPage = (p: number) => setCurrentPage(Math.min(Math.max(1, p), totalPages));

  // Keyboard shortcut listener to shift pages: Shift + Left / Right
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault();
        setCurrentPage(p => Math.max(1, p - 1));
      } else if (e.key === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        setCurrentPage(p => Math.min(totalPages, p + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages]);

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    selectedNavArea !== 'ALL' ||
    selectedSeverity !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    coordFilter !== 'ALL'
  );

  const getSortLabel = (field: SortField, label: string) => {
    if (sortField !== field) return `Sort by ${label}`;
    return `Sorted by ${label} (${sortDirection === 'asc' ? 'Ascending' : 'Descending'}) - Click to reverse`;
  };

  const pageNumbers = useMemo<(number | '...')[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (validPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (validPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', validPage - 1, validPage, validPage + 1, '...', totalPages];
  }, [totalPages, validPage]);

  // Mirror the view state up to App so it can write the hash. Skipped on the
  // first run: mount already reflects the deep-linked route, and echoing
  // render-time defaults upward would clobber routeState before it applies.
  const emitReadyRef = useRef(false);
  useEffect(() => {
    if (!onRouteStateChange) return;
    if (!emitReadyRef.current) {
      emitReadyRef.current = true;
      return;
    }
    onRouteStateChange({
      q: searchTerm,
      sort: sortField,
      dir: sortDirection,
      page: validPage,
      navarea: selectedNavArea,
    });
  }, [searchTerm, sortField, sortDirection, validPage, selectedNavArea, onRouteStateChange]);

  // In-Force Status computation for the active NAVAREA filter and pure per-area lookup
  const inForceStatus = useInForceStatus(selectedNavArea, warnings);

  const getInForceStatus = (navarea: string): InForceStatusResult | null => {
    return getInForceStatusForNavarea(navarea, warnings);
  };

  // Cache clearing effect on model lifecycle
  useEffect(() => {
    return () => {
      clearInForceStatusCache();
    };
  }, []);

  return {
    warnings,
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
    setSortField,
    sortDirection,
    setSortDirection,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    datasetAnalysis,
    analyzed,
    analytics,
    navareaCounts,
    extraNavAreas,
    activeCount,
    archivedCount,
    coordsCount,
    criticalCount,
    unverifiedCount,
    recent24hCount,
    lastCheckedAt,
    filteredAnalyzed,
    sortedAnalyzed,
    sortedWarnings,
    groupedAnalyzed,
    totalPages,
    validPage,
    startIndex,
    endIndex,
    paginatedWarnings,
    pageNumbers,
    expandedCards,
    expandedGroups,
    hasActiveFilters,
    toggleExpand,
    toggleGroup,
    handleSort,
    handleResetFilters,
    getSortLabel,
    shiftPrevPage,
    shiftNextPage,
    shiftFirstPage,
    shiftLastPage,
    shiftToPage,
    inForceStatus,
    getInForceStatus,
  };
}


import React, { useState, useMemo, useEffect } from 'react';
import { NavWarning, SourceRegistryItem } from '../types';
import { 
  Database, 
  AlertTriangle, 
  Layers, 
  MapPin, 
  Filter, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Locate, 
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  X,
  Compass,
  Server,
  RotateCw,
  Terminal,
  Radio,
  Sparkles
} from 'lucide-react';
import { formatSpatialCoordinates } from '../utils/coordinateParser';
import { 
  analyzeDataset, 
  sortAnalyzedWarnings, 
  groupWarnings, 
  HAZARD_CATEGORIES, 
  HazardCategory, 
  SmartSortMode, 
  AnalyzedWarning 
} from '../utils/warningAnalyzer';
import { IngestionProcedureModal } from './IngestionProcedureModal';

interface DataBankProps {
  warnings: NavWarning[];
  onLocate: (warning: NavWarning) => void;
  onVerifyWarning?: (warningId: string) => void;
  initialStatusFilter?: string;
  initialNavAreaFilter?: string;
  onTriggerRefresh?: (sourceId?: string) => Promise<void>;
  isRefreshing?: boolean;
  onCommitWarnings?: (newWarnings: NavWarning[]) => void;
  sources?: SourceRegistryItem[];
  isOfflineMode?: boolean;
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
export type SortDirection = 'asc' | 'desc';
export type CoordFilterType = 'ALL' | 'with_coords' | 'without_coords';

export const DataBank: React.FC<DataBankProps> = ({ 
  warnings, 
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNavArea, setSelectedNavArea] = useState(initialNavAreaFilter);
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState(initialStatusFilter);
  const [selectedCategory, setSelectedCategory] = useState<HazardCategory | 'ALL'>('ALL');
  const [smartSortMode, setSmartSortMode] = useState<SmartSortMode | 'custom'>('urgency');
  const [groupByMode, setGroupByMode] = useState<'none' | 'navarea' | 'category' | 'urgency' | 'authority'>('none');
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
  const coordsCount = useMemo(() => warnings.filter(w => (w.spatial?.geometries?.length > 0 || w.spatial?.circles?.length > 0)).length, [warnings]);
  const criticalCount = useMemo(() => warnings.filter(w => w.extraction_confidence >= 0.8).length, [warnings]);
  const unverifiedCount = useMemo(() => warnings.filter(w => w.status === 'unverified' || w.extraction_confidence < 1).length, [warnings]);

  const recent24hCount = useMemo(() => {
    const now = Date.now();
    return warnings.filter((w) => {
      const dateStr = w.issued_at || w.issued_date;
      if (!dateStr) return false;
      const t = new Date(dateStr).getTime();
      return !isNaN(t) && (now - t) <= 86400000;
    }).length;
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
      if (selectedStatus !== 'ALL' && w.status !== selectedStatus.toLowerCase()) return false;
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (selectedSeverity === 'critical' && w.extraction_confidence < 1) return false;
      if (selectedSeverity === 'high' && (w.extraction_confidence >= 1 || w.extraction_confidence < 0.8)) return false;

      if (coordFilter === 'with_coords') {
        if (!item.hasCoordinates) return false;
      } else if (coordFilter === 'without_coords') {
        if (item.hasCoordinates) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchId = w.source_warning_id.toLowerCase().includes(q);
        const matchText = w.issued_text.toLowerCase().includes(q);
        const matchArea = `navarea ${w.navarea}`.toLowerCase().includes(q);
        const matchStatus = w.status.toLowerCase().includes(q);
        const matchAuth = item.issuingAuthorityLabel.toLowerCase().includes(q);
        const matchCat = item.categoryMeta.label.toLowerCase().includes(q);
        return matchId || matchText || matchArea || matchStatus || matchAuth || matchCat;
      }

      return true;
    });
  }, [analyzed, selectedNavArea, selectedStatus, selectedCategory, selectedSeverity, coordFilter, searchTerm]);

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
          const aHas = (a.spatial?.geometries?.length > 0 || a.spatial?.circles?.length > 0) ? 1 : 0;
          const bHas = (b.spatial?.geometries?.length > 0 || b.spatial?.circles?.length > 0) ? 1 : 0;
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

  const pageNumbers = useMemo(() => {
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

  return (
    <div className="flex flex-col gap-6 sm:gap-8 font-mono">
      {/* Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
        <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all shadow-hard shadow-hard-hover">
          <div className="text-xs font-bold uppercase tracking-wider text-gw-accent mb-2 sm:mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 border border-gw-primary rounded flex items-center justify-center shrink-0">
                <Database className="w-3.5 h-3.5 text-gw-primary" />
              </div>
              Total Published
            </div>
            <button
              onClick={() => setIsProcedureModalOpen(true)}
              className="text-[10px] uppercase font-bold text-gw-primary hover:bg-gw-bg px-2 py-0.5 rounded border border-gw-secondary transition-all flex items-center gap-1 cursor-pointer"
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
        
        <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all shadow-hard shadow-hard-hover">
          <div className="text-xs font-bold uppercase tracking-wider text-gw-accent mb-2 sm:mb-4 flex items-center gap-2">
            <div className="w-6 h-6 border border-gw-primary rounded flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-gw-primary" />
            </div>
            Active Warnings
          </div>
          <div className="text-3xl sm:text-4xl md:text-[2.75rem] font-black tracking-tight leading-none mb-2 sm:mb-3 text-gw-primary tabular-nums font-mono flex items-baseline gap-1.5">
            <span>{activeCount.toLocaleString()}</span>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gw-primary bg-gw-bg border border-gw-secondary px-1.5 py-0.5 rounded ml-1">
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
        
        <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all shadow-hard shadow-hard-hover">
          <div className="text-xs font-bold uppercase tracking-wider text-gw-accent mb-2 sm:mb-4 flex items-center gap-2">
            <div className="w-6 h-6 border border-gw-primary rounded flex items-center justify-center shrink-0">
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
        
        <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all shadow-hard shadow-hard-hover">
          <div className="text-xs font-bold uppercase tracking-wider text-gw-accent mb-2 sm:mb-4 flex items-center gap-2">
            <div className="w-6 h-6 border border-gw-primary rounded flex items-center justify-center shrink-0">
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
            className="flex-1 sm:flex-none px-3 py-1.5 bg-white text-gw-primary font-bold uppercase tracking-wider text-[11px] rounded-lg border border-gw-primary hover:bg-gw-bg transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Server className="w-3.5 h-3.5 text-gw-primary" />
            <span>How Data is Taken (Procedure SOP)</span>
          </button>
          {onTriggerRefresh && (
            <button
              onClick={() => onTriggerRefresh()}
              disabled={isRefreshing}
              className="px-3 py-1.5 bg-gw-primary text-white font-bold uppercase tracking-wider text-[11px] rounded-lg border border-gw-primary hover:bg-gw-tertiary transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
              title="Trigger live pipeline fetch from hydrographic endpoints"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Live Feeds'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Executive Operational Brief Card & Category Filter Pills */}
      <div className="bg-white border-2 border-gw-primary rounded-xl p-4 sm:p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gw-secondary/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gw-primary text-white flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gw-primary flex items-center gap-2">
                <span>Executive Operational Brief</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-gw-bg border border-gw-secondary text-gw-accent">
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
              className="bg-gw-bg border border-gw-secondary rounded px-2.5 py-1 text-xs font-bold text-gw-primary outline-none focus:border-gw-primary cursor-pointer"
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
      <div className="flex flex-col gap-3 p-3.5 sm:p-4 bg-white border-2 border-gw-primary rounded-xl shadow-xs">
        {/* Top Controls Row: Search & Dropdowns */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-gw-bg border border-gw-secondary rounded px-3 py-2 focus-within:border-gw-primary">
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
                <option value="critical">Critical Only</option>
                <option value="high">High Confidence</option>
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
                <option value="expiring">Expiring</option>
                <option value="cancelled">Cancelled</option>
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
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gw-bg border border-gw-secondary rounded-lg text-xs font-bold uppercase hover:bg-gw-primary hover:border-gw-primary hover:text-white transition-colors min-h-[38px]"
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

      {groupByMode !== 'none' && groupedAnalyzed ? (
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
                      const isCritical = w.extraction_confidence === 1;

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
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${analyzedItem.categoryMeta.badgeClass}`}>
                                  {analyzedItem.categoryMeta.shortLabel}
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${isCritical ? 'bg-gw-primary' : 'bg-gw-tertiary'}`}>
                                  {isCritical ? 'CRITICAL' : 'HIGH'}
                                </span>
                              </div>
                              <p className="text-xs text-gw-primary font-medium mt-1 line-clamp-1">
                                {w.issued_text}
                              </p>
                              <div className="flex items-center gap-3 text-[11px] text-gw-accent mt-1 font-mono">
                                <span>{analyzedItem.coordinatesDisplay}</span>
                                <span>•</span>
                                <span>Issued: {w.issued_date}</span>
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
      ) : (
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
          <div className="p-8 text-center bg-white border-2 border-gw-primary rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-gw-bg border border-gw-primary text-gw-primary flex items-center justify-center mx-auto">
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
                          <span>{w.issued_date}</span>
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
                            navigator.clipboard.writeText(w.raw_text || w.issued_text);
                          }}
                          className="text-[10px] text-gw-primary hover:text-gw-accent font-bold uppercase underline"
                        >
                          Copy Raw Telemetry
                        </button>
                      </div>
                      <div className="p-2.5 bg-white border border-gw-secondary rounded text-[11px] text-gw-primary font-mono leading-relaxed max-h-36 overflow-y-auto no-scrollbar">
                        {w.raw_text || w.issued_text}
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
      <div className="hidden md:block bg-white border-2 border-gw-primary rounded-2xl overflow-hidden overflow-x-auto shadow-sm">
        {/* Table Header: Selected Element - Interactive Column Sorting */}
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

        {/* Table Body: Paginated Rows */}
        <div className="min-w-[900px] max-h-[520px] overflow-y-auto no-scrollbar">
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
          ) : (
            paginatedWarnings.map((w, idx) => (
              <div 
                key={w.warning_id || w.source_warning_id || idx} 
                className="grid grid-cols-[140px_80px_1fr_90px_130px_110px_90px_60px] p-3 border-b border-gw-secondary text-xs items-center gap-2.5 hover:bg-gw-bg/60 transition-colors cursor-pointer group"
                onClick={() => onLocate(w)}
              >
                <div className="font-bold text-gw-primary group-hover:underline truncate">{w.source_warning_id}</div>
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
                <div className="text-[11px] text-gw-accent whitespace-nowrap">{w.issued_date}</div>
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
      )}

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
    </div>
  );
};



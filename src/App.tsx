import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { Footer } from './components/Footer';
import { LeafletMap } from './components/LeafletMap';
import { DataBankV2 } from './components/DataBankV2';
import { WorkspaceView } from './components/WorkspaceView';
import { SourceRegistryView } from './components/SourceRegistryView';
import { ManualParserView } from './components/ManualParserView';
import { CsvUploaderView } from './components/CsvUploaderView';
import { GenerationInspectorView } from './components/GenerationInspectorView';
import { EvidenceLockerView } from './components/EvidenceLockerView';
import { SupabaseStatusView } from './components/SupabaseStatusView';
import { WarningDetailModal } from './components/WarningDetailModal';
import { WarningEditModal } from './components/WarningEditModal';
import { AdminDataBankTools } from './components/AdminDataBankTools';
import { IngestionProcedureModal } from './components/IngestionProcedureModal';
import { NavWarning, SourceRegistryItem, IngestionGeneration, RawArtifact } from './types';
import { ShieldCheck, RefreshCw, Edit3 } from 'lucide-react';
import {
  INITIAL_WARNINGS,
  INITIAL_SOURCES_REGISTRY,
  INITIAL_GENERATIONS,
  INITIAL_ARTIFACTS,
} from './data/sourcesRegistry';
import {
  fetchSources,
  fetchWarnings,
  fetchGenerations,
  fetchArtifacts,
  triggerPipelineRefresh,
  parseManualWarning,
  fetchArchivedWarnings,
} from './services/api';
import { saveWarningEdit } from './services/warningEditApi';
import { parseCoordinatesDeterministic } from './utils/coordinateParser';
import {
  fetchActiveSpatialRows,
  groupSpatialRowsByCanonicalId,
  subscribeToNavWarnings,
} from './services/navWarningQueries';

export type TabType =
  | 'map'
  | 'databank'
  | 'sources'
  | 'workspace'
  | 'imports'
  | 'manual'
  | 'audit'
  | 'evidence'
  | 'supabase';

const VALID_TABS: TabType[] = ['map', 'databank', 'sources', 'workspace', 'imports', 'manual', 'audit', 'evidence', 'supabase'];

/**
 * 4-section information architecture (2026-10-24). Sections only regroup the
 * nine underlying views (TabType ids unchanged), so every activeTab condition
 * in App.tsx (view visibility, AdminDataBankTools, the Verify Next FAB) and
 * every programmatic cross-link (onLocate -> map, commit -> databank,
 * manual parse -> databank) keeps working without modification.
 */
export type SectionType = 'warnings' | 'ingest' | 'trace' | 'system';

export const SECTION_ORDER: SectionType[] = ['warnings', 'ingest', 'trace', 'system'];

export const SECTION_OF: Record<TabType, SectionType> = {
  map: 'warnings',
  databank: 'warnings',
  workspace: 'ingest',
  sources: 'ingest',
  imports: 'ingest',
  manual: 'ingest',
  audit: 'trace',
  evidence: 'trace',
  supabase: 'system',
};

export const SECTION_VIEWS: Record<SectionType, { id: TabType; label: string }[]> = {
  warnings: [
    { id: 'map', label: 'Map View' },
    { id: 'databank', label: 'Data Bank' },
  ],
  ingest: [
    { id: 'workspace', label: 'Pipeline' },
    { id: 'sources', label: 'Sources' },
    { id: 'imports', label: 'Bulk Import' },
    { id: 'manual', label: 'Manual Parser' },
  ],
  trace: [
    { id: 'audit', label: 'Audit Log' },
    { id: 'evidence', label: 'Evidence' },
  ],
  system: [{ id: 'supabase', label: 'Supabase Server' }],
};

export const DEFAULT_SECTION_TAB: Record<SectionType, TabType> = {
  warnings: 'map',
  ingest: 'workspace',
  trace: 'audit',
  system: 'supabase',
};

/** Canonical second path segment per view (databank -> list, audit -> generations). */
const ROUTE_NAME: Record<TabType, string> = {
  map: 'map',
  databank: 'list',
  workspace: 'pipeline',
  sources: 'sources',
  imports: 'bulk',
  manual: 'manual',
  audit: 'generations',
  evidence: 'evidence',
  supabase: 'supabase',
};

export function tabHash(tab: TabType): string {
  return '#/' + SECTION_OF[tab] + '/' + ROUTE_NAME[tab];
}

/**
 * Hash router. Two-segment "#/<section>/<view>" grammar plus PERMANENT legacy
 * aliases ("#/databank", "#sources", ...) so existing bookmarks, dashboards
 * and the /admin gateway keep resolving. "?status=" deep-links keep working
 * for the Data Bank and Sources views. Unknown segments fall back to Map.
 */
function parseHashRoute(hashStr: string): { tab: TabType; statusFilter?: string } {
  const cleanHash = hashStr.replace(/^#\/?/, '');
  if (!cleanHash) return { tab: 'map' };

  const [pathPart, queryPart] = cleanHash.split('?');
  const segments = pathPart.toLowerCase().split('/').filter(Boolean);
  const [first, second] = segments;

  let tab: TabType | undefined;
  if (first && (SECTION_ORDER as string[]).includes(first)) {
    const section = first as SectionType;
    const match = second
      ? SECTION_VIEWS[section].find((v) => ROUTE_NAME[v.id] === second)
      : undefined;
    tab = match ? match.id : DEFAULT_SECTION_TAB[section];
  } else if (first) {
    // Legacy single-segment route — permanent alias.
    const candidate = first as TabType;
    tab = VALID_TABS.includes(candidate) ? candidate : undefined;
  }

  const params = new URLSearchParams(queryPart || '');
  const statusFilter = params.get('status') || undefined;

  return { tab: tab ?? 'map', statusFilter };
}

export default function App() {
  const initialRoute = typeof window !== 'undefined' ? parseHashRoute(window.location.hash) : { tab: 'map' as TabType };
  const [activeTab, setActiveTab] = useState<TabType>(initialRoute.tab);
  const [selectedWarning, setSelectedWarning] = useState<NavWarning | null>(null);
  const [editingWarning, setEditingWarning] = useState<NavWarning | null>(null);
  const [isolatedWarning, setIsolatedWarning] = useState<NavWarning | null>(null);

  // Admin Access Gate State — never trust client-stored flags:
  // admin mode is granted only by the server-verified session bootstrap
  // in Header (app_metadata.role) or an explicit adminLogin() success.
  const [isAdminMode, setIsAdminModeState] = useState<boolean>(false);

  const setIsAdminMode = useCallback((val: boolean) => {
    setIsAdminModeState(val);
  }, []);

  // Counter bumped by the access gate's "Admin Sign In" button; Header opens
  // the real Supabase login modal whenever it changes.
  const [loginPrompt, setLoginPrompt] = useState(0);

  // Purge legacy client-side authorization / UI flags left by earlier builds:
  // helm_admin_mode and helm_admin_token were trivially spoofable and hwUI
  // forced the retired classic UI path.
  useEffect(() => {
    try {
      localStorage.removeItem('helm_admin_mode');
      localStorage.removeItem('hwUI');
      sessionStorage.removeItem('helm_admin_token');
    } catch { /* private-mode storage can throw */ }
  }, []);

  // Core Data Bank State
  const [warnings, setWarnings] = useState<NavWarning[]>([]);
  const [archivedWarnings, setArchivedWarnings] = useState<NavWarning[]>([]);
  const [sources, setSources] = useState<SourceRegistryItem[]>(INITIAL_SOURCES_REGISTRY);
  const [generations, setGenerations] = useState<IngestionGeneration[]>([]);
  const [artifacts, setArtifacts] = useState<RawArtifact[]>([]);
  const [isPipelineRefreshing, setIsPipelineRefreshing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [isIngestionProcedureOpen, setIsIngestionProcedureOpen] = useState(false);

  // Filter state for navigation deep linking
  const [dataBankStatusFilter, setDataBankStatusFilter] = useState<string>(initialRoute.statusFilter || 'ALL');
  const [sourcesFilterStatus, setSourcesFilterStatus] = useState<string>('ALL');

  // Sync hash routing on window.location.hash change (Back/Forward buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const route = parseHashRoute(window.location.hash);
      setActiveTab(route.tab);
      if (route.statusFilter) {
        setDataBankStatusFilter(route.statusFilter);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update window.location.hash when activeTab or filters change in React
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let newHash = tabHash(activeTab);
    const params = new URLSearchParams();
    if (activeTab === 'databank' && dataBankStatusFilter !== 'ALL') {
      params.set('status', dataBankStatusFilter);
    }
    if (activeTab === 'sources' && sourcesFilterStatus !== 'ALL') {
      params.set('status', sourcesFilterStatus);
    }
    const queryString = params.toString();
    if (queryString) newHash += `?${queryString}`;

    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash);
    }
  }, [activeTab, dataBankStatusFilter, sourcesFilterStatus]);

  const loadData = async () => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      const [apiSources, apiWarnings, apiGens, apiArts, apiArchived] = await Promise.all([
        fetchSources(),
        fetchWarnings(),
        fetchGenerations(),
        fetchArtifacts(),
        fetchArchivedWarnings(),
      ]);

      if (apiSources && apiSources.length > 0) setSources(apiSources);
      let hydrated: NavWarning[] = apiWarnings || [];

      // Hydrate real geometry from the nav_warnings_active_spatial view (Tier A + active).
      // Falls back silently to the raw-text regex geometry if the view is unreachable/empty.
      try {
        const spatialRows = await fetchActiveSpatialRows();
        if (spatialRows.length > 0) {
          const grouped = groupSpatialRowsByCanonicalId(spatialRows);
          const groupedByCanonical = new Map(grouped.map((g) => [g.canonical_id, g]));
          hydrated = hydrated.map((w) => {
            const g = groupedByCanonical.get(w.warning_id);
            if (!g || !g._geometries || g._geometries.length === 0) return w;
            // geojsonBlobToGeometry guarantees { type, coordinates } GeoJSON shapes;
            // cast to the NavWarning SpatialGeometry contract.
            const geometries = g._geometries as unknown as NavWarning['spatial']['geometries'];
            return {
              ...w,
              spatial: {
                geometries,
                circles: [],
                raw_coordinate_text: [],
                validation_status: 'passed' as const,
              },
            };
          });
        }
      } catch (e) {
        console.warn('Spatial view hydration unavailable:', e);
      }

      setWarnings(hydrated);
      setArchivedWarnings(apiArchived || []);
      setGenerations(apiGens || []);
      setArtifacts(apiArts || []);

      setIsOfflineMode(false);
    } catch (err: any) {
      console.warn('Backend API offline, using local state:', err);
      setIsOfflineMode(true);
      setDataError(err.message || 'Failed to fetch live data from Supabase. Falling back to local offline mode.');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Initial Data Fetch with Fallback
  useEffect(() => {
    loadData();
  }, []);

  // Realtime: refresh whenever the backend writes nav_warnings or geometries
  useEffect(() => {
    const sub = subscribeToNavWarnings(() => {
      loadData();
    });
    return () => {
      sub?.unsubscribe();
    };
  }, []);

  const handleNavigateWithFilter = (tab: TabType, filterStatus?: string) => {
    if (tab === 'databank' && filterStatus) {
      setDataBankStatusFilter(filterStatus);
    }
    if (tab === 'sources' && filterStatus) {
      setSourcesFilterStatus(filterStatus);
    }
    setActiveTab(tab);
  };

  const handleVerifyWarning = async (warningId: string) => {
    const applyLocalVerified = () =>
      setWarnings((prev) =>
        prev.map((w) =>
          w.warning_id === warningId || w.source_warning_id === warningId
            ? {
                ...w,
                status: 'active',
                extraction_confidence: 1.0,
                validation: { ...w.validation, geometry: 'passed' },
              }
            : w
        )
      );

    // Audited verification: Quick Verify goes through the admin-guarded E1
    // endpoint (VERIFY audit row) whenever the warning exists server-side.
    // Local-only warnings (offline / manual session) keep local-state behaviour.
    const target = warnings.find((w) => w.warning_id === warningId || w.source_warning_id === warningId);
    const uuid = target ? (target as any).db_uuid : undefined;
    const canonical = target?.warning_id;
    if (!uuid && !canonical) {
      applyLocalVerified();
      return;
    }
    try {
      const res = await saveWarningEdit({
        warningId: uuid || undefined,
        canonicalId: canonical,
        patch: { verify: true, note: 'Quick verify from Data Bank' },
      });
      if (res.ok) applyLocalVerified();
      else console.warn('Audited verify failed - local state left unchanged:', res.error);
    } catch (e) {
      console.warn('Audited verify unreachable - local state left unchanged:', e);
    }
  };

  const unverifiedCandidates = warnings.filter(
    (w) => w.status === 'unverified' || (w.extraction_confidence && w.extraction_confidence < 0.8)
  );
  const currentUnverifiedIndex = selectedWarning
    ? unverifiedCandidates.findIndex((w) => w.warning_id === selectedWarning.warning_id)
    : -1;

  const handleCommitWarnings = async (newWarnings: NavWarning[]) => {
    setWarnings((prev) => [...newWarnings, ...prev]);
    setDataBankStatusFilter('ALL');
    setActiveTab('databank');

    // Also persist to Supabase in the background if connected
    try {
      const { saveImportedWarningsToSupabase } = await import('./services/api');
      await saveImportedWarningsToSupabase(newWarnings);
    } catch (e) {
      console.warn('Background Supabase persistence error:', e);
    }
  };

  const handleToggleSource = (sourceId: string, enabled: boolean) => {
    setSources((prev) =>
      prev.map((s) => (s.source_id === sourceId ? { ...s, enabled } : s))
    );
  };

  const handleTriggerRefresh = async (sourceId?: string) => {
    setIsPipelineRefreshing(true);
    try {
      await triggerPipelineRefresh(sourceId);

      // Reload updated collections from server
      const [apiSources, apiWarnings, apiGens, apiArts, apiArchived] = await Promise.all([
        fetchSources(),
        fetchWarnings(),
        fetchGenerations(),
        fetchArtifacts(),
        fetchArchivedWarnings(),
      ]);

      if (apiSources.length > 0) setSources(apiSources);
      if (apiWarnings.length > 0) setWarnings(apiWarnings);
      setArchivedWarnings(apiArchived || []);
      if (apiGens.length > 0) setGenerations(apiGens);
      if (apiArts.length > 0) setArtifacts(apiArts);
    } catch (err: any) {
      console.error('Pipeline trigger error:', err);
    } finally {
      setIsPipelineRefreshing(false);
    }
  };

  const handleParseManual = async (
    rawText: string,
    navarea: string,
    mode: 'hybrid' | 'llm' | 'regex' | 'jhod_structured' = 'hybrid',
    aiModel: string = 'gemini-3.1-flash-lite'
  ): Promise<{ warning: NavWarning; ai_parsing_failed?: boolean; ai_error?: string | null }> => {
    try {
      const res = await parseManualWarning(rawText, navarea, mode, aiModel);
      if (res.warning) {
        setWarnings((prev) => [res.warning, ...prev]);
        return { warning: res.warning, ai_parsing_failed: res.ai_parsing_failed, ai_error: res.ai_error };
      }
    } catch (err: any) {
      console.warn('Manual API error, using deterministic client parser:', err);
    }

    // Client-side fallback deterministic parsing
    const spatial = parseCoordinatesDeterministic(rawText, navarea as any);
    const nowIso = new Date().toISOString();
    const newWarn: NavWarning = {
      schema_version: 1,
      warning_id: `warn-manual-${Date.now()}`,
      publisher_id: 'manual-entry',
      source_id: 'manual-paste-workflow',
      navarea: navarea as any,
      series: `NAVAREA ${navarea}`,
      source_warning_id: `MANUAL/${new Date().getFullYear()}`,
      warning_number: `${Math.floor(1000 + Math.random() * 9000)}`,
      warning_year: new Date().getFullYear(),
      issued_at: nowIso,
      issued_date: nowIso.split('T')[0],
      issued_time_precision: 'day',
      issued_text: nowIso.split('T')[0],
      valid_from: nowIso,
      valid_to: null,
      cancelled_at: null,
      status: 'active',
      status_basis: 'manual_user_override',
      area_text: 'Manual Override Region',
      original_language: 'en',
      raw_text: rawText,
      translated_text: null,
      spatial,
      supersedes: [],
      cancels: [],
      source_url: 'Manual Paste',
      raw_artifact_ref: 'local-session',
      content_hash: 'hash-' + Date.now(),
      parser_version: 'deterministic-v1',
      extraction_method: 'deterministic',
      extraction_confidence: spatial.geometries.length > 0 ? 0.95 : 0.5,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      not_in_force_observed_at: null,
      generation_id: 'gen-manual-session',
      validation: {
        identity: 'passed',
        dates: 'passed',
        geometry: spatial.validation_status,
      },
    };

    setWarnings((prev) => [newWarn, ...prev]);
    return { warning: newWarn, ai_parsing_failed: true, ai_error: 'Network connection or AI unavailable' };
  };

  const activeCount = warnings.filter((w) => w.status === 'active').length;

  return (
    <div className="min-h-screen bg-gw-bg text-gw-primary font-mono selection:bg-gw-primary selection:text-gw-bg relative pb-20 md:pb-6">
      <a href="#main-content" className="gw-skip-link">
        Skip to main content
      </a>
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeCount={activeCount}
        isAdminMode={isAdminMode}
        setIsAdminMode={setIsAdminMode}
        loginPrompt={loginPrompt}
      />
      {isLoadingData && (
        <div role="status" aria-live="polite" className="bg-blue-100 border-b-2 border-blue-600 px-3 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-mono font-bold text-blue-900 flex items-center justify-between shadow-xs">
          <div className="max-w-[1600px] mx-auto w-full flex items-center gap-2 truncate">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
            <span className="truncate">CONNECTING TO SUPABASE — Fetching latest live navigational warnings...</span>
          </div>
        </div>
      )}
      {dataError && !isLoadingData && (
        <div role="alert" className="bg-red-100 border-b-2 border-red-600 px-3 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-mono font-bold text-red-900 flex items-center justify-between shadow-xs">
          <div className="max-w-[1600px] mx-auto w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-red-600 shrink-0"></span>
              <span className="truncate">SUPABASE SYNC FAILED — {dataError}</span>
            </div>
            <button
              onClick={() => loadData()}
              className="px-2 py-0.5 sm:px-3 sm:py-1 bg-red-600 text-white rounded hover:bg-red-500 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3 h-3" /> Retry Sync
            </button>
          </div>
        </div>
      )}
      {isOfflineMode && !dataError && (
        <div role="status" aria-live="polite" className="bg-amber-100 border-b-2 border-amber-600 px-3 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-mono font-bold text-amber-900 flex items-center justify-between shadow-xs">
          <div className="max-w-[1600px] mx-auto w-full flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse shrink-0"></span>
            <span className="truncate">OFFLINE MODE ACTIVE — Server API unavailable. Operating on synchronized local store.</span>
          </div>
        </div>
      )}
      <DisclaimerBanner />

      <main id="main-content" tabIndex={-1} className="relative z-10 max-w-[1600px] mx-auto p-3 sm:p-6 md:p-8 focus:outline-none">
        {/* Map View (admin-gated) */}
        <div className={isAdminMode && activeTab === 'map' ? 'block' : 'hidden'}>
          <LeafletMap
            warnings={warnings}
            selectedNavArea="ALL"
            sources={sources}
            onSelectWarning={(w) => {
              setSelectedWarning(w);
            }}
            isolatedWarning={isolatedWarning}
            onClearIsolation={() => setIsolatedWarning(null)}
            isAdminMode={isAdminMode}
            selectedWarning={selectedWarning}
            onGeometrySaved={() => loadData()}
            onEditWarning={(w) => setEditingWarning(w)}
          />
        </div>

        {/* Data Bank (admin-gated) */}
        <div className={isAdminMode && activeTab === 'databank' ? 'block' : 'hidden'}>
          {isAdminMode && (
            <div className="mb-3">
              <AdminDataBankTools warnings={warnings} onRefresh={() => loadData()} />
            </div>
          )}
          <DataBankV2
            warnings={warnings}
            archivedWarnings={archivedWarnings}
            initialStatusFilter={dataBankStatusFilter}
            onVerifyWarning={handleVerifyWarning}
            onLocate={(w) => {
              setSelectedWarning(w);
              setActiveTab('map');
            }}
            onTriggerRefresh={handleTriggerRefresh}
            isRefreshing={isPipelineRefreshing}
            onCommitWarnings={handleCommitWarnings}
            sources={sources}
            generations={generations}
            isOfflineMode={isOfflineMode}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        </div>

        {/* Candidate Sources Registry (admin-gated) */}
        <div className={isAdminMode && activeTab === 'sources' ? 'block' : 'hidden'}>
          <SourceRegistryView
            sources={sources}
            initialFilter={sourcesFilterStatus}
            onToggleSource={handleToggleSource}
            onTriggerRefresh={handleTriggerRefresh}
            isRefreshing={isPipelineRefreshing}
          />
        </div>

        {/* Admin Access Gate: the whole console requires an authenticated admin
            session. No tab renders content until Header's server-verified
            session bootstrap or an explicit adminLogin() succeeds. */}
        {!isAdminMode && (
          <div className="bg-white border-2 border-gw-primary rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto my-12 shadow-hard space-y-4">
            <div className="w-12 h-12 rounded-full bg-gw-bg border-2 border-gw-primary text-gw-primary flex items-center justify-center mx-auto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-gw-primary uppercase tracking-wider">Administrative Gate Active</h2>
              <p className="text-xs text-gw-accent leading-relaxed">
                This console is restricted to administrative sessions. Sign in with your Supabase Administrator account to access the map view, data bank, source registry, pipeline ingestion, manual parsing, bulk imports, audit logs, and Supabase server settings.
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <button
                onClick={() => setLoginPrompt((n) => n + 1)}
                className="px-5 py-2 bg-gw-primary text-gw-bg font-bold text-xs uppercase tracking-wider rounded border border-gw-primary hover:bg-gw-tertiary transition-all"
              >
                Admin Sign In
              </button>
            </div>
          </div>
        )}

        {/* Workspace Ingestion Pipeline */}
        <div className={isAdminMode && activeTab === 'workspace' ? 'block' : 'hidden'}>
          <WorkspaceView
            sources={sources}
            warnings={warnings}
            generations={generations}
            supabaseConnected={!isOfflineMode}
            onNavigate={(tab) => setActiveTab(tab)}
            onNavigateWithFilter={handleNavigateWithFilter}
            onSelectWarning={(w) => setSelectedWarning(w)}
          />
        </div>

        {/* Bulk CSV / GPX / S-124 ZIP Import */}
        <div className={isAdminMode && activeTab === 'imports' ? 'block' : 'hidden'}>
          <CsvUploaderView onCommitWarnings={handleCommitWarnings} />
        </div>

        {/* Manual Warning Parser & Override */}
        <div className={isAdminMode && activeTab === 'manual' ? 'block' : 'hidden'}>
          <ManualParserView
            onParseManual={handleParseManual}
            onSelectWarning={(w) => {
              setSelectedWarning(w);
              setActiveTab('databank');
            }}
          />
        </div>

        {/* Generation Audit Log & Atomic Pointers */}
        <div className={isAdminMode && activeTab === 'audit' ? 'block' : 'hidden'}>
          <GenerationInspectorView generations={generations} sources={sources} />
        </div>

        {/* Evidence Locker Object Storage */}
        <div className={isAdminMode && activeTab === 'evidence' ? 'block' : 'hidden'}>
          <EvidenceLockerView artifacts={artifacts} />
        </div>

        {/* Supabase Server Database Hub */}
        <div className={isAdminMode && activeTab === 'supabase' ? 'block' : 'hidden'}>
          <SupabaseStatusView warnings={warnings} artifacts={artifacts} generations={generations} />
        </div>
      </main>

      <Footer />

      {/* Persistent Floating Action Button (FAB) for Data Bank verification (Admin Only) */}
      {isAdminMode && activeTab === 'databank' && unverifiedCandidates.length > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[900] flex items-center gap-2 bg-gw-primary/95 text-gw-bg p-1.5 rounded-full shadow-2xl border-2 border-gw-accent backdrop-blur-md">
          <button
            onClick={() => setSelectedWarning(unverifiedCandidates[0])}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            title="Verify next candidate in queue directly"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verify Next ({unverifiedCandidates.length})</span>
          </button>
        </div>
      )}


      {/* Edit FAB (Admin Only): opens the fully-editable modal for the warning
          currently open in the detail modal. Writes go through the server-side
          admin-guarded /api/admin/warning-edit endpoint. */}
      {isAdminMode && selectedWarning && !editingWarning && (
        <div className="fixed bottom-20 sm:bottom-6 left-4 sm:left-6 z-[900]">
          <button
            onClick={() => setEditingWarning(selectedWarning)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gw-primary hover:bg-gw-accent text-gw-bg rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-2xl border-2 border-gw-accent active:scale-95"
            title="Edit this warning (admin) — type, time/expiry, status, tier, geometry, NAVAREA move"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Warning</span>
          </button>
        </div>
      )}

      {/* Warning Provenance Detail Modal */}
      {selectedWarning && (
        <WarningDetailModal
          warning={selectedWarning}
          onClose={() => setSelectedWarning(null)}
        />
      )}

      {/* Fully-Editable Admin Warning Modal (Phase E1) */}
      {editingWarning && (
        <WarningEditModal
          warning={editingWarning}
          onClose={() => setEditingWarning(null)}
          onSaved={(result, original) => {
            if (result.moved && result.superseded) {
              // NAVAREA move: supersede + recreate — reload everything.
              setEditingWarning(null);
              setSelectedWarning(null);
              loadData();
              return;
            }
            // Field-level edit: patch the local row so the UI updates in place.
            const updated = result.warning || {};
            setWarnings((prev) =>
              prev.map((w) =>
                w.warning_id === original.warning_id || w.source_warning_id === original.warning_id
                  ? { ...w, ...updated }
                  : w
              )
            );
            setEditingWarning(null);
          }}
        />
      )}
        {/* Ingestion Procedure Modal - placeholder */}
    </div>
  );
}

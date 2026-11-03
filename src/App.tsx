import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  deriveExtractionConfidence,
  mapSupabaseRowToNavWarning,
} from './services/api';
import { saveWarningEdit } from './services/warningEditApi';
import { parseCoordinatesDeterministic } from './utils/coordinateParser';
import {
  fetchActiveSpatialRows,
  fetchUnverifiedSpatialRows,
  groupSpatialRowsByCanonicalId,
  subscribeToNavWarnings,
  fetchSingleWarning,
} from './services/navWarningQueries';

// Route grammar (sections, views, legacy aliases, Data Bank query params) lives
// in ./lib/consoleRoute as pure, unit-testable functions. Re-exported here so
// existing `import { ... } from './App'` sites (Header) keep resolving.
export {
  SECTION_ORDER,
  SECTION_OF,
  SECTION_VIEWS,
  DEFAULT_SECTION_TAB,
  tabHash,
  parseHashRoute,
  buildConsoleHash,
  databankRouteFromRoute,
  databankRouteEqual,
  DEFAULT_DATABANK_ROUTE,
  type TabType,
  type SectionType,
  type DataBankRouteState,
  type ParsedRoute,
} from './lib/consoleRoute';
import {
  parseHashRoute,
  buildConsoleHash,
  databankRouteFromRoute,
  databankRouteEqual,
  type TabType,
  type DataBankRouteState,
} from './lib/consoleRoute';

export default function App() {
  const initialRoute = typeof window !== 'undefined' ? parseHashRoute(window.location.hash) : { tab: 'map' as TabType };
  const [activeTab, setActiveTab] = useState<TabType>(initialRoute.tab);
  const [selectedWarning, setSelectedWarning] = useState<NavWarning | null>(null);
  const [editingWarning, setEditingWarning] = useState<NavWarning | null>(null);
  /** Edited warning to pulse on the map for ~3s after Supabase confirms the save. */
  const [recentlySaved, setRecentlySaved] = useState<{ id: string; at: number } | null>(null);
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

  // Deep-linkable Data Bank view state (search/sort/dir/page/NAVAREA), seeded
  // from the entry hash and re-synced by the hashchange handler below.
  const [databankRouteState, setDatabankRouteState] = useState<DataBankRouteState>(() =>
    databankRouteFromRoute(initialRoute)
  );

  // Equality guard: identical view state must not create a new object, or the
  // hash-writing effect would rewrite the URL on every unrelated render.
  const handleDatabankStateChange = useCallback((next: DataBankRouteState) => {
    setDatabankRouteState((prev) => (databankRouteEqual(prev, next) ? prev : next));
  }, []);

  // Sync hash routing on window.location.hash change (Back/Forward buttons).
  // Symmetric with buildConsoleHash: absent keys reset to their defaults, and
  // each view consumes only the filters it owns, so Back out of a filtered
  // view clears the filter instead of leaving it stale.
  useEffect(() => {
    const handleHashChange = () => {
      const route = parseHashRoute(window.location.hash);
      setActiveTab(route.tab);
      if (route.tab === 'databank') {
        setDataBankStatusFilter(route.statusFilter || 'ALL');
        setDatabankRouteState(databankRouteFromRoute(route));
      } else if (route.tab === 'sources') {
        setSourcesFilterStatus(route.statusFilter || 'ALL');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Write the canonical hash whenever route state changes. A genuine view
  // switch pushes a real history entry so Back/Forward walk views; in-view
  // edits (filter/search/sort/page) replace the current entry so they do not
  // spam history. prevTabRef tells the two cases apart.
  const prevTabRef = useRef<TabType>(initialRoute.tab);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const newHash = buildConsoleHash(activeTab, {
      statusFilter:
        activeTab === 'databank' ? dataBankStatusFilter
        : activeTab === 'sources' ? sourcesFilterStatus
        : undefined,
      databank: databankRouteState,
    });

    if (window.location.hash !== newHash) {
      const pushed = prevTabRef.current !== activeTab;
      window.history[pushed ? 'pushState' : 'replaceState'](null, '', newHash);
    }
    prevTabRef.current = activeTab;
  }, [activeTab, dataBankStatusFilter, sourcesFilterStatus, databankRouteState]);

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

      // First paint: publish the light nav_warnings list immediately so the
      // Data Bank renders before the (heaviest) spatial view query resolves.
      setWarnings(apiWarnings || []);
      setArchivedWarnings(apiArchived || []);
      setGenerations(apiGens || []);
      setArtifacts(apiArts || []);
      setIsOfflineMode(false);

      // Hydrate real geometry from the Tier A active_spatial view and the Tier B
      // Falls back silently to the raw-text regex geometry if the view is unreachable/empty.
      // Fired without await so it never blocks the list render above; the
      // functional setWarnings patch only touches rows still present in
      // current state, so it cannot clobber a newer realtime reload.
      void (async () => {
        try {
          const [spatialRows, unverifiedRows] = await Promise.all([
            fetchActiveSpatialRows(),
            fetchUnverifiedSpatialRows(),
          ]);
          if (spatialRows.length + unverifiedRows.length > 0) {
            const grouped = groupSpatialRowsByCanonicalId([...spatialRows, ...unverifiedRows]);
            const groupedByCanonical = new Map(grouped.map((g) => [g.canonical_id, g]));
            setWarnings((prev) =>
              prev.map((w) => {
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
              })
            );
          }
        } catch (e) {
          console.warn('Spatial view hydration unavailable:', e);
        }
      })();
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

  // Realtime: refresh the CHANGED warning when the backend writes
  // nav_warnings or geometries. The subscription coalesces event bursts (a
  // geometry save is a delete+insert pair) with a trailing debounce and passes
  // the changed row's identity, so an admin edit repaints from a single-
  // warning refetch instead of a full-dataset reload. Unknown identities
  // (scraper bulk writes) fall back to the full reload.
  const warningsRef = useRef<NavWarning[]>([]);
  warningsRef.current = warnings;
  useEffect(() => {
    const sub = subscribeToNavWarnings((info) => {
      const canonical =
        info.canonicalId ||
        (info.warningId
          ? warningsRef.current.find((w) => (w as any).db_uuid === info.warningId)?.warning_id
          : undefined);
      if (canonical) {
        void refreshSingleWarning(canonical);
      } else {
        loadData();
      }
    });
    return () => {
      sub?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Refetches one warning (master row + geometries) and repaints it in place
   * through the same mapper the initial load uses, so the result matches a
   * full reload for that row. Patching selectedWarning keeps an open detail
   * modal in sync; editingWarning is deliberately untouched so a save-induced
   * repaint never resets the admin's in-progress edit form.
   */
  const refreshSingleWarning = async (canonicalId: string) => {
    const { row, geometries } = await fetchSingleWarning(canonicalId);
    if (!row) return;
    const mapped = mapSupabaseRowToNavWarning(
      geometries.length > 0 ? { ...row, _geometries: geometries } : row,
      'active'
    );
    const replace = (w: NavWarning) =>
      w.warning_id === canonicalId || w.source_warning_id === canonicalId ? mapped : w;
    setWarnings((prev) => prev.map(replace));
    setSelectedWarning((prev) => (prev ? replace(prev) : prev));
  };

  const handleNavigateWithFilter = (tab: TabType, filterStatus?: string) => {
    if (tab === 'databank' && filterStatus) {
      setDataBankStatusFilter(filterStatus);
    }
    if (tab === 'sources' && filterStatus) {
      setSourcesFilterStatus(filterStatus);
    }
    setActiveTab(tab);
  };

  const handleVerifyWarning = async (warningId: string): Promise<{ ok: boolean; error?: string }> => {
    // Server-truth repaint (console-ux-68 follow-up): the E1 verify endpoint
    // appends the 'verified_by_admin' qa_flag and returns the stored row
    // (status, triage_tier, data_quality, qa_flags) - it never changes status,
    // confidence or geometry. Mirror exactly those fields here and re-derive
    // extraction_confidence with the same rules fetchWarnings uses, instead of
    // fabricating status 'active' / confidence 1.0 / geometry 'passed', which
    // could contradict the server and would be reverted by the next realtime
    // reload anyway. A verified row may therefore still look like a review
    // candidate under the confidence heuristic (e.g. Tier B -> 0.6); that is
    // deliberate until verify's effect on tier/quality is decided server-side.
    const applyServerTruth = (serverRow: any) =>
      setWarnings((prev) =>
        prev.map((w) =>
          w.warning_id === warningId || w.source_warning_id === warningId
            ? {
                ...w,
                status: serverRow?.status ?? w.status,
                triage_tier: serverRow?.triage_tier ?? w.triage_tier,
                data_quality: serverRow?.data_quality ?? w.data_quality,
                qa_flags: Array.isArray(serverRow?.qa_flags) ? serverRow.qa_flags : w.qa_flags,
                extraction_confidence: serverRow?.triage_tier
                  ? deriveExtractionConfidence(serverRow, serverRow.status || w.status)
                  : w.extraction_confidence,
              }
            : w
        )
      );

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
      return { ok: true };
    }
    try {
      const res = await saveWarningEdit({
        warningId: uuid || undefined,
        canonicalId: canonical,
        patch: { verify: true, note: 'Quick verify from Data Bank' },
      });
      if (res.ok) {
        applyServerTruth(res.warning);
        return { ok: true };
      }
      console.warn('Audited verify failed - local state left unchanged:', res.error);
      return { ok: false, error: res.error };
    } catch (e: any) {
      console.warn('Audited verify unreachable - local state left unchanged:', e);
      return { ok: false, error: e?.message || 'Verify request failed' };
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
  const isMapView = isAdminMode && activeTab === 'map';

  return (
    <div
      className={`min-h-screen bg-gw-bg text-gw-primary font-sans selection:bg-gw-primary selection:text-gw-bg relative ${
        isMapView ? 'h-[100dvh] flex flex-col overflow-hidden pb-0' : 'pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6'
      }`}
    >
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
        <div role="status" aria-live="polite" className="bg-surface-subtle border-b border-hairline px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] font-sans font-medium text-ink-secondary flex items-center justify-between">
          <div className="max-w-[var(--max-width,1180px)] mx-auto w-full flex items-center gap-2 truncate">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent shrink-0" />
            <span className="truncate">Connecting to Supabase — fetching live navigational warnings...</span>
          </div>
        </div>
      )}
      {dataError && !isLoadingData && (
        <div role="alert" className="bg-surface-subtle border-b border-hairline px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] font-sans font-medium text-sev-critical flex items-center justify-between">
          <div className="max-w-[var(--max-width,1180px)] mx-auto w-full flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-sev-critical shrink-0"></span>
              <span className="truncate">Supabase sync notice — {dataError}</span>
            </div>
            <button
              onClick={() => loadData()}
              className="btn btn-sm btn-secondary text-xs flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3 h-3" /> Retry sync
            </button>
          </div>
        </div>
      )}
      {isOfflineMode && !dataError && (
        <div role="status" aria-live="polite" className="bg-surface-subtle border-b border-hairline px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] font-sans font-medium text-ink-secondary flex items-center justify-between">
          <div className="max-w-[var(--max-width,1180px)] mx-auto w-full flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-sev-high animate-pulse shrink-0"></span>
            <span className="truncate">Offline mode active — operating on synchronized local store.</span>
          </div>
        </div>
      )}
      <DisclaimerBanner />

      <main
        id="main-content"
        tabIndex={-1}
        className={
          isMapView
            ? 'relative z-10 flex-1 min-h-0 w-full flex flex-col overflow-hidden focus:outline-none p-2 sm:p-3 md:p-4 max-w-[var(--max-width,1180px)] mx-auto'
            : 'relative z-10 max-w-[var(--max-width,1180px)] mx-auto p-3 sm:p-6 md:p-8 focus:outline-none'
        }
      >
        {/* Map View (admin-gated) */}
        <div className={isMapView ? 'flex-1 min-h-0 flex flex-col h-full w-full' : 'hidden'}>
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
            onGeometrySaved={() => {
              if (selectedWarning) {
                void refreshSingleWarning(selectedWarning.warning_id);
                setRecentlySaved({ id: selectedWarning.warning_id, at: Date.now() });
              }
            }}
            recentlySaved={recentlySaved}
            onEditWarning={(w) => setEditingWarning(w)}
            isVisible={isMapView}
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
            isLoading={isLoadingData}
            initialStatusFilter={dataBankStatusFilter}
            initialNavAreaFilter={databankRouteState.navarea}
            routeState={databankRouteState}
            onRouteStateChange={handleDatabankStateChange}
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
          <div className="bg-gw-panel border border-gw-secondary rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto my-12 shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-full bg-gw-secondary border border-gw-secondary text-gw-primary flex items-center justify-center mx-auto shadow-2xs">
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
                className="btn btn-primary px-6 py-2.5 text-xs uppercase font-bold tracking-wider"
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
            isIngestionProcedureOpen={isIngestionProcedureOpen}
            setIsIngestionProcedureOpen={setIsIngestionProcedureOpen}
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
      {isAdminMode && activeTab === 'databank' && unverifiedCandidates.length > 0 && !selectedWarning && !editingWarning && !isIngestionProcedureOpen && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-console-fab flex items-center gap-2 bg-gw-primary/95 text-gw-bg p-1.5 rounded-full shadow-2xl border-2 border-gw-accent backdrop-blur-md">
          <button
            onClick={() => setSelectedWarning(unverifiedCandidates[0])}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            title="Open next unverified warning for review"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Review Next ({unverifiedCandidates.length})</span>
          </button>
        </div>
      )}

      {/* Edit FAB (Admin Only): opens the fully-editable modal for the warning
          currently open in the detail modal. Writes go through the server-side
          admin-guarded /api/admin/warning-edit endpoint. */}
      {isAdminMode && selectedWarning && !editingWarning && !isIngestionProcedureOpen && (
        <div className="hidden md:block fixed bottom-20 sm:bottom-6 left-4 sm:left-6 z-console-fab">
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
          onVerify={handleVerifyWarning}
          onEditWarning={(w) => setEditingWarning(w)}
          onIsolateWarning={setIsolatedWarning}
          isIsolated={
            !!isolatedWarning && isolatedWarning.warning_id === selectedWarning.warning_id
          }
          onClearIsolation={() => setIsolatedWarning(null)}
          hasPrevious={currentUnverifiedIndex > 0}
          onPrevious={
            currentUnverifiedIndex > 0
              ? () => setSelectedWarning(unverifiedCandidates[currentUnverifiedIndex - 1])
              : undefined
          }
          hasNext={
            currentUnverifiedIndex >= 0 &&
            currentUnverifiedIndex < unverifiedCandidates.length - 1
          }
          onNext={
            currentUnverifiedIndex >= 0 &&
            currentUnverifiedIndex < unverifiedCandidates.length - 1
              ? () => setSelectedWarning(unverifiedCandidates[currentUnverifiedIndex + 1])
              : undefined
          }
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
            // Field-level edit: repaint the row from server truth through the
            // same mapper the initial load uses. Geometry is taken from the
            // rows the server just read back (saved_geometries); when geometry
            // was not part of the edit, the existing map shape is kept so a
            // title/status edit can never blank the pin.
            if (!result.warning) {
              setEditingWarning(null);
              loadData();
              return;
            }
            const savedGeoms = (result.saved_geometries || [])
              .map((g: any) =>
                g?.geojson_blob?.type
                  ? {
                      type: g.geojson_blob.type,
                      coordinates: g.geojson_blob.coordinates,
                      label: g.zone_label,
                      buffer_nm: Number(g.buffer_nm) || 0,
                    }
                  : null
              )
              .filter(Boolean);
            const mapped = mapSupabaseRowToNavWarning(
              savedGeoms.length > 0 ? { ...result.warning, _geometries: savedGeoms } : result.warning,
              'active'
            );
            const repainted =
              result.geometry === 'unchanged'
                ? { ...(mapped as any), spatial: original.spatial }
                : mapped;
            const replace = (w: NavWarning) =>
              w.warning_id === original.warning_id || w.source_warning_id === original.warning_id
                ? repainted
                : w;
            setWarnings((prev) => prev.map(replace));
            setSelectedWarning((prev) => (prev ? replace(prev) : prev));
            setRecentlySaved({ id: repainted.warning_id, at: Date.now() });
            setEditingWarning(null);
          }}
        />
      )}

      {/* Ingestion Procedure Modal */}
      <IngestionProcedureModal
        isOpen={isIngestionProcedureOpen}
        onClose={() => setIsIngestionProcedureOpen(false)}
        warningsCount={warnings.length}
        sources={sources}
        onTriggerRefresh={handleTriggerRefresh}
        isRefreshing={isPipelineRefreshing}
        onCommitWarning={(w) => handleCommitWarnings([w])}
      />
    </div>
  );
}

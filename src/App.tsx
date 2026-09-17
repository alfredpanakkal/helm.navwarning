import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { Footer } from './components/Footer';
import { LeafletMap } from './components/LeafletMap';
import { DataBank } from './components/DataBank';
import { WorkspaceView } from './components/WorkspaceView';
import { SourceRegistryView } from './components/SourceRegistryView';
import { ManualParserView } from './components/ManualParserView';
import { CsvUploaderView } from './components/CsvUploaderView';
import { GenerationInspectorView } from './components/GenerationInspectorView';
import { EvidenceLockerView } from './components/EvidenceLockerView';
import { SupabaseStatusView } from './components/SupabaseStatusView';
import { WarningDetailModal } from './components/WarningDetailModal';
import { PipelineConsoleModal, ConsoleLogEntry } from './components/PipelineConsoleModal';
import { NavWarning, SourceRegistryItem, IngestionGeneration, RawArtifact } from './types';
import { ShieldCheck, RefreshCw } from 'lucide-react';
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
} from './services/api';
import { parseCoordinatesDeterministic } from './utils/coordinateParser';

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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const [selectedWarning, setSelectedWarning] = useState<NavWarning | null>(null);

  // Admin Access Gate State
  const [isAdminMode, setIsAdminModeState] = useState<boolean>(() => {
    return localStorage.getItem('helm_admin_mode') === 'true';
  });

  const setIsAdminMode = (val: boolean) => {
    setIsAdminModeState(val);
    localStorage.setItem('helm_admin_mode', String(val));
  };

  // Core Data Bank State
  const [warnings, setWarnings] = useState<NavWarning[]>(INITIAL_WARNINGS);
  const [sources, setSources] = useState<SourceRegistryItem[]>(INITIAL_SOURCES_REGISTRY);
  const [generations, setGenerations] = useState<IngestionGeneration[]>(INITIAL_GENERATIONS);
  const [artifacts, setArtifacts] = useState<RawArtifact[]>(INITIAL_ARTIFACTS);
  const [isPipelineRefreshing, setIsPipelineRefreshing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Terminal Console State
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([
    {
      id: 'log-init',
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      message: 'NAVWARN CLI Pipeline Environment loaded. Ready for ingestion runs.',
    },
  ]);

  const addConsoleLog = (
    level: ConsoleLogEntry['level'],
    message: string,
    details?: any
  ) => {
    const newEntry: ConsoleLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      details,
    };
    setConsoleLogs((prev) => [...prev, newEntry]);
  };

  // Initial Data Fetch with Fallback
  useEffect(() => {
    async function loadData() {
      try {
        const [apiSources, apiWarnings, apiGens, apiArts] = await Promise.all([
          fetchSources(),
          fetchWarnings(),
          fetchGenerations(),
          fetchArtifacts(),
        ]);

        if (apiSources.length > 0) setSources(apiSources);
        if (apiWarnings.length > 0) setWarnings(apiWarnings);
        if (apiGens.length > 0) setGenerations(apiGens);
        if (apiArts.length > 0) setArtifacts(apiArts);
        setIsOfflineMode(false);
      } catch (err) {
        console.warn('Backend API offline, using local state:', err);
        setIsOfflineMode(true);
      }
    }
    loadData();
  }, []);

  // Handlers for state updates across views
  // Filter state for navigation deep linking
  const [dataBankStatusFilter, setDataBankStatusFilter] = useState<string>('ALL');
  const [sourcesFilterStatus, setSourcesFilterStatus] = useState<string>('ALL');

  const handleNavigateWithFilter = (tab: TabType, filterStatus?: string) => {
    if (tab === 'databank' && filterStatus) {
      setDataBankStatusFilter(filterStatus);
    }
    if (tab === 'sources' && filterStatus) {
      setSourcesFilterStatus(filterStatus);
    }
    setActiveTab(tab);
  };

  const handleVerifyWarning = (warningId: string) => {
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
  };

  const unverifiedCandidates = warnings.filter(
    (w) => w.status === 'unverified' || (w.extraction_confidence && w.extraction_confidence < 0.8)
  );
  const currentUnverifiedIndex = selectedWarning
    ? unverifiedCandidates.findIndex((w) => w.warning_id === selectedWarning.warning_id)
    : -1;

  const handleCommitWarnings = (newWarnings: NavWarning[]) => {
    setWarnings((prev) => [...newWarnings, ...prev]);
    setDataBankStatusFilter('unverified');
    setActiveTab('databank');
  };

  const handleToggleSource = (sourceId: string, enabled: boolean) => {
    setSources((prev) =>
      prev.map((s) => (s.source_id === sourceId ? { ...s, enabled } : s))
    );
  };

  const handleTriggerRefresh = async (sourceId?: string) => {
    setIsConsoleOpen(true);
    setIsPipelineRefreshing(true);

    addConsoleLog('cmd', `run ${sourceId || ''}`);
    addConsoleLog('info', `Triggering pipeline ingestion for ${sourceId ? `source ${sourceId}` : 'all enabled sources'}...`);

    try {
      const result = await triggerPipelineRefresh(sourceId);

      // Render real events emitted by backend engine
      if (result.run && Array.isArray(result.run.events)) {
        for (const ev of result.run.events) {
          const levelMap: Record<string, ConsoleLogEntry['level']> = {
            FETCH: 'fetch',
            PARSE: 'parser',
            EXTRACT: 'parser',
            CHECK: 'info',
            SAVE: 'supabase',
            DONE: 'success',
            ERROR: 'error',
          };
          addConsoleLog(levelMap[ev.stage] || 'info', `[${ev.stage}] ${ev.message}`, ev.details);
        }
      }

      // Reload updated collections from server
      const [apiSources, apiWarnings, apiGens, apiArts] = await Promise.all([
        fetchSources(),
        fetchWarnings(),
        fetchGenerations(),
        fetchArtifacts(),
      ]);

      if (apiSources.length > 0) setSources(apiSources);
      if (apiWarnings.length > 0) setWarnings(apiWarnings);
      if (apiGens.length > 0) setGenerations(apiGens);
      if (apiArts.length > 0) setArtifacts(apiArts);

      if (result.run) {
        // Collect all extracted NAV warning numbers across results
        const allExtractedNavWarningNumbers = (result.results || [])
          .flatMap((r: any) => r.parsed_warning_numbers || [])
          .filter(Boolean);

        const failedSourceResults = (result.results || []).filter((r: any) => r.status === 'failed');

        if (failedSourceResults.length > 0) {
          const failureDetails = failedSourceResults
            .map((f: any) => `• Source [${f.source_id}] (${f.publisher_name || 'Authority'}): ${f.reason || 'Execution failed'}`)
            .join('\n');

          addConsoleLog(
            'error',
            `PIPELINE FAILURE DETECTED: ${failedSourceResults.length} source(s) failed during execution.`,
            `DETAILED FAILURE DIAGNOSTICS:\n\n${failureDetails}\n\nTroubleshooting Instructions:\n1. Verify target source URL accessibility and SSL certificates.\n2. Confirm endpoint query parameters and payload format.\n3. Check server rate limits or network connectivity.`
          );
        }

        const summaryMsg =
          `PIPELINE RUN ${result.run.run_id} SUMMARY (${result.run.status})\n\n` +
          `• Status             ${result.run.status}\n` +
          `• Records Found      ${result.run.records_found}\n` +
          `• Records Stored     ${result.run.records_stored}\n` +
          `• Records Updated    ${result.run.records_updated}\n` +
          `• Records Unchanged  ${result.run.records_unchanged}\n` +
          `• Records Failed     ${result.run.records_failed}\n\n` +
          `PARSED NAV WARNING NUMBER(S):\n` +
          (allExtractedNavWarningNumbers.length > 0
            ? Array.from(new Set(allExtractedNavWarningNumbers)).map((num: any) => `  - NAVWARN #${num}`).join('\n')
            : `  (No NAV warning numbers extracted)`);

        addConsoleLog(
          result.run.status === 'SUCCESS' ? 'success' : result.run.status === 'PARTIAL' ? 'warn' : 'error',
          summaryMsg
        );
      } else {
        addConsoleLog('success', result.message || 'Pipeline execution completed.');
      }
    } catch (err: any) {
      addConsoleLog(
        'error',
        `PIPELINE EXECUTION FAILED: ${err?.message || 'Server or network error'}.`,
        `Context & Diagnostics:\n` +
        `• Target: Ingestion Pipeline Trigger (/api/pipeline/trigger)\n` +
        `• Failure Reason: ${err?.message || 'Network disconnected or endpoint returned HTTP error'}\n` +
        `• Required Action: Ensure server process is active and valid administrative key is provided.`
      );
    } finally {

      setIsPipelineRefreshing(false);
    }
  };

  const handleParseManual = async (rawText: string, navarea: string, mode: 'hybrid' | 'llm' | 'regex' = 'hybrid', aiModel: string = 'gemini-2.5-flash-lite'): Promise<NavWarning> => {
    try {
      const res = await parseManualWarning(rawText, navarea, mode, aiModel);
      if (res.warning) {
        setWarnings((prev) => [res.warning, ...prev]);
        return res.warning;
      }
    } catch (err) {
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
    return newWarn;
  };

  const activeCount = warnings.filter((w) => w.status === 'active').length;

  return (
    <div className="min-h-screen bg-gw-bg text-gw-primary font-mono selection:bg-gw-primary selection:text-gw-bg relative pb-20 md:pb-6">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeCount={activeCount}
        onRefreshPipeline={() => handleTriggerRefresh()}
        isRefreshing={isPipelineRefreshing}
        onOpenConsole={() => setIsConsoleOpen(true)}
        isAdminMode={isAdminMode}
        setIsAdminMode={setIsAdminMode}
      />
      {isOfflineMode && (
        <div className="bg-amber-100 border-b-2 border-amber-600 px-4 py-2 text-xs font-mono font-bold text-amber-900 flex items-center justify-between shadow-xs">
          <div className="max-w-[1600px] mx-auto w-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
            <span>OFFLINE MODE ACTIVE — Server API unavailable. Operating on synchronized local client store.</span>
          </div>
        </div>
      )}
      <DisclaimerBanner />

      <main className="relative z-10 max-w-[1600px] mx-auto p-3 sm:p-6 md:p-8">
        {/* Map View */}
        <div className={activeTab === 'map' ? 'block' : 'hidden'}>
          <LeafletMap
            warnings={warnings}
            selectedNavArea="ALL"
            onSelectWarning={(w) => {
              setSelectedWarning(w);
            }}
          />
        </div>

        {/* Data Bank */}
        <div className={activeTab === 'databank' ? 'block' : 'hidden'}>
          <DataBank
            warnings={warnings}
            initialStatusFilter={dataBankStatusFilter}
            onVerifyWarning={handleVerifyWarning}
            onLocate={(w) => {
              setSelectedWarning(w);
              setActiveTab('map');
            }}
          />
        </div>

        {/* Candidate Sources Registry */}
        <div className={activeTab === 'sources' ? 'block' : 'hidden'}>
          <SourceRegistryView
            sources={sources}
            initialFilter={sourcesFilterStatus}
            onToggleSource={handleToggleSource}
            onTriggerRefresh={handleTriggerRefresh}
            isRefreshing={isPipelineRefreshing}
          />
        </div>

        {/* Admin Access Gate fallback for locked operational views */}
        {!isAdminMode && ['workspace', 'imports', 'manual', 'audit', 'evidence', 'supabase'].includes(activeTab) && (
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
                This operational tool is restricted to administrative sessions. Unlock Admin Mode in the navigation bar header to view and interact with pipeline ingestion, manual parsing, bulk imports, audit logs, and Supabase server settings.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => setActiveTab('map')}
                className="px-4 py-2 border border-gw-secondary text-gw-accent hover:text-gw-primary rounded text-xs font-bold uppercase"
              >
                Return to Map
              </button>
              <button
                onClick={() => setIsAdminMode(true)}
                className="px-5 py-2 bg-gw-primary text-gw-bg font-bold text-xs uppercase tracking-wider rounded border border-gw-primary hover:bg-gw-tertiary transition-all"
              >
                Unlock Admin Tools
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
            onTriggerRefresh={handleTriggerRefresh}
            isRefreshing={isPipelineRefreshing}
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


      {/* Warning Provenance Detail Modal */}
      {selectedWarning && (
        <WarningDetailModal
          warning={selectedWarning}
          onClose={() => setSelectedWarning(null)}
          onVerify={() => handleVerifyWarning(selectedWarning.warning_id)}
          onNext={
            currentUnverifiedIndex >= 0 && currentUnverifiedIndex < unverifiedCandidates.length - 1
              ? () => setSelectedWarning(unverifiedCandidates[currentUnverifiedIndex + 1])
              : undefined
          }
          onPrevious={
            currentUnverifiedIndex > 0
              ? () => setSelectedWarning(unverifiedCandidates[currentUnverifiedIndex - 1])
              : undefined
          }
          hasNext={currentUnverifiedIndex >= 0 && currentUnverifiedIndex < unverifiedCandidates.length - 1}
          hasPrevious={currentUnverifiedIndex > 0}
        />
      )}

      {/* CLI Pipeline Console Modal */}
      <PipelineConsoleModal
        isOpen={isConsoleOpen}
        onClose={() => setIsConsoleOpen(false)}
        logs={consoleLogs}
        onTriggerRefresh={handleTriggerRefresh}
        isRefreshing={isPipelineRefreshing}
        onClearLogs={() => setConsoleLogs([])}
        warnings={warnings}
        sources={sources}
        addConsoleLog={addConsoleLog}
      />
    </div>
  );
}


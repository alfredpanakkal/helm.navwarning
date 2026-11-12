import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, RefreshCw, Download, CheckCircle2, AlertTriangle, Server, Key, Layers, FileCode, Copy, Check, Bot, Sparkles, Send, Terminal, Zap, Lock } from 'lucide-react';
import { NavWarning, IngestionGeneration, RawArtifact } from '../types';
import { fetchSupabaseStatus, triggerSupabaseSync, testGeminiIntegration } from '../services/api';

interface SupabaseStatusViewProps {
  warnings: NavWarning[];
  artifacts: RawArtifact[];
  generations: IngestionGeneration[];
}

export const SupabaseStatusView: React.FC<SupabaseStatusViewProps> = ({
  warnings,
  artifacts,
  generations,
}) => {
  const [status, setStatus] = useState<{
    connected: boolean;
    url: string | null;
    counts?: { warnings: number; geometries: number; rawMessages: number; sources?: number; generations?: number; artifacts?: number };
    localCounts?: { warnings: number; sources: number; generations: number; artifacts: number };
    error?: string;
    ok?: boolean;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Gemini Test State
  const [geminiPrompt, setGeminiPrompt] = useState<string>(
    "System verification: confirm 'Gemini API operational check passed' and state current system readiness in 1 short sentence."
  );
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiResult, setGeminiResult] = useState<{
    success: boolean;
    hasKey: boolean;
    model?: string;
    latency_ms?: number;
    response?: string;
    prompt_used?: string;
    timestamp?: string;
    error?: string;
  } | null>(null);

  const loadStatus = async () => {
    setIsLoading(true);
    const data = await fetchSupabaseStatus();
    setStatus(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    try {
      const res = await testGeminiIntegration(geminiPrompt);
      setGeminiResult(res);
    } catch (err: any) {
      setGeminiResult({
        success: false,
        hasKey: false,
        error: err.message || String(err),
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await triggerSupabaseSync();
      const wCount = res.counts?.warnings ?? 0;
      const aCount = res.counts?.artifacts ?? 0;
      setSyncMessage(`Successfully synced ${wCount} warnings and ${aCount} artifacts to Supabase.`);
      await loadStatus();
    } catch (err: any) {
      setSyncMessage(`Sync Error: ${err.message || String(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportJson = () => {
    const backupData = {
      exported_at: new Date().toISOString(),
      warnings_count: warnings.length,
      artifacts_count: artifacts.length,
      generations_count: generations.length,
      warnings,
      artifacts,
      generations,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `navwarn_supabase_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sqlSchemaScript = `-- Supabase Schema Reference for Helm.Warning (20261019/20 backend contract)
-- Source of truth: Helm.Warning.Backend migrations. Run those instead of this
-- script if you are setting up a fresh project; this DDL is a read-only
-- reference of the CURRENT schema. Contract: docs/supabase-backend-contract.md

CREATE TABLE public.nav_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id TEXT UNIQUE NOT NULL,
  navarea TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  area_text TEXT,
  raw_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','cancelled','expired','superseded','unverified')),
  categories TEXT[] NOT NULL,
  triage_tier TEXT NOT NULL CHECK (triage_tier IN ('A','B','C')),
  data_quality TEXT NOT NULL CHECK (data_quality IN ('EXPLICIT','INFERRED','AMBIGUOUS','INVALID')),
  parsing_method TEXT NOT NULL CHECK (parsing_method IN ('RULE','AI')),
  qa_flags JSONB,
  unplotted_reason TEXT,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  issued_at TIMESTAMPTZ,
  shoal_depth_m DOUBLE PRECISION,
  tow_length_m DOUBLE PRECISION,
  tow_speed_kts DOUBLE PRECISION,
  applicable_vessel_filter TEXT,
  radio_frequencies TEXT[],
  space_launch_mission TEXT,
  duplicate_of_id UUID REFERENCES public.nav_warnings(id),
  cancels_ids TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- NOTE: there are NO latitude / longitude / spatial / warning_id /
-- issued_date / issued_text / category / severity / risk_level / hazard_category columns.

CREATE TABLE public.nav_warning_geometries (
  geom_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_id UUID NOT NULL REFERENCES public.nav_warnings(id) ON DELETE CASCADE,
  feature_type TEXT CHECK (feature_type IN ('POINT','LINE','POLYGON','CORRIDOR','SWEEP_ARC','BOUNDING_BOX')),
  geom_postgis GEOGRAPHY(GEOMETRY, 4326),
  zone_label TEXT,
  buffer_nm DOUBLE PRECISION,
  corridor_half_width_nm DOUBLE PRECISION,
  altitude_floor_m DOUBLE PRECISION,
  altitude_ceiling_fl DOUBLE PRECISION
);
-- Geometries are DELETEd and re-inserted on every sync: never cache geom_id.

CREATE TABLE public.raw_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  subject_header TEXT,
  full_raw_text TEXT NOT NULL,
  received_timestamp TIMESTAMPTZ DEFAULT NOW(),
  checksum_sha256 TEXT,
  UNIQUE (warning_id, source_id, checksum_sha256)
);

-- Read API (created by the backend migrations):
--   public.nav_warnings_active_spatial  -> map layer (active + Tier A + geojson_blob)
--   public.nav_warnings_review_queue    -> Tier B admin triage view
-- RLS: anon / authenticated are SELECT-only; writes go through the
-- service_role / the upsert_nav_warning(jsonb) RPC.
`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchemaScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gw-primary text-gw-bg p-6 rounded-2xl shadow-lg border-2 border-gw-tertiary">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Supabase Database Server Hub</h1>
          </div>
          <p className="text-xs sm:text-sm text-gw-accent max-w-2xl">
            All maritime warning notices, geometry features, and raw artifacts are persisted directly into your Supabase Postgres database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadStatus}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-gw-tertiary hover:bg-gw-secondary text-gw-bg hover:text-gw-primary font-medium text-xs uppercase tracking-wider rounded border border-gw-accent transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Check Status</span>
          </button>
        </div>
      </div>

      {/* Connection Status Banner */}
      <div className="bg-gw-panel border-2 border-gw-primary rounded-xl p-5 shadow-hard space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg border ${
              status?.connected ? 'bg-green-100 text-green-700 border-green-300' : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}>
              {status?.connected ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base flex items-center gap-2">
                <span>Supabase Cloud Integration</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                  status?.connected ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {status?.connected ? 'CONNECTED' : 'STANDBY / LOCAL'}
                </span>
              </div>
              <div className="text-xs text-gw-accent font-mono mt-0.5">
                Endpoint: {status?.url || 'Default / Environment Configured'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-gw-primary text-gw-bg font-medium text-xs uppercase tracking-wider rounded border-2 border-gw-primary hover:bg-gw-tertiary transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync to Supabase Now'}</span>
          </button>
        </div>

        {status?.error && !status.connected && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-mono space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Supabase Connection Detail / Table Status:</span>
            </div>
            <p className="text-amber-800">{status.error}</p>
            {status.error.includes('does not exist') && (
              <p className="text-amber-900 font-sans text-xs mt-1 font-semibold">
                👉 Fix: Copy the SQL DDL schema below and run it in your Supabase SQL Editor to create the missing database tables.
              </p>
            )}
          </div>
        )}

        {syncMessage && (
          <div className={`p-3 rounded text-xs font-mono border ${
            syncMessage.startsWith('Sync Error') || syncMessage.includes('Forbidden') || syncMessage.includes('Failed')
              ? 'bg-red-50 border-red-300 text-red-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}>
            {syncMessage}
            {syncMessage.includes('Forbidden') && (
              <div className="mt-1 font-sans text-xs text-red-800 font-semibold">
                👉 Click the Lock icon (🔒) in the header to authenticate as Admin, then try syncing again.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gw-panel border-2 border-gw-primary rounded-xl p-4 shadow-hard">
          <div className="text-[10px] font-bold text-gw-accent uppercase tracking-wider mb-1">NAV WARNINGS TABLE</div>
          <div className="text-2xl font-bold font-mono text-gw-primary">
            {status?.counts?.warnings ?? warnings.length}
          </div>
          <div className="text-[10px] text-gw-accent mt-1">Local State: {warnings.length} notices</div>
        </div>

        <div className="bg-gw-panel border-2 border-gw-primary rounded-xl p-4 shadow-hard">
          <div className="text-[10px] font-bold text-gw-accent uppercase tracking-wider mb-1">SOURCES REGISTRY</div>
          <div className="text-2xl font-bold font-mono text-gw-primary">
            {status?.counts?.sources ?? 17}
          </div>
          <div className="text-[10px] text-gw-accent mt-1">Verified Feeds</div>
        </div>

        <div className="bg-gw-panel border-2 border-gw-primary rounded-xl p-4 shadow-hard">
          <div className="text-[10px] font-bold text-gw-accent uppercase tracking-wider mb-1">GENERATION POINTERS</div>
          <div className="text-2xl font-bold font-mono text-gw-primary">
            {status?.counts?.generations ?? generations.length}
          </div>
          <div className="text-[10px] text-gw-accent mt-1">Audit Log Rows</div>
        </div>

        <div className="bg-gw-panel border-2 border-gw-primary rounded-xl p-4 shadow-hard">
          <div className="text-[10px] font-bold text-gw-accent uppercase tracking-wider mb-1">RAW ARTIFACTS</div>
          <div className="text-2xl font-bold font-mono text-gw-primary">
            {status?.counts?.artifacts ?? artifacts.length}
          </div>
          <div className="text-[10px] text-gw-accent mt-1">Evidence Locker Blobs</div>
        </div>
      </div>

      {/* Gemini AI Integration Test Module (Admin Password Protected) */}
      <div className="bg-gw-panel border-2 border-gw-primary rounded-2xl p-6 shadow-hard space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b-2 border-gw-secondary pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base sm:text-lg font-bold text-gw-primary uppercase tracking-wider">
                Gemini AI Integration Test Module
              </h2>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 border border-indigo-300 rounded text-[10px] font-mono font-bold flex items-center gap-1">
                <Lock className="w-3 h-3 text-indigo-700" /> ADMIN GATE
              </span>
            </div>
            <p className="text-xs text-gw-accent max-w-3xl leading-relaxed">
              Verify server-side Gemini model connectivity (<code className="font-mono bg-gw-secondary px-1 rounded text-gw-primary">gemini-3.1-flash-lite</code>) and test if the <code className="font-mono bg-gw-secondary px-1 rounded text-gw-primary">GEMINI_API_KEY</code> secret is operational.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestGemini}
            disabled={isTestingGemini}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] hover:brightness-110 text-[var(--canvas)] font-medium text-xs uppercase tracking-wider rounded border border-[var(--accent)] transition-colors disabled:opacity-50 shrink-0"
          >
            {isTestingGemini ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{isTestingGemini ? 'Testing Gemini API...' : 'Test Gemini Integration'}</span>
          </button>
        </div>

        {/* Prompt Input Control */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gw-primary uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-gw-accent" />
              <span>Diagnostic Test Prompt</span>
            </span>
            <span className="text-[10px] font-normal text-gw-accent font-mono">Model: gemini-3.1-flash-lite</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={geminiPrompt}
              onChange={(e) => setGeminiPrompt(e.target.value)}
              placeholder="Enter test prompt for Gemini API..."
              className="flex-1 px-3 py-2 bg-gw-bg border border-gw-primary rounded text-xs font-mono text-gw-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <button
              type="button"
              onClick={handleTestGemini}
              disabled={isTestingGemini || !geminiPrompt.trim()}
              className="px-4 py-2 bg-gw-primary text-gw-bg hover:bg-gw-tertiary rounded font-medium text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Execute</span>
            </button>
          </div>
        </div>

        {/* Results Box */}
        {geminiResult ? (
          <div className={`p-4 rounded-xl border-2 font-mono text-xs space-y-3 ${
            geminiResult.success
              ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950'
              : 'bg-amber-50/80 border-amber-400 text-amber-950'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
              <div className="flex items-center gap-2 font-bold">
                {geminiResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className="uppercase tracking-wider">
                  {geminiResult.success ? 'Gemini API Operational' : 'Gemini API Verification Error'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-gw-accent">
                {geminiResult.model && (
                  <span className="bg-gw-panel/80 px-2 py-0.5 rounded border border-gw-secondary">
                    Model: <strong>{geminiResult.model}</strong>
                  </span>
                )}
                {geminiResult.latency_ms !== undefined && (
                  <span className="bg-gw-panel/80 px-2 py-0.5 rounded border border-gw-secondary flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>{geminiResult.latency_ms}ms</span>
                  </span>
                )}
                {geminiResult.timestamp && (
                  <span className="text-[10px] text-gw-accent">
                    {new Date(geminiResult.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            {geminiResult.success && geminiResult.response ? (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">
                  Model Generated Response Output:
                </div>
                <div className="bg-gw-primary text-gw-secondary p-3.5 rounded-lg border border-gw-secondary leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono">
                  {geminiResult.response}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="font-bold text-amber-900">
                  {geminiResult.error}
                </div>
                {!geminiResult.hasKey && (
                  <p className="text-xs font-sans text-amber-950 leading-relaxed font-semibold bg-amber-100/80 p-2.5 rounded border border-amber-300">
                    👉 <strong>How to fix:</strong> Your app uses server-side Gemini integration. Go to your AI Studio application <strong>Settings &gt; Secrets</strong> menu and define <code className="bg-gw-panel px-1.5 py-0.5 rounded border border-amber-400 text-amber-900 font-mono">GEMINI_API_KEY</code>.
                  </p>
                )}
                {geminiResult.error?.includes('Forbidden') && (
                  <p className="text-xs font-sans text-red-900 font-semibold bg-red-100 p-2.5 rounded border border-red-300">
                    🔒 <strong>Admin Access Required:</strong> Click the Lock icon in the header to authenticate as Admin before executing test requests.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-gw-bg border border-gw-secondary rounded-xl text-xs font-mono text-gw-accent flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Click "Test Gemini Integration" to perform a real-time server API operational check.</span>
            </div>
            <span className="text-[10px] text-gw-accent uppercase tracking-wider">Status: Ready</span>
          </div>
        )}
      </div>

      {/* Database Schema & Quick Export Options */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SQL Setup Script */}
        <div className="lg:col-span-2 bg-gw-panel border-2 border-gw-primary rounded-xl p-5 shadow-hard space-y-3">
          <div className="flex justify-between items-center border-b border-gw-secondary pb-3">
            <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-wider">
              <FileCode className="w-4 h-4 text-gw-primary" />
              <span>Supabase SQL DDL Setup Schema</span>
            </div>
            <button
              type="button"
              onClick={handleCopySql}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gw-bg border border-gw-secondary hover:border-gw-primary rounded text-xs font-medium uppercase transition-colors"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Copied' : 'Copy SQL'}</span>
            </button>
          </div>

          <pre className="bg-gw-primary text-gw-secondary p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-[300px] whitespace-pre border border-gw-secondary">
            {sqlSchemaScript}
          </pre>
        </div>

        {/* JSON Export Backup */}
        <div className="bg-gw-panel border-2 border-gw-primary rounded-xl p-5 shadow-hard flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-wider border-b border-gw-secondary pb-3">
              <Download className="w-4 h-4 text-gw-primary" />
              <span>Database JSON Backup</span>
            </div>
            <p className="text-xs text-gw-accent leading-relaxed">
              Export a standalone snapshot of all active warning records, spatial geometries, generation audit logs, and evidence raw artifacts into a portable JSON backup file.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportJson}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gw-primary text-gw-bg font-medium text-xs uppercase tracking-wider rounded border-2 border-gw-primary hover:bg-gw-tertiary transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download Database JSON Backup</span>
          </button>
        </div>

      </div>
    </div>
  );
};


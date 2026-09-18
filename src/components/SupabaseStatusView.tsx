import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, RefreshCw, Download, CheckCircle2, AlertTriangle, Server, Key, Layers, FileCode, Copy, Check, Bot, Sparkles, Send, Terminal, Zap, Lock } from 'lucide-react';
import { NavWarning, IngestionGeneration, RawArtifact } from '../types';
import { fetchSupabaseStatus, triggerSupabaseSync, testGeminiIntegration, testMistralIntegration } from '../services/api';

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
    counts: { warnings: number; sources: number; generations: number; artifacts: number };
    localCounts: { warnings: number; sources: number; generations: number; artifacts: number };
    error?: string;
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

  // Mistral (Ministral) Test State
  const [mistralPrompt, setMistralPrompt] = useState<string>(
    "System verification: confirm 'Mistral AI operational check passed' and state current system readiness in 1 short sentence."
  );
  const [isTestingMistral, setIsTestingMistral] = useState(false);
  const [mistralResult, setMistralResult] = useState<{
    success: boolean;
    hasKey: boolean;
    model?: string;
    latency_ms?: number;
    response?: string;
    prompt_used?: string;
    timestamp?: string;
    error?: string;
  } | null>(null);

  const handleTestMistral = async () => {
    setIsTestingMistral(true);
    try {
      const res = await testMistralIntegration(mistralPrompt);
      setMistralResult(res);
    } catch (err: any) {
      setMistralResult({
        success: false,
        hasKey: false,
        error: err.message || String(err),
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsTestingMistral(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await triggerSupabaseSync();
      setSyncMessage(`Successfully synced ${res.counts.warnings} warnings and ${res.counts.artifacts} artifacts to Supabase.`);
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

  const sqlSchemaScript = `-- Supabase Schema Creation for Helm.Warning
-- Run this in your Supabase SQL Editor if setting up or updating tables:

CREATE TABLE IF NOT EXISTS public.nav_warnings (
  id UUID DEFAULT gen_random_uuid(),
  warning_id TEXT NOT NULL,
  publisher_id TEXT,
  source_id TEXT NOT NULL,
  navarea TEXT NOT NULL,
  source_warning_id TEXT,
  title TEXT,
  authority TEXT,
  issued_date TEXT,
  issued_text TEXT,
  status TEXT DEFAULT 'active',
  status_basis TEXT,
  area_text TEXT,
  raw_text TEXT,
  spatial JSONB,
  longitude DOUBLE PRECISION,
  latitude DOUBLE PRECISION,
  valid_until TEXT,
  validity TEXT,
  charts TEXT,
  categories TEXT,
  web_link TEXT,
  risk_level TEXT,
  source_url TEXT,
  extraction_method TEXT,
  generation_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (source_id, warning_id),
  CONSTRAINT nav_warnings_source_id_warning_id_key UNIQUE (source_id, warning_id)
);

-- Notify PostgREST schema cache to immediately recognize the composite constraint:
NOTIFY pgrst, 'reload schema';

CREATE TABLE IF NOT EXISTS public.raw_artifacts (
  artifact_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  path TEXT NOT NULL,
  content_type TEXT,
  content_hash TEXT,
  size_bytes INT,
  preview_text TEXT
);

CREATE TABLE IF NOT EXISTS public.ingestion_generations (
  generation_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  publication_kind TEXT,
  parsed_count INT,
  active_count INT,
  completeness_status TEXT,
  evidence_hash TEXT,
  artifact_ref TEXT
);

CREATE TABLE IF NOT EXISTS public.sources_registry (
  source_id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL,
  publisher_name TEXT NOT NULL,
  navareas JSONB,
  scope TEXT,
  discovery_url TEXT NOT NULL,
  format TEXT NOT NULL,
  publication_semantics TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  verification JSONB,
  health JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
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
            onClick={loadStatus}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-gw-tertiary hover:bg-gw-secondary text-gw-bg hover:text-gw-primary font-bold text-xs uppercase tracking-wider rounded border border-gw-accent transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Check Status</span>
          </button>
        </div>
      </div>

      {/* Connection Status Banner */}
      <div className="bg-white border-2 border-gw-primary rounded-xl p-5 shadow-hard space-y-4">
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
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-gw-primary text-gw-bg font-bold text-xs uppercase tracking-wider rounded border-2 border-gw-primary hover:bg-gw-tertiary transition-all shadow-sm"
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
        <div className="bg-white border-2 border-gw-primary rounded-xl p-4 shadow-hard">
          <div className="text-[10px] font-bold text-gw-accent uppercase tracking-wider mb-1">NAV WARNINGS TABLE</div>
          <div className="text-2xl font-bold font-mono text-gw-primary">
            {status?.counts.warnings ?? warnings.length}
          </div>
          <div className="text-[10px] text-gw-accent mt-1">Local State: {warnings.length} notices</div>
        </div>

        <div className="bg-white border-2 border-gw-primary rounded-xl p-4 shadow-hard">
          <div className="text-[10px] font-bold text-gw-accent uppercase tracking-wider mb-1">SOURCES REGISTRY</div>
          <div className="text-2xl font-bold font-mono text-gw-primary">
            {status?.counts.sources ?? 17}
          </div>
          <div className="text-[10px] text-gw-accent mt-1">Verified Feeds</div>
        </div>

        <div className="bg-white border-2 border-gw-primary rounded-xl p-4 shadow-hard">
          <div className="text-[10px] font-bold text-gw-accent uppercase tracking-wider mb-1">GENERATION POINTERS</div>
          <div className="text-2xl font-bold font-mono text-gw-primary">
            {status?.counts.generations ?? generations.length}
          </div>
          <div className="text-[10px] text-gw-accent mt-1">Audit Log Rows</div>
        </div>

        <div className="bg-white border-2 border-gw-primary rounded-xl p-4 shadow-hard">
          <div className="text-[10px] font-bold text-gw-accent uppercase tracking-wider mb-1">RAW ARTIFACTS</div>
          <div className="text-2xl font-bold font-mono text-gw-primary">
            {status?.counts.artifacts ?? artifacts.length}
          </div>
          <div className="text-[10px] text-gw-accent mt-1">Evidence Locker Blobs</div>
        </div>
      </div>

      {/* Gemini AI Integration Test Module (Admin Password Protected) */}
      <div className="bg-white border-2 border-gw-primary rounded-2xl p-6 shadow-hard space-y-5">
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
              Verify server-side Gemini model connectivity (<code className="font-mono bg-zinc-100 px-1 rounded text-zinc-900">gemini-3.1-flash-lite</code>) and test if the <code className="font-mono bg-zinc-100 px-1 rounded text-zinc-900">GEMINI_API_KEY</code> secret is operational.
            </p>
          </div>

          <button
            onClick={handleTestGemini}
            disabled={isTestingGemini}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg border-2 border-indigo-700 shadow-md transition-all active:scale-95 disabled:opacity-50 shrink-0"
          >
            {isTestingGemini ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-200" />
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
              className="flex-1 px-3 py-2 bg-gw-bg border border-gw-primary rounded text-xs font-mono text-gw-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleTestGemini}
              disabled={isTestingGemini || !geminiPrompt.trim()}
              className="px-4 py-2 bg-gw-primary text-gw-bg hover:bg-gw-tertiary rounded font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5"
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

              <div className="flex items-center gap-3 text-[11px] text-zinc-700">
                {geminiResult.model && (
                  <span className="bg-white/80 px-2 py-0.5 rounded border border-zinc-300">
                    Model: <strong>{geminiResult.model}</strong>
                  </span>
                )}
                {geminiResult.latency_ms !== undefined && (
                  <span className="bg-white/80 px-2 py-0.5 rounded border border-zinc-300 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>{geminiResult.latency_ms}ms</span>
                  </span>
                )}
                {geminiResult.timestamp && (
                  <span className="text-[10px] text-zinc-500">
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
                <div className="bg-zinc-950 text-emerald-400 p-3.5 rounded-lg border border-zinc-800 leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono">
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
                    👉 <strong>How to fix:</strong> Your app uses server-side Gemini integration. Go to your AI Studio application <strong>Settings &gt; Secrets</strong> menu and define <code className="bg-white px-1.5 py-0.5 rounded border border-amber-400 text-amber-900 font-mono">GEMINI_API_KEY</code>.
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
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Click "Test Gemini Integration" to perform a real-time server API operational check.</span>
            </div>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Status: Ready</span>
          </div>
        )}
      </div>

      {/* Mistral / Ministral AI Integration Test Module */}
      <div className="bg-white border-2 border-gw-primary rounded-xl p-6 shadow-hard space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gw-secondary pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-amber-600" />
              <h2 className="text-base sm:text-lg font-bold text-gw-primary uppercase tracking-wider">
                Mistral AI / Ministral Fallback Test Module
              </h2>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-mono font-bold flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-700" /> ADMIN GATE
              </span>
            </div>
            <p className="text-xs text-gw-accent max-w-3xl leading-relaxed">
              Verify server-side Mistral model connectivity (<code className="font-mono bg-zinc-100 px-1 rounded text-zinc-900">mistral-large-latest</code>) and test if the <code className="font-mono bg-zinc-100 px-1 rounded text-zinc-900">MISTRAL_API_KEY</code> secret is operational for automated failover.
            </p>
          </div>

          <button
            onClick={handleTestMistral}
            disabled={isTestingMistral}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg border-2 border-amber-700 shadow-md transition-all active:scale-95 disabled:opacity-50 shrink-0"
          >
            {isTestingMistral ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-200" />
            )}
            <span>{isTestingMistral ? 'Testing Mistral API...' : 'Test Mistral Integration'}</span>
          </button>
        </div>

        {/* Prompt Input Control */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gw-primary uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-gw-accent" />
              <span>Mistral Diagnostic Test Prompt</span>
            </span>
            <span className="text-[10px] font-normal text-gw-accent font-mono">Model: mistral-large-latest</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={mistralPrompt}
              onChange={(e) => setMistralPrompt(e.target.value)}
              placeholder="Enter test prompt for Mistral API..."
              className="flex-1 px-3 py-2 bg-gw-bg border border-gw-primary rounded text-xs font-mono text-gw-primary focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              onClick={handleTestMistral}
              disabled={isTestingMistral || !mistralPrompt.trim()}
              className="px-4 py-2 bg-gw-primary text-gw-bg hover:bg-gw-tertiary rounded font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Execute</span>
            </button>
          </div>
        </div>

        {/* Results Box */}
        {mistralResult ? (
          <div className={`p-4 rounded-xl border-2 font-mono text-xs space-y-3 ${
            mistralResult.success
              ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950'
              : 'bg-amber-50/80 border-amber-400 text-amber-950'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
              <div className="flex items-center gap-2 font-bold">
                {mistralResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className="uppercase tracking-wider">
                  {mistralResult.success ? 'Mistral API Operational' : 'Mistral API Verification Error'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-zinc-700">
                {mistralResult.model && (
                  <span className="bg-white/80 px-2 py-0.5 rounded border border-zinc-300">
                    Model: <strong>{mistralResult.model}</strong>
                  </span>
                )}
                {mistralResult.latency_ms !== undefined && (
                  <span className="bg-white/80 px-2 py-0.5 rounded border border-zinc-300 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>{mistralResult.latency_ms}ms</span>
                  </span>
                )}
                {mistralResult.timestamp && (
                  <span className="text-[10px] text-zinc-500">
                    {new Date(mistralResult.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            {mistralResult.success && mistralResult.response ? (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">
                  Model Generated Response Output:
                </div>
                <div className="bg-zinc-950 text-emerald-400 p-3.5 rounded-lg border border-zinc-800 leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono">
                  {mistralResult.response}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="font-bold text-amber-900">
                  {mistralResult.error}
                </div>
                {!mistralResult.hasKey && (
                  <p className="text-xs font-sans text-amber-950 leading-relaxed font-semibold bg-amber-100/80 p-2.5 rounded border border-amber-300">
                    👉 <strong>How to fix:</strong> Your app uses server-side Mistral fallback integration. Go to your application <strong>Settings &gt; Secrets</strong> menu and define <code className="bg-white px-1.5 py-0.5 rounded border border-amber-400 text-amber-900 font-mono">MISTRAL_API_KEY</code>.
                  </p>
                )}
                {mistralResult.error?.includes('Forbidden') && (
                  <p className="text-xs font-sans text-red-900 font-semibold bg-red-100 p-2.5 rounded border border-red-300">
                    🔒 <strong>Admin Access Required:</strong> Click the Lock icon in the header to authenticate as Admin before executing test requests.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Click "Test Mistral Integration" to perform a real-time server fallback API operational check.</span>
            </div>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Status: Ready</span>
          </div>
        )}
      </div>

      {/* Database Schema & Quick Export Options */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SQL Setup Script */}
        <div className="lg:col-span-2 bg-white border-2 border-gw-primary rounded-xl p-5 shadow-hard space-y-3">
          <div className="flex justify-between items-center border-b border-gw-secondary pb-3">
            <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-wider">
              <FileCode className="w-4 h-4 text-gw-primary" />
              <span>Supabase SQL DDL Setup Schema</span>
            </div>
            <button
              onClick={handleCopySql}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gw-bg border border-gw-secondary hover:border-gw-primary rounded text-xs font-bold uppercase transition-colors"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Copied' : 'Copy SQL'}</span>
            </button>
          </div>

          <pre className="bg-zinc-950 text-emerald-400 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-[300px] whitespace-pre border border-zinc-800">
            {sqlSchemaScript}
          </pre>
        </div>

        {/* JSON Export Backup */}
        <div className="bg-white border-2 border-gw-primary rounded-xl p-5 shadow-hard flex flex-col justify-between space-y-4">
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
            onClick={handleExportJson}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gw-primary text-gw-bg font-bold text-xs uppercase tracking-wider rounded border-2 border-gw-primary hover:bg-gw-tertiary transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Download Database JSON Backup</span>
          </button>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, RefreshCw, Download, CheckCircle2, AlertTriangle, Server, Key, Layers, FileCode, Copy, Check } from 'lucide-react';
import { NavWarning, IngestionGeneration, RawArtifact } from '../types';
import { fetchSupabaseStatus, triggerSupabaseSync } from '../services/api';

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

  const loadStatus = async () => {
    setIsLoading(true);
    const data = await fetchSupabaseStatus();
    setStatus(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadStatus();
  }, []);

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
-- Run this in your Supabase SQL Editor if setting up tables for the first time:

CREATE TABLE IF NOT EXISTS public.nav_warnings (
  warning_id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  navarea TEXT NOT NULL,
  source_warning_id TEXT NOT NULL,
  issued_date TEXT NOT NULL,
  issued_text TEXT,
  status TEXT NOT NULL,
  status_basis TEXT,
  area_text TEXT,
  raw_text TEXT,
  spatial JSONB,
  source_url TEXT,
  extraction_method TEXT,
  generation_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

        {syncMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded text-xs font-mono">
            {syncMessage}
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

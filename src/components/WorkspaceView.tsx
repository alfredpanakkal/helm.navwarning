import React from 'react';
import { Activity, Database, MapPin, Zap, AlertCircle, FileText, CheckCircle2, ArrowRight, Upload, Edit3, Shield, Archive, HardDrive, RefreshCw, AlertTriangle, Check, RotateCw, X } from 'lucide-react';
import { SourceRegistryItem, NavWarning, IngestionGeneration } from '../types';
import { TabType } from '../App';
import { computeAttentionRequired, STATUS_LOOKUP, UnifiedStatusType } from '../utils/statusModel';

interface WorkspaceViewProps {
  sources?: SourceRegistryItem[];
  warnings?: NavWarning[];
  generations?: IngestionGeneration[];
  supabaseConnected?: boolean;
  onNavigate?: (tab: TabType) => void;
  onNavigateWithFilter?: (tab: TabType, filter?: string) => void;
  onSelectWarning?: (warning: NavWarning) => void;
  isIngestionProcedureOpen?: boolean;
  setIsIngestionProcedureOpen?: (open: boolean) => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  sources = [],
  warnings = [],
  generations = [],
  supabaseConnected = true,
  onNavigate,
  onNavigateWithFilter,
  onSelectWarning,
  isIngestionProcedureOpen,
  setIsIngestionProcedureOpen,
}) => {
  const attentionItems = computeAttentionRequired(sources, warnings, generations, supabaseConnected);
  const activeSourcesCount = sources.filter((s) => s.enabled).length;
  const verifiedSourcesCount = sources.filter((s) => s.verification?.status === 'verified').length;
  const activeWarningsCount = warnings.filter((w) => w.status === 'active').length;
  const unverifiedWarningsCount = warnings.filter((w) => w.status === 'unverified').length;
  const spatialCount = warnings.filter((w) => Boolean(w.spatial?.geometries?.length)).length;
  const deterministicCount = warnings.filter(
    (w) => w.extraction_method === 'deterministic' || w.extraction_method === 'deterministic_hallucination_fallback'
  ).length;
  const aiCount = warnings.filter(
    (w) => w.extraction_method === 'llm_assisted' || w.extraction_method === 'gemini_structured_output'
  ).length;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">

      {/* 1. Attention Required Card (Top Summary if issues exist) */}
      {attentionItems.length > 0 && (
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-amber-200">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-amber-500 text-white rounded flex items-center justify-center font-bold">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-amber-950 text-sm sm:text-base">Attention Required ({attentionItems.length})</h3>
                <p className="text-xs text-amber-800">Items requiring verification, sync, or parameter adjustment.</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-3">
            {attentionItems.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="bg-white border border-amber-200 rounded-lg p-3 flex items-start justify-between gap-3 shadow-2xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border ${STATUS_LOOKUP[item.status].badgeClass}`}>
                      {STATUS_LOOKUP[item.status].symbol} {STATUS_LOOKUP[item.status].label}
                    </span>
                    <span className="font-bold text-xs text-slate-900">{item.title}</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-1">{item.reason}</p>
                </div>
                {item.warningId && onSelectWarning ? (
                  <button
                    onClick={() => {
                      const warn = warnings.find((w) => w.warning_id === item.warningId);
                      if (warn) onSelectWarning(warn);
                    }}
                    className="shrink-0 px-2.5 py-1 bg-gw-primary text-gw-bg hover:bg-gw-accent rounded text-xs font-bold transition-all"
                  >
                    Fix Now →
                  </button>
                ) : item.actionTab ? (
                  <button
                    onClick={() => onNavigate?.(item.actionTab as TabType)}
                    className="shrink-0 text-xs font-bold text-gw-primary hover:text-gw-accent underline"
                  >
                    {item.actionLabel || 'View'}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Compressed Status Strip & Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-800">
          <button
            onClick={() => onNavigateWithFilter ? onNavigateWithFilter('sources', 'unverified') : onNavigate?.('sources')}
            title="View sources (filtered to unverified if any)"
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <span className="text-emerald-600 font-bold">●</span>
            <span className="text-slate-600">Registered Feeds:</span>
            <span className="text-slate-900 font-bold">{activeSourcesCount}/{sources.length} Active</span>
          </button>
          <button
            onClick={() => onNavigateWithFilter ? onNavigateWithFilter('databank', 'unverified') : onNavigate?.('databank')}
            title="Jump to candidate warnings requiring verification"
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <span className="text-emerald-600 font-bold">●</span>
            <span className="text-slate-600">Active NAVWARNs:</span>
            <span className="text-slate-900 font-bold">{warnings.filter((w) => w.status === 'active').length} Published</span>
          </button>
          <button
            onClick={() => onNavigate?.('supabase')}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <span className={supabaseConnected ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
              ●
            </span>
            <span className="text-slate-600">Supabase Server:</span>
            <span className={supabaseConnected ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
              {supabaseConnected ? 'Connected' : 'Offline'}
            </span>
          </button>
        </div>
      </div>

      {/* 3. NAVWARN Candidate Discovery & Action Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gw-primary flex items-center gap-2">
            <Database className="w-4 h-4 text-gw-accent" />
            Candidate Discovery & Ingestion Tools
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gw-accent font-bold">Primary Actions</span>
            <button
              onClick={() => setIsIngestionProcedureOpen?.(true)}
              className="text-xs text-gw-accent font-bold hover:text-gw-primary underline cursor-pointer"
            >
              Ingestion Procedure
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigate?.('sources')}
            className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-xs transition-all group flex flex-col justify-between min-h-[110px] cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 border border-slate-200 rounded-lg flex items-center justify-center bg-slate-50">
                <Database className="w-4 h-4 text-slate-700" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Candidate Sources</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{sources.length} Registered Feeds</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate?.('manual')}
            className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-xs transition-all group flex flex-col justify-between min-h-[110px] cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 border border-slate-200 rounded-lg flex items-center justify-center bg-slate-50">
                <Edit3 className="w-4 h-4 text-slate-700" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Manual Parser</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Deterministic &amp; Gemini AI</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate?.('imports')}
            className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-xs transition-all group flex flex-col justify-between min-h-[110px] cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 border border-slate-200 rounded-lg flex items-center justify-center bg-slate-50">
                <Upload className="w-4 h-4 text-slate-700" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Bulk Imports</div>
              <div className="text-[10px] text-slate-500 mt-0.5">CSV, GPX, S-124 ZIP</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate?.('audit')}
            className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-xs transition-all group flex flex-col justify-between min-h-[110px] cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 border border-slate-200 rounded-lg flex items-center justify-center bg-slate-50">
                <Shield className="w-4 h-4 text-slate-700" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Audit Pointer Log</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Generations &amp; History</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate?.('evidence')}
            className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-xs transition-all group flex flex-col justify-between min-h-[110px] cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 border border-slate-200 rounded-lg flex items-center justify-center bg-slate-50">
                <Archive className="w-4 h-4 text-slate-700" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Evidence Locker</div>
              <div className="text-[10px] text-slate-500 mt-0.5">SHA-256 Raw Artifacts</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate?.('supabase')}
            className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-xs transition-all group flex flex-col justify-between min-h-[110px] cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 border border-slate-200 rounded-lg flex items-center justify-center bg-slate-50">
                <HardDrive className="w-4 h-4 text-slate-700" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Supabase Server</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Storage &amp; Sync Status</div>
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 sm:gap-8">
        
        {/* Main Column */}
        <div className="flex flex-col gap-6 sm:gap-8">
          {/* Pipeline Card */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-slate-50/80 gap-2">
              <div className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-7 sm:h-7 border border-slate-300 rounded flex items-center justify-center shrink-0 bg-white">
                  <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700" />
                </div>
                Ingestion Pipeline Overview
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase">LIVE SESSION METRICS</span>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="relative bg-slate-50/60 border border-slate-200 rounded-lg p-3.5 sm:p-4 pt-4 sm:pt-5 shadow-2xs">
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-900 rounded-t-lg"></div>
                <span className="absolute top-3 right-3 sm:right-4 text-[10px] font-bold text-slate-400">01</span>
                <div className="w-8 h-8 sm:w-10 sm:h-10 border border-slate-300 rounded-lg flex items-center justify-center mb-2 sm:mb-3 bg-white">
                  <Database className="w-4 h-4 sm:w-5 sm:h-5 text-slate-800" />
                </div>
                <div className="text-sm sm:text-base font-bold text-slate-900 mb-1">Fetch Sources</div>
                <div className="text-[11px] sm:text-xs text-slate-500 mb-3 sm:mb-4 leading-relaxed">Poll NAVAREA coordinators via HTTPS.</div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-slate-200">
                  <div>
                    <div className="text-[9px] sm:text-[10px] uppercase text-slate-400 font-semibold">ENABLED</div>
                    <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">{activeSourcesCount}/{sources.length}</div>
                  </div>
                  <div>
                    <div className="text-[9px] sm:text-[10px] uppercase text-slate-400 font-semibold">VERIFIED</div>
                    <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">{verifiedSourcesCount}</div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase text-emerald-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>{activeSourcesCount > 0 ? 'READY' : 'STANDBY'}
                </div>
              </div>

              <div className="relative bg-slate-50/60 border border-slate-200 rounded-lg p-3.5 sm:p-4 pt-4 sm:pt-5 shadow-2xs">
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-900 rounded-t-lg"></div>
                <span className="absolute top-3 right-3 sm:right-4 text-[10px] font-bold text-slate-400">02</span>
                <div className="w-8 h-8 sm:w-10 sm:h-10 border border-slate-300 rounded-lg flex items-center justify-center mb-2 sm:mb-3 bg-white">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-slate-800" />
                </div>
                <div className="text-sm sm:text-base font-bold text-slate-900 mb-1">Parse &amp; Normalize</div>
                <div className="text-[11px] sm:text-xs text-slate-500 mb-3 sm:mb-4 leading-relaxed">Tokenize raw text into structured records.</div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-slate-200">
                  <div>
                    <div className="text-[9px] sm:text-[10px] uppercase text-slate-400 font-semibold">ACTIVE</div>
                    <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">{activeWarningsCount}</div>
                  </div>
                  <div>
                    <div className="text-[9px] sm:text-[10px] uppercase text-slate-400 font-semibold">REVIEW</div>
                    <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">{unverifiedWarningsCount}</div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase text-emerald-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>SYNCHRONIZED
                </div>
              </div>

              <div className="relative bg-slate-50/60 border border-slate-200 rounded-lg p-3.5 sm:p-4 pt-4 sm:pt-5 shadow-2xs">
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-900 rounded-t-lg"></div>
                <span className="absolute top-3 right-3 sm:right-4 text-[10px] font-bold text-slate-400">03</span>
                <div className="w-8 h-8 sm:w-10 sm:h-10 border border-slate-300 rounded-lg flex items-center justify-center mb-2 sm:mb-3 bg-white">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-slate-800" />
                </div>
                <div className="text-sm sm:text-base font-bold text-slate-900 mb-1">Geocode Geometry</div>
                <div className="text-[11px] sm:text-xs text-slate-500 mb-3 sm:mb-4 leading-relaxed">Extract lat/lon points, polygons, circles.</div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-slate-200">
                  <div>
                    <div className="text-[9px] sm:text-[10px] uppercase text-slate-400 font-semibold">SPATIAL</div>
                    <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">{spatialCount}</div>
                  </div>
                  <div>
                    <div className="text-[9px] sm:text-[10px] uppercase text-slate-400 font-semibold">PARSERS</div>
                    <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">{deterministicCount}D/{aiCount}AI</div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase text-emerald-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>{spatialCount > 0 ? 'MAPPED' : 'STANDBY'}
                </div>
              </div>

              <div className="relative bg-slate-50/60 border border-slate-200 rounded-lg p-3.5 sm:p-4 pt-4 sm:pt-5 shadow-2xs">
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-900 rounded-t-lg"></div>
                <span className="absolute top-3 right-3 sm:right-4 text-[10px] font-bold text-slate-400">04</span>
                <div className="w-8 h-8 sm:w-10 sm:h-10 border border-slate-300 rounded-lg flex items-center justify-center mb-2 sm:mb-3 bg-white">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-800" />
                </div>
                <div className="text-sm sm:text-base font-bold text-slate-900 mb-1">Publish Generation</div>
                <div className="text-[11px] sm:text-xs text-slate-500 mb-3 sm:mb-4 leading-relaxed">Atomic pointer swap to active warnings.</div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-slate-200">
                  <div>
                    <div className="text-[9px] sm:text-[10px] uppercase text-slate-400 font-semibold">GENERATIONS</div>
                    <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">{generations.length}</div>
                  </div>
                  <div>
                    <div className="text-[9px] sm:text-[10px] uppercase text-slate-400 font-semibold">STORAGE</div>
                    <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">{supabaseConnected ? 'LIVE' : 'LOCAL'}</div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase text-emerald-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>SEALED
                </div>
              </div>
            </div>
          </div>

          {/* Activity / Generation Card */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="flex justify-between items-center px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-slate-50/80">
              <div className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-7 sm:h-7 border border-slate-300 rounded flex items-center justify-center shrink-0 bg-white">
                  <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700" />
                </div>
                Ingestion Generations &amp; Activity
              </div>
              {generations.length > 0 && (
                <button
                  onClick={() => onNavigate?.('audit')}
                  className="text-xs text-gw-accent hover:text-gw-primary font-bold underline uppercase"
                >
                  View All ({generations.length})
                </button>
              )}
            </div>
            <div className="px-3 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-xs bg-gw-primary text-gw-secondary max-h-[280px] overflow-y-auto table-scroll-container font-mono">
              {generations.length > 0 ? (
                generations.slice(0, 10).map((gen, i) => {
                  const runStatus = gen.run_status || gen.completeness_status || 'verified';
                  const timestamp = gen.started_at || gen.created_at;
                  const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : 'N/A';
                  return (
                    <div key={gen.generation_id || i} className="flex gap-2 sm:gap-4 py-1.5 border-b border-dashed border-gw-tertiary last:border-b-0 min-w-[500px] sm:min-w-0">
                      <span className="text-gw-accent shrink-0">{timeStr}</span>
                      <span className={`font-bold w-16 shrink-0 ${
                        runStatus === 'succeeded' || runStatus === 'verified' ? 'text-green-400' :
                        runStatus === 'running' ? 'text-sky-400' : 'text-amber-400'
                      }`}>{runStatus.toUpperCase()}</span>
                      <span className="truncate">
                        Gen {gen.generation_id?.slice(0, 12)} — Source {gen.source_id || 'manual'}: {gen.parsed_count ?? 0} warnings parsed
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center text-slate-400 space-y-2">
                  <p>No automated background cycles recorded in this session.</p>
                  <p className="text-[10px] text-slate-500">
                    Operating on live synchronized store ({warnings.length} warnings across {sources.length} sources).
                  </p>
                  <button
                    onClick={() => setIsIngestionProcedureOpen?.(true)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded text-[11px] font-sans font-bold uppercase transition-colors"
                  >
                    Open Ingestion Procedure →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Side Column: Source Health */}
        <div className="flex flex-col gap-6 sm:gap-8">
          <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden h-full flex flex-col shadow-sm">
            <div className="flex justify-between items-center px-4 sm:px-6 py-3.5 sm:py-4 border-b-2 border-gw-primary">
              <div className="text-base sm:text-lg font-bold uppercase tracking-wider flex items-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-7 sm:h-7 border border-gw-primary rounded flex items-center justify-center shrink-0">
                  <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gw-primary" />
                </div>
                Source Health
              </div>
              <button
                onClick={() => onNavigate?.('sources')}
                className="text-xs text-gw-accent hover:text-gw-primary font-bold underline uppercase"
              >
                Manage All
              </button>
            </div>
            <div className="p-2 overflow-y-auto flex-1 max-h-[500px]">
              {sources.map((s, i) => (
                <div key={s.source_id || i} className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gw-secondary last:border-0 hover:bg-gw-bg transition-colors">
                  <div className="w-10 h-6 border border-gw-primary rounded flex items-center justify-center text-[10px] font-bold shrink-0 bg-gw-bg">
                    {s.navareas.join(',')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-bold truncate">{s.publisher_name}</div>
                    <div className="text-[10px] text-gw-accent truncate">{s.discovery_url}</div>
                  </div>
                  <div className="flex flex-col items-end text-[10px] text-gw-accent shrink-0">
                    <span className="text-gw-primary font-bold text-xs">{s.health.active_warnings_count}</span>
                    <span>active</span>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ml-1 ${
                    s.health.status === 'ok' ? 'bg-green-400' :
                    s.health.status === 'warning' || s.health.status === 'stale' ? 'bg-amber-400' : 'bg-slate-300'
                  }`}></div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};


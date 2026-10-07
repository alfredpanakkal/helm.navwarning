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

const MOCK_LOGS = [
  { t: '14:32:08.142', lvl: 'info', msg: 'Pipeline cycle 0247 initiated — active sources queued' },
  { t: '14:32:08.517', lvl: 'ok', msg: 'Source UKHO NAVAREA I fetched (200 OK, complete in-force)' },
  { t: '14:32:08.891', lvl: 'ok', msg: 'Source SMA Baltic Sea fetched (200 OK, subarea feed)' },
  { t: '14:32:09.318', lvl: 'warn', msg: 'Source SHOM NAVAREA II PDF bulletin parsed (3 warnings extracted)' },
  { t: '14:32:09.820', lvl: 'ok', msg: 'Source NGA NAVAREA IV/XII live JSON feed synchronized' },
  { t: '14:32:10.442', lvl: 'info', msg: 'Parsing & Geocoding phase complete — structured geometries emitted' },
  { t: '14:32:10.881', lvl: 'ok', msg: 'Coordinate parser: 119 deterministic regex extractions' },
  { t: '14:32:11.012', lvl: 'ok', msg: 'Gemini LLM Assistant: 23 complex geometry extractions verified' },
  { t: '14:32:11.294', lvl: 'ok', msg: 'Atomic pointer swap to latest ingestion generation successful' },
  { t: '14:32:11.301', lvl: 'info', msg: 'Pipeline run complete — Evidence hashes sealed in locker' },
];

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
      <div className="bg-white border-2 border-gw-primary rounded-xl p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gw-primary">
          <button
            onClick={() => onNavigateWithFilter ? onNavigateWithFilter('sources', 'unverified') : onNavigate?.('sources')}
            title="View sources (filtered to unverified if any)"
            className="flex items-center gap-2 px-3 py-1.5 bg-gw-bg hover:bg-gw-secondary border border-gw-secondary rounded-lg transition-colors cursor-pointer"
          >
            <span className="text-emerald-600 font-bold">● ✓</span>
            <span>Registered Feeds:</span>
            <span className="text-gw-primary">{activeSourcesCount}/{sources.length} Active</span>
          </button>
          <button
            onClick={() => onNavigateWithFilter ? onNavigateWithFilter('databank', 'unverified') : onNavigate?.('databank')}
            title="Jump to candidate warnings requiring verification"
            className="flex items-center gap-2 px-3 py-1.5 bg-gw-bg hover:bg-gw-secondary border border-gw-secondary rounded-lg transition-colors cursor-pointer"
          >
            <span className="text-emerald-600 font-bold">● ✓</span>
            <span>Active NAVWARNs:</span>
            <span className="text-gw-primary">{warnings.filter((w) => w.status === 'active').length} Published</span>
          </button>
          <button
            onClick={() => onNavigate?.('supabase')}
            className="flex items-center gap-2 px-3 py-1.5 bg-gw-bg hover:bg-gw-secondary border border-gw-secondary rounded-lg transition-colors cursor-pointer"
          >
            <span className={supabaseConnected ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
              {supabaseConnected ? '● ✓' : '● ✕'}
            </span>
            <span>Supabase Database:</span>
            <span className={supabaseConnected ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
              {supabaseConnected ? 'Connected' : 'Offline / Unreachable'}
            </span>
          </button>
        </div>
      </div>

      {/* 3. NAVWARN Candidate Discovery (Primary Position) & Action Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gw-primary flex items-center gap-2">
            <Database className="w-4 h-4 text-gw-accent" />
            Candidate Discovery & Ingestion Tools
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gw-accent font-bold">Primary Actions</span>
            <button
              onClick={() => setIsIngestionProcedureOpen(true)}
              className="text-xs text-gw-accent font-bold hover:text-gw-primary underline"
            >
              Ingestion Procedure
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigate?.('sources')}
            className="bg-white border-2 border-gw-primary rounded-xl p-4 text-left hover:bg-gw-bg transition-all hover:-translate-y-0.5 group flex flex-col justify-between min-h-[110px]"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 border border-gw-primary rounded flex items-center justify-center bg-gw-bg">
                <Database className="w-4 h-4 text-gw-primary" />
              </div>
              <ArrowRight className="w-4 h-4 text-gw-accent group-hover:text-gw-primary group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <div className="text-sm font-bold text-gw-primary">Candidate Sources</div>
              <div className="text-[10px] text-gw-accent mt-0.5">{sources.length} Registered Feeds</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate?.('manual')}
            className="bg-white border-2 border-gw-primary rounded-xl p-4 text-left hover:bg-gw-bg transition-all hover:-translate-y-0.5 group flex flex-col justify-between min-h-[110px]"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 border border-gw-primary rounded flex items-center justify-center bg-gw-bg">
                <Edit3 className="w-4 h-4 text-gw-primary" />
              </div>
              <ArrowRight className="w-4 h-4 text-gw-accent group-hover:text-gw-primary group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <div className="text-sm font-bold text-gw-primary">Manual Parser</div>
              <div className="text-[10px] text-gw-accent mt-0.5">Regex &amp; Gemini LLM</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate?.('imports')}
            className="bg-white border-2 border-gw-primary rounded-xl p-4 text-left hover:bg-gw-bg transition-all hover:-translate-y-0.5 group flex flex-col justify-between min-h-[110px]"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 border border-gw-primary rounded flex items-center justify-center bg-gw-bg">
                <Upload className="w-4 h-4 text-gw-primary" />
              </div>
              <ArrowRight className="w-4 h-4 text-gw-accent group-hover:text-gw-primary group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <div className="text-sm font-bold text-gw-primary">Bulk Imports</div>
              <div className="text-[10px] text-gw-accent mt-0.5">CSV, GPX, S-124 ZIP</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate?.('audit')}
            className="bg-white border-2 border-gw-primary rounded-xl p-4 text-left hover:bg-gw-bg transition-all hover:-translate-y-0.5 group flex flex-col justify-between min-h-[110px]"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 border border-gw-primary rounded flex items-center justify-center bg-gw-bg">
                <Shield className="w-4 h-4 text-gw-primary" />
              </div>
              <ArrowRight className="w-4 h-4 text-gw-accent group-hover:text-gw-primary group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <div className="text-sm font-bold text-gw-primary">Audit Pointer Log</div>
              <div className="text-[10px] text-gw-accent mt-0.5">Generations &amp; History</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate?.('evidence')}
            className="bg-white border-2 border-gw-primary rounded-xl p-4 text-left hover:bg-gw-bg transition-all hover:-translate-y-0.5 group flex flex-col justify-between min-h-[110px]"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 border border-gw-primary rounded flex items-center justify-center bg-gw-bg">
                <Archive className="w-4 h-4 text-gw-primary" />
              </div>
              <ArrowRight className="w-4 h-4 text-gw-accent group-hover:text-gw-primary group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <div className="text-sm font-bold text-gw-primary">Evidence Locker</div>
              <div className="text-[10px] text-gw-accent mt-0.5">SHA-256 Raw Artifacts</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate?.('supabase')}
            className="bg-white border-2 border-gw-primary rounded-xl p-4 text-left hover:bg-gw-bg transition-all hover:-translate-y-0.5 group flex flex-col justify-between min-h-[110px]"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 border border-gw-primary rounded flex items-center justify-center bg-gw-bg">
                <HardDrive className="w-4 h-4 text-gw-primary" />
              </div>
              <ArrowRight className="w-4 h-4 text-gw-accent group-hover:text-gw-primary group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <div className="text-sm font-bold text-gw-primary">Supabase Server</div>
              <div className="text-[10px] text-gw-accent mt-0.5">Storage &amp; Sync Status</div>
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 sm:gap-8">
        
        {/* Main Column */}
        <div className="flex flex-col gap-6 sm:gap-8">
          {/* Pipeline Card */}
          <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center px-4 sm:px-6 py-3.5 sm:py-4 border-b-2 border-gw-primary gap-2">
              <div className="text-base sm:text-lg font-bold uppercase tracking-wider flex items-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-7 sm:h-7 border border-gw-primary rounded flex items-center justify-center shrink-0">
                  <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gw-primary" />
                </div>
                Ingestion Pipeline Overview
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] sm:text-xs text-gw-accent font-bold">LIVE METRICS</span>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="relative bg-gw-bg border border-gw-secondary rounded-lg p-3.5 sm:p-4 pt-4 sm:pt-5">
                <div className="absolute top-0 left-0 w-full h-1 bg-gw-primary rounded-t-lg"></div>
                <span className="absolute top-3 right-3 sm:right-4 text-[10px] font-bold text-gw-accent">01</span>
                <div className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-gw-primary rounded flex items-center justify-center mb-2 sm:mb-3">
                  <Database className="w-4 h-4 sm:w-5 sm:h-5 text-gw-primary" />
                </div>
                <div className="text-sm sm:text-base font-bold mb-1">Fetch Sources</div>
                <div className="text-[11px] sm:text-xs text-gw-accent mb-3 sm:mb-4 leading-relaxed">Poll NAVAREA coordinators via HTTPS.</div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-gw-secondary">
                  <div><div className="text-[9px] sm:text-[10px] uppercase text-gw-accent">ENABLED</div><div className="text-sm sm:text-base font-bold mt-0.5">{sources.filter(s => s.enabled).length}/{sources.length}</div></div>
                  <div><div className="text-[9px] sm:text-[10px] uppercase text-gw-accent">LATENCY</div><div className="text-sm sm:text-base font-bold mt-0.5">412ms</div></div>
                </div>
                <div className="mt-3 flex justify-end items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>READY
                </div>
              </div>

              <div className="relative bg-gw-bg border border-gw-secondary rounded-lg p-3.5 sm:p-4 pt-4 sm:pt-5">
                <div className="absolute top-0 left-0 w-full h-1 bg-gw-primary rounded-t-lg"></div>
                <span className="absolute top-3 right-3 sm:right-4 text-[10px] font-bold text-gw-accent">02</span>
                <div className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-gw-primary rounded flex items-center justify-center mb-2 sm:mb-3">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gw-primary" />
                </div>
                <div className="text-sm sm:text-base font-bold mb-1">Parse & Normalize</div>
                <div className="text-[11px] sm:text-xs text-gw-accent mb-3 sm:mb-4 leading-relaxed">Tokenize raw text into structured records.</div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-gw-secondary">
                  <div><div className="text-[9px] sm:text-[10px] uppercase text-gw-accent">ACCURACY</div><div className="text-sm sm:text-base font-bold mt-0.5">100%</div></div>
                  <div><div className="text-[9px] sm:text-[10px] uppercase text-gw-accent">CONFIDENCE</div><div className="text-sm sm:text-base font-bold mt-0.5">98.6%</div></div>
                </div>
                <div className="mt-3 flex justify-end items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>OK
                </div>
              </div>

              <div className="relative bg-gw-bg border border-gw-secondary rounded-lg p-3.5 sm:p-4 pt-4 sm:pt-5">
                <div className="absolute top-0 left-0 w-full h-1 bg-gw-primary rounded-t-lg"></div>
                <span className="absolute top-3 right-3 sm:right-4 text-[10px] font-bold text-gw-accent">03</span>
                <div className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-gw-primary rounded flex items-center justify-center mb-2 sm:mb-3">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-gw-primary" />
                </div>
                <div className="text-sm sm:text-base font-bold mb-1">Geocode Geometry</div>
                <div className="text-[11px] sm:text-xs text-gw-accent mb-3 sm:mb-4 leading-relaxed">Extract lat/lon points, polygons, circles.</div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-gw-secondary">
                  <div><div className="text-[9px] sm:text-[10px] uppercase text-gw-accent">REGEX</div><div className="text-sm sm:text-base font-bold mt-0.5">84%</div></div>
                  <div><div className="text-[9px] sm:text-[10px] uppercase text-gw-accent">GEMINI AI</div><div className="text-sm sm:text-base font-bold mt-0.5">16%</div></div>
                </div>
                <div className="mt-3 flex justify-end items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>OK
                </div>
              </div>

              <div className="relative bg-gw-bg border border-gw-secondary rounded-lg p-3.5 sm:p-4 pt-4 sm:pt-5">
                <div className="absolute top-0 left-0 w-full h-1 bg-gw-primary rounded-t-lg"></div>
                <span className="absolute top-3 right-3 sm:right-4 text-[10px] font-bold text-gw-accent">04</span>
                <div className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-gw-primary rounded flex items-center justify-center mb-2 sm:mb-3">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-gw-primary" />
                </div>
                <div className="text-sm sm:text-base font-bold mb-1">Publish Generation</div>
                <div className="text-[11px] sm:text-xs text-gw-accent mb-3 sm:mb-4 leading-relaxed">Atomic pointer swap to active warnings.</div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-gw-secondary">
                  <div><div className="text-[9px] sm:text-[10px] uppercase text-gw-accent">WRITTEN</div><div className="text-sm sm:text-base font-bold mt-0.5">ATOMIC</div></div>
                  <div><div className="text-[9px] sm:text-[10px] uppercase text-gw-accent">LATENCY</div><div className="text-sm sm:text-base font-bold mt-0.5">&lt;10ms</div></div>
                </div>
                <div className="mt-3 flex justify-end items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>SEALED
                </div>
              </div>
            </div>
          </div>

          {/* Logs Card */}
          <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden shadow-sm">
            <div className="flex justify-between items-center px-4 sm:px-6 py-3.5 sm:py-4 border-b-2 border-gw-primary">
              <div className="text-base sm:text-lg font-bold uppercase tracking-wider flex items-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-7 sm:h-7 border border-gw-primary rounded flex items-center justify-center shrink-0">
                  <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gw-primary" />
                </div>
                Ingestion Terminal Logs
              </div>
            </div>
            <div className="px-3 sm:px-6 py-3 sm:py-4 text-[11px] sm:text-xs bg-gw-primary text-gw-secondary max-h-[280px] overflow-y-auto overflow-x-auto no-scrollbar font-mono">
              {MOCK_LOGS.map((log, i) => (
                <div key={i} className="flex gap-2 sm:gap-4 py-1 border-b border-dashed border-gw-tertiary last:border-b-0 min-w-[500px] sm:min-w-0">
                  <span className="text-gw-accent shrink-0">{log.t}</span>
                  <span className={`font-bold w-12 shrink-0 ${
                    log.lvl === 'info' ? 'text-sky-400' :
                    log.lvl === 'ok' ? 'text-green-400' :
                    log.lvl === 'warn' ? 'text-amber-400' : 'text-red-400'
                  }`}>{log.lvl.toUpperCase()}</span>
                  <span className="truncate">{log.msg}</span>
                </div>
              ))}
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


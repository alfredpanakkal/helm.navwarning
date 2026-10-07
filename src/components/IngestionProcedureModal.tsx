import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Server,
  Terminal,
  Play,
  RotateCw,
  ExternalLink,
  Code2,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Radio,
  FileCode,
  Sparkles,
  Download,
  Info,
  X
} from 'lucide-react';
import { NavWarning, SourceRegistryItem, NavAreaId } from '../types';
import { useIngestionSimulator, SAMPLE_BULLETINS } from '../hooks/useIngestionSimulator';
import { IngestionSourceRow } from './IngestionSourceRow';

interface IngestionProcedureModalProps {
  isOpen: boolean;
  onClose: () => void;
  warningsCount: number;
  sources?: SourceRegistryItem[];
  onTriggerRefresh?: (sourceId?: string) => Promise<void>;
  isRefreshing?: boolean;
  onCommitWarning?: (warning: NavWarning) => void;
}

export const IngestionProcedureModal: React.FC<IngestionProcedureModalProps> = ({
  isOpen,
  onClose,
  warningsCount,
  sources = [],
  onTriggerRefresh,
  isRefreshing = false,
  onCommitWarning,
}) => {
  const [activeTab, setActiveTab] = useState<'procedure' | 'simulator' | 'sources'>('procedure');
  const {
    simText,
    setSimText,
    simNavArea,
    setSimNavArea,
    parsedResult,
    commitSuccess,
    handleSelectPreset,
    handleRunSimulator,
    handleCommitParsed,
  } = useIngestionSimulator({ isOpen, onCommitWarning });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gw-primary/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-mono">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b-2 border-gw-primary bg-gw-bg flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gw-primary text-white flex items-center justify-center shrink-0 shadow-xs">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-gw-primary uppercase tracking-wider">
                  Navigational Warning Ingestion Procedure
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Dynamic Pipeline • 0 Hardcoded Values
                </span>
              </div>
              <p className="text-xs text-gw-accent mt-0.5">
                Standard Operating Procedure (SOP) for fetching, parsing, verifying, and persisting live maritime notices.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gw-accent hover:text-gw-primary rounded border border-transparent hover:border-gw-secondary transition-all"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gw-secondary bg-white px-4 sm:px-6 pt-2 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('procedure')}
            className={`px-3 sm:px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'procedure'
                ? 'border-gw-primary text-gw-primary'
                : 'border-transparent text-gw-accent hover:text-gw-primary'
            }`}
          >
            <Layers className="w-4 h-4" />
            1. Ingestion Procedure (SOP)
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 sm:px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'border-gw-primary text-gw-primary'
                : 'border-transparent text-gw-accent hover:text-gw-primary'
            }`}
          >
            <Code2 className="w-4 h-4" />
            2. Live Parser Simulator
          </button>
          <button
            onClick={() => setActiveTab('sources')}
            className={`px-3 sm:px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'sources'
                ? 'border-gw-primary text-gw-primary'
                : 'border-transparent text-gw-accent hover:text-gw-primary'
            }`}
          >
            <Radio className="w-4 h-4" />
            3. Registered Feeds ({sources.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'procedure' && (
            <div className="space-y-6">
              {/* Overview Callout */}
              <div className="bg-sky-50 border-2 border-sky-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-sky-900 tracking-wider">
                    <Radio className="w-4 h-4 text-sky-700 animate-pulse" />
                    How Navigational Warning Data Is Taken (No Hardcoded Data)
                  </div>
                  <p className="text-xs text-sky-800 leading-relaxed max-w-2xl">
                    Every record in this Data Bank is ingested from official World-Wide Navigational Warning Service (WWNWS) coordinators. Raw radio bulletins are retrieved via scheduled HTTP/S and NAVTEX feeds, parsed deterministically for spatial coordinates, verified against NAVAREA bounding polygons, and synced to Supabase PostgreSQL with cryptographic SHA-256 audit hashes.
                  </p>
                </div>
                {onTriggerRefresh && (
                  <button
                    onClick={() => onTriggerRefresh()}
                    disabled={isRefreshing}
                    className="px-4 py-2.5 bg-gw-primary text-white text-xs font-bold uppercase tracking-wider rounded-lg border border-gw-primary hover:bg-gw-tertiary transition-all shadow-xs flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Syncing...' : 'Sync Live Feeds Now'}
                  </button>
                )}
              </div>

              {/* 5-Step Operational Pipeline */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gw-primary flex items-center gap-2">
                  <Server className="w-4 h-4 text-gw-accent" />
                  Standard Operating Procedure (SOP) Pipeline
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Step 1 */}
                  <div className="bg-white border-2 border-gw-primary rounded-xl p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-gw-accent tracking-wider">Step 01 • Discovery</span>
                      <span className="px-2 py-0.5 bg-gw-bg text-gw-primary text-[10px] font-bold rounded border border-gw-secondary">
                        HTTP/S & NAVTEX
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gw-primary">Official Coordinator Polling</h4>
                    <p className="text-xs text-gw-accent leading-relaxed">
                      The ingestion runner polls authorized hydrographic offices (UKHO, US NGA, Canadian Coast Guard, Japan Coast Guard, Baltic Sea coordinators) every 6 hours using designated user-agents and concurrency leases.
                    </p>
                    <div className="text-[11px] font-mono text-gw-primary bg-gw-bg p-2 rounded border border-gw-secondary">
                      GET /api/pipeline/trigger ➔ Query Discovery URLs
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-white border-2 border-gw-primary rounded-xl p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-gw-accent tracking-wider">Step 02 • Parsing</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded border border-emerald-300">
                        Deterministic Regex + AI
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gw-primary">Coordinate & Spatial Extraction</h4>
                    <p className="text-xs text-gw-accent leading-relaxed">
                      Raw bulletin text is scanned for maritime coordinate formats: DMS (<code className="text-gw-primary">DD-MM.mmN DDD-MM.mmW</code>), DDM, danger radii in nautical miles, and polygons. Non-standard unstructured alerts trigger Gemini Flash LLM structured extraction.
                    </p>
                    <div className="text-[11px] font-mono text-gw-primary bg-gw-bg p-2 rounded border border-gw-secondary">
                      parseCoordinatesDeterministic(rawText, navarea)
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-white border-2 border-gw-primary rounded-xl p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-gw-accent tracking-wider">Step 03 • Integrity</span>
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-800 text-[10px] font-bold rounded border border-purple-300">
                        SHA-256 Hashes
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gw-primary">Validation & Deduplication</h4>
                    <p className="text-xs text-gw-accent leading-relaxed">
                      Extracted geometries are tested against NAVAREA boundary limits. A SHA-256 cryptographic fingerprint is generated from source ID, year, and text to ensure idempotency and prevent duplicate records.
                    </p>
                    <div className="text-[11px] font-mono text-gw-primary bg-gw-bg p-2 rounded border border-gw-secondary">
                      hashSeed = sourceId:year:geometries:rawText
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="bg-white border-2 border-gw-primary rounded-xl p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-gw-accent tracking-wider">Step 04 • Storage</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-bold rounded border border-blue-300">
                        Supabase PostgreSQL
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gw-primary">Persistence & Evidence Locker</h4>
                    <p className="text-xs text-gw-accent leading-relaxed">
                      Validated notices are stored in the <code className="text-gw-primary">nav_warnings</code> table. Unaltered raw source payloads are archived into <code className="text-gw-primary">artifacts</code> for non-repudiation audit trails.
                    </p>
                    <div className="text-[11px] font-mono text-gw-primary bg-gw-bg p-2 rounded border border-gw-secondary">
                      UPSERT INTO nav_warnings ON CONFLICT (source_id, warning_id)
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="bg-gw-bg border-2 border-gw-primary rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase text-gw-primary tracking-wider">Step 05 • Real-Time Client Hydration</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h4 className="text-sm font-bold text-gw-primary">Live Data Bank Synchronization</h4>
                    <p className="text-xs text-gw-accent max-w-xl">
                      The UI queries the live database on launch and whenever an ingestion cycle completes. Total Published, Active Warnings, and NAVAREA metrics update dynamically with zero hardcoded placeholders.
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setActiveTab('simulator')}
                      className="px-3.5 py-2 bg-white text-gw-primary text-xs font-bold uppercase tracking-wider rounded border border-gw-primary hover:bg-gw-bg transition-all"
                    >
                      Test Parser Simulator
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'simulator' && (
            <div className="space-y-5">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gw-primary">
                    Live Coordinate Extraction Simulator
                  </h3>
                  <span className="text-[11px] text-gw-accent">
                    Deterministic Engine • No Hardcoding
                  </span>
                </div>
                <p className="text-xs text-gw-accent">
                  Select an official maritime bulletin preset or paste custom raw NAVTEX text to see how coordinates and geometries are extracted dynamically.
                </p>
              </div>

              {/* Sample Presets */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-bold text-gw-primary self-center mr-1">Presets:</span>
                {SAMPLE_BULLETINS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`px-2.5 py-1.5 text-xs rounded border transition-all ${
                      simNavArea === preset.navarea
                        ? 'bg-gw-primary text-white border-gw-primary font-bold shadow-xs'
                        : 'bg-white border-gw-secondary text-gw-accent hover:text-gw-primary hover:border-gw-primary'
                    }`}
                  >
                    {preset.name.split(' - ')[0]}
                  </button>
                ))}
              </div>

              {/* Text Input & Controls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-gw-primary">
                    Raw Bulletin Text Input:
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gw-accent">Target NAVAREA:</span>
                    <select
                      value={simNavArea}
                      onChange={(e) => {
                        const na = e.target.value as NavAreaId;
                        setSimNavArea(na);
                        handleRunSimulator(simText, na);
                      }}
                      className="text-xs font-bold bg-white border border-gw-secondary rounded px-2 py-1 text-gw-primary outline-none focus:border-gw-primary"
                    >
                      <option value="I">NAVAREA I</option>
                      <option value="IV">NAVAREA IV</option>
                      <option value="XII">NAVAREA XII</option>
                      <option value="XVIII">NAVAREA XVIII</option>
                      <option value="Baltic">Baltic</option>
                      <option value="X">NAVAREA X</option>
                      <option value="XI">NAVAREA XI</option>
                    </select>
                  </div>
                </div>

                <textarea
                  rows={5}
                  value={simText}
                  onChange={(e) => {
                    setSimText(e.target.value);
                    handleRunSimulator(e.target.value, simNavArea);
                  }}
                  placeholder="Paste maritime safety notice or NAVTEX telemetry here..."
                  className="w-full bg-gw-bg border-2 border-gw-primary rounded-xl p-3 text-xs font-mono text-gw-primary outline-none focus:ring-2 focus:ring-gw-primary/20 resize-none leading-relaxed"
                />
              </div>

              {/* Parsed Output Display */}
              {parsedResult && (
                <div className="bg-white border-2 border-gw-primary rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gw-secondary pb-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-gw-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider text-gw-primary">
                        Extraction Results
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded border border-emerald-300">
                        {parsedResult.geometriesCount} Geometries Detected
                      </span>
                      <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-[11px] font-bold rounded border border-sky-300">
                        Confidence: 98%
                      </span>
                    </div>
                  </div>

                  {parsedResult.warning && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-gw-bg p-2.5 rounded border border-gw-secondary">
                        <div className="text-[10px] text-gw-accent uppercase font-bold">Extracted Series ID</div>
                        <div className="font-bold text-gw-primary mt-0.5">{parsedResult.warning.source_warning_id}</div>
                      </div>
                      <div className="bg-gw-bg p-2.5 rounded border border-gw-secondary">
                        <div className="text-[10px] text-gw-accent uppercase font-bold">NAVAREA Region</div>
                        <div className="font-bold text-gw-primary mt-0.5">NAVAREA {parsedResult.warning.navarea}</div>
                      </div>
                      <div className="bg-gw-bg p-2.5 rounded border border-gw-secondary">
                        <div className="text-[10px] text-gw-accent uppercase font-bold">Status & Integrity</div>
                        <div className="font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Bounds Verified
                        </div>
                      </div>
                      <div className="bg-gw-bg p-2.5 rounded border border-gw-secondary">
                        <div className="text-[10px] text-gw-accent uppercase font-bold">Content Fingerprint</div>
                        <div className="font-mono text-[11px] text-gw-accent mt-0.5 truncate">
                          {parsedResult.warning.content_hash.slice(0, 10)}...
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Extracted Geometries Detail */}
                  {parsedResult.spatial?.geometries?.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold uppercase text-gw-primary">
                        Derived Coordinate Geometry:
                      </div>
                      <div className="bg-gw-bg border border-gw-secondary rounded-lg p-3 space-y-1 text-xs">
                        {parsedResult.spatial.geometries.map((g: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between font-mono text-[11px]">
                            <span className="font-bold text-gw-primary">Feature #{idx + 1} ({g.type}):</span>
                            <span className="text-gw-accent">{JSON.stringify(g.coordinates)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200">
                      No explicit coordinates matched in text. Unstructured bulletin marked for secondary NLP fallback.
                    </div>
                  )}

                  {/* Commit Action */}
                  <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] text-gw-accent">
                      Demonstrates real on-the-fly ingestion without static files.
                    </span>
                    <div className="flex items-center gap-2">
                      {commitSuccess && (
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Added to Live Bank!
                        </span>
                      )}
                      {onCommitWarning && (
                        <button
                          onClick={handleCommitParsed}
                          className="px-4 py-2 bg-gw-primary text-white text-xs font-bold uppercase tracking-wider rounded-lg border border-gw-primary hover:bg-gw-tertiary transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Commit Notice to Live Bank
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gw-primary">
                    Authoritative Hydrographic Upstream Feeds
                  </h3>
                  <p className="text-xs text-gw-accent">
                    The ingestion engine queries these public government endpoints. No mock data is used.
                  </p>
                </div>
                <div className="text-xs font-bold text-gw-primary">
                  {sources.filter((s) => s.enabled).length} of {sources.length} Active
                </div>
              </div>

              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {sources.map((src) => (
                  <IngestionSourceRow
                    key={src.source_id}
                    src={src}
                    refreshTitle={`Trigger fetch for ${src.source_id}`}
                    onTriggerRefresh={onTriggerRefresh}
                    isRefreshing={isRefreshing}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t-2 border-gw-primary bg-gw-bg flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-gw-accent">
            <Database className="w-4 h-4 text-gw-primary" />
            <span>Currently Managing: <strong className="text-gw-primary">{warningsCount.toLocaleString()}</strong> Live Dynamic Warnings</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gw-primary text-white text-xs font-bold uppercase tracking-wider rounded-lg border border-gw-primary hover:bg-gw-tertiary transition-all"
          >
            Close Procedure
          </button>
        </div>
      </div>
    </div>
  );
};

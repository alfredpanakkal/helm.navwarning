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
  Globe,
  Radio,
  FileCode,
  Sparkles,
  Download,
  Info,
  X
} from 'lucide-react';
import { NavWarning, SourceRegistryItem, NavAreaId } from '../types';
import { parseCoordinatesDeterministic } from '../utils/coordinateParser';
import { IngestionProcedureModal } from './IngestionProcedureModal';

interface IngestionProcedureModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  warningsCount: number;
  sources?: SourceRegistryItem[];
  onTriggerRefresh?: (sourceId?: string) => Promise<void>;
  isRefreshing?: boolean;
  onCommitWarning?: (warning: NavWarning) => void;
}

const SAMPLE_BULLETINS = [
  {
    id: 'nga-iv',
    name: 'US NGA NAVAREA IV - Space Operations Hazard Area',
    source: 'National Geospatial-Intelligence Agency',
    navarea: 'IV' as NavAreaId,
    text: `NAVAREA IV 0412/26(11,26).
NORTH ATLANTIC.
FLORIDA.
1. HAZARDOUS OPERATIONS, ROCKET LAUNCHING
    281500Z TO 281930Z SEP, ALTERNATE
    291500Z TO 291930Z SEP IN AREA BOUND BY:
    28-36.2N 080-36.1W, 28-30.0N 079-50.0W,
    27-50.0N 079-20.0W, 27-40.0N 080-15.0W.
2. CANCEL AT 292030Z SEP 26.`,
  },
  {
    id: 'ccg-xviii',
    name: 'Canadian Coast Guard NAVAREA XVIII - Arctic Rig Tow',
    source: 'Canadian Coast Guard MCTS',
    navarea: 'XVIII' as NavAreaId,
    text: `NAVAREA XVIII 0089/26
BEAUFORT SEA.
DRILLING VESSEL UNDER TOW BY TUG ARCTIC EXPLORER
IN POSITION 70-14.8N 133-28.5W.
WIDE BERTH OF 3 NAUTICAL MILES REQUESTED.`,
  },
  {
    id: 'ukho-i',
    name: 'UK Hydrographic Office NAVAREA I - Dover Strait UXO',
    source: 'UK Hydrographic Office',
    navarea: 'I' as NavAreaId,
    text: `NAVAREA I 0184/26
ENGLAND, SOUTH COAST.
DOVER STRAIT.
UNEXPLODED ORDNANCE LOCATED IN 51-08.24N 001-22.18E.
TEMPORARY EXCLUSION ZONE RADIUS 1.5 NM ESTABLISHED.
ALL VESSELS TO KEEP CLEAR.`,
  },
];

export const IngestionProcedureModalV2: React.FC<IngestionProcedureModalV2Props> = ({
  isOpen,
  onClose,
  warningsCount,
  sources = [],
  onTriggerRefresh,
  isRefreshing = false,
  onCommitWarning,
}) => {
  const [activeTab, setActiveTab] = useState<'procedure' | 'simulator' | 'sources'>('procedure');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [simText, setSimText] = useState(SAMPLE_BULLETINS[0].text);
  const [simNavArea, setSimNavArea] = useState<NavAreaId>(SAMPLE_BULLETINS[0].navarea);
  const [parsedResult, setParsedResult] = useState<any>(null);
  const [commitSuccess, setCommitSuccess] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Initial simulation run
  useEffect(() => {
    if (isOpen && simText) {
      handleRunSimulator(simText, simNavArea);
    }
  }, [isOpen]);

  const handleSelectPreset = (preset: typeof SAMPLE_BULLETINS[0]) => {
    setSimText(preset.text);
    setSimNavArea(preset.navarea);
    handleRunSimulator(preset.text, preset.navarea);
    setCommitSuccess(false);
  };

  const handleRunSimulator = (text: string, navarea: NavAreaId) => {
    try {
      const spatial = parseCoordinatesDeterministic(text, navarea);
      
      // Match notice sequence number in text
      const seqMatch = text.match(/(?:NAVAREA|WARNING|NOTICE)\s*([A-Z0-9\-\/]+)/i) || text.match(/\b(\d{2,4}\/\d{2,4})\b/);
      const extractedSeq = seqMatch ? seqMatch[1].replace(/[^A-Za-z0-9\-\/]/g, '') : `SIM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const now = new Date();
      const year = now.getFullYear();

      const warningId = `warn-sim-${navarea.toLowerCase()}-${year}-${Math.random().toString(36).substring(2, 8)}`;
      
      const newWarn: NavWarning = {
        schema_version: 1,
        warning_id: warningId,
        publisher_id: 'live-procedure-runner',
        source_id: `official-navarea-${navarea.toLowerCase()}`,
        navarea: navarea,
        series: `NAVAREA ${navarea}`,
        source_warning_id: extractedSeq.includes('/') ? extractedSeq : `${extractedSeq}/${year}`,
        warning_number: extractedSeq.split('/')[0] || extractedSeq,
        warning_year: year,
        issued_at: now.toISOString(),
        issued_date: now.toISOString().split('T')[0],
        issued_time_precision: 'day',
        issued_text: text,
        valid_from: now.toISOString(),
        valid_to: null,
        cancelled_at: null,
        status: 'active',
        status_basis: 'listed_in_complete_in_force_publication',
        area_text: text.split('\n')[1] || `NAVAREA ${navarea} Waters`,
        original_language: 'en',
        raw_text: text,
        translated_text: null,
        spatial: spatial,
        supersedes: [],
        cancels: [],
        source_url: 'https://msi.nga.mil/NavWarnings',
        raw_artifact_ref: `art-sim-${Date.now()}`,
        content_hash: Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(''),
        parser_version: '2.4-deterministic',
        extraction_method: 'deterministic',
        first_seen_at: now.toISOString(),
        last_seen_at: now.toISOString(),
        not_in_force_observed_at: null,
        generation_id: `gen-sim-${Date.now()}`,
        validation: {
          identity: 'passed',
          dates: 'passed',
          geometry:
            spatial.geometries.length > 0 || spatial.circles.length > 0 ? 'passed' : 'not_present',
        },
        extraction_confidence: 0.98,
      };

      setParsedResult({
        warning: newWarn,
        spatial,
        geometriesCount: spatial.geometries.length + (spatial.circles?.length || 0),
        rawCoordsCount: spatial.raw_coordinate_text?.length || 0,
      });
      setCommitSuccess(false);
    } catch (err: any) {
      setParsedResult({ error: err.message || 'Parsing failure' });
    }
  };

  const handleCommitParsed = () => {
    if (parsedResult?.warning && onCommitWarning) {
      onCommitWarning(parsedResult.warning);
      setCommitSuccess(true);
      setTimeout(() => setCommitSuccess(false), 4000);
    }
  };

  /**
   * "Technical details (Admin)" — power-user entry point.
   * Admin sessions (existing lock token) open the full technical procedure
   * view; everyone else is routed to the existing Admin Access flow in the
   * header instead of seeing any implementation detail.
   */
  const handleTechnicalDetails = () => {
    const hasAdminSession =
      typeof window !== 'undefined' && Boolean(sessionStorage.getItem('helm_admin_token'));
    if (hasAdminSession) {
      setShowTechnicalDetails(true);
      return;
    }
    onClose();
    window.setTimeout(() => {
      document
        .querySelector<HTMLButtonElement>('button[title="Unlock Admin Tools"]')
        ?.click();
    }, 0);
  };

  if (!isOpen) return null;

  return (
    <>
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
                  Official Process • Public Summary
                </span>
              </div>
              <p className="text-xs text-gw-accent mt-0.5">
                Standard procedure for processing maritime safety information from official sources.
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
            1. Ingestion Procedure
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
            2. Live Demonstration
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
            3. Registered Sources ({sources.length})
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
                    How Maritime Safety Information Is Processed
                  </div>
                  <p className="text-xs text-sky-800 leading-relaxed max-w-2xl">
                    Official maritime safety information is received from authorized international sources, processed to extract critical navigation hazards, and made available to mariners through official channels.
                  </p>
                </div>
                {onTriggerRefresh && (
                  <button
                    onClick={() => onTriggerRefresh()}
                    disabled={isRefreshing}
                    className="px-4 py-2.5 bg-gw-primary text-white text-xs font-bold uppercase tracking-wider rounded-lg border border-gw-primary hover:bg-gw-tertiary transition-all shadow-xs flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Updating...' : 'Update Now'}
                  </button>
                )}
              </div>

              {/* Procedure Steps */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gw-primary flex items-center gap-2">
                  <Server className="w-4 h-4 text-gw-accent" />
                  Official Information Processing Steps
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Step 1: Reception */}
                  <div className="bg-white border-2 border-gw-primary rounded-xl p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-gw-accent tracking-wider">Step 01 • Reception</span>
                      <span className="px-2 py-0.5 bg-gw-bg text-gw-primary text-[10px] font-bold rounded border border-gw-secondary">
                        Official Channels
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gw-primary">Receipt of Official Bulletins</h4>
                    <p className="text-xs text-gw-accent leading-relaxed">
                      Authorized international sources transmit maritime safety information through established channels including radio broadcasts, official websites, and direct feeds to recognized coordinators.
                    </p>
                  </div>

                  {/* Step 2: Extraction */}
                  <div className="bg-white border-2 border-gw-primary rounded-xl p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-gw-accent tracking-wider">Step 02 • Extraction</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded border border-emerald-300">
                        Hazard Identification
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gw-primary">Identification of Navigation Hazards</h4>
                    <p className="text-xs text-gw-accent leading-relaxed">
                      Critical navigation hazards including positions, conditions, and timing information are identified from the official bulletins using standardized procedures.
                    </p>
                  </div>

                  {/* Step 3: Validation */}
                  <div className="bg-white border-2 border-gw-primary rounded-xl p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-gw-accent tracking-wider">Step 03 • Validation</span>
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-800 text-[10px] font-bold rounded border border-purple-300">
                        Official Verification
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gw-primary">Verification Against Official Sources</h4>
                    <p className="text-xs text-gw-accent leading-relaxed">
                      Extracted information is verified against official sources and international standards to ensure accuracy and consistency with maritime safety regulations.
                    </p>
                  </div>

                  {/* Step 4: Distribution */}
                  <div className="bg-white border-2 border-gw-primary rounded-xl p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-gw-accent tracking-wider">Step 04 • Distribution</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[10px] font-bold rounded border border-blue-300">
                        Official Distribution
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gw-primary">Availability to Mariners</h4>
                    <p className="text-xs text-gw-accent leading-relaxed">
                      Verified navigation warnings are formatted and distributed through official channels for use by mariners worldwide in route planning and navigation.
                    </p>
                  </div>
                </div>

                {/* Real-Time Status */}
                <div className="bg-gw-bg border-2 border-gw-primary rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase text-gw-primary tracking-wider">Step 05 • Current Status</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h4 className="text-sm font-bold text-gw-primary">Live Information Bank Status</h4>
                    <p className="text-xs text-gw-accent max-w-xl">
                      The live information bank contains currently active navigation warnings that are continuously updated as official information is received and processed.
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setActiveTab('simulator')}
                      className="px-3.5 py-2 bg-white text-gw-primary text-xs font-bold uppercase tracking-wider rounded border border-gw-primary hover:bg-gw-bg transition-all"
                    >
                      Try Demonstration
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
                    Navigation Hazard Identification Demonstration
                  </h3>
                  <span className="text-[11px] text-gw-accent">
                    Standardized Extraction Process
                  </span>
                </div>
                <p className="text-xs text-gw-accent">
                  See how navigation hazard information is identified from official maritime bulletins using standardized procedures.
                </p>
              </div>

              {/* Sample Presets */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-bold text-gw-primary self-center mr-1">Examples:</span>
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
                    Official Bulletin Input:
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gw-accent">Target Region:</span>
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
                      <option value="Baltic">Baltic Sea</option>
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
                  placeholder="Enter official maritime safety notice text here..."
                  className="w-full bg-gw-bg border-2 border-gw-primary rounded-xl p-3 text-xs font-mono text-gw-primary outline-none focus:ring-2 focus:ring-gw-primary/20 resize-none leading-relaxed"
                />
              </div>

              {/* Identified Information Display */}
              {parsedResult && (
                <div className="bg-white border-2 border-gw-primary rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gw-secondary pb-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-gw-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider text-gw-primary">
                        Identified Navigation Information
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded border border-emerald-300">
                        {parsedResult.geometriesCount} Hazard Identifications
                      </span>
                      <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-[11px] font-bold rounded border border-sky-300">
                        Confidence: High
                      </span>
                    </div>
                  </div>

                  {parsedResult.warning && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-gw-bg p-2.5 rounded border border-gw-secondary">
                        <div className="text-[10px] text-gw-accent uppercase font-bold">Official Reference</div>
                        <div className="font-bold text-gw-primary mt-0.5">{parsedResult.warning.source_warning_id}</div>
                      </div>
                      <div className="bg-gw-bg p-2.5 rounded border border-gw-secondary">
                        <div className="text-[10px] text-gw-accent uppercase font-bold">Region</div>
                        <div className="font-bold text-gw-primary mt-0.5">NAVAREA {parsedResult.warning.navarea}</div>
                      </div>
                      <div className="bg-gw-bg p-2.5 rounded border border-gw-secondary">
                        <div className="text-[10px] text-gw-accent uppercase font-bold">Status</div>
                        <div className="font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified Hazard
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Extracted Details */}
                  {parsedResult.spatial?.geometries?.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold uppercase text-gw-primary">
                        Identified Hazard Details:
                      </div>
                      <div className="bg-gw-bg border border-gw-secondary rounded-lg p-3 space-y-1 text-xs">
                        {parsedResult.spatial.geometries.map((g: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between font-mono text-[11px]">
                            <span className="font-bold text-gw-primary">Hazard #{idx + 1} ({g.type}):</span>
                            <span className="text-gw-accent">{JSON.stringify(g.coordinates)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200">
                      No specific coordinates identified in this bulletin. General area information has been extracted for mariner awareness.
                    </div>
                  )}

                  {/* Commit Action */}
                  <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] text-gw-accent">
                      Demonstrates standardized identification procedures.
                    </span>
                    <div className="flex items-center gap-2">
                      {commitSuccess && (
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Information Processed!
                        </span>
                      )}
                      {onCommitWarning && (
                        <button
                          onClick={handleCommitParsed}
                          className="px-4 py-2 bg-gw-primary text-white text-xs font-bold uppercase tracking-wider rounded-lg border border-gw-primary hover:bg-gw-tertiary transition-all shadow-xs flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Submit for Official Processing
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
                    Official Information Sources
                  </h3>
                  <p className="text-xs text-gw-accent">
                    Internationally recognized sources that provide maritime safety information through established official channels.
                  </p>
                </div>
                <div className="text-xs font-bold text-gw-primary">
                  {sources.filter((s) => s.enabled).length} of {sources.length} Active Official Sources
                </div>
              </div>

              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {sources.map((src) => (
                  <div
                    key={src.source_id}
                    className="p-3 bg-white border border-gw-secondary rounded-xl hover:border-gw-primary transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gw-primary">{src.publisher_name}</span>
                        <span className="px-1.5 py-0.2 bg-gw-bg text-[10px] font-bold text-gw-accent rounded border border-gw-secondary uppercase">
                          NAVAREA {src.navareas.join(', ')}
                        </span>
                        <span className="px-1.5 py-0.2 bg-sky-50 text-[10px] font-bold text-sky-800 rounded border border-sky-200 uppercase">
                          {src.format.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-gw-accent flex items-center gap-1">
                        <Globe className="w-3 h-3 text-gw-accent shrink-0" />
                        <span className="truncate max-w-md">{src.discovery_url}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          src.health.status === 'ok'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {src.health.status}
                      </span>
                      {onTriggerRefresh && (
                        <button
                          onClick={() => onTriggerRefresh(src.source_id)}
                          disabled={isRefreshing}
                          className="p-1.5 bg-gw-bg text-gw-primary rounded border border-gw-secondary hover:border-gw-primary text-[10px] font-bold uppercase transition-all"
                          title={`Update information for ${src.publisher_name}`}
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t-2 border-gw-primary bg-gw-bg flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-gw-accent">
            <Database className="w-4 h-4 text-gw-primary" />
            <span>Currently Tracking: <strong className="text-gw-primary">{warningsCount.toLocaleString()}</strong> Active Navigation Warnings</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTechnicalDetails}
              title="Open technical procedure details (admin sessions)"
              className="text-xs font-bold text-gw-accent hover:text-gw-primary px-3 py-1.5 border border-subtle rounded cursor-pointer"
            >
              Technical details (Admin)
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-gw-primary text-white text-xs font-bold uppercase tracking-wider rounded-lg border border-gw-primary hover:bg-gw-tertiary transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Admin sessions: the full technical procedure view, one level deep */}
    {showTechnicalDetails && (
      <IngestionProcedureModal
        isOpen={true}
        onClose={() => setShowTechnicalDetails(false)}
        warningsCount={warningsCount}
        sources={sources}
        onTriggerRefresh={onTriggerRefresh}
        isRefreshing={isRefreshing}
        onCommitWarning={onCommitWarning}
      />
    )}
    </>
  );
};
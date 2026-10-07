import React, { useState, useEffect } from 'react';
import { SourceRegistryItem, NavWarning } from '../types';
import { ALL_NAVAREAS } from '../hooks/useDataBankModel';
import {
  Radio,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileCheck,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SourceRegistryViewV2Props {
  sources: SourceRegistryItem[];
  warnings: NavWarning[];
  initialFilter?: string;
  onToggleSource: (sourceId: string, enabled: boolean) => void;
  onTriggerRefresh: (sourceId: string) => void;
  isRefreshing: boolean;
}

const formatUtcTime = (iso: string | null): string => {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Never';
  return `${date.toISOString().slice(11, 16)} UTC`;
};

/**
 * Task 5 — progressive disclosure for the Sources view.
 *
 * Default: one short summary row ("Official Data Sources" + real counts).
 * "View source details" opens the compact registry table; the Details column
 * expands one level to the technical facts (endpoint URL, format, fallback
 * rates, health diagnostics, Run Worker) and the registry statistics fold-in
 * carries the classic overview-card counters. The legacy SourceRegistryView
 * keeps rendering unchanged on the classic path (App.tsx gates on legacyUI).
 */
export const SourceRegistryViewV2: React.FC<SourceRegistryViewV2Props> = ({
  sources,
  warnings,
  initialFilter,
  onToggleSource,
  onTriggerRefresh,
  isRefreshing,
}) => {
  const filterStatus = initialFilter === 'unverified' ? 'unverified' : 'ALL';
  const [showDetails, setShowDetails] = useState(filterStatus !== 'ALL');
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [selectedSourceForChecklist, setSelectedSourceForChecklist] =
    useState<SourceRegistryItem | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSourceForChecklist(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const visibleSources =
    filterStatus === 'unverified'
      ? sources.filter((s) => s.verification.status === 'unverified')
      : sources;

  const verifiedCount = sources.filter((s) => s.verification.status === 'verified').length;
  const unverifiedCount = sources.filter((s) => s.verification.status === 'unverified').length;
  const investigatingCount = sources.filter(
    (s) => s.verification.status === 'investigating'
  ).length;
  const activeWarningsCount = warnings.filter((w) => w.status === 'active').length;

  const lastCheckedMs = sources.reduce((max, s) => {
    const ts = s.health?.last_run_at ? Date.parse(s.health.last_run_at) : NaN;
    return !Number.isNaN(ts) && ts > max ? ts : max;
  }, 0);
  const lastCheckedLabel = lastCheckedMs > 0 ? formatUtcTime(new Date(lastCheckedMs).toISOString()) : 'Never';

  const uniqueNavareas = new Set(sources.flatMap((s) => s.navareas)).size;
  const unverifiedNavareas = Array.from(
    new Set(
      sources
        .filter((s) => s.verification.status === 'unverified')
        .flatMap((s) => s.navareas)
    )
  );
  const pollMinutes = sources.find((s) => s.poll_interval_minutes)?.poll_interval_minutes ?? 0;

  const summaryLine = `${sources.length} sources available · ${activeWarningsCount} active warnings · Last checked ${lastCheckedLabel}`;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      {!showDetails && (
        <section data-sources-summary className="bg-secondary border-subtle rounded-md">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
            <h2 className="font-bold text-gw-primary uppercase tracking-wider text-xs shrink-0">
              Official Data Sources
            </h2>
            <span className="text-[11px] text-gw-accent tabular-nums flex-1 min-w-0">
              {summaryLine}
            </span>
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="px-2.5 py-1.5 rounded border-subtle text-gw-primary font-bold text-[11px] hover:bg-gw-bg transition-all shrink-0 cursor-pointer"
            >
              View source details
            </button>
          </div>
        </section>
      )}

      {showDetails && (
        <section data-sources-details className="bg-secondary border-subtle rounded-md overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border-b border-subtle">
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              title="Back to summary"
              className="text-gw-primary hover:bg-gw-bg px-1.5 py-1 rounded transition-colors cursor-pointer"
            >
              ←
            </button>
            <h2 className="font-bold text-gw-primary uppercase tracking-wider text-xs shrink-0">
              Official Data Sources
            </h2>
            <span className="text-[11px] text-gw-accent tabular-nums flex-1 min-w-0">
              {summaryLine}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gw-primary">
              <thead className="bg-gw-bg text-gw-accent font-mono uppercase text-[10px] border-b border-subtle">
                <tr>
                  <th className="py-2.5 px-3">Authority</th>
                  <th className="py-2.5 px-3">NAVAREA</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Last checked</th>
                  <th className="py-2.5 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gw-secondary font-mono">
                {visibleSources.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 px-3 text-center text-[11px] text-gw-accent">
                      No sources match this filter.
                    </td>
                  </tr>
                )}
                {visibleSources.map((src) => {
                  const isVerified = src.verification.status === 'verified';
                  const expanded = expandedSourceId === src.source_id;
                  const totalRuns = src.health?.total_runs_count || 0;
                  const llmRuns = src.health?.llm_fallback_count || 0;
                  const llmRate = totalRuns > 0 ? ((llmRuns / totalRuns) * 100).toFixed(0) : '0';

                  return (
                    <React.Fragment key={src.source_id}>
                      <tr className="hover:bg-gw-bg transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-gw-primary">
                          {src.publisher_name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="bg-gw-primary text-gw-secondary px-2 py-0.5 rounded font-bold uppercase text-[11px] whitespace-nowrap">
                            {src.navareas.join(', ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {isVerified ? (
                            <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded font-bold uppercase text-[10px]">
                              <CheckCircle2 className="w-3 h-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-900 bg-amber-100 border border-amber-400 px-2 py-0.5 rounded font-bold uppercase text-[10px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                              {src.verification.status === 'investigating'
                                ? 'Investigating'
                                : 'Unverified'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] tabular-nums">
                          {formatUtcTime(src.health?.last_run_at ?? null)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            onClick={() =>
                              setExpandedSourceId(expanded ? null : src.source_id)
                            }
                            title={expanded ? 'Hide technical details' : 'Show technical details'}
                            className="inline-flex items-center gap-1 text-gw-primary hover:bg-gw-bg px-2 py-1 rounded border border-subtle font-bold uppercase text-[10px] transition-colors cursor-pointer"
                          >
                            <span>Details</span>
                            {expanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {expanded && (
                        <tr className="bg-gw-bg">
                          <td colSpan={5} className="px-3 py-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-[11px]">
                              <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                                  Discovery endpoint
                                </div>
                                <a
                                  href={src.discovery_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-gw-primary hover:text-gw-accent hover:underline break-all flex items-center gap-1"
                                >
                                  <span className="truncate">{src.discovery_url}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              </div>
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                                  Source ID
                                </div>
                                <div className="font-mono text-gw-primary break-all">
                                  {src.source_id}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                                  Publication semantics
                                </div>
                                <div className="font-mono text-gw-primary">
                                  {src.publication_semantics} · [{src.format}]
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                                  LLM fallback rate
                                </div>
                                <div className="font-mono text-gw-primary">
                                  {llmRate}%{' '}
                                  <span className="text-gw-accent">
                                    ({llmRuns}/{totalRuns} runs)
                                  </span>
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                                  Health diagnostics
                                </div>
                                <div className="font-mono text-gw-primary">
                                  {src.health?.status ?? 'unknown'}
                                  {typeof src.health?.consecutive_failures === 'number' &&
                                    src.health.consecutive_failures > 0 &&
                                    ` · ${src.health.consecutive_failures} consecutive failures`}
                                  {src.health?.last_error && (
                                    <span className="block text-red-700 break-all">
                                      {src.health.last_error}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                                  Poll cadence
                                </div>
                                <div className="font-mono text-gw-primary">
                                  {src.poll_interval_minutes} min · stale after{' '}
                                  {src.stale_after_minutes} min
                                </div>
                              </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-subtle flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedSourceForChecklist(src)}
                                title="View Onboarding Checklist"
                                className="text-gw-primary hover:bg-gw-bg p-1.5 rounded border border-subtle transition-colors cursor-pointer"
                              >
                                <FileCheck className="w-4 h-4" />
                              </button>
                              {isVerified ? (
                                <button
                                  type="button"
                                  onClick={() => onTriggerRefresh(src.source_id)}
                                  disabled={isRefreshing}
                                  className="inline-flex items-center gap-1 bg-gw-primary hover:bg-gw-accent text-gw-secondary px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>Run Worker</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-gw-accent font-mono italic">
                                  Pending Onboarding
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Classic overview-card counters, folded into one disclosure row */}
          <div className="border-t border-subtle">
            <button
              type="button"
              aria-expanded={showStats}
              onClick={() => setShowStats((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-gw-bg transition-colors"
            >
              {showStats ? (
                <ChevronUp className="w-4 h-4 text-gw-primary shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gw-primary shrink-0" />
              )}
              <span className="font-bold text-gw-primary uppercase tracking-wider text-[11px] shrink-0">
                Registry statistics
              </span>
              <span className="text-[10px] text-gw-accent tabular-nums truncate">
                {verifiedCount} verified · {unverifiedCount} unverified
              </span>
            </button>

            {showStats && (
              <div className="px-3 pb-3 pt-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 border-t border-subtle">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                    Total NAVAREAs In Registry
                  </div>
                  <div className="text-lg font-black text-gw-primary tabular-nums font-mono">
                    {uniqueNavareas}
                  </div>
                  <div className="text-[10px] text-gw-accent">
                    {sources.length} sources · {investigatingCount} under investigation
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                    Verified Endpoints
                  </div>
                  <div className="text-lg font-black text-green-700 tabular-nums font-mono">
                    {verifiedCount}
                  </div>
                  <div className="text-[10px] text-green-800 font-bold">
                    Active Ingestion Feeds
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                    Unverified Coverage
                  </div>
                  <div className="text-lg font-black text-amber-700 tabular-nums font-mono">
                    {unverifiedCount}
                  </div>
                  <div className="text-[10px] text-amber-800 font-bold">
                    {unverifiedNavareas.length > 0
                      ? `NAVAREA ${unverifiedNavareas.join(', ')}`
                      : 'None outstanding'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                    Poll Cadence
                  </div>
                  <div className="text-lg font-black text-gw-primary tabular-nums font-mono">
                    {pollMinutes} min
                  </div>
                  <div className="text-[10px] text-gw-accent">
                    {pollMinutes / 60}-hour polling defaults
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-4 text-[10px] text-gw-accent font-mono">
                  {uniqueNavareas} of {ALL_NAVAREAS.length} NAVAREAs scaffolded ·{' '}
                  {verifiedCount} of {sources.length} sources verified
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Source Onboarding Checklist Modal */}
      {selectedSourceForChecklist && (
        <div className="fixed inset-0 z-50 bg-gw-primary/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2 border-b-2 border-gw-primary pb-3">
              <div>
                <span className="bg-gw-primary text-gw-secondary font-mono text-xs font-bold px-2.5 py-0.5 rounded uppercase">
                  NAVAREA {selectedSourceForChecklist.navareas.join(', ')}
                </span>
                <h3 className="text-base font-bold text-gw-primary mt-2 uppercase tracking-wider">
                  Source Onboarding Checklist
                </h3>
                <p className="text-xs text-gw-accent mt-0.5 font-bold">
                  {selectedSourceForChecklist.publisher_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedSourceForChecklist(null)}
                className="text-gw-accent hover:text-gw-primary font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-gw-primary max-h-[60vh] overflow-y-auto pr-1">
              <div className="p-3 bg-gw-bg rounded-lg border-primary flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-gw-primary uppercase text-[11px]">
                    1. Official Publisher Identity
                  </div>
                  <div className="text-gw-accent leading-relaxed mt-0.5">
                    Confirmed authority (e.g. Hydrographic Office or official Coast Guard).
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gw-bg rounded-lg border-primary flex items-start gap-2.5">
                <Radio className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-gw-primary uppercase text-[11px]">
                    2. Exact Publication Scope & Endpoint
                  </div>
                  <div className="text-gw-accent mt-0.5">
                    Discovery URL:{' '}
                    <span className="font-mono text-gw-primary font-bold break-all">
                      {selectedSourceForChecklist.discovery_url}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gw-bg rounded-lg border-primary flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-gw-primary uppercase text-[11px]">
                    3. In-Force Publication Semantics
                  </div>
                  <div className="text-gw-accent mt-0.5">
                    Configured mode:{' '}
                    <span className="font-mono text-gw-primary font-bold">
                      {selectedSourceForChecklist.publication_semantics}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gw-bg rounded-lg border-primary flex items-start gap-2.5">
                <FileCheck className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-gw-primary uppercase text-[11px]">
                    4. Saved Evidence Fixture & Parser Test
                  </div>
                  <div className="text-gw-accent mt-0.5">
                    Parser ID:{' '}
                    <span className="font-mono text-gw-primary font-bold">
                      {selectedSourceForChecklist.parser_id}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t-2 border-gw-primary flex justify-end">
              <button
                onClick={() => setSelectedSourceForChecklist(null)}
                className="bg-gw-primary hover:bg-gw-accent text-gw-secondary font-bold text-xs uppercase tracking-wider px-5 py-2 rounded transition-all shadow-sm"
              >
                Close Checklist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Compass } from 'lucide-react';
import { ALL_NAVAREAS, DataBankModel } from '../hooks/useDataBankModel';
import { IngestionGeneration, SourceRegistryItem } from '../types';

/** Pipeline run status styling — ingestion_generations ledger (20261023_lifecycle_safety). */
const RUN_STATUS_STYLES: Record<NonNullable<IngestionGeneration['run_status']>, { dot: string; label: string }> = {
  running: { dot: 'bg-blue-500 animate-pulse', label: 'RUNNING' },
  succeeded: { dot: 'bg-emerald-600', label: 'SUCCEEDED' },
  failed: { dot: 'bg-red-600', label: 'FAILED' },
  empty_feed: { dot: 'bg-amber-500', label: 'EMPTY FEED' },
};

/**
 * Collapsed-by-default secondary content: the executive operational brief, the
 * metric fold-ins that replace the classic stat cards, and the ingestion
 * pipeline details. The "Procedure" entry point stays on the collapsed bar so
 * it is reachable without expanding anything.
 */
export const DataBankSummary: React.FC<{
  model: DataBankModel;
  sources?: SourceRegistryItem[];
  generations?: IngestionGeneration[];
}> = ({ model, sources = [], generations = [] }) => {
  const [open, setOpen] = useState(false);
  const {
    warnings,
    analytics,
    navareaCounts,
    activeCount,
    coordsCount,
    criticalCount,
    unverifiedCount,
    recent24hCount,
    setIsProcedureModalOpen
  } = model;

  const navareaCoverage = Object.keys(navareaCounts).length;
  const enabledFeeds = sources.filter((s) => s.enabled).length;
  const lastRun = generations[0];

  return (
    <section data-databank-summary className="border border-[var(--hairline,#eef1f4)] rounded-[6px] overflow-hidden bg-transparent">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--hairline,#eef1f4)]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
        >
          {open ? (
            <ChevronUp className="w-4 h-4 text-[var(--ink-secondary,#5f6b7a)] shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--ink-secondary,#5f6b7a)] shrink-0" />
          )}
          <span className="font-medium text-[var(--ink-primary,#0b0e11)] text-xs shrink-0">
            Summary
          </span>
          <span className="text-[11px] text-[var(--ink-secondary,#5f6b7a)] truncate tabular-nums">
            {warnings.length} records · {activeCount} active · {criticalCount} high confidence ·{' '}
            {navareaCoverage}/{ALL_NAVAREAS.length} NAVAREAs
          </span>
        </button>
        <button
          type="button"
          onClick={() => setIsProcedureModalOpen(true)}
          title="View Ingestion Procedure (SOP)"
          className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] border border-[var(--border-input,#dde2e8)] text-[var(--ink-secondary,#5f6b7a)] hover:text-[var(--accent,#2b6e8c)] hover:border-[var(--accent,#2b6e8c)] font-medium text-xs transition-colors shrink-0 cursor-pointer"
        >
          <span>Procedure</span>
          <span aria-hidden="true">↗</span>
        </button>
      </div>

      {open && (
        <div className="px-3 py-3 flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded bg-gw-primary text-gw-bg flex items-center justify-center shrink-0">
              <Compass className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gw-primary flex items-center gap-2 flex-wrap">
                <span>Executive Operational Brief</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-sm bg-gw-bg border-subtle text-gw-accent">
                  {analytics.geoReferencedPct}% GPS Georeferenced
                </span>
              </h2>
              <p className="text-xs text-gw-accent mt-0.5 leading-relaxed">
                {analytics.operationalBrief}
              </p>
            </div>
          </div>

          {analytics.actionableAlerts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {analytics.actionableAlerts.map((alertText, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 rounded bg-gw-bg border border-gw-secondary text-xs text-gw-primary"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span className="leading-tight">{alertText}</span>
                </div>
              ))}
            </div>
          )}

          {/* Metric fold-ins: the classic stat-card numbers, without the cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 pt-1 border-t border-subtle">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                Total Published
              </div>
              <div className="text-lg font-black text-gw-primary tabular-nums font-mono">
                {warnings.length.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                Active In-Force
              </div>
              <div className="text-lg font-black text-gw-primary tabular-nums font-mono">
                {activeCount.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                High Confidence
              </div>
              <div className="text-lg font-black text-gw-primary tabular-nums font-mono">
                {criticalCount.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                With Coordinates
              </div>
              <div className="text-lg font-black text-gw-primary tabular-nums font-mono">
                {coordsCount.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                Unverified
              </div>
              <div className="text-lg font-black text-gw-primary tabular-nums font-mono">
                {unverifiedCount.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                Updated in Last 24h
              </div>
              <div className="text-lg font-black text-gw-primary tabular-nums font-mono">
                {recent24hCount.toLocaleString()}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                NAVAREA Coverage
              </div>
              <div className="text-lg font-black text-gw-primary tabular-nums font-mono">
                {navareaCoverage}
                <span className="text-sm text-gw-accent/70 font-bold">/{ALL_NAVAREAS.length}</span>
              </div>
            </div>
          </div>

          {generations.length > 0 && (
            <div className="pt-1 border-t border-subtle flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                  Recent Ingestion Runs — where the warnings came from
                </span>
                <span className="text-[10px] uppercase tracking-wider text-gw-accent/70 tabular-nums">
                  {generations.length} logged run{generations.length === 1 ? '' : 's'}
                </span>
              </div>
              {generations.slice(0, 5).map((gen) => {
                const style = RUN_STATUS_STYLES[gen.run_status ?? 'succeeded'];
                return (
                  <div key={gen.generation_id} className="flex items-center gap-2 text-[11px] font-mono leading-tight">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`}
                      title={style.label}
                    />
                    <span className="font-bold text-gw-primary truncate">{gen.source_id}</span>
                    {gen.navarea && (
                      <span className="text-gw-accent/70 shrink-0">{gen.navarea}</span>
                    )}
                    <span className="ml-auto text-gw-accent tabular-nums shrink-0">
                      {gen.parsed_count} parsed → {gen.active_count ?? '—'} active
                    </span>
                    <span className="text-gw-accent/60 tabular-nums shrink-0" title={gen.created_at}>
                      {gen.created_at.replace('T', ' ').slice(0, 16)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-1 border-t border-subtle flex flex-col gap-1 text-xs text-gw-accent">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  lastRun ? RUN_STATUS_STYLES[lastRun.run_status ?? 'succeeded'].dot : 'bg-emerald-600 animate-pulse'
                }`}
              />
              <span className="font-bold text-gw-primary">
                {lastRun
                  ? `Last Ingestion Run: ${RUN_STATUS_STYLES[lastRun.run_status ?? 'succeeded'].label}`
                  : enabledFeeds > 0
                  ? 'Dynamic Ingestion Pipeline Active'
                  : 'Manual Data Mode'}
              </span>
              <span>
                {lastRun
                  ? `(${lastRun.source_id} · ${lastRun.parsed_count} parsed → ${lastRun.active_count ?? '—'} active)`
                  : `(${enabledFeeds > 0 ? `${enabledFeeds} Feeds Configured` : 'No live feeds configured'})`}
              </span>
            </div>
            <div>Zero Hardcoded Data: Live WWNWS Hydrographic Feeds</div>
          </div>
        </div>
      )}
    </section>
  );
};


import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Compass } from 'lucide-react';
import { ALL_NAVAREAS, DataBankModel } from '../hooks/useDataBankModel';
import { SourceRegistryItem } from '../types';

/**
 * Collapsed-by-default secondary content: the executive operational brief, the
 * metric fold-ins that replace the classic stat cards, and the ingestion
 * pipeline details. The "Procedure" entry point stays on the collapsed bar so
 * it is reachable without expanding anything.
 */
export const DataBankSummary: React.FC<{
  model: DataBankModel;
  sources?: SourceRegistryItem[];
}> = ({ model, sources = [] }) => {
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

  return (
    <section data-databank-summary className="bg-secondary border-subtle rounded-md overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-subtle">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
        >
          {open ? (
            <ChevronUp className="w-4 h-4 text-gw-primary shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gw-primary shrink-0" />
          )}
          <span className="font-bold text-gw-primary uppercase tracking-wider text-xs shrink-0">
            Summary
          </span>
          <span className="text-[11px] text-gw-accent truncate tabular-nums">
            {warnings.length} records · {activeCount} active · {criticalCount} high confidence ·{' '}
            {navareaCoverage}/{ALL_NAVAREAS.length} NAVAREAs
          </span>
        </button>
        <button
          type="button"
          onClick={() => setIsProcedureModalOpen(true)}
          title="View Ingestion Procedure (SOP)"
          className="flex items-center gap-1 px-2 py-1 rounded border-subtle text-gw-primary font-bold uppercase tracking-wider text-[10px] hover:bg-gw-bg transition-all shrink-0 cursor-pointer"
        >
          <span>Procedure</span>
          <span aria-hidden="true">↗</span>
        </button>
      </div>

      {open && (
        <div className="px-3 py-3 flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded bg-gw-primary text-white flex items-center justify-center shrink-0">
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

          <div className="pt-1 border-t border-subtle flex flex-col gap-1 text-xs text-gw-accent">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse shrink-0" />
              <span className="font-bold text-gw-primary">
                {enabledFeeds > 0 ? 'Dynamic Ingestion Pipeline Active' : 'Deterministic Spatial Parser'}
              </span>
              <span>({enabledFeeds > 0 ? `${enabledFeeds} Feeds Configured` : 'No live feeds configured'})</span>
            </div>
            <div>Zero Hardcoded Data: Live WWNWS Hydrographic Feeds</div>
          </div>
        </div>
      )}
    </section>
  );
};

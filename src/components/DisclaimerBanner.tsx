import React, { useState } from 'react';
import { ShieldAlert, ChevronDown, ChevronUp, X } from 'lucide-react';
import { LAST_UPDATED, formatLastUpdated } from '../lib/version';

export const DisclaimerBanner: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-gw-tertiary border-b border-gw-primary relative z-[5]">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 md:px-8 py-1.5 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 bg-gw-primary border border-gw-accent text-gw-bg rounded-sm shrink-0">NOTICE</span>
              <span className="text-gw-secondary text-[11px] sm:text-xs truncate sm:whitespace-normal">
                Helm.Warning is an automated decision-support pipeline. Not a substitute for GMDSS or official MSI.
              </span>
            </div>
            <span className="hidden lg:inline text-gw-accent font-mono text-[10px] shrink-0">
              • {formatLastUpdated(LAST_UPDATED)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-2 py-1 bg-transparent border border-gw-accent rounded-sm text-[10px] font-bold uppercase text-gw-bg hover:bg-gw-primary transition-colors min-h-[28px]"
          >
            <span className="hidden sm:inline">Principles</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="p-1 text-gw-accent hover:text-gw-bg rounded min-h-[28px] flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className={`max-w-[1600px] mx-auto px-3 sm:px-6 md:px-8 overflow-hidden transition-all duration-300 ease-in-out ${expanded ? 'max-h-[500px] pb-4' : 'max-h-0'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-dashed border-gw-accent">
            <div className="bg-gw-primary border border-gw-accent rounded-sm p-3 sm:p-4">
            <div className="label-mono text-[10px] sm:text-[11px] text-gw-bg/80 mb-1.5 sm:mb-2">Verification</div>
            <div className="text-[11px] sm:text-xs text-gw-secondary leading-relaxed">An empty scraper result must never become "no warnings." Zero count publishable only with explicit empty publication.</div>
          </div>
          <div className="bg-gw-primary border border-gw-accent rounded-sm p-3 sm:p-4">
            <div className="label-mono text-[10px] sm:text-[11px] text-gw-bg/80 mb-1.5 sm:mb-2">Raw immutability</div>
            <div className="text-[11px] sm:text-xs text-gw-secondary leading-relaxed">Original source text preserved unchanged. Extractions/translations stored alongside with distinct confidence flags.</div>
          </div>
          <div className="bg-gw-primary border border-gw-accent rounded-sm p-3 sm:p-4">
            <div className="label-mono text-[10px] sm:text-[11px] text-gw-bg/80 mb-1.5 sm:mb-2">Atomic publishing</div>
            <div className="text-[11px] sm:text-xs text-gw-secondary leading-relaxed">Frontend reads published generations via source pointers. Staged generations prevent partial reads during runs.</div>
          </div>
        </div>
      </div>
    </div>
  );
};


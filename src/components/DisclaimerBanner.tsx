import React, { useState } from 'react';
import { ShieldAlert, ChevronDown, ChevronUp, X } from 'lucide-react';
import { LAST_UPDATED, formatLastUpdated } from '../lib/version';

export const DisclaimerBanner: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-[var(--surface-subtle,#fafbfc)] border-b border-[var(--hairline,#eef1f4)] relative z-[5]">
      <div className="max-w-[var(--max-width,1180px)] mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="w-4 h-4 shrink-0 text-[var(--sev-high,#c07a2b)]" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 min-w-0">
            <span className="text-[10px] font-medium tracking-wider px-1.5 py-0.5 border border-[var(--border-input,#dde2e8)] text-[var(--ink-secondary,#5f6b7a)] rounded-[4px] shrink-0 uppercase">
              Notice
            </span>
            <span className="text-[var(--ink-body,#1f2937)] text-xs truncate sm:whitespace-normal font-[450]">
              Automated navigational decision-support pipeline. Not a substitute for GMDSS or official MSI.
            </span>
            <span className="hidden lg:inline text-[var(--ink-tertiary,#8b97a5)] font-mono text-[10px] shrink-0">
              · {formatLastUpdated(LAST_UPDATED)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="flex items-center gap-1 px-2 py-0.5 bg-transparent border border-[var(--border-input,#dde2e8)] rounded-[6px] text-xs font-medium text-[var(--ink-secondary,#5f6b7a)] hover:text-[var(--ink-primary,#0b0e11)] transition-colors min-h-[26px]"
          >
            <span className="hidden sm:inline">Principles</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="p-1 text-[var(--ink-tertiary,#8b97a5)] hover:text-[var(--ink-primary,#0b0e11)] rounded min-h-[26px] flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className={`max-w-[var(--max-width,1180px)] mx-auto px-4 overflow-hidden transition-all duration-200 ease-in-out ${expanded ? 'max-h-[500px] pb-4' : 'max-h-0'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-[var(--hairline,#eef1f4)]">
          <div className="border border-[var(--hairline-alt,#f2f5f8)] rounded-[6px] p-3 bg-transparent">
            <div className="text-[11px] font-medium text-[var(--ink-primary,#0b0e11)] mb-1">Verification</div>
            <div className="text-xs text-[var(--ink-secondary,#5f6b7a)] leading-relaxed">An empty scraper result must never become "no warnings." Zero count publishable only with explicit empty publication.</div>
          </div>
          <div className="border border-[var(--hairline-alt,#f2f5f8)] rounded-[6px] p-3 bg-transparent">
            <div className="text-[11px] font-medium text-[var(--ink-primary,#0b0e11)] mb-1">Raw immutability</div>
            <div className="text-xs text-[var(--ink-secondary,#5f6b7a)] leading-relaxed">Original source text preserved unchanged. Extractions stored alongside with distinct confidence flags.</div>
          </div>
          <div className="border border-[var(--hairline-alt,#f2f5f8)] rounded-[6px] p-3 bg-transparent">
            <div className="text-[11px] font-medium text-[var(--ink-primary,#0b0e11)] mb-1">Atomic publishing</div>
            <div className="text-xs text-[var(--ink-secondary,#5f6b7a)] leading-relaxed">Frontend reads published generations via source pointers. Staged generations prevent partial reads during runs.</div>
          </div>
        </div>
      </div>
    </div>
  );
};


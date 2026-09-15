import React, { useState } from 'react';
import { ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';

export const DisclaimerBanner: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gw-tertiary border-b border-gw-primary relative z-[5]">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 md:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 text-xs sm:text-sm">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-gw-secondary" />
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
            <span className="text-[10px] sm:text-xs font-bold tracking-wider px-1.5 py-0.5 border border-gw-primary rounded shrink-0">NOTICE</span>
            <span className="text-gw-secondary truncate sm:whitespace-normal">NavWarn is not an official navigational service. Not a substitute for GMDSS or official MSI.</span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-transparent border border-gw-accent rounded text-[10px] sm:text-xs font-bold uppercase text-gw-bg transition-colors hover:bg-gw-primary hover:border-gw-primary shrink-0 min-h-[36px]"
        >
          <span>Principles</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className={`max-w-[1600px] mx-auto px-3 sm:px-6 md:px-8 overflow-hidden transition-all duration-300 ease-in-out ${expanded ? 'max-h-[500px] pb-4' : 'max-h-0'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-dashed border-gw-accent">
          <div className="bg-gw-primary border border-gw-accent rounded p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs font-bold text-gw-bg mb-1.5 sm:mb-2">01_VERIFICATION</div>
            <div className="text-[11px] sm:text-xs text-gw-secondary leading-relaxed">An empty scraper result must never become "no warnings." Zero count publishable only with explicit empty publication.</div>
          </div>
          <div className="bg-gw-primary border border-gw-accent rounded p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs font-bold text-gw-bg mb-1.5 sm:mb-2">02_RAW_IMMUTABILITY</div>
            <div className="text-[11px] sm:text-xs text-gw-secondary leading-relaxed">Original source text preserved unchanged. Extractions/translations stored alongside with distinct confidence flags.</div>
          </div>
          <div className="bg-gw-primary border border-gw-accent rounded p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs font-bold text-gw-bg mb-1.5 sm:mb-2">03_ATOMIC_PUBLISHING</div>
            <div className="text-[11px] sm:text-xs text-gw-secondary leading-relaxed">Frontend reads published generations via source pointers. Staged generations prevent partial reads during runs.</div>
          </div>
        </div>
      </div>
    </div>
  );
};

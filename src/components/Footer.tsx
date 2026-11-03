import React from 'react';
import { LAST_UPDATED, formatLastUpdated } from '../lib/version';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-16 border-t border-[var(--hairline,#eef1f4)] bg-[var(--canvas,#ffffff)] text-[var(--ink-secondary,#5f6b7a)] py-6 px-4 sm:px-6 md:pl-[236px] md:pr-8 text-xs font-sans">
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
          <span className="font-medium text-[var(--ink-primary,#0b0e11)]">Helm.Warning</span>
          <span className="hidden sm:inline text-[var(--ink-tertiary,#8b97a5)]">·</span>
          <span className="text-[11px] sm:text-xs text-[var(--ink-secondary,#5f6b7a)]">NAVAREA maritime safety information pipeline</span>
        </div>
        <div className="text-[11px] sm:text-xs text-[var(--ink-tertiary,#8b97a5)] font-mono">
          {formatLastUpdated(LAST_UPDATED)}
        </div>
      </div>
    </footer>
  );
};

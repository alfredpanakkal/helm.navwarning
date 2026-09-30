import React from 'react';
import { LAST_UPDATED, formatLastUpdated } from '../lib/version';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-12 border-t border-gw-tertiary bg-gw-primary/95 text-gw-secondary py-4 px-3 sm:px-6 md:px-8 text-xs font-mono">
      <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-zinc-500">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
          <span className="font-bold text-zinc-400">Helm.Warning</span>
          <span className="hidden sm:inline">•</span>
          <span className="text-[11px] sm:text-xs">NAVAREA Maritime Safety Information Pipeline</span>
        </div>
        <div className="text-[11px] sm:text-xs text-zinc-500 font-mono tracking-tight bg-gw-tertiary/40 px-2.5 py-1 rounded border border-gw-accent/30">
          {formatLastUpdated(LAST_UPDATED)}
        </div>
      </div>
    </footer>
  );
};

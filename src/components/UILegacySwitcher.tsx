import React from 'react';
import { useUILegacy, setUILegacy } from '../lib/uiFlags';

function UILegacySwitcherControl() {
  const legacy = useUILegacy();
  return (
    <div
      data-testid="dev-ui-switcher"
      className="fixed bottom-20 sm:bottom-4 left-2 sm:left-4 z-[1000] flex items-center gap-1 bg-gw-primary text-gw-secondary border border-gw-secondary rounded px-2 py-1 text-[10px] font-mono font-bold uppercase shadow-lg"
    >
      <span className="text-gw-accent mr-1">UI</span>
      <button
        type="button"
        onClick={() => setUILegacy(false)}
        aria-pressed={!legacy}
        data-testid="dev-ui-switcher-v2"
        className={`px-1.5 py-0.5 rounded ${
          !legacy ? 'bg-gw-secondary text-gw-primary' : 'text-gw-secondary hover:text-gw-bg'
        }`}
      >
        v2
      </button>
      <button
        type="button"
        onClick={() => setUILegacy(true)}
        aria-pressed={legacy}
        data-testid="dev-ui-switcher-classic"
        className={`px-1.5 py-0.5 rounded ${
          legacy ? 'bg-gw-secondary text-gw-primary' : 'text-gw-secondary hover:text-gw-bg'
        }`}
      >
        classic
      </button>
    </div>
  );
}

export const UILegacySwitcher: React.FC = (typeof import.meta !== 'undefined' && import.meta.env?.DEV)
  ? UILegacySwitcherControl
  : () => null;

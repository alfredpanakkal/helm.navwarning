import React from 'react';
import { TabType } from '../App';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  activeCount: number;
  onRefreshPipeline?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeCount,
  onRefreshPipeline,
  isRefreshing,
}) => {
  const tabs: { id: TabType; label: string; badge?: number }[] = [
    { id: 'map', label: 'Map View' },
    { id: 'databank', label: 'Data Bank', badge: activeCount },
    { id: 'sources', label: 'Sources' },
    { id: 'workspace', label: 'Pipeline' },
    { id: 'manual', label: 'Manual Parser' },
    { id: 'imports', label: 'Bulk Import' },
    { id: 'audit', label: 'Audit Log' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'drive', label: 'Backup' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-gw-primary text-gw-secondary border-b-2 border-gw-tertiary shadow-md">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 md:px-8 flex flex-col lg:flex-row justify-between items-center py-2 lg:py-0 gap-2 lg:gap-4">
        
        <div className="flex items-center justify-between w-full lg:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-2 border-gw-secondary rounded flex items-center justify-center text-gw-secondary relative shrink-0">
              <div className="absolute inset-1 border border-gw-accent rounded-sm"></div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 z-10 relative">
                <path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/>
              </svg>
            </div>
            <div className="flex flex-col leading-tight">
              <div className="font-bold text-lg sm:text-xl tracking-wider">NAVWARN</div>
              <div className="text-[10px] sm:text-xs text-gw-accent tracking-wide">INGESTION ENGINE v2.4</div>
            </div>
          </div>

          <button
            onClick={onRefreshPipeline}
            disabled={isRefreshing}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 bg-gw-bg text-gw-primary font-bold text-xs uppercase tracking-wider rounded border border-gw-bg transition-all active:scale-95 disabled:opacity-50 group"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : 'group-active:animate-spin'}`}>
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
            </svg>
            <span>{isRefreshing ? 'Running...' : 'Refresh'}</span>
          </button>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 lg:pb-0" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 sm:px-3 py-2 font-bold text-xs sm:text-xs tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap min-h-[40px] ${
                  isActive
                    ? 'text-gw-bg border-gw-bg'
                    : 'text-gw-accent border-transparent hover:text-gw-bg'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-gw-tertiary rounded text-gw-bg font-mono">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-3 px-3 py-1.5 border border-gw-tertiary rounded text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_0_rgba(74,222,128,0.6)]"></span>
              <span className="text-gw-accent">ACTIVE</span>
              <span className="text-gw-bg font-bold">{activeCount}</span>
            </div>
            <div className="w-px h-3.5 bg-gw-tertiary"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-gw-accent">COVERAGE</span>
              <span className="text-gw-bg font-bold">16/21</span>
            </div>
          </div>
          <button
            onClick={onRefreshPipeline}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gw-bg text-gw-primary font-bold text-xs uppercase tracking-wider rounded border border-gw-bg transition-all hover:bg-gw-secondary hover:-translate-y-px active:translate-y-0 disabled:opacity-50 group whitespace-nowrap min-h-[40px]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : 'group-active:animate-spin'}`}>
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
            </svg>
            <span>{isRefreshing ? 'Running Ingestion...' : 'Refresh Pipeline'}</span>
          </button>
        </div>

      </div>
    </header>
  );
};


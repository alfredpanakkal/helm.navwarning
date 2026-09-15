import React, { useState } from 'react';
import { TabType } from '../App';
import { Map, Database, Upload, Radio, MoreHorizontal, Terminal, Activity, FileText, HardDrive, RefreshCw, X } from 'lucide-react';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  activeCount: number;
  onRefreshPipeline?: () => void;
  isRefreshing?: boolean;
  onOpenConsole?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeCount,
  onRefreshPipeline,
  isRefreshing,
  onOpenConsole,
}) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const primaryMobileTabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'map', label: 'Map', icon: <Map className="w-5 h-5" /> },
    { id: 'databank', label: 'Data Bank', icon: <Database className="w-5 h-5" />, badge: activeCount },
    { id: 'imports', label: 'Import', icon: <Upload className="w-5 h-5" /> },
    { id: 'sources', label: 'Sources', icon: <Radio className="w-5 h-5" /> },
  ];

  const secondaryTabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'workspace', label: 'Pipeline Ingestion', icon: <Activity className="w-4 h-4" /> },
    { id: 'manual', label: 'Manual Parser', icon: <Terminal className="w-4 h-4" /> },
    { id: 'audit', label: 'Audit Log', icon: <FileText className="w-4 h-4" /> },
    { id: 'evidence', label: 'Evidence Locker', icon: <FileText className="w-4 h-4" /> },
    { id: 'drive', label: 'Drive Backup', icon: <HardDrive className="w-4 h-4" /> },
  ];

  const allTabs: { id: TabType; label: string; badge?: number }[] = [
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
    <>
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-50 bg-gw-primary text-gw-secondary border-b-2 border-gw-tertiary shadow-md">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-6 md:px-8 flex justify-between items-center py-2.5 md:py-0 gap-2 md:gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 border-2 border-gw-secondary rounded flex items-center justify-center text-gw-secondary relative shrink-0">
              <div className="absolute inset-1 border border-gw-accent rounded-sm"></div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 z-10 relative">
                <path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/>
              </svg>
            </div>
            <div className="flex flex-col leading-tight">
              <div className="font-bold text-base sm:text-xl tracking-wider text-gw-bg">Helm.Warning</div>
              <div className="text-[10px] sm:text-xs text-gw-accent tracking-wide">NAVAREA Data Bank &amp; Ingestion</div>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar" role="tablist">
            {allTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`${tab.label} tab`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 sm:px-3 py-3 font-bold text-xs tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-bg ${
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

          {/* Status & Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gw-tertiary border border-gw-primary rounded text-xs">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-[10px] sm:text-xs font-bold text-gw-bg">{activeCount} Active</span>
            </div>

            {onOpenConsole && (
              <button
                onClick={onOpenConsole}
                aria-label="Open CLI console terminal"
                title="Open Live Execution Terminal Console"
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-900 text-emerald-400 font-mono font-bold text-xs uppercase tracking-wider rounded border border-emerald-500/50 hover:bg-black transition-all active:scale-95 min-h-[36px]"
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">CLI Console</span>
              </button>
            )}

            <button
              onClick={onRefreshPipeline}
              disabled={isRefreshing}
              aria-label="Refresh ingestion pipeline"
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-gw-bg text-gw-primary font-bold text-xs uppercase tracking-wider rounded border border-gw-bg transition-all hover:bg-gw-secondary active:scale-95 disabled:opacity-50 min-h-[36px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync Pipeline'}</span>
              <span className="sm:hidden">{isRefreshing ? '...' : 'Sync'}</span>
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Bottom Quick Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gw-primary border-t-2 border-gw-tertiary px-2 py-1.5 flex items-center justify-around shadow-2xl">
        {primaryMobileTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setShowMobileMenu(false);
              }}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded min-w-[64px] transition-all relative ${
                isActive ? 'text-gw-bg font-bold' : 'text-gw-accent hover:text-gw-secondary'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 text-[9px] bg-emerald-500 text-slate-950 font-bold px-1 rounded-full min-w-[14px] text-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 uppercase tracking-tight">{tab.label}</span>
            </button>
          );
        })}

        {/* More Options Button */}
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded min-w-[64px] transition-all ${
            showMobileMenu || secondaryTabs.some((t) => t.id === activeTab)
              ? 'text-gw-bg font-bold'
              : 'text-gw-accent hover:text-gw-secondary'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 uppercase tracking-tight">More</span>
        </button>
      </nav>

      {/* Mobile Bottom Sheet / Drawer for Secondary Tools */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-gw-primary border-t-2 border-gw-tertiary p-4 rounded-t-2xl shadow-2xl space-y-3 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gw-tertiary">
              <span className="font-bold text-sm text-gw-bg uppercase tracking-wider">Helm.Warning Tools</span>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-1 rounded text-gw-accent hover:text-gw-bg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1">
              {secondaryTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setShowMobileMenu(false);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg text-xs font-bold uppercase transition-all ${
                      isActive
                        ? 'bg-gw-tertiary text-gw-bg border border-gw-bg'
                        : 'bg-gw-primary text-gw-secondary border border-gw-tertiary hover:bg-gw-tertiary/50'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};



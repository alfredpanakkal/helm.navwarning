import React, { useState, useEffect, useRef } from 'react';
import { TabType } from '../App';
import { Map, Database, Upload, Radio, MoreHorizontal, Terminal, Activity, FileText, HardDrive, RefreshCw, X, Lock, Unlock, Key, Mail, ShieldCheck, Loader2 } from 'lucide-react';
import { adminLogin, adminLogout } from '../services/api';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  activeCount: number;
  isAdminMode: boolean;
  setIsAdminMode: (admin: boolean) => void;
  /** Incremented by the App access gate to request the admin sign-in modal. */
  loginPrompt?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeCount,
  isAdminMode,
  setIsAdminMode,
  loginPrompt = 0,
}) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  // Handle Escape key dismissal for Admin Modal and Mobile Drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAdminModal) {
          setShowAdminModal(false);
          setAuthErrorMessage(null);
        }
        if (showMobileMenu) {
          setShowMobileMenu(false);
        }
      }
    };
    if (showAdminModal || showMobileMenu) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAdminModal, showMobileMenu]);

  // External login prompt: the App-level access gate bumps loginPrompt when an
  // unauthenticated visitor tries to use the console; open the real Supabase
  // admin sign-in modal in response.
  const lastPrompt = useRef<number>(0);
  useEffect(() => {
    if (loginPrompt > 0 && loginPrompt !== lastPrompt.current) {
      lastPrompt.current = loginPrompt;
      if (!isAdminMode) setShowAdminModal(true);
    }
  }, [loginPrompt, isAdminMode]);

  // Synchronize initial session state on component mount
  useEffect(() => {
    async function checkInitialAdminSession() {
      try {
        const { supabase } = await import('../lib/supabaseClient');
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const appMeta = user.app_metadata || {};
            const isAdmin = appMeta.role === 'admin' || appMeta.role === 'superadmin' || appMeta.is_admin === true;
            setIsAdminMode(isAdmin);
            return;
          }
        }
      } catch {}

      // No client-storage trust fallback: helm_admin_mode / helm_admin_token flags
      // were trivially spoofable and conveyed no real authorization. Admin mode
      // is only granted by the live server-verified Supabase session above
      // (app_metadata.role) or an explicit adminLogin() success.
    }
    checkInitialAdminSession();
  }, [setIsAdminMode]);

  const publicTabs: { id: TabType; label: string; badge?: number }[] = [
    { id: 'map', label: 'Map View' },
    { id: 'databank', label: 'Data Bank', badge: activeCount },
    { id: 'sources', label: 'Sources' },
  ];

  const adminTabs: { id: TabType; label: string; badge?: number }[] = [
    { id: 'workspace', label: 'Pipeline' },
    { id: 'manual', label: 'Manual Parser' },
    { id: 'imports', label: 'Bulk Import' },
    { id: 'audit', label: 'Audit Log' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'supabase', label: 'Supabase Server' },
  ];

  const primaryMobileTabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'map', label: 'Map', icon: <Map className="w-5 h-5" /> },
    { id: 'databank', label: 'Data Bank', icon: <Database className="w-5 h-5" />, badge: activeCount },
    { id: 'sources', label: 'Sources', icon: <Radio className="w-5 h-5" /> },
  ];

  // Grouped Tools for MORE Modal / Drawer
  const groupedMoreTools = [
    {
      group: 'TOOLS',
      items: [
        { id: 'workspace' as TabType, label: 'Pipeline Ingestion', icon: <Activity className="w-4 h-4 text-emerald-400" /> },
        { id: 'manual' as TabType, label: 'Manual Parser', icon: <Terminal className="w-4 h-4 text-sky-400" /> },
        { id: 'imports' as TabType, label: 'Bulk Import', icon: <Upload className="w-4 h-4 text-indigo-400" /> },
      ],
    },
    {
      group: 'RECORDS',
      items: [
        { id: 'audit' as TabType, label: 'Audit Log', icon: <FileText className="w-4 h-4 text-amber-400" /> },
        { id: 'evidence' as TabType, label: 'Evidence Locker', icon: <HardDrive className="w-4 h-4 text-teal-400" /> },
      ],
    },
    {
      group: 'SYSTEM',
      items: [
        { id: 'supabase' as TabType, label: 'Supabase Server', icon: <Database className="w-4 h-4 text-emerald-400" /> },
      ],
    },
  ];

  const visibleTabs = isAdminMode ? [...publicTabs, ...adminTabs] : publicTabs;

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleUnlockAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthErrorMessage(null);

    const email = adminEmail.trim();
    const password = adminPassword.trim();

    if (!email || !password) {
      setAuthErrorMessage('Please enter both administrator email and password.');
      setIsLoggingIn(false);
      return;
    }

    try {
      const res = await adminLogin(email, password);
      if (res.success) {
        setIsAdminMode(true);
        setShowAdminModal(false);
        setAdminEmail('');
        setAdminPassword('');
        setAuthErrorMessage(null);
      } else {
        setAuthErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setAuthErrorMessage(err?.message || 'Login request failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLockAdmin = async () => {
    await adminLogout();
    setIsAdminMode(false);
    if (adminTabs.some((t) => t.id === activeTab)) {
      setActiveTab('map');
    }
  };

  return (
    <>
      {/* Top Main Navigation Bar */}
      <header className="gw-dark-surface sticky top-0 z-50 bg-gw-primary text-gw-secondary border-b-2 border-gw-tertiary shadow-md">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-6 md:px-8 flex justify-between items-center py-1.5 md:py-0 gap-2 md:gap-4">
          
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
            {visibleTabs.map((tab) => {
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
                    <span className="text-[10px] px-1.5 py-0.5 bg-gw-tertiary/90 border border-gw-tertiary rounded text-gw-bg font-mono font-semibold tabular-nums shadow-xs">
                      {typeof tab.badge === 'number' ? tab.badge.toLocaleString() : tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Status & Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => setActiveTab('databank')}
              title="Jump to active NAVWARNs in Data Bank"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-gw-tertiary hover:bg-gw-tertiary/80 border border-gw-primary rounded text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-bg"
            >
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-[10px] sm:text-xs font-bold text-gw-bg tabular-nums tracking-wide">
                {typeof activeCount === 'number' ? activeCount.toLocaleString() : activeCount} Active
              </span>
            </button>

            {/* Admin Gate Toggle Button */}
            {isAdminMode ? (
              <button
                onClick={handleLockAdmin}
                title="Lock Admin Mode (Return to Public View)"
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-amber-500/20 text-amber-300 font-bold text-xs uppercase tracking-wider rounded border border-amber-500/40 hover:bg-amber-500/30 transition-all min-h-[36px]"
              >
                <Unlock className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Admin Mode</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAdminModal(true)}
                title="Unlock Admin Tools"
                className="gw-dark-surface flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-gw-tertiary/60 text-gw-accent hover:text-gw-bg font-bold text-xs uppercase tracking-wider rounded border border-gw-accent/40 hover:border-gw-bg transition-all min-h-[36px]"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin Access</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Mobile Bottom Quick Navigation Bar */}
      <nav className="gw-dark-surface md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gw-primary border-t-2 border-gw-tertiary px-2 py-1.5 flex items-center justify-around shadow-2xl" aria-label="Primary quick navigation">
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
                  <span className="absolute -top-1 -right-2 text-[9px] bg-emerald-500 text-slate-950 font-bold px-1 rounded-full min-w-[14px] text-center tabular-nums">
                    {typeof tab.badge === 'number' ? tab.badge.toLocaleString() : tab.badge}
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
            showMobileMenu || ['workspace', 'manual', 'imports', 'audit', 'evidence', 'supabase'].includes(activeTab)
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
          <div className="gw-dark-surface bg-gw-primary border-t-2 border-gw-tertiary p-4 rounded-t-2xl shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto" role="dialog" aria-label="Tools and options menu">
            <div className="flex items-center justify-between pb-2 border-b border-gw-tertiary">
              <span className="font-bold text-sm text-gw-bg uppercase tracking-wider">Helm.Warning Tools &amp; Options</span>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-1 rounded text-gw-accent hover:text-gw-bg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {groupedMoreTools.map((sec) => (
                <div key={sec.group} className="space-y-1.5">
                  <div className="text-[10px] font-bold text-gw-accent uppercase tracking-wider px-1">
                    {sec.group}
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {sec.items.map((tab) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setActiveTab(tab.id);
                            setShowMobileMenu(false);
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-bold uppercase transition-all ${
                            isActive
                              ? 'bg-gw-tertiary text-gw-bg border border-gw-bg'
                              : 'bg-gw-primary text-gw-secondary border border-gw-tertiary hover:bg-gw-tertiary/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {tab.icon}
                            <span>{tab.label}</span>
                          </div>
                          {!isAdminMode && ['workspace', 'manual', 'imports', 'audit', 'evidence', 'supabase'].includes(tab.id) && (
                            <Lock className="w-3.5 h-3.5 text-gw-accent" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Admin Unlock Modal Overlay */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-gw-primary rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gw-secondary pb-3">
              <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-gw-primary uppercase tracking-wider">
                <Lock className="w-5 h-5 text-gw-primary" />
                <span>Admin Access Gate</span>
              </div>
              <button
                onClick={() => {
                  setShowAdminModal(false);
                  setAuthErrorMessage(null);
                }}
                className="p-1 rounded text-gw-accent hover:text-gw-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gw-accent leading-relaxed">
              The console (Map, Data Bank, Sources, Pipeline, Manual Parser, Bulk Import, Audit Logs, Evidence Locker, Supabase Server) is restricted. Sign in with your Supabase Administrator account (<code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">app_metadata.role: "admin"</code>).
            </p>

            <form onSubmit={handleUnlockAdmin} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gw-accent uppercase tracking-wider block">
                  Admin Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gw-accent absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => {
                      setAdminEmail(e.target.value);
                      setAuthErrorMessage(null);
                    }}
                    placeholder="admin@example.com"
                    className="w-full pl-9 pr-3 py-2 bg-gw-bg border border-gw-secondary focus:border-gw-primary rounded font-mono text-xs focus:outline-none"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gw-accent uppercase tracking-wider block">
                  Password
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-gw-accent absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      setAuthErrorMessage(null);
                    }}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-gw-bg border border-gw-secondary focus:border-gw-primary rounded font-mono text-xs focus:outline-none"
                    required
                  />
                </div>
              </div>

              {authErrorMessage && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed font-mono">
                  {authErrorMessage}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 border border-gw-secondary text-gw-accent hover:text-gw-primary rounded text-xs font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="px-5 py-2 bg-gw-primary text-gw-bg font-bold text-xs uppercase tracking-wider rounded border border-gw-primary hover:bg-gw-tertiary transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isLoggingIn && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isLoggingIn ? 'Authenticating...' : 'Unlock Admin Mode'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

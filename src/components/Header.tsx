import React, { useState, useEffect, useRef } from 'react';
import { TabType, SectionType, SECTION_OF, SECTION_VIEWS, DEFAULT_SECTION_TAB } from '../App';
import { Map, Database, Upload, FileText, X, Lock, Unlock, Key, Mail, Loader2 } from 'lucide-react';
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
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  // Handle Escape key dismissal for Admin Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAdminModal) {
        setShowAdminModal(false);
        setAuthErrorMessage(null);
      }
    };
    if (showAdminModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAdminModal]);

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

  // 4-section information architecture (2026-10-24): Warnings / Ingest / Trace
  // / System regroup the nine underlying views. TabType ids are unchanged, so
  // every activeTab condition and programmatic cross-link in App.tsx keeps
  // working; sections are a navigation layer only.
  const activeSection = SECTION_OF[activeTab];
  const sectionViews = SECTION_VIEWS[activeSection];

  const sectionMeta: { id: SectionType; label: string; icon: React.ReactNode }[] = [
    { id: 'warnings', label: 'Warnings', icon: <Map className="w-5 h-5" /> },
    { id: 'ingest', label: 'Ingest', icon: <Upload className="w-5 h-5" /> },
    { id: 'trace', label: 'Trace', icon: <FileText className="w-5 h-5" /> },
    { id: 'system', label: 'System', icon: <Database className="w-5 h-5" /> },
  ];

  // Switching section keeps the current view when it belongs to that section
  // (the Warnings Map/List toggle), else lands on the section default.
  const handleSectionSelect = (section: SectionType) => {
    setActiveTab(SECTION_OF[activeTab] === section ? activeTab : DEFAULT_SECTION_TAB[section]);
  };

  const [isLoggingIn, setIsLoggingIn] = useState(false);  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
    // The whole console is admin-gated (PR #27 policy): fall back to Warnings - Map.
    setActiveTab('map');
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

          {/* Desktop Section Navigation — 4-section IA: Warnings / Ingest / Trace / System.
              The views of the active section live in the sub-tab strip below. */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar" role="tablist">
            {sectionMeta.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={section.label + ' tab'}
                  onClick={() => handleSectionSelect(section.id)}
                  className={'px-2.5 sm:px-3 py-3 font-bold text-xs tracking-wider uppercase border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-bg ' + (isActive ? 'text-gw-bg border-gw-bg' : 'text-gw-accent border-transparent hover:text-gw-bg')}
                >
                  <span>{section.label}</span>
                  {section.id === 'warnings' && typeof activeCount === 'number' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gw-tertiary/90 border border-gw-tertiary rounded text-gw-bg font-mono font-semibold tabular-nums shadow-xs">
                      {activeCount.toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

        </div>

        {/* Section sub-tabs: the views of the active section. role=tab +
            aria-selected mirror activeTab so the smoke suite can keep
            asserting on them ("Map View tab", "Data Bank tab", ...). */}
        <nav className="gw-dark-surface bg-gw-primary border-t border-gw-tertiary/70" role="tablist" aria-label="Section view tabs">
          <div className="max-w-[1600px] mx-auto px-3 sm:px-6 md:px-8 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5">
            {sectionViews.map((view) => {
              const isActive = activeTab === view.id;
              return (
                <button
                  key={view.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={view.label + ' tab'}
                  onClick={() => setActiveTab(view.id)}
                  className={'px-2.5 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded border transition-all whitespace-nowrap flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-bg ' + (isActive ? 'bg-gw-tertiary text-gw-bg border-gw-bg' : 'text-gw-accent border-gw-tertiary/70 hover:text-gw-bg hover:border-gw-bg')}
                >
                  <span>{view.label}</span>
                  {view.id === 'databank' && typeof activeCount === 'number' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gw-tertiary/90 border border-gw-tertiary rounded text-gw-bg font-mono font-semibold tabular-nums shadow-xs">
                      {activeCount.toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Mobile Bottom Quick Navigation — the 4 sections; the views live in the
          header sub-tab strip, so every view stays reachable without a More drawer. */}
      <nav className="gw-dark-surface md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gw-primary border-t-2 border-gw-tertiary px-2 py-1.5 flex items-center justify-around shadow-2xl" aria-label="Primary quick navigation">
        {sectionMeta.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              role="tab"
              aria-selected={isActive}
              aria-label={section.label + ' tab'}
              onClick={() => handleSectionSelect(section.id)}
              className={'flex flex-col items-center justify-center py-1 px-2 rounded min-w-[64px] transition-all relative ' + (isActive ? 'text-gw-bg font-bold' : 'text-gw-accent hover:text-gw-secondary')}
            >
              <div className="relative">
                {section.icon}
                {section.id === 'warnings' && typeof activeCount === 'number' && (
                  <span className="absolute -top-1 -right-2 text-[9px] bg-emerald-500 text-slate-950 font-bold px-1 rounded-full min-w-[14px] text-center tabular-nums">
                    {activeCount.toLocaleString()}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 uppercase tracking-tight">{section.label}</span>
            </button>
          );
        })}
      </nav>

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
              The console (Warnings, Ingest, Trace and System sections) is restricted. Sign in with your Supabase Administrator account (<code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">app_metadata.role: "admin"</code>).
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

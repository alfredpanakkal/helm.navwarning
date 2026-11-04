import React, { useState, useEffect, useRef } from 'react';
import { TabType, SectionType, SECTION_OF, SECTION_VIEWS, DEFAULT_SECTION_TAB } from '../App';
import { Map, Database, Upload, FileText, X, Lock, Unlock, Key, Mail, Loader2 } from 'lucide-react';
import { adminLogin, adminLogout } from '../services/api';
import { useModalBehavior } from '../hooks/useModalBehavior';

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
  // Two-tap sign-out confirmation: first tap arms, second tap confirms.
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const adminModalRef = useRef<HTMLDivElement>(null);
  useModalBehavior(adminModalRef, showAdminModal);
  useEffect(() => {
    if (!signOutConfirm) return;
    const t = window.setTimeout(() => setSignOutConfirm(false), 4000);
    return () => window.clearTimeout(t);
  }, [signOutConfirm]);

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

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleUnlockAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthErrorMessage(null);

    const email = adminEmail.trim();
    const password = adminPassword;

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
    setSignOutConfirm(false);
    await adminLogout();
    setIsAdminMode(false);
    // The whole console is admin-gated (PR #27 policy): fall back to Warnings - Map.
    setActiveTab('map');
  };

  return (
    <>
      {/* Top Main Navigation Bar */}
      <header className="site-header sticky top-0 z-console-chrome bg-canvas border-b border-hairline">
        <div className="w-full px-4 sm:px-6 md:px-8 flex justify-between items-center py-2 md:py-0 min-h-[56px] gap-2 md:gap-6">
          
          {/* Logo & Console Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <a href="#/warnings/map" className="logo flex items-center gap-2 text-decoration-none" aria-label="Helm.Warning Console Home">
              <span className="logo-badge w-7 h-7 rounded border border-border-input text-ink-primary font-medium flex items-center justify-center text-xs select-none" aria-hidden="true">
                HW
              </span>
              <span className="font-medium text-base text-ink-primary tracking-tight">
                Helm.Warning
              </span>
            </a>
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-medium uppercase tracking-wider text-ink-tertiary">
              Console
            </span>
          </div>

                    {/* Single-row navigation: the 4 sections plus the active section's views
              in one 56px bar (Phase 1 chrome merge — replaces the 56px header +
              38px sub-tab strip, so --console-sticky-offset: 57px now matches
              the chrome exactly). Sections on the left, views after the divider;
              the strip scrolls horizontally when narrow. */}
          <nav
            className="flex-1 min-w-0 flex items-center gap-3 overflow-x-auto no-scrollbar py-2"
            role="tablist"
            aria-label="Console sections and views"
          >
            {sectionMeta.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={section.label + ' tab'}
                  onClick={() => handleSectionSelect(section.id)}
                  className={
                    'nav-tab flex items-center gap-2 px-3.5 py-2 rounded-full font-medium text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ' +
                    (isActive
                      ? 'bg-surface-subtle border border-border-chip-on text-ink-primary'
                      : 'border border-transparent text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle')
                  }
                >
                  <span>{section.label}</span>
                  {section.id === 'warnings' && typeof activeCount === 'number' && (
                    <span
                      className={
                        'badge ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-sans font-medium tabular-nums ' +
                        (isActive
                          ? 'text-ink-primary'
                          : 'text-ink-tertiary')
                      }
                    >
                      {activeCount.toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Divider between the section level and the active section's views */}
            <span aria-hidden="true" className="w-px h-5 bg-hairline shrink-0" />

            {sectionViews.map((view) => {
              const isActive = activeTab === view.id;
              return (
                <button
                  key={view.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={view.label + ' tab'}
                  onClick={() => setActiveTab(view.id)}
                  className={
                    'px-3 py-2 text-xs font-medium rounded border transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ' +
                    (isActive
                      ? 'bg-surface-subtle text-ink-primary border-border-chip-on'
                      : 'text-ink-secondary border-transparent hover:text-ink-primary hover:bg-surface-subtle')
                  }
                >
                  <span>{view.label}</span>
                  {view.id === 'databank' && typeof activeCount === 'number' && (
                    <span className="text-[10px] px-1 py-0.5 rounded text-ink-tertiary font-sans font-medium tabular-nums">
                      {activeCount.toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Header Right Meta & Admin Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Live Stream Status Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-ink-secondary font-medium">
              <span className="w-2 h-2 rounded-full bg-accent inline-block" aria-hidden="true"></span>
              <span>Live stream</span>
            </div>

            {/* Public Portal Link */}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle transition-colors border border-transparent hover:border-hairline"
              title="Open Public Maritime Portal"
            >
              <span>Public portal</span>
              <span aria-hidden="true" className="text-[11px]">↗</span>
            </a>

            {/* Admin Lock / Sign In Status */}
            {isAdminMode ? (
              <button
                onClick={() => {
                  if (signOutConfirm) {
                    handleLockAdmin();
                  } else {
                    setSignOutConfirm(true);
                  }
                }}
                aria-label="Sign out of admin session"
                className={
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-all cursor-pointer ' +
                  (signOutConfirm
                    ? 'text-sev-critical bg-surface-subtle border-sev-critical'
                    : 'text-ink-body bg-transparent hover:bg-surface-subtle border-border-input')
                }
                title="Admin session active (app_metadata.role === 'admin'). Click to sign out."
              >
                <Lock className="w-3.5 h-3.5 text-accent" />
                <span>{signOutConfirm ? 'Confirm sign out?' : 'Sign out'}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAdminModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-ink-secondary bg-transparent hover:bg-surface-subtle border border-border-input transition-all cursor-pointer"
                title="Unlock Console Administrator Access"
              >
                <Key className="w-3.5 h-3.5 text-accent" />
                <span>Sign in</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Mobile Bottom Quick Navigation — the 4 sections */}
      <nav role="tablist" className="bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-console-chrome bg-gw-panel/95 backdrop-blur-md border-t border-gw-secondary px-2 py-1 pb-[env(safe-area-inset-bottom)] flex items-center justify-around shadow-lg" aria-label="Primary quick navigation">
        {sectionMeta.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              role="tab"
              aria-selected={isActive}
              aria-label={section.label + ' tab'}
              onClick={() => handleSectionSelect(section.id)}
              className={
                'bottom-nav-item flex flex-col items-center justify-center py-1 px-2 rounded min-w-[64px] min-h-[44px] transition-all relative ' +
                (isActive ? 'active text-gw-primary font-bold' : 'text-gw-accent hover:text-gw-primary')
              }
            >
              <div className="relative">
                {section.icon}
                {section.id === 'warnings' && typeof activeCount === 'number' && (
                  <span className="bottom-badge absolute -top-1 -right-2 text-xs bg-emerald-600 text-white font-bold px-1 rounded-full min-w-[14px] text-center tabular-nums">
                    {activeCount.toLocaleString()}
                  </span>
                )}
              </div>
              <span className="text-xs mt-0.5 uppercase tracking-tight">{section.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Admin Unlock Modal Overlay */}
      {showAdminModal && (
        <div className="fixed inset-0 z-console-overlay bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div ref={adminModalRef} role="dialog" aria-modal="true" aria-labelledby="admin-gate-title" className="bg-gw-panel border border-gw-primary rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gw-secondary pb-3">
              <div className="flex items-center gap-2 font-medium text-sm sm:text-base text-gw-primary tracking-wide">
                <Lock className="w-5 h-5 text-gw-primary" />
                <span id="admin-gate-title">Admin access gate</span>
              </div>
              <button
                onClick={() => {
                  setShowAdminModal(false);
                  setAuthErrorMessage(null);
                }}
                aria-label="Close admin sign-in prompt"
                className="p-1 rounded text-gw-accent hover:text-gw-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gw-accent leading-relaxed">
              The console (Warnings, Ingest, Trace and System sections) is restricted. Sign in with your Supabase Administrator account (<code className="font-mono bg-gw-secondary px-1 py-0.5 rounded text-gw-primary">app_metadata.role: "admin"</code>).
            </p>

            <form onSubmit={handleUnlockAdmin} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="admin-gate-email" className="text-[10px] font-medium text-gw-accent uppercase tracking-wider block">
                  Admin Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gw-accent absolute left-3 top-2.5" />
                  <input
                    type="email"
                    id="admin-gate-email"
                    autoComplete="email"
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
                <label htmlFor="admin-gate-password" className="text-[10px] font-medium text-gw-accent uppercase tracking-wider block">
                  Password
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-gw-accent absolute left-3 top-2.5" />
                  <input
                    type="password"
                    id="admin-gate-password"
                    autoComplete="current-password"
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
                <div role="alert" className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed font-mono">
                  {authErrorMessage}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminModal(false);
                    setAuthErrorMessage(null);
                  }}
                  className="px-4 py-2 border border-gw-secondary text-gw-accent hover:text-gw-primary rounded text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="px-5 py-2 bg-gw-primary text-gw-bg font-medium text-xs tracking-wide rounded border border-gw-primary hover:bg-gw-tertiary transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isLoggingIn && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isLoggingIn ? 'Authenticating...' : 'Unlock admin mode'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

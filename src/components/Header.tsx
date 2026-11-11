import React, { useState, useEffect, useRef } from 'react';
import { TabType, SectionType, SECTION_OF, SECTION_VIEWS, DEFAULT_SECTION_TAB } from '../App';
import { Map, Database, Upload, FileText, X, Lock, Unlock, Key, Mail, Loader2, ChevronDown } from 'lucide-react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const adminModalRef = useRef<HTMLDivElement>(null);
  useModalBehavior(adminModalRef, showAdminModal);
  useEffect(() => {
    if (!signOutConfirm) return;
    const t = window.setTimeout(() => setSignOutConfirm(false), 4000);
    return () => window.clearTimeout(t);
  }, [signOutConfirm]);

  // Mobile console menu: Escape closes it.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

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

  // Re-auth on expiry: a save that returned 401 asks for the sign-in modal.
  // Deliberately does NOT touch isAdminMode (that would gate the console
  // and unmount any open editor, losing the unsaved edit).
  useEffect(() => {
    const open = () => setShowAdminModal(true);
    window.addEventListener('hw:reauth-required', open);
    return () => window.removeEventListener('hw:reauth-required', open);
  }, []);

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

  const activeSectionLabel = sectionMeta.find((s) => s.id === activeSection)?.label ?? '';
  const activeViewLabel = sectionViews.find((v) => v.id === activeTab)?.label ?? '';

  // Switching section lands on the section default, or cycles between sub-views when tapped repeatedly
  const handleSectionSelect = (section: SectionType) => {
    const views = SECTION_VIEWS[section];
    if (SECTION_OF[activeTab] === section && views.length > 1) {
      const currentIndex = views.findIndex((v) => v.id === activeTab);
      const nextIndex = (currentIndex + 1) % views.length;
      setActiveTab(views[nextIndex].id);
    } else {
      setActiveTab(DEFAULT_SECTION_TAB[section]);
    }
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
        <div className="w-full px-4 sm:px-6 md:px-8 flex justify-between items-center py-2 md:py-0 min-h-[56px] gap-3 md:gap-6">
          
          {/* Logo & Console Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <a href="#/warnings/map" className="logo flex items-center gap-2 text-decoration-none" aria-label="Helm.Warning Console Home">
              <span className="logo-badge w-7 h-7 rounded border border-border-input text-ink-primary font-medium flex items-center justify-center text-xs select-none" aria-hidden="true">
                HW
              </span>
            </a>
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-medium uppercase tracking-wider text-ink-tertiary">
              Console
            </span>
          </div>

          {/* Mobile navigation: one menu button, full section/view list on tap */}
          <div className="flex-1 min-w-0 md:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Open console menu"
              className="w-full min-h-[44px] flex items-center justify-between gap-2 px-3 rounded border border-border-input text-xs font-medium text-ink-primary cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <span className="truncate">{activeSectionLabel} · {activeViewLabel}</span>
              <ChevronDown className={'w-4 h-4 shrink-0 transition-transform ' + (menuOpen ? 'rotate-180' : '')} aria-hidden="true" />
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Close console menu"
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-x-0 bottom-0 top-[57px] z-console-chrome bg-black/30 cursor-default"
                />
                <div
                  role="menu"
                  aria-label="Console menu"
                  className="fixed inset-x-0 top-[57px] z-console-chrome max-h-[calc(100dvh-57px)] overflow-y-auto bg-canvas border-b border-hairline p-3 space-y-3"
                >
                  {sectionMeta.map((section) => (
                    <div key={section.id} className="space-y-1">
                      <div className="px-2 text-[0.7rem] font-medium uppercase tracking-[0.06em] text-ink-tertiary">
                        {section.label}
                      </div>
                      {SECTION_VIEWS[section.id].map((view) => {
                        const isActive = activeTab === view.id;
                        return (
                          <button
                            key={view.id}
                            type="button"
                            role="menuitem"
                            aria-current={isActive ? 'page' : undefined}
                            onClick={() => { setActiveTab(view.id); setMenuOpen(false); }}
                            className={
                              'w-full min-h-[44px] flex items-center px-3 rounded-md text-sm font-medium text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ' +
                              (isActive
                                ? 'bg-surface-subtle text-ink-primary'
                                : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary')
                            }
                          >
                            {view.label}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Header Right Meta & Admin Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Live Stream Status Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-ink-secondary font-medium">
              <span className="w-2 h-2 rounded-full bg-accent inline-block" aria-hidden="true"></span>
              <span>Live stream</span>
            </div>

            {/* Public Portal Link */}
            <a
              href="/navarea"
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
                <span className={signOutConfirm ? '' : 'hidden sm:inline'}>{signOutConfirm ? 'Confirm sign out?' : 'Sign out'}</span>
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


      {/* Admin Unlock Modal Overlay */}
      {/* Above the edit drawer (z-console-overlay-raised, 70) AND the map
         geometry editor bar (z-[480]): no stacking token exceeds 480, so
         the arbitrary-value pattern already used by the editor bar is
         reused here. */}
      {showAdminModal && (
        <div className="fixed inset-0 z-[490] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
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

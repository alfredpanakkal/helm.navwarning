import React from 'react';
import {
  Map, Database, Workflow, Globe, Upload, ClipboardList, ScrollText, Archive, Server,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import {
  SECTION_ORDER, SECTION_VIEWS, SECTION_OF, DEFAULT_SECTION_TAB,
  type TabType, type SectionType,
} from '../lib/consoleRoute';

// Desktop navigation rail (Phase 2): one flat, scannable list of all four
// sections and their views. Vertical navigation scales with the IA; the
// horizontal single-row nav (Header) remains the mobile-only fallback.
// Collapses to a 56px icon rail for power users; the preference persists in
// localStorage next to the other helm_* console flags.

interface NavRailProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  activeCount: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const SECTION_LABEL: Record<SectionType, string> = {
  warnings: 'Warnings',
  ingest: 'Ingest',
  trace: 'Trace',
  system: 'System',
};

const VIEW_ICONS: Record<TabType, React.ReactNode> = {
  map: <Map className="w-4 h-4 shrink-0" />,
  databank: <Database className="w-4 h-4 shrink-0" />,
  workspace: <Workflow className="w-4 h-4 shrink-0" />,
  sources: <Globe className="w-4 h-4 shrink-0" />,
  imports: <Upload className="w-4 h-4 shrink-0" />,
  manual: <ClipboardList className="w-4 h-4 shrink-0" />,
  audit: <ScrollText className="w-4 h-4 shrink-0" />,
  evidence: <Archive className="w-4 h-4 shrink-0" />,
  supabase: <Server className="w-4 h-4 shrink-0" />,
};

export const NavRail: React.FC<NavRailProps> = ({
  activeTab,
  setActiveTab,
  activeCount,
  collapsed,
  onToggleCollapsed,
}) => {
  const activeSection = SECTION_OF[activeTab];

  // Same semantics as the Header/bottom-nav section click: keep the current
  // view when it already belongs to that section, else land on the default.
  const handleSectionSelect = (section: SectionType) => {
    setActiveTab(SECTION_OF[activeTab] === section ? activeTab : DEFAULT_SECTION_TAB[section]);
  };

  return (
    <nav
      aria-label="Console sections and views"
      className="console-nav-rail hidden md:flex flex-col fixed top-[57px] bottom-0 left-0 z-console-sticky border-r border-hairline bg-canvas transition-[width] duration-150 ease-out"
      style={{ width: collapsed ? 'var(--console-rail-w-collapsed, 56px)' : 'var(--console-rail-w, 224px)' }}
    >
      <div className="flex-1 min-h-0 overflow-y-auto py-3 px-2 flex flex-col gap-4">
        {SECTION_ORDER.map((section) => (
          <div key={section} className="flex flex-col gap-1.5">
            {collapsed ? (
              <span
                aria-hidden="true"
                className={
                  'mx-auto w-1 h-1 rounded-full ' +
                  (activeSection === section ? 'bg-accent' : 'bg-hairline')
                }
              />
            ) : (
              <button
                type="button"
                onClick={() => handleSectionSelect(section)}
                aria-current={activeSection === section ? 'true' : undefined}
                className="text-[0.7rem] font-medium uppercase tracking-[0.06em] text-left px-3 pt-1 text-ink-tertiary hover:text-ink-primary transition-colors cursor-pointer"
              >
                {SECTION_LABEL[section]}
              </button>
            )}
            {SECTION_VIEWS[section].map((view) => {
              const isActive = activeTab === view.id;
              if (collapsed) {
                return (
                  <button
                    type="button"
                    key={view.id}
                    onClick={() => setActiveTab(view.id)}
                    title={view.label}
                    aria-label={view.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={
 'w-9 h-9 mx-auto flex items-center justify-center rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ' +
 (isActive
 ? 'bg-surface-subtle text-ink-primary'
 : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary')
 }
                  >
                    {VIEW_ICONS[view.id]}
                  </button>
                );
              }
              return (
                <button
                  type="button"
                  key={view.id}
                  onClick={() => setActiveTab(view.id)}
                  aria-label={view.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={
 'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ' +
 (isActive
 ? 'bg-surface-subtle text-ink-primary'
 : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary')
 }
                >
                  {VIEW_ICONS[view.id]}
                  <span>{view.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-hairline p-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand navigation rail' : 'Collapse navigation rail'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand navigation rail' : 'Collapse navigation rail'}
          className={
 'flex items-center gap-2.5 py-2 rounded-md text-sm font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent' +
 (collapsed ? ' w-9 h-9 mx-auto justify-center px-0' : ' w-full px-3')
 }
        >
          {collapsed ? (
            <ChevronsRight className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronsLeft className="w-4 h-4 shrink-0" />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </nav>
  );
};

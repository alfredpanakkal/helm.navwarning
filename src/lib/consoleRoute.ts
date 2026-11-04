// src/lib/consoleRoute.ts
// Hash router for the /console SPA. Pure functions only - no React, no window
// access - so the whole grammar is unit-testable and App.tsx stays thin.
//
// Grammar: "#/<section>/<view>?<query>" plus permanent legacy single-segment
// aliases ("#/databank", "#sources", ...) so existing bookmarks, dashboards
// and the /admin gateway keep resolving. Query params are omitted when they
// carry their default value, keeping shared URLs short.

export type TabType =
  | 'map'
  | 'databank'
  | 'sources'
  | 'workspace'
  | 'imports'
  | 'manual'
  | 'audit'
  | 'evidence'
  | 'supabase';

export type SectionType = 'warnings' | 'ingest' | 'trace' | 'system';

export const SECTION_ORDER: SectionType[] = ['warnings', 'ingest', 'trace', 'system'];

export const SECTION_OF: Record<TabType, SectionType> = {
  map: 'warnings',
  databank: 'warnings',
  workspace: 'ingest',
  sources: 'ingest',
  imports: 'ingest',
  manual: 'ingest',
  audit: 'trace',
  evidence: 'trace',
  supabase: 'system',
};

export const SECTION_VIEWS: Record<SectionType, { id: TabType; label: string }[]> = {
  warnings: [
    { id: 'map', label: 'Map View' },
    { id: 'databank', label: 'Data Bank' },
  ],
  ingest: [
    { id: 'workspace', label: 'Pipeline' },
    { id: 'sources', label: 'Sources' },
    { id: 'imports', label: 'Bulk Import' },
    { id: 'manual', label: 'Manual Parser' },
  ],
  trace: [
    { id: 'audit', label: 'Audit Log' },
    { id: 'evidence', label: 'Evidence' },
  ],
  system: [{ id: 'supabase', label: 'Supabase Server' }],
};

export const DEFAULT_SECTION_TAB: Record<SectionType, TabType> = {
  warnings: 'map',
  ingest: 'workspace',
  trace: 'audit',
  system: 'supabase',
};

/** Canonical second path segment per view (databank -> list, audit -> generations). */
const ROUTE_NAME: Record<TabType, string> = {
  map: 'map',
  databank: 'list',
  workspace: 'pipeline',
  sources: 'sources',
  imports: 'bulk',
  manual: 'manual',
  audit: 'generations',
  evidence: 'evidence',
  supabase: 'supabase',
};

const VALID_TABS: TabType[] = ['map', 'databank', 'sources', 'workspace', 'imports', 'manual', 'audit', 'evidence', 'supabase'];

export function tabHash(tab: TabType): string {
  return '#/' + SECTION_OF[tab] + '/' + ROUTE_NAME[tab];
}

/** Data Bank view state that round-trips through the hash query string. */
export interface DataBankRouteState {
  /** Search query (model searchTerm). */
  q: string;
  /** Custom sort field (model SortField); only meaningful in custom sort mode. */
  sort: string;
  dir: 'asc' | 'desc';
  page: number;
  navarea: string;
}

export const DEFAULT_DATABANK_ROUTE: DataBankRouteState = {
  q: '',
  sort: 'issued',
  dir: 'desc',
  page: 1,
  navarea: 'ALL',
};

export function databankRouteEqual(a: DataBankRouteState, b: DataBankRouteState): boolean {
  return a.q === b.q && a.sort === b.sort && a.dir === b.dir && a.page === b.page && a.navarea === b.navarea;
}

export interface ParsedRoute {
  tab: TabType;
  /** Status deep link for the Data Bank / Sources views. */
  statusFilter?: string;
  navarea?: string;
  q?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
}

/**
 * Parse a location hash into a route. Two-segment "#/<section>/<view>" grammar
 * plus PERMANENT legacy aliases ("#/databank", "#sources", ...) so existing
 * bookmarks, dashboards and the /admin gateway keep resolving. Unknown
 * segments fall back to Map. Absent query keys stay undefined so callers can
 * distinguish "not in the URL" from an explicit default.
 */
export function parseHashRoute(hashStr: string): ParsedRoute {
  const cleanHash = hashStr.replace(/^#\/?/, '');
  if (!cleanHash) return { tab: 'map' };

  const [pathPart, queryPart] = cleanHash.split('?');
  const segments = pathPart.toLowerCase().split('/').filter(Boolean);
  const [first, second] = segments;

  let tab: TabType | undefined;
  if (first && (SECTION_ORDER as string[]).includes(first)) {
    const section = first as SectionType;
    const match = second
      ? SECTION_VIEWS[section].find((v) => ROUTE_NAME[v.id] === second)
      : undefined;
    tab = match ? match.id : DEFAULT_SECTION_TAB[section];
  } else if (first) {
    // Legacy single-segment route - permanent alias (supports tab ID or route name).
    const candidate = first as TabType;
    if (VALID_TABS.includes(candidate)) {
      tab = candidate;
    } else {
      const byRouteName = (Object.keys(ROUTE_NAME) as TabType[]).find(
        (t) => ROUTE_NAME[t] === first
      );
      tab = byRouteName;
    }
  }

  const params = new URLSearchParams(queryPart || '');
  const dirRaw = (params.get('dir') || '').toLowerCase();
  const pageRaw = Number.parseInt(params.get('page') || '', 10);

  return {
    tab: tab ?? 'map',
    statusFilter: params.get('status') || undefined,
    navarea: params.get('navarea') || undefined,
    q: params.get('q') || undefined,
    sort: params.get('sort') || undefined,
    dir: dirRaw === 'asc' || dirRaw === 'desc' ? dirRaw : undefined,
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : undefined,
  };
}

/**
 * Build the canonical hash for the current view. Only non-default query params
 * are serialized, so a fresh Data Bank visit keeps a clean URL.
 */
export function buildConsoleHash(
  tab: TabType,
  opts: { statusFilter?: string; databank?: DataBankRouteState | null } = {}
): string {
  const params = new URLSearchParams();
  if (opts.statusFilter && opts.statusFilter !== 'ALL') {
    params.set('status', opts.statusFilter);
  }
  const d = opts.databank;
  if (tab === 'databank' && d) {
    if (d.q) params.set('q', d.q);
    if (d.navarea && d.navarea !== DEFAULT_DATABANK_ROUTE.navarea) params.set('navarea', d.navarea);
    if (d.sort && d.sort !== DEFAULT_DATABANK_ROUTE.sort) params.set('sort', d.sort);
    if (d.dir !== DEFAULT_DATABANK_ROUTE.dir) params.set('dir', d.dir);
    if (d.page && d.page !== DEFAULT_DATABANK_ROUTE.page) params.set('page', String(d.page));
  }
  const queryString = params.toString();
  const base = tabHash(tab);
  return queryString ? `${base}?${queryString}` : base;
}

/** Extract the Data Bank view state carried by a route (defaults when absent). */
export function databankRouteFromRoute(route: ParsedRoute): DataBankRouteState {
  if (route.tab !== 'databank') return { ...DEFAULT_DATABANK_ROUTE };
  return {
    q: route.q ?? DEFAULT_DATABANK_ROUTE.q,
    sort: route.sort ?? DEFAULT_DATABANK_ROUTE.sort,
    dir: route.dir ?? DEFAULT_DATABANK_ROUTE.dir,
    page: route.page ?? DEFAULT_DATABANK_ROUTE.page,
    navarea: route.navarea ?? DEFAULT_DATABANK_ROUTE.navarea,
  };
}

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DATABANK_ROUTE,
  buildConsoleHash,
  databankRouteEqual,
  databankRouteFromRoute,
  parseHashRoute,
  tabHash,
  type DataBankRouteState,
  type TabType,
} from './consoleRoute';

const ALL_TABS: TabType[] = [
  'map',
  'databank',
  'sources',
  'workspace',
  'imports',
  'manual',
  'audit',
  'evidence',
  'supabase',
];

describe('consoleRoute tab grammar', () => {
  it('maps every tab to the two-segment canonical hash', () => {
    expect(tabHash('map')).toBe('#/warnings/map');
    expect(tabHash('databank')).toBe('#/warnings/list');
    expect(tabHash('audit')).toBe('#/trace/generations');
  });

  it('round-trips every tab through buildConsoleHash/parseHashRoute', () => {
    for (const tab of ALL_TABS) {
      const hash = buildConsoleHash(tab);
      expect(parseHashRoute(hash).tab).toBe(tab);
    }
  });
});

describe('consoleRoute legacy aliases and fallbacks', () => {
  it('resolves permanent legacy single-segment aliases', () => {
    expect(parseHashRoute('#/databank').tab).toBe('databank');
    expect(parseHashRoute('#databank').tab).toBe('databank');
    expect(parseHashRoute('#sources').tab).toBe('sources');
    expect(parseHashRoute('#pipeline').tab).toBe('workspace');
    expect(parseHashRoute('#bulk').tab).toBe('imports');
    expect(parseHashRoute('#generations').tab).toBe('audit');
    expect(parseHashRoute('#list').tab).toBe('databank');
  });

  it('is case-insensitive on segments', () => {
    expect(parseHashRoute('#/WARNINGS/LIST').tab).toBe('databank');
    expect(parseHashRoute('#/Ingest/Bulk').tab).toBe('imports');
  });

  it('falls back to Map for empty or unknown hashes', () => {
    expect(parseHashRoute('').tab).toBe('map');
    expect(parseHashRoute('#').tab).toBe('map');
    expect(parseHashRoute('#/nonsense/view').tab).toBe('map');
  });

  it('falls back to the section default for a section-only hash', () => {
    expect(parseHashRoute('#/ingest').tab).toBe('workspace');
    expect(parseHashRoute('#/trace').tab).toBe('audit');
    expect(parseHashRoute('#/system').tab).toBe('supabase');
  });
});

describe('consoleRoute status and Data Bank query params', () => {
  it('keeps the legacy status deep link working', () => {
    expect(parseHashRoute('#/warnings/list?status=unverified').statusFilter).toBe('unverified');
    expect(parseHashRoute('#/ingest/sources?status=stale').statusFilter).toBe('stale');
  });

  it('omits default query params entirely', () => {
    expect(buildConsoleHash('databank', { databank: DEFAULT_DATABANK_ROUTE })).not.toContain('?');
    expect(buildConsoleHash('databank', { statusFilter: 'ALL' })).not.toContain('?');
  });

  it('round-trips status deep links for the Data Bank and Sources views', () => {
    expect(parseHashRoute(buildConsoleHash('databank', { statusFilter: 'archived' })).statusFilter).toBe('archived');
    expect(parseHashRoute(buildConsoleHash('sources', { statusFilter: 'stale' })).statusFilter).toBe('stale');
  });

  it('round-trips a fully specified Data Bank state through the hash', () => {
    const state: DataBankRouteState = { q: 'rig', sort: 'title', dir: 'asc', page: 3, navarea: 'VIII' };
    const hash = buildConsoleHash('databank', { statusFilter: 'unverified', databank: state });
    const parsed = parseHashRoute(hash);
    expect(parsed.tab).toBe('databank');
    expect(parsed.statusFilter).toBe('unverified');
    expect(databankRouteFromRoute(parsed)).toEqual(state);
  });

  it('encodes search terms losslessly (spaces, &, #, =)', () => {
    const q = 'rig moves 54.3=N & 12#W';
    const hash = buildConsoleHash('databank', { databank: { ...DEFAULT_DATABANK_ROUTE, q } });
    expect(parseHashRoute(hash).q).toBe(q);
  });

  it('drops malformed page/dir params instead of guessing', () => {
    expect(parseHashRoute('#/warnings/list?page=0').page).toBeUndefined();
    expect(parseHashRoute('#/warnings/list?page=abc').page).toBeUndefined();
    expect(parseHashRoute('#/warnings/list?page=4').page).toBe(4);
    expect(parseHashRoute('#/warnings/list?dir=sideways').dir).toBeUndefined();
    expect(parseHashRoute('#/warnings/list?dir=ASC').dir).toBe('asc');
  });
});

describe('databankRouteFromRoute', () => {
  it('returns defaults for non-Data Bank routes', () => {
    expect(databankRouteFromRoute(parseHashRoute('#/warnings/map'))).toEqual(DEFAULT_DATABANK_ROUTE);
  });

  it('fills defaults for keys the URL omits', () => {
    expect(databankRouteFromRoute(parseHashRoute('#/warnings/list?q=rig'))).toEqual({
      ...DEFAULT_DATABANK_ROUTE,
      q: 'rig',
    });
  });

  it('resets to defaults when the URL carries no query (Back from a filtered view)', () => {
    expect(databankRouteFromRoute(parseHashRoute('#/warnings/list'))).toEqual(DEFAULT_DATABANK_ROUTE);
  });
});

describe('databankRouteEqual', () => {
  it('treats identical states as equal and any field change as different', () => {
    expect(databankRouteEqual(DEFAULT_DATABANK_ROUTE, { ...DEFAULT_DATABANK_ROUTE })).toBe(true);
    expect(databankRouteEqual(DEFAULT_DATABANK_ROUTE, { ...DEFAULT_DATABANK_ROUTE, q: 'x' })).toBe(false);
    expect(databankRouteEqual(DEFAULT_DATABANK_ROUTE, { ...DEFAULT_DATABANK_ROUTE, sort: 'title' })).toBe(false);
    expect(databankRouteEqual(DEFAULT_DATABANK_ROUTE, { ...DEFAULT_DATABANK_ROUTE, dir: 'asc' })).toBe(false);
    expect(databankRouteEqual(DEFAULT_DATABANK_ROUTE, { ...DEFAULT_DATABANK_ROUTE, page: 2 })).toBe(false);
    expect(databankRouteEqual(DEFAULT_DATABANK_ROUTE, { ...DEFAULT_DATABANK_ROUTE, navarea: 'VIII' })).toBe(false);
  });
});

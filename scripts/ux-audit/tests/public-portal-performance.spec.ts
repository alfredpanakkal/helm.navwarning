import { test, expect, type Page } from '@playwright/test';

const SUPABASE_ORIGIN = 'https://ocqpfbkuiomzhbxxvemi.supabase.co';

type Row = Record<string, unknown>;

interface PublicApiState {
  spatialRows: Row[];
  textRows: Row[];
  fail: boolean;
  delayMs: number;
  spatialRequests?: number;
  textRequests?: number;
  rangeRequests?: Array<{ table: string; range: string | null }>;
}

const publicWarning = (): Row => ({
  warning_id: '11111111-1111-4111-8111-111111111111',
  canonical_id: 'CACHE-TEST-1/26',
  navarea: 'NA VIII',
  title: 'Public cache acceptance warning',
  area_text: 'Test area in the Indian Ocean',
  categories: ['general'],
  severity: 'moderate',
  status: 'active',
  triage_tier: 'A',
  data_quality: 'EXPLICIT',
  valid_from: '2026-11-15T00:00:00Z',
  valid_to: null,
  geom_id: 'cache-test-geometry-1',
  feature_type: 'POINT',
  buffer_nm: 0,
  corridor_half_width_nm: 0,
  geojson_blob: { type: 'Point', coordinates: [75, 10] },
});

const reviewWarning = (tier: 'B' | 'C'): Row => ({
  ...publicWarning(),
  warning_id: tier === 'B'
    ? '22222222-2222-4222-8222-222222222222'
    : '33333333-3333-4333-8333-333333333333',
  canonical_id: 'REVIEW-' + tier + '/26',
  geom_id: 'review-geometry-' + tier,
  triage_tier: tier,
});

const bulletin = (): Row => ({
  id: '11111111-1111-4111-8111-111111111111',
  raw_text: 'CACHE ACCEPTANCE UNIQUE BULLETIN TEXT',
  issued_at: '2026-11-15T00:00:00Z',
  parsing_method: 'RULE',
  qa_flags: [],
});

function watchPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      console.log(`[public portal browser ${message.type()}] ${message.text()}`);
    }
  });
  return errors;
}

async function installPublicApiMock(page: Page, state: PublicApiState) {
  await page.route(`${SUPABASE_ORIGIN}/rest/v1/**`, async (route) => {
    const request = route.request();
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, HEAD, OPTIONS',
      'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, accept-profile, content-profile, range, range-unit, prefer',
      'access-control-expose-headers': 'content-range',
    };

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (state.fail) {
      await route.abort('failed');
      return;
    }

    if (state.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, state.delayMs));
    }

    const table = new URL(request.url()).pathname.split('/').pop();
    if (table === 'nav_warnings_active_spatial') state.spatialRequests = (state.spatialRequests || 0) + 1;
    if (table === 'nav_warnings') state.textRequests = (state.textRequests || 0) + 1;
    const rows = table === 'nav_warnings_active_spatial'
      ? state.spatialRows
      : table === 'nav_warnings'
        ? state.textRows
        : [];
    const rangeHeader = request.headers().range || null;
    // PostgREST versions may expose the requested page through Range or URL
    // offset/limit parameters. Support both to keep this fixture deterministic.
    const rangeMatch = rangeHeader && /(?:^|=)(\\d+)-(\\d+)$/.exec(rangeHeader);
    const query = new URL(request.url()).searchParams;
    const rangeStart = rangeMatch ? Number(rangeMatch[1]) : Number(query.get('offset') || 0);
    const rangeEnd = rangeMatch
      ? Number(rangeMatch[2])
      : rangeStart + Number(query.get('limit') || 1000) - 1;
    const requestedRange = rangeMatch
      ? `${rangeStart}-${rangeEnd}`
      : query.has('offset') || query.has('limit')
        ? `${rangeStart}-${rangeEnd}`
        : null;
    if (state.rangeRequests) state.rangeRequests.push({ table: table || '', range: requestedRange });
    const pageRows = rows.slice(rangeStart, rangeEnd + 1);
    const contentRange = pageRows.length
      ? `${rangeStart}-${rangeStart + pageRows.length - 1}/${rows.length}`
      : `*/${rows.length}`;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        ...corsHeaders,
        'content-range': contentRange,
      },
      body: JSON.stringify(pageRows),
    });
  });

  // Keep map-tile providers out of this data-cache test; tile availability is
  // unrelated to the public warning snapshot and is tested separately.
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('https://tiles.openseamap.org/**', (route) => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('hw-navarea-onboarding-v1', 'complete');
  });
}

async function readPublicSnapshot(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase | null>((resolve) => {
      const request = indexedDB.open('helm-warning-public-cache');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    if (!db || !db.objectStoreNames.contains('snapshots')) {
      db?.close();
      return null;
    }
    const snapshot = await new Promise<unknown>((resolve) => {
      const request = db.transaction('snapshots', 'readonly')
        .objectStore('snapshots')
        .get('active-warning-snapshot');
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
    db.close();
    return snapshot;
  });
}

async function openDataBank(page: Page) {
  await page.locator('#tab-btn-data').click();
  await expect(page.locator('#tab-data')).toBeVisible();
}

test.describe('public NAVAREA snapshot cache', () => {
  test('first visit is live; repeat visit renders the saved Tier-A snapshot before refresh', async ({ page }) => {
    const errors = watchPageErrors(page);
    const state: PublicApiState = {
      spatialRows: [publicWarning(), reviewWarning('B'), reviewWarning('C')],
      textRows: [bulletin()],
      fail: false,
      delayMs: 0,
    };
    await installPublicApiMock(page, state);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataSubtitle')).toContainText('1 published warning', { timeout: 30_000 });
    const apiDiagnostics = await page.evaluate(async () => {
      const result = await (window as any).hwDb.fetchActiveWarnings();
      return {
        source: result.source,
        complete: result.complete,
        count: Array.isArray(result.data) ? result.data.length : null,
        keys: Object.keys(result),
      };
    });
    console.log('[public cache acceptance] fetch result diagnostics', JSON.stringify(apiDiagnostics));
    await expect(page.locator('#dataCacheStatus')).toBeHidden();
    await expect(page.locator('#dataFreshness')).toContainText('Current warning data refreshed from Supabase.');
    await expect(page.locator('#dataFreshness')).not.toContainText('saved public snapshot');
    const cacheDiagnostics = await page.evaluate(async () => {
      const databases = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : null;
      const db = await new Promise<IDBDatabase | null>((resolve) => {
        const request = indexedDB.open('helm-warning-public-cache');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      });
      const stores = db ? Array.from(db.objectStoreNames) : [];
      db?.close();
      return { indexedDBAvailable: !!window.indexedDB, databases, stores };
    });
    console.log('[public cache acceptance] IndexedDB diagnostics', JSON.stringify(cacheDiagnostics));
    console.log('[public cache acceptance] mocked API request counts', JSON.stringify({
      spatial: state.spatialRequests || 0,
      text: state.textRequests || 0,
    }));
    console.log('[public cache acceptance] stored snapshot record', JSON.stringify(await readPublicSnapshot(page)));
    await openDataBank(page);
    await expect(page.locator('#tableBody')).toContainText('CACHE-TEST-1/26');

    // Full-text search must still work after the Tier-A bulletin hydration.
    await page.locator('#searchInput').fill('CACHE ACCEPTANCE UNIQUE BULLETIN TEXT');
    await expect(page.locator('#tableBody')).toContainText('CACHE-TEST-1/26');
    await page.locator('#searchInput').fill('');
    await page.locator('#tableBody tr:not(.table-detail-row)').first().click();
    await expect(page.locator('#tableBody .table-detail-text')).toContainText('CACHE ACCEPTANCE UNIQUE BULLETIN TEXT');

    await expect.poll(async () => {
      const snapshot = await readPublicSnapshot(page) as { data?: Row[] } | null;
      return snapshot?.data?.length ?? 0;
    }).toBe(1);

    const saved = await readPublicSnapshot(page) as { data: Row[]; schemaVersion: number; savedAt: string };
    expect(saved.schemaVersion).toBe(1);
    expect(saved.savedAt).toBeTruthy();
    expect(saved.data).toHaveLength(1);
    expect(saved.data.every((warning) => warning.status === 'active' && warning.triage_tier === 'A')).toBe(true);

    // Slow only the fresh API responses. The prior snapshot must appear while
    // those requests are still pending, and must be replaced by the fresh data.
    state.delayMs = 1200;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataCacheStatus')).toContainText('checking for updates', { timeout: 10_000 });
    await expect(page.locator('#mapLiveBadge')).toContainText('cached');
    await openDataBank(page);
    await expect(page.locator('#tableBody')).toContainText('CACHE-TEST-1/26');
    await expect(page.locator('#dataCacheStatus')).toBeHidden({ timeout: 30_000 });

    expect(errors, 'no uncaught browser errors').toEqual([]);
  });


  test('public text hydration paginates beyond the PostgREST 1,000-row limit', async ({ page }) => {
    const fillerRows = Array.from({ length: 1000 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      raw_text: 'Unrelated Tier-A bulletin fixture',
      issued_at: '2026-11-15T00:00:00Z',
      parsing_method: 'RULE',
      qa_flags: [],
    }));
    const state: PublicApiState = {
      spatialRows: [publicWarning()],
      // The matching bulletin sorts after the first full 1,000-row page.
      textRows: [...fillerRows, bulletin()],
      fail: false,
      delayMs: 0,
      rangeRequests: [],
    };
    await installPublicApiMock(page, state);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataSubtitle')).toContainText('1 published warning', { timeout: 30_000 });
    await expect(page.locator('#dataCacheStatus')).toBeHidden({ timeout: 30_000 });
    await openDataBank(page);
    await page.locator('#searchInput').fill('CACHE ACCEPTANCE UNIQUE BULLETIN TEXT');
    await expect(page.locator('#tableBody')).toContainText('CACHE-TEST-1/26');

    const textRanges = (state.rangeRequests || [])
      .filter((request) => request.table === 'nav_warnings')
      .map((request) => request.range);
    expect(textRanges).toContain('0-999');
    expect(textRanges).toContain('1000-1999');
  });

  test('failed refresh keeps a labelled snapshot; successful empty refresh removes cancelled warnings permanently', async ({ page }) => {
    const errors = watchPageErrors(page);
    const state: PublicApiState = {
      spatialRows: [publicWarning()],
      textRows: [bulletin()],
      fail: false,
      delayMs: 0,
    };
    await installPublicApiMock(page, state);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataSubtitle')).toContainText('1 published warning', { timeout: 30_000 });
    await expect.poll(async () => {
      const snapshot = await readPublicSnapshot(page) as { data?: Row[] } | null;
      return snapshot?.data?.length ?? 0;
    }).toBe(1);

    // Simulate a failed Supabase refresh without taking the local page offline.
    state.fail = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataCacheStatus')).toContainText('latest status could not be confirmed', { timeout: 30_000 });
    await expect(page.locator('#mapLiveBadge')).toContainText('cached');
    await openDataBank(page);
    await expect(page.locator('#tableBody')).toContainText('CACHE-TEST-1/26');

    // The authoritative successful empty result represents a cancelled or
    // superseded warning. It must replace, not merge with, the saved snapshot.
    state.fail = false;
    state.spatialRows = [];
    state.textRows = [];
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataCacheStatus')).toBeHidden({ timeout: 30_000 });
    await expect(page.locator('#dataSubtitle')).toContainText('0 published warnings');
    await openDataBank(page);
    await expect(page.locator('#tableBody')).not.toContainText('CACHE-TEST-1/26');

    await expect.poll(async () => {
      const snapshot = await readPublicSnapshot(page) as { data?: Row[] } | null;
      return snapshot?.data?.length ?? -1;
    }).toBe(0);

    // A later failed refresh may show the empty last-known snapshot, but must
    // never resurrect the warning that disappeared from the authoritative view.
    state.fail = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataCacheStatus')).toContainText('latest status could not be confirmed', { timeout: 30_000 });
    await expect(page.locator('#dataSubtitle')).toContainText(/0 .*published warnings/);
    await openDataBank(page);
    await expect(page.locator('#tableBody')).not.toContainText('CACHE-TEST-1/26');

    expect(errors, 'no uncaught browser errors').toEqual([]);
  });

  test('fresh geometry replaces the displayed cached map during partial text hydration without overwriting the saved snapshot', async ({ page }) => {
    const errors = watchPageErrors(page);
    const state: PublicApiState = {
      spatialRows: [publicWarning()],
      textRows: [bulletin()],
      fail: false,
      delayMs: 0,
    };
    await installPublicApiMock(page, state);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataSubtitle')).toContainText('1 published warning', { timeout: 30_000 });
    await expect.poll(async () => {
      const snapshot = await readPublicSnapshot(page) as { data?: Row[] } | null;
      return snapshot?.data?.length ?? 0;
    }).toBe(1);

    const savedBefore = await readPublicSnapshot(page) as { data: Row[] };
    expect(savedBefore.data[0].canonical_id).toBe('CACHE-TEST-1/26');

    state.spatialRows = [{
      ...publicWarning(),
      warning_id: '44444444-4444-4444-8444-444444444444',
      canonical_id: 'FRESH-GEOMETRY-2/26',
      geom_id: 'fresh-geometry-2',
      title: 'Fresh geometry warning',
    }];
    state.textRows = [];
    state.delayMs = 700;

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataCacheStatus')).toContainText('checking for updates', { timeout: 10_000 });
    await expect(page.locator('#tableBody')).toContainText('CACHE-TEST-1/26');
    await expect(page.locator('#mapLiveBadge')).toContainText('cached');

    await expect(page.locator('#dataCacheStatus')).toContainText('full-text search may be incomplete', { timeout: 30_000 });
    await expect(page.locator('#mapLiveBadge')).toContainText('fresh geometry');
    await expect(page.locator('#mapLiveBadge')).toContainText('text incomplete');
    await openDataBank(page);
    await expect(page.locator('#tableBody')).toContainText('FRESH-GEOMETRY-2/26');
    await expect(page.locator('#tableBody')).not.toContainText('CACHE-TEST-1/26');

    await page.locator('#searchInput').fill('UNAVAILABLE BULLETIN TOKEN 8842');
    await expect(page.locator('#tableBody')).not.toContainText('FRESH-GEOMETRY-2/26');
    await page.locator('#searchInput').fill('');

    await page.evaluate(() => {
      (window as any).openWarningDetails({
        id: '44444444-4444-4444-8444-444444444444',
        warning_id: '44444444-4444-4444-8444-444444444444',
        canonical_id: 'FRESH-GEOMETRY-2/26',
        navarea: 'NA VIII',
        title: 'Fresh geometry warning',
        area_text: 'Test area',
        categories: ['general'],
        severity: 'moderate',
      });
    });
    await expect(page.locator('#warningDetailsDrawer .warning-expanded-text'))
      .toContainText('Bulletin text not yet retrieved');

    const preserved = await readPublicSnapshot(page) as { data: Row[] };
    expect(preserved.data[0].canonical_id).toBe('CACHE-TEST-1/26');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#tableBody')).toContainText('CACHE-TEST-1/26');
    await expect(page.locator('#dataCacheStatus')).toContainText('checking for updates', { timeout: 10_000 });
    await expect(page.locator('#dataCacheStatus')).toContainText('full-text search may be incomplete', { timeout: 30_000 });
    await expect(page.locator('#tableBody')).toContainText('FRESH-GEOMETRY-2/26');
    const afterReload = await readPublicSnapshot(page) as { data: Row[] };
    expect(afterReload.data[0].canonical_id).toBe('CACHE-TEST-1/26');

    expect(errors, 'no uncaught browser errors').toEqual([]);
  });

  test('first visit with no saved snapshot and failed Supabase access shows unavailable state', async ({ page }) => {
    const errors = watchPageErrors(page);
    const state: PublicApiState = {
      spatialRows: [],
      textRows: [],
      fail: true,
      delayMs: 0,
    };
    await installPublicApiMock(page, state);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataCacheStatus')).toContainText('no saved public snapshot is available', { timeout: 30_000 });
    await expect(page.locator('#mapSubtitle')).toContainText('Unable to load authoritative warning geometry.');
    await expect(page.locator('#mapLiveBadge')).toContainText('Data unavailable');
    await expect.poll(async () => await readPublicSnapshot(page)).toBeNull();

    expect(errors, 'no uncaught browser errors').toEqual([]);
  });
});

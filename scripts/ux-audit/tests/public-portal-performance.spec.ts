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
  return errors;
}

async function installPublicApiMock(page: Page, state: PublicApiState) {
  await page.route(`${SUPABASE_ORIGIN}/rest/v1/**`, async (route) => {
    const request = route.request();
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, HEAD, OPTIONS',
      'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, accept-profile, content-profile, range, prefer',
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

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        ...corsHeaders,
        'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0',
      },
      body: JSON.stringify(rows),
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
    await expect(page.locator('#dataCacheStatus')).toBeHidden();
    const cacheDiagnostics = await page.evaluate(async () => ({
      indexedDBAvailable: !!window.indexedDB,
      databases: typeof indexedDB.databases === 'function' ? await indexedDB.databases() : null,
    }));
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

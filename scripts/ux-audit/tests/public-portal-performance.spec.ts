import { test, expect, type Page } from '@playwright/test';

const SUPABASE_ORIGIN = 'https://ocqpfbkuiomzhbxxvemi.supabase.co';

type Row = Record<string, unknown>;

interface PublicApiState {
  spatialRows: Row[];
  textRows: Row[];
  fail: boolean;
  delayMs: number;
  textDelayMs?: number;
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

    const table = new URL(request.url()).pathname.split('/').pop();
    const delayMs = table === 'nav_warnings' ? (state.textDelayMs ?? state.delayMs) : state.delayMs;
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
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
    const rangeMatch = rangeHeader && /(?:^|=)(\d+)-(\d+)$/.exec(rangeHeader);
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


test.describe('public workspace interaction regressions', () => {
  const emptyState = (): PublicApiState => ({
    spatialRows: [],
    textRows: [],
    fail: false,
    delayMs: 0,
  });

  test('desktop warning selection keeps the newest two in order', async ({ page }) => {
    await installPublicApiMock(page, emptyState());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      typeof (window as any).openWarningDetails === 'function' &&
      document.body.classList.contains('is-desktop')
    );

    await page.evaluate(() => {
      const open = (window as any).openWarningDetails;
      ['ORDER-1/26', 'ORDER-2/26', 'ORDER-3/26'].forEach((id, index) => {
        open({
          canonical_id: id,
          navarea: 'NA VIII',
          title: 'Selection ' + id,
          severity: 'high',
          categories: ['general'],
          is_verified: true,
          raw_text: 'Selection order fixture ' + index,
        });
      });
    });

    const cards = page.locator('.warning-compare-card strong');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('ORDER-3/26');
    await expect(cards.nth(1)).toContainText('ORDER-2/26');
    await expect(page.locator('#drawerDetailsTitle')).toContainText('2/2');
    expect((await cards.allTextContents()).join(' ')).not.toContain('ORDER-1/26');
  });

  test('desktop panel resizers enforce minimum widths and support keyboard input', async ({ page }) => {
    const errors = watchPageErrors(page);
    await installPublicApiMock(page, emptyState());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      document.querySelector('.public-warning-workspace')?.getAttribute('data-resizers-ready') === 'true'
    );

    const width = (selector: string) => page.locator(selector).evaluate((element) =>
      element.getBoundingClientRect().width
    );

    const first = await page.locator('#mapWarningsResizer').boundingBox();
    if (!first) throw new Error('Map/warnings resizer is not visible');
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(0, first.y + first.height / 2, { steps: 5 });
    await page.mouse.up();
    expect(await width('.public-warning-workspace .map-container')).toBeGreaterThanOrEqual(419);
    expect(await width('#mapWarningList')).toBeGreaterThanOrEqual(279);

    const second = await page.locator('#warningsDetailsResizer').boundingBox();
    if (!second) throw new Error('Warnings/details resizer is not visible');
    await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2);
    await page.mouse.down();
    await page.mouse.move(1439, second.y + second.height / 2, { steps: 5 });
    await page.mouse.up();
    expect(await width('#mapWarningList')).toBeGreaterThanOrEqual(279);
    expect(await width('#warningDetailsDrawer')).toBeGreaterThanOrEqual(279);

    const beforeKeyboardResize = await width('.public-warning-workspace .map-container');
    await page.locator('#mapWarningsResizer').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => width('.public-warning-workspace .map-container'))
      .toBeGreaterThan(beforeKeyboardResize + 5);
    expect(errors, 'no uncaught browser errors').toEqual([]);
  });

  test('Escape closes floating details before exiting map focus mode', async ({ page }) => {
    await installPublicApiMock(page, emptyState());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean((window as any).hwMap));

    const workspace = page.locator('.public-warning-workspace');
    await page.locator('#btnMapFocus').click();
    await expect(page.locator('body')).toHaveClass(/map-focus-active/);

    await page.keyboard.press('Escape');
    await expect(page.locator('body')).toHaveClass(/map-focus-active/);
    await expect(workspace).toHaveClass(/is-details-collapsed/);

    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/map-focus-active/);
    await expect(page.locator('#btnMapFocus')).toHaveAttribute('aria-pressed', 'false');
    await expect(workspace).not.toHaveClass(/is-focus-transition/);

    await page.locator('#btnShowWarningDetails').click();
    await expect(workspace).not.toHaveClass(/is-details-collapsed/);
  });

  test('Escape closes an open warning modal before workspace panels', async ({ page }) => {
    await installPublicApiMock(page, emptyState());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean((window as any).hwMap));

    const workspace = page.locator('.public-warning-workspace');
    await page.locator('#btnMapFocus').click();
    await expect(page.locator('body')).toHaveClass(/map-focus-active/);
    await page.evaluate(() => {
      document.getElementById('warningModal')?.classList.add('open');
    });

    await page.keyboard.press('Escape');
    await expect(page.locator('#warningModal')).not.toHaveClass(/open/);
    await expect(page.locator('body')).toHaveClass(/map-focus-active/);
    await expect(workspace).not.toHaveClass(/is-details-collapsed/);

    await page.keyboard.press('Escape');
    await expect(workspace).toHaveClass(/is-details-collapsed/);
    await expect(page.locator('body')).toHaveClass(/map-focus-active/);

    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/map-focus-active/);
  });


  test('mobile page remains scrollable until map interaction, then expands and restores', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installPublicApiMock(page, emptyState());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      document.body.classList.contains('is-mobile') && Boolean((window as any).hwMap)
    );

    const initial = await page.evaluate(() => ({
      expanded: document.body.classList.contains('mobile-map-expanded'),
      footerVisible: getComputedStyle(document.querySelector('.site-footer')!).display !== 'none',
      pageScrollable: document.documentElement.scrollHeight > window.innerHeight,
      mapHeight: document.querySelector('.map-container')!.getBoundingClientRect().height,
      viewportHeight: window.innerHeight,
    }));
    expect(initial.expanded).toBe(false);
    expect(initial.footerVisible).toBe(true);
    expect(initial.pageScrollable).toBe(true);
    expect(initial.mapHeight).toBeLessThan(initial.viewportHeight);

    await page.evaluate(() => {
      const map = (window as any).hwMap;
      (window as any).__mobileExpansionMap = map;
      const center = map.getCenter();
      (window as any).__mobileExpansionView = { lat: center.lat, lng: center.lng, zoom: map.getZoom() };
    });
    await page.locator('#map').click({ position: { x: 90, y: 90 } });

    await expect(page.locator('body')).toHaveClass(/mobile-map-expanded/);
    await expect(page.locator('.site-header')).toBeVisible();
    await expect(page.locator('.site-footer')).toBeHidden();
    await expect(page.locator('#btnMobileMapRestore')).toBeVisible();

    await page.locator('#btnMobileMapRestore').click();
    await expect(page.locator('body')).not.toHaveClass(/mobile-map-expanded/);
    await expect(page.locator('.site-footer')).toBeVisible();
    // Wait for the map's post-transition size refresh before checking its view.
    await page.waitForTimeout(400);

    const restored = await page.evaluate(() => {
      const map = (window as any).hwMap;
      const before = (window as any).__mobileExpansionView;
      const center = map.getCenter();
      return {
        sameMapInstance: map === (window as any).__mobileExpansionMap,
        sameZoom: map.getZoom() === before.zoom,
        sameCenter: Math.abs(center.lat - before.lat) < 0.000001 &&
          Math.abs(center.lng - before.lng) < 0.000001,
        before: { lat: before.lat, lng: before.lng, zoom: before.zoom },
        after: { lat: center.lat, lng: center.lng, zoom: map.getZoom() },
      };
    });
    expect(restored, JSON.stringify(restored)).toEqual({
      sameMapInstance: true,
      sameZoom: true,
      sameCenter: true,
      before: expect.any(Object),
      after: expect.any(Object),
    });
  });

  test('mobile Escape restores the full page from expanded map view', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installPublicApiMock(page, emptyState());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      document.body.classList.contains('is-mobile') && Boolean((window as any).hwMap)
    );

    await page.locator('#btnMapFocus').click();
    await expect(page.locator('body')).toHaveClass(/mobile-map-expanded/);
    await expect(page.locator('.site-header')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/mobile-map-expanded/);
    await expect(page.locator('.site-footer')).toBeVisible();
    await expect(page.locator('#btnMapFocus')).toHaveAttribute('aria-pressed', 'false');
  });

  test('failed waypoint drag restores the marker to the persisted route position', async ({ page }) => {
    await installPublicApiMock(page, emptyState());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean((window as any).hwMap));
    await page.locator('#btnVoyagePlanner').click();
    await page.locator('#voyagePlannerContent [data-action="create-route"]').click();
    await page.locator('#voyageRouteName').fill('Drag persistence test');
    await page.locator('form[data-form="route-settings"] button[type="submit"]').click();

    const addWaypoint = async (lat: number, lon: number) => {
      await page.locator('[data-action="toggle-add-mode"]').click();
      await page.evaluate(({ latitude, longitude }) => {
        const browser = window as any;
        browser.hwMap.fire('click', { latlng: browser.L.latLng(latitude, longitude) });
      }, { latitude: lat, longitude: lon });
    };
    await addWaypoint(10, 75);
    await expect(page.locator('.voyage-waypoint-row')).toHaveCount(1);
    await addWaypoint(10, 76);
    await expect(page.locator('.voyage-waypoint-row')).toHaveCount(2);

    await page.evaluate(() => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'helm_voyage_planner_v1') {
          throw new Error('Quota exceeded');
        }
        return originalSetItem.call(this, key, value);
      };
    });

    await page.evaluate(() => {
      const browser = window as any;
      let marker: any = null;
      browser.hwMap.eachLayer((layer: any) => {
        if (typeof layer.eachLayer !== 'function') return;
        layer.eachLayer((child: any) => {
          if (child instanceof browser.L.Marker && child.options.title === 'WP 1') marker = child;
        });
      });
      if (!marker) throw new Error('First waypoint marker was not found');
      const position = marker.getLatLng();
      marker.setLatLng([position.lat + 1, position.lng + 1]);
      marker.fire('dragend');
    });

    await expect(page.locator('.voyage-planner-notice')).toContainText('Quota exceeded');
    const restoredPosition = await page.evaluate(() => {
      const browser = window as any;
      let marker: any = null;
      browser.hwMap.eachLayer((layer: any) => {
        if (typeof layer.eachLayer !== 'function') return;
        layer.eachLayer((child: any) => {
          if (child instanceof browser.L.Marker && child.options.title === 'WP 1') marker = child;
        });
      });
      if (!marker) return null;
      const position = marker.getLatLng();
      return [position.lat, position.lng];
    });
    expect(restoredPosition?.[0]).toBeCloseTo(10, 6);
    expect(restoredPosition?.[1]).toBeCloseTo(75, 6);
  });
});

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

  test('stalled optional text hydration does not delay fresh authoritative geometry', async ({ page }) => {
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
      warning_id: '55555555-5555-4555-8555-555555555555',
      canonical_id: 'FRESH-GEOMETRY-TEXT-TIMEOUT/26',
      geom_id: 'fresh-geometry-text-timeout',
      title: 'Fresh geometry despite stalled text',
    }];
    state.textRows = [{
      ...bulletin(),
      id: '55555555-5555-4555-8555-555555555555',
      raw_text: 'LATE BULLETIN TEXT SHOULD NOT BLOCK MAP',
    }];
    state.textDelayMs = 7000;

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataCacheStatus')).toContainText('checking for updates', { timeout: 10_000 });
    await expect(page.locator('#dataCacheStatus')).toContainText('full-text search may be incomplete', { timeout: 10_000 });
    await expect(page.locator('#mapLiveBadge')).toContainText('fresh geometry');
    await expect(page.locator('#tableBody')).toContainText('FRESH-GEOMETRY-TEXT-TIMEOUT/26');
    await expect(page.locator('#tableBody')).not.toContainText('CACHE-TEST-1/26');

    const preserved = await readPublicSnapshot(page) as { data: Row[] };
    expect(preserved.data[0].canonical_id).toBe('CACHE-TEST-1/26');

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

  test('automatic basemap follows appearance and manual choices persist', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await installPublicApiMock(page, {
      spatialRows: [],
      textRows: [],
      fail: false,
      delayMs: 0,
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[name="basemap-desktop"]')).toHaveCount(3);
    await expect(page.locator('input[name="basemap-desktop"][value="auto"]')).toHaveCount(0);
    await expect(page.locator('input[name="basemap-desktop"][value="carto-positron"], input[name="basemap-desktop"][value="esri-ocean"]')).toHaveCount(0);
    await expect(page.locator('#mapSettingsPopover')).toContainText('OpenStreetMap in Light Mode and CARTO Dark Matter in Dark Mode');

    const baseMapUrl = () => page.evaluate(() => {
      const map = (window as any).map;
      if (!map) return null;
      let url: string | null = null;
      map.eachLayer((layer: any) => {
        if (typeof layer?._url === 'string' && (
          layer._url.includes('/api/tiles/carto/') ||
          layer._url.includes('/api/tiles/osm/')
        )) url = layer._url;
      });
      return url;
    });

    await expect.poll(baseMapUrl).toContain('/dark_all/');

    await page.evaluate(() => (document.querySelector('[data-theme-set="dark"]') as HTMLButtonElement).click());
    await expect.poll(baseMapUrl).toContain('/dark_all/');
    await page.evaluate(() => (document.querySelector('[data-theme-set="night"]') as HTMLButtonElement).click());
    await expect.poll(baseMapUrl).toContain('/dark_all/');
    await page.evaluate(() => (document.querySelector('[data-theme-set="light"]') as HTMLButtonElement).click());
    await expect.poll(baseMapUrl).toContain('/api/tiles/osm/');
    await page.evaluate(() => (document.querySelector('[data-theme-set="system"]') as HTMLButtonElement).click());
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(baseMapUrl).toContain('/api/tiles/osm/');

    await page.evaluate(() => (window as any).selectBaseMap('carto-voyager'));
    await expect.poll(baseMapUrl).toContain('/voyager/');
    await page.evaluate(() => (document.querySelector('[data-theme-set="dark"]') as HTMLButtonElement).click());
    await expect.poll(baseMapUrl).toContain('/voyager/');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(baseMapUrl).toContain('/voyager/');
    const manualPreference = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('helm_map_preferences_v1') || '{}').baseMap
    );
    expect(manualPreference).toBe('carto-voyager');

    await page.evaluate(() => (window as any).selectBaseMap('auto'));
    await expect.poll(baseMapUrl).toContain('/dark_all/');
    const automaticPreference = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('helm_map_preferences_v1') || '{}').baseMap
    );
    expect(automaticPreference).toBe('auto');

    await page.evaluate(() => (window as any).selectBaseMap('osm'));
    const osmBaseMapUrl = () => page.evaluate(() => {
      const map = (window as any).map;
      let url: string | null = null;
      map?.eachLayer((layer: any) => {
        if (typeof layer?._url === 'string' && layer._url.includes('/api/tiles/osm/')) url = layer._url;
      });
      return url;
    });
    await expect.poll(osmBaseMapUrl).toContain('/api/tiles/osm/');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(osmBaseMapUrl).toContain('/api/tiles/osm/');
    const osmPreference = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('helm_map_preferences_v1') || '{}').baseMap
    );
    expect(osmPreference).toBe('osm');
    await expect(page.locator('input[name="basemap-desktop"][value="osm"]')).toBeChecked();

    await page.evaluate(() => (window as any).resetMapSettingsToDefaults());
    const resetPreference = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('helm_map_preferences_v1') || '{}').baseMap
    );
    expect(resetPreference).toBe('auto');
    await expect.poll(baseMapUrl).toContain('/dark_all/');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#btnMapSettings').click();
    await expect(page.locator('input[name="basemap-mobile"]')).toHaveCount(3);
    await expect(page.locator('input[name="basemap-mobile"][value="auto"]')).toHaveCount(0);
    await expect(page.locator('input[name="basemap-mobile"][value="carto-positron"], input[name="basemap-mobile"][value="esri-ocean"]')).toHaveCount(0);
    await expect(page.locator('#mapSettingsSheet')).toContainText('OpenStreetMap in Light Mode and CARTO Dark Matter in Dark Mode');

    expect(errors, 'no uncaught browser errors').toEqual([]);
  });

  test('legacy basemap preferences migrate without changing overlay settings', async ({ page }) => {
    await installPublicApiMock(page, {
      spatialRows: [],
      textRows: [],
      fail: false,
      delayMs: 0,
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean((window as any).hwMap));

    const legacyValues = ['auto', 'carto-positron', 'esri-ocean', 'invalid-basemap', undefined];
    for (const legacyValue of legacyValues) {
      await page.evaluate((baseMap) => {
        const saved: Record<string, unknown> = {
          masterOverlays: false,
          overlays: { points: false, polygons: true, seamarks: false, soundings: true },
        };
        if (baseMap !== undefined) saved.baseMap = baseMap;
        localStorage.setItem('helm_map_preferences_v1', JSON.stringify(saved));
      }, legacyValue);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect.poll(() => page.evaluate(() =>
        JSON.parse(localStorage.getItem('helm_map_preferences_v1') || '{}').baseMap
      )).toBe('auto');
      const migrated = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('helm_map_preferences_v1') || '{}')
      );
      expect(migrated.masterOverlays).toBe(false);
      expect(migrated.overlays.points).toBe(false);
      expect(migrated.overlays.seamarks).toBe(false);
      expect(migrated.overlays.soundings).toBe(true);
      expect(migrated.overlays.polygons).toBe(true);
    }

    for (const manualValue of ['osm', 'carto-voyager', 'carto-dark']) {
      await page.evaluate((baseMap) => {
        localStorage.setItem('helm_map_preferences_v1', JSON.stringify({
          baseMap,
          masterOverlays: false,
          overlays: { points: false },
        }));
      }, manualValue);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect.poll(() => page.evaluate(() =>
        JSON.parse(localStorage.getItem('helm_map_preferences_v1') || '{}').baseMap
      )).toBe(manualValue);
    }
  });

  test('NAVAREA boundaries load on demand, persist, and stay beneath warning layers', async ({ page }) => {
    const errors = watchPageErrors(page);
    const state: PublicApiState = {
      spatialRows: [publicWarning()],
      textRows: [bulletin()],
      fail: false,
      delayMs: 0,
    };
    await installPublicApiMock(page, state);

    let boundaryRequests = 0;
    let boundaryFeatureCount = 0;
    let boundaryFeatureIds: string[] = [];
    let boundaryGeometryTypes: string[] = [];
    let invalidPositions = 0;
    let maxLongitudeJump = 0;
    let unclosedRings = 0;
    await page.route('**/assets/data/navarea-boundaries.geojson', async (route) => {
      boundaryRequests += 1;
      const response = await route.fetch();
      const geojson = await response.json();
      boundaryFeatureCount = geojson.features?.length || 0;
      boundaryFeatureIds = (geojson.features || []).map((feature: any) => feature.properties?.id);
      boundaryGeometryTypes = (geojson.features || []).map((feature: any) => feature.geometry?.type);
      const inspectCoordinates = (coordinates: any) => {
        if (!Array.isArray(coordinates) || coordinates.length === 0) return;
        if (Array.isArray(coordinates[0]) && typeof coordinates[0][0] === 'number') {
          const first = coordinates[0];
          const last = coordinates[coordinates.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) unclosedRings += 1;
          for (const position of coordinates) {
            if (
              !Array.isArray(position) ||
              !Number.isFinite(position[0]) ||
              !Number.isFinite(position[1]) ||
              position[0] < -180 || position[0] > 180 ||
              position[1] < -90 || position[1] > 90
            ) invalidPositions += 1;
          }
          for (let index = 1; index < coordinates.length; index += 1) {
            maxLongitudeJump = Math.max(maxLongitudeJump, Math.abs(coordinates[index][0] - coordinates[index - 1][0]));
          }
          return;
        }
        coordinates.forEach(inspectCoordinates);
      };
      (geojson.features || []).forEach((feature: any) => inspectCoordinates(feature.geometry?.coordinates));
      await route.fulfill({ response });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataSubtitle')).toContainText('1 published warning', { timeout: 30_000 });
    await expect(page.locator('#map')).toBeVisible();
    expect(boundaryRequests, 'disabled boundaries are not fetched on first load').toBe(0);

    await page.locator('#btnMapSettings').click();
    const desktopToggle = page.locator('#layerToggleNavareaBoundariesDesktop');
    await expect(desktopToggle).not.toBeChecked();
    await desktopToggle.check();

    const readBoundaryPane = () => page.evaluate(() => {
      const map = (window as any).hwMap;
      const pane = map?.getPane('navareaBoundariesPane');
      return {
        pathCount: pane?.querySelectorAll('path').length || 0,
        zIndex: Number(pane?.style.zIndex || 0),
        pointerEvents: pane?.style.pointerEvents || '',
        warningPaneZIndex: Number(getComputedStyle(map.getPane('overlayPane')).zIndex),
        markerPaneZIndex: Number(getComputedStyle(map.getPane('markerPane')).zIndex),
      };
    });

    await expect.poll(async () => (await readBoundaryPane()).pathCount).toBeGreaterThan(0);
    expect(boundaryRequests).toBe(1);
    expect(boundaryFeatureCount).toBe(21);
    expect(boundaryFeatureIds).toEqual([
      'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
      'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'
    ]);
    expect(new Set(boundaryFeatureIds).size).toBe(21);
    expect(boundaryGeometryTypes.every((type) => type === 'MultiPolygon')).toBe(true);
    expect(invalidPositions).toBe(0);
    expect(maxLongitudeJump).toBeLessThanOrEqual(180);
    expect(unclosedRings).toBe(0);
    const stacking = await readBoundaryPane();
    expect(stacking.zIndex).toBe(350);
    expect(stacking.pointerEvents).toBe('none');
    expect(stacking.warningPaneZIndex).toBeGreaterThan(stacking.zIndex);
    expect(stacking.markerPaneZIndex).toBeGreaterThan(stacking.zIndex);

    await desktopToggle.uncheck();
    await expect.poll(async () => (await readBoundaryPane()).pathCount).toBe(0);
    expect(boundaryRequests, 'turning the layer off does not refetch').toBe(1);
    await desktopToggle.check();
    await expect.poll(async () => (await readBoundaryPane()).pathCount).toBeGreaterThan(0);
    expect(boundaryRequests, 'turning the layer back on reuses the cached layer').toBe(1);

    const savedPreference = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('helm_map_preferences_v1') || '{}');
      return saved.overlays?.navareaBoundaries;
    });
    expect(savedPreference).toBe(true);
    await expect(page.locator('#layerToggleNavareaBoundariesMobile')).toBeChecked();

    // The saved preference restores the overlay on a mobile-sized map too.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(async () => (await readBoundaryPane()).pathCount).toBeGreaterThan(0);
    await page.locator('#btnMapSettings').click();
    const settingsSheet = page.locator('#mapSettingsSheet');
    await expect(settingsSheet).toHaveClass(/open/);
    await expect(settingsSheet).toHaveAttribute('aria-hidden', 'false');
    const mobileToggle = page.locator('#layerToggleNavareaBoundariesMobile');
    await expect(mobileToggle).toBeChecked();

    // The master switch also includes the boundary overlay.
    await page.locator('#masterToggleBtnMobile').click();
    await expect.poll(async () => (await readBoundaryPane()).pathCount).toBe(0);
    await page.locator('#masterToggleBtnMobile').click();
    await expect.poll(async () => (await readBoundaryPane()).pathCount).toBeGreaterThan(0);

    // Reset returns the new layer to its default-off state.
    const resetButton = settingsSheet.locator('.settings-reset-btn');
    await expect(resetButton).toBeVisible();
    await resetButton.click();
    await expect(mobileToggle).not.toBeChecked();
    await expect.poll(async () => (await readBoundaryPane()).pathCount).toBe(0);
    await expect(settingsSheet).toHaveAttribute('aria-hidden', 'false');

    await page.evaluate(() => (window as any).closeMapSettings());
    await expect(settingsSheet).toHaveAttribute('aria-hidden', 'true');

    expect(errors, 'no uncaught browser errors').toEqual([]);
  });


  test('invalid NAVAREA GeoJSON is rejected and a later retry succeeds', async ({ page }) => {
    const state: PublicApiState = {
      spatialRows: [publicWarning()],
      textRows: [bulletin()],
      fail: false,
      delayMs: 0,
    };
    await installPublicApiMock(page, state);

    let boundaryRequests = 0;
    await page.route('**/assets/data/navarea-boundaries.geojson', async (route) => {
      boundaryRequests += 1;
      if (boundaryRequests === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/geo+json',
          body: JSON.stringify({ type: 'FeatureCollection', features: [] }),
        });
        return;
      }
      await route.fulfill({ response: await route.fetch() });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataSubtitle')).toContainText('1 published warning', { timeout: 30_000 });
    await page.locator('#btnMapSettings').click();
    const toggle = page.locator('#layerToggleNavareaBoundariesDesktop');
    await toggle.check();

    await expect.poll(async () => {
      return page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('helm_map_preferences_v1') || '{}');
        return saved.overlays?.navareaBoundaries;
      });
    }).toBe(false);
    expect(boundaryRequests).toBe(1);
    expect(await page.evaluate(() => (window as any).hwMap?.getPane('navareaBoundariesPane')?.querySelectorAll('path').length || 0)).toBe(0);

    await toggle.check();
    await expect.poll(async () => page.evaluate(() => {
      const pane = (window as any).hwMap?.getPane('navareaBoundariesPane');
      return pane?.querySelectorAll('path').length || 0;
    })).toBeGreaterThan(0);
    expect(boundaryRequests).toBe(2);
  });

  test('HTTP failure clears the boundary preference and a subsequent request can retry', async ({ page }) => {
    const state: PublicApiState = {
      spatialRows: [publicWarning()],
      textRows: [bulletin()],
      fail: false,
      delayMs: 0,
    };
    await installPublicApiMock(page, state);

    let boundaryRequests = 0;
    await page.route('**/assets/data/navarea-boundaries.geojson', async (route) => {
      boundaryRequests += 1;
      if (boundaryRequests === 1) {
        await route.fulfill({ status: 503, body: 'temporarily unavailable' });
        return;
      }
      await route.fulfill({ response: await route.fetch() });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataSubtitle')).toContainText('1 published warning', { timeout: 30_000 });
    await page.locator('#btnMapSettings').click();
    const toggle = page.locator('#layerToggleNavareaBoundariesDesktop');
    await toggle.check();

    await expect.poll(async () => page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('helm_map_preferences_v1') || '{}');
      return saved.overlays?.navareaBoundaries;
    })).toBe(false);
    expect(boundaryRequests).toBe(1);

    await toggle.check();
    await expect.poll(async () => page.evaluate(() => {
      const pane = (window as any).hwMap?.getPane('navareaBoundariesPane');
      return pane?.querySelectorAll('path').length || 0;
    })).toBeGreaterThan(0);
    expect(boundaryRequests).toBe(2);
  });

  test('turning boundaries off while the GeoJSON request is pending prevents the layer from appearing', async ({ page }) => {
    const state: PublicApiState = {
      spatialRows: [publicWarning()],
      textRows: [bulletin()],
      fail: false,
      delayMs: 0,
    };
    await installPublicApiMock(page, state);

    let boundaryRequests = 0;
    await page.route('**/assets/data/navarea-boundaries.geojson', async (route) => {
      boundaryRequests += 1;
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({ response: await route.fetch() });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#dataSubtitle')).toContainText('1 published warning', { timeout: 30_000 });
    await page.locator('#btnMapSettings').click();
    const toggle = page.locator('#layerToggleNavareaBoundariesDesktop');
    await toggle.check();
    await toggle.uncheck();

    await expect.poll(async () => boundaryRequests).toBe(1);
    await page.waitForResponse((response) =>
      response.url().includes('/assets/data/navarea-boundaries.geojson') && response.status() === 200
    );
    await expect.poll(async () => page.evaluate(() => {
      const pane = (window as any).hwMap?.getPane('navareaBoundariesPane');
      return pane?.querySelectorAll('path').length || 0;
    })).toBe(0);
    expect(await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('helm_map_preferences_v1') || '{}');
      return saved.overlays?.navareaBoundaries;
    })).toBe(false);

    await toggle.check();
    await expect.poll(async () => page.evaluate(() => {
      const pane = (window as any).hwMap?.getPane('navareaBoundariesPane');
      return pane?.querySelectorAll('path').length || 0;
    })).toBeGreaterThan(0);
    expect(boundaryRequests).toBe(1);
  });



  test('Voyage Planner reuses the public map and persists route edits locally', async ({ page }) => {
    const errors = watchPageErrors(page);
    const state: PublicApiState = {
      spatialRows: [{ ...publicWarning(), zone_label: 'Route crossing', geojson_blob: { type: 'Point', coordinates: [75, 10] } }],
      textRows: [bulletin()],
      fail: false,
      delayMs: 0,
    };
    await installPublicApiMock(page, state);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean((window as any).hwMap));
    await page.locator('#btnVoyagePlanner').click();
    await expect(page.locator('#voyagePlannerPanel')).toBeVisible();
    await expect(page.locator('#voyagePlannerContent')).toContainText('No saved routes');

    await page.locator('#voyagePlannerContent [data-action="create-route"]').click();
    await page.locator('#voyageRouteName').fill('Indian Ocean passage');
    await page.locator('form[data-form="route-settings"] button[type="submit"]').click();

    await page.locator('[data-action="toggle-add-mode"]').click();
    await page.evaluate(() => {
      const browser = window as any;
      browser.hwMap.fire('click', { latlng: browser.L.latLng(10, 75) });
    });
    await expect(page.locator('.voyage-waypoint-row')).toHaveCount(1);

    await page.locator('[data-action="toggle-add-mode"]').click();
    await page.evaluate(() => {
      const browser = window as any;
      browser.hwMap.fire('click', { latlng: browser.L.latLng(10, 76) });
    });
    await expect(page.locator('.voyage-waypoint-row')).toHaveCount(2);
    await expect(page.locator('.voyage-assessment-row.is-intersects')).toContainText('CACHE-TEST-1/26');
    await page.evaluate(() => {
      const browser = window as any;
      const line = Object.values(browser.hwMap._layers).find((layer: any) => layer instanceof browser.L.Polyline) as any;
      if (!line) throw new Error('Expected a rendered route leg');
      line.fire('click', { latlng: browser.L.latLng(10, 75.5), originalEvent: null });
    });
    await expect(page.locator('.voyage-waypoint-row')).toHaveCount(3);
    await expect(page.locator('.voyage-planner-stat strong').first()).not.toHaveText('0.0 NM');

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('helm_voyage_planner_v1') || 'null'));
    expect(stored.version).toBe(1);
    expect(stored.routes[0].name).toBe('Indian Ocean passage');
    expect(stored.routes[0].warningRangeNm).toBe(10);
    expect(stored.routes[0].waypoints).toHaveLength(3);
    expect(stored.routes[0].waypoints[1].position.lat).toBe(10);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean((window as any).hwMap));
    await page.locator('#btnVoyagePlanner').click();
    await expect(page.locator('.voyage-waypoint-row')).toHaveCount(3);
    await expect(page.locator('#voyageRouteName')).toHaveValue('Indian Ocean passage');

    const geoJsonDownload = page.waitForEvent('download');
    await page.locator('[data-action="export-geojson"]').click();
    expect((await geoJsonDownload).suggestedFilename()).toBe('Indian-Ocean-passage.geojson');

    const gpxDownload = page.waitForEvent('download');
    await page.locator('[data-action="export-gpx"]').click();
    expect((await gpxDownload).suggestedFilename()).toBe('Indian-Ocean-passage.gpx');

    const csvDownload = page.waitForEvent('download');
    await page.locator('[data-action="export-csv"]').click();
    expect((await csvDownload).suggestedFilename()).toBe('Indian-Ocean-passage.csv');

    await page.locator('#btnVoyagePlannerClose').click();
    await expect(page.locator('.public-warning-workspace')).not.toHaveClass(/is-voyage-planner/);

    expect(errors, 'no uncaught browser errors').toEqual([]);
  });


  test('Voyage Planner leaves mismatched warning geometry not assessed', async ({ page }) => {
    const errors = watchPageErrors(page);
    const state: PublicApiState = {
      spatialRows: [{
        ...publicWarning(),
        feature_type: 'POINT',
        geojson_blob: { type: 'LineString', coordinates: [[75.5, 10.4], [75.5, 10.6]] },
      }],
      textRows: [bulletin()],
      fail: false,
      delayMs: 0,
    };
    await installPublicApiMock(page, state);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean((window as any).hwMap));
    await page.locator('#btnVoyagePlanner').click();
    await page.locator('#voyagePlannerContent [data-action="create-route"]').click();
    await page.locator('[data-action="toggle-add-mode"]').click();
    await page.evaluate(() => {
      const browser = window as any;
      browser.hwMap.fire('click', { latlng: browser.L.latLng(10, 75) });
    });
    await page.locator('[data-action="toggle-add-mode"]').click();
    await page.evaluate(() => {
      const browser = window as any;
      browser.hwMap.fire('click', { latlng: browser.L.latLng(11, 76) });
    });
    await expect(page.locator('.voyage-assessment-row.is-not-assessed')).toContainText('POINT / LineString');
    expect(errors, 'no uncaught browser errors').toEqual([]);
  });

  test('Voyage Planner preserves corrupt saved route data and disables editing', async ({ page }) => {
    const state: PublicApiState = {
      spatialRows: [publicWarning()],
      textRows: [bulletin()],
      fail: false,
      delayMs: 0,
    };
    await installPublicApiMock(page, state);
    await page.addInitScript(() => {
      localStorage.setItem('helm_voyage_planner_v1', '{broken');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean((window as any).hwMap));
    await page.locator('#btnVoyagePlanner').click();
    await expect(page.locator('#voyagePlannerContent')).toContainText('original data was preserved');
    await expect(page.locator('#voyagePlannerContent [data-action="create-route"]')).toHaveCount(0);
    const stored = await page.evaluate(() => localStorage.getItem('helm_voyage_planner_v1'));
    expect(stored).toBe('{broken');
  });

});

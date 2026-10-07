import { test, expect, type Page } from '@playwright/test';

/**
 * Sprint 0 smoke suite: guards docs/ux-audit/do-not-break.md.
 *
 * Every assertion here is a UX behaviour that later hierarchy redesign tasks
 * must keep working. No assertion depends on an API key: without a .env the
 * app runs on its in-memory seed data (5 warnings, 19 sources).
 *
 * page.evaluate payloads are passed as strings on purpose (a function literal
 * breaks under the tsx/esbuild toolchain used for the capture driver).
 */

type PageErrors = string[];

function watchPageErrors(page: Page): PageErrors {
  const errors: PageErrors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

async function openApp(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#main-content', { timeout: 60_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

async function matchingCount(page: Page): Promise<number> {
  const text = (await page.evaluate('document.body.innerText')) as string;
  const match = text.match(/Matching: (\d+)/);
  expect(match, 'Data Bank "Matching:" counter should be visible').not.toBeNull();
  return Number(match![1]);
}

async function goTab(page: Page, name: 'Data Bank' | 'Sources' | 'Map View') {
  await page.getByRole('tab', { name: new RegExp(`^${name}`, 'i') }).click();
}

/**
 * Task 3 fix round: smart-sort presets and quick filters moved into the
 * collapsed "More filters" secondary panel on the v2 path. Idempotent.
 */
async function openMoreFilters(page: Page) {
  const button = page.getByRole('button', { name: /^More filters$/ });
  if ((await button.getAttribute('aria-expanded')) !== 'true') {
    await button.click();
  }
}

test.describe('public shell', () => {
  test('header tabs, active-count shortcut and tab switching keep working', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);

    await expect(page.getByRole('tab', { name: /^Map View/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Data Bank/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Sources/i })).toBeVisible();
    await expect(page.getByText('Helm.Warning', { exact: true }).first()).toBeVisible();
    await expect(page.locator('button[title="Jump to active NAVWARNs in Data Bank"]')).toBeVisible();

    await goTab(page, 'Data Bank');
    await expect(page.getByRole('tab', { name: /^Data Bank/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#databank-table-header')).toBeVisible();

    await goTab(page, 'Sources');
    // Task 5: the default Sources view is the short summary; the legacy
    // registry heading now lives behind "View source details".
    await expect(page.getByText('Official Data Sources')).toBeVisible();

    expect(errors, 'no uncaught page errors').toEqual([]);
  });

  test('today the app has no URL-driven state (recorded as a constraint)', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.goto('/?navarea=I&tab=databank#sources', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#main-content', { timeout: 60_000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await expect(page.getByRole('tab', { name: /^Map View/i })).toHaveAttribute('aria-selected', 'true');
    expect(errors).toEqual([]);
  });
});

test.describe('data bank', () => {
  test('filters, quick filters, search, empty state and reset still work', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await goTab(page, 'Data Bank');
    await expect(page.locator('#databank-table-header')).toBeVisible();

    expect(await matchingCount(page)).toBe(5);

    // Quick filters live in the collapsed More filters panel (Task 3 fix).
    await openMoreFilters(page);

    // Quick filter: the "Unverified (n)" pill counts `status === 'unverified'
    // || extraction_confidence < 1` but the table filter matches only
    // `status === 'unverified'`, so the pill narrows the table to 0 today.
    // The behaviour guarded here is "the pill narrows the result set without
    // breaking the table" — see finding F-01 in docs/ux-audit/inventory.md.
    await page.getByRole('button', { name: /^Unverified \(\d+\)/ }).click();
    expect(await matchingCount(page)).toBeLessThan(5);

    await page.getByRole('button', { name: /^All \(\d+\)/ }).click();
    expect(await matchingCount(page)).toBe(5);

    await page.getByRole('button', { name: /^With Coords/ }).click();
    expect(await matchingCount(page)).toBe(5);

    await page.getByRole('button', { name: /^All \(\d+\)/ }).click();
    expect(await matchingCount(page)).toBe(5);

    const search = page.locator('input[placeholder="Search records by ID, text, area, coords..."]');
    await search.fill('014');
    expect(await matchingCount(page)).toBe(2);

    await search.fill('zzzz-no-match-zzzz');
    // The mobile list (md:hidden) and the desktop table (hidden md:block) each
    // render an empty state; assert the desktop one, which is visible at 1440px.
    const desktopEmptyState = page
      .locator('div[class*="md:block"]')
      .filter({ hasText: 'No Navigational Warnings Found' });
    await expect(desktopEmptyState).toBeVisible();
    // innerText only reports visible text, so this proves the empty state is
    // actually rendered.
    const bodyText = (await page.evaluate('document.body.innerText')) as string;
    expect(bodyText).toContain('NO NAVIGATIONAL WARNINGS FOUND');

    await search.fill('');
    expect(await matchingCount(page)).toBe(5);

    const navareaValues = (await page.evaluate(
      "JSON.stringify([...document.querySelectorAll('#databank-navarea-filter option')].map(o => o.value).filter(v => v !== 'ALL'))",
    )) as string;
    const navareas: string[] = JSON.parse(navareaValues);
    expect(navareas.length).toBeGreaterThan(0);
    // Seed data: NAVAREA I holds 2 of the 5 published warnings.
    await page.locator('#databank-navarea-filter').selectOption(navareas.includes('I') ? 'I' : navareas[0]);
    const filtered = await matchingCount(page);
    expect(filtered).toBeGreaterThanOrEqual(1);
    expect(filtered).toBeLessThan(5);

    await page.locator('button[title="Reset all filters"]').click();
    expect(await matchingCount(page)).toBe(5);

    expect(errors, 'no uncaught page errors').toEqual([]);
  });

  test('Smart Sort presets and column sort headers keep working', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await goTab(page, 'Data Bank');
    await expect(page.locator('#databank-table-header')).toBeVisible();

    // Task 3 fix round: the smart-sort dropdown + direction toggle live in
    // the collapsed More filters panel; open it first.
    await openMoreFilters(page);

    // Task 3: the five legacy smart-sort presets are now one dropdown on the
    // v2 path (`#databank-sort`). Values keep the legacy preset ids.
    const presets = ['urgency', 'recency', 'navarea', 'quality', 'custom'];
    for (const preset of presets) {
      await page.locator('#databank-sort').selectOption(preset);
      expect(await matchingCount(page)).toBe(5);
      await expect(page.locator('#databank-table-header')).toBeVisible();
    }

    // aria-sort lives on the sortable button itself (grid header, not a <th>),
    // and the button title changes once the column becomes active.
    const areaHeader = page.locator('#databank-table-header button').filter({ hasText: 'AREA' });
    await areaHeader.click();
    const first = await areaHeader.getAttribute('aria-sort');
    expect(['ascending', 'descending']).toContain(first);

    await areaHeader.click();
    const flipped = await areaHeader.getAttribute('aria-sort');
    expect(['ascending', 'descending']).toContain(flipped);
    expect(flipped).not.toBe(first);

    await page.locator('button[title="Toggle sort direction"]').click();
    expect(await matchingCount(page)).toBe(5);

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

test.describe('map', () => {
  test('drawer, layer toggles, base cartography, go-to-coordinates and fit bounds', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await expect(page.locator('button[title="Collapse active warnings drawer"]')).toBeVisible();

    await page.locator('button[title="Collapse active warnings drawer"]').click();
    await expect(page.locator('button[title="Expand active warnings drawer"]')).toBeVisible();
    await page.locator('button[title="Expand active warnings drawer"]').click();
    await expect(page.locator('button[title="Collapse active warnings drawer"]')).toBeVisible();

    const voyagerIsActive = () =>
      page.evaluate(
        "(() => { const b = document.querySelector('button[title=\"CARTO Voyager\"]'); return b ? b.className.includes('bg-gw-primary') : false; })()",
      );

    expect(await voyagerIsActive()).toBe(false);
    await page.locator('button[title="CARTO Voyager"]').click();
    await expect.poll(voyagerIsActive).toBe(true);
    await page.locator('button[title="ESRI Ocean Base"]').click();

    // Anchored on the public label prefix only — never on Leaflet pane
    // identifiers (constraint 10; the pane-ID cleanup must not fail this test,
    // see do-not-break.md §3.7).
    const soundingsCheckbox = page
      .locator('label')
      .filter({ hasText: /^Ocean Soundings/ })
      .first()
      .locator('input[type="checkbox"]');
    const before = await soundingsCheckbox.isChecked();
    await soundingsCheckbox.click();
    await expect.poll(() => soundingsCheckbox.isChecked()).not.toBe(before);
    await soundingsCheckbox.click();

    // Task 6 (plan §1.4): no pane identifier or "panes" wording may appear in
    // any user-visible string. The map component is shared by both render
    // paths, so this one assertion covers classic and v2. Compared on the
    // lowercased innerText — the heading sits in an `uppercase`-styled div, so
    // a case-sensitive needle for "Layer Visibility & Panes" could never fire
    // against the rendered "LAYER VISIBILITY & PANES" (review finding 1).
    const mapText = ((await page.evaluate('document.body.innerText')) as string).toLowerCase();
    for (const internal of [
      'navWarnVectorPane',
      'navWarnMarkerPane',
      'soundingsPane',
      'seamarksPane',
      'Layer Visibility & Panes',
    ]) {
      expect(mapText, `user-visible text must not contain "${internal}"`).not.toContain(internal.toLowerCase());
    }

    const jumpInput = page.locator('input[placeholder^="e.g. 55-23.90N"]');
    await expect(jumpInput).toBeVisible();
    await jumpInput.fill('55.3983, 3.8116');
    await page.getByRole('button', { name: /^Go$/ }).click();
    await expect(page.getByText(/Focused: /).first()).toBeVisible();

    await jumpInput.fill('definitely-not-coordinates');
    await page.getByRole('button', { name: /^Go$/ }).click();
    await expect(page.locator('div.text-rose-800').first()).toBeVisible();

    await page.locator('button[title="Fit viewport to all active warnings"]').click();
    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

test.describe('warning details', () => {
  test('details modal opens, shows technical fields and isolates a single message', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);

    await page.locator('aside').getByText(/^Details/).first().click();
    await expect(page.locator('button[title="Close modal (Esc)"]')).toBeVisible();

    await expect(page.getByText(/Pub:/).first()).toBeVisible();
    await expect(page.getByText('Export Geometry').first()).toBeVisible();

    await page.getByRole('button', { name: 'Show Only This Message' }).click();
    await expect(page.getByRole('tab', { name: /^Map View/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Isolation Mode Active:')).toBeVisible();

    await page.getByRole('button', { name: 'Show All Warnings' }).click();
    await expect(page.getByText('Isolation Mode Active:')).toBeHidden();

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

test.describe('sources', () => {
  test('registry counters, verification badges and refresh action are present', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await goTab(page, 'Sources');

    // Task 5 (progressive disclosure): default = short summary; the counters,
    // badges and Refresh Now action move one/two levels deeper but must all
    // still be reachable (do-not-break §5.7).
    await expect(page.getByText('Official Data Sources')).toBeVisible();
    await page.getByRole('button', { name: 'View source details' }).click();

    await page.getByRole('button', { name: /^Registry statistics/ }).click();
    await expect(page.getByText('Verified Endpoints')).toBeVisible();
    await expect(page.getByText('Unverified Coverage')).toBeVisible();

    // First seed source is verified; its Details row carries the refresh action.
    await page.locator('button[title="Show technical details"]').first().click();
    await expect(page.getByRole('button', { name: /Refresh Now/ }).first()).toBeEnabled();

    // Task 6 (plan §1.4): worker/LLM internal names are gone from every
    // user-visible string on the Sources surface (both paths). The action
    // button and table headers are `uppercase`-styled, so a reintroduced
    // "Run Worker" renders as "RUN WORKER" — the needle must be
    // case-insensitive or it can never fire (review finding 2).
    const sourcesText = (await page.evaluate('document.body.innerText')) as string;
    expect(sourcesText, 'no "Run Worker" label').not.toMatch(/run worker/i);
    expect(sourcesText, 'no "LLM" token').not.toMatch(/\bllm\b/i);

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

test.describe('admin gate (mobile)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('locked admin tools show the gate, unlock recovers the workspace view', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);

    const quickNav = page.locator('nav[aria-label="Primary quick navigation"]');
    await quickNav.getByText('More', { exact: true }).click();
    await page.getByRole('button', { name: /Pipeline Ingestion/ }).click();
    await expect(page.getByText('Administrative Gate Active')).toBeVisible();

    // Gate escape hatch: "Return to Map" must leave the locked route.
    await page.getByRole('button', { name: 'Return to Map' }).click();
    // At 375px the desktop tablist is hidden; the quick-nav Map button carries
    // the active styling (font-bold).
    const mapNavButton = quickNav.locator('button').filter({ hasText: /^Map$/ });
    await expect(mapNavButton).toHaveClass(/font-bold/);

    // Re-open the locked route, then use the supported recovery path: a stored
    // session token. Finding F-02 (docs/ux-audit/inventory.md): without a
    // token the Header session-sync effect reverts the unlock immediately,
    // because App's setIsAdminMode wrapper gets a new identity on every render.
    await quickNav.getByText('More', { exact: true }).click();
    await page.getByRole('button', { name: /Pipeline Ingestion/ }).click();
    await expect(page.getByText('Administrative Gate Active')).toBeVisible();

    await page.evaluate("sessionStorage.setItem('helm_admin_token', 'audit-payload')");
    await page.locator('button:has-text("Unlock Admin Tools")').last().click();
    await expect(page.getByText('CANDIDATE DISCOVERY & INGESTION TOOLS')).toBeVisible();

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

test.describe('admin views', () => {
  test('all six admin views render for an authenticated session', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('helm_admin_mode', 'true');
      sessionStorage.setItem('helm_admin_token', 'audit-payload');
    });
    await openApp(page);

    const views: Array<[string, string]> = [
      ['Pipeline', 'CANDIDATE DISCOVERY & INGESTION TOOLS'],
      ['Manual Parser', 'MANUAL WARNING PARSER & OVERRIDE WORKFLOW'],
      ['Bulk Import', 'BULK INGESTION & NAVAREA IMPORTER'],
      ['Audit Log', 'ATOMIC GENERATION POINTER INSPECTOR'],
      ['Evidence', 'PRIVATE OBJECT STORAGE EVIDENCE LOCKER'],
      ['Supabase Server', 'Supabase Database Server Hub'],
    ];

    for (const [tab, heading] of views) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`, 'i') }).click();
      await expect(page.getByText(heading).first()).toBeVisible();
    }

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

test.describe('resilience', () => {
  test('sync live feeds fails gracefully without server credentials', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await goTab(page, 'Data Bank');

    await page.getByRole('button', { name: /Sync Live Feeds/ }).click();
    await expect(page.getByRole('button', { name: /Sync Live Feeds/ })).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator('#databank-table-header')).toBeVisible();
    expect(await matchingCount(page)).toBe(5);

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('no horizontal overflow on any primary view and touch targets stay usable', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);

    const quickNav = page.locator('nav[aria-label="Primary quick navigation"]');

    for (const label of ['Map', 'Data Bank', 'Sources'] as const) {
      await quickNav.getByText(label, { exact: true }).click();
      await page.waitForTimeout(500);
      const overflow = (await page.evaluate(
        'JSON.stringify({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth })',
      )) as string;
      const { s, c } = JSON.parse(overflow);
      expect(s, `no horizontal overflow on ${label}`).toBeLessThanOrEqual(c);
    }

    const navButtons = quickNav.locator('button');
    const count = await navButtons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const button = navButtons.nth(i);
      const label = (await button.innerText()).trim().replace(/\s+/g, ' ').slice(0, 20);
      const box = await button.boundingBox();
      expect(box, `touch target "${label}" has a box`).not.toBeNull();
      expect(box!.width, `touch target width for "${label}"`).toBeGreaterThanOrEqual(60);
      expect(box!.height, `touch target height for "${label}"`).toBeGreaterThanOrEqual(40);
    }

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

test.describe('tablet 768', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('no horizontal overflow on Map, Data Bank and Sources at 768 px', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);

    for (const tab of ['Map View', 'Data Bank', 'Sources'] as const) {
      await goTab(page, tab);
      await page.waitForTimeout(500);
      const overflow = (await page.evaluate(
        'JSON.stringify({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })',
      )) as string;
      const { scrollWidth, clientWidth } = JSON.parse(overflow);
      expect(scrollWidth, `no horizontal overflow on ${tab} at 768px`).toBeLessThanOrEqual(clientWidth);
    }

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

test.describe('ui path flag (temporary; Task 13 removes)', () => {
  test('default load renders Data Bank on the v2 path; hwUI=classic uses the legacy path', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await goTab(page, 'Data Bank');
    await expect(page.locator('#databank-table-header')).toBeVisible();
    await expect(page.locator('[data-ui-render-path="v2"]')).toBeVisible();
    expect(await matchingCount(page)).toBe(5);

    // Task 3: the v2 hierarchy shows the status bar and folds the classic
    // stat-card / brief headings out of the default view.
    await expect(page.locator('[data-databank-status-bar]')).toBeVisible();
    expect(await page.locator('text=Total Published').count()).toBe(0);
    expect(await page.locator('text=Executive Operational Brief').count()).toBe(0);

    await page.addInitScript(() => {
      localStorage.setItem('hwUI', 'classic');
    });
    await openApp(page);
    await goTab(page, 'Data Bank');
    await expect(page.locator('#databank-table-header')).toBeVisible();
    await expect(page.locator('[data-ui-render-path="legacy"]')).toBeVisible();
    expect(await matchingCount(page)).toBe(5);

    // Classic path keeps the original hierarchy: stat cards + brief visible,
    // and no v2 status bar.
    await expect(page.locator('text=Total Published').first()).toBeVisible();
    await expect(page.locator('text=Executive Operational Brief').first()).toBeVisible();
    expect(await page.locator('[data-databank-status-bar]').count()).toBe(0);

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

// Task-5 fix round (Important 2): both branches of the v2 footer's
// "Technical details (Admin)" entry point used to be untested, and the
// non-admin branch relied on a silent `?.click()` no-op. These are tests
// 14 and 15 (do-not-break §5.6 / §8).
test.describe('ingestion procedure (progressive disclosure)', () => {
  test('Technical details (Admin): non-admin users are routed to the Admin Access Gate', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await goTab(page, 'Data Bank');
    await page
      .locator('button[title="View Ingestion Procedure (SOP)"]')
      .first()
      .click();
    await expect(page.getByText('Navigational Warning Ingestion Procedure')).toBeVisible();

    await page.getByRole('button', { name: 'Technical details (Admin)' }).click();

    // Without a stored admin session the procedure modal closes and the
    // header-driven Admin Access Gate takes over; no technical view appears.
    await expect(page.getByText('Admin Access Gate')).toBeVisible();
    await expect(page.getByText('Navigational Warning Ingestion Procedure')).toHaveCount(0);

    expect(errors, 'no uncaught page errors').toEqual([]);
  });

  test('Technical details (Admin): a stored admin session token opens the nested original modal', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await page.evaluate("sessionStorage.setItem('helm_admin_token', 'audit-payload')");
    await goTab(page, 'Data Bank');
    await page
      .locator('button[title="View Ingestion Procedure (SOP)"]')
      .first()
      .click();
    await expect(page.getByText('Navigational Warning Ingestion Procedure').first()).toBeVisible();

    await page.getByRole('button', { name: 'Technical details (Admin)' }).click();

    // The original technical modal is nested inside the v2 wrapper: two
    // procedure headings plus the technical view's SHA-256 fingerprint chip.
    await expect(page.getByText('SHA-256 Hashes')).toBeVisible();
    await expect(page.getByText('Navigational Warning Ingestion Procedure')).toHaveCount(2);

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

// Task 7 (plan §1.5): the single Focus map control hides every map panel so
// the map owns the viewport, and toggling back restores panel state — drawer
// scroll position, drawer search text and the minimized controls panel. v2
// path only; the classic path never renders the control. (Test 16.)
test.describe('map focus (Task 7)', () => {
  test('focus map hides panels, fills the viewport and restores panel state', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await expect(page.locator('button[title="Collapse active warnings drawer"]')).toBeVisible();

    // Round-trip 1: drawer scroll position (snapshotted on focus entry; the
    // drawer unmounts while focused, so the offset must be carried across).
    const scrollBefore = JSON.parse(
      (await page.evaluate(`(() => {
        const list = document.querySelector('aside .overflow-y-auto');
        if (!list) return JSON.stringify({ top: null });
        list.scrollTop = list.scrollHeight;
        return JSON.stringify({ top: list.scrollTop });
      })()`)) as string
    );
    await page.locator('button[title="Hide panels and focus the map"]').click();
    await expect(page.locator('button[title="Restore map panels"]')).toBeVisible();
    await page.locator('button[title="Restore map panels"]').click();
    await expect(page.locator('aside')).toBeVisible();
    const scrollAfter = JSON.parse(
      (await page.evaluate(
        "JSON.stringify({ top: document.querySelector('aside .overflow-y-auto')?.scrollTop ?? null })",
      )) as string
    );
    expect(scrollAfter.top).toBe(scrollBefore.top);

    // Round-trip 2: search text + a minimized controls panel must survive.
    await page.locator('input[placeholder="Search active notices..."]').fill('014');
    await page.locator('button[title="Hide controls panel"]').click();
    await expect(page.locator('#map-controls-chip')).toBeVisible();

    // Enter focus: interface reduces to map + essential floating controls.
    await page.locator('button[title="Hide panels and focus the map"]').click();
    await expect(page.locator('button[title="Restore map panels"]')).toBeVisible();
    await expect(page.locator('header')).toBeHidden();
    await expect(page.locator('footer')).toBeHidden();
    expect(await page.locator('aside').count()).toBe(0);
    expect(await page.locator('#map-controls-chip').count()).toBe(0);
    expect(
      await page.locator('button[title="Collapse active warnings drawer"]').count(),
    ).toBe(0);
    await page.waitForTimeout(400);
    const box = await page.locator('#map').boundingBox();
    expect(box, 'map container has a box in focus mode').not.toBeNull();
    expect(Math.abs(box!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(box!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(box!.width - 1440)).toBeLessThanOrEqual(1);
    expect(Math.abs(box!.height - 900)).toBeLessThanOrEqual(1);

    // Exit focus: every panel state comes back.
    await page.locator('button[title="Restore map panels"]').click();
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('#map-controls-chip')).toBeVisible();
    await expect(page.locator('input[placeholder="Search active notices..."]')).toHaveValue('014');

    // Leave the map exactly as it was found.
    await page.locator('#map-controls-chip button').click();
    await expect(page.locator('#map-controls-panel')).toBeVisible();
    await page.locator('input[placeholder="Search active notices..."]').fill('');

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

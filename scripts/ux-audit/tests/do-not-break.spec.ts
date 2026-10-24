import { test, expect, type Page } from '@playwright/test';

/**
 * Sprint 0 smoke suite: guards docs/ux-audit/do-not-break.md.
 *
 * POLICY UPDATE (PR #27): the whole console requires an authenticated admin
 * session. Map, Data Bank and Sources are no longer public. This suite is
 * therefore split in two:
 *
 *  1. Unauthenticated tests — the Administrative Gate must be active on every
 *     tab and every hash route, stored client-side flags (helm_admin_mode,
 *     helm_admin_token, hwUI) must never grant access, and the gate's
 *     "Admin Sign In" button must open the real Supabase login modal.
 *  2. Authenticated tests — the content behaviours (data bank, map, warning
 *     details, sources, admin views, resilience). These run only when
 *     E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are set; they sign in through
 *     the same UI a human uses. Without the credentials they are skipped,
 *     NOT silently passed.
 *
 * page.evaluate payloads are passed as strings on purpose (a function literal
 * breaks under the tsx/esbuild toolchain used for the capture driver).
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';
const hasAdminCredentials = ADMIN_EMAIL.length > 0 && ADMIN_PASSWORD.length > 0;

type PageErrors = string[];

function watchPageErrors(page: Page): PageErrors {
  const errors: PageErrors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

async function openApp(page: Page, hash?: string) {
  await page.goto(hash ? `/${hash}` : '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#main-content', { timeout: 60_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

async function signInAdmin(page: Page) {
  await page.getByRole('button', { name: /^Admin Sign In$/ }).click();
  await expect(page.getByText('Admin Access Gate')).toBeVisible();
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Unlock Admin Mode/ }).click();
  await expect(page.getByText('Administrative Gate Active')).toBeHidden({ timeout: 60_000 });
}

async function matchingCount(page: Page): Promise<number> {
  const text = (await page.evaluate('document.body.innerText')) as string;
  const match = text.match(/Matching: (\d+)/);
  expect(match, 'Data Bank "Matching:" counter should be visible').not.toBeNull();
  return Number(match![1]);
}

// 4-section IA (2026-10-24): section tabs (Warnings / Ingest / Trace / System)
// live in the desktop header and the mobile bottom quick-nav; view sub-tabs
// ("Map View", "Data Bank", "Sources", ...) live in the header section strip.
// goTab activates the owning section first, then clicks the view sub-tab.
const TAB_SECTION: Record<string, string> = {
  'Map View': 'Warnings',
  'Data Bank': 'Warnings',
  Sources: 'Ingest',
  Pipeline: 'Ingest',
  'Manual Parser': 'Ingest',
  'Bulk Import': 'Ingest',
  'Audit Log': 'Trace',
  Evidence: 'Trace',
  'Supabase Server': 'System',
};

async function goTab(page: Page, name: keyof typeof TAB_SECTION) {
  const section = TAB_SECTION[name];
  const sectionTab = page.getByRole('tab', { name: new RegExp('^' + section, 'i') });
  if ((await sectionTab.getAttribute('aria-selected')) !== 'true') {
    await sectionTab.click();
  }
  await page.getByRole('tab', { name: new RegExp('^' + name, 'i') }).click();
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

test.describe('access gate (unauthenticated)', () => {
  test('the administrative gate is active on direct hash routes', async ({ page }) => {
    const errors = watchPageErrors(page);

    // The exact URLs reported in PR #27: direct navigation must never
    // render console content without a session.
    // Legacy single-segment hashes and the new two-segment grammar all
    // stay gated. The exact URLs reported in PR #27 keep working as aliases.
    for (const hash of ['#/sources', '#/databank', '#/map', '#/ingest/sources', '#/warnings/list', '#/warnings/map', '#/trace/generations', '#/system/supabase']) {
      await openApp(page, hash);
      await expect(page.getByText('Administrative Gate Active')).toBeVisible();
      await expect(page.getByRole('button', { name: /^Admin Sign In$/ })).toBeVisible();
      await expect(page.locator('#databank-table-header')).toHaveCount(0);
    }

    expect(errors, 'no uncaught page errors').toEqual([]);
  });

  test('client-side flags never grant admin access (spoof resistance)', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('helm_admin_mode', 'true');
      sessionStorage.setItem('helm_admin_token', 'audit-payload');
      localStorage.setItem('hwUI', 'classic');
    });

    await openApp(page);

    await expect(page.getByText('Administrative Gate Active')).toBeVisible();
    // The App must purge the spoofable legacy flags on mount.
    await expect
      .poll(async () => page.evaluate('JSON.stringify({ m: localStorage.getItem("helm_admin_mode"), t: sessionStorage.getItem("helm_admin_token"), u: localStorage.getItem("hwUI") })'))
      .toBe(JSON.stringify({ m: null, t: null, u: null }));

    expect(errors, 'no uncaught page errors').toEqual([]);
  });

  test('Admin Sign In opens the Supabase login modal; no client-side unlock exists', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);

    await page.getByRole('button', { name: /^Admin Sign In$/ }).click();
    await expect(page.getByText('Admin Access Gate')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Cancel via Escape; the gate must still be active afterwards.
    await page.keyboard.press('Escape');
    await expect(page.getByText('Admin Access Gate')).toBeHidden();
    await expect(page.getByText('Administrative Gate Active')).toBeVisible();

    expect(errors, 'no uncaught page errors').toEqual([]);
  });

  test('header tabs stay navigable while locked and switch selection', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);

    // 4-section IA: section tabs in the header, view sub-tabs in the strip.
    await expect(page.getByRole('tab', { name: /^Warnings/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Ingest/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Trace/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^System/i })).toBeVisible();
    // Warnings is the default section: Map View + Data Bank sub-tabs are present.
    await expect(page.getByRole('tab', { name: /^Map View/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Data Bank/i })).toBeVisible();
    await expect(page.getByText('Helm.Warning', { exact: true }).first()).toBeVisible();
    await expect(page.locator('button[title="Jump to active NAVWARNs in Data Bank"]')).toBeVisible();

    await goTab(page, 'Data Bank');
    await expect(page.getByRole('tab', { name: /^Data Bank/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: /^Warnings/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Administrative Gate Active')).toBeVisible();

    await goTab(page, 'Sources');
    await expect(page.getByRole('tab', { name: /^Sources/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: /^Ingest/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Administrative Gate Active')).toBeVisible();

    expect(errors, 'no uncaught page errors').toEqual([]);
  });

  test('hash routes select their tab but content stays gated (constraint: gate wins)', async ({ page }) => {
    const errors = watchPageErrors(page);
    // Legacy single-segment alias (no slash) keeps working.
    await openApp(page, '#sources');
    await expect(page.getByRole('tab', { name: /^Sources/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: /^Ingest/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Administrative Gate Active')).toBeVisible();

    // New two-segment grammar.
    await openApp(page, '#/warnings/list');
    await expect(page.getByRole('tab', { name: /^Data Bank/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: /^Warnings/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Administrative Gate Active')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('ui path (v2 always)', () => {
  test('a stale hwUI=classic flag is purged and the legacy path never renders', async ({ page }) => {
    const errors = watchPageErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('hwUI', 'classic');
    });
    await openApp(page);

    // The retired classic path must not be mounted at all.
    expect(await page.locator('[data-ui-render-path="legacy"]').count()).toBe(0);
    await expect
      .poll(() => page.evaluate('localStorage.getItem("hwUI")'))
      .toBeNull();

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

test.describe('data bank (authenticated)', () => {
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');

  test('filters, quick filters, search, empty state and reset still work', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await signInAdmin(page);
    await goTab(page, 'Data Bank');
    await expect(page.locator('#databank-table-header')).toBeVisible();

    expect(await matchingCount(page)).toBe(5);

    // Quick filters live in the collapsed More filters panel (Task 3 fix).
    await openMoreFilters(page);

    // Quick filter: the "Unverified (n)" pill narrows the result set without
    // breaking the table — see finding F-01 in docs/ux-audit/inventory.md.
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
    test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');
    const errors = watchPageErrors(page);
    await openApp(page);
    await signInAdmin(page);
    await goTab(page, 'Data Bank');
    await expect(page.locator('#databank-table-header')).toBeVisible();

    // The smart-sort dropdown + direction toggle live in the collapsed
    // More filters panel; open it first.
    await openMoreFilters(page);

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

test.describe('map (authenticated)', () => {
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');

  test('drawer, layer toggles, base cartography, go-to-coordinates and fit bounds', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await signInAdmin(page);
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

test.describe('warning details (authenticated)', () => {
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');

  test('details modal opens, shows technical fields and isolates a single message', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await signInAdmin(page);

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

test.describe('sources (authenticated)', () => {
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');

  test('registry counters, verification badges and worker action are present', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await signInAdmin(page);
    await goTab(page, 'Sources');

    await expect(page.getByText('NAVWARN Candidate Discovery Registry')).toBeVisible();
    await expect(page.getByText('Verified Endpoints')).toBeVisible();
    await expect(page.getByText('Unverified Coverage')).toBeVisible();
    await expect(page.getByRole('button', { name: /Run Worker/ }).first()).toBeEnabled();

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

test.describe('admin gate (mobile)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('every quick-nav destination stays gated while signed out', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);

    const quickNav = page.locator('nav[aria-label="Primary quick navigation"]');
    for (const label of ['Warnings', 'Ingest', 'Trace', 'System'] as const) {
      await quickNav.getByText(label, { exact: true }).click();
      await expect(page.getByText('Administrative Gate Active')).toBeVisible();
    }

    // Sub-tabs of the active section also stay gated while signed out.
    await page.getByRole('tab', { name: /^Supabase Server/i }).click();
    await expect(page.getByText('Administrative Gate Active')).toBeVisible();

    // The only recovery path is the real login modal.
    await page.getByRole('button', { name: /^Admin Sign In$/ }).click();
    await expect(page.getByText('Admin Access Gate')).toBeVisible();

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

test.describe('admin views (authenticated)', () => {
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');

  test('all six admin views render for an authenticated session', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await signInAdmin(page);

    const views: Array<[string, string]> = [
      ['Pipeline', 'CANDIDATE DISCOVERY & INGESTION TOOLS'],
      ['Manual Parser', 'MANUAL WARNING PARSER & OVERRIDE WORKFLOW'],
      ['Bulk Import', 'BULK INGESTION & NAVAREA IMPORTER'],
      ['Audit Log', 'ATOMIC GENERATION POINTER INSPECTOR'],
      ['Evidence', 'PRIVATE OBJECT STORAGE EVIDENCE LOCKER'],
      ['Supabase Server', 'Supabase Database Server Hub'],
    ];

    for (const [tab, heading] of views) {
      await goTab(page, tab as keyof typeof TAB_SECTION);
      await expect(page.getByText(heading).first()).toBeVisible();
    }

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

test.describe('resilience (authenticated)', () => {
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');

  test('sync live feeds fails gracefully without server credentials', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await signInAdmin(page);
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

    for (const label of ['Warnings', 'Ingest', 'Trace', 'System'] as const) {
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

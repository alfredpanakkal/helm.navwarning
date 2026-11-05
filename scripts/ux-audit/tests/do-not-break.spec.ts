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

    for (const label of ['Map View', 'Pipeline', 'Audit Log', 'Supabase Server'] as const) {
      await page.getByRole('button', { name: 'Open console menu' }).click();
      await page.getByRole('menuitem', { name: label, exact: true }).click();
      await expect(page.getByText('Administrative Gate Active')).toBeVisible();
    }

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

    const menuButton = page.getByRole('button', { name: 'Open console menu' });
    for (const label of ['Map View', 'Pipeline', 'Audit Log', 'Supabase Server'] as const) {
      await menuButton.click();
      await page.getByRole('menuitem', { name: label, exact: true }).click();
      await page.waitForTimeout(500);
      const overflow = (await page.evaluate(
        'JSON.stringify({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth })',
      )) as string;
      const { s, c } = JSON.parse(overflow);
      expect(s, `no horizontal overflow on ${label}`).toBeLessThanOrEqual(c);
    }

    await menuButton.click();
    const items = page.getByRole('menuitem');
    const count = await items.count();
    expect(count).toBe(9);
    for (let i = 0; i < count; i++) {
      const box = await items.nth(i).boundingBox();
      expect(box, `menu item ${i} has a box`).not.toBeNull();
      expect(box!.height, `menu item ${i} height`).toBeGreaterThanOrEqual(40);
    }
    await expect(page.locator('nav[aria-label="Primary quick navigation"]')).toHaveCount(0);

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

// ─────────────────────────────────────────────────────────────────────────────
// Touch-target audit (console-ux-68): guards the coarse-pointer layer in
// src/index.css. Runs the console at 390x844 with mobile + touch emulation —
// Chromium reports (pointer: coarse) under this emulation, which is the media
// feature that applies the 44px control / 16px input rules. Authenticated
// tests sign in through the same signInAdmin() UI path as the other suites;
// no auth stub, nothing weakened.
//
// Documented exceptions (see the console-ux-68 PR and docs/ux-audit):
//  - .touch-hit link buttons pass via the expanded ::after hit area, so their
//    44px check measures the inflated rect (+12px vertical / +8px horizontal,
//    mirroring the .touch-hit utility in src/index.css).
//  - The map toolbar buttons styled in public/assets/css/components.css
//    (class prefixes "map-"/"settings-", 34-48px by design) are intentionally
//    not restyled and are excluded here; Leaflet's zoom/attribution <a>
//    controls are out of scope (not button/tab/select/input).
// ─────────────────────────────────────────────────────────────────────────────

const TOUCH_ROUTES = [
  '#/warnings/map',
  '#/warnings/list',
  '#/ingest/pipeline',
  '#/ingest/sources',
  '#/ingest/bulk',
  '#/ingest/manual',
  '#/trace/generations',
  '#/trace/evidence',
  '#/system/supabase',
] as const;

/**
 * One in-page pass per route: measures every visible interactive control and
 * every input font size. Kept as a string payload (see the file header note
 * about page.evaluate and the tsx/esbuild toolchain).
 */
const TOUCH_AUDIT_JS = `(() => {
  const sel = 'button, [role="tab"], summary, select, input:not([type="checkbox"]):not([type="radio"]), textarea';
  const offenders = [];
  const smallFonts = [];
  for (const el of document.querySelectorAll(sel)) {
    if (el.getClientRects().length === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    const cls = String(el.className || '');
    if (/(^|\\s)(map-|settings-)/.test(cls)) continue;
    const label = (el.getAttribute('aria-label') || el.innerText || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40);
    let width = rect.width;
    let height = rect.height;
    if (el.classList.contains('touch-hit')) {
      width = Math.max(width, rect.width + 16);
      height = Math.max(height, rect.height + 24);
    }
    if (Math.min(width, height) < 44) {
      offenders.push({ label: label, w: Math.round(width), h: Math.round(height) });
    }
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && parseFloat(style.fontSize) < 16) {
      smallFonts.push({ label: label, fs: style.fontSize });
    }
  }
  return JSON.stringify({ offenders, smallFonts, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth });
})()`;

/**
 * Card-level "Verify" buttons in the Data Bank list. The review modal is
 * rendered outside #main-content, so its own Verify button never matches.
 */
function visibleVerifyButtons(page: Page) {
  return page.locator('#main-content button', { hasText: /^Verify$/ });
}

async function openReviewModal(page: Page) {
  const reviewFab = page.getByRole('button', { name: /Review Next \(\d+\)/ });
  test.skip(!(await reviewFab.count()), 'seed data has no unverified review queue');
  return reviewFab;
}

test.describe('touch targets (390x844, hasTouch, authenticated)', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');

  test('no horizontal page scroll on the nine console routes', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await signInAdmin(page);
    for (const hash of TOUCH_ROUTES) {
      await openApp(page, hash);
      await page.waitForTimeout(300);
      const measured = JSON.parse((await page.evaluate(TOUCH_AUDIT_JS)) as string);
      expect(measured.scrollWidth, 'no horizontal overflow on ' + hash).toBeLessThanOrEqual(measured.clientWidth);
    }
    expect(errors, 'no uncaught page errors').toEqual([]);
  });

  test('interactive controls meet the 44px touch minimum and inputs render at 16px+', async ({ page }) => {
    const errors = watchPageErrors(page);
    await openApp(page);
    await signInAdmin(page);
    const offenders: string[] = [];
    const smallFonts: string[] = [];
    for (const hash of TOUCH_ROUTES) {
      await openApp(page, hash);
      await page.waitForTimeout(300);
      const measured = JSON.parse((await page.evaluate(TOUCH_AUDIT_JS)) as string);
      for (const o of measured.offenders) offenders.push(hash + ': "' + o.label + '" ' + o.w + 'x' + o.h);
      for (const f of measured.smallFonts) smallFonts.push(hash + ': "' + f.label + '" ' + f.fs);
    }
    expect(offenders, 'controls below the 44px touch minimum').toEqual([]);
    expect(smallFonts, 'inputs below the 16px iOS no-zoom minimum').toEqual([]);
    expect(errors, 'no uncaught page errors').toEqual([]);
  });

  test('a failed verify keeps the row unverified, shows an alert and does not advance the modal', async ({ page }) => {
    const errors = watchPageErrors(page);
    let verifyRequests = 0;
    await page.route('**/api/admin/warning-edit', async (route) => {
      verifyRequests += 1;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'simulated verify failure' }),
      });
    });

    await openApp(page);
    await signInAdmin(page);
    await goTab(page, 'Data Bank');
    await expect(page.locator('#databank-table-header')).toBeVisible();

    const candidatesBefore = await visibleVerifyButtons(page).count();
    const reviewFab = await openReviewModal(page);
    await reviewFab.click();

    const dialog = page.locator('[role="dialog"][aria-labelledby="warning-detail-title"]');
    await expect(dialog).toBeVisible();
    const headingBefore = (await dialog.locator('#warning-detail-title').innerText()).trim();

    await dialog.getByRole('button', { name: /^Verify$/ }).click();

    // The failure is announced inline and the modal stays on this warning —
    // the operator must never mistake a failed verify for a saved one.
    await expect(dialog.getByText('Verify failed — not saved.')).toBeVisible();
    expect(verifyRequests).toBeGreaterThanOrEqual(1);
    await expect.poll(() => dialog.locator('#warning-detail-title').innerText()).toBe(headingBefore);

    await dialog.getByRole('button', { name: /^Close$/ }).click();
    await expect(dialog).toBeHidden();
    expect(
      await visibleVerifyButtons(page).count(),
      'row stays unverified (still a verify candidate)'
    ).toBe(candidatesBefore);

    expect(errors, 'no uncaught page errors').toEqual([]);
  });

  test('a successful verify fires exactly one request, promotes the row out of the candidate list and advances the modal', async ({ page }) => {
    const errors = watchPageErrors(page);
    let verifyRequests = 0;
    await page.route('**/api/admin/warning-edit', async (route) => {
      verifyRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          warning: {
            status: 'active',
            triage_tier: 'A',
            data_quality: 'EXPLICIT',
            qa_flags: ['verified_by_admin'],
          },
          audit: 'VERIFY',
        }),
      });
    });

    await openApp(page);
    await signInAdmin(page);
    await goTab(page, 'Data Bank');
    await expect(page.locator('#databank-table-header')).toBeVisible();

    const candidatesBefore = await visibleVerifyButtons(page).count();
    expect(candidatesBefore).toBeGreaterThan(0);

    const reviewFab = await openReviewModal(page);
    const fabText = await reviewFab.innerText();
    const queueLength = Number((fabText.match(/\((\d+)\)/) || ['', '0'])[1]);
    test.skip(queueLength < 2, 'modal advance needs at least 2 unverified candidates in the seed data');
    await reviewFab.click();

    const dialog = page.locator('[role="dialog"][aria-labelledby="warning-detail-title"]');
    await expect(dialog).toBeVisible();
    const headingBefore = (await dialog.locator('#warning-detail-title').innerText()).trim();

    await dialog.getByRole('button', { name: /^Verify$/ }).click();

    // One operator action = exactly one audited VERIFY write (single-fire
    // guard); a stray second request from a double tap fails this poll.
    await expect.poll(() => verifyRequests).toBe(1);
    // Success is announced (role=status live region), not just repainted.
    await expect(page.getByText('Verified').first()).toBeVisible();
    // The modal advances to the next queue candidate only on success.
    await expect.poll(() => dialog.locator('#warning-detail-title').innerText()).not.toBe(headingBefore);

    await dialog.getByRole('button', { name: /^Close$/ }).click();
    await expect(dialog).toBeHidden();
    // End-to-end verify semantics (decided 2026-10-26): the mock returns
    // the stored row after an audited VERIFY (Tier A, active, qa_flags
    // ['verified_by_admin']). 'verified_by_admin' is exempt from the
    // confidence penalty, so App.applyServerTruth re-derives 1.0 and the
    // verified row leaves the verify-candidate list.
    expect(
      await visibleVerifyButtons(page).count(),
      'verified row is no longer a candidate'
    ).toBe(candidatesBefore - 1);

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

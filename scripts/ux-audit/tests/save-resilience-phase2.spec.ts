import { test, expect, type Page } from '@playwright/test';

/**
 * Save-resilience phase 2 suite (draft recovery + re-auth on 401).
 *
 * Guards:
 *  A. An unsaved map geometry draft survives a reload: re-entering edit mode
 *     prompts to restore it, and the same draft is applied. A draft made
 *     against a different warning version (updated_at) is discarded loudly.
 *  B. A save that returns 401 opens the sign-in modal while the editor and
 *     the unsaved edit stay on screen; signing in and pressing Save again
 *     succeeds.
 *
 * NOT executed by the authoring agent — Alfred runs these against
 * `npm run dev:audit` with E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD set.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';
const hasAdminCredentials = ADMIN_EMAIL.length > 0 && ADMIN_PASSWORD.length > 0;
const DRAFT_PREFIX = 'helm_geom_draft:';

async function openApp(page: Page, hash?: string) {
  await page.goto(hash ? '/' + hash : '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#main-content', { timeout: 60_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

async function signInAdmin(page: Page) {
  await page.getByRole('button', { name: /^Admin Sign In$/ }).click();
  await expect(page.getByText('Admin Access Gate')).toBeVisible();
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Unlock admin mode/ }).click();
  await expect(page.getByText('Administrative Gate Active')).toBeHidden({ timeout: 60_000 });
}

async function goTab(page: Page, section: string, tab: string) {
  const sectionTab = page.getByRole('tab', { name: new RegExp('^' + section, 'i') });
  if ((await sectionTab.getAttribute('aria-selected')) !== 'true') {
    await sectionTab.click();
  }
  await page.getByRole('tab', { name: new RegExp('^' + tab, 'i') }).click();
}

async function locateFirstWarningOnMap(page: Page) {
  await goTab(page, 'Warnings', 'Data Bank');
  await expect(page.locator('#databank-table-header')).toBeVisible();
  await page.getByTitle(/Locate|Show on map/).first().click();
  await goTab(page, 'Warnings', 'Map View');
  await expect(page.getByText(/Geometry —/).first()).toBeVisible({ timeout: 30_000 });
}

test.describe('geometry draft recovery (authenticated)', () => {
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');

  test('an unsaved map geometry edit survives a reload and is offered for restore', async ({ page }) => {
    await openApp(page);
    await signInAdmin(page);
    await locateFirstWarningOnMap(page);

    await page.getByRole('button', { name: /Edit vertices/ }).click();
    // Keyboard nudge (WCAG 2.1.1 path) mutates the draft and persists it.
    await page.getByRole('button', { name: /Vertex 1 of/ }).first().focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByText(/Proposed change vs stored geometry/)).toBeVisible();
    const draftKeys = await page.evaluate<string[]>('Object.keys(sessionStorage).filter(k => k.startsWith(' + JSON.stringify(DRAFT_PREFIX) + '))');
    expect(draftKeys.length).toBe(1);

    // Reload (crash equivalent): sessionStorage survives in the same tab.
    await openApp(page);
    await locateFirstWarningOnMap(page);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Edit vertices/ }).click();
    await expect(page.getByText('Draft restored. Not saved yet.')).toBeVisible();
    await expect(page.getByText(/Proposed change vs stored geometry/)).toBeVisible();

    // Leaving edit mode on purpose clears the draft.
    await page.getByRole('button', { name: /Cancel geometry edits/ }).click();
    const after = await page.evaluate<string[]>('Object.keys(sessionStorage).filter(k => k.startsWith(' + JSON.stringify(DRAFT_PREFIX) + '))');
    expect(after).toEqual([]);
  });

  test('a stale draft (warning changed since it was made) is discarded loudly', async ({ page }) => {
    await openApp(page);
    await signInAdmin(page);
    await locateFirstWarningOnMap(page);

    await page.getByRole('button', { name: /Edit vertices/ }).click();
    await page.getByRole('button', { name: /Vertex 1 of/ }).first().focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByText(/Proposed change vs stored geometry/)).toBeVisible();

    // Simulate the warning having changed since the draft was written.
    await page.evaluate('(() => { const k = Object.keys(sessionStorage).find(k => k.startsWith(' + JSON.stringify(DRAFT_PREFIX) + ')); if (!k) return; const d = JSON.parse(sessionStorage.getItem(k)); d.baseUpdatedAt = "1999-01-01T00:00:00Z"; sessionStorage.setItem(k, JSON.stringify(d)); })()');

    await openApp(page);
    await locateFirstWarningOnMap(page);
    let dialogSeen = false;
    page.on('dialog', () => { dialogSeen = true; });
    await page.getByRole('button', { name: /Edit vertices/ }).click();
    await expect(page.getByText('A stored draft was discarded because this warning changed since it was made.')).toBeVisible();
    expect(dialogSeen).toBe(false);
    const after = await page.evaluate<string[]>('Object.keys(sessionStorage).filter(k => k.startsWith(' + JSON.stringify(DRAFT_PREFIX) + '))');
    expect(after).toEqual([]);
  });
});

test.describe('re-auth on 401 (authenticated)', () => {
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');

  test('a 401 during Save opens the sign-in modal and keeps the edit; sign in then Save succeeds', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));

    let stubMode: 'unauthorized' | 'success' = 'unauthorized';
    let saveRequests = 0;
    await page.route('**/api/admin/warning-edit', async (route) => {
      if (stubMode === 'unauthorized') {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'admin session required' }) });
        return;
      }
      saveRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ warning: { title: 'E2E re-auth title' }, audit: 'EDIT', geometry: 'unchanged' }),
      });
    });

    await openApp(page);
    await signInAdmin(page);
    await goTab(page, 'Warnings', 'Data Bank');
    await expect(page.locator('#databank-table-header')).toBeVisible();

    const reviewFab = page.getByRole('button', { name: /Review Next \(\d+\)/ });
    test.skip(!(await reviewFab.count()), 'seed data has no unverified review queue');
    await reviewFab.click();
    const detail = page.locator('[role="dialog"][aria-labelledby="warning-detail-title"]');
    await expect(detail).toBeVisible();
    await detail.getByRole('button', { name: /^Edit$/ }).click();
    const drawer = page.locator('[role="dialog"][aria-labelledby="wem-dialog-title"]');
    await expect(drawer).toBeVisible();
    const titleInput = drawer.locator('#wem-title');
    await titleInput.fill('E2E re-auth title');

    // Save with an expired session: 401.
    await drawer.getByRole('button', { name: /^Save$/ }).click();
    await expect(drawer.getByText('Session expired. Sign in again, then press Save. Your edit is kept.')).toBeVisible();
    // The sign-in modal opens on top — and the editor survives underneath.
    await expect(page.getByText('Admin Access Gate')).toBeVisible();
    await expect(titleInput).toHaveValue('E2E re-auth title');

    // Sign in through the modal (real Supabase credentials from env).
    stubMode = 'success';
    await page.locator('div.z-\\[490\\] input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('div.z-\\[490\\] input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Unlock admin mode/ }).click();
    await expect(page.getByText('Admin Access Gate')).toBeHidden({ timeout: 60_000 });

    // The same Save now succeeds with the fresh token.
    await drawer.getByRole('button', { name: /^Save$/ }).click();
    await expect.poll(() => saveRequests).toBe(1);
    await expect(drawer.getByText('Saved to Supabase')).toBeVisible();

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

import { test, expect, type Page } from '@playwright/test';

/**
 * Save-resilience suite (2026-11-05 update note).
 *
 * Guards two console behaviours:
 *  1. A network failure during Save must surface the "Network error" banner
 *     and re-enable the Save button (saveWarningEdit returns a normal failed
 *     result instead of throwing — no frozen editor).
 *  2. After the connection returns, the same edit saves successfully without
 *     losing the on-screen draft.
 *
 * Runs against the dev:audit server; authenticated tests are skipped, not
 * silently passed, when E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are unset.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';
const hasAdminCredentials = ADMIN_EMAIL.length > 0 && ADMIN_PASSWORD.length > 0;

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

async function goDataBank(page: Page) {
  const sectionTab = page.getByRole('tab', { name: /^Warnings/i });
  if ((await sectionTab.getAttribute('aria-selected')) !== 'true') {
    await sectionTab.click();
  }
  await page.getByRole('tab', { name: /^Data Bank/i }).click();
}

test.describe('save resilience (authenticated)', () => {
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');

  test('a network failure during Save shows the error, re-enables Save, and a retry succeeds', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));

    // Phase 1: the warning-edit endpoint is unreachable (route.abort emulates a
    // dropped connection before the request leaves the browser).
    let networkBlocked = true;
    let saveRequests = 0;
    await page.route('**/api/admin/warning-edit', async (route) => {
      if (networkBlocked) {
        await route.abort();
        return;
      }
      saveRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ warning: { title: 'E2E edited title' }, audit: 'EDIT', geometry: 'unchanged' }),
      });
    });

    await openApp(page);
    await signInAdmin(page);
    await goDataBank(page);
    await expect(page.locator('#databank-table-header')).toBeVisible();

    // Open a warning's detail modal via the review queue (same path a human uses).
    const reviewFab = page.getByRole('button', { name: /Review Next \(\d+\)/ });
    test.skip(!(await reviewFab.count()), 'seed data has no unverified review queue');
    await reviewFab.click();
    const detail = page.locator('[role="dialog"][aria-labelledby="warning-detail-title"]');
    await expect(detail).toBeVisible();

    // Open the admin edit drawer from the detail modal.
    await detail.getByRole('button', { name: /^Edit$/ }).click();
    const drawer = page.locator('[role="dialog"][aria-labelledby="wem-dialog-title"]');
    await expect(drawer).toBeVisible();

    // Make a change so the save carries a real patch.
    const titleInput = drawer.locator('#wem-title');
    await titleInput.fill('E2E network resilience title');
    const saveBtn = drawer.getByRole('button', { name: /^Save$/ });

    // --- Save with the network down ---
    await saveBtn.click();
    await expect(drawer.getByText('Network error. Nothing was saved.')).toBeVisible();
    await expect(saveBtn).toBeEnabled();
    // The draft is still on screen.
    await expect(titleInput).toHaveValue('E2E network resilience title');

    // --- Connection returns: same Save button, same draft, now succeeds ---
    networkBlocked = false;
    await saveBtn.click();
    await expect.poll(() => saveRequests).toBe(1);
    await expect(drawer.getByText('Network error. Nothing was saved.')).toBeHidden();
    await expect(drawer.getByText('Saved to Supabase')).toBeVisible();

    expect(errors, 'no uncaught page errors').toEqual([]);
  });
});

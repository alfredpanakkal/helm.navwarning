/**
 * UX audit capture driver (Sprint 0).
 *
 * Drives the running app (`npm run dev` → http://localhost:3000) and captures a
 * screenshot + text DOM snapshot for every major UI state that later redesign
 * tasks must not break.
 *
 * Usage:
 *   npx tsx scripts/ux-audit/capture.ts            # local dev server states
 *   npx tsx scripts/ux-audit/capture.ts --live     # + live-site baselines
 *
 * Output:
 *   docs/ux-audit/screenshots/<state>.png
 *   docs/ux-audit/dom/<state>.txt   (visible body text of the same state, with a
 *                                   header line: overflow: scrollWidth=… clientWidth=…
 *                                   no_horizontal_overflow=… measured for that state)
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = path.join(ROOT, 'docs', 'ux-audit', 'screenshots');
const DOM = path.join(ROOT, 'docs', 'ux-audit', 'dom');

const LOCAL = 'http://localhost:3000';
const LIVE = 'https://helmwarning.vercel.app';

const DESKTOP = { width: 1440, height: 900 };
const TABLET = { width: 768, height: 1024 };
const PHONE = { width: 375, height: 812 };

let currentViewport = DESKTOP;
let failures: string[] = [];

async function capture(page: Page, name: string, opts: { fullPage?: boolean } = {}) {
  const shotPath = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: shotPath, fullPage: opts.fullPage ?? false });
  const text = (await page.evaluate('document.body.innerText')) as string;
  // Measured for every captured state (not once per viewport) and persisted in
  // the snapshot header, so overflow claims stay verifiable per state.
  const overflow = (await page.evaluate(
    '({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })'
  )) as { scrollWidth: number; clientWidth: number };
  const noOverflow = overflow.scrollWidth <= overflow.clientWidth;
  const header =
    `state: ${name}\n` +
    `viewport: ${currentViewport.width}x${currentViewport.height}\n` +
    `url: ${page.url()}\n` +
    `overflow: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth} no_horizontal_overflow=${noOverflow}\n` +
    `---\n`;
  writeFileSync(path.join(DOM, `${name}.txt`), header + text + '\n', 'utf8');
  console.log(
    `  captured ${name} (overflow scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth} no_horizontal_overflow=${noOverflow})`
  );
}

async function step(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    failures.push(label);
    console.error(`  FAILED ${label}: ${String(err).split('\n').slice(0, 6).join(' | ')}`);
  }
}

async function openApp(page: Page, base: string) {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#main-content', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(1800);
}

async function desktopTab(page: Page, label: 'Map View' | 'Data Bank' | 'Sources') {
  await page.getByRole('tab', { name: new RegExp(`^${label}`, 'i') }).click();
  await page.waitForTimeout(700);
}

async function mobileTab(page: Page, label: 'Map' | 'Data Bank' | 'Sources') {
  await page
    .locator('nav[aria-label="Primary quick navigation"]')
    .getByText(label, { exact: true })
    .click();
  await page.waitForTimeout(700);
}

/**
 * Drawer toggle for the Ocean Soundings overlay.
 * Anchored on the public label prefix only — never on Leaflet pane identifiers
 * (constraint 10 keeps pane/vector internals out of user-facing text, so the
 * audit tooling must not key on them either; see do-not-break.md §3.7).
 */
function oceanSoundingsCheckbox(page: Page) {
  return page
    .locator('label')
    .filter({ hasText: /^Ocean Soundings/ })
    .first()
    .locator('input[type="checkbox"]');
}

async function runDesktop(browser: Browser) {
  currentViewport = DESKTOP;
  const context: BrowserContext = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  await openApp(page, LOCAL);

  await step('map-drawer-open', async () => {
    await capture(page, 'map-drawer-open');
  });

  await step('map-drawer-closed', async () => {
    await page.locator('button[title="Collapse active warnings drawer"]').click();
    await page.waitForTimeout(500);
    await capture(page, 'map-drawer-closed');
    await page.locator('button[title="Expand active warnings drawer"]').click();
    await page.waitForTimeout(500);
  });

  await step('map-layers-alt-base', async () => {
    await page.locator('button[title="CARTO Voyager"]').click();
    const soundings = oceanSoundingsCheckbox(page);
    await soundings.click();
    await page.waitForTimeout(1200);
    await capture(page, 'map-layers-alt-base-voyager');
    await soundings.click();
    await page.locator('button[title="ESRI Ocean Base"]').click();
    await page.waitForTimeout(600);
  });

  await step('modal-warning-details', async () => {
    await page.locator('aside').getByText(/^Details/).first().click();
    await page.waitForSelector('button[title="Close modal (Esc)"]', { timeout: 10000 });
    await page.waitForTimeout(500);
    await capture(page, 'modal-warning-details');
    await page.locator('button[title="Close modal (Esc)"]').click();
    await page.waitForTimeout(400);
  });

  await step('databank-default', async () => {
    await desktopTab(page, 'Data Bank');
    await page.waitForTimeout(800);
    await capture(page, 'databank-default', { fullPage: true });
  });

  await step('databank-filtered', async () => {
    const search = page.locator('input[placeholder="Search records by ID, text, area, coords..."]');
    await search.fill('014');
    await page.waitForTimeout(700);
    await capture(page, 'databank-filtered', { fullPage: true });
    await search.fill('');
    await page.waitForTimeout(500);
  });

  await step('databank-sorted', async () => {
    await page.locator('button[title="Sort by NAVAREA"]').click();
    await page.waitForTimeout(600);
    await capture(page, 'databank-sorted', { fullPage: true });
  });

  await step('databank-empty', async () => {
    const search = page.locator('input[placeholder="Search records by ID, text, area, coords..."]');
    await search.fill('zzzz-no-match-zzzz');
    await page.waitForTimeout(700);
    await capture(page, 'databank-empty', { fullPage: true });
    await search.fill('');
    await page.waitForTimeout(500);
  });

  await step('modal-ingestion-procedure', async () => {
    await page.locator('button[title="View Ingestion Procedure (SOP)"]').click();
    await page.waitForSelector('text=Navigational Warning Ingestion Procedure', { timeout: 10000 });
    await page.waitForTimeout(500);
    await capture(page, 'modal-ingestion-procedure');
    await page.locator('button[title="Close modal (Esc)"]').click();
    await page.waitForTimeout(400);
  });

  await step('sources-default', async () => {
    await desktopTab(page, 'Sources');
    await page.waitForTimeout(800);
    await capture(page, 'sources-default', { fullPage: true });
  });

  await step('modal-admin-access', async () => {
    await page.locator('button[title="Unlock Admin Tools"]').click();
    await page.waitForSelector('text=Admin Access Gate', { timeout: 10000 });
    await page.waitForTimeout(400);
    await capture(page, 'modal-admin-access');
    await page.getByRole('button', { name: /^Cancel$/i }).click();
    await page.waitForTimeout(300);
  });

  await context.close();
}

async function runViewportSet(
  browser: Browser,
  viewport: { width: number; height: number },
  prefix: string
) {
  currentViewport = viewport;
  const context: BrowserContext = await browser.newContext({ viewport, isMobile: viewport.width < 768, hasTouch: true });
  const page = await context.newPage();
  await openApp(page, LOCAL);

  const useMobileNav = viewport.width < 768;
  const goTab = async (label: 'Map View' | 'Data Bank' | 'Sources') => {
    if (useMobileNav) await mobileTab(page, label as 'Map' | 'Data Bank' | 'Sources');
    else await desktopTab(page, label);
  };

  await step(`${prefix}-map`, async () => {
    await capture(page, `${prefix}-map`);
  });
  await step(`${prefix}-databank`, async () => {
    await goTab('Data Bank');
    await page.waitForTimeout(600);
    await capture(page, `${prefix}-databank`);
  });

  if (useMobileNav) {
    // Warning cards (with the expand/collapse control) only render below the md breakpoint.
    await step(`${prefix}-warning-expanded`, async () => {
      await page.locator('button[aria-label="Expand warning details"]').first().click();
      await page.waitForTimeout(600);
      await capture(page, `${prefix}-warning-expanded`);
    });
  }
  await step(`${prefix}-sources`, async () => {
    await goTab('Sources');
    await page.waitForTimeout(600);
    await capture(page, `${prefix}-sources`);
  });

  if (useMobileNav) {
    await step(`${prefix}-tools-menu`, async () => {
      await page
        .locator('nav[aria-label="Primary quick navigation"]')
        .getByText('More', { exact: true })
        .click();
      await page.waitForTimeout(500);
      await capture(page, `${prefix}-tools-menu`);
    });
  }

  await context.close();
}

async function runLive(browser: Browser) {
  currentViewport = DESKTOP;
  const context: BrowserContext = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  await openApp(page, LIVE);

  await step('live-baseline-map', async () => {
    await capture(page, 'live-baseline-map');
  });
  await step('live-baseline-databank', async () => {
    await desktopTab(page, 'Data Bank');
    await page.waitForTimeout(800);
    await capture(page, 'live-baseline-databank', { fullPage: true });
  });
  await step('live-baseline-sources', async () => {
    await desktopTab(page, 'Sources');
    await page.waitForTimeout(800);
    await capture(page, 'live-baseline-sources', { fullPage: true });
  });

  await context.close();
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  mkdirSync(DOM, { recursive: true });
  const withLive = process.argv.includes('--live');

  const browser = await chromium.launch();
  console.log('capturing desktop states (1440x900)');
  await runDesktop(browser);
  console.log('capturing phone states (375px)');
  await runViewportSet(browser, PHONE, 'mobile-375');
  console.log('capturing tablet states (768px)');
  await runViewportSet(browser, TABLET, 'tablet-768');
  if (withLive) {
    console.log('capturing live-baseline states (helmwarning.vercel.app)');
    await runLive(browser);
  }
  await browser.close();

  if (failures.length) {
    console.error(`\n${failures.length} state(s) failed: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('\nall states captured');
}

main();

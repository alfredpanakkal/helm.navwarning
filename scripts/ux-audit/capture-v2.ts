/**
 * Task 3 (UX information hierarchy) — v2 Data Bank capture driver.
 *
 * Drives the running app (`npm run dev:audit` → http://localhost:3000) and
 * captures screenshots + text DOM snapshots of the NEW (v2) Data Bank layout.
 * Legacy baselines under docs/ux-audit/screenshots/ and docs/ux-audit/dom/
 * are never touched — this script only writes to screenshots/v2/ and
 * dom/v2-*.txt.
 *
 * Usage:
 *   npx tsx scripts/ux-audit/capture-v2.ts
 */
import { chromium, type Page } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = path.join(ROOT, 'docs', 'ux-audit', 'screenshots', 'v2');
const DOM = path.join(ROOT, 'docs', 'ux-audit', 'dom');
const LOCAL = 'http://localhost:3000';

const DESKTOP = { width: 1440, height: 900 };
const TABLET = { width: 768, height: 1024 };
const PHONE = { width: 375, height: 812 };

async function openDataBank(page: Page, classic: boolean) {
  if (classic) {
    await page.addInitScript(() => localStorage.setItem('hwUI', 'classic'));
  }
  await page.goto(LOCAL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('#main-content', { timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  const viewport = page.viewportSize() ?? DESKTOP;
  if (viewport.width < 768) {
    const quickNav = page.locator('nav[aria-label="Primary quick navigation"]');
    await quickNav.getByText('Data Bank', { exact: true }).click();
  } else {
    await page.getByRole('tab', { name: /^Data Bank/i }).click();
  }
  await page.waitForTimeout(900);
  // The desktop table header exists on every viewport; below md it is hidden,
  // so wait for attachment (not visibility) to keep the phone capture working.
  await page.waitForSelector('#databank-table-header', { state: 'attached', timeout: 30_000 });
}

async function measureOverflow(page: Page) {
  return page.evaluate(
    '({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })'
  ) as Promise<{ scrollWidth: number; clientWidth: number }>;
}

/** Count warning rows/cards whose box intersects the current viewport. */
async function visibleWarningCount(page: Page, mode: 'desktop-table' | 'mobile-cards') {
  const payload =
    mode === 'desktop-table'
      ? `(() => {
          const header = document.querySelector('#databank-table-header');
          const body = header ? header.nextElementSibling : null;
          if (!body) return -1;
          const rows = [...body.children].filter((el) => el.getBoundingClientRect().height > 0);
          return rows.filter((r) => {
            const b = r.getBoundingClientRect();
            return b.top < window.innerHeight && b.bottom > 0;
          }).length;
        })()`
      : `(() => {
          const wrap = [...document.querySelectorAll('div')].find((d) => {
            const c = typeof d.className === 'string' ? d.className : '';
            return c.includes('md:hidden') && c.includes('space-y-3') && d.querySelector('button');
          });
          if (!wrap) return -1;
          const rows = [...wrap.children].filter((el) => el.getBoundingClientRect().height > 0);
          return rows.filter((r) => {
            const b = r.getBoundingClientRect();
            return b.top < window.innerHeight && b.bottom > 0;
          }).length;
        })()`;
  return page.evaluate(payload) as Promise<number>;
}

async function capture(
  page: Page,
  name: string,
  opts: { classic?: boolean } = {}
): Promise<string> {
  const shotPath = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });
  const text = (await page.evaluate('document.body.innerText')) as string;
  const overflow = await measureOverflow(page);
  const viewport = page.viewportSize() ?? DESKTOP;
  const header =
    `state: ${name}\n` +
    `viewport: ${viewport.width}x${viewport.height}\n` +
    `url: ${page.url()}\n` +
    `path: ${opts.classic ? 'classic' : 'v2'}\n` +
    `overflow: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth} no_horizontal_overflow=${overflow.scrollWidth <= overflow.clientWidth}\n` +
    `---\n`;
  writeFileSync(path.join(DOM, `${name}.txt`), header + text + '\n', 'utf8');
  console.log(`  captured ${name}`);
  return text;
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();

  // Desktop default (v2)
  {
    const page = await browser.newPage({ viewport: DESKTOP });
    await openDataBank(page, false);
    await capture(page, 'v2-databank-default-1440');
    const visibleTable = await visibleWarningCount(page, 'desktop-table');
    const visibleCards = await visibleWarningCount(page, 'mobile-cards');
    const overflow = await measureOverflow(page);
    console.log(
      `  VISIBLE-WITHOUT-SCROLL desktop-table=${visibleTable} mobile-cards=${visibleCards} overflow=${overflow.scrollWidth}/${overflow.clientWidth}`
    );

    await page.getByRole('button', { name: /^More filters$/ }).click();
    await page.waitForTimeout(400);
    await capture(page, 'v2-databank-more-filters-1440');

    await page.getByRole('button', { name: /^More filters$/ }).click();
    await page.getByRole('button', { name: /^Summary/i }).click();
    await page.waitForTimeout(400);
    await capture(page, 'v2-databank-summary-open-1440');
    await page.close();
  }

  // Tablet + phone (overflow sanity)
  for (const [viewport, name] of [
    [TABLET, 'v2-databank-768'],
    [PHONE, 'v2-databank-375'],
  ] as const) {
    const page = await browser.newPage({ viewport });
    await openDataBank(page, false);
    await capture(page, name);
    const overflow = await measureOverflow(page);
    const cards = await visibleWarningCount(page, 'mobile-cards');
    console.log(
      `  ${name}: overflow=${overflow.scrollWidth}/${overflow.clientWidth} no_horizontal_overflow=${overflow.scrollWidth <= overflow.clientWidth} mobile-cards-visible=${cards}`
    );
    await page.close();
  }

  // Classic path (unchanged hierarchy) for report comparison
  {
    const page = await browser.newPage({ viewport: DESKTOP });
    await openDataBank(page, true);
    await capture(page, 'classic-databank-default-1440', { classic: true });
    const visibleCards = await visibleWarningCount(page, 'mobile-cards');
    console.log(`  classic mobile-cards-visible=${visibleCards}`);
    await page.close();
  }

  await browser.close();
  console.log('v2 capture complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Task 7 (UX information hierarchy) — Focus map capture driver.
 *
 * Drives the running audit app (`npm run dev:audit` → http://localhost:3000)
 * at 1440×900 on the v2 path and captures three states:
 *   1. v2-map-focus-before-1440   — normal map view (all panels present)
 *   2. v2-map-focus-on-1440       — after "Focus map" (full-viewport map)
 *   3. v2-map-focus-restored-1440 — after "Restore map panels"
 *
 * Hard assertions (process exits 1 on any failure) cover the Task-7
 * acceptance:
 *   - focus: body[data-map-focus], header/footer hidden, map container =
 *     the viewport, drawer/search/controls panel gone, restore control +
 *     map attribution still visible
 *   - restore: chrome back, drawer open with the SAME scroll offset, controls
 *     panel expanded again, body attribute removed
 *   - innerText(before) === innerText(restored) — no content lost or gained
 *
 * Screenshots go to docs/ux-audit/screenshots/v2/ (budget: ≤40 combined),
 * DOM dumps to docs/ux-audit/dom/v2-map-focus-*.txt. Frozen classic baselines
 * under docs/ux-audit/dom/ are never written by this driver.
 *
 * Usage (server must already be running):
 *   npx tsx scripts/ux-audit/capture-map-focus.ts
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

const failures: string[] = [];
function check(ok: boolean, label: string, detail = '') {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
}

async function openApp(page: Page) {
  await page.goto(LOCAL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('#main-content', { timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.waitForSelector('aside', { timeout: 30_000 });
  await page.waitForTimeout(1200);
}

async function capture(page: Page, name: string) {
  const shotPath = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });
  const text = (await page.evaluate('document.body.innerText')) as string;
  const overflow = (await page.evaluate(
    '({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })'
  )) as { scrollWidth: number; clientWidth: number };
  const header =
    `state: ${name}\n` +
    `viewport: ${DESKTOP.width}x${DESKTOP.height}\n` +
    `url: ${page.url()}\n` +
    `path: v2\n` +
    `overflow: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth} no_horizontal_overflow=${overflow.scrollWidth <= overflow.clientWidth}\n` +
    `---\n`;
  writeFileSync(path.join(DOM, `${name}.txt`), header + text + '\n', 'utf8');
  console.log(`  captured ${name} (overflow ${overflow.scrollWidth}/${overflow.clientWidth})`);
  return text;
}

function stripHeader(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((t) => {
      if (/^(state|viewport|url|path|overflow):/.test(t)) return false;
      if (t === '---') return false;
      if (t === '') return false;
      return true;
    });
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  mkdirSync(DOM, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: DESKTOP });
  await openApp(page);

  // ── State markers: drawer scroll position (full list, before any filter) ──
  const scroll = (await page.evaluate(`(() => {
    const list = document.querySelector('aside .overflow-y-auto');
    if (!list) return { top: null, max: null };
    list.scrollTop = list.scrollHeight;
    return { top: list.scrollTop, max: list.scrollHeight - list.clientHeight };
  })()`)) as { top: number | null; max: number | null };
  console.log(`  DRAWER-SCROLL top=${scroll.top} max=${scroll.max}`);
  check(
    scroll.max !== null && scroll.max > 0 && scroll.top === scroll.max,
    'drawer list scrolled to bottom before focus',
    `top=${scroll.top} max=${scroll.max}`
  );

  const beforeText = await capture(page, 'v2-map-focus-before-1440');

  // ── Enter focus ──────────────────────────────────────────────────────────
  await page.locator('button[title="Hide panels and focus the map"]').click();
  await page.waitForSelector('button[title="Restore map panels"]', { timeout: 10_000 });
  await page.waitForTimeout(600);

  const focusAttr = await page.evaluate("document.body.getAttribute('data-map-focus')");
  check(focusAttr === 'on', 'body[data-map-focus="on"] set', String(focusAttr));
  check(await page.locator('header').isHidden(), 'app header hidden in focus');
  check(await page.locator('footer').isHidden(), 'app footer hidden in focus');
  check((await page.locator('aside').count()) === 0, 'warning drawer absent in focus');
  check(
    (await page.locator('#map-controls-panel').count()) === 0 ||
      (await page.locator('#map-controls-panel').isHidden()),
    'controls panel hidden in focus'
  );
  check(
    (await page.locator('input[placeholder="Search active notices..."]').count()) === 0,
    'map search hidden in focus'
  );
  const box = await page.locator('#map').boundingBox();
  check(box !== null, 'map container has a box');
  if (box) {
    check(
      Math.abs(box.x) <= 1 && Math.abs(box.y) <= 1 &&
        Math.abs(box.width - DESKTOP.width) <= 1 &&
        Math.abs(box.height - DESKTOP.height) <= 1,
      'map occupies the full viewport',
      `x=${Math.round(box.x)} y=${Math.round(box.y)} w=${Math.round(box.width)} h=${Math.round(box.height)}`
    );
  }
  check(
    await page.locator('button[title="Restore map panels"]').isVisible(),
    'focus restore control visible'
  );
  check(
    await page.locator('.leaflet-control-attribution').isVisible(),
    'map attribution visible'
  );

  const onText = await capture(page, 'v2-map-focus-on-1440');

  // ── Exit focus ───────────────────────────────────────────────────────────
  await page.locator('button[title="Restore map panels"]').click();
  await page.waitForSelector('aside', { timeout: 10_000 });
  await page.waitForTimeout(600);

  const attrAfter = await page.evaluate("document.body.getAttribute('data-map-focus')");
  check(attrAfter === null, 'body[data-map-focus] removed on exit', String(attrAfter));
  check(await page.locator('header').isVisible(), 'app header restored');
  check(await page.locator('footer').isVisible(), 'app footer restored');
  check(await page.locator('aside').isVisible(), 'warning drawer restored');
  check(
    await page.locator('#map-controls-panel').isVisible(),
    'controls panel restored (expanded)'
  );
  check(
    await page.locator('input[placeholder^="e.g. 55-23.90N"]').isVisible(),
    'go-to-coordinates input restored'
  );
  const scrollRestored = (await page.evaluate(`(() => {
    const list = document.querySelector('aside .overflow-y-auto');
    return list ? list.scrollTop : null;
  })()`)) as number | null;
  check(
    scrollRestored === scroll.top,
    'drawer scroll position restored',
    `expected=${scroll.top} actual=${scrollRestored}`
  );
  check(
    await page.locator('button[title="Collapse active warnings drawer"]').isVisible(),
    'drawer toggle restored'
  );

  const restoredText = await capture(page, 'v2-map-focus-restored-1440');

  const a = stripHeader(beforeText);
  const b = stripHeader(restoredText);
  const same = a.length === b.length && a.every((line, i) => line === b[i]);
  check(
    same,
    'innerText before === after focus round-trip (no functionality lost)',
    `lines before=${a.length} after=${b.length}`
  );
  if (!same) {
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max && failures.length < 40; i++) {
      if (a[i] !== b[i]) {
        console.log(`    line ${i + 1}: before=${JSON.stringify(a[i] ?? '<missing>')} after=${JSON.stringify(b[i] ?? '<missing>')}`);
      }
    }
  }

  await browser.close();

  if (failures.length > 0) {
    console.error(`\nFOCUS CAPTURE FAILED — ${failures.length} check(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\nfocus capture complete — all checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

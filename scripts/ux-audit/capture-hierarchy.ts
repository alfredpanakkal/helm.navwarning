/**
 * Task 4 (UX information hierarchy) — warning-item hierarchy capture driver.
 *
 * Drives the running audit app (`npm run dev:audit` → http://localhost:3000)
 * at 1440×900 and captures:
 *   1. The v2 Data Bank list (hierarchy rows) + a row with Details expanded.
 *   2. The Map View drawer with the warning-item hierarchy, plus the drawer
 *      with a warning opened (details modal).
 *   3. Classic-path DOM dumps for byte-parity comparison against the Task-1
 *      baselines under docs/ux-audit/dom/.
 *
 * New screenshots go to docs/ux-audit/screenshots/v2/ (budget: ≤40 combined).
 * Classic dumps and diffs go to the task-4 evidence folder (not committed to
 * docs/). Legacy baselines are never overwritten.
 *
 * Usage (server must already be running):
 *   npx tsx scripts/ux-audit/capture-hierarchy.ts
 */
import { chromium, type Page } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTerminologyRenames } from './terminology-renames';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = path.join(ROOT, 'docs', 'ux-audit', 'screenshots', 'v2');
const DOM = path.join(ROOT, 'docs', 'ux-audit', 'dom');
const EVIDENCE = path.join(
  ROOT,
  '.superpowers',
  'sdd',
  '2026-10-06-helm-warning-ux-hierarchy',
  'task-4-evidence'
);
const BASELINE_DOM = path.join(ROOT, 'docs', 'ux-audit', 'dom');
const LOCAL = 'http://localhost:3000';
const DESKTOP = { width: 1440, height: 900 };

async function openApp(page: Page, classic: boolean) {
  if (classic) {
    await page.addInitScript(() => localStorage.setItem('hwUI', 'classic'));
  }
  await page.goto(LOCAL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('#main-content', { timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
}

async function desktopTab(page: Page, label: 'Map View' | 'Data Bank') {
  await page.getByRole('tab', { name: new RegExp(`^${label}`, 'i') }).click();
  await page.waitForTimeout(700);
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

/** Strip capture headers, the dev UI switcher and the timestamped "Last updated" line. */
function normalizeDump(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => applyTerminologyRenames(line.trim()))
    .filter((t) => {
      if (/^(state|viewport|url|path|overflow):/.test(t)) return false;
      if (t === '---') return false;
      if (t === 'UI' || t === 'v2' || t === 'classic') return false;
      if (/Last updated:/.test(t)) return false;
      if (t === '') return false;
      return true;
    });
}

function diffDumps(label: string, currentRaw: string, baselineName: string): boolean {
  const baselinePath = path.join(BASELINE_DOM, baselineName);
  const baselineRaw = readFileSync(baselinePath, 'utf8');
  const a = normalizeDump(currentRaw);
  const b = normalizeDump(baselineRaw);
  const max = Math.max(a.length, b.length);
  const diffs: string[] = [];
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) {
      diffs.push(`  line ${i + 1}:\n    current:  ${JSON.stringify(a[i] ?? '<missing>')}\n    baseline: ${JSON.stringify(b[i] ?? '<missing>')}`);
      if (diffs.length >= 8) break;
    }
  }
  const ok = diffs.length === 0;
  console.log(
    `  PARITY ${label}: ${ok ? 'MATCH' : 'DIFF'} (normalized lines current=${a.length} baseline=${b.length})`
  );
  if (!ok) console.log(diffs.join('\n'));
  writeFileSync(
    path.join(EVIDENCE, `classic-parity-${label}.txt`),
    `baseline: ${baselineName}\nresult: ${ok ? 'MATCH' : 'DIFF'}\ncurrent lines: ${a.length}\nbaseline lines: ${b.length}\n\n--- current (normalized) ---\n${a.join('\n')}\n\n--- baseline (normalized) ---\n${b.join('\n')}\n`,
    'utf8'
  );
  return ok;
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  mkdirSync(DOM, { recursive: true });
  mkdirSync(EVIDENCE, { recursive: true });
  const browser = await chromium.launch();

  // ── 1. v2 Data Bank list + row Details expanded ──────────────────────────
  {
    const page = await browser.newPage({ viewport: DESKTOP });
    await openApp(page, false);
    await desktopTab(page, 'Data Bank');
    await page.waitForSelector('#databank-table-header', { timeout: 30_000 });
    await page.waitForTimeout(600);
    await capture(page, 'v2-databank-default-1440');

    const metrics = (await page.evaluate(`(() => {
      const header = document.querySelector('#databank-table-header');
      const body = header ? header.nextElementSibling : null;
      if (!body) return null;
      const rows = [...body.children].filter((el) => el.getBoundingClientRect().height > 0);
      return {
        rowCount: rows.length,
        rowHeights: rows.map((r) => Math.round(r.getBoundingClientRect().height)),
        rowsAboveFold: rows.filter((r) => {
          const b = r.getBoundingClientRect();
          return b.top < window.innerHeight && b.bottom > 0;
        }).length,
        lastRowBottom: Math.round(rows[rows.length - 1]?.getBoundingClientRect().bottom ?? 0),
        headerId: header?.id ?? null,
        bodyIsNextSibling: Boolean(header?.nextElementSibling),
      };
    })()`)) as Record<string, unknown> | null;
    console.log('  METRICS', JSON.stringify(metrics));

    await page.getByRole('button', { name: 'Expand warning details' }).first().click();
    await page.waitForTimeout(500);
    await capture(page, 'v2-databank-details-open-1440');
    await page.close();
  }

  // ── 2. Map View drawer (hierarchy) + drawer with a warning open ─────────
  {
    const page = await browser.newPage({ viewport: DESKTOP });
    await openApp(page, false);
    await page.waitForSelector('aside', { timeout: 30_000 });
    await page.waitForTimeout(800);
    const drawerText = (await capture(page, 'v2-map-drawer-1440')).toLowerCase();

    for (const probe of ['navarea', 'view on map', 'details']) {
      console.log(`  DRAWER-PROBE ${JSON.stringify(probe)}: ${drawerText.includes(probe) ? 'present' : 'MISSING'}`);
    }

    await page.locator('aside').getByText(/^Details/).first().click();
    await page.waitForSelector('button[title="Close modal (Esc)"]', { timeout: 10_000 });
    await page.waitForTimeout(500);
    await capture(page, 'v2-map-drawer-details-1440');
    await page.close();
  }

  // ── 3. Classic path parity vs Task-1 baselines ──────────────────────────
  {
    const page = await browser.newPage({ viewport: DESKTOP });
    await openApp(page, true);
    await desktopTab(page, 'Data Bank');
    await page.waitForSelector('#databank-table-header', { timeout: 30_000 });
    await page.waitForTimeout(800);
    const classicDb = (await page.evaluate('document.body.innerText')) as string;
    writeFileSync(path.join(EVIDENCE, 'classic-databank-default-1440.txt'), classicDb, 'utf8');
    await page.close();
  }
  {
    const page = await browser.newPage({ viewport: DESKTOP });
    await openApp(page, true);
    await page.waitForSelector('aside', { timeout: 30_000 });
    await page.waitForTimeout(800);
    const classicMap = (await page.evaluate('document.body.innerText')) as string;
    writeFileSync(path.join(EVIDENCE, 'classic-map-drawer-open.txt'), classicMap, 'utf8');
    await page.close();
  }

  const dbOk = diffDumps(
    'databank-default',
    readFileSync(path.join(EVIDENCE, 'classic-databank-default-1440.txt'), 'utf8'),
    'databank-default.txt'
  );
  const mapOk = diffDumps(
    'map-drawer-open',
    readFileSync(path.join(EVIDENCE, 'classic-map-drawer-open.txt'), 'utf8'),
    'map-drawer-open.txt'
  );

  await browser.close();
  console.log(`classic parity: databank=${dbOk ? 'MATCH' : 'DIFF'} map-drawer=${mapOk ? 'MATCH' : 'DIFF'}`);
  if (!dbOk || !mapOk) process.exitCode = 1;
  console.log('hierarchy capture complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

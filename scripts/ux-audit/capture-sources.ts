/**
 * Task 5 (UX information hierarchy) — Sources progressive-disclosure capture driver.
 *
 * Starts its own `npm run dev:audit` server (fresh rate-limit window), drives
 * http://localhost:3000 at 1440×900 and captures:
 *   1. v2 Sources default summary → details table + registry statistics.
 *   2. v2 Ingestion Procedure modal with the "Technical details (Admin)"
 *      footer entry, plus both branches of that entry point:
 *        - no session token → Admin Access Gate (existing sign-in flow)
 *        - session token    → original technical procedure modal
 *   3. Classic-path (hwUI=classic) runtime parity for the original
 *      SourceRegistryView and IngestionProcedureModal vs the Sprint-0
 *      baselines under docs/ux-audit/dom/.
 *
 * New screenshots go to docs/ux-audit/screenshots/v2/ (budget: ≤40 combined,
 * 3 new here). v2 DOM dumps go to docs/ux-audit/dom/v2-sources-*.txt. Classic
 * dumps, parity diffs and the probe log go to the task-5 evidence folder
 * (not committed to docs/). Legacy baselines are never overwritten.
 *
 * Usage (no server required):
 *   npx tsx scripts/ux-audit/capture-sources.ts
 */
import { chromium, type Page } from 'playwright';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = path.join(ROOT, 'docs', 'ux-audit', 'screenshots', 'v2');
const DOM = path.join(ROOT, 'docs', 'ux-audit', 'dom');
const EVIDENCE = path.join(
  ROOT,
  '.superpowers',
  'sdd',
  '2026-10-06-helm-warning-ux-hierarchy',
  'task-5-evidence'
);
const BASELINE_DOM = path.join(ROOT, 'docs', 'ux-audit', 'dom');
const LOCAL = 'http://localhost:3000';
const DESKTOP = { width: 1440, height: 900 };

const CONSTRAINT_TOKENS = [
  'SHA-256',
  'SHA256',
  'Supabase',
  'PostgreSQL',
  'regex',
  'parser pipeline',
  'HTTP format',
];

const results: string[] = [];
function check(label: string, ok: boolean, detail?: string): boolean {
  const line = `  ${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`;
  results.push(line);
  console.log(line);
  return ok;
}

async function startServer(): Promise<ChildProcess> {
  const proc = spawn('npm.cmd', ['run', 'dev:audit'], {
    cwd: ROOT,
    shell: true,
    detached: true,
    stdio: 'ignore',
  });
  const deadline = Date.now() + 90_000;
  for (;;) {
    try {
      const res = await fetch(LOCAL, { signal: AbortSignal.timeout(2000) });
      if (res.ok) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error('dev:audit server did not become ready in 90s');
    await new Promise((r) => setTimeout(r, 750));
  }
  console.log('  server ready on ' + LOCAL);
  return proc;
}

function stopServer(proc: ChildProcess | undefined) {
  if (!proc?.pid) return;
  try {
    spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    /* already gone */
  }
}

async function openApp(
  page: Page,
  opts: { classic?: boolean; adminToken?: string } = {}
) {
  await page.addInitScript(
    (o: { classic?: boolean; adminToken?: string }) => {
      if (o.classic) localStorage.setItem('hwUI', 'classic');
      if (o.adminToken) sessionStorage.setItem('helm_admin_token', o.adminToken);
    },
    opts
  );
  await page.goto(LOCAL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('#main-content', { timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
}

async function desktopTab(page: Page, label: 'Map View' | 'Data Bank' | 'Sources') {
  await page.getByRole('tab', { name: new RegExp(`^${label}`, 'i') }).click();
  await page.waitForTimeout(700);
}

async function dump(page: Page, name: string): Promise<string> {
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
  console.log(`  dumped ${name} (overflow ${overflow.scrollWidth}/${overflow.clientWidth})`);
  return text;
}

async function capture(page: Page, name: string): Promise<string> {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
  return dump(page, name);
}

function hitsIn(text: string, tokens: string[] = CONSTRAINT_TOKENS): string[] {
  const lower = text.toLowerCase();
  return tokens.filter((t) => lower.includes(t.toLowerCase()));
}

async function mainText(page: Page): Promise<string> {
  return (await page.locator('#main-content').innerText()) as string;
}

/** Strip capture headers, the dev UI switcher and the timestamped "Last updated" line. */
function normalizeDump(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
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
      diffs.push(
        `  line ${i + 1}:\n    current:  ${JSON.stringify(a[i] ?? '<missing>')}\n    baseline: ${JSON.stringify(b[i] ?? '<missing>')}`
      );
      if (diffs.length >= 8) break;
    }
  }
  const ok = diffs.length === 0;
  check(`classic parity ${label} vs ${baselineName}`, ok, `normalized lines current=${a.length} baseline=${b.length}`);
  if (!ok) console.log(diffs.join('\n'));
  writeFileSync(
    path.join(EVIDENCE, `classic-parity-${label}.txt`),
    `baseline: ${baselineName}\nresult: ${ok ? 'MATCH' : 'DIFF'}\ncurrent lines: ${a.length}\nbaseline lines: ${b.length}\n\n--- current (normalized) ---\n${a.join('\n')}\n\n--- baseline (normalized) ---\n${b.join('\n')}\n`,
    'utf8'
  );
  return ok;
}

/** The IngestionProcedureModal component region: heading line to end of dump. */
function extractModalRegion(raw: string): string[] {
  const lines = normalizeDump(raw);
  const idx = lines.findIndex((l) => /NAVIGATIONAL WARNING INGESTION PROCEDURE/i.test(l));
  return idx >= 0 ? lines.slice(idx) : [];
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  mkdirSync(DOM, { recursive: true });
  mkdirSync(EVIDENCE, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();
  let failed = false;
  const mark = (ok: boolean) => {
    if (!ok) failed = true;
  };

  try {
    // ── 1. v2 Sources default summary ─────────────────────────────────────
    {
      const page = await browser.newPage({ viewport: DESKTOP });
      await openApp(page);
      await desktopTab(page, 'Sources');
      await page.waitForSelector('[data-sources-summary]', { timeout: 30_000 });

      mark(check('default: "Official Data Sources" heading visible',
        await page.getByText('Official Data Sources').first().isVisible()));
      mark(check('default: "View source details" button visible',
        await page.getByRole('button', { name: 'View source details' }).isVisible()));

      const summaryText = await page.locator('[data-sources-summary]').innerText();
      const m = summaryText.match(
        /(\d+) sources available · (\d+) active warnings · Last checked (\d{2}:\d{2} UTC)/
      );
      mark(check('default: summary line matches required format', Boolean(m),
        m ? JSON.stringify(m[0]) : `no match in ${JSON.stringify(summaryText.slice(0, 200))}`));
      if (m) {
        mark(check('default: source count is real (19 from registry seed)', m[1] === '19', `got ${m[1]}`));
        mark(check('default: active-warning count is real (5 from seed)', m[2] === '5', `got ${m[2]}`));
        mark(check('default: Last checked is HH:MM UTC', /^\d{2}:\d{2} UTC$/.test(m[3]), m[3]));
      }

      const mainTextDefault = await mainText(page);
      mark(check('default: no legacy registry heading on default view',
        !mainTextDefault.includes('NAVWARN Candidate Discovery Registry')));
      mark(check('default: no legacy overview-card counters on default view',
        !mainTextDefault.includes('Verified Endpoints') && !mainTextDefault.includes('Poll Cadence')));
      mark(check('default: no Run Worker action on default view',
        !mainTextDefault.includes('Run Worker')));
      mark(check('default: constraint tokens absent from rendered Sources view',
        hitsIn(mainTextDefault).length === 0, hitsIn(mainTextDefault).join(', ') || 'none'));

      await capture(page, 'v2-sources-default-1440');

      // ── 2. details table + registry statistics + row expand ─────────────
      await page.getByRole('button', { name: 'View source details' }).click();
      await page.waitForSelector('[data-sources-details]', { timeout: 10_000 });
      const rowCount = await page.locator('[data-sources-details] tbody tr').count();
      mark(check('details: table row count matches summary count (19)', rowCount === 19, `got ${rowCount}`));

      await page.getByRole('button', { name: /^Registry statistics/ }).click();
      mark(check('details: registry statistics carries classic counters',
        (await page.getByText('Verified Endpoints').isVisible()) &&
        (await page.getByText('Unverified Coverage').isVisible())));

      await page.locator('button[title="Show technical details"]').first().click();
      await page.waitForTimeout(400);
      for (const probe of ['Discovery endpoint', 'Publication semantics', 'LLM fallback rate', 'Health diagnostics', 'Poll cadence']) {
        mark(check(`details: row expand shows "${probe}"`, await page.getByText(probe).first().isVisible()));
      }
      mark(check('details: Run Worker action reachable in row expand',
        await page.getByRole('button', { name: /Run Worker/ }).first().isVisible()));

      const mainTextDetails = await mainText(page);
      mark(check('details: constraint tokens absent from expanded technical facts',
        hitsIn(mainTextDetails).length === 0, hitsIn(mainTextDetails).join(', ') || 'none'));

      await capture(page, 'v2-sources-details-1440');
      await page.close();
    }

    // ── 3. v2 Ingestion Procedure modal + footer entry ────────────────────
    {
      const page = await browser.newPage({ viewport: DESKTOP });
      await openApp(page);
      await desktopTab(page, 'Data Bank');
      await page.locator('button[title="View Ingestion Procedure (SOP)"]').first().click();
      await page.waitForSelector('h2:has-text("Navigational Warning Ingestion Procedure")', { timeout: 10_000 });
      await page.waitForTimeout(400);

      const techBtn = page.getByRole('button', { name: 'Technical details (Admin)' });
      mark(check('modal: footer shows exact label "Technical details (Admin)"',
        await techBtn.isVisible()));

      const modalText = await page.locator('div.fixed.inset-0.z-50').last().innerText();
      mark(check('modal: constraint tokens absent from default modal surface',
        hitsIn(modalText).length === 0, hitsIn(modalText).join(', ') || 'none'));

      await capture(page, 'v2-sources-modal-1440');

      // 3a. non-admin branch → existing Admin Access Gate
      await techBtn.click();
      const gateVisible = await page
        .getByText('Admin Access Gate')
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      mark(check('non-admin: technical details routes to Admin Access Gate', gateVisible));
      const modalAfter = await page
        .locator('h2:has-text("Navigational Warning Ingestion Procedure")')
        .count();
      mark(check('non-admin: procedure modal closes before the gate opens', modalAfter === 0, `count=${modalAfter}`));
      await dump(page, 'v2-sources-admin-gate-1440');
      await page.close();

      // 3b. admin branch (session token) → original technical procedure modal
      const adminPage = await browser.newPage({ viewport: DESKTOP });
      await openApp(adminPage, { adminToken: 'audit-payload' });
      await desktopTab(adminPage, 'Data Bank');
      await adminPage.locator('button[title="View Ingestion Procedure (SOP)"]').first().click();
      await adminPage.waitForSelector('h2:has-text("Navigational Warning Ingestion Procedure")', { timeout: 10_000 });
      await adminPage.getByRole('button', { name: 'Technical details (Admin)' }).click();
      const nestedVisible = await adminPage
        .getByText('SHA-256 Hashes')
        .first()
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      mark(check('admin: technical details opens original procedure modal', nestedVisible));
      const techModalText = await adminPage.locator('div.fixed.inset-0.z-50').last().innerText();
      for (const probe of ['HTTP/S & NAVTEX', 'SHA-256 Hashes', 'Supabase PostgreSQL']) {
        mark(check(`admin: original modal keeps "${probe}" reachable`, techModalText.includes(probe)));
      }
      await dump(adminPage, 'v2-sources-admin-technical-1440');
      await adminPage.close();
    }

    // ── 4. classic path parity (runtime) ──────────────────────────────────
    {
      const page = await browser.newPage({ viewport: DESKTOP });
      await openApp(page, { classic: true });
      await desktopTab(page, 'Sources');
      await page.waitForTimeout(600);

      const classicMain = (await mainText(page)).toLowerCase();
      mark(check('classic: renders original SourceRegistryView (legacy heading)',
        classicMain.includes('navwarn candidate discovery registry')));
      mark(check('classic: legacy overview-card counters visible by default',
        classicMain.includes('verified endpoints') && classicMain.includes('poll cadence')));
      mark(check('classic: v2 summary marker absent',
        (await page.locator('[data-sources-summary]').count()) === 0));
      mark(check('classic: legacy frame classes present on sources view',
        (await page.locator('#main-content .border-2.border-gw-primary').count()) > 0));

      const classicDump = (await page.evaluate('document.body.innerText')) as string;
      writeFileSync(path.join(EVIDENCE, 'classic-sources-default-1440.txt'), classicDump, 'utf8');
      diffDumps('sources-default', classicDump, 'sources-default.txt');
      await page.close();
    }
    {
      const page = await browser.newPage({ viewport: DESKTOP });
      await openApp(page, { classic: true });
      await desktopTab(page, 'Data Bank');

      // Replicate the Sprint-0 capture.ts sequence exactly (sort + search
      // cycle) so the list background behind the modal matches the baseline.
      await page.locator('button[title="Sort by NAVAREA"]').click();
      await page.waitForTimeout(600);
      const search = page.locator('input[placeholder="Search records by ID, text, area, coords..."]');
      await search.fill('zzzz-no-match-zzzz');
      await page.waitForTimeout(700);
      await search.fill('');
      await page.waitForTimeout(500);

      await page.locator('button[title="View Ingestion Procedure (SOP)"]').click();
      await page.waitForSelector('text=Navigational Warning Ingestion Procedure', { timeout: 10_000 });
      await page.waitForTimeout(500);

      mark(check('classic: original IngestionProcedureModal renders (SHA-256 chip)',
        await page.getByText('SHA-256 Hashes').first().isVisible()));
      mark(check('classic: v2 modal footer label absent',
        (await page.getByRole('button', { name: 'Technical details (Admin)' }).count()) === 0));

      const classicModalDump = (await page.evaluate('document.body.innerText')) as string;
      writeFileSync(path.join(EVIDENCE, 'classic-ingestion-modal-1440.txt'), classicModalDump, 'utf8');
      diffDumps('ingestion-modal', classicModalDump, 'modal-ingestion-procedure.txt');

      // Component-region parity: modal heading → end of dump, independent of
      // the warning-list background state behind the overlay.
      const baselineModalDump = readFileSync(path.join(DOM, 'modal-ingestion-procedure.txt'), 'utf8');
      const curRegion = extractModalRegion(classicModalDump);
      const baseRegion = extractModalRegion(baselineModalDump);
      const regionOk =
        curRegion.length > 0 && curRegion.length === baseRegion.length &&
        curRegion.every((l, i) => l === baseRegion[i]);
      check('classic parity ingestion-modal component region (heading→EOF)', regionOk,
        `current=${curRegion.length} lines, baseline=${baseRegion.length} lines`);
      if (!regionOk) {
        const n = Math.max(curRegion.length, baseRegion.length);
        for (let i = 0; i < n; i++) {
          if (curRegion[i] !== baseRegion[i]) {
            console.log(`  region line ${i + 1}: current=${JSON.stringify(curRegion[i] ?? '<missing>')} baseline=${JSON.stringify(baseRegion[i] ?? '<missing>')}`);
          }
        }
      }
      writeFileSync(
        path.join(EVIDENCE, 'classic-parity-ingestion-modal-region.txt'),
        `result: ${regionOk ? 'MATCH' : 'DIFF'}\n\n--- current region ---\n${curRegion.join('\n')}\n\n--- baseline region ---\n${baseRegion.join('\n')}\n`,
        'utf8'
      );
      await page.close();
    }
  } finally {
    await browser.close();
    stopServer(server);
  }

  const shots = readdirSync(path.join(ROOT, 'docs', 'ux-audit', 'screenshots'), { recursive: true })
    .filter((f) => String(f).endsWith('.png')).length;
  check('screenshot budget ≤ 40 combined', shots <= 40, `now ${shots}/40`);

  const report = [
    `task-5 capture probes — ${new Date().toISOString()}`,
    ...results,
    '',
  ].join('\n');
  writeFileSync(path.join(EVIDENCE, 'probes.txt'), report, 'utf8');

  const failures = results.filter((r) => r.includes('FAIL'));
  console.log(`probes: ${results.length - failures.length} passed, ${failures.length} failed`);
  if (failed || failures.length > 0) process.exitCode = 1;
  console.log('sources capture complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

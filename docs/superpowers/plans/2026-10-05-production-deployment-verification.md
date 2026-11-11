# Production Deployment Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove repeatably that the deployed Helm.Warning site serves a working chart basemap, that the deployment matches `main`, and that its security posture is what we believe it to be.

**Architecture:** A zero-dependency Node script (`scripts/verify-deployment.mjs`) drives headless Chrome over the DevTools Protocol, asserts a fixed set of checks against any URL, and exits non-zero on failure. A small fixture server that serves a deliberately CSP-blocked page proves the checker actually fails when the policy is wrong (red/green). A manual `workflow_dispatch` GitHub Action runs the same script against production on demand, and a runbook document records the confirmed baseline.

**Tech Stack:** Node 22+ (global `WebSocket`, `fetch`), Chrome DevTools Protocol over WebSocket, GitHub Actions `workflow_dispatch`, Vercel hosting.

## Global Constraints

- Zero new npm dependencies. Node global `WebSocket` and `fetch` only (Node >= 22; local machine is v24.19.0, CI is Node 22).
- Repo is ESM (`"type": "module"` in `package.json`) — all scripts use `import`.
- Chrome is resolved from `CHROME_PATH`, then platform-standard paths. Linux CI runners have Google Chrome preinstalled; do not add an install step.
- Scripts must run on Windows (user's machine) and Linux (CI). No `date`, `rm`, or other shell-only constructs.
- The basemap tile pane is `.leaflet-base-pane` (custom pane), **not** `.leaflet-tile-pane`. A check that queries the wrong pane always reports zero tiles and looks like a CSP failure.
- Production URL is `https://navarea.helmology.com` (repo `homepageUrl`). Do not guess other URLs.
- Never stage or commit `graphify-out/`.
- Script exit code: `0` only when every `fail`-severity check passes. `warn` never fails the run.

## Open Decisions (user — not implemented by this plan)

1. **PR #4 has no effect on production.** Production is a static Vite build served by Vercel's filesystem layer, plus six Vercel Functions in `api/`. `server.ts` (and therefore `server/securityHeaders.ts`) is not deployed, so the app's CSP never runs there. The PR fixes `npm run dev` and self-hosted `npm start` only. To get headers on the real site they must be declared in `vercel.json` `headers`, or Express must actually be deployed. Recommended: `vercel.json` headers.
2. **`/api/tiles/carto/*` returns 404 in production** (verified). The `carto-voyager` and `carto-dark` layers in the layer picker are therefore broken when deployed. Either add an `api/tiles.ts` function or hide those layers when running statically.
3. **`/api/health` returns 404 in production** (verified), so the uptime/cron story is unverified there.

## File Structure

- Create `scripts/lib/cdp.mjs` — spawns headless Chrome, connects over CDP, creates an attached page target, exposes `evaluate`. No app knowledge.
- Create `scripts/verify-deployment.mjs` — the checks, CLI flags, table output, JSON/screenshot output. All Helm.Warning-specific assertions live here.
- Create `scripts/fixtures/csp-blocked-fixture.mjs` — serves a stub chart page under a strict CSP that blocks `server.arcgisonline.com`, plus a 1x1 dot image. Exists only to prove the checker fails.
- Create `docs/operations/production-verification.md` — runbook plus the verified baseline.
- Create `.github/workflows/verify-production.yml` — manual-dispatch job.
- Modify `package.json` — add `verify:dev`, `verify:prod`, `verify:selftest` scripts.

---

### Task 1: CDP harness and the deployment checker, proven to fail on a bad target

**Files:**
- Create: `helm.navwarning/scripts/lib/cdp.mjs`
- Create: `helm.navwarning/scripts/verify-deployment.mjs`
- Create: `helm.navwarning/scripts/fixtures/csp-blocked-fixture.mjs`
- Modify: `helm.navwarning/package.json` (add three scripts)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `launchChrome(opts?) -> Promise<{ proc, wsUrl, port, userDataDir, cleanup() }>` from `scripts/lib/cdp.mjs`
  - `connectCdp(wsUrl) -> Promise<{ send(method, params?, sessionId?), on(listener), close() }>` from `scripts/lib/cdp.mjs`
  - `openPage(cdp) -> Promise<{ sessionId, evaluate(expression) -> Promise<any> }>` from `scripts/lib/cdp.mjs`
  - CLI contract used by Task 2 and Task 3: `node scripts/verify-deployment.mjs --url <url> [--expect-headers present|absent|any] [--screenshot <path>] [--json <path>] [--port <n>] [--timeout <ms>]`; exit `0`/`1`.

- [ ] **Step 1: Write the CSP-blocked fixture**

Create `scripts/fixtures/csp-blocked-fixture.mjs`:

```js
// Fixture: serves a stub chart page whose basemap images are blocked by a
// strict CSP, so we can prove verify-deployment.mjs actually fails.
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 4321);
const DOT = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const tile = (i) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/2/${(i % 4) + 1}/2`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Helm.Warning</title></head>
<body>
<header><a class="gw-skip-link" href="#main-content">Skip to main content</a></header>
<main id="main-content" tabindex="-1">
  <h1>Fixture</h1>
  <div class="leaflet-container"><div class="leaflet-pane leaflet-base-pane" id="map">
    <img class="leaflet-marker-icon" src="/dot.png" alt="">
    ${Array.from({ length: 28 }, (_, i) => `<img src="${tile(i)}" width="256" height="256" alt="">`).join('\n    ')}
  </div></div>
</main>
</body></html>`;

http
  .createServer((req, res) => {
    if (req.url === '/dot.png') {
      res.setHeader('Content-Type', 'image/png');
      res.end(DOT);
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Same defect PR #4 fixed: arcgisonline missing from img-src.
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'");
    res.end(html);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`csp-blocked fixture on http://127.0.0.1:${PORT}`);
  });
```

- [ ] **Step 2: Write the CDP client**

Create `scripts/lib/cdp.mjs`:

```js
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
    : null,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

export function resolveChrome() {
  const hit = CANDIDATES.find((p) => existsSync(p));
  if (!hit) {
    throw new Error(`Chrome not found. Set CHROME_PATH. Tried:\n  ${CANDIDATES.join('\n  ')}`);
  }
  return hit;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchChrome({ port = 9333 } = {}) {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'hw-verify-'));
  const proc = spawn(
    resolveChrome(),
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--mute-audio',
      `--user-data-dir=${userDataDir}`,
      `--remote-debugging-port=${port}`,
      '--remote-allow-origins=*',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );
  let wsUrl;
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      wsUrl = (await res.json()).webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch {
      /* chrome not up yet */
    }
  }
  if (!wsUrl) {
    proc.kill();
    throw new Error('Chrome did not expose a CDP endpoint');
  }
  return {
    wsUrl,
    port,
    cleanup: async () => {
      try {
        proc.kill();
      } catch {
        /* already gone */
      }
      try {
        rmSync(userDataDir, { recursive: true, force: true });
      } catch {
        /* windows file lock */
      }
    },
  };
}

export async function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let seq = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.method ?? 'cdp'}: ${msg.error.message}`));
      else resolve(msg.result);
      return;
    }
    if (msg.method) for (const fn of listeners) fn(msg);
  });
  return {
    send: (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      }),
    on: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close: () => ws.close(),
  };
}

export async function openPage(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await Promise.all([
    cdp.send('Page.enable', {}, sessionId),
    cdp.send('Runtime.enable', {}, sessionId),
    cdp.send('Log.enable', {}, sessionId),
    cdp.send('Network.enable', {}, sessionId),
  ]);
  return {
    sessionId,
    evaluate: async (expression) => {
      const r = await cdp.send(
        'Runtime.evaluate',
        { expression, returnByValue: true },
        sessionId
      );
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      }
      return r.result.value;
    },
  };
}
```

- [ ] **Step 3: Write the checker**

Create `scripts/verify-deployment.mjs`:

```js
import { writeFileSync } from 'node:fs';
import { launchChrome, connectCdp, openPage } from './lib/cdp.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const TARGET = arg('url', 'http://localhost:3000');
const EXPECT_HEADERS = arg('expect-headers', 'any'); // present | absent | any
const SHOT = arg('screenshot', '');
const JSON_OUT = arg('json', '');
const PORT = Number(arg('port', 9333));
const TIMEOUT = Number(arg('timeout', 60000));
const CDP_PORT = Number(arg('cdp-port', 9333));

// Production currently 404s these; they are reported, never hidden.
const KNOWN_MISSING = ['/api/warnings', '/api/health', '/api/tiles/'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const checks = [];
const check = (name, ok, detail = '', severity = 'fail') => {
  checks.push({ name, ok: !!ok, detail, severity });
};

const header = (headers, name) => {
  const key = Object.keys(headers ?? {}).find((h) => h.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : null;
};

const chrome = await launchChrome({ port: CDP_PORT });
let exitCode = 0;
try {
  const cdp = await connectCdp(chrome.wsUrl);
  const page = await openPage(cdp);

  const consoleErrors = [];
  const pageErrors = [];
  const badResponses = [];
  let csp = null;

  cdp.on((msg) => {
    if (msg.sessionId !== page.sessionId) return;
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      consoleErrors.push({ text: msg.params.entry.text, url: msg.params.entry.url ?? '' });
    } else if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push(
        msg.params.exceptionDetails?.exception?.description ??
          msg.params.exceptionDetails?.text ??
          'unknown exception'
      );
    } else if (msg.method === 'Network.responseReceived') {
      const { status, url } = msg.params.response;
      if (msg.params.type === 'Document' && url === TARGET) {
        csp = header(msg.params.response.headers, 'content-security-policy');
      }
      if (status >= 400) badResponses.push({ status, url });
    }
  });

  await cdp.send('Page.navigate', { url: TARGET }, page.sessionId);
  for (let i = 0; i < 60; i++) {
    if ((await page.evaluate('document.readyState')) === 'complete') break;
    await sleep(500);
  }
  // Chrome replays the previous session's console buffer on Log.enable.
  consoleErrors.length = 0;
  pageErrors.length = 0;
  badResponses.length = 0;

  const tilesExpr = `(() => {
    const t = [...document.querySelectorAll('.leaflet-base-pane img, .leaflet-tile-pane img')];
    return {
      total: t.length,
      decoded: t.filter((i) => i.complete && i.naturalWidth > 0).length,
    };
  })()`;

  let tiles = { total: 0, decoded: 0 };
  const deadline = Date.now() + TIMEOUT;
  while (Date.now() < deadline) {
    tiles = await page.evaluate(tilesExpr);
    if (tiles.total > 0 && tiles.decoded === tiles.total) break;
    await sleep(1000);
  }

  const identity = await page.evaluate(
    `({ title: document.title, hasDocuFlow: document.body.innerText.includes('DocuFlow') })`
  );
  const map = await page.evaluate(`(() => {
    const m = document.getElementById('map');
    return {
      exists: !!m,
      role: m ? m.getAttribute('role') : null,
      labelled: !!(m && m.getAttribute('aria-label')),
      container: !!document.querySelector('.leaflet-container'),
      markers: document.querySelectorAll('.leaflet-marker-icon').length,
    };
  })()`);

  check('page title is Helm.Warning', identity.title === 'Helm.Warning', identity.title);
  check('no DocuFlow residue', !identity.hasDocuFlow);
  check('leaflet map mounted with markers', map.container && map.markers > 0, `${map.markers} markers`);
  check(
    'basemap tiles load (CSP allows Esri)',
    tiles.total > 0 && tiles.decoded === tiles.total,
    `${tiles.decoded}/${tiles.total} tiles decoded`
  );

  if (EXPECT_HEADERS === 'present') {
    check('CSP header present', !!csp, csp ?? 'no Content-Security-Policy on the document response');
  } else if (EXPECT_HEADERS === 'absent') {
    check('CSP header absent (as expected)', !csp, csp ?? 'absent');
  } else {
    check('CSP header', true, csp ?? 'absent (static deployment bypasses the Express middleware)', 'warn');
  }
  if (csp) {
    check('CSP allows Esri basemap', csp.includes('server.arcgisonline.com'), 'img-src entry missing');
    check(
      'CSP script-src has no unsafe-eval',
      !/script-src[^;]*unsafe-eval/.test(csp),
      'production should not allow unsafe-eval'
    );
  }

  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  const realConsole = consoleErrors.filter(
    (e) => !/favicon/i.test(e.url ?? '') && !KNOWN_MISSING.some((p) => (e.url ?? '').includes(p))
  );
  check('no unexpected console errors', realConsole.length === 0, realConsole.slice(0, 3).map((e) => e.text).join(' | '));
  const realBad = badResponses.filter((r) => !KNOWN_MISSING.some((p) => r.url.includes(p)));
  check('no unexpected HTTP 4xx/5xx', realBad.length === 0, realBad.slice(0, 4).map((r) => `${r.status} ${r.url}`).join(' | '), 'warn');

  if (SHOT) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, page.sessionId);
    writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));
  }
  cdp.close();
} finally {
  await chrome.cleanup();
}

const failed = checks.filter((c) => c.severity === 'fail' && !c.ok);
if (failed.length) exitCode = 1;

console.log(`\ndeployment verify: ${TARGET}`);
for (const c of checks) {
  const tag = c.severity === 'warn' ? (c.ok ? 'WARN' : 'WARN') : c.ok ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${c.name}${c.detail ? `  -- ${c.detail}` : ''}`);
}
console.log(`\n${checks.length - failed.length}/${checks.length} passed${exitCode ? ' (FAILED)' : ''}`);

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ target: TARGET, when: new Date().toISOString(), csp, tiles, checks, exitCode }, null, 2));
}
process.exit(exitCode);
```

- [ ] **Step 4: Add npm scripts**

In `package.json`, add to `scripts`:

```json
    "verify:dev": "node scripts/verify-deployment.mjs --url http://localhost:3000 --expect-headers present",
    "verify:prod": "node scripts/verify-deployment.mjs --url https://navarea.helmology.com --expect-headers any",
    "verify:selftest": "node scripts/fixtures/csp-blocked-fixture.mjs"
```

- [ ] **Step 5: Run the RED proof — the checker must fail on the CSP-blocked fixture**

Terminal 1:

```
npm run verify:selftest
```

Terminal 2:

```
node scripts/verify-deployment.mjs --url http://127.0.0.1:4321 --expect-headers present
```

Expected: exit code `1`, with `FAIL basemap tiles load (CSP allows Esri)  -- 0/28 tiles decoded` and `FAIL no unexpected console errors` (Chrome logs the CSP refusals). Every other check passes. If tiles report `28/28`, the check has no teeth — fix the pane selector before continuing.

- [ ] **Step 6: Commit**

```bash
git add scripts package.json
git commit -m "test(smoke): add zero-dependency CDP deployment verifier with CSP-blocked fixture"
```

---

### Task 2: Green proof against production and the baseline runbook

**Files:**
- Create: `helm.navwarning/docs/operations/production-verification.md`

**Interfaces:**
- Consumes: `node scripts/verify-deployment.mjs` from Task 1.
- Produces: `docs/operations/production-verification.md`, the runbook of record.

- [ ] **Step 1: Confirm the fixture is stopped and nothing else holds the CDP port**

```
curl.exe -sS -o NUL -w "%{http_code}" --max-time 5 http://127.0.0.1:4321/
```

Expected: connection failure, or any HTTP code from an unrelated process — the fixture must not be serving when we test production.

- [ ] **Step 2: Run the checker against production**

```
npm run verify:prod -- --json "$env:TEMP/verify-prod.json" --screenshot "$env:TEMP/verify-prod.png"
```

Expected: exit `0`; `basemap tiles load` reports all tiles decoded; `no uncaught page errors` and `no unexpected console errors` pass. The `CSP header` line will report `absent (static deployment bypasses the Express middleware)` as a `WARN` — that is the expected, documented state today.

- [ ] **Step 3: Record deployment-to-`main` parity**

```
git fetch origin
git rev-parse origin/main
gh api "repos/alfredpanakkal/helm.navwarning/deployments?per_page=10" --jq '.[] | select(.environment=="Production") | "\(.created_at) \(.sha)"'
```

Expected: the newest Production `sha` equals `origin/main` once your merge of PR #4 has deployed. If it still points at the pre-merge commit, wait for the Vercel production build and re-run Step 2. Put the observed value and timestamp in the runbook.

- [ ] **Step 4: Write the runbook**

Create `docs/operations/production-verification.md` containing:

```markdown
# Production verification

Production: https://navarea.helmology.com
Checker: `npm run verify:prod` (exit 0 = all fail-severity checks passed)

## How to verify a deployment

1. `git fetch origin && git rev-parse origin/main` — note the commit.
2. `gh api "repos/alfredpanakkal/helm.navwarning/deployments?per_page=10" --jq '.[] | select(.environment=="Production") | "\(.created_at) \(.sha)"'`
   — confirm the newest Production deployment is that commit.
3. `npm run verify:prod` — expect exit 0.
4. On failure, keep the evidence: `node scripts/verify-deployment.mjs --url https://navarea.helmology.com --expect-headers any --json verify.json --screenshot verify.png`.

## Deployment shape (verified 2026-10-05)

- Static Vite build served by Vercel's filesystem layer: `GET /` returns
  `X-Vercel-Cache: HIT`, `Server: Vercel`, and HSTS `max-age=63072000`
  (Vercel's default, not the app's 31536000).
- Six Vercel Functions in `api/`: `admin/login`, `admin/test-gemini`,
  `admin/verify`, `scrape-navwarn`, `supabase/status`, `supabase/sync`.
- `server.ts` is NOT deployed. Consequences:
  - the app's CSP/security headers do not run (no CSP, no X-Frame-Options,
    no X-Content-Type-Options on the document response);
  - `GET /api/health` -> 404 `X-Vercel-Error: NOT_FOUND`;
  - `GET /api/warnings` -> 404, so the client falls back to bundled sample data;
  - `GET /api/tiles/carto/voyager/1/0/0` -> 404, so the CARTO layer options in
    the layer picker are broken in production (the default Esri basemap is not).
- The `vercel.json` cron target `/api/scrape-navwarn` does exist and returns 401
  without credentials, as expected.

## Baseline

Record the result of Step 2 here, with the date and the production commit.
```

Fill in the Baseline section with the numbers observed in Step 2 and the commit from Step 3.

- [ ] **Step 5: Commit**

```bash
git add docs/operations/production-verification.md
git commit -m "docs(ops): add production verification runbook and recorded baseline"
```

---

### Task 3: Manual CI dispatch for production verification

**Files:**
- Create: `helm.navwarning/.github/workflows/verify-production.yml`

**Interfaces:**
- Consumes: `scripts/verify-deployment.mjs` from Task 1.
- Produces: workflow `verify-production`, dispatchable with an optional `url` input.

- [ ] **Step 1: Write the workflow**

```yaml
name: verify-production

on:
  workflow_dispatch:
    inputs:
      url:
        description: 'Deployment URL to verify'
        required: false
        default: 'https://navarea.helmology.com'

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Verify deployment
        run: |
          node scripts/verify-deployment.mjs \
            --url "${{ inputs.url || 'https://navarea.helmology.com' }}" \
            --expect-headers any \
            --json verify.json \
            --screenshot verify.png
      - name: Upload evidence
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: verify-report
          path: |
            verify.json
            verify.png
          if-no-files-found: ignore
```

Note: `--expect-headers any` on purpose. Switching it to `present` must not happen until the Open Decision 1 fix lands headers on the real deployment; at that point `present` becomes the correct assertion and this line is changed in the same PR.

- [ ] **Step 2: Dispatch it and watch it pass**

```
gh workflow run verify-production --ref main
gh run list --workflow verify-production --limit 1
gh run watch
```

Expected: the run completes green, and an artifact named `verify-report` contains `verify.json` and `verify.png`. If the job fails on a CSP-tiles check, the artifact screenshot shows whether the basemap rendered.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/verify-production.yml
git commit -m "ci: add manual workflow to verify a deployment in a real browser"
```

---

## Self-Review

**Spec coverage:** The original item was "verify the fix in production". Task 1 supplies a checker that has been proven to fail on a wrong CSP (so a pass is meaningful) and that asserts the specific thing PR #4 fixed. Task 2 runs it against production, ties the deployed commit to `main`, and records the baseline. Task 3 makes it repeatable. The finding that PR #4 does not affect the deployed site is captured as an explicit user decision rather than silently dropped.

**Placeholder scan:** All code is complete and runnable; no `TODO`, no "add error handling", no task referencing an undefined symbol. `openPage`, `connectCdp`, `launchChrome`, and the CLI flags are defined in Task 1 and consumed by name in Tasks 2 and 3.

**Type consistency:** The CLI contract in Task 1 (`--url`, `--expect-headers`, `--screenshot`, `--json`, `--port`, `--timeout`, `--cdp-port`) matches every invocation in Tasks 2 and 3, including the npm script definitions.

**Known gaps, stated rather than hidden:** the three Open Decisions (headers in production, broken CARTO layers, 404 `/api/health`) are out of scope here and would each be their own plan.

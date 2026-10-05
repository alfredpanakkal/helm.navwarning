// verify-selftest.mjs -- end-to-end proof that scripts/verify-deployment.mjs
// actually FAILS on a deployment whose Content-Security-Policy blocks the Esri
// basemap tiles.
//
// =============================================================================
// INVERSION -- READ THIS FIRST:
//
//   THIS SELFTEST PASSES (exit 0) ONLY WHEN THE CHECKER FAILS (exit != 0).
//
//   The selftest starts the deliberately CSP-broken fixture, runs the real
//   verifier against it, and then *requires* the verifier to reject that
//   deployment. "PASS" here does not mean "the deployment was good"; it means
//   "the checker's teeth are intact: it rejected a broken deployment for the
//   right reasons". If verify-deployment.mjs ever regresses into accepting a
//   CSP that blocks every Esri tile (a false PASS on production), this harness
//   exits non-zero and names the assertion that caught the regression.
// =============================================================================
//
// What is asserted -- always against the parsed `--json` file written by the
// verifier, never against its human-formatted stdout:
//
//   1. verifier-exits-nonzero : the child process exit code is a number and is
//      not 0 (the check FAILED), and it agrees with `json.exitCode`.
//   2. tiles-negative-control : checks[] entry
//      "basemap tiles load (CSP allows Esri)" has ok === false and
//      severity === "fail", and json.tiles.total === 28 with
//      json.tiles.decoded === 0. That is the negative control: the selector
//      found all 28 fixture tiles and CSP blocked every single one. Asserted on
//      the JSON numbers themselves, not on the formatted "0/28" detail string.
//   3. csp-violation-captured : checks[] entry "no unexpected console errors"
//      has ok === false, and at least one captured console error in its `detail`
//      field is a genuine CSP violation naming the arcgisonline origin and the
//      img-src directive (i.e. proof that img-src blocked a real tile request).
//
// Cleanup guarantee (all paths: success, assertion failure, child crash,
// SIGINT/SIGTERM, overall timeout):
//   - the fixture server and the verifier (plus the Chrome it spawned) are
//     killed as a process tree, and the fixture port is re-checked as released;
//   - the temp dir holding verify.json is removed;
//   - any `hw-verify-*` Chrome user-data-dir leaked by a hard-killed verifier
//     (only present when this run created it) is swept;
//   - an overall timeout guarantees the harness can never hang.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'scripts', 'fixtures', 'csp-blocked-fixture.mjs');
const VERIFIER = path.join(ROOT, 'scripts', 'verify-deployment.mjs');

const FIXTURE_URL_HOST = '127.0.0.1';
const EXPECTED_TILE_TOTAL = 28;
const EXPECTED_TILE_DECODED = 0;
const TILE_CHECK_NAME = 'basemap tiles load (CSP allows Esri)';
const CONSOLE_CHECK_NAME = 'no unexpected console errors';
const FIXTURE_READY_TIMEOUT_MS = 15_000;
const CHILD_EXIT_GRACE_MS = 5_000;
const PORT_RELEASE_TIMEOUT_MS = 5_000;
// The CSP-blocked tile poll in verify-deployment.mjs cannot break early while
// decoded !== total, so a good run takes ~60s of polling plus browser startup.
// The budget below is deliberately generous; never "fix" a slow selftest by
// shrinking it here (and never by touching the verifier's poll loop).
const OVERALL_TIMEOUT_MS = (() => {
  const raw = Number(process.env.VERIFY_SELFTEST_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 240_000;
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Prefer setting exitCode over process.exit(): stdio writes to a TTY can be
// asynchronous on Windows, and process.exit() would truncate the summary line.
// The unref'd safety timer only fires if some handle keeps the loop alive, so
// the harness still cannot hang.
function finish(code) {
  process.exitCode = code;
  setTimeout(() => process.exit(code), 1500).unref();
}

function snapshotVerifyTempDirs() {
  // Baseline taken before this run spawns anything: only entries created after
  // this point may be swept, so we never touch another run's directories.
  try {
    return new Set(readdirSync(tmpdir()));
  } catch {
    return new Set();
  }
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, FIXTURE_URL_HOST, () => {
      srv.close(() => resolve(true));
    });
  });
}

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, FIXTURE_URL_HOST, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// Prefer the fixture's documented port 4321 when it is genuinely free; if some
// other process owns it, use a fresh ephemeral port instead of clobbering it.
async function pickFixturePort() {
  if (await portIsFree(4321)) return { port: 4321, reusedDefault: true };
  return { port: await pickFreePort(), reusedDefault: false };
}

function killTree(child) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (process.platform === 'win32') {
      // /T kills the whole tree so the verifier's Chrome dies with it.
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } else {
      // The child was spawned detached, so -pid targets its own process group
      // (verifier + Chrome, or fixture) and never this harness.
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }
}

function spawnDetached(cmd, args, env) {
  const child = spawn(cmd, args, {
    env: env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  child.whenExited = new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal, error: null }));
    // A failed spawn emits 'error' and never 'exit'; without this the harness
    // would sit in the overall-timeout path instead of reporting the real cause.
    child.once('error', (error) => resolve({ code: null, signal: null, error }));
  });
  return child;
}

function echo(tag) {
  return (chunk) => {
    process.stdout.write(`[${tag}] ${chunk}`);
  };
}

async function whenExited(child) {
  if (!child) return null;
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode };
  }
  return Promise.race([child.whenExited, sleep(CHILD_EXIT_GRACE_MS).then(() => null)]);
}

async function waitForPortFree(port) {
  const deadline = Date.now() + PORT_RELEASE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await portIsFree(port)) return true;
    await sleep(100);
  }
  return await portIsFree(port);
}

async function sweepNewVerifyTempDirs(baseline) {
  const problems = [];
  let names = [];
  try {
    names = readdirSync(tmpdir());
  } catch (err) {
    problems.push(`could not list ${tmpdir()}: ${err.message}`);
    return problems;
  }
  for (const name of names) {
    if (!name.startsWith('hw-verify-') || baseline.has(name)) continue;
    const dir = path.join(tmpdir(), name);
    let removed = false;
    for (let i = 0; i < 5 && !removed; i++) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* Windows may still hold handles briefly; retry below */
      }
      removed = !existsSync(dir);
      if (!removed) await sleep(200);
    }
    if (!removed) problems.push(`leftover Chrome user-data-dir not removable: ${dir}`);
  }
  return problems;
}

// --- assertion design -------------------------------------------------------
// Every assertion reads the JSON the verifier wrote via --json. Its stdout is
// echoed for humans only: grepping formatted log text would let whitespace,
// column or wording changes silently break (or falsely satisfy) the proof.

function runAssertions({ json, exitOutcome }) {
  const failures = [];

  if (exitOutcome.kind !== 'exit') {
    failures.push({
      id: 'verifier-exits-nonzero',
      message: `verifier never exited normally (${exitOutcome.kind}); got no trustworthy exit code`,
    });
  } else {
    const { code, signal, error } = exitOutcome;
    if (!Number.isInteger(code) || code === 0) {
      failures.push({
        id: 'verifier-exits-nonzero',
        message:
          `expected the verifier to exit non-zero (it must REJECT a CSP-broken deployment), ` +
          `got code=${String(code)} signal=${String(signal)}` +
          `${error ? ` spawn error: ${error.message}` : ''}` +
          `${Number.isInteger(code) && code === 0 ? ' -- the checker passed a broken deployment' : ''}`,
      });
    } else if (json && json.exitCode !== code) {
      failures.push({
        id: 'verifier-exits-nonzero',
        message: `process exit code ${code} disagrees with json.exitCode ${JSON.stringify(json.exitCode)}`,
      });
    }
  }

  if (!json) return failures;

  const checks = Array.isArray(json.checks) ? json.checks : [];

  // 2. Negative control: 28 tiles were found and CSP blocked all 28.
  const tilesCheck = checks.find((c) => c?.name === TILE_CHECK_NAME);
  if (!tilesCheck) {
    failures.push({
      id: 'tiles-negative-control',
      message: `check ${JSON.stringify(TILE_CHECK_NAME)} missing from verifier JSON checks[]`,
    });
  } else {
    if (tilesCheck.ok !== false || tilesCheck.severity !== 'fail') {
      failures.push({
        id: 'tiles-negative-control',
        message:
          `checker reported ok=${JSON.stringify(tilesCheck.ok)} severity=${JSON.stringify(tilesCheck.severity)} ` +
          `for ${JSON.stringify(TILE_CHECK_NAME)} -- it accepted a deployment whose CSP blocks every ` +
          `Esri tile (negative control regressed: false PASS)`,
      });
    }
    const total = json.tiles?.total;
    const decoded = json.tiles?.decoded;
    if (total !== EXPECTED_TILE_TOTAL) {
      failures.push({
        id: 'tiles-negative-control',
        message: `expected json.tiles.total === ${EXPECTED_TILE_TOTAL} (selector found every fixture tile), got ${JSON.stringify(total)}`,
      });
    }
    if (decoded !== EXPECTED_TILE_DECODED) {
      failures.push({
        id: 'tiles-negative-control',
        message: `expected json.tiles.decoded === ${EXPECTED_TILE_DECODED} (CSP blocked every tile), got ${JSON.stringify(decoded)} -- the fixture's tiles are no longer all blocked, or the decode probe lies`,
      });
    }
  }

  // 3. The captured console errors must contain a real img-src CSP violation
  //    against an Esri tile request.
  const consoleCheck = checks.find((c) => c?.name === CONSOLE_CHECK_NAME);
  if (!consoleCheck) {
    failures.push({
      id: 'csp-violation-captured',
      message: `check ${JSON.stringify(CONSOLE_CHECK_NAME)} missing from verifier JSON checks[]`,
    });
  } else if (consoleCheck.ok !== false) {
    failures.push({
      id: 'csp-violation-captured',
      message: `checker reported ok=${JSON.stringify(consoleCheck.ok)} for ${JSON.stringify(CONSOLE_CHECK_NAME)} -- the CSP rejections were not counted as console errors`,
    });
  } else {
    const detail = String(consoleCheck.detail ?? '');
    const captured = detail.split(' | ').map((s) => s.trim()).filter(Boolean);
    const isCspTileBlock = (s) =>
      /violates the following Content Security Policy directive/i.test(s) &&
      /img-src/.test(s) &&
      /server\.arcgisonline\.com/.test(s) &&
      /blocked/i.test(s);
    const hits = captured.filter(isCspTileBlock);
    if (hits.length === 0) {
      failures.push({
        id: 'csp-violation-captured',
        message:
          `no captured console error proved img-src blocked an Esri tile request ` +
          `(need the violation phrase, "img-src", and server.arcgisonline.com in checks[].detail); ` +
          `detail=${JSON.stringify(detail.slice(0, 400))}`,
      });
    }
  }

  return failures;
}
// ----------------------------------------------------------------------------

const baselineDirs = snapshotVerifyTempDirs();
let fixtureProc = null;
let verifierProc = null;
let tempDir = null;
let fixturePort = null;
let cleanedUp = false;
let aborting = false;

async function cleanup() {
  const problems = [];
  if (cleanedUp) return problems;
  cleanedUp = true;

  killTree(verifierProc);
  killTree(fixtureProc);
  await whenExited(verifierProc);
  await whenExited(fixtureProc);

  if (fixturePort !== null && !(await waitForPortFree(fixturePort))) {
    problems.push(`port ${fixturePort} is still occupied after killing the fixture`);
  }

  problems.push(...(await sweepNewVerifyTempDirs(baselineDirs)));

  if (tempDir) {
    for (let i = 0; i < 3; i++) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        /* retry */
      }
      if (!existsSync(tempDir)) break;
      await sleep(100);
    }
    if (existsSync(tempDir)) problems.push(`temp dir not removable: ${tempDir}`);
    tempDir = null;
  }
  return problems;
}

// Last-resort synchronous cleanup: runs even on process 'exit' (uncaught
// exception, forced exit) when async cleanup never got the chance.
process.on('exit', () => {
  killTree(verifierProc);
  killTree(fixtureProc);
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

const signalHandler = (signal) => async () => {
  if (aborting) return;
  aborting = true;
  process.stdout.write(`\n[signal] ${signal} received -- cleaning up before exit\n`);
  await cleanup();
  finish(130);
};
process.on('SIGINT', signalHandler('SIGINT'));
process.on('SIGTERM', signalHandler('SIGTERM'));

async function main() {
  process.stdout.write(
    'verify:selftest -- negative control for scripts/verify-deployment.mjs\n' +
      '  INVERSION: this selftest PASSES (exit 0) only when the CHECKER FAILS (exit != 0).\n' +
      `  overall timeout: ${OVERALL_TIMEOUT_MS} ms\n`
  );

  const { port: chosenPort, reusedDefault } = await pickFixturePort();
  fixturePort = chosenPort;
  const cdpPort = await pickFreePort();
  const fixtureUrl = `http://${FIXTURE_URL_HOST}:${fixturePort}`;
  process.stdout.write(
    `  fixture: ${fixtureUrl} (4321 ${reusedDefault ? 'was free, using it' : 'is occupied, using an ephemeral free port'})\n` +
      `  cdp port: ${cdpPort}\n`
  );

  tempDir = mkdtempSync(path.join(tmpdir(), 'verify-selftest-'));
  const jsonPath = path.join(tempDir, 'verify.json');

  const failures = [];
  let exitOutcome = { kind: 'never-ran' };
  let json = null;
  let timeoutId = null;

  try {
    fixtureProc = spawnDetached(process.execPath, [FIXTURE], {
      ...process.env,
      PORT: String(fixturePort),
    });
    let fixtureExitedEarly = null;
    fixtureProc.whenExited.then((r) => {
      fixtureExitedEarly = r;
    });
    fixtureProc.stdout.on('data', echo('fixture'));
    fixtureProc.stderr.on('data', echo('fixture'));

    const readyDeadline = Date.now() + FIXTURE_READY_TIMEOUT_MS;
    let ready = false;
    let lastError = '';
    while (Date.now() < readyDeadline && !ready) {
      if (fixtureExitedEarly) {
        throw new Error(
          `fixture exited before becoming ready (code=${fixtureExitedEarly.code} signal=${fixtureExitedEarly.signal}); ` +
            `port ${fixturePort} may be unusable`
        );
      }
      try {
        const res = await fetch(fixtureUrl, { signal: AbortSignal.timeout(2000) });
        const csp = res.headers.get('content-security-policy') ?? '';
        if (res.ok && csp.includes("img-src 'self'")) {
          ready = true;
          break;
        }
        lastError = `status=${res.status} content-security-policy=${JSON.stringify(csp)}`;
      } catch (err) {
        lastError = err?.message ?? String(err);
      }
      await sleep(200);
    }
    if (!ready) throw new Error(`fixture not ready within ${FIXTURE_READY_TIMEOUT_MS}ms: ${lastError}`);

    verifierProc = spawnDetached(
      process.execPath,
      [
        VERIFIER,
        '--url',
        fixtureUrl,
        '--expect-headers',
        'any',
        '--json',
        jsonPath,
        '--cdp-port',
        String(cdpPort),
      ]
    );
    verifierProc.stdout.on('data', echo('verifier'));
    verifierProc.stderr.on('data', echo('verifier'));

    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve({ kind: 'timeout' }), OVERALL_TIMEOUT_MS);
    });
    const outcome = await Promise.race([
      verifierProc.whenExited.then(({ code, signal, error }) => ({ kind: 'exit', code, signal, error })),
      timeoutPromise,
    ]);
    exitOutcome = outcome;
    if (aborting) return;

    try {
      json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    } catch (err) {
      failures.push({
        id: 'json-output',
        message: `could not read/parse the verifier's --json output at ${jsonPath}: ${err.message}`,
      });
    }
    if (outcome.kind === 'timeout') {
      failures.push({
        id: 'overall-timeout',
        message: `verify-deployment did not finish within ${OVERALL_TIMEOUT_MS}ms (aborted and cleaned up)`,
      });
    }

    failures.push(...runAssertions({ json, exitOutcome }));
  } catch (err) {
    failures.push({
      id: 'harness-error',
      message: err?.stack ?? String(err),
    });
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }

  if (aborting) return;

  const cleanupProblems = await cleanup();
  for (const problem of cleanupProblems) {
    failures.push({ id: 'cleanup', message: problem });
  }

  if (json) {
    const tilesCheck = (json.checks ?? []).find((c) => c?.name === TILE_CHECK_NAME);
    process.stdout.write(
      `\nobserved: verifier exit=${exitOutcome.kind === 'exit' ? exitOutcome.code : exitOutcome.kind}` +
        ` json.exitCode=${JSON.stringify(json.exitCode)}` +
        ` tiles=${JSON.stringify(json.tiles)}` +
        ` ${TILE_CHECK_NAME} ok=${JSON.stringify(tilesCheck?.ok)}\n`
    );
  }

  if (failures.length === 0) {
    const consoleCheck = (json?.checks ?? []).find((c) => c?.name === CONSOLE_CHECK_NAME);
    const cspHits = String(consoleCheck?.detail ?? '')
      .split(' | ')
      .filter((s) => /Content Security Policy/i.test(s)).length;
    const exitCode = exitOutcome.kind === 'exit' ? exitOutcome.code : String(exitOutcome.kind);
    process.stdout.write(
      `SELFTEST PASS: the checker rejected the CSP-broken fixture (verifier exit ${exitCode}; ` +
        `tiles ${json?.tiles?.decoded}/${json?.tiles?.total} decoded; ${cspHits} captured CSP console violation(s)) ` +
        `- 3/3 assertions held, cleanup clean. Teeth intact.\n`
    );
    finish(0);
    return;
  }

  process.stdout.write(`SELFTEST FAIL: ${failures.length} assertion(s) failed -- the checker's teeth are NOT proven\n`);
  for (const f of failures) {
    process.stdout.write(`  - ${f.id}: ${f.message}\n`);
  }
  finish(1);
}

main().catch(async (err) => {
  process.stdout.write(`SELFTEST FAIL: harness crashed: ${err?.stack ?? String(err)}\n`);
  await cleanup();
  finish(1);
});

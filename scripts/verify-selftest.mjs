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
//   - the tree is reaped UNCONDITIONALLY: a child that has already exited tells
//     us nothing about its descendants, so cleanup never skips the reaping step
//     just because the child is gone;
//   - the temp dir holding verify.json is removed;
//   - every process holding a Chrome user-data-dir created by THIS invocation is
//     killed and those directories are swept. Ownership is established by this
//     invocation's unique `hw-verify-st<8 hex>-` prefix (exported to the
//     verifier through VERIFY_USER_DATA_DIR_PREFIX), never by age and never by
//     the generic `hw-verify-` pattern -- a concurrent run started in another
//     terminal has a different prefix and is untouchable by us;
//   - every cleanup failure is reported as one clear `[cleanup] LEFT BEHIND: ...`
//     line (or as a `- cleanup: ...` assertion line) naming what survived and
//     where it is; nothing is swallowed, and the exit-code semantics are the
//     ones already documented below (0/1 for assertions, 130 for a signal);
//   - an overall timeout guarantees the harness can never hang.

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'scripts', 'fixtures', 'csp-blocked-fixture.mjs');
const VERIFIER = path.join(ROOT, 'scripts', 'verify-deployment.mjs');

// --- ownership of Chrome user-data-dirs -------------------------------------
// Everything this harness sweeps or kills is keyed off this prefix and nothing
// else. It is random per invocation, so:
//   - a normal `npm run verify:prod` in another terminal creates
//     `hw-verify-` + 6 mkdtemp chars, which can never carry this prefix (6
//     chars cannot cover `st` + 8 hex + `-`), so it is invisible to us;
//   - a second concurrent selftest gets its own prefix, so the two never
//     overlap either.
const OWN_USER_DATA_DIR_PREFIX = `hw-verify-st${randomBytes(4).toString('hex')}-`;
// The prefix reaches Chrome only through the environment (cdp.mjs reads it),
// never through an argv of ours, so no process we own can match it by cmdline.
process.env.VERIFY_USER_DATA_DIR_PREFIX = OWN_USER_DATA_DIR_PREFIX;
// Indirection for the Windows enumerator: passing the value inside the child's
// environment keeps it out of that child's own command line, so the enumerator
// can never match (and kill) itself.
const OWN_PREFIX_ENV_KEY = 'HW_SELFTEST_OWN_PREFIX';
// Single-quoted PS format string on purpose: no double quotes anywhere in the
// command, so it survives both CreateProcess argument quoting (node) and
// PowerShell's own native-command quoting intact.
const PS_LIST_OWN_PROCESSES =
  'Get-CimInstance Win32_Process -Property ProcessId,CommandLine | ' +
  'Where-Object { $_.CommandLine -and $_.CommandLine.Contains($env:' +
  OWN_PREFIX_ENV_KEY +
  ") } | ForEach-Object { '{0}|{1}' -f $_.ProcessId, $_.CommandLine }";
const OWN_KILL_TIMEOUT_MS = 5_000;
// ---------------------------------------------------------------------------

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
  // Baseline taken before this run spawns anything. It is a second, redundant
  // guard on top of the unique prefix: a directory that already existed when
  // we started is by definition not ours to remove.
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

// Kill the tree rooted at `child`. This is called on EVERY cleanup path,
// including when `child` has already exited: a dead child says nothing about
// its descendants (on Windows they are re-parented and keep running), so
// cleanup never skips reaping just because the child is gone.
//
//   - POSIX: the child is a process-group leader and the group survives its
//     leader as long as any member lives, so `kill(-pgid)` still reaches the
//     stragglers. Unguarded by design.
//   - Windows: `taskkill /T` can only walk down from a LIVE root. Running it
//     against an already-exited pid cannot reach the descendants at all (the
//     parent-child chain died with the root) and would kill an unrelated tree
//     if that pid had already been recycled. Descendants of a dead root are
//     therefore reaped by reapOwnedUserDataDirProcesses(), which matches on
//     this invocation's unique user-data-dir prefix and runs unconditionally on
//     every path -- including this one.
function killTree(child) {
  if (!child || !child.pid) return;
  if (process.platform === 'win32') {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try {
      // /T kills the whole tree so the verifier's Chrome dies with it.
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
    }
    return;
  }
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }
}

function userDataDirFromCommandLine(cmdline) {
  const m = /--user-data-dir=(?:"([^"]+)"|(\S+))/.exec(String(cmdline ?? ''));
  return m ? m[1] || m[2] : null;
}

// Live processes whose command line embeds this invocation's user-data-dir
// prefix. Only Chrome ever carries that string (it arrives as
// `--user-data-dir=<tmpdir>/<prefix>...`); our own argv never does.
function listOwnedUserDataDirProcesses() {
  const processes = [];
  let failure = null;
  try {
    if (process.platform === 'win32') {
      const res = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS_LIST_OWN_PROCESSES], {
        env: { ...process.env, [OWN_PREFIX_ENV_KEY]: OWN_USER_DATA_DIR_PREFIX },
        encoding: 'utf8',
        timeout: 20_000,
        windowsHide: true,
      });
      if (res.error) failure = res.error.message;
      else if (res.status !== 0) {
        failure = `powershell exited ${res.status}: ${String(res.stderr ?? '').trim().slice(0, 200)}`;
      } else {
        for (const line of String(res.stdout ?? '').split(/\r?\n/)) {
          const m = /^(\d+)\|([\s\S]*)$/.exec(line.trim());
          if (m) remember(processes, Number(m[1]), m[2]);
        }
      }
    } else {
      const res = spawnSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8', timeout: 20_000 });
      if (res.error) failure = res.error.message;
      else if (res.status !== 0) failure = `ps exited ${res.status}: ${String(res.stderr ?? '').trim().slice(0, 200)}`;
      else {
        for (const line of String(res.stdout ?? '').split('\n')) {
          if (!line.includes(OWN_USER_DATA_DIR_PREFIX)) continue;
          const m = /^\s*(\d+)\s+([\s\S]*)$/.exec(line);
          if (m) remember(processes, Number(m[1]), m[2]);
        }
      }
    }
  } catch (err) {
    failure = err?.message ?? String(err);
  }
  return { processes, failure };
}

function remember(into, pid, cmdline) {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return;
  into.push({ pid, userDataDir: userDataDirFromCommandLine(cmdline) });
}

function killProcesses(processes) {
  for (const { pid } of processes) {
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], {
          stdio: 'ignore',
          timeout: 15_000,
          windowsHide: true,
        });
      } else {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          /* already gone */
        }
      }
    } catch {
      /* re-checked by the caller */
    }
  }
}

// Unconditional reaping of this run's own Chrome, independent of whether the
// verifier is alive. This is what makes "the child already exited" safe: the
// child's state never gates this function.
async function reapOwnedUserDataDirProcesses() {
  const problems = [];
  const first = listOwnedUserDataDirProcesses();
  if (first.failure) {
    problems.push(
      `could not enumerate processes holding a ${OWN_USER_DATA_DIR_PREFIX}* user-data-dir: ${first.failure}`
    );
    return problems;
  }
  killProcesses(first.processes);
  let remaining = first.processes;
  const deadline = Date.now() + OWN_KILL_TIMEOUT_MS;
  while (remaining.length > 0 && Date.now() < deadline) {
    await sleep(200);
    const next = listOwnedUserDataDirProcesses();
    if (next.failure) {
      problems.push(
        `could not re-check processes holding a ${OWN_USER_DATA_DIR_PREFIX}* user-data-dir: ${next.failure}`
      );
      return problems;
    }
    remaining = next.processes;
    killProcesses(remaining);
  }
  for (const p of remaining) {
    problems.push(
      `Chrome still running for our user-data-dir ${p.userDataDir ?? OWN_USER_DATA_DIR_PREFIX} (pid ${p.pid})`
    );
  }
  return problems;
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

async function sweepOwnUserDataDirs(baseline) {
  const problems = [];
  let names = [];
  try {
    names = readdirSync(tmpdir());
  } catch (err) {
    problems.push(`could not list ${tmpdir()}: ${err.message}`);
    return problems;
  }
  for (const name of names) {
    // Ownership, and nothing else: only directories carrying this invocation's
    // unique prefix are candidates, and only if they were not already here when
    // the baseline was taken. We never remove a directory we did not create --
    // not by age, not by the generic `hw-verify-` pattern, not by mtime.
    if (!name.startsWith(OWN_USER_DATA_DIR_PREFIX) || baseline.has(name)) continue;
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

  // Unconditional, whether or not either child is still alive. killTree() no
  // longer skips a child that already exited, and reapOwnedUserDataDirProcesses()
  // does not consult child state at all.
  killTree(verifierProc);
  killTree(fixtureProc);
  await whenExited(verifierProc);
  await whenExited(fixtureProc);
  problems.push(...(await reapOwnedUserDataDirProcesses()));

  if (fixturePort !== null && !(await waitForPortFree(fixturePort))) {
    problems.push(`port ${fixturePort} is still occupied after killing the fixture`);
  }

  problems.push(...(await sweepOwnUserDataDirs(baselineDirs)));

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

// Cleanup failures are never swallowed. One line per leftover, naming what
// survived and where it is. The async paths can use stdout; the process 'exit'
// handler cannot (stdout may already be draining), so it writes to fd 2
// synchronously instead.
function reportCleanupProblems(problems) {
  for (const problem of problems) {
    process.stdout.write(`[cleanup] LEFT BEHIND: ${problem}\n`);
  }
}

function reportCleanupProblemsSync(problems) {
  for (const problem of problems) {
    try {
      writeSync(2, `[cleanup] LEFT BEHIND: ${problem}\n`);
    } catch {
      /* fd already closed; nothing left to write to */
    }
  }
}

// Last-resort synchronous cleanup: runs even on process 'exit' (uncaught
// exception, forced exit) when async cleanup never got the chance. Anything it
// cannot remove is reported, not swallowed. Once async cleanup has run
// (cleanedUp) it has already reported its own leftovers, so this only backfills
// the temp dir, which it still tries to remove.
process.on('exit', () => {
  if (cleanedUp) {
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        /* already reported by the async pass if it is still there */
      }
      tempDir = null;
    }
    return;
  }
  cleanedUp = true;
  const problems = [];
  killTree(verifierProc);
  killTree(fixtureProc);
  try {
    const { processes, failure } = listOwnedUserDataDirProcesses();
    if (failure) {
      problems.push(
        `could not enumerate processes holding a ${OWN_USER_DATA_DIR_PREFIX}* user-data-dir: ${failure}`
      );
    } else {
      killProcesses(processes);
      for (const p of processes) {
        problems.push(
          `Chrome still running for our user-data-dir ${p.userDataDir ?? OWN_USER_DATA_DIR_PREFIX} (pid ${p.pid})`
        );
      }
    }
    for (const name of readdirSync(tmpdir())) {
      if (!name.startsWith(OWN_USER_DATA_DIR_PREFIX) || baselineDirs.has(name)) continue;
      const dir = path.join(tmpdir(), name);
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* reported below if it is still there */
      }
      if (existsSync(dir)) problems.push(`leftover Chrome user-data-dir not removable: ${dir}`);
    }
  } catch (err) {
    problems.push(`synchronous cleanup could not run: ${err?.message ?? String(err)}`);
  }
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* reported below */
    }
    if (existsSync(tempDir)) problems.push(`temp dir not removable: ${tempDir}`);
    tempDir = null;
  }
  reportCleanupProblemsSync(problems);
});

const signalHandler = (signal) => async () => {
  if (aborting) return;
  aborting = true;
  process.stdout.write(`\n[signal] ${signal} received -- cleaning up before exit\n`);
  // The signal path has no assertion list to carry cleanup problems, so they
  // are printed here. The exit code stays 130 -- a cleanup failure is reported,
  // never silently folded into a different code.
  const problems = await cleanup();
  reportCleanupProblems(problems);
  if (problems.length === 0) {
    process.stdout.write('[cleanup] clean: no leftovers\n');
  }
  finish(130);
};
process.on('SIGINT', signalHandler('SIGINT'));
process.on('SIGTERM', signalHandler('SIGTERM'));

async function main() {
  process.stdout.write(
    'verify:selftest -- negative control for scripts/verify-deployment.mjs\n' +
      '  INVERSION: this selftest PASSES (exit 0) only when the CHECKER FAILS (exit != 0).\n' +
      `  overall timeout: ${OVERALL_TIMEOUT_MS} ms\n` +
      `  own user-data-dir prefix: ${OWN_USER_DATA_DIR_PREFIX} (only these dirs/processes are ever removed)\n`
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
  // On this path every problem is both printed (as its own `- cleanup: ...`
  // line, which names the leftover and its path) and turned into a failed
  // assertion, so a cleanup failure fails the run rather than passing quietly.
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
  const problems = await cleanup();
  reportCleanupProblems(problems);
  for (const problem of problems) {
    process.stdout.write(`  - cleanup: ${problem}\n`);
  }
  finish(1);
});

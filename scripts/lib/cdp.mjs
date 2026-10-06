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

// Ownership of the temp profile dir. The selftest gives its own runs a unique
// prefix here so it can identify -- and only ever remove -- the user-data-dirs
// it created itself (see scripts/verify-selftest.mjs). Nothing sets it, so the
// name stays exactly what it has always been.
function userDataDirPrefix() {
  const raw = process.env.VERIFY_USER_DATA_DIR_PREFIX;
  return typeof raw === 'string' && raw.length > 0 && !/[\\/]/.test(raw) ? raw : 'hw-verify-';
}

async function removeUserDataDirWithRetry(userDataDir, attempts = 5, delayMs = 100) {
  for (let i = 0; i < attempts; i++) {
    try {
      rmSync(userDataDir, { recursive: true, force: true });
      return true;
    } catch (err) {
      if (i === attempts - 1) {
        console.error(`[verify] Failed to remove user-data-dir after ${attempts} attempts: ${userDataDir}`);
        console.error(`[verify] Last error: ${err?.message ?? err}`);
        return false;
      }
      await sleep(delayMs);
    }
  }
  return false;
}

export async function launchChrome({ port = 9333 } = {}) {
  const chromePath = resolveChrome();
  let userDataDir;
  let proc;
  try {
    userDataDir = mkdtempSync(path.join(tmpdir(), userDataDirPrefix()));
  } catch (err) {
    throw new Error(`Failed to create temp user-data-dir: ${err?.message ?? err}`);
  }
  try {
    proc = spawn(
      chromePath,
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
  } catch (err) {
    await removeUserDataDirWithRetry(userDataDir);
    throw err;
  }
  let wsUrl;
  try {
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
  } catch (err) {
    try {
      proc.kill();
    } catch {}
    await removeUserDataDirWithRetry(userDataDir);
    throw err;
  }
  const exitHandlers = new Set();
  proc.on('exit', () => {
    for (const h of exitHandlers) {
      try { h(); } catch {}
    }
    exitHandlers.clear();
  });
  return {
    proc,
    wsUrl,
    port,
    userDataDir,
    cleanup: async () => {
      try {
        proc.kill();
      } catch {
        /* already gone */
      }
      await removeUserDataDirWithRetry(userDataDir);
    },
    onExit: (h) => {
      exitHandlers.add(h);
      return () => exitHandlers.delete(h);
    },
  };
}

export async function connectCdp(wsUrl, { onBrowserExit } = {}) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let seq = 0;
  const pending = new Map();
  const listeners = new Set();
  const rejectAll = (err) => {
    for (const { reject } of pending.values()) {
      try { reject(err); } catch {}
    }
    pending.clear();
  };
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
  ws.addEventListener('close', () => {
    rejectAll(new Error('CDP WebSocket closed'));
  });
  ws.addEventListener('error', (e) => {
    rejectAll(new Error(`CDP WebSocket error: ${e.message || e}`));
  });
  if (onBrowserExit) {
    onBrowserExit(() => {
      rejectAll(new Error('Chrome process exited'));
    });
  }
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
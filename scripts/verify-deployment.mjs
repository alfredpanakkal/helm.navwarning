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

// CDP reports the document url normalized (`http://host:port` arrives as
// `http://host:port/`). Compare normalized.
const docUrl = (u) => {
  try {
    return new URL(u).href;
  } catch {
    return u;
  }
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
      if (msg.params.type === 'Document' && docUrl(url) === docUrl(TARGET)) {
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
  // The KNOWN_MISSING allowlist must not turn this into a vacuous pass: if every
  // 4xx we saw was allowlisted, say so instead of reporting a clean bill of health.
  const badDetail =
    realBad.length > 0
      ? realBad.slice(0, 4).map((r) => `${r.status} ${r.url}`).join(' | ')
      : badResponses.length > 0
        ? `${badResponses.length} response(s), all matched known-missing paths: ${badResponses
            .slice(0, 4)
            .map((r) => `${r.status} ${r.url}`)
            .join(' | ')}`
        : '';
  check('no unexpected HTTP 4xx/5xx', realBad.length === 0, badDetail, 'warn');

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
  const tag = c.severity === 'warn' ? 'WARN' : c.ok ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${c.name}${c.detail ? `  -- ${c.detail}` : ''}`);
}
console.log(`\n${checks.length - failed.length}/${checks.length} passed${exitCode ? ' (FAILED)' : ''}`);

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ target: TARGET, when: new Date().toISOString(), csp, tiles, checks, exitCode }, null, 2));
}
process.exit(exitCode);
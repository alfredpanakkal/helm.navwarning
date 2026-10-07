/**
 * Task 8 (UX information hierarchy) - visual density probe.
 *
 * Counts simultaneously visible borders / boxes on the main public surfaces so
 * the border-hierarchy work can be measured before and after (acceptance:
 * ~30-40% fewer strong borders and competing boxes). Text-only output: no
 * screenshots are taken, so the 40-screenshot budget and the frozen Task-1
 * baselines are untouched.
 *
 * Counting rules (identical for before and after):
 *   - Only elements that intersect the 1440x900 viewport, are at least 12x12 px
 *     (icon-scale decorations such as 6px select carets are glyphs, not boxes)
 *     and are not display:none / visibility:hidden / opacity:0 are counted
 *     (-simultaneous- = on screen at the same moment).
 *   - The Leaflet canvas subtree (#map) is excluded: tile, marker and Leaflet
 *     control chrome is outside this task's scope.
 *   - bordered   : >= 1 computed border side with width >= 1px, style != none.
 *   - strong     : bordered AND visible as an outline - WCAG contrast ratio
 *                  >= 3:1 between the (alpha-composited) border colour and the
 *                  effective background (own opaque bg, else nearest ancestor),
 *                  OR any side >= 2px at ratio >= 1.5:1. This keeps dark-on-dark
 *                  chrome lines and hairline tinted chips out of -strong-.
 *   - hardShadow : box-shadow with a >= 1px offset and 0 blur (the hard
 *                  -sticker- shadows: 4px 4px 0 ...). Soft shadow-xs/sm/md
 *                  glows are not competing boxes.
 *   - boxes      : strong OR hardShadow (a competing visual container).
 *
 * Usage (server must already be running: `npm run dev:audit` on :3000):
 *   npx tsx scripts/ux-audit/density-probe.ts [outfile]
 *   outfile defaults to docs/ux-audit/dom/v2-density-after.txt
 */
import { chromium, type Page } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOM = path.join(ROOT, 'docs', 'ux-audit', 'dom');
const BEFORE = path.join(DOM, 'v2-density-before.txt');
const LOCAL = 'http://localhost:3000';
const DESKTOP = { width: 1440, height: 900 };

type Counts = { bordered: number; strong: number; hardShadow: number; boxes: number };

/** Evaluated in the page. Kept as a string payload (tsx/esbuild toolchain). */
export const COUNT_SCRIPT = `(() => {
  const parseColor = (c) => {
    if (!c) return null;
    const t = String(c).trim().toLowerCase();
    if (t === 'none' || t === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    const nums = (s) => s.split(/[\\s,\\/]+/).filter(Boolean).map(parseFloat).filter((v) => !Number.isNaN(v));
    if (t.charAt(0) === '#') {
      const h = t.slice(1);
      if (h.length === 3 || h.length === 4) {
        return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: h.length === 4 ? parseInt(h[3], 16) / 255 : 1 };
      }
      if (h.length === 6 || h.length === 8) {
        return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
      }
      return null;
    }
    const open = t.indexOf('(');
    if (open < 0) return null;
    const name = t.slice(0, open);
    const inner = t.slice(open + 1, t.lastIndexOf(')'));
    const p = nums(inner);
    if (name === 'rgb' || name === 'rgba') {
      if (p.length < 3) return null;
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    if (name === 'hsl' || name === 'hsla') {
      if (p.length < 3) return null;
      const h = p[0] % 360, s = p[1] / 100, l = p[2] / 100;
      const k = (n) => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255, a: p.length > 3 ? p[3] : 1 };
    }
    if (name === 'oklch' || name === 'oklab') {
      if (p.length < 3) return null;
      const L = p[0] > 1 ? p[0] / 100 : p[0];
      let aa, bb;
      if (name === 'oklch') {
        const C = p[1], H = p[2] * Math.PI / 180;
        aa = C * Math.cos(H);
        bb = C * Math.sin(H);
      } else {
        aa = p[1];
        bb = p[2];
      }
      const l_ = L + 0.3963377774 * aa + 0.2158037573 * bb;
      const m_ = L - 0.1055613458 * aa - 0.0638541728 * bb;
      const s_ = L - 0.0894841775 * aa - 1.2914855480 * bb;
      const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
      const lin = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
      ];
      const gam = (v) => {
        v = Math.min(1, Math.max(0, v));
        return (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255;
      };
      return { r: gam(lin[0]), g: gam(lin[1]), b: gam(lin[2]), a: p.length > 3 ? p[3] : 1 };
    }
    if (name === 'color') {
      const parts = inner.split(/[\\s,\\/]+/).filter(Boolean);
      const mode = parts.shift();
      const q = parts.map(parseFloat);
      if (q.length < 3) return null;
      if (mode === 'srgb') return { r: q[0] * 255, g: q[1] * 255, b: q[2] * 255, a: q.length > 3 ? q[3] : 1 };
      if (mode === 'srgb-linear') return { r: Math.pow(q[0], 1 / 2.2) * 255, g: Math.pow(q[1], 1 / 2.2) * 255, b: Math.pow(q[2], 1 / 2.2) * 255, a: q.length > 3 ? q[3] : 1 };
      return null;
    }
    return null;
  };
  const lumOf = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const over = (fg, bg) => ({
    r: fg.a * fg.r + (1 - fg.a) * bg.r,
    g: fg.a * fg.g + (1 - fg.a) * bg.g,
    b: fg.a * fg.b + (1 - fg.a) * bg.b,
    a: 1,
  });
  const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  const effBg = (el) => {
    let node = el;
    let translucent = null;
    while (node && node.nodeType === 1) {
      const c = parseColor(getComputedStyle(node).backgroundColor);
      if (c && c.a >= 0.85) return translucent ? over(translucent, c) : c;
      if (c && c.a > 0) translucent = translucent ? over(translucent, c) : c;
      node = node.parentElement;
    }
    return translucent || { r: 255, g: 255, b: 255, a: 1 };
  };
  const inView = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 12 || r.height < 12) return false;
    if (r.bottom <= 0 || r.top >= window.innerHeight) return false;
    if (r.right <= 0 || r.left >= window.innerWidth) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) < 0.05) return false;
    return true;
  };
  let bordered = 0, strong = 0, hardShadow = 0, boxes = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('#map')) continue;
    if (!inView(el)) continue;
    const cs = getComputedStyle(el);
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs['border' + s + 'Width']) || 0);
    const style = cs.borderTopStyle;
    const hasBorder = style !== 'none' && sides.some((w) => w >= 1);
    const shadow = cs.boxShadow === 'none' ? '' : cs.boxShadow;
    const sm = shadow.match(/(-?[\\d.]+)px\\s+(-?[\\d.]+)px\\s+(-?[\\d.]+)px/);
    const isHard =
      !!sm && parseFloat(sm[3]) === 0 && (parseFloat(sm[1]) !== 0 || parseFloat(sm[2]) !== 0);
    let isStrong = false;
    if (hasBorder) {
      bordered++;
      const bg = effBg(el);
      const bgLum = lumOf(bg);
      const border = parseColor(cs.borderTopColor);
      const composed = border && border.a < 1 ? over(border, bg) : border;
      const cr = composed ? ratio(lumOf(composed), bgLum) : 0;
      const maxSide = Math.max.apply(null, sides);
      isStrong = cr >= 3 || (maxSide >= 2 && cr >= 1.5);
      if (isStrong) strong++;
    }
    if (isHard) hardShadow++;
    if (isStrong || isHard) boxes++;
  }
  return { bordered, strong, hardShadow, boxes };
})()`;

async function open(page: Page, classic: boolean, tab?: 'Data Bank' | 'Sources') {
  if (classic) {
    await page.addInitScript(() => localStorage.setItem('hwUI', 'classic'));
  }
  await page.goto(LOCAL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('#main-content', { timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
  if (tab) {
    await page.getByRole('tab', { name: new RegExp(`^${tab}`, 'i') }).click();
    await page.waitForTimeout(800);
  }
}

async function measure(page: Page): Promise<Counts> {
  return (await page.evaluate(COUNT_SCRIPT)) as Counts;
}

const fmt = (name: string, c: Counts) =>
  `state: ${name} bordered=${c.bordered} strong=${c.strong} hardShadow=${c.hardShadow} boxes=${c.boxes}`;

const HEADER = [
  'Task 8 - visual density probe (border/box inventory, viewport 1440x900)',
  'tooling: scripts/ux-audit/density-probe.ts (Playwright Chromium, computed styles)',
  'rules: visible elements intersecting the viewport, >=12x12px (smaller are',
  '        glyphs, not boxes), excluding the #map subtree;',
  '        bordered = any side >=1px; strong = WCAG contrast >=3:1 between the',
  '        alpha-composited border colour and the effective background, or a',
  '        >=2px side at >=1.5:1; hardShadow = offset shadow with 0 blur;',
  '        boxes = strong or hardShadow (a competing visual container).',
  '',
].join('\n');

function parseBefore(): Map<string, Counts> {
  const map = new Map<string, Counts>();
  if (!existsSync(BEFORE)) return map;
  for (const line of readFileSync(BEFORE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^state: (\S+) bordered=(\d+) strong=(\d+) hardShadow=(\d+) boxes=(\d+)$/);
    if (m) map.set(m[1], { bordered: +m[2], strong: +m[3], hardShadow: +m[4], boxes: +m[5] });
  }
  return map;
}

async function main() {
  const out = path.resolve(process.argv[2] ?? path.join(DOM, 'v2-density-after.txt'));
  mkdirSync(DOM, { recursive: true });
  const browser = await chromium.launch();
  const lines: string[] = [];
  const rows: Array<[string, Counts]> = [];

  const record = async (name: string, page: Page) => {
    const c = await measure(page);
    rows.push([name, c]);
    console.log('  ' + fmt(name, c));
  };

  // 1. Map View (default drawer open) - shared chrome on both paths.
  {
    const page = await browser.newPage({ viewport: DESKTOP });
    await open(page, false);
    await page.waitForSelector('aside', { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(600);
    await record('map-default', page);
    await page.close();
  }

  // 2-3. Data Bank v2: default + More filters expanded.
  {
    const page = await browser.newPage({ viewport: DESKTOP });
    await open(page, false, 'Data Bank');
    await page.waitForSelector('#databank-table-header', { timeout: 30_000 });
    await page.waitForTimeout(500);
    await record('databank-v2-default', page);
    await page.getByRole('button', { name: /^More filters$/ }).click();
    await page.waitForTimeout(400);
    await record('databank-v2-more-filters', page);
    await page.close();
  }

  // 4. Data Bank classic path.
  {
    const page = await browser.newPage({ viewport: DESKTOP });
    await open(page, true, 'Data Bank');
    await page.waitForSelector('#databank-table-header', { timeout: 30_000 });
    await page.waitForTimeout(500);
    await record('databank-classic-default', page);
    await page.close();
  }

  // 5-6. Sources v2: summary + details expanded.
  {
    const page = await browser.newPage({ viewport: DESKTOP });
    await open(page, false, 'Sources');
    await page.waitForTimeout(500);
    await record('sources-v2-summary', page);
    await page.getByRole('button', { name: 'View source details' }).click();
    await page.waitForTimeout(600);
    await record('sources-v2-details', page);
    await page.close();
  }

  // 7. Sources classic path.
  {
    const page = await browser.newPage({ viewport: DESKTOP });
    await open(page, true, 'Sources');
    await page.waitForTimeout(500);
    await record('sources-classic', page);
    await page.close();
  }

  await browser.close();

  const total = rows.reduce(
    (acc, [, c]) => ({
      bordered: acc.bordered + c.bordered,
      strong: acc.strong + c.strong,
      hardShadow: acc.hardShadow + c.hardShadow,
      boxes: acc.boxes + c.boxes,
    }),
    { bordered: 0, strong: 0, hardShadow: 0, boxes: 0 }
  );
  lines.push(HEADER);
  lines.push(...rows.map(([n, c]) => fmt(n, c)));
  lines.push(
    `total: bordered=${total.bordered} strong=${total.strong} hardShadow=${total.hardShadow} boxes=${total.boxes}`
  );

  const before = parseBefore();
  if (before.size > 0 && path.resolve(BEFORE) !== out) {
    lines.push('', '--- delta vs docs/ux-audit/dom/v2-density-before.txt ---');
    let bTot = { bordered: 0, strong: 0, hardShadow: 0, boxes: 0 };
    let matched = 0;
    for (const [name, b] of before) {
      const a = rows.find(([n]) => n === name)?.[1];
      if (!a) continue;
      matched++;
      bTot = {
        bordered: bTot.bordered + b.bordered,
        strong: bTot.strong + b.strong,
        hardShadow: bTot.hardShadow + b.hardShadow,
        boxes: bTot.boxes + b.boxes,
      };
      const pct = (x: number, y: number) => (y === 0 ? 'n/a' : `${(((y - x) / y) * 100).toFixed(1)}%`);
      lines.push(
        `state: ${name} strong ${b.strong} -> ${a.strong} (-${pct(a.strong, b.strong).replace('%', '')}%) | boxes ${b.boxes} -> ${a.boxes} (-${pct(a.boxes, b.boxes).replace('%', '')}%)`
      );
    }
    if (matched === before.size) {
      const pct = (x: number, y: number) => (y === 0 ? 'n/a' : `${(((y - x) / y) * 100).toFixed(1)}%`);
      lines.push(
        `TOTAL (matched states): strong ${bTot.strong} -> ${total.strong} (-${pct(total.strong, bTot.strong)}) | boxes ${bTot.boxes} -> ${total.boxes} (-${pct(total.boxes, bTot.boxes)}) | bordered ${bTot.bordered} -> ${total.bordered} (-${pct(total.bordered, bTot.bordered)})`
      );
    } else {
      lines.push(`WARNING: only ${matched}/${before.size} baseline states matched`);
    }
  }

  writeFileSync(out, lines.join('\n') + '\n', 'utf8');
  console.log(`density probe written: ${path.relative(ROOT, out)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

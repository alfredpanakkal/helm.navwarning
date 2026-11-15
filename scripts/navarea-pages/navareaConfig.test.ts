// scripts/navarea-pages/navareaConfig.test.ts
// Route matrix + page invariants for the 21 prerendered NAVAREA regional
// pages, the source-registry hub and the warning detail pages
// (Step 1 + Source Registry + Step 2).
import { describe, expect, it } from 'vitest';
import {
  NAVAREA_REGIONS, VALID_IDS, SITE_URL,
  isValidNavareaId, navareaCode, canonicalPath, navareaMapHref,
  normalizeStoredNavarea, belongsToNavarea, buildPageHtml, buildAboutPageHtml,
  feedStatus, FEED_STATUS,
  warningSlug, warningDetailPath, buildWarningPageHtml, buildWarningShellHtml,
  buildSitemapXml,
} from './navareaConfig.mjs';

const EXPECTED_IDS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'];

describe('NAVAREA regional routes and configuration', () => {
  it('defines exactly the 21 canonical NAVAREA identifiers', () => {
    expect(NAVAREA_REGIONS).toHaveLength(21);
    expect(VALID_IDS).toEqual(EXPECTED_IDS);
    expect(new Set(VALID_IDS).size).toBe(21);
    for (const r of NAVAREA_REGIONS) {
      expect(r.shortLabel.length).toBeGreaterThan(0);
      expect(r.waters.length).toBeGreaterThan(0);
      expect(r.authority.length).toBeGreaterThan(0);
      expect(['automated', 'restricted', 'manual']).toContain(r.ingest);
      if (r.ingest === 'automated') {
        expect(typeof r.sourceUrl).toBe('string');
        expect(r.sourceUrl.indexOf('https://')).toBe(0);
        expect(r.sourceLabel.length).toBeGreaterThan(0);
      } else if (r.ingest === 'manual') {
        expect(r.sourceUrl).toBeUndefined();
      }
    }
  });

  it('classifies ingestion reliability per region', () => {
    const byId = Object.fromEntries(NAVAREA_REGIONS.map((r) => [r.id, r.ingest]));
    expect(byId).toEqual({
      I: 'automated', II: 'manual', III: 'automated', IV: 'automated', V: 'restricted',
      VI: 'manual', VII: 'automated', VIII: 'automated', IX: 'automated', X: 'automated',
      XI: 'automated', XII: 'automated', XIII: 'restricted', XIV: 'manual', XV: 'manual',
      XVI: 'manual', XVII: 'manual', XVIII: 'manual', XIX: 'automated', XX: 'restricted', XXI: 'restricted'
    });
  });

  it('builds the canonical /navarea/:id route inventory', () => {
    expect(canonicalPath('I')).toBe('/navarea/I');
    expect(canonicalPath('XXI')).toBe('/navarea/XXI');
    for (const r of NAVAREA_REGIONS) {
      expect(canonicalPath(r.id)).toBe('/navarea/' + r.id);
    }
  });

  it('maps ids to the navarea codes stored in nav_warnings', () => {
    expect(navareaCode('I')).toBe('NA I');
    expect(navareaCode('XXI')).toBe('NA XXI');
    expect(navareaMapHref('IV')).toBe('/?navarea=NA%20IV');
  });

  it('accepts only the 21 valid identifiers', () => {
    for (const id of EXPECTED_IDS) {
      expect(isValidNavareaId(id)).toBe(true);
    }
    expect(isValidNavareaId('XXII')).toBe(false);
    expect(isValidNavareaId('i')).toBe(false);
    expect(isValidNavareaId('')).toBe(false);
    expect(isValidNavareaId(7)).toBe(false);
  });

  it('normalizes stored navarea values to canonical ids', () => {
    expect(normalizeStoredNavarea('NA I')).toBe('I');
    expect(normalizeStoredNavarea('I')).toBe('I');
    expect(normalizeStoredNavarea('NAVAREA I')).toBe('I');
    expect(normalizeStoredNavarea('na xii')).toBe('XII');
    expect(normalizeStoredNavarea('NAVAREA IV')).toBe('IV');
    expect(normalizeStoredNavarea('XXII')).toBeNull();
    expect(normalizeStoredNavarea('')).toBeNull();
    expect(normalizeStoredNavarea(null)).toBeNull();
  });

  it('never attributes a warning to the wrong region', () => {
    expect(belongsToNavarea({ navarea: 'NA IV' }, 'IV')).toBe(true);
    expect(belongsToNavarea({ navarea: 'na iv' }, 'IV')).toBe(true);
    expect(belongsToNavarea({ navarea: 'NA V' }, 'IV')).toBe(false);
    expect(belongsToNavarea({ navarea: null }, 'IV')).toBe(false);
    expect(belongsToNavarea(null, 'IV')).toBe(false);
    expect(belongsToNavarea({ navarea: 'NA IV' }, 'XXII')).toBe(false);
  });

  it('renders each page with exactly one H1, its own metadata and breadcrumb links', () => {
    for (const r of NAVAREA_REGIONS) {
      const html = buildPageHtml(r);
      expect(html.split('<h1').length - 1).toBe(1);
      expect(html).toContain('<title>NAVAREA ' + r.id + ' Navigational Warnings | Helm.Warning</title>');
      expect(html).toContain('rel="canonical" href="' + SITE_URL + '/navarea/' + r.id + '"');
      expect(html).toContain('href="/?navarea=NA%20' + r.id + '"');
      expect(html).toContain('class="nav-tab stacked active" href="/" aria-current="page"');
      expect(html).toContain('<span>HELM.WARNING</span>');
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain('{"id":"' + r.id + '","code":"NA ' + r.id + '"}');
      expect(html).toContain('Ingestion status: <strong>' + feedStatus(r.id).label + '</strong>');
      expect(html).toContain('id="dataStatus"');
      if (r.sourceUrl) {
        expect(html).toContain('Official source: <a href="' + r.sourceUrl + '" target="_blank" rel="noopener noreferrer">' + r.sourceLabel + '</a>');
      }
      for (const o of NAVAREA_REGIONS) {
        expect(html).toContain('href="/navarea/' + o.id + '"');
      }
    }
  });

  it('renders the combined /about page with the full source registry and settings', () => {
    const html = buildAboutPageHtml();
    expect(html.split('<h1').length - 1).toBe(1);
    expect(html).toContain('<title>About Helm.Warning | NAVAREA Source Registry &amp; Maritime Safety Information</title>');
    expect(html).toContain('rel="canonical" href="' + SITE_URL + '/about"');
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('id="source-registry"');
    // The combined page keeps the watch-theme settings.
    expect(html).toContain('class="theme-picker"');
    expect(html).toContain('class="nav-tab stacked active" href="/?tab=info" aria-current="page"');
    expect(html).toContain('<span>HELM.WARNING</span>');
    expect(html).toContain('data-theme-set="light"');
    expect(html).toContain("localStorage.getItem('hw-theme')");
    // And the safety disclaimer.
    expect(html).toContain('Important Safety Disclaimer');
    expect(html).toContain('not an official source of Maritime Safety Information');
    for (const r of NAVAREA_REGIONS) {
      expect(html).toContain('class="source-card" href="/navarea/' + r.id + '"');
      expect(html).toContain('<span class="source-id">NAVAREA ' + r.id + '</span>');
      expect(html).toContain('<span class="source-label">' + r.shortLabel + '</span>');
      expect(html).toContain('<span class="source-authority">Coordinator: ' + r.authority + '</span>');
      expect(html).toContain('<span class="feed-badge ' + feedStatus(r.id).badge + '">' + feedStatus(r.id).label + '</span>');
      if (r.sourceUrl) {
        expect(html).toContain('<p class="source-portal">Source: <a href="' + r.sourceUrl + '" target="_blank" rel="noopener noreferrer">' + r.sourceLabel + '</a></p>');
      }
    }
    // The page is fully static: no client-side hydration hooks.
    expect(html).not.toContain('id="warningList"');
    expect(html).not.toContain('navarea-page.js');
    expect(html).not.toContain('id="navareaPageConfig"');
    expect((html.match(/class="source-portal"/g) || []).length).toBe(11);
    expect(html).toContain('Automated feeds: <strong>10</strong>');
    expect(html).toContain('Not reliable / restricted: <strong>4</strong>');
    expect(html).toContain('Manual entry only: <strong>7</strong>');
    // The merged page no longer references the retired /sources route.
    expect(html).not.toContain('href="/sources"');
  });

  it('builds a sitemap covering homepage, about and all 21 regional pages', () => {
    const xml = buildSitemapXml('2026-10-25');
    const locs = (xml.match(/<loc>/g) || []).length;
    expect(locs).toBe(23);
    expect(xml).toContain(SITE_URL + '/');
    expect(xml).toContain(SITE_URL + '/about');
    expect(xml).not.toContain(SITE_URL + '/sources');
    for (const r of NAVAREA_REGIONS) {
      expect(xml).toContain(SITE_URL + '/navarea/' + r.id);
    }
  });
});

describe('Warning detail pages', () => {
  it('derives warning slugs from canonical_id regardless of prefix', () => {
    expect(warningSlug('NAVAREA XI 0451/26')).toBe('0451-26');
    expect(warningSlug('NA IV 123/26')).toBe('123-26');
    expect(warningSlug('navarea xix 0648/26')).toBe('0648-26'); // prefix case does not matter
    expect(warningSlug('garbage')).toBeNull();
    expect(warningSlug(null)).toBeNull();
  });

  it('builds stable detail paths under the regional route', () => {
    expect(warningDetailPath('XI', 'NAVAREA XI 0451/26')).toBe('/navarea/XI/warning/0451-26');
    expect(warningDetailPath('IV', 'NA IV 1157/21')).toBe('/navarea/IV/warning/1157-21');
    expect(warningDetailPath('IV', 'no-slug-here')).toBeNull();
    expect(() => warningDetailPath('XXII', 'NAVAREA XXII 1/26')).toThrow();
  });

  it('renders a fully static detail page with escaped original text', () => {
    const w = {
      canonical_id: 'NAVAREA IV 1157/21',
      title: 'Test <light> & buoy',
      raw_text: 'FULL <TEXT> & MORE\n1. LINE TWO',
      status: 'active',
      triage_tier: 'A',
      data_quality: 'EXPLICIT',
      categories: ['aton', 'ops'],
      issued_at: null, valid_from: null, valid_to: null, area_text: 'Gulf of Mexico'
    };
    const html = buildWarningPageHtml(NAVAREA_REGIONS[3], w);
    expect(html.split('<h1').length - 1).toBe(1);
    expect(html).toContain('rel="canonical" href="' + SITE_URL + '/navarea/IV/warning/1157-21"');
    expect(html).toContain('<meta name="robots" content="index, follow">');
    // Complete original text present in the initial HTML, properly escaped.
    expect(html).toContain('FULL &lt;TEXT&gt; &amp; MORE');
    expect(html).not.toContain('FULL <TEXT>');
    expect(html).toContain('href="/navarea/IV"');
    expect(html).toContain('href="/?navarea=NA%20IV"');
    expect(html).toContain('href="/about#source-registry"');
    // No hydration scripts on prerendered detail pages.
    expect(html).not.toContain('supabase');
    expect(html).not.toContain('warning-detail.js');
  });

  it('renders the noindex hydration shell for non-prerendered warnings', () => {
    const html = buildWarningShellHtml();
    expect(html.split('<h1').length - 1).toBe(1);
    expect(html).toContain('<meta name="robots" content="noindex, follow">');
    expect(html).toContain('id="warningDetail"');
    expect(html).toContain('id="emptyState"');
    expect(html).toContain('id="errorState"');
    expect(html).toContain('warning-detail.js');
  });

  it('includes detail URLs in the sitemap when provided', () => {
    const xml = buildSitemapXml('2026-10-25', ['/navarea/XI/warning/0451-26', '/navarea/IV/warning/1157-21']);
    const locs = (xml.match(/<loc>/g) || []).length;
    expect(locs).toBe(25); // 23 base routes (home, about, 21 regions) + 2 detail URLs
    expect(xml).toContain(SITE_URL + '/navarea/XI/warning/0451-26');
    expect(xml).toContain(SITE_URL + '/navarea/IV/warning/1157-21');
  });
});


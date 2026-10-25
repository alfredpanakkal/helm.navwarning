// scripts/navarea-pages/navareaConfig.test.ts
// Route matrix + regional page invariants for the 21 prerendered NAVAREA
// regional pages and the source-registry hub (Step 1 + Source Registry).
import { describe, expect, it } from 'vitest';
import {
  NAVAREA_REGIONS, VALID_IDS, SITE_URL,
  isValidNavareaId, navareaCode, canonicalPath, navareaMapHref,
  normalizeStoredNavarea, belongsToNavarea, buildPageHtml, buildSourcesPageHtml, buildSitemapXml,
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
    }
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
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain('{"id":"' + r.id + '","code":"NA ' + r.id + '"}');
      for (const o of NAVAREA_REGIONS) {
        expect(html).toContain('href="/navarea/' + o.id + '"');
      }
    }
  });

  it('renders the source registry hub with a clickable card for every region', () => {
    const html = buildSourcesPageHtml();
    expect(html.split('<h1').length - 1).toBe(1);
    expect(html).toContain('<title>NAVAREA Source Registry | Helm.Warning</title>');
    expect(html).toContain('rel="canonical" href="' + SITE_URL + '/sources"');
    expect(html).toContain('aria-label="Breadcrumb"');
    for (const r of NAVAREA_REGIONS) {
      expect(html).toContain('class="source-card" href="/navarea/' + r.id + '"');
      expect(html).toContain('<span class="source-id">NAVAREA ' + r.id + '</span>');
      expect(html).toContain('<span class="source-label">' + r.shortLabel + '</span>');
      expect(html).toContain('<span class="source-authority">Coordinator: ' + r.authority + '</span>');
    }
    // The hub is fully static: no client-side hydration hooks.
    expect(html).not.toContain('id="warningList"');
    expect(html).not.toContain('navarea-page.js');
    expect(html).not.toContain('id="navareaPageConfig"');
  });

  it('builds a sitemap covering homepage, about, the registry and all 21 regional pages', () => {
    const xml = buildSitemapXml('2026-10-25');
    const locs = (xml.match(/<loc>/g) || []).length;
    expect(locs).toBe(24);
    expect(xml).toContain(SITE_URL + '/');
    expect(xml).toContain(SITE_URL + '/about');
    expect(xml).toContain(SITE_URL + '/sources');
    for (const r of NAVAREA_REGIONS) {
      expect(xml).toContain(SITE_URL + '/navarea/' + r.id);
    }
  });
});

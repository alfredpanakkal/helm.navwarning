# Helm.Warning — Phase 1 SEO Implementation Plan

**Target:** https://helmwarning.vercel.app/
**Goal:** Move from "fully crawlable but invisible" to indexed and ranking for primary NAVAREA search terms within 4–6 weeks.
**Scope:** All changes are frontend/deploy-level (index.html head, public/ assets, Vercel config). No backend or Supabase changes required.

---

## Stage 0 — Baseline & Verification Setup (Day 1)

**Owner setup tasks — do these FIRST so you can measure results:**

1. Register **Google Search Console** (https://search.google.com/search-console)
   - Add property → URL prefix → `https://helmwarning.vercel.app/`
   - Verify via HTML meta tag (add it in Stage 1 with the other head changes, single deploy) or DNS
2. Register **Bing Webmaster Tools** (https://www.bing.com/webmasters) — can import directly from Search Console
3. Record baseline: screenshot current search results for "helmwarning", "navarea warnings map" (currently: zero presence)

> **Success metric:** Search Console property active and able to request indexing.

---

## Stage 1 — P0: Metadata & Crawler Directives (Day 1, ~1 hour)

### 1.1 `index.html` — head rewrites

Replace the current head block:

```html
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Live NAVAREA Warnings Map | Free Maritime Safety Information</title>
  <meta name="description" content="Free interactive map of live NAVAREA navigational warnings. Fast, mobile-friendly maritime safety information for passage planning. No login required." />
  <link rel="canonical" href="https://helmwarning.vercel.app/" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <html lang="en" /> <!-- set lang="en" on the <html> tag itself -->
  <meta property="og:locale" content="en" />
  <!-- OG + Twitter tags added in Stage 2 -->
</head>
```

**Exact copy to use:**

| Element | Value | Length check |
| --- | --- | --- |
| `<title>` | `Live NAVAREA Warnings Map \| Free Maritime Safety Information` | 58 chars ✅ |
| `meta description` | `Free interactive map of live NAVAREA navigational warnings. Fast, mobile-friendly maritime safety information for passage planning. No login required.` | 149 chars ✅ |
| `canonical` | `https://helmwarning.vercel.app/` | — |
| `meta robots` | `index, follow, max-image-preview:large` | — |

### 1.2 `public/robots.txt` (create)

```
User-agent: *
Allow: /
Disallow: /admin

Sitemap: https://helmwarning.vercel.app/sitemap.xml
```

### 1.3 `public/sitemap.xml` (create)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://helmwarning.vercel.app/</loc>
    <lastmod>2026-10-21</lastmod>
  </url>
</urlset>
```

**Rules:** Only real URLs — no `#map` / `#data-bank` / `#sources` fragments (Google ignores them). Skip `priority`/`changefreq` (ignored by Google). Update `lastmod` honestly when content changes.

### 1.4 Deploy & verify

- Deploy to Vercel; confirm `https://helmwarning.vercel.app/robots.txt` and `/sitemap.xml` return 200 (currently both 404)
- In Search Console: submit sitemap → "Request indexing" on homepage
- Verify title/description render via Google's Rich Results Test or `view-source:` check

> **Success metric:** Directories return 200; Search Console shows "URL is available to Google" (check in 2–3 days).

---

## Stage 2 — P1: Social Cards & Structured Data (Week 1, ~2–3 hours)

### 2.1 OG image asset (do this first — it blocks the cards)

- Create `public/og-image.png`: **1200×630px**, dark-nautical branded card with site name, tagline ("Live NAVAREA Warnings Map"), and a subtle map/warning-icon motif. No clutter — match the existing mariner aesthetic.

### 2.2 `index.html` — social cards

```html
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Helm.Warning" />
<meta property="og:title" content="Live NAVAREA Warnings Map | Free Maritime Safety Information" />
<meta property="og:description" content="Free interactive map of live NAVAREA navigational warnings for passage planning. No login required." />
<meta property="og:url" content="https://helmwarning.vercel.app/" />
<meta property="og:image" content="https://helmwarning.vercel.app/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Live NAVAREA Warnings Map | Helm.Warning" />
<meta name="twitter:description" content="Free interactive map of live NAVAREA navigational warnings for passage planning." />
<meta name="twitter:image" content="https://helmwarning.vercel.app/og-image.png" />
```

**Absolute URL required for og:image.** Test with Facebook Sharing Debugger, Twitter Card Validator, and Slack (paste link in a DM).

### 2.3 `index.html` — JSON-LD structured data

Single script with three entities:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://helmwarning.vercel.app/#org",
      "name": "Helm.Warning",
      "url": "https://helmwarning.vercel.app/"
    },
    {
      "@type": "WebApplication",
      "name": "Helm.Warning — Live NAVAREA Warnings Map",
      "url": "https://helmwarning.vercel.app/",
      "applicationCategory": "NavigationApplication",
      "operatingSystem": "Web",
      "description": "Free interactive map of live NAVAREA navigational warnings for maritime passage planning.",
      "publisher": { "@id": "https://helmwarning.vercel.app/#org" },
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
    },
    {
      "@type": "Dataset",
      "name": "Live NAVAREA Navigational Warnings",
      "description": "Aggregated in-force navigational warnings across all 21 NAVAREA regions from official hydrographic sources.",
      "creator": { "@id": "https://helmwarning.vercel.app/#org" },
      "license": "https://creativecommons.org/licenses/by/4.0/",
      "temporalCoverage": "2026-01-01/..",
      "isAccessibleForFree": true,
      "keywords": ["NAVAREA", "navigational warnings", "maritime safety information", "MSI", "passage planning"]
    }
  ]
}
</script>
```

Adjust `license` and `temporalCoverage` to reflect the actual data terms. Validate with Google Rich Results Test + Schema.org validator.

### 2.4 Custom domain (parallel task, this week)

- Buy `helmwarning.com` (or closest available) and add in Vercel → Domains
- **If done:** update every absolute URL in this plan (canonical, og:url, sitemap locs, robots.txt sitemap line, JSON-LD) to the new domain in the SAME deploy — do not mix
- **If deferred:** proceed with vercel.app URLs now; migrating later requires a full canonical swap + Search Console re-verification (plan for it)

> **Success metric:** Rich Results Test passes with no errors; share previews render card + image on all platforms.

---

## Stage 3 — P2: Crawlable Keyword Content & UX Safety (Week 2, ~2–4 hours)

### 3.1 Keyword-targeted prose block (footer drawer, before hydration)

Do **not** repeat the 21-area list — the page already exposes it. Write intent-driven prose (~200–300 words) targeting the three clusters:

- "navarea warnings map" / "live navarea warnings"
- "maritime safety information" / "navigational warnings"
- "passage planning" / NAVTEX / GMDSS MSI context

Structure: `<h2>Live NAVAREA Warnings for Passage Planning</h2>` + 2–3 short paragraphs explaining what the map shows, the 21-region coverage (I–XXI, including the five Arctic areas), the 14 official source feeds, and a GMDSS disclaimer (never a substitute for official MSI broadcasts).

**Placement:** collapsed `<details>` or footer drawer — crawlable, unobtrusive, zero disruption to Focus Mode.

### 3.2 CLS protection for the Leaflet map

- Give the map container a fixed/reserved height (`min-height` or aspect-ratio) in initial CSS so hydration doesn't shift layout
- Verify with Lighthouse: target CLS < 0.1, LCP < 2.5s
- `loading="lazy"` on non-critical layers; ensure base map isn't blocking LCP

### 3.3 Favicon & branding polish

Confirm 16×16 / 32×32 / 180×180 (apple-touch-icon) set exists — favicons appear in mobile SERPs and affect CTR.

> **Success metric:** Lighthouse mobile ≥ 90 / CLS < 0.1; prose block visible in view-source before JS.

---

## Stage 4 — P3: Content Expansion & Authority (Weeks 3–6, ongoing)

### 4.1 SEO landing pages (the biggest long-term lever)

| Page | Target query | Notes |
| --- | --- | --- |
| `/what-are-navarea-warnings` | "what are navarea warnings", "navarea meaning" | Evergreen explainer: WWNWS, GMDSS, NAVTEX relationship |
| `/navarea/i` … `/navarea/xxi` | "navarea i warnings", "navarea x warnings" | 21 pages, one per area: live count, source feed, area map. Each ranks independently |
| `/sources` | "ukho navigational warnings", "amsa notices to mariners" | Expand the existing registry into a crawlable page |

Each page: unique title/description, its own canonical, added to sitemap.xml as a real URL.

### 4.2 Link earning

- Share in maritime communities: r/sailing, r/shipping, r/MerchantNavy, gCaptain forums, cadet communities
- Approach the hydrographic offices already in your Sources registry (UKHO, AMSA, SHOM…) — being listed by them is the strongest possible backlink in this niche
- No competitor-comparison content (per confirmed strategy)

### 4.3 Weekly measurement loop (Search Console)

- **Watch impressions first, clicks second** — impressions confirm Google understands the site; clicks follow as rank climbs
- Review: queries gaining impressions, average position, indexed page count
- If impressions appear within 2–3 weeks of Stage 1 → invest harder in Stage 4 content

---

## Verification Checklist (run after every stage deploy)

- [ ] `robots.txt` and `sitemap.xml` return HTTP 200
- [ ] Title ≤ 58 chars, description ≤ 149–155 chars, both render in SERP preview tools
- [ ] Canonical, OG, Twitter, JSON-LD present in `view-source` (not JS-injected)
- [ ] Rich Results Test: zero errors
- [ ] Lighthouse mobile: performance ≥ 90, CLS < 0.1
- [ ] Share preview verified on X, LinkedIn, Slack, WhatsApp
- [ ] Search Console: sitemap processed, homepage indexed
- [ ] Zero visual regression: Focus Mode, map, Data Bank, Sources unchanged

---

## Risk Register

| Risk | Mitigation |
| --- | --- |
| Vercel preview URLs create duplicate content | Canonical tag (Stage 1) already handles this |
| Domain migration after indexing begins | Prefer doing Stage 2.4 in week 1; if later, swap ALL absolute URLs atomically and use Search Console change-of-address |
| Dataset rich result rejected (competitive category) | Include all quality signals (license, temporalCoverage, creator); rejection is not penal — utility still indexed |
| Arctic area naming inaccuracy | Site already lists 21 areas (I–XXI) correctly — keep copy consistent with this |
| Layout shift on Leaflet hydration | Fixed container height (Stage 3.2) |
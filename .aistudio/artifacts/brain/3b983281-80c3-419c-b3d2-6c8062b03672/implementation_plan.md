# Helm.Warning — Phase 1 SEO & Search Indexability Plan (Revised)

Deliver an immediate, high-impact Phase 1 SEO upgrade for Helm.Warning (`https://helmwarning.vercel.app/`), establishing strong organic search visibility, zero-404 crawler discovery, social sharing readiness, and search performance measurement without competitor comparisons.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Key Decisions & Prioritized Execution Order:**
> 1. **Immediate Metadata Layer**: Title tag, meta description, self-referencing canonical URL, OpenGraph / Twitter tags, and Schema.org JSON-LD structured data.
> 2. **Ship `robots.txt` & `sitemap.xml`**: Resolve current 404s immediately so search engines can crawl and index active pages and anchors.
> 3. **Social Image Asset (`og-preview.png`)**: Provide a branded 1200×630px social card preview for rich sharing across Twitter, LinkedIn, Slack, and messaging apps.
> 4. **Google Search Console (GSC) Verification & Measurement**: Prepare verification tag readiness, sitemap submission steps, and a 14-day indexing tracking checklist to measure early impressions from zero baseline.
> 5. **Hydration CLS Guard**: Prevent Cumulative Layout Shift (CLS) when static crawlable HTML transitions into dynamic Leaflet map tiles and warning markers.
> 6. **No Competitor Bashing**: Retain clean, authoritative maritime positioning with zero comparison articles.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms Helm.Warning from an invisible, client-rendered SPA into a fully indexable, rich-snippet-ready maritime safety information hub.
- **Target Audience**: Deck officers (OOW), master mariners, passage planners, yacht skippers, and maritime dispatchers seeking live navigational warnings.
- **Key Value**: Direct organic discovery (`navarea warnings map`, `live navarea warnings`, `maritime safety information map`) into a free, instant-loading, mobile-friendly live hazard map.

---

## 2. Sequence of Implementation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 1: On-Page Metadata & JSON-LD Layer (index.html)                       │
│ ├── Title (58 chars) & Meta Description (149 chars)                         │
│ ├── Canonical Tag (<link rel="canonical" href="https://...">)               │
│ ├── OpenGraph & Twitter Meta Tags (targeting /og-preview.png)               │
│ ├── Google Search Console Verification Meta Placeholder                     │
│ └── Schema.org JSON-LD Graph (WebApplication + Dataset)                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 2: Crawler Discovery Assets (public/)                                  │
│ ├── /robots.txt   -> Allows /, disallows /admin, points to sitemap          │
│ └── /sitemap.xml  -> Canonical root + Map, Data Bank, and Sources anchors   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 3: Social Card Asset & Crawlable Semantic HTML (CLS-Protected)        │
│ ├── Generate /public/og-preview.png (1200x630 branded nautical chart card)  │
│ ├── Pre-bake semantic crawlable content (NAVAREA overview & MSI disclaimer) │
│ └── Hydration CLS check (fixed aspect containers to guarantee 0 shift)      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 4: Verification, Lint & Search Console Onboarding Checklist           │
│ ├── compile_applet & lint_applet validation                                 │
│ └── Clear guide for GSC property claim, sitemap ping, & 14-day audit        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Specifications

### A. Metadata & OpenGraph Tags (`index.html`)

- **Title Tag (58 characters)**:
  ```html
  <title>Live NAVAREA Warnings Map | Free Maritime Safety Information</title>
  ```
- **Meta Description (149 characters)**:
  ```html
  <meta name="description" content="Free interactive map of live NAVAREA navigational warnings. Fast, mobile-friendly maritime safety information for passage planning. No login required.">
  ```
- **Canonical & Base URLs**:
  ```html
  <link rel="canonical" href="https://helmwarning.vercel.app/">
  ```
- **Social Tags (OG / Twitter)**:
  ```html
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Helm.Warning">
  <meta property="og:title" content="Live NAVAREA Warnings Map | Free Maritime Safety Information">
  <meta property="og:description" content="Free interactive map of live NAVAREA navigational warnings. Fast, mobile-friendly maritime safety information for passage planning. No login required.">
  <meta property="og:url" content="https://helmwarning.vercel.app/">
  <meta property="og:image" content="https://helmwarning.vercel.app/og-preview.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Live NAVAREA Warnings Map | Free Maritime Safety Information">
  <meta name="twitter:description" content="Free interactive map of live NAVAREA navigational warnings. Fast, mobile-friendly maritime safety information for passage planning. No login required.">
  <meta name="twitter:image" content="https://helmwarning.vercel.app/og-preview.png">
  ```
- **Google Search Console Verification Hook**:
  ```html
  <meta name="google-site-verification" content="GSC_VERIFICATION_TOKEN_PLACEHOLDER">
  ```

### B. Schema.org Structured Data (JSON-LD)

Embed inside `<head>` of `index.html`:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": "https://helmwarning.vercel.app/#app",
      "name": "Helm.Warning",
      "url": "https://helmwarning.vercel.app/",
      "applicationCategory": "NavigationApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "description": "Free interactive global map and operational directory for active NAVAREA navigational warnings and Maritime Safety Information (MSI)."
    },
    {
      "@type": "Dataset",
      "@id": "https://helmwarning.vercel.app/#dataset",
      "name": "Global NAVAREA Maritime Safety Warnings Dataset",
      "description": "In-force navigational hazard notices, coordinates, and advisory notices across all 21 NAVAREAs.",
      "license": "https://creativecommons.org/publicdomain/zero/1.0/",
      "isAccessibleForFree": true,
      "creator": {
        "@type": "Organization",
        "name": "Helm.Warning"
      }
    }
  ]
}
</script>
```

### C. Crawler Directives (`public/robots.txt` & `public/sitemap.xml`)

- **`public/robots.txt`**:
  ```txt
  User-agent: *
  Allow: /
  Disallow: /admin.html
  Disallow: /admin
  
  Sitemap: https://helmwarning.vercel.app/sitemap.xml
  ```
- **`public/sitemap.xml`**:
  Standard XML sitemap targeting `https://helmwarning.vercel.app/`, with entries for the primary views (Map, Data Bank, Sources).

### D. Social Preview Asset (`public/og-preview.png`)
Create an SVG-derived crisp 1200×630 OpenGraph graphic featuring:
- Slate navy nautical background (`#0f172a`)
- Helm.Warning brand icon & title
- High-contrast typography: "Live NAVAREA Warnings Map"
- Subheading: "Real-time Maritime Safety Information (MSI) · Passage Planning Utility"
- Visual cue of maritime coordinates & hazard area indicators

### E. Hydration CLS Protection & Crawlable Content
- Pre-bake semantic text inside an unobtrusive, accessible `<section class="seo-crawlable-summary">` within `index.html` covering:
  - Definition of NAVAREA warnings and World-Wide Navigational Warning Service (WWNWS)
  - Full list of NAVAREAs (I through XXI) and issuing coordinators
  - Mandatory SOLAS / GMDSS disclaimer
- Ensure the `#map` container preserves strict CSS `min-height` and height calculation before and after Leaflet initialization, preventing layout jumps during JS loading (CLS < 0.05).

---

## 4. Search Console & Measurement Protocol

1. **GSC Claiming**:
   - Add property for `https://helmwarning.vercel.app/`
   - Paste verification code into `<meta name="google-site-verification">`
2. **Sitemap Submission**:
   - Submit `https://helmwarning.vercel.app/sitemap.xml` in GSC
3. **URL Inspection & Live Test**:
   - Request indexing on `https://helmwarning.vercel.app/`
   - Verify Googlebot renders the pre-baked semantic content and valid JSON-LD
4. **14-Day Baseline Tracking**:
   - Track impressions for queries: `navarea warnings map`, `live navarea warnings`, `maritime safety information map`
   - Monitor indexing status for zero 404 errors on robots.txt and sitemap.xml

---

## 5. Verification Plan

- Run `compile_applet` and `lint_applet` to confirm zero errors.
- Verify `robots.txt` and `sitemap.xml` are accessible via local server routing.
- Validate Schema.org JSON-LD syntax against Schema Validator guidelines.
- Confirm viewport stability across mobile (375px) and desktop (1440px).

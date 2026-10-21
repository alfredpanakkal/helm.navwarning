# Helm.Warning — Phase 1 SEO Implementation Plan (Adapted)

Analyse and adapt the Phase 1 SEO Roadmap for **Helm.Warning** (`https://helmwarning.vercel.app/`) to move from unindexed to ranking for primary maritime safety and NAVAREA search queries, fully aligned with the live codebase and confirmed user preferences.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were clarified in Phase 1 and are baked into this adapted plan:

- **Confirmed Canonical Domain**: Using `https://helmwarning.vercel.app/` as the primary canonical domain across all meta tags, canonical links, sitemap entries, and structured data graph IDs. (If a custom domain such as `helmwarning.com` is acquired later, an atomic global URL update is documented).
- **Confirmed Social Share Asset**: Retaining and referencing the existing `public/og-preview.png` (1200×630px high-contrast maritime preview) for both OpenGraph and Twitter cards (`summary_large_image`).
- **Confirmed Sitemap Architecture**: Pruning `public/sitemap.xml` to a single clean canonical root URL (`https://helmwarning.vercel.app/`) without query parameter variations (`?view=map`), matching Google search quality guidelines.
- **Search Console Verification**: Maintaining the `<meta name="google-site-verification" content="...">` hook in `index.html` ready for live token insertion without redeployment friction.

---

## 1. Overview & Core Concept

- **What It Does**: Optimizes `Helm.Warning` for rapid indexing and high-relevance search visibility across Google, Bing, and maritime professional networks. Ensures all search crawlers receive pristine HTTP 200 metadata, comprehensive Schema.org linked data, and crawlable pre-rendered keyword content before client JavaScript hydrations.
- **Target Audience / Persona**: Watchkeeping officers (OOW), navigators, master mariners, passage planners, maritime safety auditors, yacht skippers, and coastal boaters seeking instant, mobile-friendly active NAVAREA hazard information.
- **Key Value**: Immediate discovery in search engines for high-intent queries like "live navarea warnings", "navarea warnings map", and "maritime safety information" without requiring vessel login or slow legacy portal navigation.

---

## 2. User Experience & Visual Design

- **Search Engine Result Pages (SERP)**:
  - Title: `Live NAVAREA Warnings Map | Free Maritime Safety Information` (58 chars, zero truncation).
  - Meta Description: `Free interactive map of live NAVAREA navigational warnings. Fast, mobile-friendly maritime safety information for passage planning. No login required.` (149 chars, within the 120–160 character sweet spot).
- **Social Card Sharing (Slack, LinkedIn, X, WhatsApp, Discord)**:
  - Rich card preview using `public/og-preview.png` with crisp title and description.
- **Crawlable Semantic Prose (In-App)**:
  - Pre-rendered inside the footer's `<details class="seo-accordion">` tag.
  - Zero disruption to Map Focus Mode or the active cartographic viewport.
  - Provides ~300 words of crawlable, indexable semantic context explaining the World-Wide Navigational Warning Service (WWNWS), all 21 NAVAREAs (I–XXI including the Arctic regions XVII–XXI), 14 official hydrographic sources, and official GMDSS / SOLAS safety notices.
- **Layout Stability (Cumulative Layout Shift - CLS)**:
  - Strict CSS reserved heights for the map container (`620px` desktop, `460px` mobile) to guarantee CLS < 0.1 during Leaflet tile hydration.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Single Root Sitemap vs Parameterized URLs**
  - *Chosen Approach*: Only list `https://helmwarning.vercel.app/` in `public/sitemap.xml`. Remove `?view=map`, `?view=databank`, and `?view=sources`.
  - *Why*: Google treats single-page app view parameters that share the same canonical URL as duplicates or low-quality URL variants. A single canonical URL prevents crawl budget dilution.
  - *Alternatives Considered*: Submitting parameterized URLs — rejected as search engines often canonicalize them back to root while flagging soft duplicate warnings.
- **Decision 2: Connected 3-Entity Schema.org Graph**
  - *Chosen Approach*: Embed an interconnected `@graph` containing `Organization` (`#org`), `WebApplication` (`#app`), and `Dataset` (`#dataset`) with explicit `creator`, `publisher`, `license`, and `isAccessibleForFree: true`.
  - *Why*: Provides search engines with verified context that this is an open-access utility providing a dataset of maritime safety notices.
  - *Alternatives Considered*: Basic single `SoftwareApplication` without Dataset markup — rejected because Dataset structured data unlocks specialized rich results in Google Dataset Search.
- **Decision 3: Non-Intrusive Semantic Accordion in Footer**
  - *Chosen Approach*: Keep the crawlable prose in an accessible `<details>` accordion at the bottom of the page rather than cluttering the map header.
  - *Why*: Balances mariner utility (instant uncluttered chart) with search crawler discoverability (pre-rendered text present in raw HTML `view-source`).

---

## 4. Technical Architecture & Data Strategy

### Technical Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Search Engine Crawlers                          │
│               (Googlebot, Bingbot, Social Preview Bots)                │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ HTTP GET
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Static Edge / Vercel Host                        │
│                                                                        │
│   ├── /robots.txt           (Allows root, disallows /admin, links map) │
│   ├── /sitemap.xml          (Clean canonical root, ISO-8601 lastmod)   │
│   ├── /og-preview.png       (1200x630 dark-nautical preview asset)     │
│   │                                                                    │
│   └── /index.html (Raw Pre-hydrated HTML)                              │
│       ├── Head: Title (58c), Description (149c), Canonical, Robots     │
│       ├── OpenGraph & Twitter metadata (summary_large_image)           │
│       ├── JSON-LD Schema.org (@graph: Org + WebApp + Dataset)          │
│       ├── Semantic Pre-rendered DOM:                                   │
│       │   └── <details class="seo-accordion">                          │
│       │       └── H2 "Live NAVAREA Warnings for Passage Planning"      │
│       │       └── 21 NAVAREA Coverage + WWNWS + GMDSS Disclaimer       │
│       └── Application Shell & Leaflet Map Container                    │
└────────────────────────────────────────────────────────────────────────┘
```

### Implementation Sub-Tasks & Deliverables

1. **Crawler Directives (`public/robots.txt` & `public/sitemap.xml`)**:
   - Verify `robots.txt` blocks `/admin` and `/admin.html` while exposing `Allow: /` and the exact absolute sitemap URL.
   - Clean `sitemap.xml` to list solely `https://helmwarning.vercel.app/` with current date `2026-10-21`, removing query-string duplicates.
2. **Document Head & Social Metadata (`index.html`)**:
   - Ensure `<html lang="en">` is explicitly declared.
   - Verify `<meta name="robots" content="index, follow, max-image-preview:large">`.
   - Ensure OpenGraph and Twitter cards reference `https://helmwarning.vercel.app/og-preview.png`.
   - Update JSON-LD structured data to include the linked 3-entity graph: `Organization`, `WebApplication`, and `Dataset`.
3. **Crawlable Keyword Block (`index.html`)**:
   - Adapt the `<details class="seo-accordion">` content to incorporate high-intent passage planning keywords, Arctic coverage notes (NAVAREA XVII–XXI), and explicit coordinator attribution (UKHO, NGA, SHOM, AMSA, JCG, etc.).
4. **Build & Accessibility Verification**:
   - Run compilation and verify that all static assets and head tags pass validation without regressions to Focus Mode or Data Bank features.

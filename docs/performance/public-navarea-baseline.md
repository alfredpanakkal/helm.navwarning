# Public NAVAREA Portal Performance Baseline

**Audit date:** 2026-11-16  
**Repository:** `alfredpanakkal/helm.navwarning`  
**Production origin:** `https://navarea.helmology.com/`  
**Measured Pingdom origin:** `https://helmwarning.vercel.app/`  
**Scope:** Public `/` portal only. The authenticated `/admin` and `/console` surfaces are out of scope.

## Architecture verified from the repository

- `index.html` is the public vanilla-JavaScript page.
- `public/assets/js/public.js` owns Leaflet initialization, warning rendering, filters, and page interaction.
- `public/assets/js/supabase.js` owns the public Supabase client and warning queries.
- `public/assets/js/onboarding.js` owns the first-visit guide.
- `console.html` mounts the separate React console. This work must not move public portal functionality into the React console or alter the admin boundary.
- The public map reads `nav_warnings_active_spatial`; the view is documented as active Tier-A geometry, one row per geometry. Raw bulletin text is hydrated from `nav_warnings`.

## Supplied lab measurements

### PageSpeed Insights (2026-11-16)

| Metric | Mobile | Desktop |
|---|---:|---:|
| Performance | 65 | 95 |
| Accessibility | 92 | 95 |
| Best Practices | 96 | 100 |
| SEO | 100 | 100 |
| FCP | 1.4 s | 0.3 s |
| LCP | 5.4 s | 0.9 s |
| TBT | 60 ms | 10 ms |
| CLS | 0.211 | 0.11 |
| Speed Index | 5.2 s | 1.2 s |

The PSI profiles use different emulation/throttling settings; the mobile/desktop gap is directional, not a controlled code-only comparison. No CrUX data was present in the supplied report.

### DebugBear (2026-11-16, US East, 12 Mbps, 70 ms RTT)

- Full TTFB: 410 ms; FCP: 815 ms; LCP: 1.44 s.
- TBT: 414 ms; CPU time: 2.16 s; TTI: 4.92 s; visually complete: 8.82 s.
- CLS: 0.25; page weight: 642 KB.
- Reported blocking tasks: `public.js` 328 ms; `onboarding.js` 86 ms.
- Reported Supabase spatial-view response: 316 KB for `nav_warnings_active_spatial`.
- Reported OSM and OpenSeaMap tile traffic; the identified LCP element was a Leaflet tile. This does not establish that a particular fixed tile should be preloaded.

The report did not provide the spatial query's row count, full timing breakdown, or a reliable distinction between compressed transfer bytes and decoded resource size in the pasted summary.

### Pingdom HAR (2026-11-16)

Source: supplied HAR export for test `6878a88e86400000`.

- 11 requests, all HTTP 200.
- Document onLoad: 187 ms; fully loaded: 358 ms.
- The HAR contains the document, CSS, Leaflet JS, public JS, onboarding JS, the Supabase UMD library and favicon.
- It contains **no Supabase PostgREST data request and no map tile request**. It therefore measures the static shell and assets, not the asynchronous warning/map-ready experience.
- The document and same-origin assets were Vercel cache HITs with `public, max-age=0, must-revalidate`; the Supabase UMD library was served from unpkg with a one-year cache lifetime.
- The measured document host was `helmwarning.vercel.app`, whereas the PSI/DebugBear target was `navarea.helmology.com`. Treat them as separate origins until deployment equivalence is verified.

## Verified code findings

1. `fetchActiveWarnings()` currently starts a broad `nav_warnings` text hydration query for every row with `status='active'`, selecting `raw_text`, `issued_at`, `parsing_method`, and `qa_flags`.
2. In parallel, it reads the spatial view in sequential PostgREST pages of 1,000 rows, ordered by `geom_id`.
3. The merge function only publishes rows represented by the spatial view with `triage_tier === 'A'`. Therefore, broad text hydration can retrieve text for active records that are not part of the public Tier-A map dataset. The revised query should restrict raw-text hydration to active Tier-A rows and cache only the Tier-A records represented by the public spatial view.
4. The public loader awaits the network query before rendering the Data Bank/cards and map warnings. There is currently no persistent public snapshot cache.
5. `initMap()` calls `filterMapByNavArea()` before warning data has loaded; `loadWarnings()` calls it again after the data fetch. The map-fit state explicitly anticipates the pre-data call. Avoid duplicate work without changing the initial selected NAVAREA or fit behaviour.
6. The first-visit onboarding is loaded as a deferred script and opens on DOMContentLoaded if not completed. Any deferral must preserve the first-visit experience and its keyboard/focus behaviour.
7. The default OSM layer is requested directly from `tile.openstreetmap.org`; alternate CARTO layers use the existing same-origin tile proxy. OpenSeaMap and Esri overlays are separately configured.

## Safety and correctness constraints

- Cache only the public snapshot returned from the spatial view after Tier-A filtering and its matching text hydration. Never cache admin, review-queue, Tier-B or Tier-C data.
- A successful refresh replaces the complete snapshot; never merge old and new records.
- A cancelled, expired or superseded warning must disappear from the next successfully refreshed snapshot.
- If refresh fails, a cached snapshot may remain visible only with an explicit cached/stale indicator and its last successful cache timestamp in UTC.
- Never present cached data as live or verified-current. Preserve the original bulletin and all existing coordinate/geometry validation.
- Preserve Data Bank full-text search, all 21 NAVAREAs, multi-geometry grouping, warning detail loading, filters, and manual refresh.
- No service worker, backend/schema migration, new Vercel function, hosting migration, framework migration, or redesign is in scope.

## Validation status

- The GitHub Actions workflow now runs TypeScript, Vitest, the Vite bundle build, and the Playwright browser smoke suite (Chromium). The latest run is pending; record its final result before merge.
- A dedicated public-portal Playwright suite covers first visit, repeat-visit cached rendering, Tier-B/Tier-C exclusion from IndexedDB, failed-refresh fallback, full-text search, warning details, successful empty-snapshot replacement, and no resurrection after a later failed refresh.
- The browser suite uses a controlled Supabase REST fixture. It validates application behaviour deterministically; it is not a live production-data or map-tile test.
- Manual preview verification is still required for offline startup, actual map rendering and all 21 NAVAREAs, mobile/desktop layout, and warning/filter interactions.
- Obtain comparable mobile/desktop before-and-after runs against the same production hostname and test profile. Measure actual PostgREST request(s), row counts, transfer sizes, and warning-ready time; Pingdom's supplied HAR cannot provide these.


## Changes implemented on `perf/public-navarea-performance`

The implementation keeps the existing public vanilla-JS + Leaflet portal and the separate React admin console.

- **Public data query:** the spatial view remains authoritative and is still paginated at 1,000 rows. Bulletin text is fetched in parallel, also paginated, but now restricted to `status='active'` and `triage_tier='A'`; Tier-B/Tier-C review records are not hydrated by the public query.
- **Initial rendering:** removed the pre-data `filterMapByNavArea()` pass from `initMap()`; the first warning-layer plot happens after the first available public snapshot is rendered.
- **Unused startup payload:** removed the 8.3 KB source block of hard-coded demo warnings; it had no references and the live loader does not use it as a fallback. This avoids shipping and parsing unused sample warning data.
- **Repeat visits:** added an in-memory + IndexedDB public snapshot cache, with a schema version and a single complete-snapshot record. The cache accepts only active Tier-A warnings. A successful complete refresh replaces the record with `put`; a failed/incomplete refresh retains the prior record and returns it as cached.
- **Freshness UI:** a site-wide status strip labels cached data, shows the last successful client refresh timestamp in UTC, and distinguishes “checking”, “could not confirm”, and partial bulletin-text hydration. The indicator is visible on Map and Data Bank tabs. Cached warning counts and map summaries say “cached” / “last-known in-force”, not “live”.
- **First-visit guide:** onboarding setup is scheduled for an idle callback (with a bounded timeout) or a short timer fallback; the existing four-step guide and focus/keyboard behaviour remain unchanged.
- **Connection setup:** added preconnect hints for the configured Supabase project, default OSM tiles, and the default OpenSeaMap seamark overlay; optional Esri layers are not preconnected. No fixed tile is preloaded, and no cache headers were made immutable because the current asset URLs are not content-versioned.
- **Tests:** expanded the existing Supabase merge parity suite for public-tier filtering, text pagination, memory-cache fallback, and full-snapshot replacement. Added Playwright public-portal scenarios for cached startup, failed refresh, cancellation removal, no resurrection, full-text search, and warning details. GitHub Actions now installs Chromium and runs the browser smoke suite.

## Review and release status

The latest code is committed on `perf/public-navarea-performance`. GitHub CI is now responsible for TypeScript, Vitest, bundle build and Playwright smoke validation; inspect the latest run result before merge. No new PSI/DebugBear measurement has been performed yet.

Before merge:

1. Confirm the latest GitHub Actions run passes, including the new public browser scenarios.
2. Run the same scenarios against the Vercel preview. The current preview is protected by Vercel authentication, so it has not yet been inspected in an unauthenticated browser.
3. Verify offline startup, actual map rendering, all NAVAREAs, filters, mobile/desktop layouts and manual refresh.
4. Compare the same mobile PSI/DebugBear profile and hostname against the baseline. Re-run the Pingdom HAR only as a static-shell/network check; it is not a warning-ready or map-ready measurement.
5. Resolve the separate Cloudflare `Workers Builds: navarea` failure; the connected Cloudflare API currently returns 403 for build-log retrieval.

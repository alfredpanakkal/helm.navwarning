# Product Requirements — Helm.Warning

> Status: describes the shipped system (verified 2026-11-03) plus explicitly marked gaps.
> The old aspirational PRD prose was removed; anything not built is listed as such in §7.

## 1. What this is

Helm.Warning aggregates global NAVAREA navigational warnings (maritime safety information under IHO/WWNWS), stores them in Supabase Postgres with PostGIS geometry, and serves them as:

- a **public portal** — interactive chart, warning list, info tab (no account needed), and prerendered crawlable pages;
- an **admin console** — triage, verification, geometry editing, and pipeline visibility for a single maintainer.

It is decision-support, not an official MSI distributor (see the README disclaimer).

## 2. Users

- **Public / read-only**: navigators, pilots, VTS and port operations, SAR, anyone needing current hazard awareness. No auth.
- **Admin**: the maintainer (single operator today). Supabase Auth; admin = `app_metadata.role` ∈ {admin, superadmin} or `is_admin`, verified server-side and fail-closed.

## 3. Public portal (`/`)

| Capability | Notes |
|---|---|
| Chart (Leaflet) | Esri Ocean basemap, OpenSeaMap overlay (behind the console map settings "Advanced layers" disclosure), clustered markers |
| Geometry types | Points, polygons, corridors/lines, circles, offshore-rig pins with 500m exclusion perimeters |
| Warning drawer | Inline accordions; minimize (44px) / maximize (520px); bidirectional map↔card focus |
| Data Bank | Search/filter by NAVAREA (I–XXI, BALTIC), status, category (`military`, `drifting`, `aton`, `subsea`, `offshore`, `electronic`, `general`) |
| Themes | Light / dark / night (watch-state themes), persisted per user |
| Info tab | About, Source Registry (21 regions), disclaimer, developer section — single info surface at `/?tab=info` |
| Static SEO surface | 21 prerendered NAVAREA pages + one page per active warning (full bulletin text in initial HTML), regenerated per deploy; new warnings served via `/warning-shell` until next deploy |

The public bundle contains no admin endpoints or write paths.

## 4. Admin console (`/console`, reached via `/admin` login)

Four sections (legacy hash aliases still resolve):

1. **Warnings** — list with filters/sort/deep links, detail modal with audit trail, geometry editor (undo/redo, diff banner, AMBIGUOUS confirm guard), verify queue with Tier B→A promotion.
2. **Ingest** — manual paste parser, CSV import, pipeline-run ledger.
3. **Trace** — raw messages, generations, evidence.
4. **System** — Supabase status, source registry, AI connectivity.

Key behaviors: edit-save repaints from server truth; every edit writes an append-only audit row; optimistic locking (409 on conflict); single-fire guards on all audited writes; the warning editor is a right-side drawer so the map stays visible during geometry edits.

## 5. Data pipeline

- **Ingestion is backend-driven** (the separate `Helm.Warning.Backend` repo; the legacy frontend scraper was removed, PR #82). This repo no longer runs its own scraping cron.
- The frontend reads via PostgREST: `nav_warnings_active_spatial` view (map, `geojson_blob` per geometry), `nav_warnings` (Data Bank), `nav_warnings_review_queue` (Tier B triage).
- Writes go through the `upsert_nav_warning` RPC (atomic master + geometries).
- Tiering: **A** auto-plotted, **B** review queue (admin decision, dashed + "Unverified" on public map), **C** blocked, never rendered.
- Parser: deterministic rules first, Gemini fallback for ambiguous text; ambiguous coordinates are flagged `AMBIGUOUS`, never guessed; rule-parsed points are `RULE_PARSED`, only a human verifies.

The authoritative schema contract is [`docs/supabase-backend-contract.md`](docs/supabase-backend-contract.md).

## 6. Non-functional requirements that are actually enforced

- RLS everywhere; anon is SELECT-only; no `authenticated`-at-large write policies (2026-10-24 hardening, live-verified).
- Security headers on `/admin` + `/console` (`X-Frame-Options: DENY`, `noindex`); SSRF guard on outbound fetches; rate limits on tiles/AI; CSP.
- 44px touch targets on coarse pointers; skeleton loading states; unknown statuses render an amber "Needs Review" badge, never green.
- CI = typecheck (`tsc --noEmit`) + vitest + Playwright `ux:smoke`; Vercel Hobby constraints: 12 serverless functions max, 100 deploys/day.

## 7. Not built / removed (do not assume these exist)

- **ECDIS export (S-124/S-57)** — not implemented. Data model keeps ECDIS-ready intermediate types (`EcdisIntermediateLayer`) for a future export.
- **GPX / S-124 ZIP import** — not implemented (CSV import exists).
- **Legacy/modern UI switcher** — removed with `uiFlags` (PRs #35–#38).
- **Single-file offline export** — intentionally removed, not wanted.
- **Mistral AI support** — removed intentionally; Gemini is the sole AI provider.
- **External consumption API** — none; the only public read path is the site itself plus the anon Supabase REST endpoint the prerender script uses.

## 8. Open product questions

- Domain purchase (site remains on `helmwarning.vercel.app`).
- Map-update UX: pulse the marker vs auto-zoom — no decision recorded.
- ECDIS export priority and target formats.
- How to handle conflicting information from multiple sources for the same area.

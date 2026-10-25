# Project Knowledge — helm.navwarning

> Durable project knowledge and change history for the Helm.Warning platform.
> Entry point for agents is `AGENTS.md` at the repo root; this file is its
> knowledge appendix. Notes here are context — **live code always wins**;
> re-verify anything time-sensitive before acting on it.

## 1. Architecture facts

- Three entry points: `index.html` (public site, vanilla JS, no URL
  routing — Map/Data/Sources are JS tabs on `/`), `console.html`
  (React 19 SPA at `/console` with hash routes), `admin.html` (static
  Supabase login gate → redirects to `/console#/databank`).
- Auth: Supabase Auth; admin = `app_metadata.role` ∈ {admin, superadmin}
  or `is_admin`. Server boundary: `server/auth.ts` `verifyAdminRequest`
  (fail-closed, Bearer JWT). All `api/admin/*` functions use it.
- On Vercel only `api/*.ts` are serverless functions; `server.ts` Express
  routes (~30) exist only in the self-hosted/dev runtime and 404 in
  production. Frontend reads Supabase directly via PostgREST.
- `vercel.json`: cleanUrls, tile rewrites (carto + osm + openseamap),
  noindex headers on `/admin` and `/console`, cron
  `/api/scrape-navwarn` daily 06:00.
- Sitemap: only `/` is indexable; existing sitemap.xml (single URL) is
  correct.

## 2. Verified security/lifecycle state (2026-10-24 audit)

- Admin auth strong (fail-closed, app_metadata only, 401/403). RLS
  migration `20261024_admin_lineage_and_audit_enforcement.sql` — append-only
  audit policies (`nav_warning_audits` no_update/no_delete) and
  `superseded_by` lineage — **confirmed applied to the live DB on
  2026-10-24** (maintainer pg_policies check; legacy authenticated write
  policies dropped, `is_admin()` search_path hardened, RLS enabled on all
  public tables).
- Warning lifecycle solid: scraper never deletes (upsert-only),
  `raw_text` immutable, status whitelist (active/cancelled/expired/
  superseded/unverified), mandatory audit on edits (refused if audit
  unreachable; AUDIT_FAILED on failed audit insert), optimistic locking
  (`expected_updated_at`, 409), rollback-safe NAVAREA move.
- Known hygiene items: `/export/*` legacy snapshots publicly reachable
  (recommend removal), GSC verification token placeholder in index.html,
  raw Supabase error messages passed through in some 502 paths, CORS `*`
  on admin endpoints (cosmetic for Bearer APIs).

## 3. Change history (merged PRs, with root causes)

### PR #29 (merged) — Vercel 500s fixed
All 8 Vercel functions importing shared server modules 500'd on every
request (incl. daily cron → scraper was silently dead). Root cause:
`"type": "module"` → functions run as Node ESM → **extensionless relative
imports** throw `ERR_MODULE_NOT_FOUND` at module load. Fix: explicit
`.js` extensions across 12 files in the serverless graph + osm/openseamap
tile rewrites. Confirmed on preview: `/api/admin/verify` returns 401 JSON.
**Convention: always use explicit `.js` specifiers in any file reachable
from `api/` functions.**

### PR #30 (merged 2026-10-24) — pipeline_runs ledger
Adds `migrations/20261026_pipeline_runs.sql` (parent row per run + child
per source, `parent_run_id`/`retry_of`, status running/succeeded/failed/
partial, counts + stage_errors JSONB, RLS admin-only, no deletes), fail-open
`src/lib/pipelineRunLedger.ts`, instrumentation in
`api/scrape-navwarn.ts`, admin-guarded `GET /api/pipeline/runs`, and a
Pipeline Run Ledger panel in `#/audit` (GenerationInspectorView.tsx).
**`20261026_pipeline_runs.sql` applied to live Supabase (maintainer
confirmed 2026-10-24).** Next: trigger a scraper run and check the
Pipeline Run Ledger panel in `#/audit`.

### PR #56 (merged) — Phase 1 SEO/a11y
Public pages have zero `<img>` tags; the audit's "36 images" = 30 inline
SVGs in index.html + 10 injected by public.js + Leaflet tiles (alt already
provided by Leaflet 1.9.4). Every decorative SVG now carries
`aria-hidden="true" focusable="false"`; rig-pin divIcon marker got
`role="img" aria-label`. Apple-touch-icon link added; PNG uploaded manually
by maintainer (binary pushes through the GitHub text API corrupt bytes
≥ 0x80 — UTF-8 double-encoding). Post-deploy 404 check for
`/apple-touch-icon.png` was ambiguous due to deploy lag; verify.

### Console UX audit fix series (6 PRs, all merged 2026-10-25)
Console audit found 16 issues; fixed as 6 small PRs (issue 13 deliberately
deferred). Maintainer merged each himself after preview checks.

1. **#62 — Routing history & deep-link state (issues 1, 7).** Root cause:
   replaceState-only history + hash carried only tab+status. New pure
   `src/lib/consoleRoute.ts` (grammar + `DataBankRouteState`
   {q,sort,dir,page,navarea} + default-omitting `buildConsoleHash`) +
   16 vitest cases. App: pushState on real view switches vs replaceState
   for in-view edits; symmetric hashchange (absent keys reset, per-tab
   filter ownership); Data Bank state round-trips via optional
   `routeState`/`onRouteStateChange` on `useDataBankModel`/
   `DataBankV2`. Known limitation kept: `sort`/`dir` deep-link params
   only active in custom sort mode.
2. **#63 — Loading truth & safe badge fallback (issues 2, 6).** Unknown/
   missing statuses were rendering green `held_with_geometry`; empty
   bank showed `geoPercent=100`. Fixed: amber NEEDS_REVIEW_CONFIG badge
   (HelpCircle, "Needs Review"), `isLoading` threaded App→DataBankV2→
   (skeleton rows role=status, status bar placeholders), `geoPercent` →
   `—` when bank empty. Skeletons engage only when list empty AND
   loading.
3. **#64 — Dialog & destructive-action safety (issues 4, 5).**
   `WarningEditModal` `requestClose()` (no-op while saving; dirty check
   via `buildPatch()` → confirm discard; wired to Escape/✕/Cancel);
   single-fire guards on ingestion commit (`committedId` keyed to
   `warning_id`), drawer Escape inert while fetching, all 6 list Verify
   buttons (`verifyingIds` Set + `.finally` release).
4. **#65 — Sticky offsets & z-index tokens (issues 3, 8, 16).** Sort strip
   `sticky top-0` was dead (trapped by `overflow-x-auto` ancestor, and
   56px header overlap): hoisted above the scroller,
   `sticky top-[var(--console-sticky-offset)]` (57px). z magic values
   replaced with CSS token scale in index.css: sticky 10 < chrome 50 <
   overlay 60 < fab 65 < overlay-raised 70 (edit modal, was z-[950]).
   Leaflet internal z-scale untouched.
5. **#66 — Copy feedback & focus/name parity (issues 9, 14).** 4 copy
   buttons used raw `navigator.clipboard.writeText` (no feedback,
   swallowed failures) → boolean `copyToClipboard` util (execCommand
   fallback) + "Copied!" feedback keyed per warning id; aria-labels on 12
   icon-only controls + focus-visible rings.
6. **#67 — Verify queue workflow + density floor (issues 15, 10, 11, 12).**
   App rendered WarningDetailModal with no `onVerify`/queue props →
   modal Verify never rendered, queue dead; `currentUnverifiedIndex`
   computed but unconsumed. Fixed: App wires verify/isolation/queue props;
   modal gets `verifyPending` single-fire guard (auto-advance on settle)
   + Prev/Next queue buttons. Density: double page gutter removed
   (DataBankV2 root inside App main padding), v2 rows `py-2 px-3`,
   action strip `mt-1.5`, scroller `max-h-[70vh] min-h-[300px]`,
   mobile cards `p-2.5`. Issue 13 deliberately deferred; legacy table
   path (statically `false`) and page-size options (route-state
   dependent) untouched.

### PR #68 (merged 2026-10-25) — AGENTS.md + this file
Standard-format agent guide at the repo root plus this knowledge appendix,
so agents get conventions and history from the repository itself.

## 4. Roadmap & open threads (as of 2026-10-25)

1. ~~Fix the two Vercel 500s~~ (done, PR #29)
2. ~~Confirm live DB protections~~ — `20261024` RLS migration **confirmed
   applied** 2026-10-24 (pg_policies; zero authenticated write policies)
3. ~~PR #30 pipeline_runs ledger~~ — merged 2026-10-24; `20261026`
   migration applied. **Next: trigger a scraper run, check the run ledger
   panel in `#/audit`.**
4. Console UX audit issue 13 — deliberately deferred
5. Post-deploy check: `/apple-touch-icon.png` 404 (deploy lag pattern)
6. Hygiene: legacy `/export/*` snapshot routes removed (PR #35); GSC
   placeholder + raw 502 passthrough wrapped (PR #37)
7. Vercel Hobby deploy budget: 100 deploys/day — exceeded 2026-10-25
   (`api-deployments-free-per-day`); batch pushes on busy days, treat a
   red Vercel PR status as possibly the rate limit

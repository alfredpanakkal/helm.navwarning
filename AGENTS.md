# AGENTS.md — Working Guide for AI Agents & Contributors

> **Read this file fully before making any change to this repository.**
> It captures the platform architecture, hard conventions, and the verified
> agent workflow used across the merged fix series (PRs #29, #30, #56,
> #62–#67). Everything here was derived from live code, not assumptions.

## 1. Platform at a glance

- **Maritime safety platform (NAVAREA navigational warnings).**
  Production: https://helmwarning.vercel.app/ — public site at `/`
  (Map / Data Bank / Info tabs), admin console at `/console`
  (React 19 SPA; canonical hash routes are the four sections
  `#/warnings/…`, `#/ingest/…`, `#/trace/…`, `#/system/…`;
  legacy aliases `#/map`, `#/databank`, `#/sources`, `#/imports`,
  `#/audit`, `#/evidence`, `#/supabase` still resolve), static login
  gate at `/admin`.
- **Three entry points:** `index.html` (public, vanilla JS, tab-based), `admin.html` (Supabase login → `/console#/warnings/list`), `console.html` (React SPA).
- **Auth:** Supabase Auth; admin = `app_metadata.role` in
  {admin, superadmin} or `is_admin`. Server boundary:
  `server/auth.ts` `verifyAdminRequest` (fail-closed, Bearer JWT).
  All `api/admin/*` functions use it.
- **Vercel runtime:** only `api/*.ts` become serverless functions. The
  `server.ts` Express routes exist only in the self-hosted/dev runtime and
  404 in production. The frontend reads Supabase directly via PostgREST.
- `vercel.json`: cleanUrls, `/about` + `/sources` 301 → `/?tab=info`,
  tile rewrites (carto/osm/openseamap through the single `/api/tiles`
  function), noindex on `/admin` + `/console`. Ingestion is
  backend-driven (Helm.Warning.Backend); the legacy frontend scraper and
  its daily cron were removed (PR #82).

## 2. Data lifecycle invariants (never break these)

- Ingestion is **backend-driven** (Helm.Warning.Backend sync engine);
  this repo does not scrape. In the data it produces, upsert is the only
  write — nothing is ever deleted by ingestion — and `raw_text` is immutable.
- Status whitelist: active / cancelled / expired / superseded / unverified.
- Every warning edit requires an **audit row** (`nav_warning_audits`,
  append-only, RLS no_update/no_delete). Writes are refused if the audit
  trail is unreachable; failed audit inserts persist an AUDIT_FAILED row.
- Optimistic locking via `expected_updated_at` (409 on conflict);
  NAVAREA moves supersede + recreate with rollback safety.
- Single-fire guards: any UI control that triggers an audited or destructive
  write must disable itself while the write is in flight (see
  `verifyPending` in `WarningDetailModal.tsx`, `verifyingIds` in
  `DataBankWarningList.tsx`, `committedId` in `IngestionProcedureModal.tsx`).
  A double-click must never produce two audit rows.
- **Never guess a coordinate hemisphere.** Ambiguous coordinates stay
  flagged `AMBIGUOUS` for human review — the parser stamps rule-parsed
  points `RULE_PARSED` (PR #42), never `VERIFIED`; only a human verifies.
- **Verify semantics (decided 2026-10-26, PRs #73–#75).** An audited
  VERIFY appends the 'verified_by_admin' qa_flag and promotes Tier B → Tier A
  only when every Tier A invariant already holds (EXPLICIT quality, ≥ 1
  geometry, no unplotted_reason, not superseded); otherwise it stays
  flag-only and the row remains a review candidate. The 'verified_by_admin'
  flag is exempt from the derived-confidence penalty, and the client
  repaints verified rows with the server-returned values only — never
  fabricated status, confidence or geometry validation.
- **Never re-run migrations blindly.** Check pg_policies / migration
  history first; do not migrate the backend wholesale — build on the
  existing architecture.

## 3. Hard conventions

### Serverless imports (PR #29)
`"type": "module"` means Vercel functions run as Node ESM: **every relative
import in any file reachable from `api/` MUST use explicit `.js`
specifiers** (e.g. `'../lib/supabaseClient.js'`). Extensionless imports
throw ERR_MODULE_NOT_FOUND at module load and 500 every request — this
silently killed the daily cron once.

### z-index (PR #65)
Never introduce magic z values. Use the CSS token scale in `index.css`:
`--z-console-sticky: 10` < chrome `50` (header) < overlay `60`
(detail/ingestion/drawer/login scrims) < `fab: 65` < `overlay-raised: 70`
(edit modal). Sticky strips use `top-[var(--console-sticky-offset)]` (57px).
Leaflet's internal z-scale is untouched.

### Routing & deep links (PR #62)
Hash-route grammar + Data Bank query params live in `src/lib/consoleRoute.ts`
(pure, unit-tested). App re-exports the grammar for legacy import sites.
Known limitation: `sort`/`dir` deep-link params are only active in custom
sort mode.

### Loading truth (PR #63)
Unknown/missing statuses render an amber NEEDS_REVIEW_CONFIG badge, never a
green fallback. Empty-state copy only renders when data is actually loaded;
skeletons (`LoadingSkeletonRows`, role="status") cover the initial fetch.

### Serverless function budget (Vercel Hobby)
The Hobby plan caps serverless functions at **12**; only `api/*.ts` files
count. The three tile proxies (carto/osm/openseamap) were consolidated into
one `/api/tiles` function when a 13th function broke deployment
(PR #29-era fix). **Do not add a new `api/*.ts` file without consolidating
an existing one or upgrading the plan.**

### Console UX audit series (PRs #62–#67, all merged)
16-issue audit fixed in 6 PRs: routing/deep-links, loading truth, dialog &
destructive-action safety, sticky offsets/z-tokens, copy feedback & a11y
naming, verify-queue workflow + Data Bank density. **Issue 13 is
deliberately deferred** — check it is still open before re-planning it.

### Design system (PRs #94–#96, #102–#104, merged)
The UI follows the Helm.Ports constraints declared at the top of
`src/index.css` and `public/assets/css/tokens.css`: single accent
`#2b6e8c`, weight 500 max (enforced by CSS), no shadows, no hover
lift/scale, Inter only, tokens over hardcoded values. Details:
`DESIGN.md`, one-page rules `UI-DESIGN-FUNDAMENTALS.md`. Console shell
is fluid full-width with a fixed left rail; the warning editor is a
right-side drawer.

## 4. Required agent workflow (for every change)

1. **Verify against live code.** Fetch the current files via the GitHub API
   (or check out the branch) and re-derive the root cause from what you read.
   Notes, summaries, and prior analyses are context — live code wins.
2. **Branch off merged `main`** (`console-ux-<nn>-<theme>`,
   `docs-<theme>`, `fix-<area>-<theme>` — descriptive kebab-case).
3. **Small themed commits**, one concern each, with file lists in the
   message body.
4. **Verify every push:** read the touched files back from the branch head
   and check they are byte-equal to the pushed content; scan for mojibake
   (`/[\u00C3\u00C2]/` — U+00C3/U+00C2 in sequence) if the toolchain
   re-encodes text.
5. **Open a PR** (draft, then ready) against `main` with this body shape:
   Summary · Root cause (verified against live code) · Changes per commit ·
   Maintainer checklist · Preview test plan · Out of scope · Evidence trail
   (branch, base sha, head sha, commit shas).
6. **Never merge your own PR** — the maintainer reviews, runs
   `npm run lint` + `npm test` (agents cannot run them in this
   environment), and merges. Confirm the new `main` sha after merge.
7. **Never push binary files through text-based API pushes** — bytes ≥ 0x80
   (any PNG, 0x89 signature) get UTF-8 double-encoded and corrupt. The
   maintainer uploads binaries manually (see apple-touch-icon, PR #56).

## 5. Project knowledge & change history

Full durable knowledge — architecture facts, verified security/lifecycle
state, per-PR root causes (PRs #29, #30, #56, #62–#67), and the active
roadmap — lives in [`docs/PROJECT_KNOWLEDGE.md`](docs/PROJECT_KNOWLEDGE.md).
Keep it updated when merging PRs that change conventions or fix root
causes; keep this file lean.

## 6. Open threads (as of 2026-10-26)

- Verify series #73–#75 (merged 2026-10-26): the agent never ran lint,
  vitest or `npm run ux:smoke` — run the ux:smoke verify-safety suite
  (E2E_ admin env vars) and a preview Quick Verify on a Tier B row with and
  without geometry before relying on the promotion path.
- Console UX audit issue 13 — deliberately deferred.
- Live DB state (maintainer-verified 2026-10-24): the `20261024` RLS
  migration **and** `20261026_pipeline_runs.sql` (PR #30, merged) are both
  applied to live Supabase; zero authenticated write policies remain.
  Re-check pg_policies before any migration work.
- Vercel Hobby deploy budget: **100 deploys/day** — once exceeded,
  deployments fail with `api-deployments-free-per-day` until the next day
  (hit 2026-10-25 after the 6-PR UX series). A red Vercel status on a PR
  can be this rate limit, not a build failure; GitHub Actions are the
  build gate.
- Post-deploy check: `https://helmwarning.vercel.app/apple-touch-icon.png`
  returned 404 shortly after PR #56 merge (deploy lag pattern; verify).
- Hygiene: legacy `/export/*` snapshot routes and GSC placeholder meta
  were removed and raw 502 passthroughs wrapped (PRs #35–#37, 2026-10-24).
  Remaining minor: raw Supabase error detail in some admin-only scrape
  paths (intentional operational detail), CORS `*` on Bearer-only admin
  APIs (cosmetic).
- Keep-decisions (maintainer, 2026-10-24): Parser v3 files are unfinished
  but KEPT — wire in later, never delete; docs are Gemini-only (Mistral
  removed intentionally); single-file offline export intentionally gone.
  Details in `docs/PROJECT_KNOWLEDGE.md` §4 item 8.
- SSRF guard (`server/ssrfGuard.ts`) has no dedicated test — add one before
  touching it.
- Undecided UX from the early era: on map update, pulse the marker vs
  auto-zoom to the new warning (auto-zoom can yank a watchkeeper’s view;
  a pulse is gentler but can be missed). No decision recorded.
- Domain purchase undecided — site remains on `helmwarning.vercel.app`
  (early-history context: PROJECT_KNOWLEDGE §5).
- Roadmap order is maintained in the maintainer's private notes; when in
  doubt, ask in the issue/PR rather than re-prioritizing unilaterally.

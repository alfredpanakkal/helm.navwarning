# AGENTS.md — Working Guide for AI Agents & Contributors

> **Read this file fully before making any change to this repository.**
> It captures the platform architecture, hard conventions, and the verified
> agent workflow used across the merged fix series (PRs #29, #30, #56,
> #62–#67). Everything here was derived from live code, not assumptions.

## 1. Platform at a glance

- **Maritime safety platform (NAVAREA navigational warnings).**
  Production: https://helmwarning.vercel.app/ — public site at `/`,
  admin console at `/console` (React 19 SPA, hash routes: `#/map`,
  `#/databank`, `#/sources`, `#/workspace`, `#/imports`, `#/manual`,
  `#/audit`, `#/evidence`, `#/supabase`), static login gate at `/admin`.
- **Three entry points:** `index.html` (public, vanilla JS, tab-based),
  `console.html` (React SPA), `admin.html` (Supabase login redirect).
- **Auth:** Supabase Auth; admin = `app_metadata.role` in
  {admin, superadmin} or `is_admin`. Server boundary:
  `server/auth.ts` `verifyAdminRequest` (fail-closed, Bearer JWT).
  All `api/admin/*` functions use it.
- **Vercel runtime:** only `api/*.ts` become serverless functions. The
  `server.ts` Express routes exist only in the self-hosted/dev runtime and
  404 in production. The frontend reads Supabase directly via PostgREST.
- `vercel.json`: cleanUrls, tile rewrites (carto/osm/openseamap),
  noindex on `/admin` + `/console`, daily cron `/api/scrape-navwarn` 06:00.

## 2. Data lifecycle invariants (never break these)

- The scraper is **upsert-only — it never deletes**; `raw_text` is immutable.
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

## 3. Hard conventions

### Serverless imports (PR #29)
`"type": "module"` means Vercel functions run as Node ESM: **every relative
import in any file reachable from `api/` MUST use explicit `.js`
specifiers** (e.g. `'../lib/supabaseClient.js'`). Extensionless imports
throw ERR_MODULE_NOT_FOUND at module load and 500 every request — this
silently killed the daily cron once.

### z-index (PR #65)
Never introduce magic z values. Use the CSS token scale in `index.css`:
`--z-console-sticky: 10` < chrome `50` (header/bottom-nav) < overlay `60`
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

### Console UX audit series (PRs #62–#67, all merged)
16-issue audit fixed in 6 PRs: routing/deep-links, loading truth, dialog &
destructive-action safety, sticky offsets/z-tokens, copy feedback & a11y
naming, verify-queue workflow + Data Bank density. **Issue 13 is
deliberately deferred** — check it is still open before re-planning it.

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

## 6. Open threads (as of 2026-10-25)

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
- Hygiene: legacy `/export/*` snapshots publicly reachable (recommend
  removal), GSC verification token placeholder in index.html.
- Roadmap order is maintained in the maintainer's private notes; when in
  doubt, ask in the issue/PR rather than re-prioritizing unilaterally.

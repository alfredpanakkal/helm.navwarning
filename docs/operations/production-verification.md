# Production verification

Production: https://helmwarning.vercel.app
Checker: `npm run verify:prod` — exit 0 means every fail-severity check passed.

**Current status: RED.** The baseline recorded on 2026-10-05 exits **1**, not 0: the
fail-severity check `no unexpected console errors` fails because three `/api/*`
endpoints the client calls (`/api/sources`, `/api/generations`, `/api/artifacts`)
return 404 in production. `npm run verify:prod` is expected to keep exiting 1 until
that is resolved app-side or deployment-side. Full evidence and the reasoning are in
[Baseline](#baseline).

## How to verify a deployment

1. `git fetch origin && git rev-parse origin/main` — note the commit.
2. Read the newest Production deployment's `created_at` and `sha` (the API returns
   newest first), and record both next to the `origin/main` sha from step 1.

   **bash / Linux / macOS** — `--jq` is gh's own filter engine, so no `jq` binary is
   needed:

   ```bash
   gh api "repos/alfredpanakkal/helm.navwarning/deployments?per_page=10" --jq '.[] | select(.environment=="Production") | "\(.created_at) \(.sha)"'
   ```

   **Windows PowerShell 5.1 — use this form instead.** The `--jq` one-liner above does
   *not* run there: PowerShell splits the argument on the embedded double quotes and gh
   fails with `gh : accepts 1 arg(s), received 2`. Let gh emit plain JSON and filter in
   PowerShell. Keep the parentheses — `ConvertFrom-Json` on a JSON array emits one
   un-enumerated object, so without them `Where-Object` and `Select-Object -First 3`
   operate on the whole array and the output is silently wrong (every deployment's
   dates and shas concatenated on one line, non-`Production` environments included):

   ```powershell
   (gh api "repos/alfredpanakkal/helm.navwarning/deployments?per_page=10" | ConvertFrom-Json) | Where-Object { $_.environment -eq 'Production' } | Select-Object -First 3 | ForEach-Object { "$($_.created_at) $($_.sha)" }
   ```

   Parity is a **recorded fact, not a pass/fail gate**. Production legitimately
   lags `origin/main` whenever a merge is still open or a build has not finished;
   record the lag and its commit, do not fail the verification on it.

3. `npm run verify:prod` — expect exit 0. Until the recorded red baseline below is
   resolved, expect exit 1 instead; see [Baseline](#baseline).
4. On failure, keep the evidence: `node scripts/verify-deployment.mjs --url https://helmwarning.vercel.app --expect-headers any --json verify.json --screenshot verify.png`.

The same command is also packaged as the `verify-production` workflow
(`.github/workflows/verify-production.yml`), which runs it in CI on Node 22. It is
**dispatched by hand — nothing runs automatically on deploy**. The first dispatch is
only possible once that file is merged to the default branch; from then on
`gh workflow run verify-production --ref main` starts a run,
`gh run list --workflow verify-production --limit 1` finds it, and `gh run watch`
follows it to completion. **Expect that run to be RED** until the three dead `/api/*`
endpoints below are resolved — a failing check on a genuinely broken deployment is the
intended signal, not a broken workflow. Either way the run uploads a `verify-report`
artifact containing `verify.json` and `verify.png` (the upload step is `if: always()`),
so the screenshot is available exactly when it is needed.

## Deployment shape (verified 2026-10-05)

- Static Vite build served by Vercel's filesystem layer: `GET /` returns
  `X-Vercel-Cache: HIT`, `Server: Vercel`, and HSTS `max-age=63072000`
  (Vercel's default, not the app's 31536000).
- Six Vercel Functions in `api/`: `admin/login`, `admin/test-gemini`,
  `admin/verify`, `scrape-navwarn`, `supabase/status`, `supabase/sync`.
- `server.ts` is NOT deployed. Consequences:
  - the app's CSP/security headers do not run (no CSP, no X-Frame-Options,
    no X-Content-Type-Options on the document response);
  - `GET /api/health` -> 404 `X-Vercel-Error: NOT_FOUND`;
  - `GET /api/warnings` -> 404, so the client falls back to bundled sample data;
  - `GET /api/tiles/carto/voyager/1/0/0` -> 404, so the CARTO layer options in
    the layer picker are broken in production (the default Esri basemap is not).
- The `vercel.json` cron target `/api/scrape-navwarn` does exist and returns 401
  without credentials, as expected.
- The client also calls three endpoints that have no Vercel Function at all:
  `GET /api/sources`, `GET /api/generations`, `GET /api/artifacts` all return 404.
  They come from `src/services/api.ts` (`fetchSources`, `fetchGenerations`,
  `fetchArtifacts`); each catches the failure and falls back to local data, so the
  app stays usable, but every 404 still emits a browser console error. This is
  the current cause of the baseline failure below.

## Baseline

Recorded 2026-10-05, against the commit production is actually serving.

- Deployment-to-`main` parity: `origin/main` = `3b3afe553523d748df96c573c8b8ae0441e356c7`;
  newest Production deployment = `3b3afe553523d748df96c573c8b8ae0441e356c7`
  created `2026-10-05T07:07:36Z`. **At parity.** PR #4
  (`fix/csp-esri-basemap`, head `de8065f`) was still OPEN at the time of this run,
  so its work is not in production and a redeploy is not pending on this branch.
- Command: `npm run verify:prod -- --json "$env:TEMP/verify-prod.json" --screenshot "$env:TEMP/verify-prod.png"`
- Exit code: **1** (one fail-severity check failed).
- Result line: `9/10 passed (FAILED)` — 10 checks, 1 fail-severity failure. The
  three CSP-derived checks report WARN because production serves no CSP at all.
- Tiles: `36/36 tiles decoded` (Esri basemap fully loads; there is no CSP in
  production to block it). Map mounted with 4 markers.
- Failing check, verbatim:

  ```
  FAIL  no unexpected console errors  -- Failed to load resource: the server responded with a status of 404 () | Failed to load resource: the server responded with a status of 404 () | Failed to load resource: the server responded with a status of 404 ()
  ```

- Same run, the associated 4xx line (severity `warn`):

  ```
  WARN  no unexpected HTTP 4xx/5xx  -- 404 https://helmwarning.vercel.app/api/generations | 404 https://helmwarning.vercel.app/api/sources | 404 https://helmwarning.vercel.app/api/artifacts | 404 https://helmwarning.vercel.app/favicon.ico
  ```

### Reading this baseline

The baseline is a **red** baseline, recorded as observed on 2026-10-05 and not
worked around. The checker's known-missing allowlist covers only `/api/warnings`,
`/api/health`, and `/api/tiles/`; the three dead client calls above are outside it,
so their 404s surface as unexpected console errors and the run exits 1. The failure
is deterministic — two independent runs on 2026-10-05 produced byte-identical check
lines.

Resolution belongs in the app or the deployment, not in the checker: either deploy
the missing endpoints, or stop calling them client-side (or accept them explicitly,
with that decision recorded here). `scripts/verify-deployment.mjs`,
`scripts/fixtures/csp-blocked-fixture.mjs`, and the `verify:*` npm scripts were
deliberately left unmodified so this baseline keeps its teeth. Do not expect exit 0
until one of those is done.

`GET /favicon.ico` also 404s. It is excluded from the console-error check by the
checker's `/favicon/i` filter and only appears in the 4xx WARN, so it does not
affect the exit code — but it is a real (cosmetic) production gap.
# Helm.Warning

Automated ingestion pipeline, nautical warning dataset, spatial geometry
parser, and OpenSeaMap view for NAVAREA navigational warnings.

Live: <https://helmwarning.vercel.app>

## Stack

- React 19 + TypeScript + Vite 6 + Tailwind CSS 4 (UI)
- Express (`server.ts`) — dev server and production entry
- Leaflet + leaflet.markercluster (map)
- Supabase (auth + data), Google Gemini / Mistral (AI extraction)
- Vercel (deploy; nightly `0 6 * * *` cron for `/api/scrape-navwarn`)

## Quick start

```bash
git clone https://github.com/alfredpanakkal/helm.navwarning.git
cd helm.navwarning
npm install
cp .env.example .env   # fill in the secrets listed below
npm run dev            # http://localhost:3000
```

Environment variables (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | AI extraction (required) |
| `MISTRAL_API_KEY` | Failover AI provider (optional) |
| `CRON_SECRET` | Authorizes Vercel cron calls to `/api/scrape-navwarn` |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Auth + data |
| `CARTO_API_KEY` | Basemap tiles (server-side secret) |

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on :3000 |
| `npm run build` | Production build (client bundle + `dist/server.cjs`) |
| `npm start` | Serve the production build |
| `npm run clean` | Remove `dist/` |
| `npm run lint` | Type-check (`tsc --noEmit`) |
| `npm run dev:audit` | Dev server for UX audits (HMR disabled) |
| `npm run ux:capture` | Capture DOM + screenshot evidence into `docs/ux-audit/` |
| `npm run ux:capture:live` | Same, against the live deployment |
| `npm run ux:smoke` | Playwright "do-not-break" suite (16 tests) |
| `npm run verify:dev` | Verify the local deployment (security headers present) |
| `npm run verify:prod` | Verify the production deployment |
| `npm run verify:selftest` | Prove the deployment verifier's own checks fire |

> **Windows note:** `npm run build` embeds a UTC timestamp via `$(date -u ...)`,
> which needs a POSIX shell. On Windows use Git Bash, or run `npx vite build`
> directly.

## UX audit & regression tests

- `docs/ux-audit/do-not-break.md` — the contract the app must keep.
- `docs/ux-audit/inventory.md` — full UI inventory.
- `scripts/ux-audit/tests/do-not-break.spec.ts` — 16 Playwright tests guarding
  that contract; `npm run ux:smoke` boots a fresh `dev:audit` server on :3000
  automatically.
- `docs/ux-audit/dom/` and `docs/ux-audit/screenshots/` — frozen baseline
  evidence. **Never commit regenerated captures**: after `ux:capture`, restore
  the baselines with `git checkout -- docs/ux-audit`.

### Smoke-suite gotcha

`playwright.config.ts` reuses an already-running server on :3000
(`reuseExistingServer: true`) and the audit server runs with HMR disabled, so a
stale server can keep serving old code and make results misleading. Before a
run, kill anything listening on :3000 so Playwright starts a fresh server
(PowerShell: `Get-NetTCPConnection -LocalPort 3000`).

## Production verification

`npm run verify:prod` checks the live deployment; exit 0 means every
fail-severity check passed. The manual GitHub Actions workflow
(`.github/workflows/verify-production.yml`) runs the same checker against any
URL and uploads a JSON + screenshot artifact. Full runbook, PowerShell-parity
commands, and the current baseline status:
`docs/operations/production-verification.md`.

## Project layout

```
src/       React app (components/, hooks/, services/, data/)
api/       Vercel functions (scrape-navwarn cron, admin, supabase)
server/    Express helpers (auth, security headers, SSRF guard)
scripts/   ux-audit/ (capture driver + smoke tests) and deployment verifiers
docs/      UX audit evidence and operations runbooks
```

## Design docs

- `DESIGN.md` — GATEWORKS design system (palette, component patterns).
- `UI-DESIGN-FUNDAMENTALS.md` — UI fundamentals.

# Code Review — `helm.navwarning`

**Commit reviewed:** `de8065f` (branch `fix/csp-esri-basemap`, HEAD)
**Date:** 2026-10-06
**Supersedes:** the 2026-09-30 review of `fb7024e` (all 13 prior findings re-verified below)
**Scope:** 66 tracked files. Analysis targets `helm.navwarning/` only; the `worktrees/verify-prod/` git worktree (`test/production-verification` branch) and root-level `graphify-out/`/`docs/` are out of scope.
**Method:** baseline build verification (tsc/vite/esbuild) → re-verification of every prior finding against source → `knip` dead-code analysis with manual confirmation of every reported symbol → import-graph analysis (50 nodes, 107 edges) → direct security review of the server and serverless surfaces.

---

## Verdict

**The repository builds and type-checks cleanly** — the 2026-09-30 "does not build" blocker is fully resolved (`3d75c4c` restored the deleted data layer; `npx tsc --noEmit` exits 0, `vite build` and the esbuild server bundle both succeed).

Three things have clearly improved since the last review: the missing modules were restored, CI was added (`fb7532e`, `.github/workflows/ci.yml`), and the duplicate lockfile was removed.

**But 10 of the 13 prior findings remain open**, three new High-severity security findings were found (an unauthenticated AI-quota-burning route, a hardcoded API key, and credentialed wildcard CORS on *all five* Vercel handlers instead of just one), and this review adds a full dead-code inventory: **1 dead component file, 6 dead functions, 1 dead type, 53 over-exported symbols, 5 unused dependencies, 4 orphaned server routes, and 1.1 MB of orphaned build artifacts shipped in every deploy.**

### Baseline (measured this session)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vite build` | ✅ exit 0 — 955 kB main chunk (>500 kB warning) |
| `npx esbuild server.ts …` | ✅ exit 0 — 188 kB `dist/server.cjs` |
| `npm run build` | ❌ **fails on Windows** — bash-only `$(date …)` syntax (`package.json:8`); works on CI (Ubuntu) |
| Tests | ❌ 0 test files; no test script |
| ESLint | ❌ absent; `"lint"` is `tsc --noEmit` |

---

## Part A — Status of the 13 findings from the 2026-09-30 review

| # | Prior finding | Status @ `de8065f` | Evidence |
|---|---|---|---|
| 1 | 13 modules + 8 types imported but absent (Blocker) | ✅ **Fixed** | Restored in `3d75c4c`; all 8 types (`NavWarning`, `IngestionGeneration`, `RawArtifact`, `SourceRegistryItem`, `PipelineRunRecord`, `PipelineSystemStatus`, `NavAreaId`, `PipelineEvent`) now declared in `src/types.ts`; `tsc` exits 0 |
| 2 | Cron targets a dead endpoint (Blocker) | ✅ **Fixed** | `api/scrape-navwarn.ts:3-7` imports resolve; auth fails closed when `CRON_SECRET` unset (`:37`), timing-safe compare (`:43`) |
| 3 | SSRF allowlist fails open when empty | ❌ **Still open** | `server/ssrfGuard.ts:164` — `if (!allowedHostnames \|\| allowedHostnames.length === 0) return true;` |
| 4 | IPv6 blocklist misses 5 address families | ❌ **Still open** | `ssrfGuard.ts:114-145` unchanged (no 6to4/NAT64/`fec0`/`ff00`/hex-mapped handling); `:215` still passes bracketed literals to `net.isIP` |
| 5 | Credentialed wildcard CORS on admin login | ❌ **Still open, and wider than reported** | `api/admin/login.ts:13-15` — now confirmed on **all 5** handlers that set CORS (see N3) |
| 6 | No rate limit on admin login | ⚠️ **Half fixed** | Express twin (`server.ts:507`) is now covered by `globalApiLimiter` (`server.ts:466`, 100 req/15 min); Vercel `api/admin/login.ts` still has **no limiter** (see N4) |
| 7 | `JSON.parse` outside `try` (`login.ts:29`) | ❌ **Still open** | parse at `:29`, `try` starts at `:50` |
| 8 | Four env-var naming conventions | ❌ **Still open** | 13 distinct names now (see N13) |
| 9 | Internal hostname leaked in `User-Agent` | ❌ **Still open** | `ssrfGuard.ts:302` embeds `ais-pre-…run.app` service URL |
| 10 | `server.ts` monolith (2,249 lines) | ❌ **Still open** | 2,521 physical lines / 2,249 non-empty (the prior figure counted non-empty lines); 27 Express routes in one file |
| 11 | No tests, no CI, no ESLint | ⚠️ **Partial** | CI added (`.github/workflows/ci.yml`: `npm ci` + `tsc` + `vite build`); still 0 tests, no ESLint |
| 12 | Two competing lockfiles | ✅ **Fixed** | `fb7532e`; only `package-lock.json` remains |
| 13 | Design doc contradicts shipped fonts | ❌ **Persists (details changed)** | `UI-DESIGN-FUNDAMENTALS.md:8` still mandates `'Courier New'`; `index.html:15` now ships **IBM Plex** Mono/Sans (was JetBrains Mono/Inter) |

---

## Part B — New findings

| # | Sev | Location | Issue |
|---|---|---|---|
| N1 | **High** | `server.ts:1471` | Unauthenticated route spends up to 20 Gemini calls per request |
| N2 | **High** | `server.ts:2473` | Hardcoded CARTO API key as env fallback, committed to git |
| N3 | **High** | 5 Vercel handlers | Credentialed wildcard CORS is repo-wide, not just `login.ts` |
| N4 | **High** | `api/admin/login.ts` | Vercel admin login has no rate limit (its Express twin does) |
| N5 | Medium | `server.ts` vs `api/` | Two parallel backends implementing the same routes, drifting |
| N6 | Medium | `package.json:8` | `npm run build` broken on Windows |
| N7 | Medium | `.github/workflows/ci.yml` | CI never builds or runs the server bundle; no lint/test gate |
| N8 | Medium | dead-code cluster | 4 Express routes whose only client functions are dead (see D4) |
| N9 | Low | `server.ts:2401` | Unauthenticated external-API proxy (caller-supplied key, fixed host) |
| N10 | Low | `package.json:33,47` | `vite` declared in both `dependencies` and `devDependencies` |
| N11 | Low | `package.json:2` | Package still named `react-example` |
| N12 | Low | `App.tsx` ↔ `Header.tsx`/`WorkspaceView.tsx` | Type-only import cycles via `TabType` |
| N13 | Low | `.env.example:14` | `SUPABASE_JWKS_URL` is read by no code; 13 env names, 4 conventions |
| N14 | Low | `metadata.json`, `firebase-applet-config.json` | Both describe *other* products (DocuFlow; Firebase project `gen-lang-client-0431355172`) — identity drift |

### N1 — Unauthenticated route burns AI quota (`server.ts:1471`)

```ts
app.post('/api/pipeline/parse-markdown', async (req, res) => {   // no requireAdmin
  ...
  const chunks = splitIntoChunks(markdown, 10000);
  ...
  const MAX_AI_CALLS = 20;
```

Every other AI route is mounted `requireAdmin, aiRouteLimiter` (`:589`, `:650`, `:1641`, `:1929`, `:2081`, `:2133`, `:2180`). This one is public, protected only by the global limiter (100 requests / 15 min / IP, `server.ts:466`) — an unauthenticated caller can force up to 20 Gemini calls per request until the IP budget runs out, then rotate `X-Forwarded-For` (`trust proxy` is set at `:420`).

**Fix:** add `requireAdmin` (and the AI limiter) to match its siblings.

### N2 — Hardcoded API key (`server.ts:2473`)

```ts
const apiKey = process.env.CARTO_API_KEY || 'cb1_3orr_1_f228f632545fb6733113f41c';
```

The comment at `:2430` claims the proxy exists "so CARTO_API_KEY remains a secure secret", yet a working key is committed as the fallback. CARTO web keys are low-sensitivity by design, but this defeats the secret entirely and will silently keep working after the env var is "removed".

**Fix:** delete the fallback; fail with a clear 503 when `CARTO_API_KEY` is unset. Rotate the key.

### N3 — Credentialed wildcard CORS on every Vercel handler

Identical pattern in **all five** handlers that emit CORS:

| File | Lines |
|---|---|
| `api/admin/login.ts` | 13-15 |
| `api/admin/verify.ts` | 12-14 |
| `api/admin/test-gemini.ts` | 14-15 |
| `api/supabase/status.ts` | 6-7 |
| `api/supabase/sync.ts` | 13-15 |

```ts
res.setHeader('Access-Control-Allow-Credentials', 'true');
res.setHeader('Access-Control-Allow-Origin', '*');
```

Browsers reject this combination today (which is why nothing has broken), but the obvious "fix" — reflecting `req.headers.origin` — silently enables cross-origin credentialed admin auth on *five* endpoints. `Allow-Methods` also advertises verbs the handlers reject.

**Fix:** one shared CORS helper that echoes `Origin` only against an explicit allowlist (or drops `Allow-Credentials` entirely, since auth travels in `Authorization`, not cookies).

### N4 — Vercel admin login is unrate-limited

`api/admin/login.ts:51` calls `supabase.auth.signInWithPassword` with no limiter. The Express twin (`server.ts:507`) is covered by `globalApiLimiter` (`:466`), so **the same endpoint has rate limiting in self-hosted deployments and none on Vercel** — where the daily cron already runs, i.e. the deployment most likely to be publicly reachable. Distinct `401 INVALID_CREDENTIALS` (`:56`) vs `403 INSUFFICIENT_PRIVILEGES` (`:63`) still let an attacker distinguish valid accounts.

### N5 — Two parallel backends, duplicated logic

`server.ts` implements 27 Express routes; `api/` re-implements a subset as Vercel functions (login, logout/verify, status, sync, test-gemini, scrape-navwarn). The admin-login logic is copy-pasted (`server.ts:507-567` vs `api/admin/login.ts:11-89` — nearly identical, including the `passcode` alias). Every fix must be applied twice; N3/N4 show the copies have already drifted (the Express path has a limiter, the serverless one doesn't).

**Fix:** extract shared handlers consumed by both adapters, or pick one deployment target.

### N6 — `npm run build` is not cross-platform

`package.json:8`: `VITE_APP_BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ") vite build && esbuild …` — POSIX syntax; on Windows npm shells this out to cmd and fails with `'VITE_APP_BUILD_TIME' is not recognized`. CI (Ubuntu) and Linux contributors are unaffected, Windows contributors cannot run the documented build at all.

**Fix:** use `cross-env` / a Node script, or set the variable inside `vite.config.ts`.

### N7 — CI gaps

`.github/workflows/ci.yml` runs `npm ci`, `npx tsc --noEmit`, `npx vite build`. It never runs the esbuild half of the build (so `dist/server.cjs` — the production server — is never compiled in CI), never runs `npm run build` (which would fail even on Windows), and there is no lint or test step. 0 test files exist anywhere in the tree.

### N8 — Orphaned server routes

Four Express routes whose **only in-repo client functions are dead code** (see D4): `/api/parse-navwarn`, `/api/enrich-evidence`, `/api/pipeline/status`, `/api/pipeline/last`. Not "dead" in the reachability sense — they are still deployed and callable — but nothing in this codebase exercises them, which means they ship with zero regression coverage and (for `/api/enrich-evidence`) keep the 423-line SSRF guard live behind a route the UI never calls.

---

## Part C — Dead code inventory

Tooling: `knip` (entries: `index.html`, `server.ts`, `api/**/*.ts`, `vite.config.ts`; project: `src/`, `server/`, `api/`) — **every reported item was then manually re-verified with repo-wide reference counts**, because knip cannot see all dynamic-import patterns and cannot distinguish "export unused" from "symbol unused".

Raw knip output: **1 unused file, 3 unused dependencies, 4 unused devDependencies, 33 unused exports, 27 unused exported types.** After manual confirmation the picture is:

### D1 — Dead component file (confirmed unused)

| File | Size | Evidence |
|---|---|---|
| `src/components/GenerationsView.tsx` | 4,675 B / 85 lines | 0 importers repo-wide; 0 in-degree in the import graph; knip "unused files" |

It renders the "Ingestion Generation Audit Logs & Pointer History" table. The active UI instead uses `GenerationInspectorView` (`App.tsx:397`), which takes the same `generations` prop. **Safe to delete** — no dynamic import, no lazy route.

### D2 — Fully dead functions/consts (~104 lines)

| Symbol | Location | Size | Why dead |
|---|---|---|---|
| `fetchPipelineStatus()` | `src/services/api.ts:261-276` | 16 lines | 0 call sites; calls `/api/pipeline/status` |
| `fetchLastPipelineRun()` | `src/services/api.ts:278-287` | 10 lines | 0 call sites; calls `/api/pipeline/last` |
| `parseNavwarn()` | `src/services/api.ts:423-442` | 20 lines | 0 call sites — superseded by `parseManualWarning()` (`api.ts:531`, used by `App.tsx:181`) |
| `enrichEvidence()` | `src/services/api.ts:448-467` | 20 lines | 0 call sites; calls `/api/enrich-evidence` |
| `formatCoordinates()` | `src/utils/statusModel.ts:183-213` | 31 lines | 0 references anywhere |
| `MAP_LAYERS_REGISTRY` | `src/config/mapLayers.ts:84-90` | 7 lines | 0 references; `BASE_LAYERS`/`OVERLAY_LAYERS` are consumed directly |

Each has exactly one repo-wide reference: its own declaration line. **Delete-safe**, but see D4 first — deleting the client functions orphans their four server routes.

### D3 — Dead type

- `SupabaseNavWarningRow` — `src/types.ts:193` — declared, never referenced (1 total reference: the declaration).

### D4 — Orphaned server routes (dual of D2)

| Route | Server line | Only client | Client status |
|---|---|---|---|
| `POST /api/parse-navwarn` | `server.ts:589` | `parseNavwarn()` | dead (D2) |
| `POST /api/enrich-evidence` | `server.ts:650` | `enrichEvidence()` | dead (D2) |
| `GET /api/pipeline/status` | `server.ts:770` | `fetchPipelineStatus()` | dead (D2) |
| `GET /api/pipeline/last` | `server.ts:804` | `fetchLastPipelineRun()` | dead (D2) |

**Important consequence:** `safeFetch` (the entire `server/ssrfGuard.ts`, 423 lines) has exactly one caller — `server.ts:662`, inside `/api/enrich-evidence`. The SSRF guard therefore runs only when something external calls a route this UI never calls. Prior review findings 3/4 (fail-open allowlist, IPv6 gaps) are real, but their blast radius today is this dormant path. Note the routes are still publicly reachable (with `requireAdmin`), so "no client" ≠ "unreachable" — decide explicitly: wire a client, or remove route + guard together.

### D5 — Over-exported symbols (53, `export` keyword only)

Used **inside their own file only** — no external consumer. Harmless, but they mislead static analysis (they are exactly what made knip report 60 "unused" symbols) and widen each module's apparent API:

- **27 functions/consts:** `extractBearerToken` (`server/auth.ts:37`), `isPrivateIPv4` (`ssrfGuard.ts:70`), `isPrivateIPv6` (`:114`), `isDisallowedIP` (`:150`), `isHostnameAllowed` (`:163`), `ALL_NAVAREAS` (`DataBank.tsx:56`), `isCoastalWarning` (`LeafletMap.tsx:36`), `SpatialGeometrySchema`, `NavWarningLLMSchema` (`navWarningSchema.ts:3,10`), `mapSupabaseRowToNavWarning`, `getAdminHeaders` (`api.ts:26,387`), `dmsToDecimal`, `parseSingleCoordinatePair`, `findFirstPoint`, `classifyGeometryIntent` (`coordinateParser.ts:129,141,546,695`), `stripMarkdown`, `extractNavAreaFromText`, `extractWarningNumberAndYear`, `parseMarkdownTables`, `parseMarkdownSections` (`markdownParser.ts:7,27,55,105,295`), `calculateBearingAndDistance` (`nauticalExport.ts:8`), `classifyHazardCategory`, `calculateUrgency`, `assessGeoreferenceQuality`, `formatCoordinatesDisplay`, `resolveIssuingAuthority`, `analyzeWarning` (`warningAnalyzer.ts:128,192,286,322,360,389`)
- **26 types:** `AdminUser` (`auth.ts:20`), `SortField`/`SortDirection`/`CoordFilterType` (`DataBank.tsx:81-83`), `ScopeFilterType` (`LeafletMap.tsx:34`), `NavWarnVectorStyle` (`useMapLayers.ts:4`), `SourceVerificationStatus`, `PublicationSemantics`, `WarningStatus`, `StatusBasis`, `TriageDecision`, `TriageRejectionCode`, `AiTriageResult`, `FeatureModificationState` (`types.ts:25,27,63,65,75,77,87,261`), `CoordinateParseSuccess`/`CoordinateParseError` (`coordinateConversion.ts:6,16`), `SemanticGeometryType`, `GeometryInferenceMode`, `GeometryConfidenceLevel`, `CoordinateRole`, `EscalationCondition`, `EvidenceItem`, `CoordinateGroup`, `EnhancedSpatialGeometry` (`coordinateParser.ts:40,55,56,57,69,82,89,99`), `UrgencyLevel`, `GeoreferenceQuality` (`warningAnalyzer.ts:88,90`)

**Fix:** drop `export` (mechanical, no behaviour change); keep for genuinely cross-module types like `NavAreaId`.

### D6 — Unused dependencies

**Runtime (`dependencies`):**

| Package | Verification |
|---|---|
| `@supabase/server` | 0 references anywhere in source |
| `firebase` | 0 imports in `src/`, `server/`, `api/` — the only "firebase" text in the repo is inside the *legacy bundle* `public/export/navwarn-ui.html` (D7) |
| `motion` | 0 references in any `.ts/.tsx/.css` |

**Dev (`devDependencies`):**

| Package | Verification |
|---|---|
| `autoprefixer` | 0 references; no PostCSS config exists (Tailwind v4 via `@tailwindcss/vite` doesn't need it) |
| `vite-plugin-singlefile` | 0 references in source or `vite.config.ts` — referenced only by the legacy script `generate_single_file.sh` (D7) |
| `vite` (duplicate) | declared at `package.json:33` **and** `:47`; the `dependencies` copy is the one knip counts |

**False positive — `tailwindcss`:** knip flags it, but `src/index.css:1` does `@import "tailwindcss"` and `@tailwindcss/vite` requires it as a peer. **Keep.**

**Fix:** remove the three runtime deps, two dev deps, and the duplicate `vite` entry.

### D7 — Orphaned legacy artifacts (≈1.1 MB shipped every deploy)

| Artifact | Size | Status |
|---|---|---|
| `public/export/navwarn-ui.html` | **1,129,873 B** | Single-file build of an *older* app generation — contains an embedded Firebase SDK (`@firebase/app 12.19.0`, auth, Firestore) for a product this source tree no longer uses. Referenced only by `generate_single_file.sh`. Vite copies `public/` → `dist/`, so **1.1 MB of dead UI ships in every production build**. |
| `generate_single_file.sh` | 401 B | Orphaned build pipeline: `npm install vite-plugin-singlefile -D`, GNU-`sed`-patches `vite.config.ts`, runs `npm run build`, then **auto-`git commit`s**. Not referenced by any script/CI. Breaks on Windows/macOS (BSD sed) and would fight the current `vite.config.ts`. |
| `firebase-applet-config.json` | 482 B | Firebase applet config for project `gen-lang-client-0431355172` (a *different* product). 0 code references. Contains an API key + OAuth client ID (Firebase web keys are public-by-design, but they don't belong in this repo). |
| `metadata.json` | 361 B | AI-Studio applet descriptor for **"DocuFlow"** ("code documentation and architecture assistant") — 0 references; describes neither Helm.Warning nor its capabilities. |

**Fix:** delete all four (or, if the single-file export is still a requirement, regenerate it from current source and gate it in CI rather than committing it).

### D8 — Stale configuration

- `.env.example:14` `SUPABASE_JWKS_URL` — read by no code (grep across `src/`, `server/`, `api/`: 0 hits).
- `.env.example:11-12` commits the live Supabase URL + publishable key. Public by design, but they identify the production project; also `.env.example` documents `SUPABASE_SECRET_KEY` while runtime error strings instruct operators to set `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` (`server.ts:1365`, `api/supabase/sync.ts:42`).
- Env names actually read (13 across 4 conventions): `CRON_SECRET`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `CARTO_API_KEY`, `NODE_ENV`, `DISABLE_HMR`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_KEY`, `VITE_SUPABASE_URL/ANON_KEY/PUBLISHABLE_KEY`. The shotgun fallback chain in `src/lib/supabaseServer.ts:9-17` (7 alternate key names) is the symptom.

### Dead-code totals

| Category | Count / size |
|---|---|
| Dead files | 1 (4,675 B) |
| Dead functions/consts | 6 (~104 lines) |
| Dead types | 1 |
| Over-exported symbols | 53 |
| Unused dependencies | 5 (+1 duplicate declaration) |
| Orphaned artifacts | 4 (≈1,131,117 B) |
| Orphaned server routes | 4 |
| Stale env entries | 1 (`SUPABASE_JWKS_URL`) |

---

## Part D — Structural analysis (import graph)

50 source nodes, 107 import edges, computed over `src/` + `server/` + `api/`:

**God nodes (in-degree):** `src/types.ts` (24), `src/utils/coordinateParser.ts` (9), `src/data/sourcesRegistry.ts` (7), `src/lib/supabaseClient.ts` (7), `server/auth.ts` (6), `src/lib/supabaseServer.ts` (6), `src/services/api.ts` (6).

`types.ts` being #1 is healthy (shared vocabulary). The concerning concentration is `server.ts` itself: 2,521 lines holding Express bootstrap, Gemini client + Mistral failover (`:232-365`), chunking (`:380-410`), Supabase hydration (`:1221+`), five in-memory stores, three rate limiters, a CARTO tile proxy (`:2432`), and 27 route handlers.

**Orphans (in-degree 0):** `src/components/GenerationsView.tsx` (dead, D1), `src/vite-env.d.ts` (ambient types — fine).

**Cycles:** `App.tsx → Header.tsx → App.tsx` and `App.tsx → WorkspaceView.tsx → App.tsx` — both caused by `TabType` being declared in `App.tsx` and imported back (`Header.tsx:2`, `WorkspaceView.tsx:4`). **Fix:** move `TabType` to `src/types.ts`.

**Largest files:** `server.ts` 2,521 · `CsvUploaderView.tsx` 1,643 · `DataBank.tsx` 1,594 · `LeafletMap.tsx` 1,051 · `sourcesRegistry.ts` 918 · `api.ts` 798 · `coordinateParser.ts` 713.

**Build warnings worth acting on:** `src/services/api.ts` and `src/data/sourcesRegistry.ts` are each both statically *and* dynamically imported (`App.tsx:30` vs `:144`), so Vite cannot code-split them — contributing to the single 955 kB chunk (gzip 260 kB).

---

## Part E — What's good

- **Build health:** type-check and both build stages pass; CI gates `tsc` + `vite build` on push/PR.
- **Auth design** (`server/auth.ts`): fails closed everywhere, verifies JWT via `supabase.auth.getUser`, checks only `app_metadata` (client-uneditable) with a service-role `admin_users` fallback, never leaks stack traces. Cron auth is timing-safe and fails closed (`api/scrape-navwarn.ts:35-47`).
- **SSRF guard fundamentals** (`server/ssrfGuard.ts`): DNS pinning via `lookup` callback (`:309-318`) kills DNS-rebinding TOCTOU, every redirect hop re-validated (`:269`), size caps on both `content-length` and streamed bytes (`:356-382`), protocol/credential checks (`:190-197`). The fail-open allowlist (`:164`) and IPv6 gaps undermine good work — see prior findings 3/4.
- **Security headers** (`server/securityHeaders.ts`): HSTS+preload, scoped `frame-ancestors`, `report-uri`, Permissions-Policy; latest commit correctly opened `img-src` for Esri and dev `ws:` for HMR.
- **Rate limiting** on the Express path: global (100/15 min), AI (10/min keyed on admin user id), tiles (600/min), `trust proxy` set.
- **`/api/supabase/status`** (`server.ts:1286`) degrades gracefully: unauthenticated callers get `{ok: boolean}` only; full detail requires admin.

---

## Part F — Method and limitations

**Tools:** direct filesystem/git inspection; `npx tsc --noEmit`; `npx vite build`; `npx esbuild` bundle; `npx knip` with explicit entries; repo-wide symbol reference counting for manual confirmation of every knip hit; custom import-graph script (in-degree, orphan, cycle detection).

**Limitations:**

- **No runtime testing.** No request was executed against a live server; route behaviour (e.g. N1's AI spend) is read from code, not observed.
- **"Dead" means "no consumer in this repository."** Server routes (D4) remain externally callable; if a mobile app or third party hits them, they are live. Confirm before deleting routes.
- **knip's CSS awareness is limited** — `tailwindcss` was wrongly flagged (kept, explained in D6). Unused *CSS classes* and `data-*`/reflected string references are not analysed.
- **The root `graphify-out/` graph is stale** (built at `fb7024e`, before the data-layer restore). This review deliberately replaced graph evidence with direct source verification; no graph-derived claim is made here.
- **Not reviewed:** Supabase RLS/table schema, dependency CVEs, AI prompt/output quality, Leaflet runtime behaviour, accessibility (recently fixed per `c621c6a`/PR #2 but not re-audited), performance.
- **Scope:** `helm.navwarning/` only. `worktrees/verify-prod/` (branch `test/production-verification`) was not diffed against `main`; if it has diverged, this review does not cover it.

## Part G — Suggested order of work

1. **N1:** add `requireAdmin, aiRouteLimiter` to `/api/pipeline/parse-markdown` (one-line fix, stops unauthenticated AI spend).
2. **N2:** remove the hardcoded CARTO key fallback and rotate it.
3. **N3/N4:** shared CORS helper across the 5 Vercel handlers + a rate limiter on `api/admin/login.ts`.
4. **Prior 3/4:** invert the SSRF allowlist default (`ssrfGuard.ts:164` → fail closed) and replace IPv6 prefix-matching with a real parser — do this *while deciding* D4 (wire a client to `/api/enrich-evidence` or delete route + guard together).
5. **D1/D2/D7:** delete `GenerationsView.tsx`, the 6 dead functions, and the 1.1 MB `public/export/navwarn-ui.html` + `generate_single_file.sh` + `firebase-applet-config.json` + stale `metadata.json`; drop the 5 unused dependencies.
6. **N6/N7:** make `build` cross-platform; extend CI to run the esbuild server bundle (and, eventually, ESLint + a test runner).
7. **Prior 5/7/8/9/10:** CORS/rate-limit on login, `JSON.parse` guard, one env-var convention (incl. dropping `SUPABASE_JWKS_URL`), User-Agent cleanup, then split `server.ts` (Gemini/Mistral client first, persistence second).

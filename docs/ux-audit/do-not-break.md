# Helm.Warning — "Do Not Break" Checklist

**Sprint 0 · Task 1 · Branch `ux/information-hierarchy`**

Guardrails for the information-hierarchy redesign. Every item below is either automated in
`scripts/ux-audit/tests/do-not-break.spec.ts` (`npm run ux:smoke`) or must be manually re-checked
after each task. If a redesign *intentionally* changes a behaviour, update this file and the test
in the same PR — do not silently weaken a check.

---

## 0. Ground rules

- **Functionality is preserved 100 %.** This is a subtraction/cleanup effort: remove clutter,
  keep capability (reachable via Admin where needed).
- **Zero-count categories stay visible.** A category with 0 items is information, not noise.
- **Never expose pipeline internals to end users:** pane/vector/LLM/Supabase/SHA-256/regex/
  engine names/terminal logs. (See inventory findings F-04 — several current leaks are listed
  there; removing them is a redesign goal, keeping them public is a regression.)
- **No secrets committed**, no `.env` in the repo, no pipeline state in URLs that would leak
  operator data.
- **Verification commands:** `npm run lint`, `npx vite build` (do **not** use `npm run build` —
  it breaks on Windows because of `date -u`, see CODE_REVIEW.md N6), `npm run ux:smoke`.
- **Smoke-suite rate limit:** the dev server enforces 100 requests / 15 min / IP
  (`server.ts`, `globalApiLimiter`). Restart the dev server before a full smoke run
  (`Stop-Process` the listener on :3000, then `npm run dev:audit`) so the window is fresh.
- **Seeded data baseline:** without `.env` the app runs on 5 warnings / 19 sources. Tests assert
  those counts; if seed data changes, update the test in the same PR.

---

## 1. Live data ingestion & Sync Live Feeds

| # | Behaviour to protect | Automated? | Test / evidence |
| --- | --- | --- | --- |
| 1.1 | Data Bank shows live counts (status strip, analytics tiles, quick-nav badge) | Yes | test 3 (`Matching: 5`, badge "5 Active") |
| 1.2 | "Sync Live Feeds" button exists, is labelled, and re-arms after a run | Yes | test 10 |
| 1.3 | Sync fails **gracefully** without server credentials — no crash, table intact, button enabled again | Yes | test 10 (`pageerror` collector stays empty) |
| 1.4 | Ingestion Procedure SOP entry point remains reachable from Data Bank | Manual | `button[title="View Ingestion Procedure (SOP)"]` still renders |
| 1.5 | "Last updated …" timestamp and NOTICE disclaimer remain visible | Manual | capture `databank-default.txt` |

## 2. Filters, quick filters, Smart Sort

| # | Behaviour to protect | Automated? | Test / evidence |
| --- | --- | --- | --- |
| 2.1 | Search filters the table (`014` → 2 rows) and clears back to 5 | Yes | test 3 |
| 2.2 | Quick filters (All / Active Only / With Coords / Unverified) narrow the result set without breaking the table | Yes | test 3 |
| 2.3 | Zero-result search shows the empty state ("No Navigational Warnings Found") **and stays visible** | Yes | test 3 |
| 2.4 | Reset restores the full result set | Yes | test 3 |
| 2.5 | NAVAREA select filters (seed: NAVAREA I = 2 of 5) | Yes | test 3 |
| 2.6 | Smart Sort presets (Urgency / Recency / NAVAREA Sequence / Data Quality / Standard Columns) all apply without breaking the table | Yes | test 4 |
| 2.7 | Column sort headers toggle `aria-sort` and flip direction | Yes | test 4 |
| 2.8 | Sort-direction toggle works | Yes | test 4 |
| 2.9 | **Known mismatch F-01:** "Unverified (n)" label count vs filter predicate — must not be *worsened*; fixing it is a separate task | Documented | `inventory.md` F-01 |

## 3. Map layers, coordinates, fit bounds

| # | Behaviour to protect | Automated? | Test / evidence |
| --- | --- | --- | --- |
| 3.1 | Drawer collapse/expand | Yes | test 5 |
| 3.2 | Base cartography switcher changes active base layer (ESRI Ocean / Voyager / Dark All) | Yes | test 5 |
| 3.3 | Overlay checkboxes toggle (Ocean Soundings / OpenSeaMap / labels) | Yes | test 5 |
| 3.4 | Go to Coordinates accepts valid DD/DMM and shows feedback | Yes | test 5 (`Focused: …`) |
| 3.5 | Go to Coordinates rejects garbage input with an error message (no crash) | Yes | test 5 (rose error state) |
| 3.6 | Fit Bounds works | Yes | test 5 |
| 3.7 | Layer pane toggles (Warning Polygons / Marker Clusters / Soundings / Seamarks) remain available | Manual | inventory §4 / F-04. **Pane-identifier cleanup is mandated by constraint 10 and will change this text on purpose** (e.g. "Ocean Soundings (soundingsPane)" → "Ocean Soundings"). The capture driver and smoke suite anchor on the public label prefix (`/^Ocean Soundings/`), never on pane IDs, so that cleanup must **not** fail the suite; if a test still references a pane identifier, treat it as a bug in the test |
| 3.8 | Map stays interactive while drawer is open; attribution preserved | Manual | `map-drawer-open` capture |

## 4. Warning Details, expand, "View on map", isolation

| # | Behaviour to protect | Automated? | Test / evidence |
| --- | --- | --- | --- |
| 4.1 | Drawer "Details →" opens the Warning Detail modal | Yes | test 6 |
| 4.2 | Modal shows technical provenance fields (`Pub: …`, "Export Geometry") — must not be stripped, only de-emphasised | Yes | test 6 |
| 4.3 | "Show Only This Message" isolates the warning, returns to Map View, and shows the Isolation banner | Yes | test 6 |
| 4.4 | "Show All Warnings" clears isolation | Yes | test 6 |
| 4.5 | Close (Esc) works | Manual | `button[title="Close modal (Esc)"]` |
| 4.6 | "Locate on Map" from Data Bank rows switches to Map View | Manual | `DataBank.tsx:1179` (`title="Locate on Map"`) |
| 4.7 | Mobile warning cards expand/collapse | Manual | capture `mobile-375-warning-expanded` |

## 5. Admin Access path & technical views

| # | Behaviour to protect | Automated? | Test / evidence |
| --- | --- | --- | --- |
| 5.1 | Locked admin routes render the Administrative Gate (not a blank page) | Yes | test 8 |
| 5.2 | Gate "Return to Map" escapes the locked route | Yes | test 8 |
| 5.3 | Gate unlock works when a session token is stored | Yes | test 8 |
| 5.4 | **Known bug F-02:** unlock reverts with no stored token — do not make this *worse*; fixing it is a separate task | Documented | `inventory.md` F-02 |
| 5.5 | All six admin views render for an authenticated session (Pipeline / Manual Parser / Bulk Import / Audit Log / Evidence / Supabase Server) | Yes | test 9 |
| 5.6 | Admin technical content stays admin-only (never appears in public surfaces) | Manual | inventory §8; re-check after any "promote to public" proposal |
| 5.7 | Sources "Run Worker" and registry health data stay present | Yes (presence) | test 7 |

## 6. URL state / deep links

| # | Behaviour to protect | Automated? | Test / evidence |
| --- | --- | --- | --- |
| 6.1 | **Constraint F-03:** the app has no URL-driven state today — query/hash params are ignored and the app boots to Map View. Any new deep-link work is *new* behaviour and needs its own task + tests | Yes | test 2 |
| 6.2 | No operator/pipeline state is encoded in URLs (nothing to leak) | Manual | grep for `URLSearchParams` / `location.hash` before adding routing |

## 7. Mobile touch targets & overflow

| # | Behaviour to protect | Automated? | Test / evidence |
| --- | --- | --- | --- |
| 7.1 | No horizontal overflow on Map / Data Bank / Sources at 375 px | Yes | test 11 (`mobile › …`) |
| 7.2 | Bottom quick-nav buttons ≥ 60 px wide, ≥ 40 px high (touch targets) | Yes | test 11 (`mobile › …`) |
| 7.3 | No horizontal overflow on Map / Data Bank / Sources at 768 px | Yes | test 12 (`tablet 768 › …`); per-state evidence: every `docs/ux-audit/dom/*.txt` header carries `overflow: scrollWidth=… clientWidth=… no_horizontal_overflow=…` measured inside `capture()` for that state |
| 7.4 | Mobile "More" drawer keeps TOOLS / RECORDS / SYSTEM groups reachable | Manual | capture `mobile-375-tools-menu` |
| 7.5 | Mobile warning-card expand control works | Manual | capture `mobile-375-warning-expanded` |

---

## 8. Running the suite

```powershell
# 1. fresh server (resets the 100-req / 15-min rate-limit window)
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
npm run dev:audit            # window 1

# 2. verification gates (from the worktree root)
npm run lint
npx vite build               # NOT npm run build (Windows `date -u` issue)
npm run ux:smoke             # window 2 (starts its own server if none is up)

# 3. optional: refresh audit artifacts
npm run ux:capture           # local states
npm run ux:capture:live      # + live-site baselines
```

Expected result: `12 passed`, lint clean, `vite build` succeeds.

---

## 9. Manual spot-checks (run after each redesign task)

- [ ] Open Map View at 1440 px and 375 px — drawer, layers, and coordinates control still work.
- [ ] Data Bank: search, one quick filter, one Smart Sort preset, one column sort, Reset.
- [ ] Data Bank: open Details → "Show Only This Message" → "Show All Warnings".
- [ ] Sources: badges + Run Worker button present; no new pipeline jargon on the public surface.
- [ ] NOTICE disclaimer, zero-count categories, and the empty state are still visible where expected.
- [ ] Mobile 375 px and tablet 768 px: no horizontal scroll on Map / Data Bank / Sources; More drawer reachable at 375 px.
- [ ] Map drawer "Layer Visibility & Panes" labels are plain language (no pane IDs) once the F-04 cleanup lands; test 5 still passes.
- [ ] Nothing new appears in the URL that would leak operator state.
- [ ] Compare `docs/ux-audit/dom/*.txt` diffs before/after your change and record intentional
      differences in the PR (and in `inventory.md`).

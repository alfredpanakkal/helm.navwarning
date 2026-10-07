# Helm.Warning — UX Information-Hierarchy Audit Inventory

**Sprint 0 · Task 1 · Branch `ux/information-hierarchy` · 2026-10-06**

Living inventory of every visible UI element in the current app, classified A–E for
the information-hierarchy redesign. Later tasks must treat this table as the baseline:
if a task changes an element's location or fate, update the row and say so in the PR.

---

## 1. Method

| Item | Value |
| --- | --- |
| Tooling | Playwright 1.63 (Chromium), `playwright.config.ts`, `scripts/ux-audit/capture.ts` |
| Local driver | `npm run dev:audit` (`scripts/ux-audit/dev-server.ts`, `DISABLE_HMR=true`) |
| Live driver | `npm run ux:capture:live` → `https://helmwarning.vercel.app` |
| Smoke suite | `npm run ux:smoke` → `scripts/ux-audit/tests/do-not-break.spec.ts` (12 tests, green) |
| Captured states | 19 local + 3 live baseline = 22 (screenshots ≤ 25 budget, 6 MB total) |
| Data baseline | No `.env` present → in-memory seed: **5 warnings, 19 sources** (matches live site today) |
| Classifications | A Essential · B Useful · C Advanced · D Administrative · E Unnecessary |

Artifacts: `docs/ux-audit/screenshots/*.png` and `docs/ux-audit/dom/*.txt` (visible body text per state).

### Captured states

| State | Screenshot | Notes |
| --- | --- | --- |
| `map-drawer-open` | ✓ | default drawer, quick-jump expanded |
| `map-drawer-closed` | ✓ | drawer collapsed |
| `map-layers-alt-base-voyager` | ✓ | CARTO Voyager + Ocean Soundings toggled |
| `modal-warning-details` | ✓ | Warning Detail modal |
| `databank-default` | ✓ | flat table, 5 rows |
| `databank-filtered` | ✓ | search `014` → 2 rows |
| `databank-sorted` | ✓ | sorted by NAVAREA |
| `databank-empty` | ✓ | search with no match |
| `modal-ingestion-procedure` | ✓ | Ingestion Procedure SOP |
| `sources-default` | ✓ | registry table |
| `modal-admin-access` | ✓ | Admin Access Gate modal |
| `mobile-375-{map,databank,warning-expanded,sources,tools-menu}` | ✓ | 375×812 |
| `tablet-768-{map,databank,sources}` | ✓ | 768×1024 |
| `live-baseline-{map,databank,sources}` | ✓ | live site baselines |

**What is actually measured for overflow:** `scripts/ux-audit/capture.ts` evaluates
`document.documentElement.scrollWidth` / `clientWidth` **inside `capture()` for every captured
state** (all 19 local states at 375 px and 768 px, plus the 3 live baselines) and writes the result
into each `docs/ux-audit/dom/*.txt` header as
`overflow: scrollWidth=… clientWidth=… no_horizontal_overflow=true|false`.
The smoke suite additionally asserts it in code for all three primary views (Map, Data Bank,
Sources) at **375 px** (`mobile › …`) and at **768 px** (`tablet 768 › …`). Nothing beyond that is
claimed: modal-open states and admin views are captured and recorded per state, but only the
smoke assertions above are enforced.

---

## 2. Classification key

| Class | Meaning | Redesign treatment |
| --- | --- | --- |
| **A** | Essential — a user needs it every session | Visible, primary, never hidden behind disclosure |
| **B** | Useful — helpful but not every session | Keep, visually subordinate to A |
| **C** | Advanced — power/technical use | Progressive disclosure (collapsible section, secondary panel) |
| **D** | Administrative — pipeline/operator only | Move to Admin/Diagnostics surfaces |
| **E** | Unnecessary — noise in the normal UI | Remove from normal UI; functionality stays reachable via Admin |

**Proposed fate** column values used below: `Keep`, `Keep · subordinate`,
`Progressive disclosure`, `Move to Admin`, `Remove from normal UI`,
`Consolidate`, `Fix (F-xx)`.

**Never-break rule (global):** pipeline internals (pane/vector/LLM/Supabase/SHA-256/regex/engine
names) must never be surfaced to end users. Several rows below are D/E precisely because they
leak internals into the public UI.

---

## 3. Global chrome

| Element | Current location | Class | Proposed fate |
| --- | --- | --- | --- |
| Skip link ("Skip to main content") | `src/App.tsx:246` | A | Keep |
| Brand block (Helm.Warning + "NAVAREA Data Bank & Ingestion") | `src/components/Header.tsx` | A | Keep |
| Public tabs: Map View / Data Bank / Sources (badge = active count) | `Header.tsx:49-53,166` | A | Keep |
| Active-count shortcut button ("N Active" → Data Bank) | `Header.tsx:190-198` | B | Keep · subordinate |
| Admin Access / Admin Mode toggle | `Header.tsx:200-219` | D | Move to Admin (header keeps a single discreet entry) |
| NOTICE banner ("not a substitute for GMDSS…") | `App.tsx` notice strip | A | Keep |
| Last-updated timestamp line | `App.tsx` notice strip | B | Keep · subordinate |
| PRINCIPLES accordion (01_VERIFICATION / 02_RAW_IMMUTABILITY / 03_ATOMIC_PUBLISHING) | `App.tsx` notice area | E | Remove from normal UI → Admin / "About the pipeline" doc |
| Dismiss banner button | `App.tsx` notice area | B | Keep (only while banner shown) |
| Footer brand line ("NAVAREA Maritime Safety Information Pipeline") | `App.tsx` | B | Keep · subordinate |
| Mobile bottom quick nav (Map / Data Bank / Sources / More) | `Header.tsx:226-265` | A | Keep |
| More drawer groups TOOLS / RECORDS / SYSTEM | `Header.tsx:71-93` | C | Progressive disclosure (it already is; keep collapsed by default) |
| Admin Access Gate modal (email/password, "Unlock Admin Mode") | `Header.tsx:321-410` | D | Keep as Admin-only entry (see F-02) |

---

## 4. Map View

| Element | Current location | Class | Proposed fate |
| --- | --- | --- | --- |
| Leaflet map canvas + tile attribution | `src/components/LeafletMap.tsx` | A | Keep |
| Warning vector layer + marker clusters | `LeafletMap.tsx` | A | Keep |
| Active-warnings drawer (collapsible) | `LeafletMap.tsx` drawer | A | Keep |
| Drawer warning cards (ID · NAVAREA · severity · issued · valid-to) | `LeafletMap.tsx` cards | A | Keep |
| Drawer card "Details →" action | `LeafletMap.tsx` cards | A | Keep |
| Drawer "Move mouse over map / Copy" hint strip | `LeafletMap.tsx` | E | Remove from normal UI |
| Scope switcher (ALL / NAVAREA / COASTAL) | `LeafletMap.tsx` | B | Keep · subordinate (merge with NAVAREA selector) |
| NAVAREA selector (All Regions + 21 named regions) | `LeafletMap.tsx` | B | Keep · subordinate |
| Layer visibility & panes list (Warning Polygons, Marker Clusters, Ocean Soundings, OpenSeaMap Seamarks) | `LeafletMap.tsx:1008-1054` | C | Progressive disclosure behind "Layers" panel — **strip pane IDs from the labels** (constraint 10: `navWarnVectorPane` / `navWarnMarkerPane` / `soundingsPane` / `seamarksPane` are implementation identifiers shown to the public today; labels must become plain language) |
| Base cartography switcher (ESRI Ocean / Voyager / Dark All) | `LeafletMap.tsx:788-809` | C | Progressive disclosure inside Layers panel |
| Go to Coordinates form (DMM/DD input, GO, error/feedback) | `LeafletMap.tsx:714-768` | C | Progressive disclosure behind Layers/crosshair control |
| Fit Bounds control | `LeafletMap.tsx:777-785` | B | Keep · subordinate |
| Severity filter chips (ALL / CRITICAL / HIGH / MODERATE) on drawer | `LeafletMap.tsx` | B | Keep · subordinate (mirror Data Bank filter language) |
| "N warnings" drawer counter | `LeafletMap.tsx` | B | Keep · subordinate |
| Isolation Mode banner ("Isolation Mode Active:", Details, Show All Warnings) | `LeafletMap.tsx:578-615` | A | Keep (state must stay obvious while isolated) |
| Map loading / offline / error states | `LeafletMap.tsx` | A | Keep |
| Leaflet attribution line | Leaflet control | B | Keep · subordinate |

---

## 5. Data Bank

| Element | Current location | Class | Proposed fate |
| --- | --- | --- | --- |
| Status strip ("LIVE 5 live records loaded") | `src/components/DataBank.tsx` | A | Keep |
| Analytics tiles: ACTIVE WARNINGS, IN-FORCE, CRITICAL/HIGH, HIGH CONF, NAVAREAS/COVERAGE | `DataBank.tsx` (~lines 300-445) | B | Keep · subordinate — collapse into one "brief" row |
| "How Data is Taken (Procedure SOP)" button | `DataBank.tsx:465-471` | C | Progressive disclosure (button stays, modal content shrinks) |
| "Sync Live Feeds" button | `DataBank.tsx:472-482` | A | Keep (guarded by smoke test; fails gracefully without credentials) |
| "Dynamic Ingestion Pipeline Active" pill + "Zero Hardcoded Data…" copy | `DataBank.tsx:448-462` | E | Remove from normal UI (operator claim, not user information) |
| Executive Operational Brief (sentence summary + GPS % chip) | `DataBank.tsx:487-501` | A | Keep — this is the primary orientation element |
| "Group By" select (Flat / Hazard Category / NAVAREA / Urgency / Authority) | `DataBank.tsx:505-515` | C | Progressive disclosure (keep, subordinate) |
| Actionable alerts callouts | `DataBank.tsx:519+` | B | Keep · subordinate |
| "FILTER BY HAZARD CATEGORY (7 STANDARD CLASSES)" pills | `DataBank.tsx` category pills | B | Keep · subordinate |
| Search input ("Search records by ID, text, area, coords…") | `DataBank.tsx:587` | A | Keep |
| NAVAREA select | `DataBank.tsx:612-639` (`#databank-navarea-filter`) | A | Keep |
| Severity select (All / Critical Only / High Confidence) | `DataBank.tsx:649-668` | B | Keep · subordinate |
| Status select (All / Active / Unverified / Expiring / Cancelled) | `DataBank.tsx:674-695` | A | Keep (fix F-01: label count vs filter predicate) |
| Coordinates select (All / With Coordinates / Text Only) | `DataBank.tsx:699-718` | B | Keep · subordinate |
| Reset button | `DataBank.tsx:721-730` | A | Keep |
| Quick filter presets (All / Active Only / With Coords / Unverified) | `DataBank.tsx:737-799` | A | Keep (fix F-01) |
| Sort summary ("Sorted by Issued (DESC)") + direction toggle | `DataBank.tsx:802-815` | B | Keep · subordinate |
| Active filter pills (clear-per-filter buttons) | `DataBank.tsx:830-900` | B | Keep · subordinate |
| Smart Sort Presets bar (Urgency / Recency / NAVAREA Sequence / Data Quality / Standard Columns) | `DataBank.tsx:914-946` | C | Progressive disclosure behind a single "Sort" control |
| Desktop grid table header (ID/AREA/TITLE/SEVERITY/COORDS/ISSUED/STATUS/ACTION, sortable) | `DataBank.tsx:1285-1470` | A | Keep |
| Row "VERIFY" quick action | `DataBank.tsx:1167,1524` | B | Keep · subordinate |
| Row "Locate on Map" action | `DataBank.tsx:1179` | A | Keep (map ↔ Data Bank cross-navigation) |
| Mobile warning cards (expandable) | `DataBank.tsx:1066-1284` | A | Keep (mobile primary) |
| Pagination controls (page / shift / first / last) | `DataBank.tsx:1080-1120,1590-1660` | B | Keep · subordinate |
| Empty state ("No Navigational Warnings Found" + reset CTA) | `DataBank.tsx:1118-1130` (mobile list) and `:1473` (desktop table) | A | Keep (must stay visible at zero counts — brief rule) |
| Analytics "TOTAL PUBLISHED / LIVE" tiles duplication | `DataBank.tsx` tiles + status strip | E | Consolidate with the status strip |
| Inline "Pipeline Overview" jargon tiles visible to public | `WorkspaceView` copy reused in brief | D/E | Move to Admin |

---

## 6. Sources

| Element | Current location | Class | Proposed fate |
| --- | --- | --- | --- |
| Registry heading ("NAVWARN Candidate Discovery Registry") | `src/components/SourceRegistryView.tsx:95` | A | Keep |
| Stat tiles: TOTAL NAVAREAS IN REGISTRY, VERIFIED ENDPOINTS, UNVERIFIED COVERAGE, POLL CADENCE | `SourceRegistryView.tsx:63-90` | B | Keep · subordinate |
| Registry table (NAVAREA, Coordinator/Publisher, Semantics & Format, LLM fallback rate, Health & Status, Actions) | `SourceRegistryView.tsx` table | B | Keep · subordinate |
| "LLM FALLBACK RATE" column | `SourceRegistryView.tsx` table | D | Move to Admin — leaks model internals into the public UI |
| Verification badge (✅ Verified / ? Unverified) | `SourceRegistryView.tsx:189-196` | A | Keep |
| "Run Worker" action | `SourceRegistryView.tsx:218` | D | Move to Admin (guarded in smoke test by presence only, not by execution) |
| "View Onboarding Checklist" action | `SourceRegistryView.tsx:206` | C | Progressive disclosure |
| Status filter (All / Verified / Unverified) + `initialFilter` deep-link prop | `SourceRegistryView.tsx:33-45` | B | Keep · subordinate |
| Source cards on narrow viewports | `SourceRegistryView.tsx` | A | Keep |
| Poll cadence ("360 min / 6-hour Polling Defaults") | `SourceRegistryView.tsx` stats | D | Move to Admin |

---

## 7. Modals

| Element | Current location | Class | Proposed fate |
| --- | --- | --- | --- |
| Ingestion Procedure modal (SOP) | `src/components/IngestionProcedureModal.tsx` | C | Progressive disclosure — public copy keeps principles, operator detail moves to Admin |
| Warning Detail modal — Message tab (raw/translated text, Pub, issued/valid) | `src/components/WarningDetailModal.tsx:195+` | A | Keep |
| Warning Detail modal — Geometry tab | `WarningDetailModal.tsx:207` | B | Keep · subordinate |
| Warning Detail modal — ECDIS tab | `WarningDetailModal.tsx:222` | C | Progressive disclosure |
| "Copy Message" action | `WarningDetailModal.tsx` | B | Keep · subordinate |
| "Export Geometry" action | `WarningDetailModal.tsx:430` | C | Progressive disclosure |
| "Show Only This Message" (isolation) | `WarningDetailModal.tsx:480-505` | A | Keep |
| Verify / Previous / Next verification actions | `WarningDetailModal.tsx` | A | Keep |
| Close (Esc) button | `WarningDetailModal.tsx:182-186` | A | Keep |
| Provenance/confidence/validation detail block | `WarningDetailModal.tsx` | C | Progressive disclosure ("Technical details" fold) |
| Admin Access Gate modal | `Header.tsx:321-410` | D | Keep (Admin only) |

---

## 8. Admin views (reachable only with admin session)

All six views render correctly for an authenticated session (smoke test 9). Classification is
relative to the *public* UI: these are already admin-only, so their class is "D by definition" —
the table records what must stay admin-only (never leak into public surfaces).

| View | Heading | Key elements | Must remain Admin-only |
| --- | --- | --- | --- |
| Pipeline (Workspace) | CANDIDATE DISCOVERY & INGESTION TOOLS | status strip (Registered Feeds / Active NAVWARNs / Supabase), 6 tool cards, INGESTION PIPELINE OVERVIEW stages 01–04 (latency, accuracy, confidence %), INGESTION TERMINAL LOGS, SOURCE HEALTH list, "MANAGE ALL" | Yes — pipeline internals, terminal logs, engine splits (Regex vs Gemini) |
| Manual Parser | MANUAL WARNING PARSER & OVERRIDE WORKFLOW | NAVAREA select, ENGINE select (Rules / AI), AI ESCALATION select, paste area, LOAD SAMPLE BULK TEXT, PARSE & EXTRACT GEOMETRY | Yes — AI engine names |
| Bulk Import | BULK INGESTION & NAVAREA IMPORTER | paste tabs (.MD / CSV / file upload), FREEOPENAPI LIVE SYNC, sample stream loaders, model/pipeline selects, TRIAGE & INGEST | Yes — model names, ingest internals |
| Audit Log | ATOMIC GENERATION POINTER INSPECTOR | CURRENT PUBLISHED SOURCE POINTERS table (generation IDs), IMMUTABLE INGESTION GENERATION LOG | Yes — generation pointers/IDs |
| Evidence Locker | PRIVATE OBJECT STORAGE EVIDENCE LOCKER | artifact cards, gs:// paths, SHA-256 hash, payload preview | Yes — storage paths + hashes |
| Supabase Server | Supabase Database Server Hub | CHECK STATUS, SYNC TO SUPABASE NOW, Gemini/Mistral test modules, EXECUTE | Yes — provider internals |

---

## 9. Mobile & tablet specifics

| Element | Location | Class | Proposed fate |
| --- | --- | --- | --- |
| Bottom quick nav touch targets (min-width 64 px, height ≥ 40 px verified) | `Header.tsx:226-265` | A | Keep |
| "More" button (bottom nav) | `Header.tsx:253-264` | A | Keep |
| Warning card expand/collapse control (mobile only) | `DataBank.tsx` / `LeafletMap.tsx` | A | Keep |
| Horizontal overflow on map/databank/sources at 375/768 | — | A | Keep (asserted in smoke test) |
| Tablet 768 px layouts | captured | B | Keep · subordinate (verify against 768 captures each redesign task) |

---

## 10. Findings recorded during the audit

| ID | Finding | Evidence | Status |
| --- | --- | --- | --- |
| **F-01** | "Unverified (n)" quick-filter pill and status option count `status === 'unverified' \|\| extraction_confidence < 1` (gives 2), but the table filter matches only `w.status === 'unverified'` (gives 0 today). Clicking the pill empties the table. | `DataBank.tsx:162` vs `DataBank.tsx:206`; smoke test documents the narrowing behaviour | Open — later task should align predicates (do not enshrine the mismatch as "correct") |
| **F-02** | Admin Gate "Unlock Admin Tools" reverts immediately when no `helm_admin_token` is in sessionStorage. `setIsAdminMode` in `App.tsx:54` is an inline wrapper (new identity each render), so `Header.tsx:28-47`'s session-sync effect re-runs and resets admin mode to the stored-token value. | Probe: unlock → `localStorage` stays `'false'`, gate remains; with token set first → unlock sticks | Open — later task should stabilise the setter / effect deps |
| **F-03** | No URL state or deep links today: `/?tab=databank` and `#sources` are ignored; the app always boots to Map View. In-app filter state is not URL-addressable. | Smoke test `today the app has no URL-driven state`; `App.tsx` has no router | Constraint — any future deep-link work is new behaviour, not a restore |
| **F-04** | Public surfaces leak operator/pipeline claims: "Zero Hardcoded Data", "Dynamic Ingestion Pipeline Active", Sources "LLM FALLBACK RATE", Poll Cadence, PRINCIPLES accordion. **Also:** the Map drawer's "Layer Visibility & Panes" list exposes Leaflet pane identifiers to end users — "Warning Polygons (navWarnVectorPane)", "Marker Clusters (navWarnMarkerPane)", "Ocean Soundings (soundingsPane)", "OpenSeaMap Seamarks (seamarksPane)" (`LeafletMap.tsx:1021-1051`, `docs/ux-audit/dom/map-drawer-open.txt`). Binding constraint 10 forbids these; the audit tooling and smoke suite no longer key on them (they use the public label prefix only), so the mandated cleanup will not fail the do-not-break suite. | Inventory rows marked E/D; layers row fate = "strip pane IDs from labels" | Open — redesign moves operator claims to Admin and strips pane IDs from labels |
| **F-05** | `modal-admin-access` DOM snapshot captured the Sources page behind the modal rather than modal text alone (modal body is in the header layer). Structure verified from source instead. | `docs/ux-audit/dom/modal-admin-access.txt` | Cosmetic — capture script improvement for later tasks |
| **F-06** | Desktop table empty state (`DataBank.tsx:1473`) and mobile list empty state (`DataBank.tsx:1123`) duplicate the same message in one DOM tree. | Strict-mode hit during smoke-test authoring | Consolidate during redesign |

---

## 11. Smoke-test coverage map

`docs/ux-audit/do-not-break.md` holds the checklist; `npm run ux:smoke` runs:

1. `public shell › header tabs, active-count shortcut and tab switching keep working`
2. `public shell › today the app has no URL-driven state (recorded as a constraint)`
3. `data bank › filters, quick filters, search, empty state and reset still work`
4. `data bank › Smart Sort presets and column sort headers keep working`
5. `map › drawer, layer toggles, base cartography, go-to-coordinates and fit bounds`
6. `warning details › details modal opens, shows technical fields and isolates a single message`
7. `sources › registry counters, verification badges and worker action are present`
8. `admin gate (mobile) › locked admin tools show the gate, unlock recovers the workspace view`
9. `admin views › all six admin views render for an authenticated session`
10. `resilience › sync live feeds fails gracefully without server credentials`
11. `mobile › no horizontal overflow on any primary view and touch targets stay usable` (375 px)
12. `tablet 768 › no horizontal overflow on Map, Data Bank and Sources at 768 px`
13. `ui path flag (temporary; Task 13 removes) › default load renders Data Bank on the v2 path; hwUI=classic uses the legacy path`
14. `ingestion procedure (progressive disclosure) › Technical details (Admin): non-admin users are routed to the Admin Access Gate`
15. `ingestion procedure (progressive disclosure) › Technical details (Admin): a stored admin session token opens the nested original modal`

---

## 12. How to update this inventory

1. Re-run `npm run ux:capture` (and `npm run ux:capture:live` when the deployed UI matters).
2. Diff the new `docs/ux-audit/dom/*.txt` against the previous run.
3. Update affected rows here (location, class, fate) and re-run `npm run ux:smoke`.
4. Never commit more than 25 screenshots; keep `.superpowers/` out of the repo.

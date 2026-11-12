# UI Button Fix Plan — Helm.Warning Console

**Audit date:** 2026-11-11  
**Branch for all work:** branch off current `main`; name each `fix-buttons-<theme>`  
**Lint gate:** `npm run lint` → `tsc --noEmit` (maintainer runs — no node_modules in this workspace)  
**Test gate:** `npm test` → `vitest run`  
**Verification:** Read every touched file back from branch HEAD after push; scan for mojibake (`/[\u00C3\u00C2]/`)

---

## Guiding Principles (Karpathy Incremental)

1. **Smallest slice that is independently shippable.** Each task is one PR, touching ≤ 5 files, with a single theme.
2. **Zero-visual-change first.** Attribute/ARIA hygiene before anything touches colour, layout, or spacing.
3. **Fail fast on the riskiest item.** Single-fire guards (Phase 4) land before purely cosmetic style fixes (Phase 5).
4. **Never introduce a regression.** Every change must preserve the single-fire guard invariant (AGENTS.md §2).
5. **Maintainer merges; agent never self-merges.**

---

## Phase 1 — Attribute Hygiene (zero visual change)

> **Why first:** Broken `type` attributes and missing ARIA roles are the highest-probability silent bugs. They cost nothing to fix and risk nothing visually. Zero regressions possible.

### Task 1-A · `index.html` — public portal button attributes
**Branch:** `fix-buttons-public-attrs`  
**Files:** `index.html` (1 file)  
**Size:** S

**Changes:**
- Add `type="button"` to all 9 `<button>` elements that lack it (lines ~498, 510, 530, 545, 555, 573, 580, 590, 611)
- Add `aria-expanded="false"` (toggled by JS) to the gear/settings toggle and the focus-panel disclosure button
- Add `aria-pressed="false"` (toggled by JS) to the coordinate-display toggle and the focus-mode toggle
- Add `aria-label` to any icon-only button lacking visible text

**Acceptance criteria:**
- `git grep -n 'type="button"' index.html | wc -l` matches total button count in file
- All toggle buttons have `aria-expanded` or `aria-pressed` in source; JS updates them on click
- No visual diff on the public portal

**Verification:**
- Maintainer: `npm test`, `npm run lint`
- Preview: open `/` in browser, confirm no visual change

---

### Task 1-B · `src/App.tsx` + `src/components/NavRail.tsx` — shell button attrs
**Branch:** `fix-buttons-shell-attrs`  
**Files:** `src/App.tsx`, `src/components/NavRail.tsx` (2 files)  
**Size:** S

**Changes:**
- Add `type="button"` to all 8 buttons in `App.tsx` (FAB, edit FAB, close, expand, collapse controls)
- Add `type="button"` to all nav-rail `<button>` elements in `NavRail.tsx`
- Confirm `aria-label` present on all icon buttons in NavRail; add where missing
- Add `aria-current="page"` to the active nav item if not already present

**Acceptance criteria:**
- `git grep -n '<button' src/App.tsx src/components/NavRail.tsx` → every result has `type="button"` on same element
- No visual diff in the shell or rail

---

### Task 1-C · `Header.tsx` + `WorkspaceView.tsx` — header/workspace attrs
**Branch:** `fix-buttons-header-workspace-attrs`  
**Files:** `src/components/Header.tsx`, `src/components/WorkspaceView.tsx` (2 files)  
**Size:** S

**Changes:**
- Add `type="button"` to ~18 buttons across both files
- Add `aria-pressed` to any toggle (mobile menu open, panel collapse, etc.)
- Add `aria-expanded` + `aria-controls` to any disclosure trigger (dropdown, accordion)
- Ensure `isLoggingIn` disabled guard is wired to button `disabled` prop (Header already has it — verify, don't duplicate)

**Acceptance criteria:**
- Every `<button` in both files has `type=` attribute
- Disclosure triggers have matching `aria-expanded` + `id`/`aria-controls` pair

---

### Task 1-D · DataBank layer — button attrs
**Branch:** `fix-buttons-databank-attrs`  
**Files:** `src/components/DataBankControls.tsx`, `src/components/DataBankWarningList.tsx`, `src/components/WarningItemV2.tsx` (3 files)  
**Size:** M

**Changes:**
- Add `type="button"` to ~25 buttons across the three files
- Confirm `verifyingIds.has(id)` disabled guard is properly applied to Quick Verify button — no change needed if already correct; document if already correct
- Add `aria-sort` to column sort buttons if not already present (audit noted it's ✅ — verify and leave)
- Add `aria-label` to any icon-only action buttons in `WarningItemV2`

**Acceptance criteria:**
- Every `<button` in all three files has `type=` attribute
- No regression to `verifyingIds` guard

---

### Task 1-E · Ingest layer — button attrs + import tab roles
**Branch:** `fix-buttons-ingest-attrs`  
**Files:** `src/components/CsvUploaderView.tsx`, `src/components/ManualParserView.tsx`, `src/components/EcdisFeatureEditor.tsx` (3 files)  
**Size:** M

**Changes:**
- Add `type="button"` to all missing buttons in all three files
- **CsvUploaderView.tsx lines 836–885 (import tabs):** Add `role="tablist"` to container, `role="tab"` + `aria-selected` + `aria-controls` to each tab button, `role="tabpanel"` + `aria-labelledby` to each panel. This converts the visual tabs into semantic tabs.
- Add `aria-label` to EcdisFeatureEditor vertex/point icon buttons

**Acceptance criteria:**
- Axe/WAVE audit on import tab area shows no "tab-role" violations
- All tab buttons have `aria-selected` toggled correctly on click
- No visual change to tab appearance

---

### Task 1-F · Remaining components — `type="button"` sweep
**Branch:** `fix-buttons-remaining-attrs`  
**Files (batch 1 — max 5):** `src/components/WarningDetailModal.tsx`, `src/components/WarningEditModal.tsx`, `src/components/IngestionProcedureModal.tsx`, `src/components/MissingWarningsDrawer.tsx`, `src/components/LeafletMap.tsx`  
**Files (batch 2 — max 5):** `src/components/MapGeometryEditor.tsx`, `src/components/SupabaseStatusView.tsx`, `src/components/SourceRegistryView.tsx`, `src/components/GenerationInspectorView.tsx`, `src/components/AdminDataBankTools.tsx`  
**Files (batch 3):** `src/components/DataBankSummary.tsx`, `src/components/DataBankStatusBar.tsx`, `src/components/DisclaimerBanner.tsx`, `src/components/InForceCoverageBanner.tsx`  
**Size:** S each batch (3 PRs, 4–5 files each)

**Changes per batch:**
- Add `type="button"` to every `<button` missing it
- Add `aria-label` to any icon-only button missing visible text
- Confirm existing `verifyPending`, `saving`, `committedId` guards are wired to `disabled` — document findings, fix only if actually disconnected

**Acceptance criteria:**
- `git grep -rn '<button ' src/components/ | grep -v 'type='` returns 0 results (run after all 1-F batches land)

---

## Phase 2 — Moss Palette Alignment

> **Why after Phase 1:** Visual changes. Land only after attribute hygiene is clean and green. Each task is a pure colour substitution — no logic change, no layout change.

### Design token reference

| Replace | With (Tailwind 4 / CSS var) | Notes |
|---|---|---|
| `bg-emerald-600` | `bg-[var(--accent)]` or `bg-gw-primary` | Main CTA colour |
| `hover:bg-emerald-500` | `hover:brightness-110` | No separate hover token needed |
| `ring-emerald-400` | `ring-[var(--accent)]` | Focus ring |
| `bg-emerald-700` | `bg-[var(--accent)]` | Same token, darker variant replaced |
| `bg-indigo-600` / `hover:bg-indigo-700` | `bg-gw-primary hover:bg-gw-accent` | Non-moss deviation |
| `bg-sky-600` | `bg-gw-primary` or neutral `bg-[var(--ink)]/10` | Isolation Mode — consider semantic neutral |
| `bg-amber-600` | `bg-[var(--accent)]` or `border border-[var(--accent)] text-[var(--accent)] bg-transparent` | "Select All Stale" — ghost variant more appropriate |
| `active:scale-95` | *(remove)* | Forbidden by design system |
| `shadow-md` / `shadow-*` | *(remove)* | Forbidden by design system |
| `font-bold` / `font-semibold` on buttons | `font-medium` | CSS clamps to 500 anyway; fix source signal |

---

### Task 2-A · FAB palette — `App.tsx`
**Branch:** `fix-buttons-fab-palette`  
**Files:** `src/App.tsx` (1 file)  
**Size:** S

**Changes:**
- Line 761: Replace `bg-emerald-600 hover:bg-emerald-500 ring-emerald-400 text-white rounded-full` with `bg-[var(--accent)] hover:brightness-110 ring-[var(--accent)] text-[var(--canvas)] rounded-full`
- Line 777 (edit FAB): Already uses `bg-gw-primary` — verify `type="button"` added in Phase 1; no colour change needed. Add `aria-label="Edit warning"` if missing.
- Remove any `font-bold` / `font-semibold` on button class strings in this file → `font-medium`

**Acceptance criteria:**
- FAB renders in `#2F6B4F` moss green, not emerald-600 (`#059669`)
- No `emerald-` token remains in `src/App.tsx`
- No `font-bold` / `font-semibold` on any button class string

---

### Task 2-B · Verify button palette — modal + drawer
**Branch:** `fix-buttons-verify-palette-modal`  
**Files:** `src/components/WarningDetailModal.tsx`, `src/components/WarningEditModal.tsx`, `src/components/DataBankWarningList.tsx` (3 files)  
**Size:** M

**Changes:**
- `WarningDetailModal.tsx:820` Verify button: `bg-emerald-600` → `bg-[var(--accent)] hover:brightness-110 text-[var(--canvas)]`
- `WarningDetailModal.tsx:780` "Show Only This Message": `bg-sky-600` → `bg-transparent border border-[var(--ink)]/30 text-[var(--ink)] hover:bg-[var(--ink)]/5` (secondary/ghost treatment — isolation mode is a low-emphasis action)
- `WarningEditModal.tsx:501` drawer Verify: same as 2-B modal treatment
- `DataBankWarningList.tsx:261` Quick Verify: same token substitution

**Acceptance criteria:**
- No `emerald-`, `sky-`, `indigo-`, `amber-` token on any Verify or isolation-mode button in these three files
- Verify button is visually moss; isolation-mode button is ghost/secondary

---

### Task 2-C · Verify button palette — ingest views
**Branch:** `fix-buttons-verify-palette-ingest`  
**Files:** `src/components/ManualParserView.tsx`, `src/components/CsvUploaderView.tsx`, `src/components/MapGeometryEditor.tsx` (3 files)  
**Size:** M

**Changes:**
- `ManualParserView.tsx` lines 489, 894, 1046: `bg-emerald-600` → `bg-[var(--accent)] hover:brightness-110 text-[var(--canvas)]`
- `CsvUploaderView.tsx:1605` staged save: same substitution
- `MapGeometryEditor.tsx:770` "Finish shape": same substitution

**Acceptance criteria:**
- No `emerald-` token on any primary action button in these three files

---

### Task 2-D · Deviant palette — Supabase + AdminTools + motion cleanup
**Branch:** `fix-buttons-deviant-palette`  
**Files:** `src/components/SupabaseStatusView.tsx`, `src/components/AdminDataBankTools.tsx` (2 files)  
**Size:** S

**Changes:**
- `SupabaseStatusView.tsx:328` "Test Gemini": Remove `active:scale-95`, `shadow-md`, `border-indigo-700`. Replace `bg-indigo-600 hover:bg-indigo-700` with `bg-[var(--accent)] hover:brightness-110 text-[var(--canvas)]`. This is a primary action — moss CTA is correct.
- `AdminDataBankTools.tsx:353` "Select All Stale": Replace `bg-amber-600 hover:bg-amber-700` with ghost variant `border border-[var(--accent)] text-[var(--accent)] bg-transparent hover:bg-[var(--accent)]/8` — selecting all stale rows is a secondary/confirmation action, not primary.
- Sweep both files for any remaining `font-bold`/`font-semibold` on buttons → `font-medium`

**Acceptance criteria:**
- No `active:scale-95`, `shadow-*`, `indigo-*`, `amber-*` on any button in either file
- "Select All Stale" renders as ghost button, clearly secondary

---

## Phase 3 — Touch Targets & Motion

> **Why here:** Mobile/touch correctness is a WCAG 2.2 §2.5.8 requirement. Land after palette work so we don't re-touch the same files.

### Task 3-A · Public `.btn-sm` mobile touch target
**Branch:** `fix-buttons-touch-targets`  
**Files:** `public/assets/css/components.css` (1 file)  
**Size:** XS

**Changes:**
- After line 101 (`.btn-sm { min-height: 28px }`), add:
  ```css
  @media (pointer: coarse) {
    .btn-sm {
      min-height: var(--touch-min, 44px);
      min-width: var(--touch-min, 44px);
    }
  }
  ```
- This matches the existing pattern in `src/index.css` for the React console buttons and brings the public portal into compliance.

**Acceptance criteria:**
- On a touch device (or Chrome DevTools pointer:coarse emulation), `.btn-sm` elements are ≥ 44 × 44px
- Desktop (pointer:fine) layout unchanged

---

### Task 3-B · Console icon button tap targets
**Branch:** `fix-buttons-console-taptargets`  
**Files:** `src/components/EcdisFeatureEditor.tsx`, `src/components/LeafletMap.tsx` (2 files)  
**Size:** S

**Changes:**
- `EcdisFeatureEditor.tsx` vertex control buttons (lines 366–384): Add `p-2` minimum padding. Currently flush-icon buttons with no padding → tap target < 32px. With `p-2` (8px each side) on a 16px icon = 32px + 2px border = adequate; combined with existing coarse override in `src/index.css` → 44px.
- `LeafletMap.tsx` accordion action buttons (lines 1838–1860): Ensure each has `min-h-[2.75rem] min-w-[2.75rem]` or `p-2` class so the coarse-pointer CSS rule can apply.

**Acceptance criteria:**
- Vertex and accordion action buttons in EcdisFeatureEditor and LeafletMap have ≥ 32px natural hit area (44px on coarse pointer via CSS)

---

## Phase 4 — Single-Fire Guards (Resilience)

> **Why before Phase 5:** Correctness over cosmetics. Guard gaps can produce duplicate audit rows — a data integrity issue per AGENTS.md §2.

### Task 4-A · Refresh + run-load + delete guards
**Branch:** `fix-buttons-singlefire-guards`  
**Files:** `index.html`, `src/components/GenerationInspectorView.tsx`, `src/components/EcdisFeatureEditor.tsx` (3 files)  
**Size:** M

**Changes:**

**`index.html:573` — `refreshData` button:**
```js
// Before calling refreshData():
const btn = event.currentTarget;
btn.disabled = true;
refreshData().finally(() => { btn.disabled = false; });
```
If `refreshData` is not already a Promise, wrap the fetch chain with `.finally`. Matches the existing `refreshSupabaseConnection` guard pattern already in `public.js`.

**`GenerationInspectorView.tsx:175` — `loadRuns` button:**
```tsx
// Add disabled prop:
<button type="button" disabled={runsLoading} onClick={loadRuns} ...>
  {runsLoading ? 'Loading…' : 'Reload runs'}
</button>
```
`runsLoading` state already exists (from prior code review); connect it to `disabled`.

**`EcdisFeatureEditor.tsx:385` — `handleDeletePoint`:**
```tsx
const handleDeletePoint = (idx: number) => {
  if (!window.confirm('Delete this point? This cannot be undone.')) return;
  // existing delete logic
};
```
Lightweight confirmation guard. Not an audited write so no audit row risk, but destructive — a simple `confirm()` matches the existing project pattern.

**Acceptance criteria:**
- `refreshData` button: clicking it twice in quick succession fires only one network request (the second click hits a disabled button)
- `loadRuns` button: disabled while `runsLoading === true`; re-enabled on completion/error
- `handleDeletePoint`: shows confirmation dialog; no delete on cancel

---

## Phase 5 — Style Consistency Sweep (Cosmetic)

> **Last.** Purely cosmetic. Can be deferred if bandwidth is tight; design system CSS already clamps these at runtime. Land as a housekeeping PR.

### Task 5-A · Font weight + radius cleanup
**Branch:** `fix-buttons-style-sweep`  
**Files:** Up to 5 files per sub-commit; sweep in alphabetical order  
**Size:** L (many files, trivial change per file — consider batch script)

**Changes:**
- Replace `font-bold`, `font-semibold`, `font-black` on button `className` strings → `font-medium`. (CSS in `src/index.css @layer base` already clamps to 500, but source clarity matters and linters can catch it.)
- Replace `rounded-lg`, `rounded-xl`, `rounded-full` on non-pill buttons → `rounded` (Tailwind 4 default = `--radius-btn: 6px`). Exception: FAB pill intentionally `rounded-full`.
- Cross-check: no `shadow-*` class on any button not already removed in Phase 2.

**Acceptance criteria:**
- `git grep -rn 'font-bold\|font-semibold\|font-black' src/components/ | grep 'button\|btn'` returns 0
- `git grep -rn 'rounded-lg\|rounded-xl' src/components/ | grep 'button\|btn'` returns only intentional pill/badge uses

---

## Completion Checklist

| Phase | PR Count | Status | Notes |
|---|---|---|---|
| 1-A Public attrs | 1 | ✅ | PR #158 merged |
| 1-B Shell attrs | 1 | ✅ | PR #166 merged |
| 1-C Header/workspace attrs | 1 | ✅ | PR #167 merged |
| 1-D DataBank attrs | 1 | ✅ | PR #168 merged |
| 1-E Ingest attrs + tab roles | 1 | ✅ | PR #169 merged |
| 1-F Remaining sweep (3 batches) | 3 | ✅ | PRs #170, #171, #172 merged |
| 2-A FAB palette | 1 | ✅ | PR #173 merged |
| 2-B Verify palette — modal/drawer | 1 | ✅ | PR #175 merged |
| 2-C Verify palette — ingest | 1 | ✅ | PR #176 merged |
| 2-D Deviant palette + motion | 1 | ✅ | PR #177 merged |
| 3-A Public touch target | 1 | ✅ | PR #178 merged |
| 3-B Console tap targets | 1 | ✅ | PR #179 merged |
| 4-A Single-fire guards | 1 | ✅ | PR #180 merged |
| 5-A Style sweep | 1 | ✅ | PR #181 merged |
| **Total** | **15 PRs** | ✅ | **All phases 100% complete** |

---

## Out of Scope

- Parser v3 wiring (deliberately deferred, AGENTS.md §6)
- Console UX issue 13 (deliberately deferred)
- Any migration work — do not run migrations; check pg_policies first if ever needed
- Supabase Auth changes
- Map interaction auto-zoom vs marker-pulse decision (undecided, AGENTS.md §6)

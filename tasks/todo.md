# UI Button Fix — Task Checklist

> Companion to `tasks/plan.md`. Tick each item when the PR is **merged to main**.  
> Branch off current `main` for every task. Never merge your own PR.

---

## Phase 1 — Attribute Hygiene (zero visual change)

### 1-A · Public portal button attrs
- [x] Branch `fix-buttons-public-attrs` created off `main`
- [x] `type="button"` added to all 9 `<button>` elements in `index.html`
- [x] `aria-expanded` wired to gear toggle + focus-panel disclosure button
- [x] `aria-pressed` wired to coord-display + focus-mode toggle buttons
- [x] `aria-label` added to any icon-only button missing visible text
- [x] PR opened; body includes root-cause + file list + test plan ([PR #158](https://github.com/alfredpanakkal/helm.navwarning/pull/158))
- [x] Maintainer ran `npm test` + `npm run lint` ✅
- [x] **PR merged** → tick here ✅

### 1-B · Shell button attrs (`App.tsx`, `NavRail.tsx`)
- [x] Branch `fix-buttons-shell-attrs` created
- [x] `type="button"` on all 8 buttons in `App.tsx`
- [x] `type="button"` on all buttons in `NavRail.tsx`
- [x] `aria-label` added to icon-only nav buttons; `aria-current="page"` on active item
- [x] PR opened, reviewed, merged ✅ ([PR #166](https://github.com/alfredpanakkal/helm.navwarning/pull/166))

### 1-C · Header + WorkspaceView attrs
- [x] Branch `fix-buttons-header-workspace-attrs` created
- [x] `type="button"` on ~18 buttons across both files
- [x] `aria-pressed` on mobile-menu + panel-collapse toggles
- [x] `aria-expanded` + `aria-controls` on disclosure triggers
- [x] `isLoggingIn` disabled guard verified still connected (no change needed if correct)
- [x] PR opened, reviewed, merged ✅ ([PR #167](https://github.com/alfredpanakkal/helm.navwarning/pull/167))

### 1-D · DataBank layer attrs
- [x] Branch `fix-buttons-databank-attrs` created
- [x] `type="button"` on ~25 buttons in `DataBankControls`, `DataBankWarningList`, `WarningItemV2`
- [x] `verifyingIds.has(id)` guard verified correctly wired to `disabled` on Quick Verify
- [x] `aria-sort` confirmed present on column sort buttons (no change if already ✅)
- [x] `aria-label` on icon-only action buttons in `WarningItemV2`
- [x] PR opened, reviewed, merged ✅ ([PR #168](https://github.com/alfredpanakkal/helm.navwarning/pull/168))

### 1-E · Ingest layer attrs + import tab semantic roles
- [x] Branch `fix-buttons-ingest-attrs` created
- [x] `type="button"` on all missing buttons in `CsvUploaderView`, `ManualParserView`, `EcdisFeatureEditor`
- [x] `CsvUploaderView` lines 836–885: `role="tablist"` on container
- [x] Each import tab button has `role="tab"` + `aria-selected` + `aria-controls`
- [x] Each tab panel has `role="tabpanel"` + `aria-labelledby`
- [x] `aria-selected` toggled correctly in JS on tab click
- [x] `aria-label` on EcdisFeatureEditor vertex/point icon buttons
- [x] PR opened, reviewed, merged ✅ ([PR #169](https://github.com/alfredpanakkal/helm.navwarning/pull/169))

### 1-F · Remaining components sweep — Batch 1
- [x] Branch `fix-buttons-remaining-attrs-1` created
- [x] Files: `WarningDetailModal`, `WarningEditModal`, `IngestionProcedureModal`, `MissingWarningsDrawer`, `LeafletMap`
- [x] `type="button"` on every `<button` in all five files
- [x] `aria-label` on icon-only buttons
- [x] `verifyPending` / `saving` / `committedId` guards verified wired to `disabled`
- [x] PR opened, reviewed, merged ✅ ([PR #170](https://github.com/alfredpanakkal/helm.navwarning/pull/170))

### 1-F · Remaining components sweep — Batch 2
- [x] Branch `fix-buttons-remaining-attrs-2` created
- [x] Files: `MapGeometryEditor`, `SupabaseStatusView`, `SourceRegistryView`, `GenerationInspectorView`, `AdminDataBankTools`
- [x] `type="button"` on every `<button` in all five files
- [x] `aria-label` on icon-only buttons
- [x] PR opened, reviewed, merged ✅ ([PR #171](https://github.com/alfredpanakkal/helm.navwarning/pull/171))

### 1-F · Remaining components sweep — Batch 3
- [x] Branch `fix-buttons-remaining-attrs-3` created
- [x] Files: `DataBankSummary`, `DataBankStatusBar`, `DisclaimerBanner`, `InForceCoverageBanner`
- [x] `type="button"` on every `<button` in all four files
- [x] Final check: `git grep -rn '<button ' src/components/ | grep -v 'type='` → 0 results
- [x] PR opened, reviewed, merged ✅ ([PR #172](https://github.com/alfredpanakkal/helm.navwarning/pull/172))

---

## Phase 2 — Moss Palette Alignment

### 2-A · FAB palette (`App.tsx`)
- [x] Branch `fix-buttons-fab-palette` created
- [x] FAB line 761: `bg-emerald-600 hover:bg-emerald-500 ring-emerald-400` → `bg-[var(--accent)] hover:brightness-110 ring-[var(--accent)]`
- [x] Edit FAB: verified `type="button"` added in Phase 1; colour already correct (`bg-gw-primary`)
- [x] `font-bold`/`font-semibold` on button classNames → `font-medium`
- [x] No `emerald-` token remains in `src/App.tsx`
- [x] PR opened, reviewed, merged ✅ ([PR #173](https://github.com/alfredpanakkal/helm.navwarning/pull/173))

### 2-B · Verify palette — modal + drawer
- [x] Branch `fix-buttons-verify-palette-modal` created
- [x] `WarningDetailModal:820` Verify: `bg-emerald-600` → `bg-[var(--accent)] hover:brightness-110 text-[var(--canvas)]`
- [x] `WarningDetailModal:780` "Show Only This Message": → ghost `border border-[var(--ink)]/30 text-[var(--ink)] bg-transparent hover:bg-[var(--ink)]/5`
- [x] `WarningEditModal:501` drawer Verify: same accent token substitution
- [x] `DataBankWarningList:261` Quick Verify: same accent token substitution
- [x] No `emerald-`, `sky-` token on any button in these three files
- [ ] PR opened, reviewed, merged ✅

### 2-C · Verify palette — ingest views
- [ ] Branch `fix-buttons-verify-palette-ingest` created
- [ ] `ManualParserView` lines 489, 894, 1046: `bg-emerald-600` → `bg-[var(--accent)] hover:brightness-110 text-[var(--canvas)]`
- [ ] `CsvUploaderView:1605` staged save: same substitution
- [ ] `MapGeometryEditor:770` "Finish shape": same substitution
- [ ] No `emerald-` token on primary action buttons in these three files
- [ ] PR opened, reviewed, merged ✅

### 2-D · Deviant palette + motion cleanup
- [ ] Branch `fix-buttons-deviant-palette` created
- [ ] `SupabaseStatusView:328`: removed `active:scale-95`, `shadow-md`, `border-indigo-700`; `bg-indigo-600` → `bg-[var(--accent)] hover:brightness-110 text-[var(--canvas)]`
- [ ] `AdminDataBankTools:353`: `bg-amber-600` → ghost `border border-[var(--accent)] text-[var(--accent)] bg-transparent hover:bg-[var(--accent)]/8`
- [ ] `font-bold`/`font-semibold` on buttons in both files → `font-medium`
- [ ] No `active:scale-*`, `shadow-*`, `indigo-*`, `amber-*` on any button in either file
- [ ] PR opened, reviewed, merged ✅

---

## Phase 3 — Touch Targets

### 3-A · Public `.btn-sm` mobile touch target
- [ ] Branch `fix-buttons-touch-targets` created
- [ ] `public/assets/css/components.css` after line 101: `@media (pointer: coarse) { .btn-sm { min-height: 44px; min-width: 44px; } }` added
- [ ] Verified in Chrome DevTools: `.btn-sm` ≥ 44px on `pointer: coarse` emulation
- [ ] Desktop layout unchanged
- [ ] PR opened, reviewed, merged ✅

### 3-B · Console icon button tap targets
- [ ] Branch `fix-buttons-console-taptargets` created
- [ ] `EcdisFeatureEditor` vertex control buttons: `p-2` padding added
- [ ] `LeafletMap` accordion action buttons: `min-h-[2.75rem] min-w-[2.75rem]` or `p-2` added
- [ ] PR opened, reviewed, merged ✅

---

## Phase 4 — Single-Fire Guards

### 4-A · Refresh + run-load + delete guards
- [ ] Branch `fix-buttons-singlefire-guards` created
- [ ] `index.html:573` `refreshData` button: disabled on call, re-enabled in `.finally()`
- [ ] `GenerationInspectorView:175` `loadRuns` button: `disabled={runsLoading}` added
- [ ] `EcdisFeatureEditor:385` `handleDeletePoint`: `window.confirm()` guard added
- [ ] Double-click test: `refreshData` button — only one network request fires
- [ ] `loadRuns` button: disabled while loading, re-enabled on completion/error
- [ ] Delete point: confirmation dialog appears; cancel = no delete
- [ ] PR opened, reviewed, merged ✅

---

## Phase 5 — Style Consistency (Cosmetic)

### 5-A · Font weight + radius cleanup
- [ ] Branch `fix-buttons-style-sweep` created
- [ ] `font-bold`/`font-semibold`/`font-black` on button classNames → `font-medium` across all components
- [ ] `rounded-lg`/`rounded-xl` on non-pill buttons → `rounded` (exception: FAB `rounded-full`)
- [ ] `shadow-*` sweep confirms zero remaining on buttons (not removed in Phase 2)
- [ ] `git grep -rn 'font-bold\|font-semibold\|font-black' src/components/ | grep 'button\|btn'` → 0
- [ ] PR opened, reviewed, merged ✅

---

## Final Verification

- [ ] `git grep -rn '<button ' src/components/ | grep -v 'type='` → 0 results
- [ ] `git grep -rn 'bg-emerald-\|bg-indigo-\|bg-sky-\|bg-amber-' src/components/` → 0 results on buttons
- [ ] `git grep -rn 'active:scale-\|shadow-md\|shadow-lg' src/components/` → 0 results on buttons
- [ ] Axe/WAVE clean pass on: public portal, Data Bank, ingest import tabs, Warning Detail modal
- [ ] Mobile (pointer: coarse): all public `.btn-sm` ≥ 44px; all console icon buttons ≥ 44px
- [ ] Maintainer confirms `npm test` + `npm run lint` pass on `main` after all merges

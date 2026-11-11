# UI Button Fix — Task Checklist

> Companion to `tasks/plan.md`. Tick each item when the PR is **merged to main**.  
> Branch off current `main` for every task. Never merge your own PR.

---

## Phase 1 — Attribute Hygiene (zero visual change)

### 1-A · Public portal button attrs
- [ ] Branch `fix-buttons-public-attrs` created off `main`
- [ ] `type="button"` added to all 9 `<button>` elements in `index.html`
- [ ] `aria-expanded` wired to gear toggle + focus-panel disclosure button
- [ ] `aria-pressed` wired to coord-display + focus-mode toggle buttons
- [ ] `aria-label` added to any icon-only button missing visible text
- [ ] PR opened; body includes root-cause + file list + test plan
- [ ] Maintainer ran `npm test` + `npm run lint` ✅
- [ ] **PR merged** → tick here ✅

### 1-B · Shell button attrs (`App.tsx`, `NavRail.tsx`)
- [ ] Branch `fix-buttons-shell-attrs` created
- [ ] `type="button"` on all 8 buttons in `App.tsx`
- [ ] `type="button"` on all buttons in `NavRail.tsx`
- [ ] `aria-label` added to icon-only nav buttons; `aria-current="page"` on active item
- [ ] PR opened, reviewed, merged ✅

### 1-C · Header + WorkspaceView attrs
- [ ] Branch `fix-buttons-header-workspace-attrs` created
- [ ] `type="button"` on ~18 buttons across both files
- [ ] `aria-pressed` on mobile-menu + panel-collapse toggles
- [ ] `aria-expanded` + `aria-controls` on disclosure triggers
- [ ] `isLoggingIn` disabled guard verified still connected (no change needed if correct)
- [ ] PR opened, reviewed, merged ✅

### 1-D · DataBank layer attrs
- [ ] Branch `fix-buttons-databank-attrs` created
- [ ] `type="button"` on ~25 buttons in `DataBankControls`, `DataBankWarningList`, `WarningItemV2`
- [ ] `verifyingIds.has(id)` guard verified correctly wired to `disabled` on Quick Verify
- [ ] `aria-sort` confirmed present on column sort buttons (no change if already ✅)
- [ ] `aria-label` on icon-only action buttons in `WarningItemV2`
- [ ] PR opened, reviewed, merged ✅

### 1-E · Ingest layer attrs + import tab semantic roles
- [ ] Branch `fix-buttons-ingest-attrs` created
- [ ] `type="button"` on all missing buttons in `CsvUploaderView`, `ManualParserView`, `EcdisFeatureEditor`
- [ ] `CsvUploaderView` lines 836–885: `role="tablist"` on container
- [ ] Each import tab button has `role="tab"` + `aria-selected` + `aria-controls`
- [ ] Each tab panel has `role="tabpanel"` + `aria-labelledby`
- [ ] `aria-selected` toggled correctly in JS on tab click
- [ ] `aria-label` on EcdisFeatureEditor vertex/point icon buttons
- [ ] PR opened, reviewed, merged ✅

### 1-F · Remaining components sweep — Batch 1
- [ ] Branch `fix-buttons-remaining-attrs-1` created
- [ ] Files: `WarningDetailModal`, `WarningEditModal`, `IngestionProcedureModal`, `MissingWarningsDrawer`, `LeafletMap`
- [ ] `type="button"` on every `<button` in all five files
- [ ] `aria-label` on icon-only buttons
- [ ] `verifyPending` / `saving` / `committedId` guards verified wired to `disabled`
- [ ] PR opened, reviewed, merged ✅

### 1-F · Remaining components sweep — Batch 2
- [ ] Branch `fix-buttons-remaining-attrs-2` created
- [ ] Files: `MapGeometryEditor`, `SupabaseStatusView`, `SourceRegistryView`, `GenerationInspectorView`, `AdminDataBankTools`
- [ ] `type="button"` on every `<button` in all five files
- [ ] `aria-label` on icon-only buttons
- [ ] PR opened, reviewed, merged ✅

### 1-F · Remaining components sweep — Batch 3
- [ ] Branch `fix-buttons-remaining-attrs-3` created
- [ ] Files: `DataBankSummary`, `DataBankStatusBar`, `DisclaimerBanner`, `InForceCoverageBanner`
- [ ] `type="button"` on every `<button` in all four files
- [ ] Final check: `git grep -rn '<button ' src/components/ | grep -v 'type='` → 0 results
- [ ] PR opened, reviewed, merged ✅

---

## Phase 2 — Moss Palette Alignment

### 2-A · FAB palette (`App.tsx`)
- [ ] Branch `fix-buttons-fab-palette` created
- [ ] FAB line 761: `bg-emerald-600 hover:bg-emerald-500 ring-emerald-400` → `bg-[var(--accent)] hover:brightness-110 ring-[var(--accent)]`
- [ ] Edit FAB: verified `type="button"` added in Phase 1; colour already correct (`bg-gw-primary`)
- [ ] `font-bold`/`font-semibold` on button classNames → `font-medium`
- [ ] No `emerald-` token remains in `src/App.tsx`
- [ ] PR opened, reviewed, merged ✅

### 2-B · Verify palette — modal + drawer
- [ ] Branch `fix-buttons-verify-palette-modal` created
- [ ] `WarningDetailModal:820` Verify: `bg-emerald-600` → `bg-[var(--accent)] hover:brightness-110 text-[var(--canvas)]`
- [ ] `WarningDetailModal:780` "Show Only This Message": → ghost `border border-[var(--ink)]/30 text-[var(--ink)] bg-transparent hover:bg-[var(--ink)]/5`
- [ ] `WarningEditModal:501` drawer Verify: same accent token substitution
- [ ] `DataBankWarningList:261` Quick Verify: same accent token substitution
- [ ] No `emerald-`, `sky-` token on any button in these three files
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

# NavWarning (Helm.Warning) — Public vs Admin Split Design

Date: 2026-10-07
Status: draft for review
Sources: `src/App.tsx:39-48,385`, `src/components/Header.tsx:49-62,95,99-129`, `DESIGN.md`, `UI-DESIGN-FUNDAMENTALS.md`

## 1. Goal

Split the app into a clear public surface (no login) and an admin surface (Supabase Auth gated) so that:
- Public users can browse map, data bank, and sources safely.
- Admins can run ingestion, verify warnings, and inspect pipeline provenance.
- Deep-links to admin tabs degrade gracefully to a gate card, never blank.

Non-goals: no auth role changes, no new tabs, no visual redesign. GATEWORKS tokens unchanged.

## 2. Definitions

Public tabs (`Header.tsx:49-53`):
- `map` — Map View
- `databank` — Data Bank with `activeCount` badge
- `sources` — Sources

Admin tabs (`Header.tsx:55-62`):
- `workspace` — Pipeline Ingestion overview
- `manual` — Manual Parser
- `imports` — Bulk Import (CSV/GPX/S-124 ZIP)
- `audit` — Audit Log (generations)
- `evidence` — Evidence Locker (artifacts)
- `supabase` — Supabase Server health

Visibility rule (`Header.tsx:95`):
`visibleTabs = isAdminMode ? [...publicTabs, ...adminTabs] : publicTabs`

Admin gate:
- Unlock via modal email+password -> `adminLogin()` -> Supabase `app_metadata.role in [admin, superadmin]` or `is_admin=true`, or fallback `sessionStorage helm_admin_token`.
- Lock via `adminLogout()` -> `setIsAdminMode(false)`; if active tab was admin, redirect to `map` (`Header.tsx:131-137`).
- In `App.tsx:385`, any admin tab rendered while `!isAdminMode` shows Administrative Gate card with [Return to Map] [Unlock Admin Tools].

## 3. App Shell Wireframe (shared)

```
+------------------------------------------------------------------+
| HEADER Helm.Warning NAVAREA Data Bank & Ingestion                |
| [Map View | Data Bank(n) | Sources (+ admin tabs if admin)]      |
| [n Active -> databank] [Lock Admin Mode / Admin Access]          |
+------------------------------------------------------------------+
| STATUS: CONNECTING... / SYNC FAILED [Retry Sync] / OFFLINE MODE  |
| DISCLAIMER BANNER                                                |
+------------------------------------------------------------------+
| MAIN max-w-[1600px] p-3/6/8 mono bg-gw-bg                        |
|  activeTab content                                               |
+------------------------------------------------------------------+
| FOOTER                                                           |
| FAB (admin+databank+unverified>0): [Verify Next (n)]             |
| MODALS: WarningDetail | IngestionProcedure | Admin Unlock | More |
+------------------------------------------------------------------+
| MOBILE: bottom bar [Map][Data Bank][Sources][More]               |
| More drawer groups: TOOLS / RECORDS / SYSTEM, lock icon if gated |
+------------------------------------------------------------------+
```

Design tokens: `Courier New` all text, UPPERCASE labels, 4px buttons/inputs, 8px inner panels, 16px cards, 2px `border-gw-primary`, hard `4px 4px 0` shadow, `translateY(-2px)` hover. Palette `DESIGN.md`: graphite `#14161c`, steel `#c8ccd8`, charcoal `#262a34`, bg `#e8e8f0`, slate `#5a5f70`; functional green `#4ade80`, amber `#ca8a04`, red `#dc2626`.

## 4. Public Surface Detail

### 4.1 MAP `map`
```
[NavArea=ALL] [Isolation pill x CLEAR if isolatedWarning]
Grayscale Leaflet, markercluster
markers: green active, amber expiring/degraded, red down/critical, grey unverified
click -> WarningDetailModal (read path)
```
Behaviors: `onSelectWarning` sets `selectedWarning`; `onIsolateWarning` sets `isolatedWarning`, switches to map; `onClearIsolation` clears.

### 4.2 DATABANK `databank`
Legacy (`DataBank`) vs V2 (`DataBankV2`) via `useUILegacy()`; same data contract.
```
[StatusBar: counts by status] [Summary cards]
[Controls: status filter (dataBankStatusFilter), search, Trigger Refresh]
List: warning_number, series NAVAREA, issued_at, status, extraction_confidence, validation.geometry
Row actions: [Locate -> map] [Verify -> status=active, confidence=1.0]
Commit path (imports/manual): handleCommitWarnings prepends, sets filter ALL, goes to databank, background saveImportedWarningsToSupabase
```

### 4.3 SOURCES `sources`
Legacy vs V2 same pattern.
```
Table: source_id, publisher, health, enabled toggle, last generation
Actions: onToggleSource(sourceId, enabled) local-only; onTriggerRefresh(sourceId?) pipeline refresh
Filter: sourcesFilterStatus via handleNavigateWithFilter
```

## 5. Admin Surface Detail

Gate card (`App.tsx:385-414`): lock icon, title ADMINISTRATIVE GATE ACTIVE, copy, [Return to Map] [Unlock Admin Tools].

### 5.1 WORKSPACE `workspace` (Pipeline)
Props: sources, warnings, generations, supabaseConnected, onNavigate, onNavigateWithFilter, onSelectWarning.
Shows pipeline health, counts, shortcuts to databank/sources with status filter.

### 5.2 MANUAL `manual`
`ManualParserView` props: onParseManual(rawText, navarea, mode, aiModel), onSelectWarning -> databank.
Modes: `hybrid | llm | regex`, default `hybrid`, model default `mistral-small-latest`.
Server `parseManualWarning` first; fallback deterministic `parseCoordinatesDeterministic` creates `warn-manual-{ts}` with confidence 0.95 if geometries else 0.5, `ai_parsing_failed=true`.

### 5.3 IMPORTS `imports`
`CsvUploaderView` prop: onCommitWarnings.
Parses CSV/GPX/S-124 ZIP (papaparse/jszip), preview, commit batch to head of warnings.

### 5.4 AUDIT `audit`
`GenerationInspectorView` props: generations, sources.
Lists `IngestionGeneration` with atomic pointers linking source -> generation -> warnings/artifacts.

### 5.5 EVIDENCE `evidence`
`EvidenceLockerView` prop: artifacts.
Object-storage view of `RawArtifact` refs (`raw_artifact_ref`, `content_hash`).

### 5.6 SUPABASE `supabase`
`SupabaseStatusView` props: warnings, artifacts, generations.
DB hub: connection state, table counts, last sync. Mirrors header status bar.

## 6. Workflows

### 6.1 Public user flow
```
Land MAP -> pan/zoom cluster -> click marker -> detail read -> Close / Isolate
-> DATABANK filter ALL/active/unverified -> search -> Locate (to MAP) / Verify single
-> SOURCES browse health -> toggle view filter -> Trigger Refresh (public allowed)
-> OFFLINE banner? -> Retry Sync (loadData)
```

### 6.2 Admin ingestion flow
```
Unlock Admin (modal auth) -> tabs appear (desktop) / More drawer unlocks (mobile)
-> WORKSPACE check supabaseConnected (!isOfflineMode)
-> TRIGGER REFRESH [optional sourceId] -> triggerPipelineRefresh -> refetch 4 collections
-> AUDIT verify generation ok -> EVIDENCE verify artifact stored
-> DATABANK Verify Next queue (unverified or conf<0.8): WarningDetailModal Prev/Next -> Verify
-> MAP confirm geometry -> SUPABASE confirm counts
Alt: MANUAL paste -> parse -> commit -> DATABANK
Alt: IMPORTS bulk file -> preview -> commit -> background Supabase save
Lock -> redirect to MAP
```

### 6.3 System data flow
```
SourceRegistryItem(enabled) + Manual/CSV input
 -> triggerPipelineRefresh / parseManualWarning / handleCommitWarnings
 -> fetchSources/fetchWarnings/fetchGenerations/fetchArtifacts (Supabase)
   success: replace collections if non-empty, isOfflineMode=false
   fail: isOfflineMode=true, dataError set, keep INITIAL_* local store, show banner
 -> generations + artifacts -> warnings (status, validation, extraction_confidence)
 -> databank filter/sort -> map markers -> detail modal -> verify/isolate
```

## 7. Error Handling

- `isLoadingData`: blue CONNECTING bar, `role=status`.
- `dataError && !isLoading`: red SYNC FAILED bar with message + Retry Sync -> `loadData()`.
- `isOfflineMode && !dataError`: amber OFFLINE bar, local store note.
- `handleTriggerRefresh` catch logs, always resets `isPipelineRefreshing`.
- `handleParseManual` catch falls back to deterministic parser, never throws to UI; returns `ai_parsing_failed` flag.
- `handleCommitWarnings` background Supabase save wrapped in try/catch warn-only.
- Admin auth errors shown inline in modal (`authErrorMessage`), missing fields blocked client-side.

## 8. Testing Checklist

- Public: MAP renders without admin, DATABANK filter/locate works, SOURCES toggle does not require auth, gate card appears on direct `#workspace` without admin.
- Admin: unlock with admin role shows 9 tabs, lock returns to map, FAB appears only admin+databank+queue>0, manual fallback creates warning when API offline, CSV commit prepends and navigates to databank.
- Mobile: bottom bar 3 + More; More drawer shows lock icons when logged out, unlocks after login.
- A11y: skip-link, `role=tablist/tab`, `aria-selected`, modal focus, status `role=status/alert`.

## 9. Scope Note

Single spec, no decomposition needed. Implementation would be docs-only unless follow-up UI work (e.g., clearer gate copy, tab badges) is approved. No code changes in this spec.

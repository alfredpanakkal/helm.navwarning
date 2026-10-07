# NavWarning (Helm.Warning) — Public/Admin Split Design

Date: 2026-10-07
Status: draft for review

## 1. Goal

- Create a clear public surface that requires no login.
- Create an admin surface protected by Supabase Auth.
- Ensure deep‑links to admin tabs render a Gate card instead of a blank screen.

## 2. Tab Visibility

| Tab | Visibility | Condition |
|------|------------|-----------|
| map | always | – |
| databank | always | – |
| sources | always | – |
| workspace, manual, imports, audit, evidence, supabase | admin only | `isAdminMode` true |

The header tab list is built with `visibleTabs = isAdminMode ? [...publicTabs, ...adminTabs] : publicTabs`.

## 3. Gate Card

When a user navigates to an admin tab while `!isAdminMode`, the header omits that tab and renders a Gate card that reads:

```
ADMINISTRATIVE GATE ACTIVE
This operational tool is restricted to administrative sessions.

[Return to Map]  [Unlock Admin Tools]
```

Clicking **Unlock Admin Tools** opens the login modal.

## 4. Admin Unlock Modal

- Email + password → `adminLogin()`.
- Success → `setIsAdminMode(true)`; modal closes.
- Failure → error shown in modal.
- Lock → `adminLogout()` → redirect to `map` if the current tab is an admin tab.

## 5. Public Tabs

### 5.1 Map
- Grayscale Leaflet map with marker clustering.
- Markers colored: green (active), amber (expiring), red (critical), grey (unverified).
- Clicking a marker opens a read‑only **WarningDetailModal**.

### 5.2 Data Bank
- Legacy and V2 variants share the same data contract.
- Presents a status bar with counts and a table of warnings.
- Actions per row: **Locate** (goes to map) and **Verify** (sets status active, confidence 1.0).
- Local `handleCommitWarnings()` prepends new warnings and optionally calls `saveImportedWarningsToSupabase` in the background.

### 5.3 Sources
- Table of source registry items.
- Toggle enable/disable locally.
- Trigger refresh per source or all; calls `triggerPipelineRefresh()`.

## 6. Admin Tabs

### 6.1 Workspace (Pipeline)
- Shows pipeline health and counts of pending/queued/completed items.
- Buttons to navigate to Data Bank or Sources with a specific status filter.

### 6.2 Manual Parser
- **ManualParserView** accepts raw NAVWARN text, navarea, parsing mode, and AI model.
- Server first: `parseManualWarning()`.
- Fallback deterministic parser if server fails; creates warning with confidence 0.95 when geometry is present.
- Commits warning locally and silently uploads to Supabase.

### 6.3 Bulk Import
- **CsvUploaderView** previews CSV/GPX/S‑124 ZIP and lets the user commit a batch of warnings.
- The batch is prepended to the local list and uploaded to Supabase asynchronously.

### 6.4 Audit Log
- **GenerationInspectorView** displays each `IngestionGeneration` with links to source, generation, and associated warnings/artifacts.

### 6.5 Evidence Locker
- **EvidenceLockerView** lists `RawArtifact` entries (`raw_artifact_ref`, `content_hash`).

### 6.6 Supabase Server
- **SupabaseStatusView** shows DB connectivity, table counts, and last sync time.

## 7. Workflows

1. **Public** – User lands on map, can switch to Data Bank or Sources, verify individual warnings, or refresh data.

2. **Admin** – User unlocks admin, accesses all tabs, triggers pipeline refresh, verifies queues via the FAB, and locks admin to return to map.

## 8. Accessibility and Error Handling

- Tabs use `role="tablist"` and `role="tab"` with `aria-selected`.
- Gate card and modal provide focus trap, close on Esc.
- Status bars use `role="status"` or `role="alert"`.
- Error banners are bright with a retry button.
- FAB is disabled when `!isAdminMode`.

## 9. Testing Checklist

- Verify public header shows three tabs.
- Verify admin header shows nine tabs after unlocking.
- Gate card appears on direct link to `/workspace` when not logged in.
- Bulk import, manual parse, reload, and error flows work as described.
- Mobile view shows three core tabs and More drawer with six admin tabs (locked when not admin).
- All ARIA roles and labels are present.

---

*Prepared by OpenCode AI (brainstorming skill)*

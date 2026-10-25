# Implementation Plan: Console UI/UX Remediation Across All 4 Sections

This plan outlines the systematic engineering fixes for the critical, moderate, and low severity UI/UX issues identified in the `/console#/` administrative application audit across **Warnings**, **Ingest**, **Trace**, and **System**.

---

## 1. Phase 1: Critical Operational Blockers & Z-Index Layering

### 1.1 Unify Global Z-Index Hierarchy
- **Problem**: Modals (`WarningDetailModal` at `z-50`) collide with the sticky header (`z-50`), while the floating action buttons (FABs in `App.tsx` at `z-[900]`) hover awkwardly over open modal dialogs.
- **Solution**:
  - Establish a strict z-index scale in `src/index.css` or Tailwind theme:
    - Base content: `z-0` – `z-10`
    - Sticky Header (`site-header`): `z-30`
    - Floating Map Drawer: `z-35`
    - Floating Action Buttons (FAB): `z-40` (hidden when any modal is open)
    - Modal Backdrops / Dialogs: `z-50` (`WarningDetailModal`, `IngestionProcedureModal`)
    - Nested Edit / Confirmation Modals: `z-[60]` (`WarningEditModal`, `ConfirmationModal`)
    - Toast notifications & critical alerts: `z-[70]`
  - Conditionally suppress FAB rendering in `App.tsx` whenever `selectedWarning !== null || editingWarning !== null`.

### 1.2 Fix Runtime Exception in `WorkspaceView.tsx`
- **Problem**: Clicking "Ingestion Procedure" calls `setIsIngestionProcedureOpen(true)` directly, which is undefined when rendered by `App.tsx`, causing a fatal React unmount/white-screen crash.
- **Solution**:
  - In `src/App.tsx`, instantiate and manage `isIngestionProcedureOpen` state and pass both `isIngestionProcedureOpen` and `setIsIngestionProcedureOpen` to `<WorkspaceView />`.
  - In `src/components/WorkspaceView.tsx`, use optional chaining: `setIsIngestionProcedureOpen?.(true)` and render `<IngestionProcedureModal />` if requested.

### 1.3 Add Destructive Action Confirmation Barriers
- **Problem**: Bulk imports in `CsvUploaderView.tsx` and manual parsing saves in `ManualParserView.tsx` commit directly to the live Supabase database without two-step confirmation.
- **Solution**:
  - Introduce a reusable `ConfirmationModal` component with `--critical: #dc2626` accents, displaying warning counts, target NAVAREAs, and explicit "Cancel" vs "Confirm & Commit" buttons.

### 1.4 Purge Fabricated Mock Telemetry in Pipeline Overview
- **Problem**: `WorkspaceView.tsx` renders static `MOCK_LOGS` and fabricated accuracy/latency metrics ("412ms", "100%", "98.6%"), violating maritime safety rules against fabricated data.
- **Solution**:
  - Replace `MOCK_LOGS` with real pipeline status fetched from `fetchPipelineRuns()` or display an empty/standby message when no runs have occurred.
  - Calculate real metrics from the `sources` and `warnings` props rather than static numbers.

---

## 2. Phase 2: Layout Consistency, Max-Width Harmonization & Data Density

### 2.1 Harmonize View Container Widths and Remove Double Padding
- **Problem**: `GenerationInspectorView.tsx`, `EvidenceLockerView.tsx`, and `SourceRegistryView.tsx` wrap themselves in `max-w-7xl mx-auto p-4 md:p-6` inside `<main className="p-3 sm:p-6 md:p-8 max-w-[1600px]">`, causing 60px+ gutter waste and horizontal container snapping on tab switch.
- **Solution**:
  - Strip the redundant inner `max-w-7xl mx-auto p-4 md:p-6` wrappers from child view components.
  - Let `<main>` govern the consistent `max-w-[1600px] w-full mx-auto` footprint across all tabs.

### 2.2 Responsive Grid Restructuring in Pipeline Actions
- **Problem**: `xl:grid-cols-6` makes action cards in `WorkspaceView.tsx` excessively narrow on 1280px–1440px displays, clipping labels.
- **Solution**:
  - Adjust grid to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6` with flex wrapping and minimum card widths (`min-w-[180px]`).

### 2.3 Horizontal Overflow Protection for Data Bank Controls
- **Problem**: Status filter chips and NAVAREA pills in `DataBankControls.tsx` wrap irregularly on tablet and zoomed viewports.
- **Solution**:
  - Group filters into logical semantic rows with clean dividers, scrollable pill strips (`overflow-x-auto touch-pan-x no-scrollbar`), and clear active border tokens.

---

## 3. Phase 3: Interactive States, Focus Rings & Routing

### 3.1 Comprehensive Keyboard Accessibility (`focus-visible`)
- **Problem**: Table rows, quick buttons, and filter toggles lack visible focus indicators.
- **Solution**:
  - Apply uniform `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2` to all interactive controls.

### 3.2 Deep-Link Filter & Query Param Persistence
- **Problem**: Refreshing `/console#/warnings/list` resets active filters (e.g. `statusFilter`, `searchQuery`, `navarea`).
- **Solution**:
  - Enhance `parseHashRoute` in `App.tsx` and history push to preserve `?status=`, `?navarea=`, and `?q=` in the hash router.

---

## Verification & Validation Plan
1. **TypeScript & Compilation**:
   - `npm run lint` (`tsc --noEmit`) and `compile_applet`.
2. **Unit & Integration Suite**:
   - `npm test` (verify 169+ tests continue to pass).
3. **Manual UX Smoke**:
   - Test modal opening and verify FAB disappears.
   - Test "Ingestion Procedure" button in WorkspaceView to ensure modal opens without crashing.
   - Test tab switching across all 4 sections to verify container width alignment and zero horizontal shift.

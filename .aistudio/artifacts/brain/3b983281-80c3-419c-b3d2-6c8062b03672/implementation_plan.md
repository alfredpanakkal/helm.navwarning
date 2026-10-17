# Implementation Plan - Helm.Warning Maritime Safety Information Platform Refinements

## Objective
Verify, audit, and finalize the Helm.Warning frontend application (`src/`), ensuring flawless integration between the interactive Leaflet Map spatial engine, Data Bank, Verification Queue, and Supabase database contract.

---

## Proposed Changes

### 1. Spatial Engine & Geodesic Calculations (`src/core/coordinates.ts`)
- Verify all geodesic distance, polygon surface area, centroid calculations, and corridor buffer generation functions.
- Ensure strict compliance with S-124 and NAVAREA polygon/circle serialization formats.

### 2. Map Rendering & Responsive Touch Architecture (`src/components/LeafletMap.tsx`, `src/components/MaritimeMap.tsx`)
- Audit multi-plot rendering: Polygons with dashed nautical borders, centroid metric badges, amber corner vertex markers with DMS coordinate tooltips, polyline route corridors, circular clearance exclusion zones, and drift vectors.
- Verify mobile/tablet responsive adaptation (bottom sheet drawer docking, touch-friendly filter toolbar, and CSS layout adjustments).

### 3. Warning Data Bank & UI Components (`src/components/DataBankWarningList.tsx`, `WarningItemV2.tsx`, `WarningDetailModal.tsx`)
- Verify position count badge logic (`getWarningPositionCount`).
- Ensure robust fallback and extraction handling for bulletin texts, issue dates, and coordinate formatting across all warning records.

### 4. Build & Test Verification
- Run full test suite (`npm test`) and linter (`lint_applet` / `tsc --noEmit`).
- Verify production bundle generation (`npm run build`).

---

## Verification Plan
1. Execute unit test suite to verify 124+ tests pass successfully.
2. Run TypeScript compilation (`tsc --noEmit`) to ensure zero type errors.
3. Verify production build output.

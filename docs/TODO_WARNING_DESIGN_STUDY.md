# Implementation Tracker: Warning Symbols & Geographic Plotting

> **Parent Design Study**: [`docs/COMPETITOR_WARNING_DESIGN_STUDY.md`](COMPETITOR_WARNING_DESIGN_STUDY.md)  
> **Status**: Ready to begin Phase 1  
> **Target Branch**: `competitor_warning_design_study`

---

## Roadmap Overview

```
Phase 1: 6-Symbol System & Severity Ring Decoupling       [COMPLETED]
Phase 2: Basic & Advanced Geometry Rendering (Sectors/Relocation) [COMPLETED]
Phase 3: Multi-Zone Label Splitting & Geometry Integrity         [COMPLETED]
Phase 4: Zoom Hierarchy, Decluttering & Legend Updates           [READY TO START]
Phase 5: Verification, Cross-Theme Parity & Golden Dataset Tests [PENDING]
```

---

## Phase 1 — Establish the 6-Symbol System & Severity Ring Decoupling

- [x] **1.1 Symbol Mapping Module**
  - Create `src/utils/symbolMapping.ts`.
  - Define `PrimarySymbol` union: `'general' | 'military' | 'drifting' | 'aton' | 'subsea' | 'wreck'`.
  - Implement `toPrimarySymbol(category: HazardCategory): PrimarySymbol`.
  - Write pure unit tests in `src/utils/__tests__/symbolMapping.test.ts`.

- [x] **1.2 Unified SVG Glyphs & Badge Generator**
  - Update `src/utils/hazardIcons.ts`:
    - Clean SVG paths for the 6 primary symbols (`PRIMARY_SVG_PATHS`).
    - Decoupled badge generation: glyph is dictated by `PrimarySymbol`; border/halo is dictated by `Severity` (`critical` $\to$ `#B42318`, `high` $\to$ `#8C5208`, `active/moderate` $\to$ `#2F6B4F`).
    - Eliminate legacy hardcoded blues/yellows in favor of design system tokens (`--sev-critical`, `--sev-high`, `--accent`).

- [x] **1.3 Marker Rendering Integration in LeafletMap**
  - In `src/components/LeafletMap.tsx`:
    - Consume `toPrimarySymbol(classification.category)` for point markers.
    - Wrap markers with severity rings adhering to the 3-state system.
    - Dual-ring cluster markers reflect the 3-state token colors.

- [x] **1.4 Map Legend Updates**
  - Add Legend trigger button in top-right map toolbar.
  - Render accessible floating Map Legend popover documenting the 6 primary symbols, 3 severity rings, and boundary conventions.
  - Include disclaimer: *"Severity ratings reflect automated keyword matching and do not represent official IMO/IHO gradings."*

---

## Phase 2 — Basic & Advanced Geometry Rendering

- [x] **2.1 Sector / Arc Geometry**
  - Implement geodesic sector calculation in `src/core/coordinates.ts` (`computeSectorPolygon(center, radiusNm, startBearing, endBearing)`).
  - Add `sector_wedge` rendering in `LeafletMap.tsx`.
  - Wire sector parsing from bearing clauses in `src/parsers/geometryExtractor.ts` (rung 5.5).
  - Add unit tests for sector polygon calculations across 0°/360° north in `src/core/__tests__/coordinatesSector.test.ts`.

- [x] **2.2 Relocation & Drift Displacement**
  - Update `LeafletMap.tsx` to render `archetype === 'relocation'`:
    - Ghost marker at former coordinate (`dashArray: '3, 3'`).
    - Directional connector vector (`dashArray: '4, 4'`).
    - Solid terminus marker at new established position.
  - Refine `drift_vector` rendering with projected destination beacon.

- [x] **2.3 Geodesic Swath Refinement**
  - Refine `computeLineCorridor` in `src/core/coordinates.ts` to support asymmetric port/starboard buffer widths.

---

## Phase 3 — Multi-Zone Labeled Warnings

- [x] **3.1 Label-Aware Geometry Splitting**
  - Replace naïve bisection in `src/parsers/geometryExtractor.ts` (rung 2) with label-anchored splitting using `extractLabeledZoneGroups()`.
  - Extract and attach `zoneLabels` (e.g. `AREA A`, `AREA B`) to each parsed zone feature in `NavWarnGeometry`.
  - Add multi-zone unit test suite in `src/parsers/__tests__/multiZoneExtractor.test.ts`.

- [x] **3.2 Interactive Zone Selection**
  - In `src/components/LeafletMap.tsx`, when a user clicks a polygon belonging to a multi-zone warning:
    - Highlight the specific clicked zone boundary (`isZoneSelected`).
    - Open the parent warning drawer with the corresponding zone badge highlighted.
  - Render fallback multi-zone parsed polygons if no explicit PostGIS geometries exist.

---

## Phase 4 — Zoom Hierarchy & Decluttering

- [x] **4.1 Scale-Dependent Display Rules**
  - At global zoom ($z \le 5$): suppress complex vertices, display centroid points with cluster groups.
  - At regional zoom ($z = 6 \dots 9$): show simplified polygon borders, suppress vertex numbers.
  - At detailed zoom ($z \ge 10$): show full interactive vertex pills ($V_1 \dots V_n$) and measurement swaths.

- [x] **4.2 Boundary Semantics**
  - Enforce visual hierarchy:
    - Solid border: `EXPLICIT` geometry.
    - Dashed border: `INFERRED` geometry.
    - Dotted amber border: Tier B unverified geometry.

---

## Phase 5 — Verification & Multi-Theme Parity

- [ ] **5.1 Unit & Snapshot Testing**
  - Verify all 16 `HazardCategory` values correctly resolve to their assigned `PrimarySymbol`.
  - Verify sector math across 0°/360° north-crossing boundaries.
  - Verify corridor polygon closure and winding order.

- [ ] **5.2 Theme Contrast Testing**
  - Validate all 6 symbols and 3 severity rings across all 3 themes (`light`, `dark`, `night`) in `src/theme/themeContrast.test.ts`.

- [ ] **5.3 Real Bulletin Evaluation**
  - Validate against the baseline fixtures (`data/fixtures/oracle-expectations.json` and NAVAREA IV/IX corpora).

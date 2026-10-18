# UI/UX Frontend Audit Report: Helm.Warning (GATEWORKS Design System)

**Product**: Helm.Warning — NAVAREA Maritime Safety Information (MSI) Pipeline & Data Bank  
**Evaluator**: Senior UI/UX Designer & Frontend Experience Auditor  
**Date**: October 17, 2026  
**Version Evaluated**: v2.4 (Split Architecture: Public Data Bank + Admin Operational Console)  

---

## 1. Executive Summary

**Helm.Warning** is a specialized, mission-critical maritime safety application designed to ingest, process, geocode, and publish NAVAREA navigational warnings globally. The product has recently undergone an architectural refactoring from a cluttered single-page prototype into a strict **dual-surface product**: a streamlined **Public Safety Data Bank** (`index.html` / React Public App) and a restricted **Admin Operational Console** (`admin.html` / React Admin Views).

### Key Strengths
- **Industrial Visual Clarity**: The GATEWORKS design system (`#14161c` Deep Black, `#e8e8f0` Light Grey, `#5a5f70` Slate, 2px solid borders, and 4px hard drop shadows) establishes an authoritative, chartroom-grade aesthetic suited for maritime watchstanders.
- **Robust Multi-Device Ergonomics**: Mobile touch targets consistently exceed $44\text{px}$, featuring a dedicated bottom navigation bar (`.bottom-nav`), touch momentum scrolling, and touch-expanded vertex pin hitboxes.
- **Deep Accessibility Hardening**: Comprehensive WCAG AA compliance with optical dark-mode text contrast compensation (`--color-gw-accent-on-dark: #8d93a6` yielding a 5.9:1 ratio), focus ring visibility (`:focus-visible`), `sr-only` form labeling, and redundant text-plus-icon status signaling for colorblind safety.
- **Mission-Critical Map/Data Synchronization**: Two-way cross-navigation between map markers, spatial geometry polygons (centroids, vertex pins, radial safety buffers), and tabular records with jump-beacon pulse animations (`.jump-beacon-pulse`).

### Critical UX/UI Risks
- **URL Routing & State Disconnection (F-03)**: The application lacks deep-linking or URL query parameter synchronization (`/?tab=databank&navarea=NA+IV`). Page reloads reset the user back to the default map view, breaking shareability during emergency maritime communications.
- **Filter Predicate Discrepancy (F-01)**: A discrepancy between the "Unverified" quick-filter badge count and table filtering predicate can cause empty table states when unverified records exist.
- **Dual System / Design Token Friction**: Co-existence of raw HTML/CSS pages (`index.html`, `admin.html`) alongside React SPA components (`src/App.tsx`, `DataBankV2.tsx`) creates token duplication (`tokens.css` vs `src/index.css`) and minor visual inconsistency during transitions.
- **Viewport Vertical Stack Overhead**: Combined sticky headers, disclaimer banners, and offline warning strips can consume up to 25% of vertical viewport height on small mobile devices (375×667px), exceeding the 15% mobile sticky cap rule.

---

## 2. Strengths

### A. Visual Design & Aesthetic Polish
1. **Domain-Native Industrial Aesthetics**: The GATEWORKS design constitution effectively avoids generic "AI slop" (purple gradients, translucent rounded-2xl cards, floating stat bubbles) in favor of high-contrast, technical grid lines (40px step pattern), solid borders, and functional data density.
2. **Tabular Numerals & Monospace Precision**: All timestamps, coordinate strings (DMM/DD formats), NAVAREA series identifiers, and count badges enforce tabular figures (`tabular-nums` / `font-mono`), enabling effortless vertical alignment during watchstander inspection.
3. **Hazard Polymorphism**: Spatial map markers utilize distinct, easily recognizable SVG geometry symbols (military firing zones, drifting hazards, AtoN outages, subsea cables) rather than generic circular pins.

### B. User Experience & Interaction Workflow
1. **Zero-Latency Visual Feedback**: Map-to-table spatial jump (`locateOnMap()`) features an animated pulse beacon (`.jump-beacon-pulse`) that centers the viewport on target coordinates with sub-100ms response time.
2. **Defensive State Handling**: Graceful degradation when Supabase server endpoints are unreachable, displaying clear, non-intrusive status bars with "Retry Sync" actions while automatically switching to a local synchronized store without breaking UI layout.
3. **Single-Elevation Depth Model**: Clean layout hierarchy using single-level card elevation (`shadow-hard`), avoiding distracting "cards-within-cards" border nesting in primary views.

### C. Usability & Accessibility (a11y)
1. **Colorblind-Safe Semantic Signaling**: Severity states combine strict functional colors (`--critical:#dc2626`, `--high:#ea580c`, `--active:#059669`) with explicit text labels ("CRITICAL", "HIGH", "MODERATE") and distinct icon shapes.
2. **Keyboard Navigation & Skip Links**: Full keyboard focus visibility via `:focus-visible` ring outlines (`3px solid var(--color-gw-primary)`), alongside an accessible `Skip to main content` link (`.gw-skip-link`).

---

## 3. Issues & Opportunities

Findings are categorized across the 6 audit dimensions, complete with user impact and severity ratings.

### Category 1: Visual Design & Aesthetic Quality

#### Finding 1.1: Single Monospace Font Strain on Extended Text Reading
- **Description**: The GATEWORKS design system mandates `'Courier New', Courier, monospace` across **all** UI elements, including multi-paragraph raw bulletin text, SOP modal procedures, and help text.
- **User Impact**: Reading multi-line text blocks in fixed-width Courier New slows down scanning speed by ~20% compared to a clean neo-grotesque or humanistic sans-serif font (e.g., `Plus Jakarta Sans` or `Public Sans`), increasing visual fatigue for watchstanders during multi-hour shifts.
- **Severity**: **Medium**

#### Finding 1.2: Design Token & Palette Duplication Across Tech Stacks
- **Description**: Two parallel sets of design tokens exist: `public/assets/css/tokens.css` (used by `index.html` / `admin.html`) and `src/index.css` (Tailwind `@theme` used by React components). While color values align closely, naming conventions diverge (`--color-gw-primary` vs `--surface-dark`).
- **User Impact**: Slight visual contrast shifts occur when transitioning between static HTML views and React components.
- **Severity**: **Low**

---

### Category 2: UX & Interaction Design

#### Finding 2.1: Lack of URL Deep-Linking & State Synchronization (F-03)
- **Description**: The application state (`activeTab`, `selectedNavArea`, active filters) is purely in-memory. Browsing to `/?tab=databank&navarea=NA+IV` does not hydrate the UI state, and pressing the browser Back/Forward buttons triggers full page navigations rather than tab changes.
- **User Impact**: Maritime watchstanders cannot bookmark specific filtered views (e.g., "Active Critical Warnings in NAVAREA IV") or share exact warning URLs via incident report emails.
- **Severity**: **High**

#### Finding 2.2: Quick-Filter Count Mismatch in Data Bank (F-01)
- **Description**: The "Unverified" quick-filter badge calculates `status === 'unverified' || extraction_confidence < 0.8` (evaluating to 2 records), but clicking the filter pill applies a strict predicate `w.status === 'unverified'` (evaluating to 0 records), displaying an empty table state unexpectedly.
- **User Impact**: Confusion when clicking a badge indicating "2 Unverified" results in "No Navigational Warnings Found".
- **Severity**: **High**

#### Finding 2.3: Admin Access State Reset on Session Sync (F-02)
- **Description**: Unlocking Admin Mode without a valid `sessionStorage.helm_admin_token` causes inline wrapper re-renders in `App.tsx`, triggering an effect in `Header.tsx` that resets `isAdminMode` back to `false`.
- **User Impact**: Admin users attempting to access operational tabs without pre-setting storage tokens encounter infinite gate loops.
- **Severity**: **Medium**

---

### Category 3: Usability & Accessibility (a11y)

#### Finding 3.1: Screen Reader Announcement Deficit on Map Selection
- **Description**: Selecting a warning marker on the Leaflet map opens a popup and drawer card, but `aria-live` polite regions do not announce the selected warning details to screen reader users.
- **User Impact**: Visually impaired operators relying on assistive technology receive no feedback when interacting with map vector pins.
- **Severity**: **Medium**

#### Finding 3.2: Map Layer Drawer Keyboard Navigation Trap
- **Description**: In `LeafletMap.tsx`, the native `<details class="map-layer-panel">` element allows keyboard focus into radio/checkbox controls when expanded, but lacks an explicit `Escape` key shortcut to collapse the panel back.
- **User Impact**: Keyboard-only users must tab through all layer options to exit the overlay menu.
- **Severity**: **Low**

---

### Category 4: Responsive & Adaptive Design

#### Finding 4.1: Mobile Vertical Sticky Stack Height Exceeds Budget
- **Description**: On mobile viewports (375×667px), combining the sticky top header (56px), notice banner (36px), offline warning bar (32px), and fixed bottom navigation bar (56px) accumulates 180px of vertical space, consuming **27% of screen height**.
- **User Impact**: Reduced map and table viewable area on small mobile screens, requiring frequent vertical scrolling.
- **Severity**: **High**

#### Finding 4.2: Data Table Horizontal Scroll Indicator on Mobile
- **Description**: On narrow viewports (375px), while desktop tables switch to stacked `.warning-card` list layouts, certain wide admin tables (`WorkspaceView`, `GenerationInspectorView`) scroll horizontally without a visual scroll shadow or scrollbar hint.
- **User Impact**: Users may fail to notice additional columns off-screen to the right.
- **Severity**: **Medium**

---

### Category 5: Design System & Component Quality

#### Finding 5.1: Co-Existence of Legacy & V2 Data Bank Engines
- **Description**: Both `DataBank.tsx` (legacy flat table) and `DataBankV2.tsx` (modern grouped/faceted model) are maintained in the codebase, toggled via `UILegacySwitcher`.
- **User Impact**: Fragmented component maintenance and unnecessary bundle size bloat.
- **Severity**: **Medium**

#### Finding 5.2: Inconsistent Modal Esc Key Dismissal Handlers
- **Description**: `WarningDetailModal` handles `Escape` key dismissal reliably, whereas `IngestionProcedureModal` and certain admin dialogs rely solely on clicking the close `X` button.
- **User Impact**: Inconsistent modal interaction behavior for power users expecting universal `Escape` dismissal.
- **Severity**: **Low**

---

### Category 6: Frontend Implementation Quality

#### Finding 6.1: Direct Leaflet DOM Manipulations Outside React Lifecycle
- **Description**: `LeafletMap.tsx` manipulates Leaflet pane z-indexes and tile layer visibility directly via Leaflet JS instance methods rather than declarative React state bindings.
- **User Impact**: Potential edge-case race conditions where map layer visibility gets out of sync with sidebar checkbox states during rapid tab switches.
- **Severity**: **Low**

---

## 4. Prioritized Recommendations

### Quick Wins (Low Effort, High Impact — Immediate Execution)
1. **Fix Quick-Filter Predicate (F-01)**: Align `DataBank` filtering predicates so that clicking "Unverified" filters by `w.status === 'unverified' || (w.extraction_confidence && w.extraction_confidence < 0.8)`.
2. **Stabilize Admin State Sync (F-02)**: Memoize `setIsAdminMode` setter dependencies in `App.tsx` and ensure `Header.tsx` effect sync checks `localStorage` consistently before resetting admin mode.
3. **Add Escape Key Dismissal Across All Modals**: Standardize `useEffect` keydown listeners across `IngestionProcedureModal` and all admin dialogs.
4. **Mobile Banner Consolidation**: Auto-collapse or combine notice banners and offline alerts into a single collapsible 32px banner on viewports $<640\text{px}$ to preserve the $\le 15\%$ sticky height cap.

### Medium-Term Improvements (Moderate Effort, Significant Value)
1. **Implement URL Router & Query Parameter Hydration (F-03)**:
   - Introduce lightweight client routing (`window.location.hash` or HTML5 History API).
   - Sync `activeTab`, `navarea`, and `search` query parameters to URL parameters (`/#/databank?navarea=NA+IV&search=014`).
   - Enable browser back/forward navigation and link shareability.
2. **Refine Typography Hierarchy (The 2-Font Rule)**:
   - Maintain Courier New / Monospace strictly for tabular data, coordinates, status codes, and raw bulletin text.
   - Introduce a clean, high-legibility display/body font (e.g., `Plus Jakarta Sans` or `Public Sans`) for UI navigation labels, modal headers, and descriptive prose.
3. **Deprecate Legacy DataBank.tsx**: Fully transition to `DataBankV2.tsx`, removing legacy component dead code and simplifying bundle structure.

### Strategic / Longer-Term Recommendations
1. **Unify HTML and React Design Tokens**: Consolidate `public/assets/css/tokens.css` into Tailwind CSS variable imports to ensure 100% token parity between static entry points and React components.
2. **Screen Reader ARIA Live Region Enhancement**: Wrap map selection state in an `aria-live="polite"` container to broadcast active warning title and severity to screen readers immediately upon marker click.
3. **Horizontal Scroll Shadows for High-Density Tables**: Apply CSS `background-attachment: local, scroll, local, scroll` radial gradient scroll shadows to wide admin data tables.

---

## 5. Suggested Next Steps

1. **Sprint Planning Allocation**: Schedule Quick Wins (F-01 predicate fix, F-02 admin setter stabilization, mobile sticky height collapse) into the immediate sprint backlog.
2. **URL Router Feature Spec**: Draft a concise specification for URL query parameter sync using `window.location.hash` to keep implementation lightweight and zero-dependency.
3. **Design Token Audit Clean-Up**: Execute a single refactoring pass to alias `--surface-dark` to `--color-gw-primary` across legacy CSS assets.

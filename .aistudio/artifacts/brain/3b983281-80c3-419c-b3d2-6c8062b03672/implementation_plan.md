# Implementation Plan & Ticket Backlog: Helm.Warning UI/UX Improvements

A comprehensive, prioritized implementation roadmap and detailed ticket backlog (Jira/Linear style) for executing the Helm.Warning UI/UX improvement plan, focusing on immediate execution of Phase 1 Quick Wins while preserving the GATEWORKS industrial monospace design system.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following key decisions were confirmed during Phase 1 user alignment:
> - **Delivery Format**: Detailed ticket backlog (Jira/Linear style) with task IDs, priorities, acceptance criteria, and technical scope.
> - **Execution Strategy**: Begin executing Phase 1 Quick Wins (F-01, F-02, Escape key handlers, mobile sticky height cap) directly in code immediately.
> - **Typography Direction**: Maintain `'Courier New', Courier, monospace` everywhere to preserve the strict single-font industrial/nautical chartroom aesthetic.

---

## 1. Overview & Core Concept

**Helm.Warning** is a specialized NAVAREA maritime safety information (MSI) pipeline and public safety data bank. This plan structures the UI/UX audit findings into actionable Jira/Linear-style tickets, outlining immediate code fixes for critical bugs and usability issues while maintaining strict GATEWORKS design rules and zero-breakage pipeline constraints.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    HELM.WARNING ARCHITECTURE                            │
├───────────────────────────────────┬─────────────────────────────────────┤
│  PUBLIC SAFETY DATA BANK          │  ADMIN OPERATIONAL CONSOLE          │
│  - Map View (Leaflet + Polygons)  │  - Ingestion Pipeline & Logs        │
│  - Data Bank V2 (Faceted Search)  │  - Manual Parser & AI Escalation    │
│  - Source Registry                │  - CSV / GPX / S-124 Bulk Importer  │
│  - Public Warning Details Modal   │  - Generation Inspector & Storage   │
└───────────────────────────────────┴─────────────────────────────────────┘
```

---

## 2. Phase 1 Quick Wins Ticket Backlog (Immediate Execution)

### [HW-101] Fix Quick-Filter Predicate Discrepancy (F-01)
- **Type**: Bug Fix | **Priority**: P0 / Critical | **Effort**: 1 Story Point
- **Component**: `src/components/DataBank.tsx`, `src/components/DataBankV2.tsx`
- **User Impact**: Resolves issue where clicking "Unverified" filter badge (showing 2 records) produces an empty table state ("No Navigational Warnings Found").
- **Acceptance Criteria**:
  1. Quick filter count badge and filter predicate use identical matching logic: `w.status === 'unverified' || (w.extraction_confidence !== undefined && w.extraction_confidence < 0.8)`.
  2. Clicking "Unverified" badge populates table with all matching unverified and low-confidence candidates.
  3. Reset Filters restores standard active warning view.
- **Technical Tasks**:
  - Update filter matching function in `DataBank.tsx` and `DataBankV2.tsx` to include `extraction_confidence < 0.8` when `unverified` filter is active.

### [HW-102] Stabilize Admin Gate Setter & Session Synchronization (F-02)
- **Type**: Bug Fix | **Priority**: P1 / High | **Effort**: 1 Story Point
- **Component**: `src/App.tsx`, `src/components/Header.tsx`
- **User Impact**: Prevents Admin Mode from unexpectedly locking or resetting when switching tabs without pre-set session tokens.
- **Acceptance Criteria**:
  1. `setIsAdminMode` in `App.tsx` uses `useCallback` or stable reference to avoid re-render churn.
  2. `Header.tsx` session effect checks `localStorage.getItem('helm_admin_mode')` before attempting fallback reset.
  3. Toggling "Unlock Admin Tools" persists across tab changes within the session.
- **Technical Tasks**:
  - Wrap `setIsAdminMode` in `useCallback` inside `App.tsx`.
  - Update `Header.tsx` session effect dependencies to respect stored local state.

### [HW-103] Implement Universal Escape Key Modal Dismissal
- **Type**: Usability / Accessibility | **Priority**: P2 / Medium | **Effort**: 1 Story Point
- **Component**: `src/components/IngestionProcedureModal.tsx`, `src/components/WarningDetailModal.tsx`
- **User Impact**: Allows keyboard users to close any open modal dialog by pressing the `Escape` key.
- **Acceptance Criteria**:
  1. Pressing `Escape` while any modal is open closes the modal immediately.
  2. Keyboard focus returns to the triggering element.
  3. No event leaks to underlying map or table controls.
- **Technical Tasks**:
  - Add global `keydown` event listener for `Escape` key in `IngestionProcedureModal` and admin dialog overlays.

### [HW-104] Reduce Mobile Vertical Sticky Stack Height (< 15% Cap)
- **Type**: UX / Mobile Optimization | **Priority**: P1 / High | **Effort**: 2 Story Points
- **Component**: `src/App.tsx`, `src/components/Header.tsx`, `src/components/DisclaimerBanner.tsx`
- **User Impact**: Maximizes map and data table viewable area on mobile devices by reducing sticky header overhead from 27% to < 15% of viewport height.
- **Acceptance Criteria**:
  1. Aggregate height of fixed/sticky headers on screen sizes `< 640px` does not exceed 85px (~12-14% of mobile viewport).
  2. Offline mode and Supabase sync warning bars collapse into compact, single-line banners on mobile.
  3. Disclaimer banner auto-collapses or uses quiet inline footer presence on mobile viewports.
- **Technical Tasks**:
  - Add responsive Tailwind classes (`hidden sm:flex` / `text-[10px] py-1`) to notification banners on mobile.
  - Optimize `Header.tsx` sticky header padding on mobile screens.

---

## 3. Phase 2 & Phase 3 Ticket Backlog (Medium-Term & Strategic)

### [HW-201] Client-Side Hash Routing & Query Parameter Hydration (F-03)
- **Type**: Feature / UX | **Priority**: P1 / High | **Effort**: 3 Story Points
- **Component**: `src/App.tsx`, `src/hooks/useDataBankModel.ts`
- **Description**: Add hash routing (`/#/databank?navarea=NA+IV&status=active`) to support shareable URLs, bookmarking, and browser back/forward history.

### [HW-202] Deprecate Legacy DataBank.tsx & Standardize on DataBankV2
- **Type**: Tech Debt / Architecture | **Priority**: P2 / Medium | **Effort**: 2 Story Points
- **Component**: `src/App.tsx`, `src/components/DataBankV2.tsx`
- **Description**: Consolidate table rendering into `DataBankV2.tsx`, removing legacy duplicate code and `UILegacySwitcher`.

### [HW-203] Horizontal Scroll Indicators for Admin Data Tables
- **Type**: UX / Mobile | **Priority**: P2 / Medium | **Effort**: 1 Story Point
- **Component**: `src/components/WorkspaceView.tsx`, `src/components/GenerationInspectorView.tsx`
- **Description**: Apply CSS gradient scroll shadows to indicate off-screen horizontal table content on narrow viewports.

### [HW-301] Screen Reader Map Selection Announcements (aria-live)
- **Type**: Accessibility (a11y) | **Priority**: P2 / Medium | **Effort**: 2 Story Points
- **Component**: `src/components/LeafletMap.tsx`
- **Description**: Add `aria-live="polite"` region to broadcast selected map warning titles and severity levels to screen reader users upon marker click.

---

## 4. Technical Architecture & State Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            STATE FLOW (PHASE 1)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [User Click: "Unverified"] ──► HW-101: Unified Predicate Filter          │
│                                      │                                      │
│                                      ▼                                      │
│                           Matches: status === 'unverified'                  │
│                                || confidence < 0.8                          │
│                                      │                                      │
│                                      ▼                                      │
│                           Updates Table View (2 Items)                      │
│                                                                             │
│   [User Keydown: "Escape"]   ──► HW-103: Universal Modal Dismissal          │
│                                      │                                      │
│                                      ▼                                      │
│                           Closes Open Modal & Restores Focus                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Execution Plan

We will proceed directly to implementing Phase 1 Quick Wins (**HW-101**, **HW-102**, **HW-103**, **HW-104**) in the codebase, running compilation and lint verification upon completion.

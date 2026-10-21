# Unified NAVAREA Map Architecture: PostGIS Data Contract & Progressive UI

A unified implementation plan integrating the PostGIS-backed `nav_warnings_active_spatial` data contract (Milestone M3) with the refined cartographic UI: compact gear icon settings, zero permanent map label clutter, two-stage progressive disclosure, responsive warning detail surfaces, maximum map focus mode, and stacking context bug resolution.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Issue Identified**: In Focus Mode (`body.map-focus-active`), clicking "Tap for details →" on the docked warning card or double-tapping a hazard feature fails to display the warning details bottom sheet / modal. In normal mode, it works properly.
>
> **Root Cause**: Stacking context / z-index collision. When Focus Mode is active, `.map-container` is styled with `position: fixed!important; inset: 0!important; z-index: 2200!important`. However, `.modal-overlay` (which houses the Warning Details bottom sheet on mobile and modal dialog on desktop) is defined with `z-index: 2000`. Because $2200 > 2000$, `#warningModal` opens with `display: flex` but is visually and interactively painted *behind* the full-screen map canvas. In normal mode, `.map-container` has no `z-index`, so `z-index: 2000` is on top.

- **Confirmed Resolution Strategy**:
  1. Re-architect the application stacking hierarchy so all interactive dialogue and inspection surfaces (Warning Details bottom sheet, Settings bottom sheet, and Toasts) strictly outrank the full-screen map container in both normal and focus modes.
  2. Set `.modal-overlay` (Warning Details bottom sheet & modal) to `z-index: 3500`.
  3. Set `.map-settings-sheet` and `.map-settings-scrim` to `z-index: 3200` and `z-index: 3100`.
  4. Normalize `body.map-focus-active .map-container` to `z-index: 1200`, well below modals and sheets while cleanly covering base layout headers.
  5. Set `.toast` to `z-index: 4000` for topmost notification feedback.

---

## 1. Overview & Core Concept

### What It Delivers
1. **Direct PostGIS View Consumption**: Connects the Leaflet spatial engine directly to `nav_warnings_active_spatial`. Renders points, polygons, safety zones, and corridors directly from `geojson_blob` without client-side buffering or coordinate re-projection.
2. **Category Iconography**: Derives nautical SVG symbols directly from the database `categories` TEXT[] array (e.g., `military`, `offshore`, `subsea`, `aton`, `drifting`, `hazard`).
3. **Pristine Cartography & Focus Mode**: Full-screen edge-to-edge chart viewing with collapsible controls and floating toolbar idle transparency.
4. **Flawless Progressive Disclosure**: Tap 1 docks the compact title card; tap 2 or card tap opens full details surface on both desktop and mobile in both standard and focus modes.

---

## 2. Technical Architecture & Stacking Context Model

### Z-Index Stacking Hierarchy Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TOPMOST LAYER (z-index: 4000)                   │
│                     .toast notifications (#toast)                      │
├────────────────────────────────────────────────────────────────────────┤
│                   MODAL & BOTTOM SHEET (z-index: 3500)                 │
│         .modal-overlay (#warningModal) - Warning Details Sheet         │
├────────────────────────────────────────────────────────────────────────┤
│                   SETTINGS SHEET & SCRIM (z-index: 3100 - 3200)        │
│          .map-settings-sheet (3200) & .map-settings-scrim (3100)       │
├────────────────────────────────────────────────────────────────────────┤
│               FOCUS MODE FULLSCREEN MAP (z-index: 1200)                │
│             body.map-focus-active .map-container (inset: 0)            │
│         ├── Desktop Warning Drawer (.warning-details-drawer: 1500)     │
│         ├── Title Card (.nw-title-card: 550)                           │
│         ├── Controls Toolbar (.map-ctrl-topright: 500)                 │
│         └── Leaflet Map Canvas (#map: 0-400)                           │
├────────────────────────────────────────────────────────────────────────┤
│                   STANDARD CHROME (z-index: 100 - 1000)                │
│         .bottom-nav (1000), .site-header (100), page main flow         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Root Cause Analysis & Fix Plan

### Root Cause Breakdown
1. **Focus Mode Activation**:
   When toggling Focus Mode (`window.toggleMapFocusMode`), `body` receives `.map-focus-active`.
   The CSS in `index.html` (lines 101–103) declares:
   ```css
   body.map-focus-active .map-container {
     position: fixed !important;
     inset: 0 !important;
     width: 100vw !important;
     height: 100dvh !important;
     border-radius: 0 !important;
     border: none !important;
     z-index: 2200 !important;
   }
   ```
2. **Details Surface Trigger**:
   - On mobile, `openWarningDetails(w)` executes `openWarningModal(w)`.
   - `openWarningModal(w)` sets `document.getElementById('warningModal').classList.add('open')`.
   - `#warningModal` has CSS class `.modal-overlay` with:
     ```css
     .modal-overlay {
       position: fixed;
       inset: 0;
       z-index: 2000;
       display: none;
       ...
     }
     .modal-overlay.open {
       display: flex;
     }
     ```
3. **The Stacking Conflict**:
   - Because both `.map-container` and `.modal-overlay` are fixed elements rooted in the top-level viewport stacking context, the browser resolves stacking by comparing their z-indexes:
     $$\text{z-index}(\text{.map-container}) = 2200 > \text{z-index}(\text{.modal-overlay}) = 2000$$
   - Consequently, `.map-container` renders over `.modal-overlay`. The bottom sheet slides up, but remains completely concealed and untappable underneath the map.
4. **Settings Bottom Sheet Exposure**:
   - `#mapSettingsSheet` has `z-index: 1700` and `#mapSettingsScrim` has `z-index: 1650`.
   - Opening settings in Focus Mode on mobile also suffers from being layered beneath `.map-container` ($2200 > 1700$).

### Implementation Steps

1. **Update `index.html` Styles**:
   - Adjust `body.map-focus-active .map-container` to `z-index: 1200 !important` (sufficient to cover standard page headers without eclipsing dialogue overlays).
   - Update `.modal-overlay` to `z-index: 3500 !important`.
   - Ensure `#warningModal` and `.modal` retain proper touch-action, overflow-y scrolling, and dismissal handlers.

2. **Update `public/assets/css/components.css`**:
   - Update `.map-settings-scrim` to `z-index: 3100`.
   - Update `.map-settings-sheet` to `z-index: 3200`.
   - Update `.toast` to `z-index: 4000`.
   - Ensure `.warning-details-drawer` has `z-index: 1500` inside `.map-container` for desktop focus mode.

3. **Validate Event Flow in `public/assets/js/public.js`**:
   - Verify `handleTitleCardClick()` correctly invokes `openWarningDetails(activeTouchFeature || currentDrawerWarning)`.
   - Ensure `openWarningModal()` locks background map gestures while modal is open, and restores interactive state upon dismissal.
   - Verify double-tap on polygon / marker in Focus Mode also opens details cleanly.

---

## 4. Verification & Acceptance Criteria

1. **Focus Mode Details Trigger (Mobile)**:
   - Enter Focus Mode via the maximize icon in the top right.
   - Tap on a warning hazard (e.g. NAVAREA I 183/26).
   - Observe docked compact title card at bottom of screen.
   - Tap "Tap for details →" on the title card.
   - **Expected**: Warning Details bottom sheet slides up smoothly over the map with full bulletin text, copy button, and close button.
2. **Focus Mode Direct Double-Tap**:
   - Tap an active hazard a second time.
   - **Expected**: Warning Details sheet opens directly above the map.
3. **Settings in Focus Mode**:
   - Tap the Gear icon in Focus Mode.
   - **Expected**: Settings bottom sheet slides up with backdrop scrim over the map.
4. **Clean Exit & Dismissal**:
   - Dismissing the sheet returns user to the undisturbed Focus Mode map view.
   - Pressing the minimize icon or Esc exits Focus Mode cleanly back to normal view.

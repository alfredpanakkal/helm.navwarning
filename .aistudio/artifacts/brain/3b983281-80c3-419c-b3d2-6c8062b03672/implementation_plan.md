# Admin Map View Harmonization (`console#/warnings/map`)

Align the admin map view at `/console#/warnings/map` with the clean, modern public map architecture while keeping all administrative workflows—including map-native geometry editing, layer visibility toggling, audited warning editing, and coordinates inspection—fully intact.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX decisions were confirmed during clarification:
> - **Warnings Drawer Layout**: A full-width bottom sheet overlay docked at the bottom of the map, featuring minimize/expand controls and inline accordion warning cards.
> - **Map Controls & Layer Settings**: Top-right floating toolbar matching the public map (`Re-center`, `Focus Mode`, `Layers & Chart Type` gear popover, and `Coordinate Picker`).
> - **Admin Tools Integration**: Embedded directly inside expanded warning accordions (Edit Warning button, Verify, Locate) and the right-click / tap map context menu (Edit Warning, Hide Layer, Center on Area, Copy Anchor Coordinates).

- **Confirmed Decision 1**: Adopt public map cartographic layer styling (OpenStreetMap default, CARTO basemaps, OpenSeaMap seamarks, and Ocean soundings) via the top-right gear popover.
- **Confirmed Decision 2**: Replace the legacy, heavy left sidebar with a sleek, full-width bottom sheet overlay that can minimize to a 44px status bar or expand for dense inspection.
- **Confirmed Decision 3**: Preserve `MapGeometryEditor` and the admin context menu, attaching geometry modification actions seamlessly to the selected warning.

---

## 1. Overview & Core Concept

- **What It Does**: Upgrades `console#/warnings/map` from its legacy, high-contrast left-sidebar layout to the polished public map visual standard (tokens, floating chip, top-right toolbar, and smooth layer switching), while maintaining all administrative controls (`MapGeometryEditor`, audited warning editing, layer hide/unhide, and coordinate export).
- **Target Audience / Persona**: Watchstanders, hydrographic hydrographers, and maritime administrators managing live NAVAREA navigational warnings.
- **Key Value**: Provides visual and operational consistency between the public portal and admin console, reducing cognitive load when transitioning between public monitoring and admin verification.

---

## 2. User Experience & Visual Design

- **Top Navigation & Region Filter**:
  - Floating region chip showing current NAVAREA and live count, with quick toggle for the top filter bar.
  - NAVAREA selector (`Global View`, `NAVAREA I` through `XXI`, `BALTIC`) and scope filter (`All`, `NAVAREA`, `Coastal`).
- **Top-Right Toolbar**:
  - `Re-center` button for fitting viewport bounds.
  - `Focus Mode` button to maximize the map canvas.
  - `Layers & Chart Type` gear popover with base maps (OSM, CARTO Voyager, Dark Matter, Positron, ESRI Ocean) and overlay checkboxes (Points, Polygons, Circles, Lines, Seamarks, Soundings).
  - `Coordinate Picker` button with floating DMM/DD live position readout.
- **Full-Width Bottom Sheet Overlay**:
  - Docked at the bottom of the map with a header showing active warning count, hidden layer indicator, and minimize/maximize buttons.
  - Minimized state: 44px bar showing count and quick restore button.
  - Expanded state: Responsive horizontal grid or compact scrollable list of active warnings with inline accordion expansion.
  - Inside each expanded warning:
    - Metadata chips and WWNWS raw text.
    - **Admin Action Buttons**: `📍 View on map`, `🛡️ Quick Verify`, and `✏️ Edit Warning (Admin)` which triggers `onEditWarning`.
    - Layer visibility toggle (`Eye` / `EyeOff`) to isolate or hide noisy polygons.
- **Map Context Menu & Geometry Editor**:
  - Right-click / tap context menu providing anchor coordinates (DMM & DD), `Copy Coordinates`, `Hide From View`, `Center on Area`, and `Edit Warning (Admin)`.
  - `MapGeometryEditor` seamlessly overlaying when a warning is in geometry edit mode.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Bottom Sheet vs. Side Drawer**
  - *Chosen Approach*: Full-width bottom sheet overlay with minimize/maximize toggles.
  - *Why*: User explicitly confirmed this layout; it maximizes horizontal chart visibility across ocean corridors while providing dense tabular/card layout space when expanded.
  - *Alternatives Considered*: Right floating drawer (public desktop standard) or left sidebar (legacy).
- **Decision 2: Control Consolidation in Top-Right Toolbar**
  - *Chosen Approach*: Replace the custom 5-button retro box with the public map's clean top-right toolbar and popover.
  - *Why*: Consistent with the public portal and provides a unified layer manager for both basemaps and overlays.
- **Decision 3: Zero Feature Loss for Admin Capabilities**
  - *Chosen Approach*: Retain `MapGeometryEditor`, `hiddenWarningIds`, audited edit hooks, and contextual coordinates.
  - *Why*: These are safety-critical administrative functions required by hydrographic operators.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       console#/warnings/map (Admin)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ Chip: NAVAREA XI · 14 live ]                [Re-center] [Max] [⚙] [⌖]    │
│                                                                             │
│                            LEAFLET MAP CANVAS                               │
│                   (OSM / CARTO / Seamarks / Soundings)                      │
│                                                                             │
│         [ PolygonsLayer ]   [ CirclesLayer ]   [ PointsLayer ]              │
│                                                                             │
│    ┌───────────────────────────────────────────────────────────────────┐    │
│    │ Context Menu: Anchor DMM/DD · Copy · Hide · Center · [Edit Admin] │    │
│    └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ▼ FULL-WIDTH BOTTOM SHEET: Active Warnings (14)      [-] Minimize [^] Max  │
│  ┌─────────────────────────┬─────────────────────────┬───────────────────┐  │
│  │ NAVAREA XI 0451/26      │ NAVAREA I 0180/26       │ NAVAREA IV 0092/26│  │
│  │ [View] [Verify] [Edit]  │ [View] [Verify] [Edit]  │ [View] [Verify]   │  │
│  └─────────────────────────┴─────────────────────────┴───────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Target Component**: `src/components/LeafletMap.tsx`.
- **State & Hooks**:
  - Shared `useMapLayers` for basemaps and overlay state.
  - `useMapFocus` for focus mode.
  - Bottom sheet collapse state (`'minimized' | 'normal' | 'maximized'`).
  - Active coordinate picker mode state with crosshair cursor.
  - Popover open/closed state for layer settings.
- **Admin Callbacks & Props**:
  - `isAdminMode`, `onEditWarning`, `onGeometrySaved`, `onSelectWarning`, `isolatedWarning`, `selectedWarning`.

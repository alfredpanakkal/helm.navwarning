# Unified NAVAREA Map Architecture: PostGIS Data Contract & Progressive UI

A unified implementation plan integrating the PostGIS-backed `nav_warnings_active_spatial` data contract (Milestone M3) with the refined cartographic UI: compact gear icon settings, zero permanent map label clutter, two-stage progressive disclosure, exact CSS class contracts, event flow state machines, and responsive warning detail surfaces.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> This plan merges the **backend data contract (Milestone M3)** with all **confirmed UI/UX decisions** into a single cohesive architecture:

- **Data Source & Spatial Contract (M3)**: The public map reads strictly from the PostGIS pre-computed view `nav_warnings_active_spatial` (anon key, RLS SELECT-only) using pre-calculated `geojson_blob` geometries and `categories` TEXT[] array. Zero admin/write code in `index.html`.
- **UI Surface Architecture**:
  - **Full Warning Details**: Responsive slide-out side drawer on desktop ($\ge 768\text{px}$) and smooth bottom sheet on mobile ($< 768\text{px}$), replacing disruptive popups.
  - **Settings Panel**: Gear icon anchored next to the Re-center button in `.map-ctrl-topright`. Opens a compact anchored popover on desktop and an ergonomic bottom sheet on touch/mobile.
- **Progressive Disclosure & De-cluttering**: Zero permanent title pills or centroid badges on the map.
  - *Desktop*: Hover highlights geometry and displays a compact title card (`Canonical ID · Hazard Summary · Dimensions/Area`); Click opens the full details side drawer.
  - *Touch / Android*: First tap highlights geometry and docks the compact title card; Second tap opens the full details bottom sheet; Canvas tap clears selection.
- **Cartography & Overlays Defaults**: Default base map is **OpenStreetMap**. Master Overlays switch is **ON** by default with Hazard Points, Danger Areas & Polygons, Safety Zones & Circles, Corridors & Cables, and OpenSeaMap Seamarks enabled (Ocean Soundings disabled). Preferences persist in `localStorage`.
- **Reset to Defaults**: Dedicated "Reset to Defaults" button in the Settings panel plus a 500ms long-press shortcut directly on the gear icon.

---

## 1. Overview & Core Concept

### What It Delivers
1. **Direct PostGIS View Consumption**: Connects the Leaflet spatial engine directly to `nav_warnings_active_spatial`. Renders points, polygons, safety zones, and corridors directly from `geojson_blob` without client-side buffering or coordinate re-projection.
2. **Category Iconography**: Derives nautical SVG symbols directly from the database `categories` TEXT[] array (e.g., `military`, `offshore`, `subsea`, `aton`, `drifting`, `hazard`).
3. **Pristine Cartography**: Eliminates overlapping badge labels and the bulky layers accordion, maximizing map visibility.
4. **Sub-1.5s Performance**: Streamlined payload retrieval from the indexed view, hardware-accelerated SVG/Canvas rendering, and zero layout thrash, achieving >50 FPS during pan/zoom.

---

## 2. Technical Architecture & Data Strategy

### System Flow & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│               SUPABASE POSTGIS PERSISTENCE (RLS SELECT)                │
│                     nav_warnings_active_spatial                        │
│          (canonical_id, navarea, title, categories, geojson_blob)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Anon Key Fetch / Subscription
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 PUBLIC MAP CONTROLLER (public.js)                      │
│                                                                        │
│   ├── Layer Manager (Leaflet Base & Overlay Panes)                     │
│   │     Base: [OpenStreetMap (Default) | Voyager | Dark | Positron]   │
│   │     Overlays: [Points | Polygons | Circles | Lines | Seamarks]     │
│   │                                                                    │
│   ├── Progressive Interaction Engine                                   │
│   │     Desktop: mouseover -> Title Card | click -> Details Drawer     │
│   │     Touch:   tap 1 -> Highlight + Card | tap 2 -> Details Sheet    │
│   │                                                                    │
│   └── Settings & Preferences Store (localStorage)                      │
│         Base map selection, Overlay toggles, Master toggle             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌───────────────────────────────┐ ┌──────────────────────────────────────┐
│     MAP SURFACE (#map)        │ │        SETTINGS CONTROLS             │
│                               │ │                                      │
│ • Zero permanent label text   │ │ • Gear Button (.map-gear-btn)        │
│ • Pre-computed geojson_blob   │ │ • Desktop: Anchored Popover          │
│ • Category SVG markers        │ │ • Mobile: Bottom Sheet with Scrim    │
│ • Dynamic hover/tap halo      │ │ • Master Overlay Switch + Checkboxes │
│ • Floating Compact Title Card │ │ • "Reset to Defaults" Action         │
└───────────────────────────────┘ └──────────────────────────────────────┘
```

### Data Contract & View Mapping

```typescript
// Shape of records retrieved from nav_warnings_active_spatial
interface NavWarningActiveSpatialRow {
  id: string; // uuid
  canonical_id: string; // e.g. "NAVAREA XI 0451/26"
  navarea: string; // e.g. "NAVAREA XI"
  sub_area: string | null;
  title: string;
  issued_at: string; // ISO 8601
  status: 'active';
  triage_tier: 'A';
  categories: string[]; // e.g. ["military", "firing"]
  feature_type: 'POINT' | 'POLYGON' | 'CIRCLE' | 'LINE' | 'CORRIDOR';
  buffer_nm: number;
  corridor_half_width_nm: number | null;
  zone_label: string | null;
  geojson_blob: {
    type: 'Point' | 'Polygon' | 'MultiPolygon' | 'LineString' | 'MultiLineString';
    coordinates: any;
  };
}
```

---

## 3. UI/UX Interaction & Visual Design

### Settings Panel (Gear Icon) Specifications
- **Placement**: Top-right corner of the map container, directly adjacent to the existing `Re-center` button in `.map-ctrl-topright`.
- **Desktop Interaction**: Clicking the gear button toggles a floating popover directly underneath the control toolbar.
- **Mobile Interaction**: Tapping the gear button slides up an ergonomic bottom sheet with a dimming backdrop scrim.
- **Panel Content**:
  ```
  ┌────────────────────────────────────┐
  │  Layers & Chart Type          ✕    │
  ├────────────────────────────────────┤
  │ BASE MAP                           │
  │ ● OpenStreetMap                    │
  │ ○ CARTO Voyager                    │
  │ ○ CARTO Dark Matter                │
  │ ○ CARTO Positron                   │
  │ ○ ESRI Ocean Base                  │
  ├────────────────────────────────────┤
  │ MARITIME OVERLAYS          [ON]    │  ← Master switch
  │ ☑ Hazard Points                    │
  │ ☑ Danger Areas & Polygons          │
  │ ☑ Safety Zones & Circles           │
  │ ☑ Corridors & Cables               │
  │ ☑ OpenSeaMap Seamarks              │
  │ ☐ Ocean Soundings                  │
  ├────────────────────────────────────┤
  │ ↺ Reset to Defaults                │
  └────────────────────────────────────┘
  ```

### Progressive Disclosure Model
- **No Permanent Title Badges**: Polygon centroid pills, line midpoint labels, and point text labels are removed from the default render pass.
- **Compact Title Card (`#mapTitleCard` / `.nw-title-card`)**:
  - Displays: `[Canonical ID] · [Category Summary] · [Area / Clearance / Length]`
  - Example (Polygon): `NAVAREA II 0269/26 · Firing Danger Area · 1515 sq NM`
  - Example (Circle): `NAVAREA III 0095/26 · Naval Gunnery · 10 NM Radius`
  - Example (Corridor): `NAVAREA X 0311/26 · Subsea Cable · 6 NM Swath`
  - Example (Point): `NAVAREA I 0180/26 · Offshore Platform · 500m Safety Zone`

### Interaction State Machine

```
                        ┌───────────────────┐
                        │   IDLE ON MAP     │
                        └─────────┬─────────┘
                                  │
          ┌───────────────────────┴───────────────────────┐
          │ (Desktop Cursor)                              │ (Touch / Tap)
          ▼                                               ▼
┌───────────────────┐                           ┌───────────────────┐
│   FEATURE HOVER   │                           │    TAP 1 (PIN)    │
│ • Geometry glow   │                           │ • Feature active  │
│ • Title Card pops │                           │ • Title Card dock │
└─────────┬─────────┘                           └─────────┬─────────┘
          │                                               │
          │ Click                                         ├── Tap elsewhere -> IDLE
          │                                               │
          ▼                                               ▼ Tap feature/card again
┌───────────────────┐                           ┌───────────────────┐
│  DETAILS DRAWER   │                           │   BOTTOM SHEET    │
│ (Desktop Side-Out)│                           │ (Mobile Sheet)    │
└───────────────────┘                           └───────────────────┘
```

---

## 4. Exact CSS Class Contracts & DOM Hierarchy

### CSS Token & Class Mappings

| Element | CSS Class | DOM / Parent | Token Rules |
|---------|-----------|--------------|-------------|
| Settings Gear Button | `.map-gear-btn` | `.map-ctrl-topright` | 36×36px (`min-height: 44px` mobile), border `var(--border)`, bg `var(--surface)` |
| Desktop Popover | `.map-settings-popover` | `.map-container` | `position: absolute; top: 56px; right: 16px; z-index: 600; min-width: 280px` |
| Mobile Bottom Sheet | `.map-settings-sheet` | `document.body` or `#tab-map` | `position: fixed; bottom: 0; left: 0; right: 0; z-index: 1700; border-radius: 16px 16px 0 0` |
| Settings Scrim / Backdrop | `.map-settings-scrim` | `document.body` | `background: rgba(15,23,42,0.45); z-index: 1650; backdrop-filter: blur(2px)` |
| Master Switch Toggle | `.master-overlay-switch` | `.map-settings-section` | Segmented toggle button or pill switch with `[ON]` / `[OFF]` state |
| Compact Title Card | `.nw-title-card` | `.map-container` | `z-index: 550; font-family: ui-monospace, monospace; font-size: 11px; font-weight: 600` |
| Feature Active Highlight | `.nw-feature-highlight` | Leaflet SVG element | `stroke: #38bdf8; stroke-width: 3.5px; filter: drop-shadow(0 0 6px rgba(56,189,248,0.7))` |
| Warning Details Drawer | `.warning-details-drawer` | `.map-container` | `position: absolute; top: 0; right: 0; bottom: 0; width: 380px; z-index: 650; background: var(--surface)` |

---

## 5. Implementation Checklist

- [ ] **Data Source (M3)**: Connect `initSupabase()` and warning hydration to `nav_warnings_active_spatial` with fallback to SEED_WARNINGS when Supabase is offline.
- [ ] **DOM Replacement**: Remove `<details class="map-layer-panel">` in `index.html`; insert `.map-gear-btn` inside `.map-ctrl-topright`.
- [ ] **Settings Surfaces**: Add `#mapSettingsPopover` and `#mapSettingsSheet` templates with identical structure and accessible ARIA attributes.
- [ ] **Master Overlay Logic**: Wire single master toggle with bidirectional state synchronization across all 6 overlay checkboxes.
- [ ] **Base Map Defaults**: Ensure fresh load and reset defaults to `osm` (OpenStreetMap).
- [ ] **Persistence & Reset**: Store preferences in `localStorage` under `helm_map_preferences_v1`. Wire visible "Reset to Defaults" button and 500ms long-press on gear icon.
- [ ] **Label De-cluttering**: Remove permanent `.nw-centroid-badge` markers and static tooltips from `plotWarning()`.
- [ ] **Progressive Disclosure (Desktop)**: Attach `mouseover` / `mouseout` to all layers; render floating `.nw-title-card`. Click opens details drawer.
- [ ] **Progressive Disclosure (Touch)**: Attach touch handlers with active highlight; tap 1 docks title card; tap 2 opens details bottom sheet; background tap dismisses.
- [ ] **Responsive Details Surfaces**: Wire desktop side drawer and mobile bottom sheet for full warning inspection.
- [ ] **Verification**: Run `npm run lint` and `compile_applet`. Verify 50+ FPS and < 1.5s TTFP.

---

## 6. Acceptance Test Cases

### Test Case 1: Fresh Load Defaults
- **Action**: Load the application with clear `localStorage`.
- **Expected**:
  - OpenStreetMap base layer is loaded (`osm`).
  - Maritime overlays (Points, Polygons, Circles, Lines, Seamarks) are visible.
  - Ocean Soundings is unchecked.
  - Zero permanent title labels or centroid badges appear on the map.
  - Gear button is visible in top-right next to Re-center.

### Test Case 2: Settings Panel & Master Toggle
- **Action**: Click the Gear button on desktop / tap on mobile.
- **Expected**:
  - Desktop: Popover opens anchored to the gear.
  - Mobile: Bottom sheet slides up with backdrop scrim.
  - Toggling Master Switch to OFF hides all overlays on the map.
  - Toggling Master Switch to ON re-enables active overlays.
  - Dismissing via ✕ or backdrop click closes the panel smoothly.

### Test Case 3: Progressive Disclosure on Desktop
- **Action**: Hover cursor over a firing polygon or submarine cable corridor.
- **Expected**:
  - Polygon / line geometry receives subtle highlight outline.
  - Floating title card appears at cursor with format: `Canonical ID · Category · Dimensions`.
  - Moving cursor away removes the card immediately.
  - Clicking the polygon opens the slide-out side drawer with full warning text.

### Test Case 4: Progressive Disclosure on Touch / Android
- **Action**: Single tap on a safety zone circle.
- **Expected**:
  - Feature highlights with active pulse outline.
  - Title card docks cleanly above bottom navigation bar.
  - Map remains pannable and zoomable without dismissing.
  - Second tap on the circle or card opens the full warning details bottom sheet.
  - Tapping open water on the map dismisses the card and removes the active highlight.

### Test Case 5: Reset to Defaults
- **Action**: Change base map to CARTO Dark Matter, disable polygons, then click "Reset to Defaults" or hold gear button for 500ms.
- **Expected**:
  - Base map immediately reverts to OpenStreetMap.
  - All 5 standard overlays re-enable.
  - Toast confirmation appears: "Map settings reset to defaults".
  - Preference saved in `localStorage`.

---

## 7. Maximum Map View & Distraction Reduction

### Objective
Maximize visible cartographic screen area on both mobile and desktop by systematically reducing or collapsing non-essential UI elements, while keeping critical controls (Re-center, Focus Mode, Gear, warning interaction) instantly accessible.

### Architecture & Mechanisms
1. **Collapsible Top Controls Block (`#mapTopSection` & `#mapControlsChip`)**:
   - The top block ("Active Warnings" title, subtitle, NAVAREA selector, Refresh & Data Bank buttons) is housed in `#mapTopSection`.
   - Starts expanded on first visit. Automatically collapses upon user interaction on the map (pan, zoom, tap) with a 2.5s debounce.
   - When collapsed, `#mapTopSection` smoothly collapses (`max-height: 0; opacity: 0`), and the floating `#mapControlsChip` pill displays the active NAVAREA and live count at top-left.
   - Tapping `#mapControlsChip` instantly re-expands the controls block.
   - Mobile viewport: Map grows from 62vh to >85% screen real estate (`calc(100dvh - 120px)`). Desktop viewport: Map occupies `calc(100vh - 90px)` with minimum 660px height.

2. **Floating Controls Idle Transparency**:
   - The top-right control toolbar (`.map-ctrl-topright`) transitions to a subtle translucent idle state (`opacity: 0.65; backdrop-filter: blur(4px)`) after 4 seconds of idle map viewing.
   - Any mouse hover, touch interaction, or map drag immediately restores full opacity.

3. **Full Viewport Focus Mode (`toggleMapFocusMode`)**:
   - Dedicated Focus / Max Map toggle button (`#btnMapFocus`) in `.map-ctrl-topright` (plus `F` / `Escape` keyboard shortcuts).
   - When engaged (`body.map-focus-active`), hides `.site-header`, `.bottom-nav`, `.site-footer`, and page padding, giving 100% edge-to-edge chart viewing.
   - Automatically triggers Leaflet `invalidateSize()` to ensure pristine tile loading.

4. **Refined Compact Title Card**:
   - Reduced vertical height and tight padding (`5px 10px; font-size: 11.5px; border-radius: 6px`).
   - Integrated dismiss `✕` button and touch swipe-down gesture to dismiss.


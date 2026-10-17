# NAVAREA Maritime Warning Pipeline & Multi-Plot Map Plotter Engine Plan

Refining the Public Map, Data Bank, and Spatial Plotter Engine based on user feedback (Public Map & Data Bank focus, displaying all plot types with clean interactive info cards and robust maritime geometries).

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Confirmed Preference**: Prioritize Public Map and Data Bank views.
> - **Confirmed Preference**: Show all geometry plot types (Polygons, Circles, LineStrings, Corridors, Drift Vectors, Glyphs) with clean interactive popups/info cards rather than cluttered centroid badge overlays.

---

### 1. Overview & Core Concept

- **What It Does**: A comprehensive maritime spatial engine and NAVAREA warning public view & data bank for visualizing navigational warnings (S-124 / NAVAREA / GMDSS) with geodesic distance calculations, surface areas, safety zones, subsea cable tracks, and buffered navigation corridors.
- **Target Audience**: Mariners, shipping operators, maritime authorities, and researchers accessing NAVAREA navigational warnings.
- **Key Value**: Accurate spatial rendering of complex nautical bulletins with robust interactive map inspection and data bank searchability.

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. Browse NAVAREA warnings in the Data Bank (card and table views) with position counts and status indicators.
  2. Inspect spatial warnings on the interactive Leaflet Map with toggleable layers (OpenSeaMap seamarks, soundings, polygon boundaries, circular clearance zones, and drift vectors).
  3. Click any geometry or marker to view WGS84 coordinates, distance, area, and clearance details in a clean popup card.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: GATEWORKS Industrial Monospace & Marine Utility Design System (`--color-gw-bg`, `--color-gw-primary`, critical red `#dc2626`, high orange `#ea580c`, active green `#059669`, verified teal `#0d9488`).
  - *Typography*: Monospace tabular numerals (`Courier New`, monospace) for coordinates and telemetry; clean sans-serif for warning text.
  - *Layout*: Responsive sidebar / filter toolbar, full-viewport map container, and high-density data bank grids.

### 3. Key Product Decisions & Trade-Offs

- **Decision 1**: Streamlined Map Display
  - *Chosen Approach*: Render all geometry types with category-tinted semi-transparent fills, dashed perimeters, and clean click popups rather than permanent floating centroid badges.
  - *Why*: Reduces map clutter while keeping exact area and coordinate measurements instantly accessible on tap/click.

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   React SPA Frontend                   │
│  (Tailwind CSS v4 + GATEWORKS Industrial Monospace)    │
├────────────────────────┬───────────────────────────────┤
│    MaritimeMap.tsx     │    DataBankWarningList.tsx    │
│    (Leaflet Engine)    │    (Card & Table Views)       │
├────────────────────────┴───────────────────────────────┤
│              Core Spatial Math & Parsers               │
│    (src/core/coordinates.ts & src/utils/warningHelpers)│
└────────────────────────────────────────────────────────┘
```

- **Data Model & State**: Warning records with spatial geometries (`spatial.geometries`), extraction confidence, and clearance directives.
- **Interactive Component Mapping**:
  - Map filter toolbar for selecting plot types (Polygons, Circles, Lines, Points).
  - Data Bank search and status filtering.

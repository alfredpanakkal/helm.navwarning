# Competitor Warning Design Study: Pins, Symbols & Geographic Plotting

> **Status**: Approved by Maintainer (2026-11-12)  
> **Benchmarks**: HELM.WARNING · NautoShark · SeaLagom  
> **Governing Principle**: One warning → multiple geographic features → one original bulletin.

---

## 1. Executive Summary & Core Architectural Principle

A common failure mode in maritime safety mapping is attempting to encode category, severity, and geometry all into a single pin or marker. With hundreds of active NAVAREA warnings, this turns the chart into an illegible collection of dozens of inconsistent icons.

The HELM.WARNING design system establishes four strictly independent visual dimensions:

| Visual Property | Purpose | Implementation |
|---|---|---|
| **Symbol (Glyph)** | What kind of hazard is it? | 6 primary categories (General, Military, Drifting, AtoN, Subsea, Wreck) |
| **Colour (Ring / Border)** | Operational severity or urgency | 3 states: Critical (red), High (amber), Moderate/Active (accent green) |
| **Geometry** | Geographic extent & boundary | 7 rendering types (Point, Line, Polygon, Circle, Sector, Corridor, Displacement) |
| **Cluster** | Local hazard density | Numeric dual-ring badge applying to point markers only |

```
┌────────────────────────────────────────────────────────┐
│                      NAVAREA Warning                   │
├─────────────────────────┬──────────────────────────────┤
│ Classification (1 of 16)│ → Soft-mapped to 6 Glyphs    │
│ Severity (Rule-derived) │ → 3 Severity Rings           │
│ Spatial Geometries (1..N)│ → 7 Explicit Geometry Forms │
│ Map Density             │ → Point-only Cluster Badges  │
└─────────────────────────┴──────────────────────────────┘
```

---

## 2. Competitive Benchmarks & Feature Matrix

Three platforms were evaluated:
1. **HELM.WARNING** — Simplicity, free global coverage, 21 NAVAREA accessibility, searchable Data Bank, established PostGIS + Leaflet stack.
2. **NautoShark** — Map-first global NAVAREA/METAREA interface; MSI Spatial Interpreter advertised as in development for points, lines, circles, and polygons.
3. **SeaLagom** — Rich multi-geometry benchmark supporting point, line, lane, area, circle, sector, displacement, multi-zone warnings, and structured API exports.

### Feature Matrix

| Capability | NautoShark | SeaLagom | HELM.WARNING (Current) | HELM.WARNING (Target) |
|---|---|---|---|---|
| Global Warning Map | Yes | Yes | Yes | Yes |
| NAVAREA I–XXI | Yes | Yes | Yes | Yes |
| METAREA Coverage | Yes | Yes | Out of scope | Out of scope |
| Coastal Warnings | Yes | Yes | Filterable | Filterable |
| Individual Points | Yes | Yes | Yes | Yes |
| Explicit Line Geometry | Advertised | Yes | Yes (casing + core) | Yes |
| Polygons / Areas | Advertised | Yes | Yes (dashed nautical) | Yes |
| Circles & Clearances | Advertised | Yes | Yes (explicit + parsed) | Yes |
| Sectors / Sweep Arcs | Advertised | Yes | Type-defined only | **Phase 2 Target** |
| Corridors / Lanes | Unconfirmed | Yes | Yes (swath polygons) | Yes (refined widths) |
| Multi-Zone Geometry | Unconfirmed | Yes | Naïve midpoint split | **Phase 2 Target (labeled zones)** |
| Relocation Vectors | Unconfirmed | Yes | Extracted, not drawn | **Phase 2 Target (ghost + arrow)** |
| ECDIS Export | Unconfirmed | Yes | Out of scope | Out of scope |
| Offline Plotting | In development | Unconfirmed | Out of scope | Out of scope |

*Verification note: Competitor capabilities reflect public services and documentation. NautoShark's spatial interpreter is advertised as in-development and not yet verified as a live-map feature.*

---

## 3. The 6-Symbol System (Rendering Consolidation)

To keep the chart decluttered while preserving domain accuracy, HELM.WARNING maps its 16 internal classification categories to **6 primary visual symbols**. 

Underlying data structures and parsers continue to classify with high granularity; this is a **rendering consolidation**, not a loss of data.

| Primary Symbol | Glyph Representation | Subsumed Internal Categories | Nautical Context |
|---|---|---|---|
| **General** | Compass Star (`general_chart`) | `general_chart`, `ops`, `service_status`, `restricted`, `sar`, `weather`, `ice` | General navigational hazards, operations, weather alerts, chart corrections |
| **Military** | Crosshair Burst (`mil_fire`) | `mil_fire`, `uxo` | Naval firing exercises, gunnery, rocket launches, unexploded ordnance |
| **Drifting** | Drifting Silhouette (`drift`) | `drift` | Derelicts, adrift containers, floating hazards, unmoored vessels |
| **AtoN** | Lighthouse (`aton`) | `aton` | Lights unlit, beacons damaged, buoys off-station or destroyed |
| **Subsea** | Cable Spool (`cable`) | `cable`, `survey`, `rig` | Submarine cables, pipe laying, seismic/hydrographic surveys, MODU rigs |
| **Wreck / Hazard** | Submerged Mast (`wreck`) | `wreck`, `security` | Dangerous sunken wrecks, submerged obstructions, piracy alerts |

### Separation Rule: Pin Symbol ≠ Geometry
A pin symbol indicates *what* the hazard is, never its shape:
- A military exercise may be a solitary point, a polygon, a circle, or a directional sector.
- A subsea cable is typically a line or a corridor.
- A drifting container is a point with a drift vector.
- An AtoN notice is typically a point or a relocation vector.

---

## 4. Severity Model: Decoupled Rings

Severity is rendered as an outer ring or border on the marker, keeping the category glyph consistent:

| Severity Level | Border / Ring Token | Color | Definition & Transparency |
|---|---|---|---|
| **Critical** | `--sev-critical` | `#B42318` | Immediate navigational danger (live firing, active SAR, adrift mines, cyclones) |
| **High** | `--sev-high` | `#8C5208` | Significant hazard requiring watch vigilance (unlit major lights, derelicts, wrecks) |
| **Moderate / Active** | `--accent` | `#2F6B4F` | Routine operational warnings, cable operations, surveys, scheduled exercises |

> **Transparency Requirement**: Official NAVAREA bulletins do not provide standardized severity scores. The map legend must explicitly inform users:  
> *"Severity rings reflect algorithmic rule matching from bulletin text, not official IHO/IMO hazard gradings."*

---

## 5. Seven Geographic Geometry Types

HELM.WARNING supports 7 distinct geographic geometry representations:

### Type A — Point Warning
- **Use**: Wreck positions, reported container coordinates, AtoN outages, platform anchors.
- **Rendering**: Small category marker (26×26px). Single coordinate. Interactive click opens drawer/modal. Hover halo displays stated berth clearance.
- **Rule**: Never plot approximate points as verified polygons.

### Type B — Line Warning
- **Use**: Submarine cables, pipelines, survey tracks, transit boundaries.
- **Rendering**: Double-pass Leaflet polyline (glow casing underneath + dashed nautical core on top). Start (Point A) and terminus (Point B) markers.

### Type C — Polygon / Area Warning
- **Use**: Firing practice zones, dangerous operations, restricted areas, safety perimeters.
- **Rendering**: Transparent fill (0.16–0.22 opacity) with dashed border. Centroid identification and hybrid vertex handles ($V_1 \dots V_n$).
- **Rule**: Never connect unrelated coordinate groups into a single tangled polygon.

### Type D — Circle / Radius Warning
- **Use**: Safety zones around offshore installations, explosive demolition zones, circular exclusion areas.
- **Rendering**: Geographic circle calculated in metres ($NM \times 1852$), preserving scale across all zoom levels. Stated center point marker with radius label.

### Type E — Sector / Arc Warning
- **Use**: Directional firing ranges, coastal radar coverage, bearing-defined safety arcs.
- **Rendering**: Center point with radial boundaries between `startBearing` and `endBearing` out to radius $R$, rendered as a closed pie/wedge polygon.

### Type F — Lane / Corridor Warning
- **Use**: Cable-laying corridors, wide-berth tow convoys, restricted shipping lanes.
- **Rendering**: Centerline track flanked by geodesic parallel boundary polygons with metric pill label (e.g., "6 NM Swath").

### Type G — Displacement / Movement
- **Use**: Drifting containers, buoys relocated from former to new positions.
- **Rendering**:
  - *Relocation*: Ghost dashed marker at `from` coordinate $\to$ directional arrow $\to$ solid marker at `to` coordinate.
  - *Drift*: Last reported point + dashed historical track + bearing vector.

---

## 6. Multi-Geometry & Multi-Zone Architecture

Real NAVAREA bulletins frequently define multiple distinct danger zones in a single message (e.g. `AREAS A, B AND C`). 

### Data Invariant
**One warning bulletin $\to$ multiple independent spatial features $\to$ one original record.**

- Each zone maintains a distinct `geom_id` and `zone_label` (`AREA A`, `AREA B`).
- Selecting any zone on the chart opens the warning details while visually highlighting the clicked zone.
- Coordinates from distinct zones are never merged into a single multi-polygon.

### Boundary Semantics
- **Solid border**: Explicit boundary stated with verified coordinates (`data_quality: EXPLICIT`).
- **Dashed border**: Inferred or algorithmic boundary (`data_quality: INFERRED`).
- **Dotted amber border**: Unverified Tier B geometry awaiting human audit.

---

## 7. International Standards Alignment (IHO S-124 & IMO SN.1/Circ.243/Rev.2)

- The IHO S-124 Product Specification (Edition 2.0.0, March 2025) provides structured data standards for navigational warnings in ECDIS.
- IMO circular SN.1/Circ.243/Rev.2 guides consistent navigation-related symbology.
- **Position**: HELM.WARNING aligns its underlying data models, geometry types, and coordinate provenance with S-124 principles while retaining a fast, modern web UI. We do not claim official ECDIS portrayal catalogue compliance without formal validation.

---

## 8. Zoom-Level Hierarchy

| Scale | Zoom Range | Display Rules |
|---|---|---|
| **Global** | $z = 2 \dots 5$ | Numeric severity clusters for points. Polygons and lines simplified. Complex labels suppressed. |
| **Regional** | $z = 6 \dots 9$ | Individual 6-category markers. Polygons, lines, and circles visible. Multi-zone boundaries distinct. |
| **Detailed** | $z \ge 10$ | Full geometry rendered. Vertex handles on selection ($V_1 \dots V_n$). Swath widths, radius labels, and bearing tags active. |

*Clustering Invariant: Clusters apply strictly to point markers. Lines, polygons, and circles are never swallowed by cluster groups.*

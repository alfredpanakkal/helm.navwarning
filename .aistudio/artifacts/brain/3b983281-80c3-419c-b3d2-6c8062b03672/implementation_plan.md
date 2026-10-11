# Implementation Plan v4 — Full-Corpus NAVAREA Warning Plotting System

A comprehensive architecture and delivery plan for full-corpus maritime navigational warning ingestion, deterministic coordinate extraction, rule-precedence lifecycle management, and polymorphic Leaflet cartography across NAVAREA IV and NAVAREA IX feeds. Every message in a broadcast either plots with accurate spatial geometry or surfaces in the list panel with an explicit reason; nothing is dropped silently.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions and discipline upgrades govern this v4 plan:

- **North Star & Zero Silent Drops**: Every message ID in a raw broadcast is accounted for: plotted as an active feature, represented by a gazetteer region chip, or explicitly flagged as `unplotted: <reason>` in the list panel. Missing rows are strictly forbidden (`parsed IDs ∪ list-entry IDs ∪ genadmin IDs == UI IDs`).
- **Generalization Discipline & Held-Out Slice**: 15% of messages are selected and frozen at M0 (stratified across hazard categories) before parser tuning. The held-out validation suite must pass with **zero coordinate errors** and **≥ 90% correct archetype/category** to prevent overfitting to the ~246-message training corpus. Any held-out slice failure must be explicitly triaged before sign-off as either **(a) new pattern → added to the coverage backlog**, or **(b) accepted noise → documented**. A failing slice may not be waved through.
- **Deterministic Lifecycle Resolution Chain**: A fixed 6-tier precedence sequence (`in_force_list` → `cross_cancel` → `self_cancel` → `supersession` → `expired_window` → `none`) where the winning rule records itself in `resolutionRule` with evidence references.
- **Supersession Guardrails**: Family matching requires identical `SubjectSignature` (navarea + category + archetype + region tokens) **plus explicit shared entity overlap** (rig name, buoy label, vessel name). Structurally similar notices without shared entities never supersede.
- **Tighter Coordinate Safety**: Latitude-only leading zero-stripping (e.g. `021-26.90N` → `21°26.9′N`; never stripped from longitude), longitude range bounds verified strictly *after* repair, and radius limits bounded between a 0.01 NM floor and a 500 NM ceiling.
- **Visibility & Scoping Defaults**: Expired, cancelled, and superseded notices are hidden by default across all zooms with dedicated legend toggles. The system is scoped to one app instance per NAVAREA feed, keyed by NAVAREA in the store for effortless future multi-feed unification.

---

## 1. Overview & Core Concept

### What It Does
Ingests heterogeneous telex broadcasts and legacy GENADMIN messages from NAVAREA IV (US/Atlantic) and NAVAREA IX (Middle East/Indian Ocean), parsing complex coordinates, spatial archetypes, validity windows, and nautical berths. It evaluates message lifecycles deterministically and renders high-contrast, clutter-free nautical cartography where hazard categories, boundaries, and corridors are instantly distinguishable.

### Target Audience & Persona
- Navigators, Officers of the Watch (OOW), fleet dispatchers, and hydrographic analysts requiring instant situational awareness and verifiable audit trails for maritime safety notices.

### Key Value
- **100% Ingestion Accountability**: Eliminates dangerous blind spots where malformed or list notices vanish without operator notice.
- **Accurate Spatial Geometries**: Replaces generic circular pin dots with polygons, nautical circle buffers, linear cable/tow corridors, and relocation tracks.
- **Auditable Lifecycle Engine**: Transparent resolution trace for every cancelled or superseded notice.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Broadcast Ingestion & Overview**:
   - The user loads a NAVAREA feed (or toggles `?fixtures=1` in development).
   - The status bar reports total messages parsed, active on chart, region-fallback, and unplotted counts with sub-second response.
   - The chart displays active hazards at current zoom, while the list panel displays the synchronized feed.

2. **Cartographic Exploration & Suppression**:
   - **Point Hazards**: Render high-contrast category SVG badges from the `hazardIcons.ts` registry (*Note: emoji labels below are visual documentation shorthand for the dedicated SVG symbol components in `hazardIcons.ts`*):
     - 💥 **Gunnery / Firing / Rocket Exercises**: SVG crosshair/burst with expanding crimson hazard pulse.
     - ⚓ **Derelicts / Drifting Hazards / Mines**: SVG vessel silhouette / floating mine marker.
     - 💡 **Aids to Navigation (AtoN) / Lights Unlit**: SVG lighthouse beacon with outage indicator.
     - ⚡ **Submarine Cables / Pipelines / Surveys**: SVG cable spool / survey track symbol.
     - 🏗️ **Offshore Exploration / Drillships / Rigs**: SVG oil platform silhouette.
     - 🌪️ **Tsunamis / Storms / Heavy Weather**: SVG gale / cyclone spiral indicator.
   - **Area & Circular Hazards**: Polygons and circular radius buffers render with translucent fill and distinct hazard stroke. The center marker is suppressed to preserve chart soundings.
   - **Linear Corridors**: Cable-laying and towing routes display as dashed tracklines with a default 0.5 NM (or parsed clearance) buffer halo.
   - **Active Firing Pulsation**: Live gunnery or military exercise zones display a subtle pulsating radar ring (`@keyframes hazard-pulse`) strictly during their active temporal window.

3. **Hover & Selection Interactivity**:
   - Hovering over a solitary point hazard projects an interactive safety radius ring (using parsed stated berth or 0.5 NM default).
   - Clicking an area or marker opens the metadata popup with category chip, severity, validity windows, monospace coordinates, chart references, and SAR rescue contacts.

4. **Feed List & Unplotted Audit Panel**:
   - The full-corpus list panel synchronizes bidirectionally with the map.
   - Notices without coordinates display an amber indicator: `unplotted: no_coordinates` (with gazetteer chip if matched) or `unplotted: meta_list`.

### Visual Identity & Design Tokens
In strict alignment with `AGENTS.md` and approved design guidelines:
- **Critical Severity (`--critical`)**: `#dc2626` (Red-600) — Gunnery firing, rockets, live SAR, drifting mines.
- **High Severity (`--high`)**: `#ea580c` (Orange-600) — Derelicts adrift, unlit light vessels, unexploded ordnance.
- **Caution / Active (`--active`)**: `#059669` (Emerald-600) — Cable laying, pipeline inspection, seismic surveys.
- **Verified Standard (`--verified`)**: `#0d9488` (Teal-600) — Buoys re-laid, established aids, chart corrections.
- **Neutral / Dimmed (`--neutral`)**: `#64748b` (Slate-500) — Deactivated notices, gazetteer regions, superseded ghosts.
- **Typography**: Space Mono / tabular numbers (`font-mono tabular-nums`) for coordinates, DTG timestamps, and distance readouts.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Generalization Discipline via Frozen Held-Out Slice
- **Approach**: Stratify the 246 messages across hazard categories and freeze a 15% sample (`src/data/fixtures/heldout-slice.json`) at M0. All regex and disambiguation development is restricted to the remaining 85%.
- **Triage Protocol**: Any held-out slice failure must be explicitly triaged before sign-off as either **(a) new pattern → added to the coverage backlog**, or **(b) accepted noise → documented**. A failing slice may not be waved through.
- **Why**: Ensures coordinate repair and geometry extraction generalize to future broadcast variations rather than overfitting to existing telex idiosyncrasies.
- **Validation**: Held-out slice must pass with 0 coordinate errors and ≥90% category accuracy before milestone sign-off.

### Decision 2: Deterministic Rule-Precedence Lifecycle Engine
- **Approach**: Evaluate lifecycles in fixed order (`in_force_list` → `cross_cancel` → `self_cancel` → `supersession` → `expired_window`). An explicit `CANCEL <ref>` beats in-force list membership derived from an **earlier** list.
- **Why**: Eliminates nondeterministic state flapping caused by arbitrary evaluation order between overlapping cancel notices and superseded notices.
- **Audit**: Every message records `resolutionRule` and `resolutionRefs` so operators can inspect why a notice is inactive.

### Decision 3: Named-Entity Supersession Guardrails
- **Approach**: Require identical `SubjectSignature` (NAVAREA + Category + Archetype + Region Tokens) **AND** at least one matching named entity (e.g. rig name `"NOBLE HANS DEUL"`, buoy number `"NO 4"`, vessel name).
- **Why**: Prevents unrelated firing areas or buoy warnings in the same sub-area from accidentally superseding each other.

### Decision 4: Safe Coordinate Repair Discipline
- **Approach**: Restrict leading-zero stripping to latitude values only (e.g. `021-26.90N` → `21-26.90N`), leaving longitude 3-digit zero padding untouched. Re-verify longitude range $(0, 180]$ strictly after repair. Bound radius buffers between 0.01 NM and 500 NM.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Flow

```
┌────────────────────────────────────────────────────────┐
│             Raw Broadcast Feed (.txt per NAVAREA)      │
│                (NAVAREA IV.txt, NAVAREA IX.txt)        │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│      MessageSplitter (delimiter / GENADMIN / EOF)      │
│      Emits: raw blocks with truncated flag             │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│      HeaderParser & InForceListParser                  │
│      Emits: WarningId, issuedAt, subjectCode, lists    │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│      WarningParser Engine                              │
│      ├─ CoordinateParser  (9 formats, sanity/repair)   │
│      ├─ GeometryExtractor (11 archetypes, ladder)      │
│      ├─ LabelExtractor    (tables, A-AAAZ blocks)      │
│      ├─ TemporalParser    (windows, recurrences, UTC)  │
│      └─ BerthParser       (clearanceNm, buffer radius) │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│      Classifier (16 categories) + AtoN Status Engine   │
│      Keyword hygiene rules & provenance recording      │
│      Emits: category, urgency severity, telemetry      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│      Deterministic Lifecycle Engine                    │
│      Precedence chain + Contradiction Resolution       │
│      Emits: inForce, resolutionRule, audit trail       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│      Unified NavaWarn Store & Assertion Suite          │
│      ├─ Oracle exact-match assertion (incl. partial)   │
│      └─ Zero silent-drop corpus invariant test         │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   Point Layer    │ │   Vector Layer   │ │     UI Layer     │
│ Category Badges  │ │ Polygons/Circles │ │ 16 Category Chips│
│ Suppressed Ctr   │ │ Polyline Tracks  │ │ List & Audit View│
│ Halo Hover Proj  │ │ Radar Pulses     │ │ Popups & A11y    │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### Classification Hygiene Rules & Adversarial Suite

To eliminate false-positive keyword triggers:
- `\bEXPLOSIVE\b`: Enforce strict word-boundary match (prevent false trigger on "explosion").
- `\bLIGHT\b`: Enforce strict word boundary to prevent matching "FLOODLIGHTS" on work vessels.
- `DEMOLITION`: Classifies as `uxo` **only with co-occurring ordnance keywords** (e.g. `ORDNANCE`, `BOMB`, `DETONATION`), else falls back to `ops` (e.g. IX 285).
- `\bMINE\b` / `DRIFTING MINE`: Maps to severity `critical`.

**Adversarial Golden Test Cases**:
1. `IX 285` → `ops` (marine demolition operations without unexploded ordnance).
2. `IV 870` → `mil_fire` (military exercise firing zone).
3. `IX 103` → `rig` + alert status (offshore drill rig hazard).
4. `IX 328` → `security` (maritime security / piracy advisory).
5. `IV 961` → `sar` (active search and rescue operation with contacts).
6. `IX 201` → `uxo` with `critical` severity (drifting sea mine).
7. `IX 189` → `drift` (derelict adrift).
8. `IV 842` → `drift` (unmanned barge adrift).

### Deterministic Lifecycle Engine & Contradiction Resolution

The lifecycle engine executes against messages chronologically by `issuedAt`. When messages lack timestamps (legacy GENADMIN blocks), ties break by **file position**, treated as earliest.

**Fixed Precedence Chain**:
1. `in_force_list`: Latest in-force telex list dictates membership.
2. `cross_cancel`: Explicit `CANCEL <refs>` triggers terminal cancellation.
3. `self_cancel`: `CANCEL THIS MSG <dtg>` sets `expiresAt`.
4. `supersession`: Matching `SubjectSignature` + shared named entity.
5. `expired_window`: Active time window has lapsed.

**Contradiction Resolution**:
When lifecycle rules conflict (e.g. a message is both cross-cancelled and supersession-matched), the deciding message with the **latest issuance timestamp wins**; null-DTG (GENADMIN) messages break ties by **file position**, treated as earliest. Every such contradiction is **logged with both WarningId refs**.

**Partial / Truncated In-Force List Handling**:
If a message flagged `truncated` is itself an in-force list (such as fixture `IX 529/24`), its entries are marked `partial: true`; the oracle asserts **only over the parsed prefix**; the UI shows the list row with a **"list truncated" badge** so the incompleteness is visible, never silent.

### Data Model (`src/types/navarea.ts`)

```ts
export type HazardCategory =
  | 'sar' | 'mil_fire' | 'uxo' | 'weather' | 'ice'
  | 'security' | 'drift' | 'wreck' | 'cable' | 'survey'
  | 'rig' | 'aton' | 'restricted' | 'ops' | 'service_status'
  | 'general_chart';

export type Archetype =
  | 'point' | 'point_radius' | 'polygon' | 'polyline'
  | 'corridor' | 'multipoint' | 'relocation' | 'geometry_group'
  | 'region' | 'drift_vector' | 'none';

export type Severity = 'critical' | 'high' | 'caution' | 'info';
export type DisplayStyle = 'critical' | 'high' | 'active' | 'verified' | 'neutral';

export interface SubjectSignature {
  navarea: string;
  category: HazardCategory;
  archetype: Archetype;
  regionTokens: string[];
}

export interface SupersessionEvidence {
  signature: SubjectSignature;
  sharedEntities: string[];
  requires: boolean;
}

export interface Lifecycle {
  inForce: boolean;
  cancelledBy?: string[];
  expiresAt?: string;
  supersedes?: string[];
  supersededBy?: string[];
  truncated?: boolean;
  unplottedReason?: 'no_coordinates' | 'parse_failure' | 'meta_list' | 'text_unavailable';
  resolutionRule?: 'in_force_list' | 'cross_cancel' | 'self_cancel' | 'supersession' | 'expired_window' | 'none';
  resolutionRefs?: string[];
}

export interface ParseTelemetry {
  warningId: string;
  triggerPhrase?: string;
  coordinateFormat?: string;
  disambiguationRung?: number;
  confidence: 'high' | 'medium' | 'low';
  repairsApplied?: string[];
  gazetteerFallback?: boolean;
  classifiedCategory: HazardCategory;
  winningKeyword?: string;
}
```

### Leaflet Pane Stacking Stack
Strict z-index layering preserves pointer events and visual clarity:
1. `basePane` (200): Base cartography tiles
2. `soundingsPane` (250): Bathymetric depth labels (`pointerEvents: none`)
3. `seamarksPane` (300): OpenSeaMap seamarks (`pointerEvents: none`)
4. `navWarnVectorPane` (400): Hazard polygons, circles, and linear route corridors
5. `navWarnHaloPane` (500): Hover proximity rings and stated clearance buffers
6. `navWarnMarkerPane` (600): Point category badges and marker clusters
7. `tooltipPane` (650): Interactive coordinate tooltips and popups

### Suppression Matrix

| Archetype | Point Badge | Vector Feature |
|---|---|---|
| `point` | Rendered (clustered) | Hover buffer halo only |
| `point_radius` | **Suppressed** | Geodesic circle ($R \times 1852$; $>20\text{ NM} \to$ 72-segment polygon) |
| `polygon` | **Suppressed** | Fill opacity 0.12 + hazard stroke; interior click selects |
| `polyline` | **Suppressed** | Labeled dashed maritime line |
| `corridor` | Endpoint badges only | Central spine + corridor buffer halo (`clearanceNm ?? 0.5 NM`) |
| `multipoint` | Rendered per point | Point group |
| `relocation` | Badge at new position | Ghost circle at former position + dashed displacement arrow |
| `geometry_group` | Hover badge per group | Per-group vectors linked as one interactive entity |
| `region` | **Suppressed** | Gazetteer boundary (dashed neutral stroke) |
| `drift_vector` | Badge at origin | Projected trackline with +12h / +24h markers |
| `none` | **Suppressed** | Unplotted (listed in panel with explicit reason) |

---

## 5. Milestone Delivery Roadmap

| Milestone | Scope & Deliverables | Acceptance Criteria | Effort |
|---|---|---|---|
| **M0: Foundations** | • Data models (`navarea.ts`, `parseTelemetry.ts`)<br>• Commit raw fixtures (`NAVAREA_IV.txt`, `NAVAREA_IX.txt`)<br>• **Freeze 15% stratified held-out slice**<br>• Implement `messageSplitter.ts`, `headerParser.ts`, `inForceListParser.ts` | Splitter matches manual message counts; all IDs parsed; IX 529/24 flagged truncated; meta lists parsed with entry counts. | S |
| **M1: Parsing Engine** | • Implement `coordinateParser.ts` (9 formats, post-repair sanity)<br>• Implement `geometryExtractor.ts` (11 archetypes, ladder)<br>• Implement `labelExtractor.ts`, `temporalParser.ts`, `berthParser.ts` | 25 golden patterns pass; **held-out slice: 0 coord errors, ≥90% archetype/category correct, all failures triaged (new pattern or accepted noise)**; IV 306 repaired; IX 546 OK; near-miss pair stays distinct. | L |
| **M2: Classification** | • Implement `warningClassifier.ts` (16 categories, hygiene rules)<br>• Implement `atonStatus.ts` (per-point alert/info/relocation) | Category distribution matches corpus audit; adversarial suite green; **held-out slice classification ≥90%**. | M |
| **M3: Lifecycle Engine** | • Implement `lifecycle.ts` with deterministic resolution chain<br>• In-force oracle integration with per-message audit trail<br>• Contradiction resolution & partial list handling (IX 529/24)<br>• Supersession guardrails with shared entity overlap | **Oracle exact match over corpus-present messages; text-unavailable count asserted**; IV 977 superseded with entity evidence; IV 551/552 render-deduped; near-miss pair stays distinct; truncated-list handling verified. | **L** |
| **M4: Point Layer** | • Nautical SVG category badges (`hazardIcons.ts`)<br>• Marker clustering and virtualized popup list<br>• Relocation vectors, hover berth halos, keyboard accessibility | Searchable 110-row popup filters in <50ms (measured with active filter); relocation arrows render accurately; 0.5 NM hover halos project smoothly. | M |
| **M5: Vector Layer** | • Leaflet polygon and geodesic circle rendering<br>• Polyline corridors with buffer calculation<br>• Dynamic center marker suppression engine | Multi-area polygons render cleanly; cable corridors display dashed safety halo; center markers hidden on bounded areas. | L |
| **M6: Temporal & Animation** | • Temporal window state machine (active now vs upcoming)<br>• `@keyframes hazard-pulse` rings for active firing zones<br>• Expired / cancelled / superseded toggle filters | Active firing notices pulse only during active windows; expired and cancelled notices toggle cleanly without map re-initialization. | M |
| **M7: UI & Filter Panel** | • 16 category filter chips with live counts<br>• AtoN status filter and lifecycle segmented toggles<br>• Full-corpus list panel with explicit unplotted reason tags | Filter combinations update in <100ms; bidirectional list↔map hover highlight; **corpus invariant test green** (`UI IDs == parsed ∪ lists`). | M |
| **M8: Gazetteer Fallback** | • Curated gazetteer entries for NAVAREA IV & IX landmarks<br>• Region boundary projection with dashed low-confidence styling | No-coordinate notices receive region representation; zero silent drops verified across full corpus. | S |
| **M9: Hardening & Telemetry** | • Viewport culling on `moveend` and layer recycling<br>• Performance budget validation at 5× scale (5,000 items)<br>• Export parse telemetry report documenting fallback rates | 50+ fps pan/zoom; DOM nodes <1,500; ingest-to-store <2s; telemetry dump confirms low fallback dependency. | M |

---

## 6. Binding Acceptance Criteria Tables

### Table A: Golden Fixture Extraction Coverage Suite (17 Patterns)

| Pattern | Fixture IDs | Milestones | Binding Acceptance Assertions |
|---|---|---|---|
| **In-force list** | IX 364, 350; IV 978 | M0 / M3 | Meta-detected; not plotted; entries extracted with asserted count. |
| **Cancellations** | IX 363, 362; IV 978 | M3 | Targets ghosted; `resolutionRule: 'cross_cancel'` recorded. |
| **Security notices** | IX 363, 328, 084 | M1 / M2 | Category `security`; accurate point, polygon, or region geometry. |
| **Search and Rescue (SAR)** | IX 354, 225, 339/25; IV 961 | M1 / M2 | Category `sar`; contact metadata (MRCC/phone) parsed into popup. |
| **Ice tracklines** | IV 979, 977 | M1 / M3 | 3 distinct polylines; IV 977 superseded by IV 979 with entity evidence. |
| **Service outages** | IX 085; IV 857, 653, 684 | M2 | Category `service_status`; muted display style. |
| **AtoN alert/info/reloc** | IX 355, 441/25, 578/25, 349 | M2 | Per-point status (`alert`, `info`, `chart_correction`, `relocation`). |
| **Multi-area groups** | IX 343, 247, 453; IV 950, 970, 7/26 | M1 | `groups[]` preserved; never merged across discrete operational areas. |
| **N-point tracklines** | IV 877, 649; IX 484/25, 442/25, 546/25 | M1 | Sequential vertex counts match coordinates; polyline rendered. |
| **Radius variants** | IX 041, 214, 261; IV 949, 967, 832 | M1 | Correct radius in NM (diameter ÷2 applied where stated as diameter). |
| **Berth parsing** | IX 358, 359; IV 967, 877 | M1 | Stated clearance distance captured in `clearanceNm`. |
| **Recurrences** | IX 343, 365; IV 970, 949, 973 | M6 | Array of daily/intermittent windows; state machine evaluates active window. |
| **Point clouds** | IV 968, 976; IX 571/25 | M4 | 110-point clouds clustered; per-point labels and ETAs parsed. |
| **Coordinate zoo** | IX 327, 118, 546; IV 306, 1157/21 | M1 | All 9 coordinate formats parsed without error; IV 306 zero-stripped. |
| **Mixed / malformed tables** | IX 227/25, 002/25 | M1 | Coordinates guaranteed; labels best-effort without dropped points. |
| **Depth / chart updates** | IX 254/26, 065/26 | M2 | Classified as `general_chart`; depths formatted with tabular numbers. |
| **No-coordinate places** | IX 203, 362; IV 190/25 | M8 | Resolved via gazetteer; region boundary rendered or list-only tagged. |

### Table B: Performance Budgets & Scaling Constraints

| Metric | Target Budget | Measurement Method |
|---|---|---|
| **Corpus Scale** | 5,000 warnings (5× fixture corpus, incl. 110-point cloud) | Synthesized stress test harness |
| **Pan / Zoom Framerate** | ≥ 50 fps on mid-tier hardware | Chrome DevTools Performance profile during rapid pan/zoom |
| **DOM Nodes in Viewport** | < 1,500 active elements | Marker clustering + viewport polygon culling |
| **Ingest-to-Store Pipeline** | < 2.0 s for 246 messages | Splitter, parser, and lifecycle engine benchmark |
| **Initial Map Render** | < 1.5 s to First Meaningful Paint | Full map layout and vector attachment |
| **Point-Cloud Popup Search** | < 50 ms filter latency | Measured filtering 110 rows while input typing |

### Table C: Risk & Mitigation Register

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Coordinate misparse → absurd geometry** | Critical | Strict sanity bounds verified **after** repair; lat-only zero-strip; lon $\in (0, 180]$; radius floor 0.01 NM + ceiling 500 NM; reject to list-only `parse_failure`. |
| **In-force list vs cancellation contradiction** | High | Deterministic precedence chain (§4); latest issuance wins; logged with both WarningId refs. |
| **Supersession false positives** | High | Require matching `SubjectSignature` + **shared named-entity evidence** + recency; render-only dedup; near-miss golden regression test. |
| **Corpus overfitting / fixture drift** | High | 15% stratified held-out slice frozen at M0; telemetry report at M9; quarterly live re-extraction. |
| **Truncated feeds & lists** | Medium | `truncated` flag captured; partial-list badge displayed; oracle asserts only over parsed prefix. |
| **Point-cloud DOM explosion** | Medium | Leaflet marker clustering + virtualized popup window (`react-window`). |
| **Subject-code table uncertainty** | Low | Stored as weak auxiliary signal only; primary classification driven by lexical keyword rules. |
| **Antimeridian crossing (NAVAREA XI)** | Low | `splitAtAntimeridian` geodesic polygon splitting algorithm preserved. |

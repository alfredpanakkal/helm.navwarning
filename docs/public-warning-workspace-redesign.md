# Public warning workspace — implementation specification

Status: implementation updated to match the desktop reference layout; responsive tablet/mobile behavior remains separately adapted.

## Goal

Reorganize the public Map view into three clear work areas on desktop:

1. **Map** — Leaflet map and its existing map controls.
2. **Active Warnings** — a dedicated selection list outside the Leaflet map container.
3. **Warning Details** — a persistent details surface populated from the selected warning.

Reuse the current warning data, geometry renderer, list renderer, details renderer, selection behavior, and copy/locate actions. Do not create a second warning model or a second details implementation.

## Verified current implementation

Repository: `alfredpanakkal/helm.navwarning`, base branch `main`.

- Public entry point is `index.html`; public behavior is in `public/assets/js/public.js`.
- Public styling is split between inline styles in `index.html` and `public/assets/css/components.css`; tokens are in `public/assets/css/tokens.css`.
- The Map / Data / More navigation is in `index.html`. The Data Bank and Info surfaces are separate tab panels and must remain separate.
- The Leaflet element is `#map`, inside `.map-container`.
- `#mapWarningList` (Active Warnings) is currently positioned absolutely inside `.map-container`, so it overlays the chart.
- `#warningDetailsDrawer` is also currently inside `.map-container`; its desktop CSS translates it in from the right and overlays the chart.
- The existing details surface already includes Close and Copy Bulletin actions. The details renderer in `public/assets/js/public.js` includes status/severity, category, subject/area, issued date, coordinates, and raw bulletin text.
- The public list is driven from the existing `warnings` collection and the existing list/map selection behavior. Do not duplicate the collection.
- `fetchActiveWarnings()` reads `nav_warnings_active_spatial` for spatial rows and separately hydrates active master rows from `nav_warnings` with `raw_text`, `issued_at`, `parsing_method`, and `qa_flags`. Geometry is already attached to warning records before selection.
- The current geometry renderer and marker-cluster implementation must be preserved. Cluster only point markers; do not cluster lines, polygons, or circles.
- The existing warning detail modal and standalone prerendered warning URLs remain supported. This workspace is an additional in-page way to inspect a selected warning, not a replacement for shareable detail pages.
- The existing public theme tokens include `--header-h`, `--bottomnav-h`, and `--max-width`; do not introduce duplicate token names.
- Public themes are light, dark, and night. New surfaces must use existing tokens.
- `AGENTS.md` requires branch-based work, read-back verification, a draft PR against `main`, and maintainer-run lint/tests before merge.

## Layout behavior

### Desktop: 3-column workspace

Use a grid with explicit min-width constraints rather than fixed percentages:

- Map: `2.5fr` primary column.
- Active Warnings: `1fr`.
- Warning Details: `1fr`.
- At 1440px and wider, the three columns target approximately 55% / 22% / 22% of the workspace, with 12px gaps.
- Use `minmax(0, ...)` for all columns and `min-width: 0` on all grid children.
- The list includes an in-panel text search and All / Critical / High severity filters; filtering operates on the already-rendered active warning rows.
- Two keyboard-accessible drag dividers resize Map / Active Warnings and Active Warnings / Selected Warning. Default proportions remain 2.5fr / 1fr / 1fr; the resulting ratios adapt when the browser width changes. Minimum panel widths are enforced during dragging.
- The list and details panels must be siblings of `.map-container`, never descendants of the Leaflet container.
- Give the list and details body independent vertical scrolling. Keep their headers and details actions visible.
- The map remains the largest area and retains all existing map controls, attribution, legend, filters, and layer settings.
- The details panel has a useful unselected empty state. On selection, render the selected warning in the existing details renderer.
- Preserve Copy Bulletin, Close/clear selection, and Locate on Map behavior.

At widths where the three minimum widths plus page gutters cannot fit, switch to the tablet behavior. Do not force 3 columns below the measured minimum.

### Desktop full-screen map: collapsible warning side panels (planned)

When Map Focus Mode is active on desktop (1440px and wider), keep the map at full available size while making both warning panels accessible as independent overlays.

**Panel behavior**
- Add a compact **Active Warnings** toggle fixed to the left edge of the map viewport.
- Add a compact **Selected Warning** toggle fixed to the right edge.
- Each toggle opens its corresponding panel as a floating drawer over the map; opening a drawer must not change the map container's layout width or trigger a grid reflow.
- Animate drawers with a short slide-and-fade transition. Keep the map visible behind them and preserve map center/zoom.
- Both drawers may remain open simultaneously. They must have independent open/closed state; opening or closing one must not implicitly close the other.
- The drawers must be independently scrollable and constrained to the available viewport height. Keep panel headers and close controls reachable.
- Add clear close controls and accessible names/expanded state to both edge toggles. Support Escape to close the most recently opened drawer first; a subsequent Escape may exit Map Focus Mode.
- Preserve the existing warning selection as the single source of truth. Opening, closing, or switching between drawers must not clear or replace the selected warning. Selecting a different warning in Active Warnings updates Selected Warning immediately, including while its drawer is open.
- Reuse the existing list renderer, search/severity filters, details renderer, Copy Bulletin and Locate on Map actions. Do not add duplicate data fetches or a second selected-warning state.
- Keep the existing **Restore panels** action as the way to leave Map Focus Mode and return to the resizable three-column desktop workspace.

**Implementation approach**
1. Separate the current focus-mode panel-collapse behavior from drawer visibility state; focus mode should expand the map while leaving both panel elements available for overlay presentation.
2. Add two small edge-toggle controls within the map workspace and position the corresponding warning panels absolutely/fixed within the workspace stacking context.
3. Introduce independent state flags for Active Warnings and Selected Warning drawers. Keep these flags separate from the existing selected warning ID and from Map Focus Mode.
4. Add responsive drawer sizing, safe viewport bounds, z-index ordering above Leaflet controls, backdrop/edge treatment only if needed for legibility, and reduced-motion handling.
5. Ensure the draggable desktop dividers are hidden/disabled in Map Focus Mode and restored with the normal workspace.
6. Keep this feature desktop-only. Tablet and mobile must continue using their existing map/list overlay and details drawer/modal behavior without the new edge toggles.

**Acceptance tests**
- Enter Map Focus Mode: map fills the workspace; both edge toggles are visible.
- Open Active Warnings: list slides over the map from the left; map dimensions, center and zoom do not change.
- Open Selected Warning: details slides over the map from the right; map dimensions, center and zoom do not change.
- Open both drawers together; verify they coexist without covering each other's close controls or making the map unusable.
- Close either drawer independently; the other remains open.
- Select a warning, close/reopen either drawer, and verify the same warning remains selected and rendered.
- Select another warning while both drawers are open; details update to the new selection without an extra fetch.
- Escape closes the most recently opened drawer before exiting Map Focus Mode.
- Restore panels returns to the desktop three-column layout with the existing resizer behavior.
- Verify keyboard operation, focus visibility, accessible expanded state, reduced-motion behavior, and light/dark/night themes.
- Verify tablet and mobile layouts are unchanged at the existing responsive test sizes.

**Status:** Implemented for the Selected Warning panel on large desktop. The Active Warnings overlay remains unchanged and is still a separate follow-up.

### Desktop Selected Warning collapse

- The Selected Warning header close control hides the panel without clearing the selected warning or its rendered details.
- The grid removes the details column and its resize handle, allowing Map and Active Warnings to use the reclaimed width.
- A right-edge **Show details** control restores the panel and existing selection.
- In Map Focus Mode, Selected Warning opens as a floating right-side drawer over the full-screen map; hiding it leaves a compact right-edge reopen control.
- Escape hides the Selected Warning overlay before the next Escape exits Map Focus Mode.
- The existing footer **Clear** action remains the explicit action for clearing the selection.
- This behavior is restricted to desktop widths (1440px and wider); tablet/mobile drawer and modal behavior is unchanged.

### Tablet: map + list, details below

- Keep Map and Active Warnings side by side when there is sufficient width.
- Place Warning Details below the two-column row, outside the Leaflet map container.
- Keep details content scrollable within its panel.

### Mobile: vertically stacked panels

- Do not compress three columns.
- Stack Map, Active Warnings, and Warning Details vertically; each remains reachable by scrolling.
- The existing mobile warning modal behavior remains available when a warning is selected.
- The list and details must not overlay the map.
- Use the existing safe-area tokens and a stable viewport sizing strategy; avoid repeatedly resizing the map due only to browser chrome movement.
- Landscape phones are a separate test case, not an assumed tablet layout.

## Selection and data rules

- One selected warning ID is the source of truth. Marker, list row, and details panel all reflect it.
- Selecting a list row or marker updates the same selected warning; it must not issue a second details fetch when the hydrated warning record already contains its bulletin and geometries.
- If the selected warning is removed by a filter or no longer exists in the current active collection, clear the selection and show the details empty state. Do not retain stale details.
- Hover may provide a transient map preview only; it must not replace the selected warning or continuously update an `aria-live` details region.
- Clicking/tapping a marker or list row changes selection.
- Do not add warning selection to the URL in this change. Preserve the current public route grammar and existing standalone warning URLs; revisit a shareable hash only as a separately reviewed routing decision.

## Active Warnings list density

- Treat each row as a scanning and selection control, not a second bulletin preview.
- Keep the warning identifier and NAVAREA as the primary line; show an existing category/type label only when the record supplies one.
- Do not render the full bulletin title/raw text in the list row. The complete bulletin remains in the Selected Warning details surface.
- Omit missing issued-date placeholders instead of repeating “Date not stated” on every row.
- Keep rows comfortably separated with a compact, consistent hierarchy; long category labels may wrap to two lines.
- Preserve severity indication, keyboard selection, search/filter behavior, and the special unassigned-NAVAREA context label.

## Details content and maritime conventions

- Preserve the original bulletin verbatim and the existing Copy Bulletin action.
- Preserve area/subject, NAVAREA, status/severity, category, issued date, coordinates, and all available warning metadata already rendered by the current details surface.
- Display issued/validity timestamps in UTC and label UTC explicitly wherever a timestamp is rendered. Do not reinterpret date-only source values as timestamps.
- Geometry remains rendered on the map using the existing spatial engine. The details panel may summarize geometry availability/type, but must not invent geometry or imply a point marker represents the full warning area.
- Missing or invalid geometry must be represented as unavailable; do not fabricate a coordinate.
- Keep the existing modal and standalone detail pages working; do not fork their source-of-truth logic.

## Responsive sizing and overflow safeguards

- Prefer grid/flex sizing with `min-height: 0`, `min-width: 0`, and independent `overflow-y: auto` on panel bodies.
- Avoid an `auto` grid row for long bulletin content inside a fixed-height shell.
- Use the existing viewport and safe-area conventions after checking the actual header/bottom navigation dimensions at each breakpoint.
- Keep `#map` and its parent measurable; call Leaflet `invalidateSize()` after an actual workspace/view transition, not on every scroll or every viewport-chrome tick.
- Preserve map center/zoom across panel changes. Do not reinitialize Leaflet or add a second map instance.
- Do not add shadows, new accent colors, heavier borders, or new fonts. Follow `UI-DESIGN-FUNDAMENTALS.md`.

## Implementation scope

Expected files to touch, subject to the implementation diff:

- `index.html`: workspace structure, desktop panel proportions, responsive layout rules, and list search/severity controls.
- `public/assets/js/public.js`: selected-warning synchronization and client-side list search/severity filtering.
- `scripts/ux-audit/tests/`: regression coverage for the public map workspace.
- `docs/ux-audit/do-not-break.md`: update only where a deliberately changed behavior needs a new explicit invariant.

No database schema, Supabase view, ingestion pipeline, admin console, prerender route, or backend change is in scope.

## Acceptance tests

Run existing gates as documented in `AGENTS.md` and `docs/ux-audit/do-not-break.md`:

- `npm run lint`
- `npx vite build` (the UX audit guide specifically warns against `npm run build` on Windows)
- `npm run ux:smoke`

Add/extend browser coverage for:

1. Desktop three-column layout at 1920×1080, 1648×928, 1440×900, and 1366×768.
2. Tablet layout at 1024×768 and 820×1180.
3. Portrait phones at 390×844 and 360×800.
4. Landscape phones at 844×390 and 932×430.
5. No horizontal page overflow at every tested width.
6. Active Warnings is outside `.map-container` and does not cover the Leaflet map.
7. Selecting from the list and selecting a marker update the same details content.
8. Details empty state appears initially and after the selected warning is filtered out.
9. Long raw bulletins scroll inside Details without expanding the page or hiding the map controls.
10. Copy Bulletin preserves the exact original text.
11. Locate on Map still switches to Map and focuses the selected warning without resetting the user's map view on unrelated refreshes.
12. Point, line/corridor, polygon, circle, and no-geometry warnings continue to behave as before.
13. Light, dark, and night themes remain readable.
14. Existing Data Bank, Info/More navigation, onboarding, warning modal, and standalone warning URLs remain functional.
15. Keyboard focus and Escape behavior work for the tablet details drawer and mobile view switcher.

## Out of scope

- Rebuilding the public portal or replacing Leaflet.
- Replacing the warning data model or fetching warning details a second time.
- Changing the Data Bank, Info content, admin console, or backend.
- Changing warning geometry semantics, clustering rules, ingestion, or parser behavior.
- Removing the existing warning modal, standalone warning detail pages, Copy Bulletin, or Locate on Map.
- Adding a new routing scheme or URL state for selected warnings.

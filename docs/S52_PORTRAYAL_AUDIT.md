# S-52-informed warning portrayal audit

## Scope

This is a frontend portrayal alignment for NAVAREA warning overlays. It is **not** an ENC/SENC renderer and does not claim IHO S-52 conformance or ECDIS certification.

S-52 portrayal is attribute- and geometry-dependent: point symbols, line styles, area boundaries/fills, lookup tables and conditional symbology procedures work together. In particular, a wreck symbol cannot be selected correctly from the word "wreck" alone; relevant ENC attributes can include wreck category, depth, water level and safety-contour context.

## Implemented

- Keep the seven compact Helm.Warning point glyphs. The wreck glyph is an original wreck/obstruction cue, not a copied or literal S-52 symbol.
- Preserve category, severity and geometry as independent inputs.
- Submarine cable LineString/MultiLineString geometry receives a chart-familiar magenta line treatment in both the public Leaflet map and React console. The source geometry and endpoints are unchanged.
- Restricted-area polygons receive a magenta boundary while their fill continues to encode the existing warning severity. Point-only restricted warnings keep the general fallback because no area geometry is available.
- Unknown categories remain visible through the existing general-symbol fallback. Security remains distinct from wreck.
- No backend, parser, Supabase, warning records, or geometry coordinates are changed.

## Portrayal limits

- The magenta cable line and restricted-area boundary are S-52-informed visual cues, not a reproduction of the full S-52 symbol/lookup-table procedure.
- A cable warning with only a point geometry remains a point marker; do not fabricate a route.
- A restricted warning without polygon geometry remains a point marker; do not fabricate an exclusion area.
- The wreck point glyph must not imply a verified depth, safe/dangerous classification, or chart-datum exposure. A future exact ENC portrayal would require the corresponding attributes and conditional symbology inputs.
- Existing Helm.Warning severity fills are retained. They are not the S-52 day/dusk/night colour tables.

## Regression checks

- Category-to-primary-symbol mapping remains stable; restricted stays general for point-only display.
- Cable and restricted category predicates are case/whitespace tolerant.
- Security does not map to wreck.
- Wreck and general glyphs remain distinct.
- Severity remains independent of symbol choice.
- Public and console render cable routes and restricted polygons without modifying geometry.
- Point-only clustering, polygon/line non-clustering, circles, sectors and multi-zone geometry remain unchanged.

## Visual verification required

Run the repository lint and Vitest suite, then inspect the Vercel preview in both public and console maps:

1. Cable LineString and MultiLineString on light and dark basemaps; verify magenta core/casing remains legible at global, regional and detailed zoom.
2. Cable point-only warning; verify no synthetic route is drawn.
3. Restricted polygon; verify magenta boundary and severity-coded fill remain distinguishable.
4. Restricted point-only warning; verify the general marker remains and no synthetic area appears.
5. Wreck vs general vs security markers; verify all are distinguishable and no depth/danger claim appears.
6. Critical, High and Moderate fills; confirm severity remains unchanged.
7. Existing circles, sectors, corridors, multi-zone polygons, selection, hover, popups, cluster behaviour and mobile clipping.

## Standards context

Use the current IHO S-52 Presentation Library and its Chart 1 / portrayal bulletins as the reference when extending this work. S-52 Annex A conditional symbology and the applicable addenda must be checked for the specific object and attributes before describing any glyph or line as an exact S-52 symbol.

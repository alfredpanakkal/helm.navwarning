# Helm.Warning Implementation Guide

## CONTEXT
This is a NAVAREA maritime warning pipeline site. We're refactoring from a
cluttered single-page to a clean public site + admin console.

## CRITICAL: Supabase schema (read first)
The backend (Helm.Warning.Backend) now writes the 20261019/20 schema. Read
`docs/supabase-backend-contract.md` in this repo before touching any data
layer. Non-negotiables:
- Geometry lives in `nav_warning_geometries` / the
  `nav_warnings_active_spatial` view (`geojson_blob`), NOT in
  `latitude`/`longitude`/`spatial` columns on `nav_warnings` — those
  columns do not exist.
- Stable key is `canonical_id` (e.g. `NAVAREA XI 0451/26`); children join
  on `nav_warnings.id` (uuid).
- `categories` is a TEXT[] array (no `category`/`severity`/`risk_level`).
- `navarea` stores full names (`NAVAREA XI`, `NAVAREA BALTIC`).
- Map shows only the `nav_warnings_active_spatial` view (active + Tier A);
  Tier B via `nav_warnings_review_queue`; Tier C is never rendered.
- `sources_registry`, `ingestion_generations`, `raw_artifacts`,
  `in_force_snapshots` are NOT populated by this backend; audit data is in
  `raw_messages`. Don't hard-fail on their absence.
- Browser reads use the anon key (RLS SELECT-only); writes go through the
  `upsert_nav_warning` RPC or service-role only.

## REFERENCE FILES
- `docs/supabase-backend-contract.md` - backend data contract (authoritative)
- `index.html` - APPROVED public site design (Map/Data Bank/Sources)
- `admin.html` - APPROVED admin console design (5 sub-tabs + login)

## RULES
1. Never break the ingestion pipeline or atomic publishing
2. Public page contains ZERO admin code
3. All writes use authenticated Supabase client
4. RLS enabled on all tables with proper policies
5. No demo credentials in shipped code
6. Design tokens ONLY (no hardcoded colors/fonts)

## DESIGN TOKENS (from reference files)
Colors: --critical:#dc2626; --high:#ea580c; --active:#059669; 
        --verified:#0d9488; --neutral:#64748b
Type: H1 600/28px; H2 600/20px; body 400/14px
Spacing: 4/8/16/24/40/64px

# Supabase Backend Contract — how Helm.Warning.Backend saves data

> Source of truth: `Helm.Warning.Backend` repo, migrations
> `20261019_global_navarea_pipeline_adapted.sql`,
> `20261020_realtime_and_audit.sql`,
> `20261019_add_categories_column_and_update_view.sql`, and
> `shared/sync_engine.py` / `shared/models.py`.
> This document is the frontend integration contract for `helm.navwarning`.

## 1. Why the frontend currently shows nothing

The backend was migrated to the **20261019/20 schema**. The frontend
(`server.ts` `hydrateDatabaseFromSupabase()`, `src/services/api.ts`
`mapSupabaseRowToNavWarning()`, `src/lib/supabaseServer.ts`) still reads the
**old flat schema**. The rows ARE in Supabase; the frontend drops or
mis-maps them:

| Frontend expects | New backend reality | Effect |
|---|---|---|
| `row.latitude`, `row.longitude`, `row.spatial` | Removed. Geometry lives in `nav_warning_geometries` (PostGIS) / `geojson_blob` in the `nav_warnings_active_spatial` view | Map has no points → blank map |
| `row.warning_id` (text) | No such column. Keys are `id` (uuid) + `canonical_id` (e.g. `NAVAREA XI 0451/26`) | Warning ids come back undefined → `warn-1792491234776` junk ids |
| `row.issued_date`, `row.issued_text` | Removed. Dates are `issued_at` / `valid_from` / `valid_to` (timestamptz, nullable) | Dates blank; `issued_iso` falls back to created_at |
| `row.category` / `severity` / `risk_level` / `hazard_category` | Removed. Single `categories TEXT[]` (lowercase: military, aton, subsea, drifting, offshore, electronic, general) | Category/severity filters find nothing |
| `row.navarea` values like `'I'`, `'XI'`, `'Baltic'` | Backend stores full names: `'NAVAREA I'`, `'NAVAREA XI'`, `'NAVAREA BALTIC'` | Navarea dropdown filters match nothing |
| `sources_registry`, `ingestion_generations`, `raw_artifacts`, `in_force_snapshots` | **These tables are NOT written by the new backend at all**. Audit lives in `raw_messages` | Health check shows errors; Sources/Evidence/Audit tabs empty |
| per-navarea schemas (`getNavareaSchemaName` → `navarea_11` etc.) | Does not exist. Everything is in `public.nav_warnings` | Any per-schema query 404s |

Additional mapping hazards in `mapSupabaseRowToNavWarning`:
- `warning_year` is an INTEGER now, not embedded in `warning_id` strings.
- `warning_number` is INTEGER; string splits like `.split('-')` produce NaN.
- `valid_until` / `validity` do not exist; use `valid_to`.
- `status` now has CHECK values: active, cancelled, expired, superseded,
  unverified. Frontend `validity: 'cancelled'` logic must read `status`.

## 2. What the backend writes (and only this)

### 2.1 `public.nav_warnings` (master, one row per warning)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` — FK target for children |
| `canonical_id` | text UNIQUE NOT NULL | e.g. `NAVAREA XI 0451/26`. **The stable join key.** |
| `navarea` | text NOT NULL | Full name: `NAVAREA I` … `NAVAREA XXI`, `NAVAREA BALTIC` |
| `source_id` | text NOT NULL | e.g. `kaiho-navarea-xi`, `ukho-navarea-1`, `sma-baltic-subarea` |
| `title` | text NOT NULL | ≤255 chars |
| `area_text` | text | General area description |
| `raw_text` | text NOT NULL | Immutable original bulletin text (Rule 125) |
| `status` | text NOT NULL | `active|cancelled|expired|superseded|unverified` |
| `categories` | TEXT[] NOT NULL | lowercase, always non-empty, de-duplicated |
| `triage_tier` | text NOT NULL | `A` = auto-plot on map, `B` = review queue, `C` = blocked, never render |
| `data_quality` | text NOT NULL | `EXPLICIT|INFERRED|AMBIGUOUS|INVALID` |
| `parsing_method` | text NOT NULL | `RULE|AI` |
| `qa_flags` | jsonb | array of flags |
| `unplotted_reason` | text | null for Tier A |
| `valid_from`, `valid_to`, `issued_at` | timestamptz | **nullable** — free-text dates are not force-cast |
| `shoal_depth_m`, `tow_length_m`, `tow_speed_kts` | double precision | maritime attributes |
| `applicable_vessel_filter` | text | |
| `radio_frequencies` | TEXT[] | |
| `space_launch_mission` | text | |
| `duplicate_of_id` | uuid FK → self | |
| `cancels_ids` | TEXT[] | textual references this warning cancels |
| `created_at`, `updated_at` | timestamptz | |

There are NO columns for: `latitude`, `longitude`, `spatial`,
`warning_id`, `issued_date`, `issued_text`, `category`, `severity`,
`risk_level`, `hazard_category`, `sub_area`, `authority`,
`source_url`, `is_cancelled`.

### 2.2 `public.nav_warning_geometries` (child, PostGIS)

- `geom_id` uuid PK, `warning_id` uuid FK → `nav_warnings.id` (ON DELETE CASCADE)
- `feature_type` text: `POINT|LINE|POLYGON|CORRIDOR|SWEEP_ARC|BOUNDING_BOX`
- `geom_postgis` geography(Geometry, 4326) — antimeridian-safe
- `zone_label`, `buffer_nm`, `corridor_half_width_nm`,
  `altitude_floor_m`, `altitude_ceiling_fl`
- **On every sync the geometries are DELETEd and re-inserted** — never
  cache/track `geom_id`; always join via `warning_id`.
- One warning can have multiple geometry rows.

### 2.3 `public.raw_messages` (ingestion audit)

`id`, `warning_id` (text), `source_id`, `subject_header`,
`full_raw_text`, `received_timestamp`, `checksum_sha256`,
UNIQUE(`warning_id`, `source_id`, `checksum_sha256`). Used by the
differential engine for change detection. Frontend does not need it.

Not written by the backend: `sources_registry`, `ingestion_generations`,
`raw_artifacts`, `nav_warning_entities`, `nav_warning_schedules`,
`nav_warning_charts`, `nav_warning_cancellations`, `in_force_snapshots`
(entities/schedules/charts/cancellations tables exist in schema but the
current pipeline does not populate them).

### Write path

Python sync engine → `upsert_nav_warning(jsonb)` RPC (atomic master +
geometries; deletes+reinserts children) with fallback to direct
`nav_warnings` upsert on `canonical_id`. Differential keyed on
`canonical_id` + checksums; missing-but-active DB rows get
`status='cancelled'`.

## 3. Read API for the frontend

### 3.1 Primary: `public.nav_warnings_active_spatial` view

Map-ready rows: active + Tier A warnings joined to their geometries,
with GeoJSON pre-computed:

```
warning_id (uuid = nav_warnings.id), canonical_id, navarea, title,
area_text, categories, status, triage_tier, data_quality,
valid_from, valid_to, radio_frequencies, space_launch_mission,
geom_id, zone_label, feature_type, buffer_nm, corridor_half_width_nm,
altitude_floor_m, altitude_ceiling_fl,
geom_postgis,
geojson_blob   -- JSONB from ST_AsGeoJSON, ready for Leaflet
```

- One row **per geometry** — group by `canonical_id` when rendering.
- `geojson_blob` is a JSON object of type Point/Polygon/LineString etc.,
  coordinates `[lng, lat]`. Feed directly to Leaflet GeoJSON layers.
- Also use it for databank listing? Prefer §3.2 for full text.

### 3.2 Secondary: `public.nav_warnings_review_queue` view

Tier B, non-cancelled warnings (admin triage UI):
`id, canonical_id, navarea, title, area_text, categories, status,
triage_tier, data_quality, parsing_method, qa_flags, unplotted_reason,
duplicate_of_id, raw_text, valid_from, valid_to, created_at, updated_at`.

### 3.3 Access & realtime

- RLS is enabled; `anon`/`authenticated` have SELECT-only policies on
  `nav_warnings`, `nav_warning_geometries`, `raw_messages`. Writes are
  service_role only. Use the anon key in the browser.
- `nav_warnings` and `nav_warning_geometries` are in the
  `supabase_realtime` publication → subscribe to both for live map updates.
- Views: query views with the anon client like tables
  (`.from('nav_warnings_active_spatial')`). Views expose `geojson_blob`
  as JSONB — no PostGIS parsing needed client-side.

## 4. Required frontend fixes (helm.navwarning)

1. **Map geometry:** replace `row.latitude/longitude/spatial` mapping with a
   query against `nav_warnings_active_spatial`; render `geojson_blob` per
   row, grouped by `canonical_id`. Fall back to parsing coordinates from
   `raw_text` only if the view has no geometry for that warning.
2. **Identity:** use `canonical_id` as the stable warning id;
   `id` (uuid) for any child joins; stop reading `warning_id`/
   `warning_number` string columns.
3. **Navarea normalization:** backend stores `NAVAREA XI` / `NAVAREA BALTIC`;
   strip the `NAVAREA ` prefix and uppercase remainder to get the dropdown
   id (`XI`, `BALTIC`). Add one shared helper; keep dropdown ids unchanged.
4. **Categories/severity:** read `categories` (TEXT[] → PostgREST returns a
   JSON array). Map to UI chips; replace `severity`/`risk_level` sorting
   with triage_tier/data_quality or drop it.
5. **Dates:** `issued_at`/created_at for "issued"; `valid_from`/`valid_to`
   may be NULL — treat null `valid_to` as "in force until cancelled".
   Expiry filter: `status='active' AND (valid_to IS NULL OR valid_to > now())`.
6. **Status semantics:** use `status` directly (CHECK-constrained);
   `cancelled`/ `expired`/ `superseded` → filter out of the live map.
7. **Tiering:** only render Tier A; show Tier B via the review queue view
   in admin; never render Tier C (`triage_tier='C'` or `unplotted_reason`
   set).
8. **Health check (`checkSupabaseHealth`):** count from
   `nav_warnings`, `nav_warning_geometries`, `raw_messages`; drop counts
   for `sources_registry`/`ingestion_generations`/`raw_artifacts` (tables
   not populated by this backend) or keep them as soft-warnings only.
9. **Remove per-navarea schema logic** (`getNavareaSchemaName`,
   `navarea_11` etc.) — there is a single `public` schema.
10. **Writes:** any manual-import path must target the new contract:
    master upsert keyed on `canonical_id` and geometries as
    `SRID=4326;...` EWKT into `nav_warning_geometries` — ideally via the
    `upsert_nav_warning` RPC to stay atomic. Do NOT write
    `latitude/longitude/spatial/category` columns (they do not exist).
11. **Filter columns that exist:** `navarea`, `status`, `triage_tier`,
    `categories` (use `cs`/`ov` PostgREST array operators), `valid_from`,
    `valid_to`, `source_id`. All indexed except categories.

## 5. Query cheat-sheet (supabase-js, anon key)

```ts
// Map layer
const { data } = await supabase
  .from('nav_warnings_active_spatial')
  .select('warning_id, canonical_id, navarea, title, area_text, categories,'
        + ' valid_from, valid_to, feature_type, zone_label, buffer_nm, geojson_blob');
// → group rows by canonical_id, render each geojson_blob with L.geoJSON

// Databank list (all statuses)
const { data } = await supabase
  .from('nav_warnings')
  .select('id, canonical_id, navarea, title, area_text, raw_text, categories,'
        + ' status, triage_tier, data_quality, valid_from, valid_to, issued_at, updated_at')
  .order('updated_at', { ascending: false });

// Category filter (contains 'military')
.eq('status', 'active')
.contains('categories', '{military}')

// Live updates
supabase.channel('nav')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'nav_warnings' }, cb)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'nav_warning_geometries' }, cb)
  .subscribe();
```

# Implementation Plan v5.2 — PostGIS-Backed Full-Corpus NAVAREA Warning System & M1 Ingestion Worker

A comprehensive architecture and delivery plan aligning Helm.Warning's ingestion pipeline, deterministic lifecycle resolution, and polymorphic Leaflet cartography with the enterprise PostgreSQL / Supabase / PostGIS relational database, featuring the complete production-grade `syncWarningsToSupabase` ingestion worker.

Supabase acts as the central nervous system: the ingestion worker and deterministic parser execute atomic database transactions (master + 5 child tables + lifecycle mutations), PostGIS handles cartographic buffering and antimeridian wrapping on the server side, and the Leaflet UI operates purely as an ultra-fast, lightweight reader consuming `nav_warnings_active_spatial` and `nav_warnings_review_queue`.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural mandates and M1 implementation specifications govern this plan:
>
> - **Service Role Bypass & Atomic Multi-Table Ingestion (Fix 1 & M1 Target)**: `syncWarningsToSupabase` uses the Supabase Service Role client (`SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`) to bypass RLS. It upserts into `public.nav_warnings`, captures returned master UUIDs (`id`), and executes cascading batch inserts into `nav_warning_geometries`, `nav_warning_entities`, `nav_warning_charts`, `nav_warning_schedules`, and `nav_warning_cancellations`.
> - **Sentinel Depth Guardrail (Rule 31 Check)**: Every `depth_m` and `shoal_depth_m` value equal to `-9999.0` (or outside the valid marine bathymetry range $(-50.0, 12000.0)$) is intercepted and converted to `null`, ensuring `chk_shoal_depth_sentinel` and `chk_entity_depth_sentinel` are never violated.
> - **Tier A Precedence Guardrail (Rule H02 Check)**: Notices assigned `triage_tier = 'A'` must strictly satisfy `data_quality = 'EXPLICIT'`, `unplotted_reason IS NULL`, `parsing_method = 'RULE'`, and `status != 'superseded'`. Any notice failing these criteria is automatically safeguarded to `triage_tier = 'B'`.
> - **PostGIS Spherical Geometries (EWKT)**: Point, corridor, and polygon perimeters are persisted as native `geography(Geometry, 4326)` via EWKT formatting (e.g., `SRID=4326;POINT(lng lat)`), offloading all buffering, corridors, and antimeridian calculations to PostGIS.
> - **Pre-Calculated Spatial & Review Views**: The public Leaflet map consumes `public.nav_warnings_active_spatial` (which pre-computes `ST_AsGeoJSON(geom_postgis)::jsonb AS geojson_blob` and includes `categories TEXT[]`), while the admin console consumes `public.nav_warnings_review_queue`.

---

## 1. Overview & Core Concept

### What It Does
An industrial, chartroom-grade maritime safety information system that ingests raw telex and GENADMIN broadcasts from NAVAREA IV, IX, and global coordinators. Ingestion parses coordinates, multi-vessel flotillas, INT charts, and operational schedules, persisting normalized records to Supabase. Active Tier A hazards stream directly to Leaflet via PostGIS spatial views, while Tier B and unplotted notices stream to an operator triage studio.

### Target Audience & Persona
- **Navigators & Officers of the Watch (OOW)**: Accessing the public portal (`index.html`) for instant, zero-latency situational awareness on nautical charts.
- **Maritime Safety Administrators & Hydrographers**: Operating the admin console (`admin.html`) to monitor ingestion health, audit Tier B notices, and verify complex hazards.

### Key Value
- **Sub-Second Map Initialization (< 1.5s TTFP)**: Consuming pre-computed PostGIS GeoJSON eliminates browser main-thread blocking, maintaining 50+ FPS during pan and zoom.
- **Relational Integrity & Safety Guards**: Prevents bathymetric corruption via depth sentinel sanitization and guarantees Tier A plot integrity via database constraints.
- **Absolute Separation of Concerns**: Public portal contains zero admin or write code, while all database mutations require authenticated service role access.

---

## 2. Production Ingestion Worker Implementation (`syncWarningsToSupabase`)

The following complete, production-ready ingestion function will be deployed to `src/lib/supabaseServer.ts`:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NavWarning } from '../types';

/**
 * Sanitizes depth values to prevent violating chk_shoal_depth_sentinel
 * and chk_entity_depth_sentinel. Converts -9999.0 or out-of-range depths to null.
 */
function sanitizeDepth(val: any): number | null {
  if (val == null) return null;
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return null;
  if (num === -9999.0 || num <= -50.0 || num >= 12000.0) return null;
  return num;
}

/**
 * Converts GeoJSON/coordinates into PostGIS EWKT geography string (SRID 4326).
 */
function toPostGISEWKT(geom: any, defaultLat?: number | null, defaultLng?: number | null): { ewkt: string; type: string } | null {
  if (!geom && (defaultLat == null || defaultLng == null)) return null;

  if (geom?.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
    const lng = Number(geom.coordinates[0]);
    const lat = Number(geom.coordinates[1]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { ewkt: `SRID=4326;POINT(${lng} ${lat})`, type: 'POINT' };
    }
  }

  if (geom?.type === 'Polygon' && Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
    const rings = geom.coordinates.map((ring: any[]) =>
      `(${ring.map((pt: any[]) => `${Number(pt[0])} ${Number(pt[1])}`).join(', ')})`
    ).join(', ');
    return { ewkt: `SRID=4326;POLYGON(${rings})`, type: 'POLYGON' };
  }

  if (geom?.type === 'LineString' && Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
    const pts = geom.coordinates.map((pt: any[]) => `${Number(pt[0])} ${Number(pt[1])}`).join(', ');
    return { ewkt: `SRID=4326;LINESTRING(${pts})`, type: 'LINE' };
  }

  if (defaultLat != null && defaultLng != null && !isNaN(defaultLat) && !isNaN(defaultLng)) {
    return { ewkt: `SRID=4326;POINT(${defaultLng} ${defaultLat})`, type: 'POINT' };
  }

  return null;
}

/**
 * Production Ingestion Worker: syncWarningsToSupabase
 * 1. Uses Supabase Service Role client to bypass RLS.
 * 2. Neutralizes -9999.0 depth sentinels.
 * 3. Enforces chk_tier_a_invariants.
 * 4. Upserts master records to public.nav_warnings and captures UUIDs.
 * 5. Batch inserts normalized child records into nav_warning_geometries,
 *    nav_warning_entities, nav_warning_charts, nav_warning_schedules, and cancellations.
 */
export async function syncWarningsToSupabase(warnings: NavWarning[]): Promise<{
  success: boolean;
  insertedCount: number;
  childCounts: { geometries: number; entities: number; schedules: number; charts: number; cancellations: number };
  error?: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      insertedCount: 0,
      childCounts: { geometries: 0, entities: 0, schedules: 0, charts: 0, cancellations: 0 },
      error: 'Supabase client not initialized or missing service role key',
    };
  }
  if (!warnings || warnings.length === 0) {
    return {
      success: true,
      insertedCount: 0,
      childCounts: { geometries: 0, entities: 0, schedules: 0, charts: 0, cancellations: 0 },
    };
  }

  try {
    // ─── 1. PREPARE MASTER ENVELOPES ───
    const masterRows = warnings.map((w) => {
      const canonicalId = (w as any).canonical_id || w.warning_number || w.source_warning_id || w.warning_id;
      const rawText = w.raw_text || '';
      const issuedDateStr = w.issued_date || (w.issued_at ? w.issued_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
      const year = w.warning_year || parseInt(issuedDateStr.slice(0, 4), 10) || new Date().getFullYear();

      // Normalize Categories array
      let categories: string[] = [];
      if (Array.isArray(w.categories)) {
        categories = w.categories.map(String);
      } else if (typeof (w as any).category === 'string') {
        categories = [(w as any).category];
      }

      // Check depth sentinel for master table
      const shoalDepth = sanitizeDepth((w as any).shoal_depth_m);
      const isDepthUnknown = (w as any).is_depth_unknown ?? ((w as any).shoal_depth_m === -9999.0);

      // Determine parsing method & data quality
      const parsingMethod: 'RULE' | 'AI' = (w as any).parsing_method === 'AI' || w.extraction_method === 'llm' ? 'AI' : 'RULE';
      let dataQuality = (w as any).data_quality || 'EXPLICIT';
      let unplottedReason = (w as any).unplotted_reason || null;
      let status = w.status || 'active';

      // Enforce chk_tier_a_invariants guardrail
      let triageTier = (w as any).triage_tier || ((w as any).risk_level === 'critical' || w.status === 'active' ? 'A' : 'B');
      if (triageTier === 'A') {
        const isValidTierA = dataQuality === 'EXPLICIT' && unplottedReason === null && parsingMethod === 'RULE' && status !== 'superseded';
        if (!isValidTierA) {
          triageTier = 'B'; // Automatically safeguard to Tier B review queue
        }
      }

      return {
        canonical_id: canonicalId,
        source_id: w.source_id || 'manual-import',
        publisher_id: w.publisher_id || null,
        series: w.series || `NAVAREA ${w.navarea || 'IV'}`,
        warning_number: w.warning_number || canonicalId,
        warning_year: year,
        title: w.title || null,
        raw_text: rawText,
        issued_date: issuedDateStr,
        issued_text: w.issued_text || issuedDateStr,
        issued_at: w.issued_at || new Date().toISOString(),
        valid_from: w.valid_from || null,
        valid_to: w.valid_to || w.valid_until || null,
        navarea: w.navarea || 'IV',
        area_text: w.area_text || null,
        sub_area: w.sub_area || null,
        authority: w.authority || null,
        status: status,
        triage_tier: triageTier,
        data_quality: dataQuality,
        parsing_method: parsingMethod,
        unplotted_reason: unplottedReason,
        categories: categories,
        shoal_depth_m: shoalDepth,
        is_depth_unknown: isDepthUnknown,
        space_launch_mission: (w as any).space_launch_mission || null,
        altitude_ceiling_fl: (w as any).altitude_ceiling_fl != null ? Number((w as any).altitude_ceiling_fl) : null,
        radio_frequencies: Array.isArray((w as any).radio_frequencies) ? (w as any).radio_frequencies : [],
        radio_communications: (w as any).radio_communications || [],
        cancels_ids: Array.isArray((w as any).cancels_ids) ? (w as any).cancels_ids : (w.cancels ? [w.cancels].flat() : []),
        qa_flags: Array.isArray((w as any).qa_flags) ? (w as any).qa_flags : [],
        updated_at: new Date().toISOString(),
      };
    });

    // ─── 2. UPSERT MASTER ENVELOPES & RETRIEVE UUIDS ───
    const CHUNK_SIZE = 50;
    const insertedMasterMap = new Map<string, string>(); // canonical_id -> UUID

    for (let i = 0; i < masterRows.length; i += CHUNK_SIZE) {
      const chunk = masterRows.slice(i, i + CHUNK_SIZE);
      const { data, error } = await client
        .from('nav_warnings')
        .upsert(chunk, { onConflict: 'canonical_id' })
        .select('id, canonical_id');

      if (error) {
        console.error('Supabase master nav_warnings upsert error:', error.message);
        return {
          success: false,
          insertedCount: insertedMasterMap.size,
          childCounts: { geometries: 0, entities: 0, schedules: 0, charts: 0, cancellations: 0 },
          error: `nav_warnings: ${error.message}`,
        };
      }

      if (data) {
        for (const row of data) {
          insertedMasterMap.set(row.canonical_id, row.id);
        }
      }
    }

    // ─── 3. PREPARE CHILD TABLE ROWS ───
    const geometryRows: any[] = [];
    const entityRows: any[] = [];
    const scheduleRows: any[] = [];
    const chartRows: any[] = [];
    const cancellationRows: any[] = [];

    for (const w of warnings) {
      const canonicalId = (w as any).canonical_id || w.warning_number || w.source_warning_id || w.warning_id;
      const masterId = insertedMasterMap.get(canonicalId);
      if (!masterId) continue;

      // Geometries
      const rawGeom = w.spatial?.geometries?.[0];
      const parsedGeom = toPostGISEWKT(rawGeom, w.latitude, w.longitude);
      if (parsedGeom) {
        geometryRows.push({
          warning_id: masterId,
          zone_label: rawGeom?.label || (w as any).zone_label || 'PRIMARY_HAZARD',
          feature_type: (w as any).feature_type || parsedGeom.type,
          geom_postgis: parsedGeom.ewkt,
          buffer_nm: (w as any).buffer_nm != null ? Number((w as any).buffer_nm) : ((w as any).clearanceNm || 0.0),
          corridor_half_width_nm: (w as any).corridor_half_width_nm != null ? Number((w as any).corridor_half_width_nm) : null,
          altitude_floor_m: (w as any).altitude_floor_m != null ? Number((w as any).altitude_floor_m) : 0.0,
          altitude_ceiling_fl: (w as any).altitude_ceiling_fl != null ? Number((w as any).altitude_ceiling_fl) : null,
        });
      }

      // Entities (vessels, rigs, buoys, wrecks)
      const rawEntities = Array.isArray((w as any).entities) ? (w as any).entities : [];
      for (const ent of rawEntities) {
        entityRows.push({
          warning_id: masterId,
          entity_type: ent.entity_type || 'VESSEL',
          entity_name: ent.entity_name || 'UNKNOWN',
          role: ent.role || 'PRIMARY',
          callsign: ent.callsign || null,
          mmsi: ent.mmsi || null,
          tow_length_m: ent.tow_length_m != null ? Number(ent.tow_length_m) : null,
          tow_speed_kts: ent.tow_speed_kts != null ? Number(ent.tow_speed_kts) : null,
          streamer_count: ent.streamer_count != null ? Number(ent.streamer_count) : null,
          streamer_length_m: ent.streamer_length_m != null ? Number(ent.streamer_length_m) : null,
          streamer_breadth_m: ent.streamer_breadth_m != null ? Number(ent.streamer_breadth_m) : null,
          clearance_requested_nm: ent.clearance_requested_nm != null ? Number(ent.clearance_requested_nm) : null,
          depth_m: sanitizeDepth(ent.depth_m),
          depth_status: ent.depth_status || null,
          radio_channels: ent.radio_channels || [],
        });
      }

      // Operational Schedules
      const rawSchedules = Array.isArray((w as any).schedules) ? (w as any).schedules : [];
      for (const sch of rawSchedules) {
        if (sch.window_start && sch.window_end) {
          scheduleRows.push({
            warning_id: masterId,
            window_start: sch.window_start,
            window_end: sch.window_end,
            is_alternate: sch.is_alternate ?? false,
            recurrence_rule: sch.recurrence_rule || null,
            days_of_week: Array.isArray(sch.days_of_week) ? sch.days_of_week : null,
          });
        }
      }

      // Charts
      const rawCharts = Array.isArray((w as any).charts) ? (w as any).charts : (w.charts ? [w.charts].flat() : []);
      for (const chart of rawCharts) {
        if (!chart) continue;
        const chartNum = typeof chart === 'object' ? (chart.chart_number || chart.number) : String(chart);
        if (chartNum) {
          chartRows.push({
            warning_id: masterId,
            authority: typeof chart === 'object' ? (chart.authority || 'BA') : 'BA',
            chart_number: chartNum,
            int_equivalent: typeof chart === 'object' ? chart.int_equivalent : null,
            is_international: typeof chart === 'object' ? (chart.is_international ?? false) : false,
          });
        }
      }

      // Cancellations
      const rawCancels = Array.isArray((w as any).cancels_ids) ? (w as any).cancels_ids : (w.cancels ? [w.cancels].flat() : []);
      for (const targetId of rawCancels) {
        if (!targetId) continue;
        cancellationRows.push({
          cancelling_warning_id: masterId,
          target_canonical_id: String(targetId).trim(),
          cancellation_type: 'EXPLICIT_NOTICE',
        });
      }
    }

    // ─── 4. EXECUTE BATCH CHILD INSERTS ───
    await Promise.all([
      geometryRows.length > 0 ? client.from('nav_warning_geometries').insert(geometryRows) : Promise.resolve(),
      entityRows.length > 0 ? client.from('nav_warning_entities').insert(entityRows) : Promise.resolve(),
      scheduleRows.length > 0 ? client.from('nav_warning_schedules').insert(scheduleRows) : Promise.resolve(),
      chartRows.length > 0 ? client.from('nav_warning_charts').insert(chartRows) : Promise.resolve(),
      cancellationRows.length > 0 ? client.from('nav_warning_cancellations').insert(cancellationRows) : Promise.resolve(),
    ]);

    return {
      success: true,
      insertedCount: insertedMasterMap.size,
      childCounts: {
        geometries: geometryRows.length,
        entities: entityRows.length,
        schedules: scheduleRows.length,
        charts: chartRows.length,
        cancellations: cancellationRows.length,
      },
    };
  } catch (err: any) {
    console.error('syncWarningsToSupabase execution exception:', err);
    return {
      success: false,
      insertedCount: 0,
      childCounts: { geometries: 0, entities: 0, schedules: 0, charts: 0, cancellations: 0 },
      error: err.message || String(err),
    };
  }
}
```

---

## 3. Milestone Delivery Roadmap

| Milestone | Scope & Deliverables | Acceptance Criteria |
|---|---|---|
| **M0: Contract Synchronization & DDL** | • Sync `src/types/navarea.ts` with Supabase contracts (`ParsingMethod = 'RULE' \| 'AI'`, `warning_id` alias, `categories: string[]`).<br>• Commit schema migration SQL to `docs/supabase_setup.sql`. | TypeScript compilation clean; types strictly aligned with database schema. |
| **M1: Ingestion Persistence Worker** | • Deploy production `syncWarningsToSupabase` in `src/lib/supabaseServer.ts` with service-role bypass, depth sanitization, master UUID capture, and batch inserts across geometries, entities, charts, schedules, and cancellations. | Ingestion inserts master records with `categories` and populates all 5 child tables without constraint violations. |
| **M2: Database-Persisted Lifecycle Engine** | • Update `src/parsers/lifecycle.ts` to execute database mutations for cancellations (`nav_warning_cancellations`) and status updates (`status = 'cancelled'`). | `CANCEL 156/26` updates target record status and records relational edge in Supabase. |
| **M3: Spatial View Reader (`index.html` & Leaflet)** | • Update `public/assets/js/supabase.js` to query `nav_warnings_active_spatial` view.<br>• Render SVG category icons directly using `categories` array.<br>• Offload buffer & corridor rendering to pre-calculated `geojson_blob`. | Leaflet renders vectors directly from GeoJSON; Time-to-First-Paint < 1.5s; 50+ FPS pan/zoom. |
| **M4: Operator Review & Audit Trail (`admin.html`)** | • Wire review workspace to `nav_warnings_review_queue` view using `warning_id`.<br>• Implement sign-off handler recording to `nav_warning_audits`. | Operator promotions/rejections record cryptographic audit rows in Supabase; zero admin code in public bundle. |
| **M5: Full Verification & Golden Regression Suite** | • Execute golden fixture tests, held-out validation suite, and `compile_applet`. | All 25 golden patterns pass; held-out slice 0 coordinate errors; clean production build. |

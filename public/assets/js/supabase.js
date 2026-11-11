// ════════════ SUPABASE INIT ════════════
// 20261019/20 backend schema contract:
//   - nav_warnings: canonical_id, categories TEXT[], triage_tier, data_quality,
//     status, valid_from/valid_to, issued_at, updated_at. NO severity / risk_level /
//     category / issued_date / latitude / longitude / is_verified columns.
//   - Geometry lives in nav_warning_geometries / the nav_warnings_active_spatial
//     view (geojson_blob), never in flat columns on nav_warnings.
//   - Stable human key is canonical_id; DB key is the uuid column "id".
// See docs/supabase-backend-contract.md and src/services/navWarningQueries.ts.

// Columns that actually exist on nav_warnings (20261019/20 schema).
const LIGHT_COLUMNS =
  'id, canonical_id, navarea, source_id, title, area_text, categories, ' +
  'status, triage_tier, data_quality, valid_from, valid_to, issued_at, ' +
  'raw_text, created_at, updated_at';

// Use environment variables if bundled, otherwise fallback to project keys
const SUPABASE_URL = (typeof process !== 'undefined' && process.env.VITE_SUPABASE_URL) || 'https://ocqpfbkuiomzhbxxvemi.supabase.co';
const SUPABASE_PUBLIC_KEY =
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)) ||
  'sb_publishable_mBu1kjX8d36QSDlgvNudvw_cztVRegR';

// Initialize Supabase client globally so public.js and admin.js can use it
window.hwSupabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY) : null;

if (!window.hwSupabase) {
  console.warn('⚠️ Supabase client failed to initialize. Check if supabase-js CDN is loaded.');
}

// ════════════ DATA FETCH HELPERS ════════════
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Computes the centroid [lat, lng] of a polygon ring.
 * Coordinates are GeoJSON format: [[lng, lat], ...]
 */
function computePolygonCentroid(coords) {
  if (!Array.isArray(coords) || coords.length === 0) return [0, 0];
  const ring = Array.isArray(coords[0]) && Array.isArray(coords[0][0]) ? coords[0] : coords;
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  for (const pt of ring) {
    if (Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
      sumLng += pt[0];
      sumLat += pt[1];
      count++;
    }
  }
  return count > 0 ? [sumLat / count, sumLng / count] : [0, 0];
}

/**
 * Parses coordinates and geometry from raw text if PostGIS geometry is absent.
 * Supports:
 * - Rig Warnings / RIGLISTs with multiple rigs and 500m safety exclusion zones
 * - Multi-Area and Multi-Sector warnings (Area Alfa, Area Bravo, Sector 1, etc.)
 * - Polygons (3+ coords), Safety Circles (radius NM or meters), Corridors/Tracks, and Points
 */
function extractGeometriesFromRawText(text, fallbackTitle) {
  if (!text || typeof text !== 'string') return [];
  const upper = text.toUpperCase();

  // Helper: extracts all [lng, lat] coordinate pairs from a string
  function extractCoords(str) {
    const list = [];
    const coordRegex = /(\d{1,2})[-°](\d{1,2}(?:\.\d+)?)[ '"]*([NS])\s*(\d{1,3})[-°](\d{1,2}(?:\.\d+)?)[ '"]*([EW])/gi;
    let m;
    while ((m = coordRegex.exec(str)) !== null) {
      let lat = parseFloat(m[1]) + parseFloat(m[2]) / 60;
      if (m[3].toUpperCase() === 'S') lat = -lat;
      let lng = parseFloat(m[4]) + parseFloat(m[5]) / 60;
      if (m[6].toUpperCase() === 'W') lng = -lng;
      list.push([lng, lat]);
    }
    return list;
  }

  // Helper: extracts radius in Nautical Miles from a string
  function extractRadiusNm(str) {
    const radiusMatch = str.match(/(?:WITHIN\s+|RADIUS\s+(?:OF\s+)?|CLEARANCE\s+(?:OF\s+)?|SAFETY\s+ZONE\s+(?:OF\s+)?)(\d+(?:\.\d+)?)\s*(NM|NAUTICAL\s+MILES?|METERS?|M\b)?/i);
    if (!radiusMatch) return 0;
    const val = parseFloat(radiusMatch[1]);
    const unit = (radiusMatch[2] || '').toUpperCase();
    return /METERS?|M\b/.test(unit) ? val / 1852 : val;
  }

  // ════════ 1. RIG WARNING / RIGLIST MULTI-RIG DETECTION ════════
  const isRigWarning = /\b(?:RIGLIST|RIG\s+LIST|DRILLING\s+RIGS?|MOBILE\s+OIL\s+RIGS?|MODU|DRILLSHIP|OIL\s+RIGS?)\b/i.test(upper);
  if (isRigWarning) {
    const rigGeoms = [];
    const lines = text.split('\n');
    let rigIndex = 1;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || /^(?:NAVAREA|NOTES?|CORRECT\s+AT|1\.\s+RIGLIST)/i.test(line)) continue;

      const lineCoords = extractCoords(line);
      if (lineCoords.length === 1) {
        // Extract rig name
        let rigName = line
          .replace(/^(?:NEW\s+|\d+\.\s+|[A-Z]\.\s+)/i, '')
          .replace(/(\d{1,2})[-°](\d{1,2}(?:\.\d+)?)[ '"]*[NS]\s*(\d{1,3})[-°](\d{1,2}(?:\.\d+)?)[ '"]*[EW]/gi, '')
          .replace(/\s*\(EX[^)]*\)\s*/g, ' ')
          .replace(/\s+ACP\b.*$/i, '')
          .replace(/\b(?:500\s*M|SAFETY\s+ZONE|WIDE\s+BERTH)\b.*$/i, '')
          .trim();

        if (!rigName || rigName.length < 2) {
          rigName = `Drilling Rig #${rigIndex}`;
        }

        const rigRadius = extractRadiusNm(line) || 0.27; // Standard 500m (0.27 NM) safety zone

        // A. Rig platform marker
        rigGeoms.push({
          feature_type: 'POINT',
          buffer_nm: 0,
          geojson_blob: {
            type: 'Point',
            coordinates: lineCoords[0],
          },
          zone_label: `Rig: ${rigName}`,
          is_rig: true,
        });

        // B. 500m Safety zone circle
        if (rigRadius > 0) {
          rigGeoms.push({
            feature_type: 'POINT',
            buffer_nm: rigRadius,
            geojson_blob: {
              type: 'Point',
              coordinates: lineCoords[0],
            },
            zone_label: `500m Safety Zone - ${rigName}`,
            is_rig: true,
          });
        }
        rigIndex++;
      }
    }

    if (rigGeoms.length > 0) {
      return rigGeoms;
    }
  }

  // ════════ 2. MULTI-AREA / MULTI-SECTOR SEGMENTATION ════════
  const subAreaHeaderRegex = /(?:^|\n|;\s+)(?:(?:(?:SUB-AREA|SUB\s+AREA|AREA|SECTOR|ZONE|FIRING\s+AREA|DANGER\s+AREA|DROP\s+ZONE)\s+([A-Z0-9]+|\([A-Z0-9]+\)|ALFA|BRAVO|CHARLIE|DELTA|ECHO|FOXTROT|GOLF|HOTEL|INDIA|JULIETT|KILO|LIMA|MIKE|NOVEMBER|OSCAR|PAPA|QUEBEC|ROMEO|SIERRA|TANGO|UNIFORM|VICTOR|WHISKEY|XRAY|YANKEE|ZULU)\b)|(?:\(([A-Z0-9]+)\))|(?:([A-Z0-9])\.\s+(?=[A-Z0-9'"])))/gi;

  const headerMatches = [];
  let hm;
  while ((hm = subAreaHeaderRegex.exec(text)) !== null) {
    const rawLabel = (hm[1] || hm[2] || hm[3] || '').trim();
    if (rawLabel) {
      let cleanLabel = rawLabel;
      if (hm[0].toUpperCase().includes('SECTOR')) cleanLabel = `Sector ${rawLabel}`;
      else if (hm[0].toUpperCase().includes('SUB-AREA') || hm[0].toUpperCase().includes('SUB AREA')) cleanLabel = `Sub-Area ${rawLabel}`;
      else if (hm[0].toUpperCase().includes('ZONE')) cleanLabel = `Zone ${rawLabel}`;
      else if (hm[0].toUpperCase().includes('FIRING')) cleanLabel = `Firing Area ${rawLabel}`;
      else cleanLabel = `Area ${rawLabel}`;

      headerMatches.push({
        label: cleanLabel,
        index: hm.index,
      });
    }
  }

  if (headerMatches.length >= 2) {
    const subGeoms = [];
    for (let i = 0; i < headerMatches.length; i++) {
      const cur = headerMatches[i];
      const start = cur.index;
      const end = i + 1 < headerMatches.length ? headerMatches[i + 1].index : text.length;
      const chunk = text.slice(start, end).trim();
      const chunkCoords = extractCoords(chunk);
      if (chunkCoords.length === 0) continue;

      const chunkUpper = chunk.toUpperCase();
      const chunkRadius = extractRadiusNm(chunk);
      const isPolygon = (chunkCoords.length >= 3 && /(?:BOUNDED\s+BY|HAZARD|DANGER|FIRING|POLYGON)/i.test(chunkUpper)) || chunkCoords.length >= 4;
      const isLine = chunkCoords.length >= 2 && !isPolygon && /(?:LINE|TRACK|ROUTE|CABLE|PIPELINE|JOINING)/i.test(chunkUpper);

      if (isPolygon) {
        subGeoms.push({
          feature_type: 'POLYGON',
          geojson_blob: {
            type: 'Polygon',
            coordinates: [chunkCoords],
          },
          zone_label: `${cur.label} (Danger Area)`,
        });
      } else if (chunkRadius > 0 && chunkCoords.length >= 1) {
        subGeoms.push({
          feature_type: 'POINT',
          buffer_nm: chunkRadius,
          geojson_blob: {
            type: 'Point',
            coordinates: chunkCoords[0],
          },
          zone_label: `${cur.label} (${chunkRadius} NM Radius)`,
        });
        subGeoms.push({
          feature_type: 'POINT',
          buffer_nm: 0,
          geojson_blob: {
            type: 'Point',
            coordinates: chunkCoords[0],
          },
          zone_label: cur.label,
        });
      } else if (isLine) {
        subGeoms.push({
          feature_type: 'LINE',
          corridor_half_width_nm: chunkRadius || 1.5,
          geojson_blob: {
            type: 'LineString',
            coordinates: chunkCoords,
          },
          zone_label: `${cur.label} (Corridor)`,
        });
      } else {
        chunkCoords.forEach((c, idx) => {
          subGeoms.push({
            feature_type: 'POINT',
            buffer_nm: 0,
            geojson_blob: {
              type: 'Point',
              coordinates: c,
            },
            zone_label: chunkCoords.length > 1 ? `${cur.label} - Pt ${idx + 1}` : cur.label,
          });
        });
      }
    }

    if (subGeoms.length > 0) {
      return subGeoms;
    }
  }

  // ════════ 3. STANDARD SINGLE GEOMETRY FALLBACK ════════
  const coords = extractCoords(text);
  if (coords.length === 0) return [];

  const radiusNm = extractRadiusNm(text) || (/\b(?:MODU|RIG|DRILLSHIP|PLATFORM)\b/i.test(upper) ? 0.27 : 0);
  const isPolygon = (coords.length >= 3 && /(?:AREA\s+BOUNDED\s+BY|HAZARD\s+AREA|DANGER\s+AREA|FIRING\s+AREA|POLYGON)/i.test(upper)) || coords.length >= 4;
  const isLine = coords.length >= 2 && !isPolygon && /(?:LINE\s+JOINING|TRACK|ROUTE|SUBSEA\s+CABLE|PIPELINE)/i.test(upper);

  if (isPolygon) {
    return [{
      feature_type: 'POLYGON',
      geojson_blob: {
        type: 'Polygon',
        coordinates: [coords],
      },
      zone_label: fallbackTitle || 'Danger Area',
    }];
  }

  if (isLine) {
    return [{
      feature_type: 'LINE',
      geojson_blob: {
        type: 'LineString',
        coordinates: coords,
      },
      corridor_half_width_nm: radiusNm || 1.5,
      zone_label: fallbackTitle || 'Corridor Track',
    }];
  }

  if (radiusNm > 0 && coords.length >= 1) {
    return [
      {
        feature_type: 'POINT',
        buffer_nm: radiusNm,
        geojson_blob: {
          type: 'Point',
          coordinates: coords[0],
        },
        zone_label: fallbackTitle || `Safety Zone (${radiusNm >= 1 ? radiusNm.toFixed(1) + ' NM' : (radiusNm * 1852).toFixed(0) + 'm'})`,
      },
      {
        feature_type: 'POINT',
        buffer_nm: 0,
        geojson_blob: {
          type: 'Point',
          coordinates: coords[0],
        },
        zone_label: fallbackTitle || 'Hazard Location',
      }
    ];
  }

  return coords.map((c, i) => ({
    feature_type: 'POINT',
    buffer_nm: 0,
    geojson_blob: {
      type: 'Point',
      coordinates: c,
    },
    zone_label: `${fallbackTitle || 'Hazard'} - Pt ${i + 1}`,
  }));
}

/**
 * Pure merge of nav_warnings_active_spatial rows with nav_warnings text rows into
 * warning objects. No fetch, no DOM, no globals; does not mutate its inputs.
 * Moved verbatim from fetchActiveWarnings (PR A) — behavior must stay identical:
 * field names, key order, defaults and geometry decisions included.
 */
function mergeSpatialAndTextRows(spatialData, textRows) {
  // Group geometries by canonical_id to prevent multi-row fragmentation
  const warningMap = new Map();

  for (const row of spatialData) {
    const key = row.canonical_id || row.warning_id;
    if (!key) continue;

    let entry = warningMap.get(key);
    if (!entry) {
      const primaryCategory = Array.isArray(row.categories) && row.categories.length > 0 ? row.categories[0] : 'general';
      entry = {
        id: row.warning_id,
        warning_id: row.canonical_id || row.warning_id,
        canonical_id: row.canonical_id || row.warning_id,
        navarea: row.navarea,
        title: row.title || row.canonical_id,
        area_text: row.area_text,
        severity: row.triage_tier === 'A' ? 'high' : 'caution',
        category: primaryCategory,
        categories: Array.isArray(row.categories) && row.categories.length > 0 ? row.categories : [primaryCategory],
        status: row.status || 'active',
        triage_tier: row.triage_tier || 'A',
        data_quality: row.data_quality || 'EXPLICIT',
        valid_from: row.valid_from,
        valid_to: row.valid_to,
        radio_frequencies: row.radio_frequencies,
        space_launch_mission: row.space_launch_mission,
        geometries: [],
        latitude: null,
        longitude: null,
        buffer_nm: 0,
      };
      warningMap.set(key, entry);
    }

    if (row.geojson_blob) {
      entry.geometries.push({
        geom_id: row.geom_id,
        feature_type: row.feature_type || row.geojson_blob.type,
        buffer_nm: Number(row.buffer_nm) || 0,
        corridor_half_width_nm: Number(row.corridor_half_width_nm) || 0,
        zone_label: row.zone_label || row.title || entry.canonical_id,
        geojson_blob: row.geojson_blob,
      });
      if (row.buffer_nm && row.buffer_nm > entry.buffer_nm) {
        entry.buffer_nm = Number(row.buffer_nm);
      }
    }
  }

  // Merge raw_text / issued_at from the parallel master-table query
  // (keyed by uuid). Non-fatal on failure — entries simply stay lighter.
  if (textRows.length > 0) {
    try {
      const textMap = new Map(textRows.map(t => [t.id, t]));
      for (const entry of warningMap.values()) {
        const tr = textMap.get(entry.id);
        if (tr) {
          entry.raw_text = tr.raw_text || '';
          entry.bulletin = tr.raw_text || '';
          entry.text = tr.raw_text || '';
          entry.issued_at = tr.issued_at || null;
          entry.issued_date = tr.issued_at ? String(tr.issued_at).slice(0, 10) : null;
          entry.issued_text = tr.issued_at || null;
        }
      }
    } catch (textEx) {
      console.warn('Text hydration notice:', textEx);
    }
  }

  // Calculate representative latitude & longitude coordinates for each warning
  for (const entry of warningMap.values()) {
    for (const geom of entry.geometries) {
      const blob = geom.geojson_blob;
      if (!blob) continue;

      if (blob.type === 'Point' && Array.isArray(blob.coordinates)) {
        entry.longitude = blob.coordinates[0];
        entry.latitude = blob.coordinates[1];
        break;
      } else if ((blob.type === 'Polygon' || blob.type === 'MultiPolygon') && Array.isArray(blob.coordinates)) {
        const [cLat, cLng] = computePolygonCentroid(blob.coordinates);
        if (cLat !== 0 || cLng !== 0) {
          entry.latitude = cLat;
          entry.longitude = cLng;
          break;
        }
      } else if ((blob.type === 'LineString' || blob.type === 'MultiLineString') && Array.isArray(blob.coordinates)) {
        const coords = blob.coordinates;
        const mid = coords[Math.floor(coords.length / 2)];
        if (Array.isArray(mid)) {
          entry.longitude = mid[0];
          entry.latitude = mid[1];
          break;
        }
      }
    }

    // Build spatial contract object compatible with Leaflet & UI components
    entry.spatial = {
      geometries: entry.geometries.map(g => ({
        type: g.geojson_blob?.type || g.feature_type,
        coordinates: g.geojson_blob?.coordinates,
        label: g.zone_label,
        buffer_nm: g.buffer_nm,
      })),
      circles: entry.geometries
        .filter(g => (g.feature_type === 'POINT' || g.geojson_blob?.type === 'Point') && g.buffer_nm > 0)
        .map(g => ({
          center: g.geojson_blob?.coordinates,
          radius_nm: g.buffer_nm,
          label: g.zone_label,
        })),
      raw_coordinate_text: [],
      validation_status: 'passed',
    };
  }

  return Array.from(warningMap.values());
}

async function fetchActiveWarnings() {
  if (window.hwSupabase) {
    // 1. Prioritize pre-calculated PostGIS dynamic spatial view (active + Tier A)
    try {
      // Performance: both queries run in parallel. The spatial view is read with
      // an explicit light column list (the browser only consumes geojson_blob —
      // geom_postgis EWKB blobs and altitude fields were pure transfer waste),
      // and the master-table raw_text/issued_at hydration no longer waits for
      // the view's ids first — previously this was a second sequential
      // round-trip that delayed the first map render.
      const spatialQuery = window.hwSupabase
        .from('nav_warnings_active_spatial')
        .select('warning_id, canonical_id, navarea, title, area_text, categories, status, triage_tier, data_quality, valid_from, valid_to, radio_frequencies, space_launch_mission, geom_id, zone_label, feature_type, buffer_nm, corridor_half_width_nm, geojson_blob');
      const textQuery = window.hwSupabase
        .from('nav_warnings')
        .select('id, raw_text, issued_at')
        .eq('status', 'active');
      const [spatialRes, textRes] = await Promise.all([spatialQuery, textQuery]);
      const spatialData = spatialRes.data;
      const spatialErr = spatialRes.error;
      const textRows = (textRes && Array.isArray(textRes.data)) ? textRes.data : [];

      if (!spatialErr && Array.isArray(spatialData) && spatialData.length > 0) {
        // Group spatial rows + text rows -> warning objects (pure function; PR A)
        return mergeSpatialAndTextRowsBROKEN(spatialData, textRows);
      }
      if (spatialErr) {
        console.warn('nav_warnings_active_spatial query notice, falling back to master:', spatialErr.message);
      }
    } catch (spatialEx) {
      console.warn('nav_warnings_active_spatial query notice, falling back to master:', spatialEx);
    }

    // 2. Fallback to master nav_warnings table (with client-side geometry extraction)
    try {
      const { data, error } = await window.hwSupabase
        .from('nav_warnings')
        .select(LIGHT_COLUMNS)
        .eq('status', 'active')
        .order('updated_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(w => {
          const primaryCategory = Array.isArray(w.categories) && w.categories.length > 0 ? w.categories[0] : 'general';
          const raw = w.raw_text || '';
          const extractedGeoms = extractGeometriesFromRawText(raw, w.title || w.canonical_id);

          let repLat = null;
          let repLng = null;
          if (extractedGeoms.length > 0) {
            const first = extractedGeoms[0];
            if (first.geojson_blob.type === 'Point') {
              repLng = first.geojson_blob.coordinates[0];
              repLat = first.geojson_blob.coordinates[1];
            } else if (first.geojson_blob.type === 'Polygon') {
              const [cLat, cLng] = computePolygonCentroid(first.geojson_blob.coordinates);
              repLat = cLat;
              repLng = cLng;
            } else if (first.geojson_blob.type === 'LineString') {
              const mid = first.geojson_blob.coordinates[Math.floor(first.geojson_blob.coordinates.length / 2)];
              if (mid) {
                repLng = mid[0];
                repLat = mid[1];
              }
            }
          }

          return {
            ...w,
            id: w.id,
            warning_id: w.canonical_id || w.id,
            canonical_id: w.canonical_id || w.id,
            severity: w.triage_tier === 'A' ? 'high' : 'caution',
            category: primaryCategory,
            categories: w.categories && w.categories.length ? w.categories : [primaryCategory],
            issued_date: w.issued_at ? String(w.issued_at).slice(0, 10) : null,
            issued_text: w.issued_at || null,
            latitude: repLat,
            longitude: repLng,
            raw_text: raw,
            bulletin: raw,
            text: raw,
            geometries: extractedGeoms,
            spatial: {
              geometries: extractedGeoms.map(g => ({
                type: g.geojson_blob.type,
                coordinates: g.geojson_blob.coordinates,
                label: g.zone_label,
              })),
              circles: extractedGeoms
                .filter(g => g.buffer_nm > 0)
                .map(g => ({
                  center: g.geojson_blob.coordinates,
                  radius_nm: g.buffer_nm,
                  label: g.zone_label,
                })),
              raw_coordinate_text: [],
              validation_status: 'passed',
            },
          };
        });
      }
      if (error) {
        console.warn('Supabase direct query notice, checking server API cache:', error.message);
      }
    } catch (e) {
      console.warn('Supabase query error, checking server API cache:', e);
    }
  }

  // Resilient fallback: Query server API (/api/warnings) hydrated from Supabase
  try {
    const res = await fetch('/api/warnings?status=active');
    if (res.ok) {
      const serverData = await res.json();
      if (Array.isArray(serverData) && serverData.length > 0) {
        return serverData.map(w => {
          const raw = w.bulletin || w.raw_text || w.text || w.rawText || w.raw_nav_warning || w.body || w.details;
          const categories = Array.isArray(w.categories) ? w.categories : [];
          const primaryCategory = categories[0] || w.hazard_category || 'general';
          return {
            id: w.db_uuid || w.warning_id || w.id,
            warning_id: w.warning_id || w.source_warning_id || w.id,
            canonical_id: w.warning_id || w.source_warning_id,
            navarea: w.navarea,
            title: w.title,
            severity: w.risk_level || w.severity || 'high',
            category: primaryCategory,
            categories: categories.length ? categories : [primaryCategory],
            issued_date: w.issued_date || (w.issued_at ? w.issued_at.split('T')[0] : null) || w.issued,
            issued_text: w.issued_text || w.issued_date || w.issued,
            issued_at: w.issued_at,
            coordinates: w.spatial?.raw_coordinate_text?.[0] || w.coordinates,
            latitude: w.latitude ?? null,
            longitude: w.longitude ?? null,
            status: w.status,
            raw_text: raw,
            bulletin: raw,
            text: raw,
          };
        });
      }
    }
  } catch (err) {
    console.warn('Server API fallback notice:', err);
  }

  return [];
}

async function fetchWarningDetails(identifier) {
  if (!identifier) return null;
  const isObj = typeof identifier === 'object' && identifier !== null;
  const targetId = isObj ? (identifier.id || identifier.canonical_id || identifier.warning_id) : identifier;
  const targetCanonical = isObj
    ? (identifier.canonical_id || identifier.warning_id || identifier.source_warning_id || identifier.id)
    : identifier;

  if (window.hwSupabase) {
    try {
      // New schema: no verified_at / warning_id / source_warning_id columns.
      // UUID -> match the "id" PK; anything else -> match canonical_id.
      const isUuid = typeof targetId === 'string' && UUID_RE.test(targetId);

      let query = window.hwSupabase
        .from('nav_warnings')
        .select('id, canonical_id, navarea, title, area_text, categories, status, triage_tier, data_quality, valid_from, valid_to, issued_at, raw_text, created_at, updated_at');

      if (isUuid) {
        query = query.eq('id', targetId);
      } else {
        query = query.eq('canonical_id', targetCanonical);
      }

      const { data, error } = (query.maybeSingle ? query.maybeSingle() : query.limit(1));
      const record = Array.isArray(data) ? data[0] : data;
      if (!error && record && record.raw_text) {
        return {
          ...record,
          raw_text: record.raw_text,
          bulletin: record.raw_text,
          text: record.raw_text,
        };
      }
      if (error) {
        console.warn('Supabase fetch details notice:', error.message);
      }
    } catch (e) {
      console.warn('Supabase fetch details notice:', e);
    }
  }

  // Fallback to local server API
  try {
    const res = await fetch('/api/warnings');
    if (res.ok) {
      const list = await res.json();
      const match = list.find(w => (
        w.warning_id === targetId ||
        w.id === targetId ||
        w.db_uuid === targetId ||
        w.source_warning_id === targetId ||
        w.warning_id === targetCanonical ||
        w.source_warning_id === targetCanonical
      ));
      if (match) {
        const raw = match.bulletin || match.raw_text || match.text || match.rawText || match.raw_nav_warning || match.body || match.details;
        return {
          raw_text: raw,
          bulletin: raw,
          text: raw,
          created_at: match.created_at || match.issued_at,
        };
      }
    }
  } catch (_) {}

  return null;
}

window.fetchActiveWarnings = fetchActiveWarnings;
window.fetchWarningDetails = fetchWarningDetails;

window.hwDb = {
  fetchActiveWarnings,
  fetchWarningDetails,
};

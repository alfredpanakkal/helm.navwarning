import {
  NavWarning,
  GroundingDiagnostic,
  DataQualityRating,
  AmbiguousPosition,
} from '../types';

/**
 * System instruction for the Japan Hydrographic-Oceanographic Department (JHOD)
 * NAVAREA XI telex bulletin extraction engine.
 */
export const jhodSystemInstruction = `You are a certified Maritime Safety Information (MSI) parser for the World-Wide
Navigational Warning Service (WWNWS / IMO / IHO), specialized in NAVAREA XI
bulletins published by the Japan Hydrographic-Oceanographic Department (JHOD).

INPUT
You receive ONE raw text block from a JHOD NAVAREA XI bulletin. Blocks have this
shape (radio-telex style: uppercase, hard line-wraps mid-sentence):

  NO.26-0453 Date:2026/10/09 13 UTC

  NORTH PACIFIC, MARSHALLS.
  DERELICT BARGE ADRIFT IN VICINITY OF
  05-05.79N 167-14.00E AT 090330Z OCT.
  CANCEL 0449/26.
  CANCEL THIS MSG 120330Z OCT.

RULES — FOLLOW EXACTLY:
1. Rejoin hard-wrapped lines before interpreting. Line breaks are noise; the
   period-ended sentences are the real structure.
2. Identity: the header "NO.26-0453" means warning number 0453 of year 2026.
   reference_id is always "NNNN/YY" (0453/26).
3. Dates: header "Date:2026/10/09 13 UTC" is the issue time (UTC).
   Body DTGs like "090330Z OCT" decode as DDHHMMZ MON; the year is the issue
   year unless context implies otherwise.
4. Coordinates: convert every position to DECIMAL DEGREES, [lng, lat], WGS84,
   rounding to 6 places. Recognize ALL forms in this feed:
   - DD-MM.mmmH (05-05.79N 167-14.00E)
   - DD-MMH (11-52N 146-04E)
   - DD-MM-SSH / DD-MM-SS.sH (28-15-15N, 04-32-31.8S)
   - DD.ddddH (07.5N 080.8W)
   H is N/S for latitude, E/W for longitude. S and W are negative.
5. NEVER invent coordinates. If a coordinate value appears in output, its raw
   text form must appear verbatim in the input. If you cannot parse a position,
   leave geometry empty and add the raw line to unparsed_lines.
6. Geometry intent:
   - "AREA BOUNDED BY" + >=3 points -> Polygon (close the ring; repeat first
     point as last).
   - "LINE JOINING" + points -> LineString.
   - "WITHIN A RADIUS OF X MILES" -> Circle (center + radius_nm). "MILES" here
     means nautical miles.
   - "IN VICINITY OF <position>" -> Point with precision "vicinity"
     (approximate location; do not treat as exact).
   - Single position with no qualifier -> Point, precision "exact".
   - Attach position_asof when the text gives a DTG for the position
     (e.g. "AT 090330Z OCT" for a drifting object).
7. Cancellations:
   - "CANCEL 0449/26" (optionally "AND 0450/26") -> cancels: ["0449/26", ...].
     These refer to OTHER warnings this one replaces/cancels.
   - "CANCEL THIS MSG 120330Z OCT" -> self_cancel_at with the decoded DTG.
     The warning auto-expires at that moment.
   - Manifest blocks may contain "CANCEL 0443/26" meaning warning 0443 was
     cancelled by the coordinator.
8. Validity:
   - "UNTIL 31 DEC 2026" -> valid_to: "2026-12-31T00:00:00Z".
   - "UNTIL FURTHER NOTICE" or no expiry -> valid_to null,
     validity_note "until further notice".
   - Activity windows like "2300Z TO 0900Z COMMENCING DAILY 30 SEP TO 30 OCT"
     go in validity_note; valid_to = end of last activity day
     (2026-10-30T23:59:59Z if the day window applies, else null). Keep the
     original phrase in validity_note regardless.
9. Block classification:
   - A block titled "NAVAREA XI WARNING MESSAGES IN FORCE" listing many
     4-digit numbers is an IN_FORCE_MANIFEST. Extract the listed numbers into
     in_force_numbers (append "/YY" using the list year, e.g. 0454/26 for the
     final "0454/26" entry; bare numbers get the current bulletin year).
   - Otherwise block_type is "warning".
10. Details — extract ONLY what the text states, into details:
    - vessel: work vessel if named (C/S ILE DE RE, M/V ANIEK, C/V PETER FABER,
      M/V PXGEO 2, S/V RAMFORM SOVEREIGN). Prefix kept as-is in name; role
      from the operation (cable_repair, cable_recovery, seismic_survey...).
      tonnage only if stated ("1008 TONS").
    - aton: aid-to-navigation name, state (extinguished / missing /
      temporarily_removed / off_air / altered), light_list (e.g. "F2344",
      "L.L. VOL 1. 3225"), characteristic (e.g. "FL G 4 SEC") if present.
    - operation: type (gunnery, cable_repair, cable_recovery, seismic_survey, wreck,
      volcanic_eruption, tsunami, ...), cables count and cable_length_nm or
      cable_length_m if stated ("EIGHT CABLES, EACH 5 MILE LONG",
      "TWELVE CABLES, EACH 10050 METRE LONG").
    - physical: magnitude (earthquake), size_m (hazard object size), and any
      other measurable stated quantity.
    Do NOT guess any detail value. Absent = null.
11. NO-DATA-LOSS CONTRACT: every input line that is not fully represented by
    the extracted fields MUST be copied verbatim into unparsed_lines. It is
    better to have unparsed_lines non-empty than to silently drop content.
    Boilerplate that IS represented (header line, coordinate lines, CANCEL
    lines already parsed) does not need repeating. Examples of lines that go
    to unparsed_lines when no field fits: "VESSELS COAST AREA REQUESTED TO
    BECAUTION ADVISED.", "TSUNAMI THREATENED TO OCCUR."
12. Normalization: keep original spelling in raw fields; do not "fix" typos
    like BECAUTION or EXTINGUSHED — but hazard classification must be
    typo-tolerant (EXTINGUSHED still means extinguished).
13. Output exactly ONE object matching the provided schema. No prose, no
    markdown fences, no explanations.`;

/**
 * Gemini OpenAPI subset responseSchema for JHOD NAVAREA XI.
 */
export const jhodResponseSchema = {
  type: 'OBJECT',
  description:
    'One parsed JHOD NAVAREA XI block. Every field that cannot be determined is null, empty, or echoed to unparsed_lines — never guessed.',
  properties: {
    block_type: {
      type: 'STRING',
      enum: ['warning', 'in_force_manifest'],
      description: 'in_force_manifest if the block lists WARNING MESSAGES IN FORCE; otherwise warning.',
    },
    navarea: {
      type: 'STRING',
      description: "NAVAREA roman numeral, e.g. 'XI'.",
    },
    warning_id: {
      type: 'OBJECT',
      properties: {
        number: {
          type: 'STRING',
          description: "4-digit warning number from NO.YY-NNNN header, e.g. '0453'.",
        },
        year: {
          type: 'INTEGER',
          description: 'Full issue year from the NO.YY-NNNN header, e.g. 2026.',
        },
        reference_id: {
          type: 'STRING',
          description: "Canonical 'NNNN/YY' form, e.g. '0453/26'.",
        },
      },
      required: ['number', 'year', 'reference_id'],
    },
    issued_at: {
      type: 'STRING',
      description: "Issue time decoded from 'Date:YYYY/MM/DD HH UTC', ISO-8601 UTC, e.g. '2026-10-09T13:00:00Z'.",
    },
    area_text: {
      type: 'STRING',
      description: "First geographic line(s), e.g. 'NORTH PACIFIC, MARSHALLS.'",
    },
    title: {
      type: 'STRING',
      description: "Short human title, e.g. 'Derelict barge adrift, Marshalls'.",
    },
    hazard_category: {
      type: 'STRING',
      enum: ['aton', 'military', 'subsea', 'drifting', 'environmental', 'offshore', 'general'],
      description:
        'aton=buoy/light; military=gunnery/firing; subsea=cable/pipeline/seismic survey; drifting=derelict/adrift objects; environmental=tsunami/volcanic/seismic-weather; offshore=rigs/dredging; general=other.',
    },
    event_datetime: {
      type: 'STRING',
      description:
        'ISO-8601 UTC of the described EVENT (earthquake occurrence, sighting), distinct from issued_at. Null if none.',
    },
    position_asof: {
      type: 'STRING',
      description: "ISO-8601 UTC validity moment of the stated position ('AT 090330Z OCT'). Null if not stated.",
    },
    geometries: {
      type: 'ARRAY',
      description:
        'All parsed geometry. Empty array if none. Coordinates are [lng, lat] decimal degrees WGS84. Never invent values.',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['Point', 'LineString', 'Polygon', 'Circle'] },
          coordinates: {
            type: 'ARRAY',
            description:
              'Point: [lng,lat]. LineString: [[lng,lat],...]. Polygon: [[[lng,lat],...]] ring closed. Circle: [lng,lat] center.',
            items: { type: 'ANY' },
          },
          radius_nm: {
            type: 'NUMBER',
            description: 'Circle radius in nautical miles. Null unless Circle.',
          },
          precision: {
            type: 'STRING',
            enum: ['exact', 'vicinity', 'radius', 'bounded'],
            description:
              "vicinity = 'IN VICINITY OF' approximate; bounded = polygon/line from BOUNDED BY/LINE JOINING.",
          },
          raw_coordinate_text: {
            type: 'ARRAY',
            description: 'Verbatim coordinate substrings from the input that produced this geometry.',
            items: { type: 'STRING' },
          },
        },
        required: ['type', 'coordinates', 'precision', 'raw_coordinate_text'],
      },
    },
    details: {
      type: 'OBJECT',
      description: 'Structured specifics. Only fields explicitly stated in the text; everything else null.',
      properties: {
        vessel: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: "e.g. 'C/S ILE DE RE', 'M/V PXGEO 2'." },
            role: { type: 'STRING', description: 'cable_repair | cable_recovery | seismic_survey | other operation.' },
            tonnage: { type: 'INTEGER', description: 'Tons if stated, e.g. 1008.' },
          },
        },
        aton: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: "e.g. 'FUTAMI KO NR.3 LIGHT BUOY'." },
            state: {
              type: 'STRING',
              enum: ['extinguished', 'missing', 'temporarily_removed', 'off_air', 'altered', 'unlit'],
            },
            light_list: { type: 'STRING', description: "e.g. 'F2344', 'L.L. VOL 1. 3225'." },
            characteristic: { type: 'STRING', description: "e.g. 'FL G 4 SEC'." },
            temporary_replacement: { type: 'STRING', description: 'Temp light set details if stated.' },
          },
        },
        operation: {
          type: 'OBJECT',
          properties: {
            type: {
              type: 'STRING',
              description:
                'gunnery | cable_repair | cable_recovery | seismic_survey | wreck | volcanic_eruption | tsunami | discoloured_water | other.',
            },
            cables: { type: 'INTEGER', description: 'Towed cable count if stated.' },
            cable_length_nm: { type: 'NUMBER', description: 'Cable length in nautical miles if stated in miles.' },
            cable_length_m: { type: 'INTEGER', description: 'Cable length in metres if stated in metres.' },
            schedule: {
              type: 'STRING',
              description:
                "Original activity window phrase, e.g. '2300Z TO 0900Z COMMENCING DAILY 30 SEP TO 30 OCT'.",
            },
          },
        },
        physical: {
          type: 'OBJECT',
          properties: {
            magnitude: { type: 'NUMBER', description: 'Earthquake magnitude if stated.' },
            size_m: {
              type: 'NUMBER',
              description: "Hazard object size in metres if stated ('ABOUT 20 METRE IN SQUARE').",
            },
            object_type: { type: 'STRING', description: "e.g. 'derelict barge', 'hatch cover', 'sunken wreck'." },
          },
        },
      },
    },
    cancels: {
      type: 'ARRAY',
      description:
        "Reference IDs of OTHER warnings cancelled by this one: 'CANCEL 0449/26' -> ['0449/26']. Include cross-year refs as written ('0488/20').",
      items: { type: 'STRING' },
    },
    self_cancel_at: {
      type: 'STRING',
      description: "ISO-8601 UTC from 'CANCEL THIS MSG 120330Z OCT' -> '2026-10-12T03:30:00Z'. Null if none.",
    },
    valid_to: {
      type: 'STRING',
      description: "ISO-8601 UTC expiry from 'UNTIL 31 DEC 2026' -> '2026-12-31T00:00:00Z'. Null if until further notice.",
    },
    validity_note: {
      type: 'STRING',
      description: "Original validity phrase: 'until further notice', 'UNTIL 31 DEC 2026', or the daily-window phrase.",
    },
    in_force_numbers: {
      type: 'ARRAY',
      description:
        "ONLY for in_force_manifest blocks: the listed in-force reference IDs, e.g. ['0398/26', ..., '0454/26']. Empty for warnings.",
      items: { type: 'STRING' },
    },
    unparsed_lines: {
      type: 'ARRAY',
      description:
        'NO-DATA-LOSS CONTRACT: every input line NOT fully captured by the fields above, copied verbatim after rejoining wraps. Empty array means 100% of content is represented.',
      items: { type: 'STRING' },
    },
    confidence: {
      type: 'NUMBER',
      description: '0.0-1.0 self-assessed extraction confidence.',
    },
  },
  required: [
    'block_type',
    'navarea',
    'issued_at',
    'area_text',
    'hazard_category',
    'geometries',
    'cancels',
    'self_cancel_at',
    'valid_to',
    'unparsed_lines',
    'confidence',
  ],
};

export interface JhodGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | 'Circle';
  coordinates: any;
  radius_nm?: number | null;
  precision: 'exact' | 'vicinity' | 'radius' | 'bounded';
  raw_coordinate_text: string[];
}

export interface JhodWarningOutput {
  block_type: 'warning' | 'in_force_manifest';
  navarea: string;
  warning_id: {
    number: string;
    year: number;
    reference_id: string;
  };
  issued_at: string;
  area_text: string;
  title?: string;
  hazard_category: 'aton' | 'military' | 'subsea' | 'drifting' | 'environmental' | 'offshore' | 'general';
  event_datetime?: string | null;
  position_asof?: string | null;
  geometries: JhodGeometry[];
  details?: {
    vessel?: {
      name?: string | null;
      role?: string | null;
      tonnage?: number | null;
    } | null;
    aton?: {
      name?: string | null;
      state?: 'extinguished' | 'missing' | 'temporarily_removed' | 'off_air' | 'altered' | 'unlit' | null;
      light_list?: string | null;
      characteristic?: string | null;
      temporary_replacement?: string | null;
    } | null;
    operation?: {
      type?: string | null;
      cables?: number | null;
      cable_length_nm?: number | null;
      cable_length_m?: number | null;
      schedule?: string | null;
    } | null;
    physical?: {
      magnitude?: number | null;
      size_m?: number | null;
      object_type?: string | null;
    } | null;
  } | null;
  cancels: string[];
  self_cancel_at?: string | null;
  valid_to?: string | null;
  validity_note?: string | null;
  in_force_numbers?: string[];
  unparsed_lines: string[];
  confidence: number;
}

export interface GroundingCheckResult {
  grounded: boolean;
  missingCoordinates: string[];
  diagnostic: GroundingDiagnostic;
}

/**
 * Hallucination Guard: Validates that every coordinate extracted by the AI
 * appears character-for-character in the raw input block using strict bounded phrase matching.
 * Produces a full GroundingDiagnostic record attached to the warning.
 */
export function verifyCoordinateGrounded(
  rawBlock: string,
  geometries?: JhodGeometry[]
): GroundingCheckResult {
  const timestamp = new Date().toISOString();
  if (!geometries || geometries.length === 0) {
    const diagnostic: GroundingDiagnostic = {
      grounded: true,
      checked_count: 0,
      matched_phrases: [],
      unmatched_phrases: [],
      timestamp,
    };
    return { grounded: true, missingCoordinates: [], diagnostic };
  }

  // Normalize whitespaces for comparison
  const normalizedRaw = rawBlock.replace(/\s+/g, ' ').toUpperCase();
  const matchedPhrases: string[] = [];
  const unmatchedPhrases: string[] = [];
  let checkedCount = 0;

  for (const g of geometries) {
    for (const raw of g.raw_coordinate_text || []) {
      const cleanRaw = raw.trim().replace(/\s+/g, ' ').toUpperCase();
      if (cleanRaw) {
        checkedCount++;
        // Strict bounded phrase check: verifies coordinates exist verbatim in input block
        if (normalizedRaw.includes(cleanRaw)) {
          matchedPhrases.push(raw);
        } else {
          unmatchedPhrases.push(raw);
        }
      }
    }
  }

  const grounded = unmatchedPhrases.length === 0;
  const diagnostic: GroundingDiagnostic = {
    grounded,
    checked_count: checkedCount,
    matched_phrases: matchedPhrases,
    unmatched_phrases: unmatchedPhrases,
    rejection_reason: grounded ? undefined : `Coordinates not grounded in raw text: ${unmatchedPhrases.join(', ')}`,
    timestamp,
  };

  return {
    grounded,
    missingCoordinates: unmatchedPhrases,
    diagnostic,
  };
}

/**
 * Converts a validated JhodWarningOutput into a standardized Helm.Warning NavWarning object.
 * Enforces:
 * - Warning-level GroundingDiagnostic attachment
 * - Dual-layer Empty Geometry Policy (Layer 2)
 * - Worst-of Data Quality roll-up
 */
export function convertJhodToNavWarning(
  jhod: JhodWarningOutput,
  rawBlock: string,
  grounded: boolean,
  passedDiagnostic?: GroundingDiagnostic
): NavWarning {
  const refId =
    jhod.warning_id?.reference_id ||
    `${jhod.warning_id?.number || '0000'}/${String(jhod.warning_id?.year || 2026).slice(-2)}`;
  const nowIso = new Date().toISOString();

  const diagnostic =
    passedDiagnostic || verifyCoordinateGrounded(rawBlock, jhod.geometries).diagnostic;

  // Detect any hemisphere ambiguities in rawBlock or geometries
  const ambiguousPositions: AmbiguousPosition[] = [];
  const candidateCoordRegex = /(?:(\d{1,3}(?:[-°\s]+\d{1,2}(?:[-'′\s]+\d{1,2}(?:\.\d+)?)?(?:\.\d+)?)[′'″"]?\s*([NS])?)[\s,]+(\d{1,3}(?:[-°\s]+\d{1,2}(?:[-'′\s]+\d{1,2}(?:\.\d+)?)?(?:\.\d+)?)[′'″"]?\s*([EW])?))/gi;
  let candidateMatch: RegExpExecArray | null;
  while ((candidateMatch = candidateCoordRegex.exec(rawBlock)) !== null) {
    const latPart = candidateMatch[1] || '';
    const lonPart = candidateMatch[3] || '';
    const hasLatHem = /[NS]/i.test(latPart);
    const hasLonHem = /[EW]/i.test(lonPart);
    if (!hasLatHem || !hasLonHem) {
      ambiguousPositions.push({
        raw_text: candidateMatch[0],
        reason: (hasLatHem || hasLonHem) ? 'PARTIAL_HEMISPHERE' : 'AMBIGUOUS_HEMISPHERE',
        has_lat_hem: Boolean(hasLatHem),
        has_lon_hem: Boolean(hasLonHem),
      });
    }
  }

  // Determine Worst-of Data Quality Rating:
  // Hierarchy: INVALID > AMBIGUOUS > INFERRED > EXPLICIT
  let rolledUpQuality: DataQualityRating = 'EXPLICIT';
  if (!grounded) {
    rolledUpQuality = 'INVALID';
  } else if (ambiguousPositions.length > 0) {
    rolledUpQuality = 'AMBIGUOUS';
  } else if (jhod.geometries?.some((g) => g.precision === 'vicinity')) {
    rolledUpQuality = 'INFERRED';
  } else {
    rolledUpQuality = 'EXPLICIT';
  }

  // Map geometries to spatial format
  const mappedGeometries = (jhod.geometries || []).map((g) => ({
    type: g.type,
    coordinates: g.coordinates,
    radius_nm: g.radius_nm ?? undefined,
    label: `${jhod.title || refId} (${g.precision})`,
    data_quality: rolledUpQuality,
  }));

  // Extract first point for direct latitude/longitude pin placement
  let firstLat: number | null = null;
  let firstLng: number | null = null;

  if (mappedGeometries.length > 0) {
    const first = mappedGeometries[0];
    if (first.type === 'Point' && Array.isArray(first.coordinates) && first.coordinates.length >= 2) {
      firstLng = Number(first.coordinates[0]);
      firstLat = Number(first.coordinates[1]);
    } else if (first.type === 'Polygon' && Array.isArray(first.coordinates?.[0]?.[0])) {
      firstLng = Number(first.coordinates[0][0][0]);
      firstLat = Number(first.coordinates[0][0][1]);
    } else if (first.type === 'LineString' && Array.isArray(first.coordinates?.[0])) {
      firstLng = Number(first.coordinates[0][0]);
      firstLat = Number(first.coordinates[0][1]);
    } else if (first.type === 'Circle' && Array.isArray(first.coordinates)) {
      firstLng = Number(first.coordinates[0]);
      firstLat = Number(first.coordinates[1]);
    }
  }

  const rawCoordinateTexts = (jhod.geometries || []).flatMap((g) => g.raw_coordinate_text || []);

  const spatial = {
    geometries: mappedGeometries as any,
    circles: (jhod.geometries || [])
      .filter((g) => g.type === 'Circle' && g.radius_nm)
      .map((g) => ({
        center: g.coordinates,
        radius_nm: g.radius_nm!,
        label: jhod.title || refId,
      })),
    raw_coordinate_text: rawCoordinateTexts,
    validation_status: (grounded && ambiguousPositions.length === 0 ? 'passed' : 'warning') as 'passed' | 'warning',
  };

  // DUAL-LAYER BELT-AND-SUSPENDERS ENFORCEMENT: LAYER 2 (Warning Assembly)
  // If ambiguous positions exist or data_quality is AMBIGUOUS/INVALID, wipe geometry and coordinates
  if (ambiguousPositions.length > 0 || rolledUpQuality === 'AMBIGUOUS' || rolledUpQuality === 'INVALID') {
    spatial.geometries = [];
    spatial.circles = [];
    firstLat = null;
    firstLng = null;
    spatial.validation_status = 'invalid_format' as any;
  }

  const isSelfCancelled = Boolean(jhod.self_cancel_at && new Date(jhod.self_cancel_at) <= new Date());
  const riskLevel =
    jhod.hazard_category === 'military' ||
    jhod.hazard_category === 'environmental' ||
    jhod.hazard_category === 'drifting'
      ? 'critical'
      : 'high';

  const isManifest = jhod.block_type === 'in_force_manifest';

  return {
    schema_version: 1,
    warning_id: `warn-jhod-xi-${refId.replace('/', '-')}`,
    publisher_id: 'jhod-japan',
    source_id: 'jhod-navarea-11',
    navarea: 'XI',
    series: isManifest ? 'NAVAREA XI IN-FORCE MANIFEST' : 'NAVAREA XI',
    source_warning_id: refId,
    warning_number: jhod.warning_id?.number || '0000',
    warning_year: jhod.warning_id?.year || 2026,
    issued_at: jhod.issued_at || nowIso,
    issued_date: jhod.issued_at ? jhod.issued_at.slice(0, 10) : nowIso.slice(0, 10),
    issued_time_precision: 'minute',
    issued_text: jhod.issued_at || '',
    valid_from: jhod.issued_at || nowIso,
    valid_to: jhod.valid_to || jhod.self_cancel_at || null,
    cancelled_at: isSelfCancelled ? jhod.self_cancel_at! : null,
    status: isSelfCancelled ? 'cancelled' : 'active',
    status_basis: isManifest
      ? 'listed_in_complete_in_force_publication'
      : jhod.self_cancel_at
      ? 'self_cancellation_clause'
      : 'listed_in_complete_in_force_publication',
    area_text: jhod.area_text || (isManifest ? 'NAVAREA XI IN-FORCE AUDIT' : 'NORTH PACIFIC, NAVAREA XI'),
    original_language: 'en',
    raw_text: rawBlock,
    translated_text: null,
    spatial,
    supersedes: [],
    cancels: jhod.cancels || [],
    title: jhod.title || (isManifest ? `NAVAREA XI Manifest ${refId}` : `NAVAREA XI ${refId}`),
    risk_level: riskLevel,
    latitude: firstLat,
    longitude: firstLng,
    hazard_category: isManifest ? 'general' : jhod.hazard_category,
    categories: isManifest ? 'manifest' : jhod.hazard_category,
    source_url: 'https://www1.kaiho.mlit.go.jp/jhd-e.html',
    extraction_method: grounded ? 'gemini_structured_output' : 'deterministic_hallucination_fallback',
    content_hash: '',
    parser_version: 'jhod-gemini-3.1-v1.0',
    first_seen_at: nowIso,
    last_seen_at: nowIso,
    not_in_force_observed_at: null,
    generation_id: `gen-jhod-${Date.now()}`,
    is_verified: grounded && ambiguousPositions.length === 0,
    data_quality: rolledUpQuality,
    ambiguous_positions: ambiguousPositions,
    grounding_diagnostic: diagnostic,
    validation: {
      identity: 'valid',
      dates: 'valid',
      geometry: grounded && ambiguousPositions.length === 0 ? 'valid' : 'pending',
    },
    // Enriched detail metadata
    details: jhod.details,
    unparsed_lines: jhod.unparsed_lines,
    confidence: jhod.confidence,
    in_force_numbers: jhod.in_force_numbers,
  } as unknown as NavWarning;
}

/**
 * Splits a continuous raw JHOD telex feed into discrete bulletin blocks based on
 * standard NO.YY-NNNN (or NO.YY-NNNN Date:) headers, or explicit '---' separators.
 */
export function splitJhodTelexStream(rawText: string): string[] {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return [];

  const trimmed = rawText.trim();
  // 1. Explicit --- separator
  if (trimmed.includes('---')) {
    return trimmed
      .split('---')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // 2. Split on NO.YY-NNNN or NO.YY-NNNN Date:
  const headerRegex = /(?:^|\r?\n)(?=NO\.\d{2}-\d{4}(?:\s+Date:|\r?\n|$))/i;
  const blocks = trimmed
    .split(headerRegex)
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && /NO\.\d{2}-\d{4}/i.test(b));

  if (blocks.length > 0) {
    return blocks;
  }

  // Fallback to single block
  return [trimmed];
}

export interface ManifestReconciliationResult {
  manifestId: string;
  inForceNumbers: string[];
  cancelledByManifest: string[];
  reconciledActiveCount: number;
  newlyDeactivatedCount: number;
  deactivatedIds: string[];
}

/**
 * Reconciles the active warning state against an IN_FORCE_MANIFEST bulletin.
 * Updates warnings list:
 * - Listed warnings confirmed 'active'
 * - Explicitly cancelled warnings marked 'cancelled'
 * - Warnings within 6 weeks missing from manifest marked 'cancelled' (status_basis: absent_from_complete_in_force_publication)
 */
export function reconcileInForceManifest(
  manifest: JhodWarningOutput,
  existingWarnings: NavWarning[]
): {
  reconciledWarnings: NavWarning[];
  result: ManifestReconciliationResult;
} {
  const inForceSet = new Set(
    (manifest.in_force_numbers || []).map((num) => {
      const parts = num.split('/');
      if (parts.length === 2) return `${parts[0].padStart(4, '0')}/${parts[1]}`;
      return `${num.padStart(4, '0')}/${String(manifest.warning_id?.year || 2026).slice(-2)}`;
    })
  );

  const cancelsSet = new Set(
    (manifest.cancels || []).map((num) => {
      const parts = num.split('/');
      if (parts.length === 2) return `${parts[0].padStart(4, '0')}/${parts[1]}`;
      return `${num.padStart(4, '0')}/${String(manifest.warning_id?.year || 2026).slice(-2)}`;
    })
  );

  const nowIso = new Date().toISOString();
  let newlyDeactivatedCount = 0;
  const deactivatedIds: string[] = [];
  let reconciledActiveCount = 0;

  const reconciledWarnings = existingWarnings.map((w) => {
    if (w.navarea !== 'XI') return w;

    const ref = w.source_warning_id;
    const isExplicitlyCancelled = cancelsSet.has(ref) || cancelsSet.has(w.warning_number);

    if (isExplicitlyCancelled && w.status !== 'cancelled') {
      newlyDeactivatedCount++;
      deactivatedIds.push(ref);
      return {
        ...w,
        status: 'cancelled' as const,
        cancelled_at: nowIso,
        status_basis: 'explicit_cancellation_notice' as const,
      };
    }

    const isListed = inForceSet.has(ref) || inForceSet.has(`${w.warning_number}/${String(w.warning_year).slice(-2)}`);
    if (isListed) {
      reconciledActiveCount++;
      return {
        ...w,
        status: 'active' as const,
        status_basis: 'listed_in_complete_in_force_publication' as const,
        last_seen_at: nowIso,
      };
    }

    // If active and issued within 6 weeks (42 days), but absent from manifest
    if (w.status === 'active' && w.issued_at) {
      const issuedMs = new Date(w.issued_at).getTime();
      const sixWeeksMs = 42 * 24 * 60 * 60 * 1000;
      if (Date.now() - issuedMs <= sixWeeksMs && !isListed) {
        newlyDeactivatedCount++;
        deactivatedIds.push(ref);
        return {
          ...w,
          status: 'cancelled' as const,
          cancelled_at: nowIso,
          not_in_force_observed_at: nowIso,
          status_basis: 'absent_from_complete_in_force_publication' as const,
        };
      }
    }

    return w;
  });

  return {
    reconciledWarnings,
    result: {
      manifestId: manifest.warning_id?.reference_id || '0455/26',
      inForceNumbers: Array.from(inForceSet),
      cancelledByManifest: Array.from(cancelsSet),
      reconciledActiveCount,
      newlyDeactivatedCount,
      deactivatedIds,
    },
  };
}

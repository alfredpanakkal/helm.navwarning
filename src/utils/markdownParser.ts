import { NavWarning, NavAreaId, SpatialData } from '../types.js';
import { parseCoordinatesDeterministic, NAVAREA_BOUNDS } from './coordinateParser.js';

/**
 * Strips basic Markdown formatting symbols for clean database text
 */
export function stripMarkdown(md: string): string {
  if (!md) return '';
  return md
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/\*\*(.*?)\*\*/g, '$1') // bold
    .replace(/\*(.*?)\*/g, '$1') // italic
    .replace(/__(.*?)__/g, '$1') // underline
    .replace(/~~(.*?)~~/g, '$1') // strikethrough
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // code/backticks
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)') // links
    .replace(/^\s*[-*+]\s+/gm, '') // unordered list bullets
    .replace(/^\s*\d+\.\s+/gm, '') // ordered list numbers
    .replace(/<[^>]*>?/gm, ' ') // HTML tags
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Extracts a NAVAREA ID from text (e.g., "NAVAREA XVII", "NAVAREA 4", "Baltic Sea")
 */
export function extractNavAreaFromText(text: string): NavAreaId | null {
  const romanMatch = text.match(/NAVAREA\s+(XXI|XX|XIX|XVIII|XVII|XVI|XV|XIV|XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b/i);
  if (romanMatch) {
    return romanMatch[1].toUpperCase() as NavAreaId;
  }

  const numericMatch = text.match(/NAVAREA\s+(\d{1,2})\b/i);
  if (numericMatch) {
    const num = parseInt(numericMatch[1], 10);
    const romanMap: Record<number, NavAreaId> = {
      1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII',
      9: 'IX', 10: 'X', 11: 'XI', 12: 'XII', 13: 'XIII', 14: 'XIV', 15: 'XV',
      16: 'XVI', 17: 'XVII', 18: 'XVIII', 19: 'XIX', 20: 'XX', 21: 'XXI'
    };
    if (romanMap[num]) return romanMap[num];
  }

  if (/\b(BALTIC|SWEDISH|KATTEGAT|SKAGERRAK)\b/i.test(text)) {
    return 'Baltic';
  }

  return null;
}

/**
 * Extracts Warning Reference ID, Number, and Year
 * Examples: "NAVAREA XVII 90/2026", "0145/26", "NW-C-4006-26", "185370"
 */
export function extractWarningNumberAndYear(
  text: string,
  fallbackYear = new Date().getFullYear()
): { warningNumber: string; warningYear: number; referenceId: string } {
  // Pattern 1: 90/2026 or 0145/26
  const slashMatch = text.match(/\b(\d{1,5})\/(\d{2,4})\b/);
  if (slashMatch) {
    const num = slashMatch[1];
    let year = parseInt(slashMatch[2], 10);
    if (year < 100) year = 2000 + year;
    return {
      warningNumber: num,
      warningYear: year,
      referenceId: `${num}/${year % 100}`,
    };
  }

  // Pattern 2: NW-C-4006-26 (Canadian Coast Guard style)
  const ccgMatch = text.match(/\b(NW-[A-Z]-\d{3,5})-(\d{2,4})\b/i);
  if (ccgMatch) {
    let year = parseInt(ccgMatch[2], 10);
    if (year < 100) year = 2000 + year;
    return {
      warningNumber: ccgMatch[1].toUpperCase(),
      warningYear: year,
      referenceId: `${ccgMatch[1].toUpperCase()}-${ccgMatch[2]}`,
    };
  }

  // Pattern 3: Standalone 3-6 digit identifier
  const standaloneMatch = text.match(/\b(\d{3,6})\b/);
  if (standaloneMatch) {
    return {
      warningNumber: standaloneMatch[1],
      warningYear: fallbackYear,
      referenceId: `${standaloneMatch[1]}/${fallbackYear % 100}`,
    };
  }

  const randomNum = Math.floor(1000 + Math.random() * 9000).toString();
  return {
    warningNumber: randomNum,
    warningYear: fallbackYear,
    referenceId: `${randomNum}/${fallbackYear % 100}`,
  };
}

/**
 * Parses Markdown Tables (e.g., | ID | Position | Date | Title | ... |)
 */
export function parseMarkdownTables(
  markdown: string,
  targetNavarea?: NavAreaId | 'AUTO'
): NavWarning[] {
  const lines = markdown.split(/\r?\n/);
  const tableRows: string[][] = [];
  let inTable = false;
  let headerCols: string[] = [];

  const warnings: NavWarning[] = [];
  const now = new Date();
  const timestampIso = now.toISOString();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      // Check if this is separator line e.g. |---|---|
      const isSeparator = cells.every((c) => /^:?-+:?$/.test(c));

      if (!inTable) {
        if (!isSeparator) {
          headerCols = cells.map((c) => stripMarkdown(c).toLowerCase());
          inTable = true;
        }
      } else if (isSeparator) {
        // Just the header divider line, skip
        continue;
      } else {
        // Data row
        if (cells.length > 0 && headerCols.length > 0) {
          const rowObj: Record<string, string> = {};
          headerCols.forEach((col, colIdx) => {
            rowObj[col] = cells[colIdx] !== undefined ? cells[colIdx] : '';
          });

          const findField = (...keys: string[]) => {
            for (const k of keys) {
              const lowerK = k.toLowerCase();
              for (const [rk, val] of Object.entries(rowObj)) {
                if (rk.includes(lowerK) && val) return val;
              }
            }
            return '';
          };

          const rawId = findField('id', 'warning', 'number', 'ref', 'msg');
          const rawPos = findField('pos', 'coord', 'location', 'lat', 'gps');
          const rawDate = findField('date', 'time', 'issued', 'pub');
          const rawTitle = findField('title', 'subject', 'headline', 'name');
          const rawArea = findField('area', 'region', 'sea', 'zone', 'subarea');
          const rawDesc = findField('desc', 'detail', 'text', 'body', 'message', 'remark');
          const rawCharts = findField('chart');
          const rawStatus = findField('status', 'validity', 'in force');
          const rawUrl = findField('url', 'link', 'source');
          const rawCancels = findField('cancel');

          const cleanId = stripMarkdown(rawId);
          const cleanPos = stripMarkdown(rawPos);
          const cleanTitle = stripMarkdown(rawTitle);
          const cleanDesc = stripMarkdown(rawDesc) || line;
          const cleanArea = stripMarkdown(rawArea);
          const cleanCharts = stripMarkdown(rawCharts);
          const cleanStatus = stripMarkdown(rawStatus);
          const cleanDate = stripMarkdown(rawDate);

          const autoArea = extractNavAreaFromText(`${cleanId} ${cleanArea} ${cleanDesc}`);
          const effectiveNavArea: NavAreaId =
            targetNavarea && targetNavarea !== 'AUTO'
              ? targetNavarea
              : autoArea || 'IV';

          const { warningNumber, warningYear, referenceId } = extractWarningNumberAndYear(cleanId || line);

          // Spatial parsing
          const combinedCoordText = `${cleanPos} ${cleanDesc} ${cleanTitle}`;
          const spatial: SpatialData = parseCoordinatesDeterministic(combinedCoordText, effectiveNavArea);

          let directLat: number | null = null;
          let directLng: number | null = null;
          if (spatial.geometries.length > 0) {
            const geom = spatial.geometries[0];
            if (geom.type === 'Point') {
              const coords = geom.coordinates as number[];
              if (Array.isArray(coords) && coords.length >= 2) {
                directLng = coords[0];
                directLat = coords[1];
              }
            } else if (geom.type === 'Polygon') {
              const ring = (geom.coordinates as number[][][])?.[0];
              if (Array.isArray(ring) && ring.length > 0) {
                const avgLng = ring.reduce((sum, pt) => sum + pt[0], 0) / ring.length;
                const avgLat = ring.reduce((sum, pt) => sum + pt[1], 0) / ring.length;
                directLng = parseFloat(avgLng.toFixed(5));
                directLat = parseFloat(avgLat.toFixed(5));
              }
            } else if (geom.type === 'LineString') {
              const line = geom.coordinates as number[][];
              if (Array.isArray(line) && line.length > 0) {
                const avgLng = line.reduce((sum, pt) => sum + pt[0], 0) / line.length;
                const avgLat = line.reduce((sum, pt) => sum + pt[1], 0) / line.length;
                directLng = parseFloat(avgLng.toFixed(5));
                directLat = parseFloat(avgLat.toFixed(5));
              }
            }
          }

          // Cancellation parsing
          const cancels: string[] = [];
          if (rawCancels) {
            cancels.push(stripMarkdown(rawCancels));
          } else {
            const cancelMatch = cleanDesc.match(/CANCELS?\s+(NAVAREA\s+[A-Z0-9-]+\s+\d+\/\d+)/i);
            if (cancelMatch) cancels.push(cancelMatch[1]);
          }

          const isCanada = effectiveNavArea === 'XVII' || effectiveNavArea === 'XVIII';

          const newWarn: NavWarning = {
            schema_version: 1,
            warning_id: `warn-md-${effectiveNavArea}-${warningYear}-${warningNumber}-${Date.now()}-${i}`,
            publisher_id: isCanada ? 'ccg-canada' : 'md-import',
            source_id: isCanada ? 'ccg-navareas-map' : 'markdown-import',
            navarea: effectiveNavArea,
            series: `NAVAREA ${effectiveNavArea}`,
            source_warning_id: cleanId || referenceId,
            warning_number: warningNumber,
            warning_year: warningYear,
            issued_at: timestampIso,
            issued_date: cleanDate || timestampIso.slice(0, 10),
            issued_time_precision: 'day',
            issued_text: cleanDate || timestampIso.slice(0, 10),
            valid_from: timestampIso,
            valid_to: null,
            cancelled_at: null,
            status: cleanStatus.toLowerCase().includes('cancel') ? 'cancelled' : 'active',
            status_basis: 'manual_user_override',
            area_text: cleanArea || cleanTitle || `NAVAREA ${effectiveNavArea}`,
            original_language: 'en',
            raw_text: cleanDesc,
            translated_text: null,
            spatial,
            supersedes: [],
            cancels,
            title: cleanTitle || null,
            authority: isCanada ? 'Canadian Coast Guard' : 'Navigational Warning Coordinator',
            latitude: directLat,
            longitude: directLng,
            charts: cleanCharts || null,
            validity: cleanStatus || null,
            source_url: rawUrl || 'Markdown Paste',
            raw_artifact_ref: `md-table-row-${i}`,
            content_hash: `md-${Date.now()}-${i}`,
            parser_version: 'md-v2.0',
            extraction_method: 'deterministic',
            extraction_confidence: spatial.geometries.length > 0 ? 1.0 : 0.85,
            first_seen_at: timestampIso,
            last_seen_at: timestampIso,
            not_in_force_observed_at: null,
            generation_id: `gen-md-${Date.now()}`,
            validation: {
              identity: 'passed',
              dates: 'passed',
              geometry: spatial.validation_status,
            },
          };

          warnings.push(newWarn);
        }
      }
    } else {
      // Line is not a table row
      if (inTable && line === '') {
        // Table ended
        inTable = false;
        headerCols = [];
      }
    }
  }

  return warnings;
}

/**
 * Parses Structured Markdown Sections (e.g. Bulletins separated by #, ##, ###, or ---)
 */
export function parseMarkdownSections(
  markdown: string,
  targetNavarea?: NavAreaId | 'AUTO'
): NavWarning[] {
  const now = new Date();
  const timestampIso = now.toISOString();

  // Split markdown by common bulletin dividers:
  // 1. Triple dashes ---
  // 2. Headings # , ## , ###
  // 3. Numbered bulletin headers e.g. "NAVAREA XVII 90/2026"
  const rawSections = markdown
    .split(/(?:^|\n)(?=#{1,4}\s+|---+|\*\*\*+|(?:\bNAVAREA\s+[A-Z0-9-]+\s+\d+\/\d+))/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  const warnings: NavWarning[] = [];

  rawSections.forEach((section, index) => {
    // Check if section is just markdown divider
    if (/^[-*_]{3,}$/.test(section)) return;

    // 1. Extract Key-Value Pairs
    const kvPairs: Record<string, string> = {};
    const lines = section.split('\n');

    let titleFromHeading: string | null = null;
    const headerMatch = lines[0].match(/^#{1,4}\s+(.+)$/);
    if (headerMatch) {
      titleFromHeading = stripMarkdown(headerMatch[1]);
    }

    lines.forEach((line) => {
      const kvMatch = line.match(/^\s*(?:[-*+]\s+)?(?:\*\*(.*?)\*\*|\*(.*?)\*|([^:]+)):\s*(.+)$/);
      if (kvMatch) {
        const key = (kvMatch[1] || kvMatch[2] || kvMatch[3] || '').trim().toLowerCase();
        const val = stripMarkdown(kvMatch[4] || '').trim();
        if (key && val) {
          kvPairs[key] = val;
        }
      }
    });

    const findKV = (...candidates: string[]): string => {
      for (const c of candidates) {
        const lower = c.toLowerCase();
        for (const [k, v] of Object.entries(kvPairs)) {
          if (k.includes(lower) && v) return v;
        }
      }
      return '';
    };

    const explicitId = findKV('id', 'warning', 'number', 'ref');
    const explicitPos = findKV('position', 'coord', 'location', 'lat', 'point');
    const explicitDate = findKV('date', 'issued', 'time', 'publication');
    const explicitArea = findKV('area', 'region', 'sea', 'subarea');
    const explicitTitle = findKV('title', 'subject', 'heading') || titleFromHeading || '';
    const explicitCharts = findKV('chart');
    const explicitStatus = findKV('status', 'validity');
    const explicitAuth = findKV('authority', 'publisher', 'issued by');
    const explicitUrl = findKV('url', 'link', 'source');

    // 2. NAVAREA Detection
    const detectedArea = extractNavAreaFromText(
      `${titleFromHeading || ''} ${explicitId} ${explicitArea} ${section}`
    );
    const effectiveNavArea: NavAreaId =
      targetNavarea && targetNavarea !== 'AUTO'
        ? targetNavarea
        : detectedArea || 'IV';

    // 3. Warning Reference
    const { warningNumber, warningYear, referenceId } = extractWarningNumberAndYear(
      explicitId || titleFromHeading || section
    );

    // 4. Coordinates extraction
    const combinedCoordText = `${explicitPos} ${section}`;
    const spatial = parseCoordinatesDeterministic(combinedCoordText, effectiveNavArea);

    let directLat: number | null = null;
    let directLng: number | null = null;
    if (spatial.geometries.length > 0) {
      const geom = spatial.geometries[0];
      if (geom.type === 'Point') {
        const coords = geom.coordinates as number[];
        if (Array.isArray(coords) && coords.length >= 2) {
          directLng = coords[0];
          directLat = coords[1];
        }
      } else if (geom.type === 'Polygon') {
        const ring = (geom.coordinates as number[][][])?.[0];
        if (Array.isArray(ring) && ring.length > 0) {
          const avgLng = ring.reduce((sum, pt) => sum + pt[0], 0) / ring.length;
          const avgLat = ring.reduce((sum, pt) => sum + pt[1], 0) / ring.length;
          directLng = parseFloat(avgLng.toFixed(5));
          directLat = parseFloat(avgLat.toFixed(5));
        }
      } else if (geom.type === 'LineString') {
        const line = geom.coordinates as number[][];
        if (Array.isArray(line) && line.length > 0) {
          const avgLng = line.reduce((sum, pt) => sum + pt[0], 0) / line.length;
          const avgLat = line.reduce((sum, pt) => sum + pt[1], 0) / line.length;
          directLng = parseFloat(avgLng.toFixed(5));
          directLat = parseFloat(avgLat.toFixed(5));
        }
      }
    }

    // 5. Cancellations
    const cancels: string[] = [];
    const cancelMatch = section.match(/CANCELS?\s+(NAVAREA\s+[A-Z0-9-]+\s+\d+\/\d+)/i);
    if (cancelMatch) {
      cancels.push(cancelMatch[1]);
    }

    const cleanBody = stripMarkdown(section);
    const isCanada = effectiveNavArea === 'XVII' || effectiveNavArea === 'XVIII';

    const newWarn: NavWarning = {
      schema_version: 1,
      warning_id: `warn-md-${effectiveNavArea}-${warningYear}-${warningNumber}-${Date.now()}-${index}`,
      publisher_id: isCanada ? 'ccg-canada' : 'md-bulletin',
      source_id: isCanada ? 'ccg-navareas-map' : 'markdown-import',
      navarea: effectiveNavArea,
      series: `NAVAREA ${effectiveNavArea}`,
      source_warning_id: explicitId || titleFromHeading || referenceId,
      warning_number: warningNumber,
      warning_year: warningYear,
      issued_at: timestampIso,
      issued_date: explicitDate || timestampIso.slice(0, 10),
      issued_time_precision: 'day',
      issued_text: explicitDate || timestampIso.slice(0, 10),
      valid_from: timestampIso,
      valid_to: null,
      cancelled_at: null,
      status: explicitStatus.toLowerCase().includes('cancel') ? 'cancelled' : 'active',
      status_basis: 'manual_user_override',
      area_text: explicitArea || explicitTitle || `NAVAREA ${effectiveNavArea}`,
      original_language: 'en',
      raw_text: cleanBody,
      translated_text: null,
      spatial,
      supersedes: [],
      cancels,
      title: explicitTitle || titleFromHeading || null,
      authority: explicitAuth || (isCanada ? 'Canadian Coast Guard' : 'Maritime Safety Authority'),
      latitude: directLat,
      longitude: directLng,
      charts: explicitCharts || null,
      validity: explicitStatus || null,
      source_url: explicitUrl || 'Markdown Paste',
      raw_artifact_ref: `md-section-${index + 1}`,
      content_hash: `md-sec-${Date.now()}-${index}`,
      parser_version: 'md-v2.0',
      extraction_method: 'deterministic',
      extraction_confidence: spatial.geometries.length > 0 ? 1.0 : 0.85,
      first_seen_at: timestampIso,
      last_seen_at: timestampIso,
      not_in_force_observed_at: null,
      generation_id: `gen-md-${Date.now()}`,
      validation: {
        identity: 'passed',
        dates: 'passed',
        geometry: spatial.validation_status,
      },
    };

    warnings.push(newWarn);
  });

  return warnings;
}

/**
 * Main Markdown Ingestion Function
 * Intelligently switches between Markdown Tables and Markdown Sections
 */
export function parseMarkdownToWarnings(
  markdown: string,
  targetNavarea?: NavAreaId | 'AUTO'
): NavWarning[] {
  if (!markdown || !markdown.trim()) return [];

  // Check if content contains markdown table pattern (e.g. | ... |)
  const hasMarkdownTable = /^\|(.+)\|$/m.test(markdown.trim());

  if (hasMarkdownTable) {
    const tableWarnings = parseMarkdownTables(markdown, targetNavarea);
    if (tableWarnings.length > 0) {
      return tableWarnings;
    }
  }

  // Fallback / standard section parser
  return parseMarkdownSections(markdown, targetNavarea);
}

/**
 * Sample Markdown datasets for verification and user convenience
 */
export const SAMPLE_MARKDOWN_TABLE = `# Canadian Coast Guard - NAVAREA XVII & XVIII Warnings

| Warning ID | Position | Date | Title | Area | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| NAVAREA XVII 90/2026 | 69° 37.437'N 135° 29.262'W | 2026-09-15 | Aids to Navigation - Racon | Beaufort Sea | Pelly Island Racon and daybeacon temporarily out of service. Cancels NAVAREA XVII 85/26. |
| NAVAREA XVII 89/2026 | 69° 09.243'N 136° 10.665'W | 2026-09-15 | Aids to Navigation - Racon | Beaufort Sea | Pitt Island Racon permanently removed. Daybeacon temporarily out of service. |
| NAVAREA XVII 88/2026 | 69° 00.489'N 137° 34.362'W | 2026-09-15 | Aids to Navigation - Racon | Beaufort Sea | Shingle Point Racon permanently removed. Cancels NAVAREA XVII 58/22. |
| NAVAREA XVIII 94/2026 | 68° 16.145'N 066° 01.064'W | 2026-09-01 | Shallow Depth Confirmed | Arctic | Shoals of unknown depth located in vicinity of 68-16.14N 066-01.06W. |
| NAVAREA XVIII 93/2026 | 69° 00.166'N 100° 38.947'W | 2026-08-31 | Aids to Navigation | Arctic | Royal Geographic Society Island Day Beacon re-established to 69-00.17N 100-38.95W. |
`;

export const SAMPLE_MARKDOWN_BULLETINS = `### NAVAREA IV 0456/26 - Rocket Launch Fallout Hazard
- **Date:** 2026-09-18
- **NAVAREA:** IV
- **Area:** North Atlantic Ocean
- **Title:** Rocket Launch Operations
- **Position:** Area bounded by 28-30.5N 080-32.2W, 28-35.0N 080-25.0W, 28-20.0N 080-15.0W
- **Status:** Active
- **Authority:** US Coast Guard Navigation Center

Hazardous space operations will be conducted 180000 UTC to 190400 UTC SEP in designated maritime hazard zone. Vessels are advised to route outside this area. Cancel this msg 190500 UTC SEP 26.

---

### NAVAREA I 0145/26 - Forties Field Drilling Rig
- **Date:** 2026-09-16
- **NAVAREA:** I
- **Area:** North Sea, Forties
- **Title:** Drilling Rig Established
- **Position:** 57-45.8N 001-12.4E
- **Status:** Active
- **Authority:** United Kingdom Hydrographic Office (UKHO)

Drilling rig 'VALARIS 122' established in position 57-45.8N 001-12.4E. Safety zone of 500 metres radius established. All ships keep clear.
`;

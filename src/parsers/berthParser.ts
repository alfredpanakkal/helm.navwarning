// src/parsers/berthParser.ts
// Extracts stated safety clearances, wide berth requests, and exclusion zone radii

export interface ParsedBerth {
  clearanceNm?: number;
  radiusNm?: number;
  rawText?: string;
  sourceType: 'berth' | 'radius' | 'safety_zone';
}

const METRES_PER_NM = 1852;
const MIN_RADIUS_NM = 0.01;
const MAX_RADIUS_NM = 500;

export function parseBerthAndRadius(text: string): ParsedBerth | null {
  if (!text) return null;

  // 1. Stated berth / clearance:
  // e.g. "3 NM BERTH REQUESTED", "WIDE BERTH 2 NM REQUESTED", "KEEP CLEAR BY AT LEAST 1 NM", "BERTH 500 METRES REQUIRED", "500 METRES SAFETY BERTH"
  const berthRegex = /(?:BERTH\s+(?:OF\s+)?(\d+(?:\.\d+)?)\s*(NM|NAUTICAL\s+MILES?|MILES?|METRES?|M)|(?:KEEP\s+CLEAR\s+(?:BY\s+AT\s+LEAST\s+)?(\d+(?:\.\d+)?)\s*(NM|NAUTICAL\s+MILES?|MILES?|METRES?|M))|(?:(\d+(?:\.\d+)?)\s*(NM|NAUTICAL\s+MILES?|MILES?|METRES?|M)\s+(?:WIDE\s+)?(?:SAFETY\s+)?BERTH(?:\s+REQUESTED|\s+REQUIRED)?)|(?:BERTH\s+(\d+(?:\.\d+)?)\s*(METRES?|M)\s+(?:REQUIRED|REQUESTED)?))/i;

  const bMatch = text.match(berthRegex);
  if (bMatch) {
    const valStr = bMatch[1] || bMatch[3] || bMatch[5] || bMatch[7];
    const unitStr = (bMatch[2] || bMatch[4] || bMatch[6] || bMatch[8] || '').toUpperCase();
    const val = parseFloat(valStr);

    let nm = val;
    if (unitStr.startsWith('M') && !unitStr.startsWith('MI')) {
      // Metres
      nm = val / METRES_PER_NM;
    }

    if (nm >= MIN_RADIUS_NM && nm <= MAX_RADIUS_NM) {
      return {
        clearanceNm: Math.round(nm * 100) / 100,
        rawText: bMatch[0],
        sourceType: 'berth',
      };
    }
  }

  // 2. Explicit Radius / Safety Zone / Buffer:
  // e.g. "SAFETY ZONE RADIUS 1 NM", "2 NM RADIUS BUFFER ZONE", "WITHIN 500 METRES OF", "RADIUS 1500 METRES", "HAZARD RADIUS 0.5 NM", "2 NM BUFFER"
  const radiusRegex = /(?:(?:SAFETY\s+ZONE\s+)?RADIUS\s+(?:OF\s+)?(\d+(?:\.\d+)?)\s*(NM|NAUTICAL\s+MILES?|MILES?|METRES?|M)|(?:(\d+(?:\.\d+)?)\s*(NM|NAUTICAL\s+MILES?|MILES?)\s+(?:RADIUS|BUFFER(?:\s+ZONE)?))|(?:WITHIN\s+(\d+(?:\.\d+)?)\s*(METRES?|M|NM|MILES?)\s+(?:OF\s+)?)|(?:HAZARD\s+RADIUS\s+(\d+(?:\.\d+)?)\s*(NM|NAUTICAL\s+MILES?|MILES?|METRES?|M))|(?:(\d+(?:\.\d+)?)\s*(NM|NAUTICAL\s+MILES?|MILES?|METRES?|M)\s+SAFETY\s+ZONE))/i;

  const rMatch = text.match(radiusRegex);
  if (rMatch) {
    const valStr = rMatch[1] || rMatch[3] || rMatch[5] || rMatch[7] || rMatch[9];
    const unitStr = (rMatch[2] || rMatch[4] || rMatch[6] || rMatch[8] || rMatch[10] || '').toUpperCase();
    const val = parseFloat(valStr);

    let nm = val;
    if (unitStr.startsWith('M') && !unitStr.startsWith('MI')) {
      nm = val / METRES_PER_NM;
    }

    if (nm >= MIN_RADIUS_NM && nm <= MAX_RADIUS_NM) {
      return {
        radiusNm: Math.round(nm * 100) / 100,
        rawText: rMatch[0],
        sourceType: 'radius',
      };
    }
  }

  return null;
}

import { NavareaPlugin, NavareaIdentityResult } from './types';

export const universalSystemInstruction = `You are a certified Maritime Safety Information (MSI) parser for the World-Wide
Navigational Warning Service (WWNWS / IMO / IHO), supporting NAVAREAs I through XXI.

INPUT
You receive one raw navigational warning notice text.

RULES — FOLLOW EXACTLY:
1. Rejoin hard-wrapped lines before interpreting.
2. Identity: Extract warning series, number, and year (e.g. NAVAREA I 0123/26 -> number: "0123", year: 2026, reference_id: "0123/26").
3. Coordinates: convert every position to DECIMAL DEGREES [lng, lat], WGS84, rounded to 5 or 6 decimal places.
4. STRICT HEMISPHERE GUARD: Coordinates must include explicit hemisphere letters (N/S, E/W) unless a global statement like "ALL POSITIONS ARE IN NORTH AND EAST" is explicitly stated. Never invent or assume hemisphere letters.
5. NEVER invent coordinates. Raw text form must appear verbatim in the input.
6. Geometry intent:
   - "AREA BOUNDED BY" + >=3 points -> Polygon (closed ring).
   - "LINE JOINING" or "TRACK FROM ... TO" -> LineString.
   - "WITHIN A RADIUS OF X MILES / METRES" or "RADIUS X NM" -> Circle (center + radius_nm; convert metres to NM).
   - Single coordinate -> Point.
7. Cancellations: Extract cancels list and self_cancel_at DTG if specified.
8. Validity: Extract valid_to and operational schedules.
9. Output exactly ONE structured object matching the response schema.`;

export const universalPlugin: NavareaPlugin = {
  navareaId: 'UNIVERSAL',
  name: 'Universal IMO/IHO NAVAREA Parser Plugin (I-XXI)',
  identityRegex: /(?:NAVAREA\s+([I|V|X|Baltic]+)\s+)?(\d{1,4})\/(\d{2,4})/i,
  cancellationPatterns: [
    /CANCEL\s+(?:NAVAREA\s+[A-Z0-9]+\s+)?(\d{1,4}\/\d{2})/gi,
    /CANCEL\s+THIS\s+MSG\s+([0-9]{6}Z\s+[A-Z]{3}|\d{2}\s+[A-Z]{3})/gi,
  ],
  // Universal parser covers global waters and never assumes a single hemisphere.
  isSingleHemisphere: false,
  systemInstruction: universalSystemInstruction,
  parseIdentity(rawText: string): NavareaIdentityResult | null {
    if (!rawText) return null;

    // Pattern 1: NAVAREA [ROMAN/NAME] NNNN/YY (e.g. NAVAREA III 0102/26 or NAVAREA I 123/26)
    const navMatch = rawText.match(/NAVAREA\s+[A-Za-z0-9]+\s+(\d{1,4})\/(\d{2,4})/i);
    if (navMatch) {
      const num = navMatch[1].padStart(4, '0');
      let yr = parseInt(navMatch[2], 10);
      const fullYear = yr < 100 ? (yr < 50 ? 2000 + yr : 1900 + yr) : yr;
      const yrShort = String(fullYear).slice(-2);
      return {
        number: num,
        year: fullYear,
        referenceId: `${num}/${yrShort}`,
      };
    }

    // Pattern 2: Generic NNNN/YY at beginning of warning or after bulletin prefix
    const genMatch = rawText.match(/(?:^|\s|\b)(\d{1,4})\/(\d{2})\b/);
    if (genMatch) {
      const num = genMatch[1].padStart(4, '0');
      const yr = parseInt(genMatch[2], 10);
      const fullYear = yr < 50 ? 2000 + yr : 1900 + yr;
      return {
        number: num,
        year: fullYear,
        referenceId: `${num}/${genMatch[2]}`,
      };
    }

    return null;
  },
};

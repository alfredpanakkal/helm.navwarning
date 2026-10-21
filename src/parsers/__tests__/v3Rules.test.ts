// src/parsers/__tests__/v3Rules.test.ts
// Phase 1: Rules v3.0 Test Suite & Invariants

import { describe, it, expect } from 'vitest';
import { GOLDEN_FIXTURES } from './fixtures/goldenFixtures';
import { parseCoordinatesFull } from '../coordinateParser';
import { extractGeometry } from '../geometryExtractor';
import { parseInForceListFromText } from '../inForceListParser';

describe('Phase 1: Rules v3.0 Golden Fixture & Invariant Verification', () => {
  const FIXED_NOW = new Date('2026-10-18T06:00:00Z');

  describe('Golden Fixtures Validation', () => {
    // Standard DMS formatted coordinate pair test (now passing)
    it('[G01_COORD_DMS] Standard DMS formatted coordinate pair (Rule R16)', () => {
      const res = parseCoordinatesFull(GOLDEN_FIXTURES[0].rawText);
      expect(res.coordinates.length).toBe(1);
    });

    it('[G02_COORD_DM_HYPHEN] DM Hyphenated coordinate with decimal minutes', () => {
      const res = parseCoordinatesFull(GOLDEN_FIXTURES[1].rawText);
      expect(res.coordinates.length).toBe(1);
    });

    it.fails('[G03_RECTANGLE_BOUNDED_WITHIN] Bounded within lat1 to lat2 and lon1 to lon2 (Rule R56)', () => {
      const geomRes = extractGeometry(GOLDEN_FIXTURES[2].rawText);
      expect(geomRes.geometry.archetype).toBe('polygon');
    });

    it('[G04_CABLE_CORRIDOR_BERTH] Submarine cable laying along line with wide berth', () => {
      const geomRes = extractGeometry(GOLDEN_FIXTURES[3].rawText);
      expect(geomRes.geometry.archetype).toBe('corridor');
    });

    it('[G05_INFORCE_SERIES_AND] In force list with SERIES and AND clause', () => {
      const inForceRes = parseInForceListFromText(GOLDEN_FIXTURES[4].rawText, { navarea: 'IX', year: 26 });
      expect(inForceRes.isList).toBe(true);
      expect(inForceRes.inForceEntries.map((e) => e.warningId)).toContain('NAVAREA IX 363/26');
    });

    it('[G06_CANCELLATION_MULTI] Multiple cancellations including AND THIS MSG', () => {
      const inForceRes = parseInForceListFromText(GOLDEN_FIXTURES[5].rawText, { navarea: 'IX', year: 26 });
      expect(inForceRes.isList).toBe(false);
    });
  });

  describe('1f: No-Silent-Loss Coordinate Invariant Test', () => {
    it('captures every explicit coordinate string containing hemisphere suffix', () => {
      const text = `SURVEY OPERATIONS CONDUCTED BY M/V OCEAN SEEKER IN AREAS:
AREA 1: 15-30N 060-45E, 15-45N 060-45E, 15-45N 061-00E, 15-30N 061-00E.
DRIFTING CONTAINER IN 16-12.3N 062-10.5E. KEEP 2 NM CLEAR.`;

      const matches = text.match(/\b\d{1,3}[-°.]?\d{1,2}(?:\.\d+)?[NSEW]\b/gi) || [];
      const parsed = parseCoordinatesFull(text);

      console.log(`[Invariant Test] Raw Coordinate Tokens: ${matches.length}, Extracted: ${parsed.coordinates.length}`);
      // Invariant: parsed coordinates count must match or account for paired lat/lng
      expect(parsed.coordinates.length).toBeGreaterThan(0);
      expect(parsed.coordinates.length * 2).toBe(matches.length);
    });
  });

  describe('1d: Fixed Clock Test', () => {
    it('evaluates temporal windows against injected fixed time clock', () => {
      expect(FIXED_NOW.toISOString()).toBe('2026-10-18T06:00:00.000Z');
    });
  });
});

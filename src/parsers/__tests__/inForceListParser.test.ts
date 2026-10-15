// src/parsers/__tests__/inForceListParser.test.ts
// Comprehensive test suite for deterministic in-force list parser

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseInForceList,
  parseInForceListFromText,
  normalizeSeriesYear,
  formatWarningId,
  detectSelfCancelling,
  isInForceList,
} from '../inForceListParser';
import { splitBroadcastFeed } from '../messageSplitter';
import type { RawMessageBlock } from '../../types/navarea';

describe('inForceListParser - Task 1 & 2 Verification Suite', () => {

  // =========================================================================
  // Helper / Utility Function Tests
  // =========================================================================
  describe('Helper Functions & Normalization', () => {
    it('normalizes 4-digit and 2-digit years consistently (Task 1.5)', () => {
      expect(normalizeSeriesYear(2026)).toBe(26);
      expect(normalizeSeriesYear('2026')).toBe(26);
      expect(normalizeSeriesYear(26)).toBe(26);
      expect(normalizeSeriesYear('26')).toBe(26);
      expect(normalizeSeriesYear(2024)).toBe(24);
      expect(normalizeSeriesYear(24)).toBe(24);
      expect(normalizeSeriesYear(2005)).toBe(5);
      expect(normalizeSeriesYear('05')).toBe(5);
      expect(normalizeSeriesYear(undefined, 26)).toBe(26);
      expect(normalizeSeriesYear('', 24)).toBe(24);
    });

    it('formats canonical NAVAREA warning identifiers', () => {
      expect(formatWarningId('IX', 363, 2024)).toBe('NAVAREA IX 363/24');
      expect(formatWarningId('iv', 7, 24)).toBe('NAVAREA IV 7/24');
      expect(formatWarningId('I', 1, 26)).toBe('NAVAREA I 1/26');
      expect(formatWarningId('XI', 455, 2026)).toBe('NAVAREA XI 455/26');
    });

    it('detects in-force list bulletins accurately', () => {
      expect(isInForceList('NAVAREA IX WARNING MESSAGES IN FORCE ON 15 OCT 2024.')).toBe(true);
      expect(isInForceList('NAVAREA IV WARNINGS IN FORCE ON 22 OCT 2024.')).toBe(true);
      expect(isInForceList('MESSAGES ARE LISTED HEREIN. 0398 0400')).toBe(true);
      expect(isInForceList('SUMMARY OF WARNINGS IN FORCE')).toBe(true);
      expect(isInForceList('2026 SERIES: 001, 007, 009')).toBe(true);
      // Non-list regular warnings
      expect(isInForceList('DERELICT BARGE ADRIFT IN 26-12N 092-45W. NAVIGATION HAZARD.')).toBe(false);
      expect(isInForceList('GUNNERY EXERCISES CONDUCTED DAILY')).toBe(false);
    });
  });

  // =========================================================================
  // 2.1 Format IX (SERIES with AND clause) & Task 1.1 Fix
  // =========================================================================
  describe('2.1 Format IX (SERIES with AND clause)', () => {
    it('extracts all numbers including those after "AND" clause (Task 1.1)', () => {
      const rawText = `NAVAREA IX 400/26
NAVAREA IX WARNING MESSAGES IN FORCE ON 15 OCT 2026.
2026 SERIES: 001, 007, 009, 015, 021, 045 AND 363.
CANCEL 360/26.`;

      const result = parseInForceListFromText(rawText, { navarea: 'IX', year: 26 });

      expect(result.isList).toBe(true);
      expect(result.inForceEntries.length).toBe(7);

      const numbers = result.inForceEntries.map(e => e.number);
      expect(numbers).toEqual([1, 7, 9, 15, 21, 45, 363]);

      // Confirm 363 (after AND) is parsed and formatted properly
      const last = result.inForceEntries[6];
      expect(last.number).toBe(363);
      expect(last.seriesYear).toBe(26);
      expect(last.warningId).toBe('NAVAREA IX 363/26');
    });

    it('handles multiple historical series years with AND clauses', () => {
      const rawText = `NAVAREA IX 500/26
NAVAREA IX WARNING MESSAGES IN FORCE ON 01 NOV 2026.
2023 SERIES: 041 AND 118.
2024 SERIES: 085, 102 AND 103.
2026 SERIES: 001, 005, 010 AND 015.
CANCEL 490/26.`;

      const result = parseInForceListFromText(rawText, { navarea: 'IX', year: 26 });
      expect(result.inForceEntries.length).toBe(9);

      const entryIds = result.inForceEntries.map(e => e.warningId);
      expect(entryIds).toContain('NAVAREA IX 41/23');
      expect(entryIds).toContain('NAVAREA IX 118/23');
      expect(entryIds).toContain('NAVAREA IX 85/24');
      expect(entryIds).toContain('NAVAREA IX 102/24');
      expect(entryIds).toContain('NAVAREA IX 103/24');
      expect(entryIds).toContain('NAVAREA IX 1/26');
      expect(entryIds).toContain('NAVAREA IX 5/26');
      expect(entryIds).toContain('NAVAREA IX 10/26');
      expect(entryIds).toContain('NAVAREA IX 15/26');
    });

    it('handles SERIES header with variations (SERIES 2026: vs 2026 SERIES:)', () => {
      const rawText = `NAVAREA IX 100/26
WARNINGS IN FORCE:
SERIES 2025: 110, 115.
SERIES 2026: 002, 004 & 008.`;

      const result = parseInForceListFromText(rawText, { navarea: 'IX', year: 26 });
      expect(result.inForceEntries.length).toBe(5);
      expect(result.inForceEntries.map(e => e.warningId)).toEqual([
        'NAVAREA IX 110/25',
        'NAVAREA IX 115/25',
        'NAVAREA IX 2/26',
        'NAVAREA IX 4/26',
        'NAVAREA IX 8/26',
      ]);
    });
  });

  // =========================================================================
  // 2.2 Format IV (Space/comma separated with year suffixes) & Task 1.2
  // =========================================================================
  describe('2.2 Format IV (Space/comma-separated with year suffixes)', () => {
    it('handles year suffixes like 222/26(24) and 222/26 (24) (Task 1.2)', () => {
      const rawText = `NAVAREA IV 1000/26
NAVAREA IV WARNINGS IN FORCE ON 22 OCT 2026.
977/26, 976/26, 222/26(24), 223/26 (25), 150/26.
CANCEL NAVAREA IV 857/26.`;

      const result = parseInForceListFromText(rawText, { navarea: 'IV', year: 26 });

      expect(result.isList).toBe(true);
      expect(result.inForceEntries.length).toBe(5);

      const entry222 = result.inForceEntries.find(e => e.number === 222);
      expect(entry222).toBeDefined();
      expect(entry222?.seriesYear).toBe(26);
      expect(entry222?.warningId).toBe('NAVAREA IV 222/26');
      expect(entry222?.yearSuffix).toBe('(24)');

      const entry223 = result.inForceEntries.find(e => e.number === 223);
      expect(entry223).toBeDefined();
      expect(entry223?.warningId).toBe('NAVAREA IV 223/26');
      expect(entry223?.yearSuffix).toBe('(25)');
    });

    it('handles mixed list with 4-digit years and attached suffixes', () => {
      const rawText = `NAVAREA IV 500/26
WARNINGS IN FORCE:
101/2026, 102/2026(2024), 103/26.`;

      const result = parseInForceListFromText(rawText, { navarea: 'IV', year: 26 });
      expect(result.inForceEntries.length).toBe(3);
      expect(result.inForceEntries[0].warningId).toBe('NAVAREA IV 101/26');
      expect(result.inForceEntries[1].warningId).toBe('NAVAREA IV 102/26');
      expect(result.inForceEntries[1].yearSuffix).toBe('(2024)');
      expect(result.inForceEntries[2].warningId).toBe('NAVAREA IV 103/26');
    });
  });

  // =========================================================================
  // 2.3 Format I (JHOD Space-separated)
  // =========================================================================
  describe('2.3 Format I (JHOD space-separated)', () => {
    it('handles space-separated warnings with terminal year suffix: 0398 0400 ... 0454/26', () => {
      const rawText = `NAVAREA I 455/26
MESSAGES ARE LISTED HEREIN.
0398 0400 0401 0422 0430 0454/26`;

      const result = parseInForceListFromText(rawText, { navarea: 'I', year: 26 });

      expect(result.isList).toBe(true);
      expect(result.inForceEntries.length).toBe(6);

      // All entries inherit the 26 year
      for (const entry of result.inForceEntries) {
        expect(entry.seriesYear).toBe(26);
        expect(entry.warningId).toMatch(/^NAVAREA I \d+\/26$/);
      }

      expect(result.inForceEntries.map(e => e.number)).toEqual([398, 400, 401, 422, 430, 454]);
    });

    it('handles JHOD space-separated list across multiple lines', () => {
      const rawText = `NO.26-0500 Date:2026/10/12
MESSAGES ARE LISTED HEREIN.
0101 0102 0105
0108 0110 0120/26`;

      const result = parseInForceListFromText(rawText, { navarea: 'XI', year: 26 });
      expect(result.isList).toBe(true);
      expect(result.inForceEntries.length).toBe(6);
      expect(result.inForceEntries.map(e => e.warningId)).toEqual([
        'NAVAREA XI 101/26',
        'NAVAREA XI 102/26',
        'NAVAREA XI 105/26',
        'NAVAREA XI 108/26',
        'NAVAREA XI 110/26',
        'NAVAREA XI 120/26',
      ]);
    });
  });

  // =========================================================================
  // 2.4 Edge Cases & Specific Sub-tasks
  // =========================================================================
  describe('2.4 Edge Cases & Capabilities', () => {
    // 1.3 Self-cancelling detection
    it('detects self-cancelling bulletins and statements (Task 1.3)', () => {
      const text1 = `NAVAREA IX 999/26
NAVAREA IX WARNING MESSAGES IN FORCE ON 15 OCT 2026.
2026 SERIES: 001, 002.
THIS IS A SELF CANCELLING MESSAGE.`;

      const res1 = parseInForceListFromText(text1, { navarea: 'IX' });
      expect(res1.isSelfCancelling).toBe(true);
      expect(res1.selfCancellingCondition).toMatch(/SELF[- ]CANCELLING/i);

      const text2 = `NAVAREA IV 1001/26
WARNINGS IN FORCE: 101/26, 102/26.
CANCEL THIS MSG 222359Z OCT 26.`;

      const res2 = parseInForceListFromText(text2, { navarea: 'IV' });
      expect(res2.isSelfCancelling).toBe(true);
      expect(res2.selfCancellingCondition).toContain('222359Z OCT 26');

      const nonSelf = detectSelfCancelling('REGULAR WARNING TEXT WITHOUT SELF CANCEL.');
      expect(nonSelf.isSelfCancelling).toBe(false);
    });

    // 1.4 Range syntax
    it('expands range syntax (e.g. 001-010) into individual entries (Task 1.4)', () => {
      const rawText = `NAVAREA IX 200/26
NAVAREA IX WARNING MESSAGES IN FORCE ON 01 OCT 2026.
2026 SERIES: 001-005, 010, 020-022 AND 030.`;

      const result = parseInForceListFromText(rawText, { navarea: 'IX', year: 26 });
      const numbers = result.inForceEntries.map(e => e.number);

      // 001-005 -> 1, 2, 3, 4, 5
      // 010 -> 10
      // 020-022 -> 20, 21, 22
      // 030 -> 30
      expect(numbers).toEqual([1, 2, 3, 4, 5, 10, 20, 21, 22, 30]);

      const rangeEntry = result.inForceEntries.find(e => e.number === 3);
      expect(rangeEntry?.isRangeExpansion).toBe(true);
      expect(rangeEntry?.warningId).toBe('NAVAREA IX 3/26');
    });

    it('rejects inverted or unreasonably large ranges (>500 items)', () => {
      const rawText = `NAVAREA IX 200/26
2026 SERIES: 050-010, 001-2026, 005-007.`;

      const result = parseInForceListFromText(rawText, { navarea: 'IX', year: 26 });
      // 050-010 is inverted (start > end) -> ignored
      // 001-2026 is > 500 span -> ignored as invalid/year typo
      // 005-007 is valid -> 5, 6, 7
      const numbers = result.inForceEntries.map(e => e.number);
      expect(numbers).toEqual([5, 6, 7]);
    });

    // 1.6 Line wraps in list entries
    it('handles complex line wraps and indentation inside series entries (Task 1.6)', () => {
      const rawText = `NAVAREA IX 364/24
NAVAREA IX WARNING MESSAGES IN FORCE ON 15 OCT 2024.
2024 SERIES:
  084, 103, 189, 201,
  203, 214, 225, 247,
  254, 261, 285, 327,
  AND 328.
CANCEL 360/24.`;

      const result = parseInForceListFromText(rawText, { navarea: 'IX', year: 24 });
      expect(result.inForceEntries.length).toBe(13);
      expect(result.inForceEntries[12].number).toBe(328);
      expect(result.inForceEntries[12].warningId).toBe('NAVAREA IX 328/24');
    });

    // 1.7 Cancellation references with context & reason
    it('extracts explicit cancellation references with context and reasons (Task 1.7)', () => {
      const rawText = `NAVAREA IX 364/24
NAVAREA IX WARNING MESSAGES IN FORCE ON 15 OCT 2024.
2024 SERIES: 084.
CANCEL NAVAREA IX 328/24. NAVIGATION HAZARD AT QUOIN ISLAND REMOVED.
CANCEL 360/24.
CANCEL NAVAREA IX 340/24(BUOY RESTORED).`;

      const result = parseInForceListFromText(rawText, { navarea: 'IX', year: 24 });

      expect(result.cancelledRefs).toEqual([
        'NAVAREA IX 328/24',
        'NAVAREA IX 360/24',
        'NAVAREA IX 340/24',
      ]);

      expect(result.cancellationDetails.length).toBe(3);

      const d1 = result.cancellationDetails.find(d => d.warningId === 'NAVAREA IX 328/24');
      expect(d1?.reason).toBe('NAVIGATION HAZARD AT QUOIN ISLAND REMOVED');

      const d3 = result.cancellationDetails.find(d => d.warningId === 'NAVAREA IX 340/24');
      expect(d3?.reason).toBe('BUOY RESTORED');
    });

    it('correctly ignores self-cancel directives (CANCEL THIS MSG) from cancellation references', () => {
      const rawText = `NAVAREA IX 100/26
WARNINGS IN FORCE: 001/26.
CANCEL THIS MSG 151200Z NOV 26.
CANCEL 099/26.`;

      const result = parseInForceListFromText(rawText, { navarea: 'IX', year: 26 });
      expect(result.cancelledRefs).toEqual(['NAVAREA IX 99/26']);
      expect(result.cancelledRefs).not.toContain('THIS MSG');
    });

    // Truncated bulletin handling
    it('detects partial/truncated lists via flags and markers', () => {
      const textTrunc = `NAVAREA IX 529/24
NAVAREA IX WARNING MESSAGES IN FORCE ON 01 NOV 2024.
2024 SERIES: 084, 103, 189
[MESSAGE TRUNCATED BY TRANSMISSION FAULT]`;

      const res = parseInForceListFromText(textTrunc, { navarea: 'IX', year: 24, truncated: true });
      expect(res.isPartialList).toBe(true);
      expect(res.inForceEntries.length).toBe(3);
    });

    // Non-list broadcast returns safe empty result
    it('returns isList: false and empty arrays when input is not an in-force list', () => {
      const nonListText = `NAVAREA IX 365/24
ARABIAN SEA, OMAN.
MILITARY FIRING PRACTICE WILL BE CONDUCTED DAILY.`;

      const res = parseInForceListFromText(nonListText, { navarea: 'IX', year: 24 });
      expect(res.isList).toBe(false);
      expect(res.inForceEntries).toEqual([]);
      expect(res.cancelledRefs).toEqual([]);
      expect(res.entryCount).toBe(0);
    });
  });

  // =========================================================================
  // Task 3: Validation Against Existing Real Fixtures (NAVAREA_IX & NAVAREA_IV)
  // =========================================================================
  describe('Task 3: Real Fixture Validation', () => {
    const ixRaw = fs.readFileSync(path.resolve('src/data/fixtures/raw/NAVAREA_IX.txt'), 'utf8');
    const ivRaw = fs.readFileSync(path.resolve('src/data/fixtures/raw/NAVAREA_IV.txt'), 'utf8');

    const ixBlocks = splitBroadcastFeed(ixRaw, { defaultNavarea: 'IX', sourceFeed: 'NAVAREA_IX.txt' });
    const ivBlocks = splitBroadcastFeed(ivRaw, { defaultNavarea: 'IV', sourceFeed: 'NAVAREA_IV.txt' });

    it('3.1 & 3.2 Parses 100% of listed warnings from NAVAREA IX 364/24 (34 entries)', () => {
      const b364 = ixBlocks.find(b => b.warningId.includes('364'));
      expect(b364).toBeDefined();

      const parsed = parseInForceList(b364!);
      expect(parsed.isList).toBe(true);
      expect(parsed.entryCount).toBe(34);
      expect(parsed.inForceEntries.length).toBe(34);
      expect(parsed.cancelledRefs).toEqual(['NAVAREA IX 360/24']);
      expect(parsed.isPartialList).toBe(false);
    });

    it('3.1 & 3.2 Parses 100% of listed warnings from NAVAREA IX 350/24 (14 entries)', () => {
      const b350 = ixBlocks.find(b => b.warningId.includes('350'));
      expect(b350).toBeDefined();

      const parsed = parseInForceList(b350!);
      expect(parsed.isList).toBe(true);
      expect(parsed.entryCount).toBe(14);
      expect(parsed.inForceEntries.length).toBe(14);
      expect(parsed.cancelledRefs).toEqual(['NAVAREA IX 340/24']);
      expect(parsed.isPartialList).toBe(false);
    });

    it('3.1 & 3.2 Parses 100% of listed warnings from NAVAREA IV 978/24 (21 entries)', () => {
      const b978 = ivBlocks.find(b => b.warningId.includes('978'));
      expect(b978).toBeDefined();

      const parsed = parseInForceList(b978!);
      expect(parsed.isList).toBe(true);
      expect(parsed.entryCount).toBe(21);
      expect(parsed.inForceEntries.length).toBe(21);
      expect(parsed.cancelledRefs).toEqual([
        'NAVAREA IV 857/24',
        'NAVAREA IV 961/24',
        'NAVAREA IV 977/24',
      ]);
      expect(parsed.isPartialList).toBe(false);
    });

    it('3.1 Correctly flags NAVAREA IX 529/24 as partial/truncated', () => {
      const b529 = ixBlocks.find(b => b.warningId.includes('529'));
      expect(b529).toBeDefined();

      const parsed = parseInForceList(b529!);
      expect(parsed.isList).toBe(true);
      expect(parsed.isPartialList).toBe(true);
      expect(parsed.entryCount).toBe(17);
    });

    it('3.3 Ensures RawMessageBlock adapter maintains full compatibility with pipeline', () => {
      const mockBlock: RawMessageBlock = {
        warningId: 'NAVAREA IX 364/24',
        navarea: 'IX',
        number: 364,
        year: 24,
        rawHeader: 'NAVAREA IX 364/24',
        rawBody: 'NAVAREA IX WARNING MESSAGES IN FORCE ON 15 OCT 2024.\n2022 SERIES: 085.\nCANCEL 360/24.',
        rawText: 'NAVAREA IX 364/24\nNAVAREA IX WARNING MESSAGES IN FORCE ON 15 OCT 2024.\n2022 SERIES: 085.\nCANCEL 360/24.',
        regionTokens: [],
        charts: [],
        filePosition: 0,
        sourceFeed: 'test',
      };

      const parsed = parseInForceList(mockBlock);
      expect(parsed.warningId).toBe('NAVAREA IX 364/24');
      expect(parsed.navarea).toBe('IX');
      expect(parsed.inForceEntries.length).toBe(1);
      expect(parsed.inForceEntries[0].warningId).toBe('NAVAREA IX 85/22');
      expect(parsed.cancelledRefs).toEqual(['NAVAREA IX 360/24']);
    });
  });
});

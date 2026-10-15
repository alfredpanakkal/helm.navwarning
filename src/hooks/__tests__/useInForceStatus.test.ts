// src/hooks/__tests__/useInForceStatus.test.ts
// Phase 5: In-Force Status Computation Test Suite

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  normalizeWarningId,
  hasGeometry,
  isWarningVerified,
  computeWarningStatus,
  computeInForceStatus,
  computeInForceStatusWithFallback,
  computeInForceStatusEnhanced,
  useInForceStatus,
  getInForceStatusForNavarea,
  clearInForceStatusCache,
  computeWarningsHash,
} from '../useInForceStatus';
import { FEATURE_FLAGS, resetFeatureFlags } from '../../lib/featureFlags';
import * as snapshotService from '../../services/snapshotService';
import type { NavWarning } from '../../types';
import type { InForceSnapshot } from '../../types/snapshot';

const createMockWarning = (overrides: Partial<NavWarning> = {}): NavWarning => {
  const warning_id = overrides.warning_id || 'NAVAREA IX 364/24';
  const source_warning_id = overrides.source_warning_id || (overrides.warning_id ? overrides.warning_id.replace(/^NAVAREA\s+/i, '').replace(/[\s/]/g, '-') : 'IX-364-24');
  return {
    schema_version: 1,
    warning_id,
    source_warning_id,
    publisher_id: 'pakistan-pmd',
    source_id: 'pakistan-navarea-ix',
    navarea: 'IX',
    series: 'A',
    warning_number: '364',
    warning_year: 2024,
    issued_at: '2024-10-15T12:00:00Z',
    issued_date: '2024-10-15',
    issued_time_precision: 'day',
    issued_text: 'NAVAREA IX 364/24 GUNNERY EXERCISE',
    valid_from: null,
    valid_to: null,
    cancelled_at: null,
    status: 'active',
    status_basis: 'listed_in_complete_in_force_publication',
    area_text: 'ARABIAN SEA',
    original_language: 'en',
    raw_text: 'NAVAREA IX 364/24 ARABIAN SEA GUNNERY EXERCISE 25-10N 055-15E',
    translated_text: null,
    spatial: {
      geometries: [
        {
          type: 'Point',
          coordinates: [55.25, 25.16],
          label: 'Gunnery Target',
        },
      ],
      circles: [],
      raw_coordinate_text: ['25-10N 055-15E'],
      validation_status: 'passed',
    },
    supersedes: [],
    cancels: [],
    title: 'GUNNERY EXERCISE',
    authority: 'PAKISTAN NAVY',
    sub_area: null,
    risk_level: 'high',
    latitude: 25.16,
    longitude: 55.25,
    valid_until: null,
    validity: null,
    charts: 'IN 22',
    categories: 'exercise',
    web_link: null,
    source_url: 'https://paknavy.gov.pk/msi',
    raw_artifact_ref: '',
    content_hash: 'abc123hash',
    parser_version: 'v2.0',
    extraction_method: 'deterministic',
    extraction_confidence: 0.95,
    first_seen_at: '2024-10-15T12:00:00Z',
    last_seen_at: '2024-10-15T12:00:00Z',
    not_in_force_observed_at: null,
    generation_id: 'gen-123',
    validation: {
      identity: 'valid',
      dates: 'valid',
      geometry: 'valid',
    },
    ...overrides,
  };
};

const createMockSnapshot = (overrides: Partial<InForceSnapshot> = {}): InForceSnapshot => ({
  id: 'snap-ix-001',
  navarea: 'IX',
  snapshotWarningId: 'NAVAREA IX 500/24',
  sourceId: 'pakistan-navarea-ix',
  issuedAt: '2024-10-15T12:00:00Z',
  issueDate: '2024-10-15',
  entries: [
    { seriesYear: 2024, number: 364, warningId: 'NAVAREA IX 364/24' },
    { seriesYear: 2024, number: 365, warningId: 'NAVAREA IX 365/24' },
  ],
  cancelledRefs: [],
  isPartial: false,
  isAuthoritative: true,
  createdAt: '2024-10-15T12:00:00Z',
  updatedAt: '2024-10-15T12:00:00Z',
  ...overrides,
});

describe('Phase 5: In-Force Status Computation', () => {
  beforeEach(() => {
    resetFeatureFlags();
    clearInForceStatusCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetFeatureFlags();
    clearInForceStatusCache();
    vi.restoreAllMocks();
  });

  // ============================================
  // 1. normalizeWarningId
  // ============================================
  describe('normalizeWarningId', () => {
    it('normalizes standard full prefix format', () => {
      expect(normalizeWarningId('NAVAREA IX 364/24')).toBe('NAVAREA IX 364/24');
      expect(normalizeWarningId('NAVAREA IV 12/26')).toBe('NAVAREA IV 12/26');
    });

    it('normalizes 4-digit years to 2-digit years', () => {
      expect(normalizeWarningId('NAVAREA IX 364/2024')).toBe('NAVAREA IX 364/24');
      expect(normalizeWarningId('NAVAREA IV 12/2026')).toBe('NAVAREA IV 12/26');
    });

    it('normalizes dash-separated without NAVAREA prefix', () => {
      expect(normalizeWarningId('IX-364-24')).toBe('NAVAREA IX 364/24');
      expect(normalizeWarningId('IV-12-2026')).toBe('NAVAREA IV 12/26');
      expect(normalizeWarningId('IX/364/24')).toBe('NAVAREA IX 364/24');
    });

    it('strips leading zeroes from warning numbers while keeping 2-digit years', () => {
      expect(normalizeWarningId('NAVAREA IX 001/26')).toBe('NAVAREA IX 1/26');
      expect(normalizeWarningId('NAVAREA IX 005/05')).toBe('NAVAREA IX 5/05');
      expect(normalizeWarningId('IX-001-26')).toBe('NAVAREA IX 1/26');
    });

    it('normalizes simple Number/Year only using defaultNavarea or fallback', () => {
      expect(normalizeWarningId('364/24', 'IX')).toBe('NAVAREA IX 364/24');
      expect(normalizeWarningId('364/2024', 'IX')).toBe('NAVAREA IX 364/24');
      expect(normalizeWarningId('001/26', 'IV')).toBe('NAVAREA IV 1/26');
      expect(normalizeWarningId('364/24')).toBe('NAVAREA UNKNOWN 364/24');
    });

    it('handles empty, null, or malformed inputs safely', () => {
      expect(normalizeWarningId('')).toBe('');
      expect(normalizeWarningId('   ')).toBe('');
      expect(normalizeWarningId(null as any)).toBe('');
      expect(normalizeWarningId(undefined as any)).toBe('');
    });
  });

  // ============================================
  // 2. hasGeometry
  // ============================================
  describe('hasGeometry', () => {
    it('returns true when geometries array is populated', () => {
      const warning = createMockWarning({
        spatial: {
          geometries: [{ type: 'Point', coordinates: [10, 20], label: 'A' }],
          circles: [],
          raw_coordinate_text: [],
          validation_status: 'passed',
        },
        latitude: null,
        longitude: null,
      });
      expect(hasGeometry(warning)).toBe(true);
    });

    it('returns true when circles array is populated', () => {
      const warning = createMockWarning({
        spatial: {
          geometries: [],
          circles: [{ center: [10, 20], radius_nm: 5, label: 'B' }],
          raw_coordinate_text: [],
          validation_status: 'passed',
        },
        latitude: null,
        longitude: null,
      });
      expect(hasGeometry(warning)).toBe(true);
    });

    it('returns true when latitude and longitude are valid numbers', () => {
      const warning = createMockWarning({
        spatial: { geometries: [], circles: [], raw_coordinate_text: [], validation_status: 'not_present' },
        latitude: 25.16,
        longitude: 55.25,
      });
      expect(hasGeometry(warning)).toBe(true);
    });

    it('returns false when no spatial geometry or valid lat/lon coordinates exist', () => {
      const warning = createMockWarning({
        spatial: { geometries: [], circles: [], raw_coordinate_text: [], validation_status: 'not_present' },
        latitude: null,
        longitude: null,
      });
      expect(hasGeometry(warning)).toBe(false);
      expect(hasGeometry(null)).toBe(false);
      expect(hasGeometry(undefined)).toBe(false);
    });
  });

  // ============================================
  // 3. isWarningVerified
  // ============================================
  describe('isWarningVerified', () => {
    it('returns true when is_verified is true', () => {
      expect(isWarningVerified(createMockWarning({ is_verified: true }))).toBe(true);
    });

    it('returns true when status is verified', () => {
      expect(isWarningVerified(createMockWarning({ status: 'verified' as any, extraction_confidence: 0.5 }))).toBe(true);
    });

    it('returns true when extraction_confidence is >= 0.8', () => {
      expect(isWarningVerified(createMockWarning({ extraction_confidence: 0.8, status: 'active' }))).toBe(true);
      expect(isWarningVerified(createMockWarning({ extraction_confidence: 0.95, status: 'active' }))).toBe(true);
    });

    it('returns false when unverified and low confidence', () => {
      expect(isWarningVerified(createMockWarning({ is_verified: false, status: 'unverified', extraction_confidence: 0.75 }))).toBe(false);
      expect(isWarningVerified(null)).toBe(false);
    });
  });

  // ============================================
  // 4. computeWarningStatus
  // ============================================
  describe('computeWarningStatus', () => {
    it('returns not_held when heldWarning is undefined', () => {
      expect(computeWarningStatus(undefined)).toBe('not_held');
    });

    it('returns held_with_geometry when heldWarning has geometry', () => {
      const warning = createMockWarning({
        latitude: 25.16,
        longitude: 55.25,
      });
      expect(computeWarningStatus(warning)).toBe('held_with_geometry');
    });

    it('returns held_without_geometry when heldWarning has no geometry but is verified', () => {
      const warning = createMockWarning({
        spatial: { geometries: [], circles: [], raw_coordinate_text: [], validation_status: 'not_present' },
        latitude: null,
        longitude: null,
        status: 'verified' as any,
      });
      expect(computeWarningStatus(warning)).toBe('held_without_geometry');
    });

    it('returns held_text_only when heldWarning has no geometry and is unverified', () => {
      const warning = createMockWarning({
        spatial: { geometries: [], circles: [], raw_coordinate_text: [], validation_status: 'not_present' },
        latitude: null,
        longitude: null,
        status: 'active',
        is_verified: false,
        extraction_confidence: 0.6,
      });
      expect(computeWarningStatus(warning)).toBe('held_text_only');
    });
  });

  // ============================================
  // 5. computeInForceStatus
  // ============================================
  describe('computeInForceStatus', () => {
    it('handles empty snapshot with zero entries', () => {
      const snapshot = createMockSnapshot({ entries: [] });
      const result = computeInForceStatus(snapshot, [], 'IX');

      expect(result.summary.listedCount).toBe(0);
      expect(result.summary.heldCount).toBe(0);
      expect(result.summary.coveragePercentage).toBe(100);
      expect(result.warnings).toHaveLength(0);
      expect(result.missingWarningIds).toHaveLength(0);
      expect(result.extraWarningIds).toHaveLength(0);
    });

    it('computes 100% full coverage when all listed entries are held in DB', () => {
      const w1 = createMockWarning({ warning_id: 'NAVAREA IX 364/24' });
      const w2 = createMockWarning({ warning_id: 'NAVAREA IX 365/24' });
      const snapshot = createMockSnapshot({
        entries: [
          { seriesYear: 2024, number: 364, warningId: 'NAVAREA IX 364/24' },
          { seriesYear: 2024, number: 365, warningId: 'NAVAREA IX 365/24' },
        ],
      });

      const result = computeInForceStatus(snapshot, [w1, w2], 'IX');
      expect(result.summary.listedCount).toBe(2);
      expect(result.summary.heldCount).toBe(2);
      expect(result.summary.missingCount).toBe(0);
      expect(result.summary.coveragePercentage).toBe(100);
      expect(result.warnings[0].status).toBe('held_with_geometry');
      expect(result.warnings[1].status).toBe('held_with_geometry');
    });

    it('computes partial coverage and identifies missing warnings', () => {
      const w1 = createMockWarning({ warning_id: 'NAVAREA IX 364/24' });
      const snapshot = createMockSnapshot({
        entries: [
          { seriesYear: 2024, number: 364, warningId: 'NAVAREA IX 364/24' },
          { seriesYear: 2024, number: 365, warningId: 'NAVAREA IX 365/24' },
        ],
      });

      const result = computeInForceStatus(snapshot, [w1], 'IX');
      expect(result.summary.listedCount).toBe(2);
      expect(result.summary.heldCount).toBe(1);
      expect(result.summary.missingCount).toBe(1);
      expect(result.summary.coveragePercentage).toBe(50);
      expect(result.missingWarningIds).toEqual(['NAVAREA IX 365/24']);
      expect(result.warnings[1].status).toBe('not_held');
    });

    it('calculates extra active warnings while excluding cancelled and in-force bulletins', () => {
      const activeListed = createMockWarning({ warning_id: 'NAVAREA IX 364/24' });
      const activeExtra = createMockWarning({ warning_id: 'NAVAREA IX 999/24', title: 'DRIFTING BUOY' });
      const cancelledExtra = createMockWarning({ warning_id: 'NAVAREA IX 888/24', status: 'cancelled' });
      const expiredExtra = createMockWarning({ warning_id: 'NAVAREA IX 777/24', status: 'expired' });
      const inForceBulletin = createMockWarning({
        warning_id: 'NAVAREA IX 500/24',
        title: 'NAVAREA IX IN FORCE WARNINGS BULLETIN',
        raw_text: 'NAVAREA IX IN FORCE LIST AT 151200Z OCT 24',
      });

      const snapshot = createMockSnapshot({
        entries: [{ seriesYear: 2024, number: 364, warningId: 'NAVAREA IX 364/24' }],
      });

      const result = computeInForceStatus(
        snapshot,
        [activeListed, activeExtra, cancelledExtra, expiredExtra, inForceBulletin],
        'IX'
      );

      expect(result.summary.extraCount).toBe(1);
      expect(result.extraWarningIds).toEqual(['NAVAREA IX 999/24']);
    });

    it('rounds coverage percentage accurately', () => {
      const w1 = createMockWarning({ warning_id: 'NAVAREA IX 1/24' });
      const w2 = createMockWarning({ warning_id: 'NAVAREA IX 2/24' });
      const snapshot = createMockSnapshot({
        entries: [
          { seriesYear: 2024, number: 1, warningId: 'NAVAREA IX 1/24' },
          { seriesYear: 2024, number: 2, warningId: 'NAVAREA IX 2/24' },
          { seriesYear: 2024, number: 3, warningId: 'NAVAREA IX 3/24' },
        ],
      });

      // 2 held out of 3 listed: 66.666% -> rounds to 67%
      const result = computeInForceStatus(snapshot, [w1, w2], 'IX');
      expect(result.summary.coveragePercentage).toBe(67);
    });

    it('matches cross-format IDs seamlessly', () => {
      // Snapshot has simple number/year, warning has 4-digit year format
      const snapshot = createMockSnapshot({
        entries: [{ seriesYear: 2024, number: 364, warningId: '364/24' }],
      });
      const warning = createMockWarning({
        warning_id: 'NAVAREA IX 364/2024',
        source_warning_id: 'IX-364-24',
      });

      const result = computeInForceStatus(snapshot, [warning], 'IX');
      expect(result.summary.listedCount).toBe(1);
      expect(result.summary.heldCount).toBe(1);
      expect(result.summary.coveragePercentage).toBe(100);
      expect(result.warnings[0].status).toBe('held_with_geometry');
    });

    it('deduplicates duplicate snapshot entries so listed count is not inflated', () => {
      const snapshot = createMockSnapshot({
        entries: [
          { seriesYear: 2024, number: 364, warningId: 'NAVAREA IX 364/24' },
          { seriesYear: 2024, number: 364, warningId: '364/2024' }, // Duplicate reference
        ],
      });
      const warning = createMockWarning({ warning_id: 'NAVAREA IX 364/24' });

      const result = computeInForceStatus(snapshot, [warning], 'IX');
      expect(result.summary.listedCount).toBe(1);
      expect(result.summary.heldCount).toBe(1);
      expect(result.summary.coveragePercentage).toBe(100);
    });
  });

  // ============================================
  // 6. Lifecycle Fallback & Enhanced Computation
  // ============================================
  describe('computeInForceStatusWithFallback & computeInForceStatusEnhanced', () => {
    it('gracefully falls back to held active warnings when snapshot is null and flag enabled', () => {
      FEATURE_FLAGS.inForceFallbackToLifecycle = true;
      const w1 = createMockWarning({ warning_id: 'NAVAREA IX 364/24', status: 'active' });
      const w2 = createMockWarning({ warning_id: 'NAVAREA IX 365/24', status: 'active' });
      const wCancelled = createMockWarning({ warning_id: 'NAVAREA IX 999/24', status: 'cancelled' });

      const result = computeInForceStatusWithFallback(null, [w1, w2, wCancelled], 'IX');
      expect(result.summary.listedCount).toBe(2);
      expect(result.summary.heldCount).toBe(2);
      expect(result.summary.coveragePercentage).toBe(100);
      expect(result.warnings).toHaveLength(2);
    });

    it('returns empty summary when snapshot is null and fallback flag is disabled', () => {
      FEATURE_FLAGS.inForceFallbackToLifecycle = false;
      const w1 = createMockWarning({ warning_id: 'NAVAREA IX 364/24' });

      const result = computeInForceStatusWithFallback(null, [w1], 'IX');
      expect(result.summary.listedCount).toBe(0);
      expect(result.summary.heldCount).toBe(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('delegates to computeInForceStatus when snapshot is present in computeInForceStatusEnhanced', () => {
      const snapshot = createMockSnapshot();
      const warning = createMockWarning({ warning_id: 'NAVAREA IX 364/24' });

      const result = computeInForceStatusEnhanced(snapshot, [warning], 'IX');
      expect(result.summary.listedCount).toBe(2);
      expect(result.summary.heldCount).toBe(1);
    });
  });

  // ============================================
  // 7. Cache Management & getInForceStatusForNavarea
  // ============================================
  describe('getInForceStatusForNavarea and Cache Invalidation', () => {
    it('computes and caches result on first call, returns cached result on subsequent call', () => {
      const warning = createMockWarning({ warning_id: 'NAVAREA IX 364/24' });
      const warnings = [warning];

      const res1 = getInForceStatusForNavarea('IX', warnings);
      expect(res1).not.toBeNull();
      expect(res1?.summary.heldCount).toBe(1);

      const res2 = getInForceStatusForNavarea('IX', warnings);
      expect(res2).toBe(res1); // Exact cached reference
    });

    it('invalidates cache when warnings identity, verification, or geometry state changes', () => {
      const warning1 = createMockWarning({
        warning_id: 'NAVAREA IX 364/24',
        is_verified: false,
        extraction_confidence: 0.5,
        status: 'active',
        spatial: { geometries: [], circles: [], raw_coordinate_text: [], validation_status: 'not_present' },
        latitude: null,
        longitude: null,
      });

      const res1 = getInForceStatusForNavarea('IX', [warning1]);
      expect(res1?.summary.withGeometryCount).toBe(0);
      expect(res1?.summary.verifiedCount).toBe(0);

      // Now update warning to include geometry and verified state
      const warning1Updated = createMockWarning({
        warning_id: 'NAVAREA IX 364/24',
        is_verified: true,
        latitude: 25.16,
        longitude: 55.25,
      });

      const res2 = getInForceStatusForNavarea('IX', [warning1Updated]);
      expect(res2).not.toBe(res1);
      expect(res2?.summary.withGeometryCount).toBe(1);
      expect(res2?.summary.verifiedCount).toBe(1);
    });

    it('clears cache completely when clearInForceStatusCache is called', () => {
      const warning = createMockWarning({ warning_id: 'NAVAREA IX 364/24' });
      getInForceStatusForNavarea('IX', [warning]);

      clearInForceStatusCache();
      const resAfterClear = getInForceStatusForNavarea('IX');
      expect(resAfterClear).toBeNull();
    });

    it('computeWarningsHash produces distinct hashes for differing status/geometry', () => {
      const w1 = createMockWarning({ status: 'active', latitude: 20, longitude: 30 });
      const w2 = createMockWarning({ status: 'verified' as any, latitude: 20, longitude: 30 });
      const w3 = createMockWarning({
        status: 'active',
        spatial: { geometries: [], circles: [], raw_coordinate_text: [], validation_status: 'not_present' },
        latitude: null,
        longitude: null,
      });

      expect(computeWarningsHash([w1])).not.toBe(computeWarningsHash([w2]));
      expect(computeWarningsHash([w1])).not.toBe(computeWarningsHash([w3]));
    });
  });

  // ============================================
  // 8. useInForceStatus Hook Integration
  // ============================================
  describe('useInForceStatus Hook', () => {
    it('returns empty uncomputed state when inForceUIDisplay flag is disabled', () => {
      FEATURE_FLAGS.inForceUIDisplay = false;

      let hookOutput: any;
      function TestComponent() {
        hookOutput = useInForceStatus('IX', [createMockWarning()]);
        return null;
      }

      renderToString(React.createElement(TestComponent));
      expect(hookOutput.summary.listedCount).toBe(0);
      expect(hookOutput.isLoading).toBe(false);
    });

    it('serves cached computation immediately when available and inForceUIDisplay is enabled', () => {
      FEATURE_FLAGS.inForceUIDisplay = true;
      const warning = createMockWarning({ warning_id: 'NAVAREA IX 364/24' });
      const warnings = [warning];

      // Pre-warm cache
      const prewarmed = getInForceStatusForNavarea('IX', warnings);
      expect(prewarmed).not.toBeNull();

      let hookOutput: any;
      function TestComponent() {
        hookOutput = useInForceStatus('IX', warnings);
        return null;
      }

      renderToString(React.createElement(TestComponent));
      expect(hookOutput.summary.heldCount).toBe(1);
      expect(hookOutput.summary.coveragePercentage).toBe(100);
      expect(hookOutput.isLoading).toBe(false);
    });

    it('handles ALL navarea filter by returning zeroed summary without loading', () => {
      FEATURE_FLAGS.inForceUIDisplay = true;

      let hookOutput: any;
      function TestComponent() {
        hookOutput = useInForceStatus('ALL', [createMockWarning()]);
        return null;
      }

      renderToString(React.createElement(TestComponent));
      expect(hookOutput.summary.listedCount).toBe(0);
      expect(hookOutput.isLoading).toBe(false);
    });
  });
});

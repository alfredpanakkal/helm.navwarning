// src/components/__tests__/InForceCoverageBanner.test.tsx
// Phase 6: InForceCoverageBanner Component Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { InForceCoverageBanner } from '../InForceCoverageBanner';
import { FEATURE_FLAGS, resetFeatureFlags } from '../../lib/featureFlags';
import type { InForceStatusResult } from '../../hooks/useInForceStatus';

const createMockStatusResult = (overrides: Partial<InForceStatusResult> = {}): InForceStatusResult => ({
  snapshot: {
    id: 'snap-1',
    navarea: 'IX',
    snapshotWarningId: 'NAVAREA IX 500/24',
    sourceId: 'src-1',
    issuedAt: '2024-10-15T12:00:00Z',
    issueDate: '15 OCT 2024',
    entries: [],
    cancelledRefs: [],
    isPartial: false,
    isAuthoritative: true,
  },
  warnings: [],
  summary: {
    listedCount: 40,
    heldCount: 34,
    withGeometryCount: 28,
    verifiedCount: 30,
    missingCount: 6,
    extraCount: 2,
    coveragePercentage: 85,
  },
  missingWarningIds: ['NAVAREA IX 365/24', 'NAVAREA IX 366/24'],
  extraWarningIds: ['NAVAREA IX 999/24'],
  computedAt: new Date(),
  isLoading: false,
  ...overrides,
});

describe('InForceCoverageBanner Component', () => {
  beforeEach(() => {
    resetFeatureFlags();
    FEATURE_FLAGS.inForceUIDisplay = true;
  });

  afterEach(() => {
    resetFeatureFlags();
  });

  it('renders null when FEATURE_FLAGS.inForceUIDisplay is false', () => {
    FEATURE_FLAGS.inForceUIDisplay = false;
    const html = renderToString(
      React.createElement(InForceCoverageBanner, {
        status: createMockStatusResult(),
        navarea: 'IX',
      })
    );
    expect(html).toBe('');
  });

  it('renders null when navarea is ALL or empty', () => {
    const htmlAll = renderToString(
      React.createElement(InForceCoverageBanner, {
        status: createMockStatusResult(),
        navarea: 'ALL',
      })
    );
    expect(htmlAll).toBe('');

    const htmlEmpty = renderToString(
      React.createElement(InForceCoverageBanner, {
        status: createMockStatusResult(),
        navarea: '',
      })
    );
    expect(htmlEmpty).toBe('');
  });

  it('renders null when status is null', () => {
    const html = renderToString(
      React.createElement(InForceCoverageBanner, {
        status: null,
        navarea: 'IX',
      })
    );
    expect(html).toBe('');
  });

  it('renders coverage header with NAVAREA name and progress percentage', () => {
    const html = renderToString(
      React.createElement(InForceCoverageBanner, {
        status: createMockStatusResult(),
        navarea: 'IX',
      })
    );

    expect(html).toContain('IN-FORCE STATUS: NAVAREA IX');
    expect(html).toContain('85%');
    expect(html).toContain('Based on Bulletin NAVAREA IX 500/24');
    expect(html).toContain('Authoritative');
  });

  it('displays all 6 summary metric numbers accurately', () => {
    const status = createMockStatusResult({
      summary: {
        listedCount: 42,
        heldCount: 38,
        withGeometryCount: 30,
        verifiedCount: 32,
        missingCount: 4,
        extraCount: 3,
        coveragePercentage: 90,
      },
    });

    const html = renderToString(
      React.createElement(InForceCoverageBanner, {
        status,
        navarea: 'IV',
      })
    );

    expect(html).toContain('42'); // listed
    expect(html).toContain('38'); // held
    expect(html).toContain('30'); // with coords
    expect(html).toContain('32'); // verified
    expect(html).toContain('4');  // missing
    expect(html).toContain('3');  // extra
  });

  it('renders View Missing button when missingCount > 0 and onViewMissing provided', () => {
    const html = renderToString(
      React.createElement(InForceCoverageBanner, {
        status: createMockStatusResult({ summary: { ...createMockStatusResult().summary, missingCount: 6 } }),
        navarea: 'IX',
        onViewMissing: () => {},
      })
    );

    expect(html).toContain('Missing (6)');
  });

  it('renders partial list badge when snapshot is partial', () => {
    const status = createMockStatusResult({
      snapshot: {
        id: 'snap-partial',
        navarea: 'IX',
        snapshotWarningId: 'IX 529/24',
        sourceId: 'src-1',
        issuedAt: '2024-10-15T12:00:00Z',
        issueDate: null,
        entries: [],
        cancelledRefs: [],
        isPartial: true,
        isAuthoritative: false,
      },
    });

    const html = renderToString(
      React.createElement(InForceCoverageBanner, {
        status,
        navarea: 'IX',
      })
    );

    expect(html).toContain('Partial List');
  });
});

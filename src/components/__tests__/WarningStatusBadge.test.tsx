// src/components/__tests__/WarningStatusBadge.test.tsx
// Phase 6: WarningStatusBadge Component Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { WarningStatusBadge } from '../WarningStatusBadge';
import { FEATURE_FLAGS, resetFeatureFlags } from '../../lib/featureFlags';
import type { NavWarning } from '../../types';

const createMockWarning = (overrides: Partial<NavWarning> = {}): NavWarning => ({
  schema_version: 1,
  warning_id: 'NAVAREA IX 364/24',
  source_warning_id: 'IX-364-24',
  publisher_id: 'pakistan-pmd',
  source_id: 'src-1',
  navarea: 'IX',
  series: 'A',
  warning_number: '364',
  warning_year: 2024,
  issued_at: '2024-10-15T12:00:00Z',
  issued_date: '2024-10-15',
  issued_time_precision: 'day',
  issued_text: 'NAVAREA IX 364/24 GUNNERY',
  valid_from: null,
  valid_to: null,
  cancelled_at: null,
  status: 'active',
  status_basis: 'listed_in_complete_in_force_publication',
  area_text: 'ARABIAN SEA',
  original_language: 'en',
  raw_text: 'NAVAREA IX 364/24 GUNNERY',
  translated_text: null,
  spatial: {
    geometries: [{ type: 'Point', coordinates: [55.25, 25.16], label: 'Target' }],
    circles: [],
    raw_coordinate_text: ['25-10N 055-15E'],
    validation_status: 'passed',
  },
  supersedes: [],
  cancels: [],
  source_url: 'https://example.com',
  raw_artifact_ref: '',
  content_hash: 'abc',
  parser_version: 'v2.0',
  extraction_method: 'deterministic',
  first_seen_at: '2024-10-15T12:00:00Z',
  last_seen_at: '2024-10-15T12:00:00Z',
  not_in_force_observed_at: null,
  generation_id: 'gen-1',
  validation: { identity: 'valid', dates: 'valid', geometry: 'valid' },
  ...overrides,
});

describe('WarningStatusBadge Component', () => {
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
      React.createElement(WarningStatusBadge, { status: 'held_with_geometry' })
    );
    expect(html).toBe('');
  });

  it('renders green mapped badge for held_with_geometry', () => {
    const html = renderToString(
      React.createElement(WarningStatusBadge, { status: 'held_with_geometry' })
    );
    expect(html).toContain('In-Force: Mapped');
    expect(html).toContain('bg-emerald-50');
    expect(html).toContain('data-status="held_with_geometry"');
  });

  it('renders amber verified badge for held_without_geometry', () => {
    const html = renderToString(
      React.createElement(WarningStatusBadge, { status: 'held_without_geometry' })
    );
    expect(html).toContain('In-Force: Verified');
    expect(html).toContain('bg-amber-50');
    expect(html).toContain('data-status="held_without_geometry"');
  });

  it('renders orange text-only badge for held_text_only', () => {
    const html = renderToString(
      React.createElement(WarningStatusBadge, { status: 'held_text_only' })
    );
    expect(html).toContain('In-Force: Text Only');
    expect(html).toContain('bg-orange-50');
    expect(html).toContain('data-status="held_text_only"');
  });

  it('renders red missing badge for not_held', () => {
    const html = renderToString(
      React.createElement(WarningStatusBadge, { status: 'not_held' })
    );
    expect(html).toContain('Missing from DB');
    expect(html).toContain('bg-red-50');
    expect(html).toContain('data-status="not_held"');
  });

  it('renders compact short labels when compact prop is true', () => {
    const html = renderToString(
      React.createElement(WarningStatusBadge, { status: 'held_with_geometry', compact: true })
    );
    expect(html).toContain('Mapped');
    expect(html).not.toContain('In-Force: Mapped');
  });

  it('automatically derives status from warning object when status prop is omitted', () => {
    const warningWithCoords = createMockWarning({
      latitude: 25.16,
      longitude: 55.25,
    });
    const htmlMapped = renderToString(
      React.createElement(WarningStatusBadge, { warning: warningWithCoords, compact: true })
    );
    expect(htmlMapped).toContain('Mapped');

    const warningWithoutCoords = createMockWarning({
      spatial: { geometries: [], circles: [], raw_coordinate_text: [], validation_status: 'not_present' },
      latitude: null,
      longitude: null,
      is_verified: true,
    });
    const htmlVerified = renderToString(
      React.createElement(WarningStatusBadge, { warning: warningWithoutCoords, compact: true })
    );
    expect(htmlVerified).toContain('Verified');
  });

  it('renders the amber Needs Review fallback for unknown status strings, never green', () => {
    const html = renderToString(
      React.createElement(WarningStatusBadge, { status: 'some_future_status' })
    );
    expect(html).toContain('Needs Review');
    expect(html).toContain('bg-amber-50');
    expect(html).toContain('data-status="some_future_status"');
    expect(html).not.toContain('In-Force: Mapped');
    expect(html).not.toContain('bg-emerald-50');
  });

  it('renders Needs Review when no status can be derived at all', () => {
    const html = renderToString(React.createElement(WarningStatusBadge, {}));
    expect(html).toContain('Needs Review');
    expect(html).toContain('data-status="needs_review"');
    expect(html).not.toContain('bg-emerald-50');
  });

  it('keeps the compact short label for the Needs Review fallback', () => {
    const html = renderToString(
      React.createElement(WarningStatusBadge, { status: 'mystery', compact: true })
    );
    expect(html).toContain('>Review<');
    expect(html).not.toContain('Needs Review');
  });
});

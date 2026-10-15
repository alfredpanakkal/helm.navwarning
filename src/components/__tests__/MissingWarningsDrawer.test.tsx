// src/components/__tests__/MissingWarningsDrawer.test.tsx
// Phase 6: MissingWarningsDrawer Component Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MissingWarningsDrawer } from '../MissingWarningsDrawer';
import { FEATURE_FLAGS, resetFeatureFlags } from '../../lib/featureFlags';

describe('MissingWarningsDrawer Component', () => {
  beforeEach(() => {
    resetFeatureFlags();
    FEATURE_FLAGS.inForceUIDisplay = true;
  });

  afterEach(() => {
    resetFeatureFlags();
  });

  it('renders null when isOpen is false', () => {
    const html = renderToString(
      React.createElement(MissingWarningsDrawer, {
        isOpen: false,
        onClose: () => {},
        navarea: 'IX',
        missingIds: ['364/24'],
      })
    );
    expect(html).toBe('');
  });

  it('renders null when FEATURE_FLAGS.inForceUIDisplay is false', () => {
    FEATURE_FLAGS.inForceUIDisplay = false;
    const html = renderToString(
      React.createElement(MissingWarningsDrawer, {
        isOpen: true,
        onClose: () => {},
        navarea: 'IX',
        missingIds: ['364/24'],
      })
    );
    expect(html).toBe('');
  });

  it('renders drawer header with NAVAREA title and missing warnings list', () => {
    const html = renderToString(
      React.createElement(MissingWarningsDrawer, {
        isOpen: true,
        onClose: () => {},
        navarea: 'IX',
        missingIds: ['NAVAREA IX 364/24', 'NAVAREA IX 365/24'],
        isAdmin: false,
      })
    );

    expect(html).toContain('Missing Notices: NAVAREA IX');
    expect(html).toContain('2 listed in-force warnings absent from DB');
    expect(html).toContain('NAVAREA IX 364/24');
    expect(html).toContain('NAVAREA IX 365/24');
    expect(html).toContain('Read-only view');
  });

  it('displays admin actions when isAdmin is true', () => {
    const html = renderToString(
      React.createElement(MissingWarningsDrawer, {
        isOpen: true,
        onClose: () => {},
        navarea: 'IX',
        missingIds: ['NAVAREA IX 364/24'],
        isAdmin: true,
        onFetchMissing: () => {},
      })
    );

    expect(html).toContain('Fetch All Missing (1)');
    expect(html).toContain('Fetch');
  });

  it('displays zero missing state when missingIds array is empty', () => {
    const html = renderToString(
      React.createElement(MissingWarningsDrawer, {
        isOpen: true,
        onClose: () => {},
        navarea: 'IX',
        missingIds: [],
        isAdmin: false,
      })
    );

    expect(html).toContain('Zero Missing Warnings');
    expect(html).toContain('All in-force warnings for NAVAREA IX are held locally');
  });
});

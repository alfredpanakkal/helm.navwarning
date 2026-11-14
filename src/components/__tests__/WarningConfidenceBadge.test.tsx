// src/components/__tests__/WarningConfidenceBadge.test.tsx
// F4: parser triage confidence must be presented as confidence, never as
// maritime hazard severity or as manual verification.

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WarningConfidenceBadge, warningConfidence } from '../WarningItemV2';
import type { NavWarning } from '../../types';

const mockWarning = (extraction_confidence: number | undefined): NavWarning => ({
  warning_id: 'NAVAREA XI 0451/26',
  extraction_confidence,
  status: 'active',
} as unknown as NavWarning);

describe('warningConfidence', () => {
  it('bands full-confidence rows separately from manual verification', () => {
    expect(warningConfidence(mockWarning(1)).label).toBe('FULL_CONFIDENCE');
  });

  it('bands confidence >= 0.8 as HIGH_CONFIDENCE', () => {
    expect(warningConfidence(mockWarning(0.8)).label).toBe('HIGH_CONFIDENCE');
    expect(warningConfidence(mockWarning(0.9)).label).toBe('HIGH_CONFIDENCE');
  });

  it('bands lower-confidence rows as NEEDS_REVIEW, not as a hazard level', () => {
    expect(warningConfidence(mockWarning(0.6)).label).toBe('NEEDS_REVIEW');
    expect(warningConfidence(mockWarning(undefined)).label).toBe('NEEDS_REVIEW');
  });
});

describe('WarningConfidenceBadge', () => {
  it('renders confidence wording, never hazard severity or verification wording', () => {
    const html = renderToString(<WarningConfidenceBadge warning={mockWarning(1)} />);
    expect(html).toContain('Full conf.');
    expect(html).not.toContain('Critical');
    expect(html).not.toContain('Moderate');
    expect(html).not.toContain('Verified');
  });

  it('labels lower-confidence rows as needing review', () => {
    const html = renderToString(<WarningConfidenceBadge warning={mockWarning(0.6)} />);
    expect(html).toContain('Needs review');
  });
});

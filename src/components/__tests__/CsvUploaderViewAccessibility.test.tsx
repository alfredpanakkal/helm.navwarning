// src/components/__tests__/CsvUploaderViewAccessibility.test.tsx
// Accessibility verification for CsvUploaderView tabs (Task 4)

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CsvUploaderView } from '../CsvUploaderView';

describe('CsvUploaderView Accessibility (Task 4)', () => {
  it('renders tablist with accessible label and 5 tab triggers', () => {
    const html = renderToString(<CsvUploaderView onCommitWarnings={vi.fn()} />);

    // 1. Tablist role and label
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Import methods"');

    // 2. All 5 tabs exist with role="tab" and type="button"
    const tabIds = ['ai_bulk', 'markdown', 'paste', 'file', 'api'];
    tabIds.forEach((id) => {
      expect(html).toContain(`id="import-tab-${id}"`);
      expect(html).toContain(`aria-controls="import-panel-${id}"`);
    });

    // 3. Default active tab (ai_bulk) has aria-selected="true" and tabIndex="0"
    expect(html).toMatch(/id="import-tab-ai_bulk"[^>]*role="tab"[^>]*tabindex="0"[^>]*aria-selected="true"/);

    // 4. Inactive tabs have aria-selected="false" and tabIndex="-1"
    ['markdown', 'paste', 'file', 'api'].forEach((id) => {
      expect(html).toMatch(new RegExp(`id="import-tab-${id}"[^>]*role="tab"[^>]*tabindex="-1"[^>]*aria-selected="false"`));
    });

    // 5. Active tabpanel has role="tabpanel", tabIndex="0", and aria-labelledby
    expect(html).toContain('id="import-panel-ai_bulk"');
    expect(html).toMatch(/id="import-panel-ai_bulk"[^>]*role="tabpanel"[^>]*tabindex="0"[^>]*aria-labelledby="import-tab-ai_bulk"/);
  });
});

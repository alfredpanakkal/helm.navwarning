import { describe, expect, it } from 'vitest';
import { renderHazardBadgeHtml } from '../hazardIcons';

describe('renderHazardBadgeHtml', () => {
  it.each([
    ['critical', '#B42318'],
    ['high', '#8C5208'],
    ['active', '#2F6B4F'],
  ] as const)('uses %s severity as the complete marker fill', (severity, fill) => {
    const html = renderHazardBadgeHtml('cable', severity);

    expect(html).toContain(`background: ${fill}`);
    expect(html).toContain('border: 1.5px solid #111827');
    expect(html).toContain('color: #ffffff');
    expect(html).not.toContain('border: 2px solid #B42318');
    expect(html).not.toContain('background: #14161c');
  });
});

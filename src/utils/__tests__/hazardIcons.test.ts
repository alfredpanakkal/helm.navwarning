import { describe, expect, it } from 'vitest';
import { renderHazardBadgeHtml, renderPrimarySymbolSvg } from '../hazardIcons';

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

it('renders a dedicated wreck cue rather than the generic hazard glyph', () => {
  const wreck = renderPrimarySymbolSvg('wreck');
  const general = renderPrimarySymbolSvg('general');
  expect(wreck).toContain('Q12 12 18 18');
  expect(wreck).not.toBe(general);
});

it('renders cable and offshore operations with distinct glyphs', () => {
  const cable = renderPrimarySymbolSvg('cable');
  const subsea = renderPrimarySymbolSvg('subsea');

  expect(cable).toContain('Q8 10 12 12 T20 7');
  expect(subsea).toContain('x1="7" y1="19" x2="10" y2="7"');
  expect(cable).not.toBe(subsea);
});

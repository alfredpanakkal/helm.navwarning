import { describe, expect, it } from 'vitest';
import { geometryEditBlockReason } from '../geometryEditSafety';

describe('geometryEditBlockReason', () => {
  it('allows simple geometry types the editors can round-trip', () => {
    expect(geometryEditBlockReason([{ type: 'Point', coordinates: [10, 20] }])).toBeNull();
    expect(geometryEditBlockReason([{ type: 'LineString', coordinates: [[10, 20], [11, 21]] }])).toBeNull();
    expect(geometryEditBlockReason([{ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }])).toBeNull();
  });

  it.each(['MultiPoint', 'MultiLineString', 'MultiPolygon'])('blocks %s instead of silently simplifying it', (type) => {
    expect(geometryEditBlockReason([{ type, coordinates: [] }])).toContain('not safely editable');
  });

  it('blocks polygon holes and advanced persisted metadata', () => {
    expect(geometryEditBlockReason([{ type: 'Polygon', coordinates: [
      [[0, 0], [1, 0], [1, 1], [0, 0]],
      [[0.2, 0.2], [0.3, 0.2], [0.3, 0.3], [0.2, 0.2]],
    ] }])).toContain('holes');
    expect(geometryEditBlockReason([{
      type: 'LineString', coordinates: [[0, 0], [1, 1]], corridor_half_width_nm: 1,
    }])).toContain('metadata');
    expect(geometryEditBlockReason([{
      type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]], sweep_radius_nm: 12,
    }])).toContain('metadata');
  });

  it('allows multiple simple shapes only when the caller supports them', () => {
    const twoPoints = [
      { type: 'Point', coordinates: [10, 20] },
      { type: 'Point', coordinates: [11, 21] },
    ];
    expect(geometryEditBlockReason(twoPoints)).toContain('one geometry');
    expect(geometryEditBlockReason(twoPoints, { allowMultiple: true })).toBeNull();
  });

  it('blocks circles without a valid radius rather than inventing one', () => {
    expect(geometryEditBlockReason([{ type: 'Circle', coordinates: [10, 20] }], { allowCircle: true })).toContain('missing radius');
  });

  it('blocks malformed coordinates instead of dropping the stored geometry', () => {
    expect(geometryEditBlockReason([{ type: 'Point', coordinates: [10, Number.NaN] }])).toContain('malformed');
    expect(geometryEditBlockReason([{ type: 'LineString', coordinates: [[10, 20]] }])).toContain('malformed');
  });

  it('blocks geometry edits when the source view omits metadata columns', () => {
    expect(geometryEditBlockReason([{ type: 'Point', coordinates: [10, 20] }], { metadataComplete: false })).toContain('omits some geometry metadata');
  });

  it('treats explicit zero-valued sweep metadata as meaningful', () => {
    expect(geometryEditBlockReason([{ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]], sweep_start_azimuth: 0 }])).toContain('metadata');
  });

  it('allows buffered points only for the editor that preserves their radius', () => {
    const buffered = [{ type: 'Point', coordinates: [10, 20], buffer_nm: 2 }];
    expect(geometryEditBlockReason(buffered)).toContain('Buffered points');
    expect(geometryEditBlockReason(buffered, { allowBufferedPoints: true })).toBeNull();
  });
});

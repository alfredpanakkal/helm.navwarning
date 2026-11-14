// src/utils/__tests__/warningHelpers.test.ts
// F7 authority regression tests: persisted backend geometry must win over
// browser-side parsing, and text-derived fallback geometry must never be
// plotted as a real map position.

import { describe, it, expect } from 'vitest';
import { hasRenderablePolygons, isTextDerivedGeometryOnly } from '../warningHelpers';
import { NavWarning } from '../../types';

const warningWithSpatial = (spatial: any): NavWarning =>
  ({ warning_id: 'NAVAREA XI 0451/26', spatial } as unknown as NavWarning);

describe('isTextDerivedGeometryOnly', () => {
  it('flags the regex fallback geometry (parsed_from_text) as text-derived', () => {
    expect(
      isTextDerivedGeometryOnly(
        warningWithSpatial({
          geometries: [{ type: 'Point', coordinates: [140.25, 35.2] }],
          circles: [],
          raw_coordinate_text: ['35-12.0N 140-15.0E'],
          validation_status: 'parsed_from_text',
        })
      )
    ).toBe(true);
  });

  it('treats persisted backend geometry as authoritative', () => {
    expect(
      isTextDerivedGeometryOnly(
        warningWithSpatial({
          geometries: [{ type: 'Point', coordinates: [134.6583, 16.9017] }],
          circles: [],
          raw_coordinate_text: [],
          validation_status: 'passed',
        })
      )
    ).toBe(false);
  });

  it('treats missing geometry as an honest state, not a text parse', () => {
    expect(
      isTextDerivedGeometryOnly(
        warningWithSpatial({ geometries: [], circles: [], raw_coordinate_text: [], validation_status: 'not_present' })
      )
    ).toBe(false);
  });

  it('handles missing warnings and missing spatial safely', () => {
    expect(isTextDerivedGeometryOnly(null)).toBe(false);
    expect(isTextDerivedGeometryOnly(undefined)).toBe(false);
    expect(isTextDerivedGeometryOnly({} as NavWarning)).toBe(false);
  });
});

describe('hasRenderablePolygons', () => {
  it('returns true for persisted polygons', () => {
    expect(
      hasRenderablePolygons(
        warningWithSpatial({
          geometries: [{ type: 'Polygon', coordinates: [[[140, 35], [141, 35], [141, 34], [140, 35]]] }],
        })
      )
    ).toBe(true);
  });

  it('rejects malformed persisted polygon rings', () => {
    const malformedPolygons = [
      [],
      [[]],
      [[[140, 35], [141, 35], [141, 34]]],
      [[[140, 35], [141, 35], [141, 34], [139, 35]]],
      [[[140, 35], [141, 35], [141, 34], [140, 35], [NaN, 35]]],
      [[[140, 35], [181, 35], [141, 34], [140, 35]]],
      [[[140, 35], [141, 91], [141, 34], [140, 35]]],
    ];

    malformedPolygons.forEach((coordinates) => {
      expect(
        hasRenderablePolygons(
          warningWithSpatial({ geometries: [{ type: 'Polygon', coordinates }] })
        )
      ).toBe(false);
    });
  });

  it('does not fall back to parsed polygons when persisted polygon geometry is malformed', () => {
    const parsedPolygons = [
      [
        { lat: 10, lng: 10 },
        { lat: 11, lng: 10 },
        { lat: 11, lng: 11 },
      ],
    ];

    expect(
      hasRenderablePolygons(
        warningWithSpatial({
          geometries: [{ type: 'Polygon', coordinates: [[[140, 35], [141, 35], [141, 34]]] }],
        }),
        parsedPolygons
      )
    ).toBe(false);
  });

  it('ignores browser-parsed polygons when persisted geometries exist', () => {
    const parsedPolygons = [
      [
        { lat: 10, lng: 10 },
        { lat: 11, lng: 10 },
        { lat: 11, lng: 11 },
      ],
    ];
    expect(
      hasRenderablePolygons(
        warningWithSpatial({ geometries: [{ type: 'Point', coordinates: [140, 35] }] }),
        parsedPolygons
      )
    ).toBe(false);
  });

  it('allows browser-parsed polygons only as the explicit no-persisted-geometry fallback', () => {
    const parsedPolygons = [
      [
        { lat: 10, lng: 10 },
        { lat: 11, lng: 10 },
        { lat: 11, lng: 11 },
      ],
    ];
    expect(hasRenderablePolygons(warningWithSpatial({ geometries: [] }), parsedPolygons)).toBe(true);
    expect(hasRenderablePolygons(warningWithSpatial({ geometries: [] }), null)).toBe(false);
    expect(hasRenderablePolygons(warningWithSpatial({ geometries: [] }), [])).toBe(false);
  });

  it('returns false for empty or missing input', () => {
    expect(hasRenderablePolygons(null, null)).toBe(false);
    expect(hasRenderablePolygons(warningWithSpatial(null), null)).toBe(false);
  });
});

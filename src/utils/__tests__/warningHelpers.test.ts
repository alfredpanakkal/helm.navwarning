// src/utils/__tests__/warningHelpers.test.ts
// F7 authority regression tests: persisted backend geometry must win over
// browser-side parsing, and text-derived fallback geometry must never be
// plotted as a real map position.

import { describe, it, expect } from 'vitest';
import { hasRenderablePolygons, isTextDerivedGeometryOnly, isWarningMapRenderable } from '../warningHelpers';
import { NavWarning } from '../../types';
import { getLeafletLatLng, hasRenderableCircles, isRenderableCircle } from '../coordinateParser';

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



describe('circle render eligibility', () => {
  it('accepts only circles with a valid non-Null-Island center and positive finite radius', () => {
    expect(isRenderableCircle({ center: [140.25, 35.2], radius_nm: 2 })).toBe(true);

    const invalidCircles = [
      { center: [140.25, 35.2], radius_nm: 0 },
      { center: [140.25, 35.2], radius_nm: -1 },
      { center: [140.25, 35.2], radius_nm: Number.POSITIVE_INFINITY },
      { center: [181, 35.2], radius_nm: 2 },
      { center: [140.25, 91], radius_nm: 2 },
      { center: [0, 0], radius_nm: 2 },
    ];
    invalidCircles.forEach((circle) => expect(isRenderableCircle(circle as any)).toBe(false));
  });

  it('prefers a later drawable circle when an earlier circle is malformed', () => {
    const spatial = {
      geometries: [],
      circles: [
        { center: [0, 0], radius_nm: 10 },
        { center: [140.25, 35.2], radius_nm: 2 },
      ],
    };

    expect(hasRenderableCircles(spatial as any)).toBe(true);
    expect(getLeafletLatLng(spatial as any)).toEqual([35.2, 140.25]);
    expect(isWarningMapRenderable(warningWithSpatial(spatial))).toBe(true);
  });

  it('uses a valid center as a point fallback when only the circle radius is invalid', () => {
    const spatial = {
      geometries: [],
      circles: [{ center: [140.25, 35.2], radius_nm: 0 }],
    };

    expect(hasRenderableCircles(spatial as any)).toBe(false);
    expect(getLeafletLatLng(spatial as any)).toEqual([35.2, 140.25]);
    expect(isWarningMapRenderable(warningWithSpatial(spatial))).toBe(true);
  });

  it('does not treat a Null-Island-only circle as a plotted warning', () => {
    expect(
      isWarningMapRenderable(
        warningWithSpatial({
          geometries: [],
          circles: [{ center: [0, 0], radius_nm: 2 }],
        })
      )
    ).toBe(false);
  });
});

describe('isWarningMapRenderable', () => {
  it('accepts persisted point, polygon, line and circle positions', () => {
    const cases = [
      warningWithSpatial({ geometries: [{ type: 'Point', coordinates: [140.25, 35.2] }], circles: [] }),
      warningWithSpatial({ geometries: [{ type: 'Polygon', coordinates: [[[140, 35], [141, 35], [141, 34], [140, 35]]] }], circles: [] }),
      warningWithSpatial({ geometries: [{ type: 'LineString', coordinates: [[140, 35], [141, 36]] }], circles: [] }),
      warningWithSpatial({ geometries: [], circles: [{ center: [140.25, 35.2], radius_nm: 2 }] }),
    ];
    cases.forEach((warning) => expect(isWarningMapRenderable(warning)).toBe(true));
  });

  it('rejects missing geometry, Null Island and non-finite coordinates', () => {
    expect(isWarningMapRenderable(warningWithSpatial({ geometries: [], circles: [] }))).toBe(false);
    expect(isWarningMapRenderable(warningWithSpatial({ geometries: [{ type: 'Point', coordinates: [0, 0] }], circles: [] }))).toBe(false);
    expect(isWarningMapRenderable({ latitude: Number.POSITIVE_INFINITY, longitude: 140 } as unknown as NavWarning)).toBe(false);
    expect(isWarningMapRenderable(null)).toBe(false);
  });

  it('rejects text-derived, ambiguous and invalid warnings using the map render gate', () => {
    expect(isWarningMapRenderable(warningWithSpatial({ geometries: [{ type: 'Point', coordinates: [140, 35] }], circles: [], validation_status: 'parsed_from_text' }))).toBe(false);
    expect(isWarningMapRenderable({ data_quality: 'AMBIGUOUS', latitude: 35, longitude: 140 } as unknown as NavWarning)).toBe(false);
    expect(isWarningMapRenderable({ data_quality: 'INVALID', latitude: 35, longitude: 140 } as unknown as NavWarning)).toBe(false);
    expect(isWarningMapRenderable({ ambiguous_positions: [{ raw_text: 'x', reason: 'MALFORMED', has_lat_hem: false, has_lon_hem: false }], latitude: 35, longitude: 140 } as unknown as NavWarning)).toBe(false);
  });

  it('accepts direct persisted coordinates', () => {
    expect(isWarningMapRenderable({ latitude: 35.2, longitude: 140.25 } as unknown as NavWarning)).toBe(true);
  });
});

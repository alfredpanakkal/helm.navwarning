import { describe, it, expect } from 'vitest';
import {
  getBoundaryDashArray,
  getBoundaryStyleType,
  getZoomScaleCategory,
  shouldShowVertexPills,
  shouldShowVertexDots,
  shouldShowSwathPill,
  shouldHideCenterPoint,
} from '../boundaryStyles';

describe('boundaryStyles - Boundary Semantics (Phase 4.2)', () => {
  it('returns solid border (undefined) for explicit verified geometry', () => {
    expect(getBoundaryDashArray(false, 'EXPLICIT')).toBeUndefined();
    expect(getBoundaryStyleType(false, 'EXPLICIT')).toBe('solid');
    // Default fallback when undefined
    expect(getBoundaryDashArray(false, undefined)).toBeUndefined();
    expect(getBoundaryStyleType(false, undefined)).toBe('solid');
  });

  it('returns dashed border ("8, 6") for inferred or approximate geometry', () => {
    expect(getBoundaryDashArray(false, 'INFERRED')).toBe('8, 6');
    expect(getBoundaryStyleType(false, 'INFERRED')).toBe('dashed');

    expect(getBoundaryDashArray(false, 'APPROXIMATE')).toBe('8, 6');
    expect(getBoundaryStyleType(false, 'APPROXIMATE')).toBe('dashed');

    expect(getBoundaryDashArray(false, 'AMBIGUOUS')).toBe('8, 6');
    expect(getBoundaryStyleType(false, 'AMBIGUOUS')).toBe('dashed');
  });

  it('returns dotted amber border ("3, 5") for unverified Tier B geometry regardless of data_quality', () => {
    expect(getBoundaryDashArray(true, 'EXPLICIT')).toBe('3, 5');
    expect(getBoundaryStyleType(true, 'EXPLICIT')).toBe('dotted');

    expect(getBoundaryDashArray(true, 'INFERRED')).toBe('3, 5');
    expect(getBoundaryStyleType(true, 'INFERRED')).toBe('dotted');

    expect(getBoundaryDashArray(true, undefined)).toBe('3, 5');
    expect(getBoundaryStyleType(true, undefined)).toBe('dotted');
  });
});

describe('boundaryStyles - Scale-Dependent Display Rules (Phase 4.1)', () => {
  it('categorizes zoom levels into global, regional, and detailed', () => {
    expect(getZoomScaleCategory(2)).toBe('global');
    expect(getZoomScaleCategory(5)).toBe('global');
    expect(getZoomScaleCategory(6)).toBe('regional');
    expect(getZoomScaleCategory(9)).toBe('regional');
    expect(getZoomScaleCategory(10)).toBe('detailed');
    expect(getZoomScaleCategory(14)).toBe('detailed');
  });

  it('suppresses numbered vertex pills at global zoom (z <= 5)', () => {
    expect(shouldShowVertexPills(2, true)).toBe(false);
    expect(shouldShowVertexPills(5, true)).toBe(false);
    expect(shouldShowVertexPills(2, false)).toBe(false);
    expect(shouldShowVertexPills(5, false)).toBe(false);
  });

  it('shows numbered vertex pills only when isolated at regional & detailed zoom', () => {
    expect(shouldShowVertexPills(6, true)).toBe(true);
    expect(shouldShowVertexPills(8, true)).toBe(true);
    expect(shouldShowVertexPills(10, true)).toBe(true);
    expect(shouldShowVertexPills(6, false)).toBe(false);
    expect(shouldShowVertexPills(10, false)).toBe(false);
  });

  it('suppresses unselected vertex dots at global and regional zoom, showing only at detailed zoom', () => {
    expect(shouldShowVertexDots(2, false)).toBe(false);
    expect(shouldShowVertexDots(5, false)).toBe(false);
    expect(shouldShowVertexDots(6, false)).toBe(false);
    expect(shouldShowVertexDots(9, false)).toBe(false);
    expect(shouldShowVertexDots(10, false)).toBe(true);
    expect(shouldShowVertexDots(12, false)).toBe(true);
    // When isolated, handled by pills
    expect(shouldShowVertexDots(10, true)).toBe(false);
  });

  it('controls swath metric pill visibility across zoom levels', () => {
    // Global zoom: suppressed
    expect(shouldShowSwathPill(3, false)).toBe(false);
    expect(shouldShowSwathPill(3, true)).toBe(false);

    // Regional zoom: only if isolated
    expect(shouldShowSwathPill(7, false)).toBe(false);
    expect(shouldShowSwathPill(7, true)).toBe(true);

    // Detailed zoom: always visible
    expect(shouldShowSwathPill(10, false)).toBe(true);
    expect(shouldShowSwathPill(10, true)).toBe(true);
  });

  it('retains centroid point markers at global scale (z <= 5) for clustering', () => {
    // At global scale (z <= 5), hideCenterPoint is false so centroid markers feed into cluster groups
    expect(shouldHideCenterPoint(true, true, 2)).toBe(false);
    expect(shouldHideCenterPoint(true, true, 5)).toBe(false);

    // At regional and detailed zoom (z > 5), hideCenterPoint is true when polygons/circles exist
    expect(shouldHideCenterPoint(true, true, 6)).toBe(true);
    expect(shouldHideCenterPoint(true, true, 10)).toBe(true);

    // If polygons are toggled off, never hide center points
    expect(shouldHideCenterPoint(true, false, 8)).toBe(false);
    // If no polygons or circles exist, never hide center points
    expect(shouldHideCenterPoint(false, true, 8)).toBe(false);
  });
});

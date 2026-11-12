/**
 * Boundary Semantics & Scale-Dependent Display Rules
 * Conforms to COMPETITOR_WARNING_DESIGN_STUDY.md Phase 4
 */

export type BoundaryStyleType = 'solid' | 'dashed' | 'dotted';

export interface BoundaryStyleResult {
  dashArray?: string;
  styleType: BoundaryStyleType;
  color: string;
  weight: number;
  fillOpacity: number;
}

/**
 * Derives boundary dash pattern based on data quality and verification tier.
 * - Solid border (undefined): EXPLICIT geometry
 * - Dashed border ('8, 6'): INFERRED / heuristic geometry
 * - Dotted amber border ('3, 5'): Tier B unverified geometry
 */
export function getBoundaryDashArray(
  isUnverified: boolean,
  dataQuality?: string
): string | undefined {
  if (isUnverified) {
    return '3, 5'; // Dotted border for Tier B unverified
  }
  const q = (dataQuality || '').toUpperCase();
  if (q === 'INFERRED' || q === 'APPROXIMATE' || q === 'AMBIGUOUS') {
    return '8, 6'; // Dashed border for Inferred
  }
  return undefined; // Solid border for Explicit
}

export function getBoundaryStyleType(
  isUnverified: boolean,
  dataQuality?: string
): BoundaryStyleType {
  if (isUnverified) return 'dotted';
  const q = (dataQuality || '').toUpperCase();
  if (q === 'INFERRED' || q === 'APPROXIMATE' || q === 'AMBIGUOUS') return 'dashed';
  return 'solid';
}

/**
 * Zoom-level decluttering scale categorizer:
 * - global: z <= 5 (suppress vertex handles and swath tags, cluster centroids)
 * - regional: z 6..9 (simplified borders, suppress unselected vertices & swath tags)
 * - detailed: z >= 10 (interactive vertex pills, swath metrics, high telemetry)
 */
export function getZoomScaleCategory(zoom: number): 'global' | 'regional' | 'detailed' {
  if (zoom <= 5) return 'global';
  if (zoom <= 9) return 'regional';
  return 'detailed';
}

/**
 * Determines whether numbered vertex pills (V1..Vn) should render.
 */
export function shouldShowVertexPills(zoom: number, isIsolated: boolean): boolean {
  if (zoom <= 5) return false;
  return isIsolated;
}

/**
 * Determines whether subtle vertex dots should render for unselected geometries.
 */
export function shouldShowVertexDots(zoom: number, isIsolated: boolean): boolean {
  if (zoom <= 5) return false;
  if (isIsolated) return false; // Handled by numbered vertex pills instead
  return zoom >= 10; // At detailed zoom, show subtle dots for context
}

/**
 * Determines whether swath width metric pills (e.g. "6 NM Swath") should render.
 */
export function shouldShowSwathPill(zoom: number, isIsolated: boolean): boolean {
  if (zoom <= 5) return false;
  if (zoom <= 9) return isIsolated;
  return true;
}

/**
 * Determines whether the centroid/center marker of a polygon or circle should be hidden.
 * At global scale (z <= 5), centroid points are NOT hidden so they participate in clusters.
 */
export function shouldHideCenterPoint(
  hasPolygonsOrCircles: boolean,
  showPolygons: boolean,
  zoom: number
): boolean {
  if (zoom <= 5) return false;
  return showPolygons && hasPolygonsOrCircles;
}

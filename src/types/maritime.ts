// src/types/maritime.ts
// Comprehensive maritime spatial types for modern navigational warnings (S-124 / NAVAREA / GMDSS)

export type SpatialPlotType =
  | 'all'
  | 'polygon'
  | 'circle'
  | 'line'
  | 'corridor'
  | 'drift'
  | 'point'
  | 'rig';

export type PlotType =
  | 'polygon'
  | 'circle'
  | 'line'
  | 'corridor'
  | 'point'
  | 'drift_vector';

export type HazardType =
  | 'firing'
  | 'bombing'
  | 'danger_area'
  | 'submarine_cable'
  | 'pipeline'
  | 'seismic_survey'
  | 'wreck'
  | 'buoy'
  | 'platform'
  | 'rig'
  | 'drifting_hazard'
  | 'other';

export interface MaritimePlot {
  id: string;
  warningId: string;
  navarea: string;
  hazardType: HazardType;
  plotType: PlotType;
  coordinates: [number, number][]; // [lat, lng]
  radiusNm?: number;
  bufferNm?: number;
  bearingDeg?: number;
  areaSqNm?: number;
  lengthNm?: number;
  label: string;
  rawTextSnippet: string;
}

export interface GeodesicPoint {
  lat: number;
  lng: number;
}

export interface GeodesicMeasurement {
  totalDistanceNm: number;
  legDistancesNm: number[];
  surfaceAreaSqNm?: number;
  centroid?: [number, number];
  clearanceWidthNm?: number;
}

export interface CorridorGeometry {
  centerLine: [number, number][];
  boundaryPolygon: [number, number][];
  widthNm: number;
  lengthNm: number;
  label?: string;
}

export interface DriftVector {
  origin: [number, number];
  destination: [number, number];
  bearingDeg: number;
  speedKts?: number;
  distanceNm: number;
  directionLabel?: string;
  observedAt?: string;
}

export interface ClearanceDirective {
  type: 'radius' | 'wide_berth' | 'safety_zone' | 'corridor';
  value: number;
  unit: 'nm' | 'metres' | 'km';
  radiusNm: number;
  rawText: string;
}

export interface MaritimePlotFeature {
  id: string;
  warningId: string;
  plotType: SpatialPlotType;
  title: string;
  navarea: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  category: string;
  coordinates: [number, number][];
  measurements?: GeodesicMeasurement;
  corridor?: CorridorGeometry;
  drift?: DriftVector;
  clearance?: ClearanceDirective;
  rawText?: string;
  isVerified?: boolean;
}

export interface MapFilterState {
  plotType: SpatialPlotType;
  showPolygons: boolean;
  showCircles: boolean;
  showLines: boolean;
  showCorridors: boolean;
  showDriftVectors: boolean;
  showPointMarkers: boolean;
  showVertexPins: boolean;
  showCentroidBadges: boolean;
  showRadialLines: boolean;
  showSeamarks: boolean;
  showSoundings: boolean;
  enableClustering: boolean;
}

// src/types/navarea.ts
// Maritime NAVAREA full-corpus domain model & spatial schemas

export type HazardCategory =
  | 'sar'
  | 'mil_fire'
  | 'uxo'
  | 'weather'
  | 'ice'
  | 'security'
  | 'drift'
  | 'wreck'
  | 'cable'
  | 'survey'
  | 'rig'
  | 'aton'
  | 'restricted'
  | 'ops'
  | 'service_status'
  | 'general_chart';

export type Archetype =
  | 'point'
  | 'point_radius'
  | 'polygon'
  | 'polyline'
  | 'corridor'
  | 'multipoint'
  | 'relocation'
  | 'geometry_group'
  | 'region'
  | 'drift_vector'
  | 'none';

export type Severity = 'critical' | 'high' | 'caution' | 'info';

export type DisplayStyle = 'critical' | 'high' | 'active' | 'verified' | 'neutral';

export type AtoNStatus = 'alert' | 'info' | 'chart_correction' | 'relocation' | 'standard';

export interface SubjectSignature {
  navarea: string;
  category: HazardCategory;
  archetype: Archetype;
  regionTokens: string[];
}

export interface SupersessionEvidence {
  signature: SubjectSignature;
  sharedEntities: string[];
  requires: boolean;
}

export interface TimeWindow {
  start?: string; // ISO 8601 UTC
  end?: string;   // ISO 8601 UTC
  rawText?: string;
}

export interface TemporalRecurrence {
  dailyStartUtc?: string; // HH:mm
  dailyEndUtc?: string;   // HH:mm
  daysOfWeek?: number[];  // 0=Sun..6=Sat
  dates?: string[];       // YYYY-MM-DD
  isActiveNow?: boolean;
}

export interface NavWarnCoordinate {
  lat: number;
  lng: number;
  label?: string;
  eta?: string;
  isGhost?: boolean;
}

export interface NavWarnGeometry {
  archetype: Archetype;
  coordinates: NavWarnCoordinate[];
  polygons?: NavWarnCoordinate[][];
  radiusNm?: number;
  clearanceNm?: number;
  statedRadiusNm?: number;
  displacementVector?: {
    from: NavWarnCoordinate;
    to: NavWarnCoordinate;
  };
  regionName?: string;
  bbox?: [number, number, number, number]; // [minLat, minLng, maxLat, maxLng]
}

export interface Lifecycle {
  inForce: boolean;
  cancelledBy?: string[];
  expiresAt?: string;
  supersedes?: string[];
  supersededBy?: string[];
  truncated?: boolean;
  isPartialList?: boolean;
  unplottedReason?: 'no_coordinates' | 'parse_failure' | 'meta_list' | 'text_unavailable';
  resolutionRule?: 'in_force_list' | 'cross_cancel' | 'self_cancel' | 'supersession' | 'expired_window' | 'none';
  resolutionRefs?: string[];
}

export interface RawMessageBlock {
  warningId: string;
  navarea: string;
  number: number;
  year: number;
  rawHeader: string;
  rawBody: string;
  rawText: string;
  issuedAt?: string;
  subjectCode?: string;
  regionTokens: string[];
  charts: string[];
  truncated?: boolean;
  filePosition: number;
  sourceFeed: string;
}

export interface ParsedNavWarning {
  warningId: string;
  navarea: string;
  number: number;
  year: number;
  issuedAt?: string;
  subjectCode?: string;
  regionTokens: string[];
  charts: string[];
  
  category: HazardCategory;
  severity: Severity;
  displayStyle: DisplayStyle;
  atonStatus?: AtoNStatus;
  
  geometry: NavWarnGeometry;
  temporalWindows?: TimeWindow[];
  recurrence?: TemporalRecurrence;
  contactInfo?: string[];
  
  lifecycle: Lifecycle;
  
  rawText: string;
  truncated?: boolean;
  filePosition: number;
  sourceFeed: string;
}

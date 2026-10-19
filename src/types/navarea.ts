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
  | 'sector_wedge'
  | 'polygon_bounding_box'
  | 'none';

export type Severity = 'critical' | 'high' | 'caution' | 'info';

export type DisplayStyle = 'critical' | 'high' | 'active' | 'verified' | 'neutral' | 'explicit' | 'inferred' | 'ambiguous' | 'invalid' | 'review';

export type AtoNStatus = 'alert' | 'info' | 'chart_correction' | 'relocation' | 'standard';

export interface SpanEdit {
  ruleId: number;
  cleanStart: number;
  cleanEnd: number;
  rawStart: number;
  rawEnd: number;
  valuePreserving: boolean;
}

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
  timeReference?: 'UTC' | 'LOCAL';
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
  corridorHalfWidthM?: number;
  berthRadiusM?: number;
  statedRadiusNm?: number;
  displacementVector?: {
    from: NavWarnCoordinate;
    to: NavWarnCoordinate;
  };
  regionName?: string;
  bbox?: [number, number, number, number]; // [minLat, minLng, maxLat, maxLng]
  startBearing?: number;
  endBearing?: number;
}

export interface Lifecycle {
  inForce: boolean;
  cancelledBy?: string[];
  expiresAt?: string;
  supersedes?: string[];
  supersededBy?: string[];
  truncated?: boolean;
  isPartialList?: boolean;
  unplottedReason?:
    | 'no_coordinates'
    | 'parse_failure'
    | 'meta_list'
    | 'text_unavailable'
    | 'empty_stub'
    | 'cancellation_only'
    | 'truncated_clause'
    | 'orphan_fragment'
    | 'missing_hemisphere'
    | 'duplicate_of';
  resolutionRule?: 'in_force_list' | 'cross_cancel' | 'self_cancel' | 'supersession' | 'expired_window' | 'none';
  resolutionRefs?: string[];
  proposedCancel?: {
    status: 'cancelled' | 'expired' | 'superseded';
    because: string[];
  };
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

// ═══════════ SUPABASE POSTGIS RELATIONAL SCHEMA CONTRACTS ═══════════

export type FeatureType =
  | 'POINT'
  | 'LINE'
  | 'POLYGON'
  | 'CORRIDOR'
  | 'SWEEP_ARC'
  | 'BOUNDING_BOX';

export type TriageTier = 'A' | 'B' | 'C';
export type DataQuality = 'EXPLICIT' | 'INFERRED' | 'AMBIGUOUS' | 'INVALID';
export type Status = 'active' | 'cancelled' | 'expired' | 'superseded' | 'unverified';
export type ParsingMethod = 'RULE' | 'AI';

export interface NavWarningSpatial {
  warning_id: string; // Master table UUID
  canonical_id: string; // e.g. 'NAVAREA IV 1042/26'
  navarea: string;
  title: string | null;
  area_text: string | null;
  categories: string[] | null;
  status: Status;
  triage_tier: TriageTier;
  data_quality: DataQuality;
  valid_from: string | null;
  valid_to: string | null;
  radio_frequencies: string[] | null;
  space_launch_mission: string | null;
  geom_id: string;
  zone_label: string | null;
  feature_type: FeatureType;
  buffer_nm: number | null;
  corridor_half_width_nm: number | null;
  altitude_floor_m: number | null;
  altitude_ceiling_fl: number | null;
  geojson_blob: any; // Direct pre-calculated GeoJSON feature from PostGIS
}

export interface NavWarningReviewItem {
  warning_id: string; // Matches public.nav_warnings_review_queue view alias
  canonical_id: string;
  navarea: string;
  raw_text: string;
  triage_tier: TriageTier;
  data_quality: DataQuality;
  unplotted_reason: string | null;
  qa_flags: string[];
  issued_at: string;
}

export interface NavWarningAuditRecord {
  warning_id: string;
  operator_id: string;
  previous_tier: TriageTier;
  new_tier: TriageTier;
  action: 'PROMOTE' | 'DEMOTE' | 'EDIT_GEOMETRY' | 'DISMISS';
  reason?: string;
  signature_hash: string;
  diff_patch?: Record<string, any>;
}

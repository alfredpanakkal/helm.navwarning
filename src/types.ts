export type NavAreaId =
  | 'I'
  | 'Baltic'
  | 'II'
  | 'III'
  | 'IV'
  | 'XII'
  | 'V'
  | 'VI'
  | 'VII'
  | 'VIII'
  | 'IX'
  | 'X'
  | 'XI'
  | 'XIII'
  | 'XIV'
  | 'XV'
  | 'XVI'
  | 'XVII'
  | 'XVIII'
  | 'XIX'
  | 'XX'
  | 'XXI';

export type SourceVerificationStatus = 'verified' | 'unverified' | 'investigating' | 'disabled';

export type PublicationSemantics = 'complete_in_force' | 'incremental_feed' | 'archive_lookup';

export interface SourceRegistryItem {
  source_id: string;
  publisher_id: string;
  publisher_name: string;
  navareas: NavAreaId[];
  scope: string;
  discovery_url: string;
  entrypoints: string[];
  allowed_hosts: string[];
  format: 'json' | 'html' | 'pdf' | 'text';
  languages: string[];
  parser_id: string;
  publication_semantics: PublicationSemantics;
  poll_interval_minutes: number;
  stale_after_minutes: number;
  enabled: boolean;
  verification: {
    status: SourceVerificationStatus;
    verified_at: string | null;
    notes: string | null;
  };
  health: {
    last_run_at: string | null;
    last_success_at: string | null;
    status: 'ok' | 'warning' | 'error' | 'stale' | 'idle';
    active_warnings_count: number;
    last_error?: string;
  };
  published_generation_id: string | null;
}

export type WarningStatus = 'active' | 'cancelled' | 'expired' | 'unknown';

export type StatusBasis =
  | 'listed_in_complete_in_force_publication'
  | 'absent_from_complete_in_force_publication'
  | 'explicit_cancellation_notice'
  | 'absent_from_incremental_feed'
  | 'manual_user_override'
  | 'manual_csv_import'
  | 'manual_zip_import'
  | 'manual_gpx_import';

export interface SpatialGeometry {
  type: 'Point' | 'Polygon' | 'LineString' | 'Circle';
  // Coordinates are [lng, lat]
  coordinates: number[] | number[][] | number[][][];
  radius_nm?: number;
  label?: string;
}

export interface SpatialCircle {
  center: [number, number]; // [lng, lat]
  radius_nm: number;
  label?: string;
}

export interface SpatialData {
  geometries: SpatialGeometry[];
  circles: SpatialCircle[];
  raw_coordinate_text: string[];
  validation_status: 'passed' | 'out_of_bounds' | 'not_present' | 'invalid_format';
}

export interface NavWarning {
  schema_version: number;
  warning_id: string;
  publisher_id: string;
  source_id: string;
  navarea: NavAreaId;
  series: string;
  source_warning_id: string; // e.g., "1234/26"
  warning_number: string;
  warning_year: number;

  issued_at: string | null;
  issued_date: string;
  issued_time_precision: 'day' | 'minute' | 'hour';
  issued_text: string;

  valid_from: string | null;
  valid_to: string | null;
  cancelled_at: string | null;

  status: WarningStatus;
  status_basis: StatusBasis;

  area_text: string;
  original_language: string;
  raw_text: string;
  translated_text: string | null;

  spatial: SpatialData;

  supersedes: string[];
  cancels: string[];

  source_url: string;
  raw_artifact_ref: string;
  content_hash: string;
  parser_version: string;
  extraction_method: 'deterministic' | 'llm_assisted' | 'manual_paste';
  extraction_confidence?: number;

  first_seen_at: string;
  last_seen_at: string;
  not_in_force_observed_at: string | null;

  generation_id: string;

  validation: {
    identity: string;
    dates: string;
    geometry: string;
  };
}

export interface IngestionGeneration {
  generation_id: string;
  source_id: string;
  created_at: string;
  publication_kind: PublicationSemantics;
  parsed_count: number;
  active_count: number;
  explicit_cancellations: string[];
  completeness_status: 'verified' | 'unverified' | 'failed';
  evidence_hash: string;
  artifact_ref: string;
  validation_issues: string[];
}

export interface RawArtifact {
  artifact_id: string;
  source_id: string;
  timestamp: string;
  path: string;
  content_type: string;
  content_hash: string;
  size_bytes: number;
  preview_text: string;
  full_content?: string;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

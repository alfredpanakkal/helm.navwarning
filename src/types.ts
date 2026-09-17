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
    consecutive_failures?: number;
    total_runs_count?: number;
    llm_fallback_count?: number;
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

export type TriageDecision = 'ACCEPTED' | 'REJECTED' | 'NEEDS_REVIEW';

export type TriageRejectionCode =
  | 'NONE'
  | 'NON_MARITIME'
  | 'CORRUPT_DATA'
  | 'OUT_OF_BOUNDS'
  | 'MISSING_CRITICAL_INFO'
  | 'EXPIRED_OR_STALE'
  | 'DUPLICATE'
  | 'OTHER';

export interface AiTriageResult {
  decision: TriageDecision;
  confidence: number;
  understanding_summary: string;
  rejection_code?: TriageRejectionCode;
  rejection_reason?: string;
  hazard_category?: string;
  risk_level?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  coordinate_sanity?: 'valid' | 'suspicious' | 'missing';
  anomalies?: string[];
  reviewed_at?: string;
  original_snippet?: string;
}

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

  // Extended fields for GIS map data and CCG/Kystverket scraper feeds
  title?: string | null;
  authority?: string | null;
  sub_area?: string | null;
  risk_level?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  valid_until?: string | null;
  validity?: string | null;
  charts?: string | null;
  categories?: string | null;
  web_link?: string | null;

  // AI Understanding & Triage Assessment
  ai_triage?: AiTriageResult;

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
  completeness_status: 'verified' | 'unverified' | 'failed' | 'sync_failed';
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

// ==========================================
// IMO ECDIS-Ready Intermediate Layer Schema
// ==========================================

export type GeometryIntent = 'points' | 'area' | 'route' | 'unknown';
export type FeatureInference = 'explicit' | 'inferred';
export type FeatureConfidence = 'verified' | 'partial' | 'rejected';
export type FeatureModificationState = 'original' | 'edited' | 'inserted' | 'deleted';
export type FeatureRoleHint = 'vertex' | 'start' | 'end' | 'intermediate' | null;

export interface EcdisPointFeature {
  type: 'Feature';
  id: string; // uuid for manual editing
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat] in decimal degrees (WGS 84)
  };
  properties: {
    sequence_index: number;
    raw_text: string;
    inference: FeatureInference;
    confidence: FeatureConfidence;
    modification_state: FeatureModificationState;
    user_notes: string;
    errors: string[];
    role_hint: FeatureRoleHint;
  };
}

export interface EcdisIntermediateLayer {
  warningId: string;
  navarea: NavAreaId | string | null;
  editable: true;
  geometry_intent: GeometryIntent;
  features: EcdisPointFeature[];
}

export interface PipelineEvent {
  timestamp: string;
  stage: 'FETCH' | 'PARSE' | 'EXTRACT' | 'CHECK' | 'SAVE' | 'DONE' | 'ERROR';
  source_id?: string;
  message: string;
  details?: string;
}

export interface PipelineRunRecord {
  run_id: string;
  source_id_target?: string;
  started_at: string;
  finished_at?: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
  sources_processed: number;
  records_found: number;
  records_stored: number;
  records_updated: number;
  records_unchanged: number;
  records_failed: number;
  events: PipelineEvent[];
  error?: string;
}

export interface PipelineSystemStatus {
  pipeline: 'READY' | 'RUNNING' | 'ERROR' | 'UNAVAILABLE';
  database: 'CONNECTED' | 'UNAVAILABLE' | 'OFFLINE';
  sources_enabled_count: number;
  sources_total_count: number;
  last_run: {
    run_id: string;
    finished_at: string;
    status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
    found?: number;
    stored?: number;
  } | null;
  current_job: {
    run_id: string;
    target: string;
    started_at: string;
  } | null;
}


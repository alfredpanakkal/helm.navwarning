import { SourceRegistryItem, NavWarning, IngestionGeneration } from '../types';

export type UnifiedStatusType = 'ok' | 'verified' | 'unverified' | 'stale' | 'syncing' | 'failed';

export interface StatusBadgeInfo {
  status: UnifiedStatusType;
  label: string;
  symbol: string;
  badgeClass: string;
  textClass: string;
}

export const STATUS_LOOKUP: Record<UnifiedStatusType, StatusBadgeInfo> = {
  ok: {
    status: 'ok',
    label: 'OK',
    symbol: '✓',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    textClass: 'text-emerald-700',
  },
  verified: {
    status: 'verified',
    label: 'Verified',
    symbol: '✓',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    textClass: 'text-emerald-700',
  },
  unverified: {
    status: 'unverified',
    label: 'Unverified',
    symbol: '⚠',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    textClass: 'text-amber-700',
  },
  stale: {
    status: 'stale',
    label: 'Stale',
    symbol: '◌',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    textClass: 'text-slate-600',
  },
  syncing: {
    status: 'syncing',
    label: 'Syncing',
    symbol: '↻',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-300',
    textClass: 'text-blue-700',
  },
  failed: {
    status: 'failed',
    label: 'Failed',
    symbol: '✕',
    badgeClass: 'bg-red-50 text-red-800 border-red-300',
    textClass: 'text-red-700',
  },
};

export interface AttentionItem {
  id: string;
  title: string;
  category: 'source' | 'warning' | 'pipeline' | 'supabase';
  severity: 'high' | 'medium' | 'low';
  reason: string;
  status: UnifiedStatusType;
  actionLabel?: string;
  actionTab?: string;
  warningId?: string;
}

/**
 * Computes attention-required items across sources, warnings, and generations
 */
export function computeAttentionRequired(
  sources: SourceRegistryItem[],
  warnings: NavWarning[],
  generations?: IngestionGeneration[],
  supabaseConnected: boolean = true
): AttentionItem[] {
  const items: AttentionItem[] = [];

  // 1. Supabase Connection Status
  if (!supabaseConnected) {
    items.push({
      id: 'supabase-disconnect',
      title: 'Supabase Server Unreachable',
      category: 'supabase',
      severity: 'high',
      reason: 'Database synchronization is offline or failing connection handshake.',
      status: 'failed',
      actionLabel: 'Check Supabase',
      actionTab: 'supabase',
    });
  }

  // 2. Unverified or Stale Sources
  sources.forEach((s) => {
    if (!s.enabled) return;

    if (s.verification?.status === 'unverified') {
      items.push({
        id: `source-unverified-${s.source_id}`,
        title: `Unverified Source: ${s.publisher_name}`,
        category: 'source',
        severity: 'medium',
        reason: s.verification.notes || 'Source endpoint needs verification review.',
        status: 'unverified',
        actionLabel: 'Review Source',
        actionTab: 'sources',
      });
    }

    if (s.health?.status === 'stale' || s.health?.status === 'error') {
      items.push({
        id: `source-stale-${s.source_id}`,
        title: `Stale or Error Source: ${s.publisher_name}`,
        category: 'source',
        severity: 'high',
        reason: s.health.last_error || `Poll interval exceeded (${s.stale_after_minutes}m threshold).`,
        status: s.health.status === 'error' ? 'failed' : 'stale',
        actionLabel: 'Trigger Sync',
        actionTab: 'workspace',
      });
    }
  });

  // 3. Warnings needing validation or confidence attention
  warnings.forEach((w) => {
    if (w.status === 'active' && w.extraction_confidence && w.extraction_confidence < 0.8) {
      items.push({
        id: `warning-low-confidence-${w.warning_id}`,
        title: `Low Extraction Confidence: ${w.source_warning_id}`,
        category: 'warning',
        severity: 'medium',
        reason: `Extraction confidence is ${(w.extraction_confidence * 100).toFixed(0)}%. Manual verification recommended.`,
        status: 'unverified',
        actionLabel: 'Inspect Warning',
        actionTab: 'databank',
        warningId: w.warning_id,
      });
    }

    if (w.spatial?.validation_status === 'out_of_bounds' || w.spatial?.validation_status === 'invalid_format') {
      items.push({
        id: `warning-spatial-${w.warning_id}`,
        title: `Spatial Geometry Error: ${w.source_warning_id}`,
        category: 'warning',
        severity: 'high',
        reason: `Geometry status: ${w.spatial.validation_status}. Coordinates require manual adjustment.`,
        status: 'failed',
        actionLabel: 'Edit Geometry',
        actionTab: 'databank',
        warningId: w.warning_id,
      });
    }
  });

  // 4. Failed Generations
  generations?.forEach((g) => {
    if (g.completeness_status === 'failed' || (g.validation_issues && g.validation_issues.length > 0)) {
      items.push({
        id: `generation-failed-${g.generation_id}`,
        title: `Pipeline Generation Issue: ${g.generation_id.slice(0, 8)}`,
        category: 'pipeline',
        severity: 'high',
        reason: g.validation_issues?.[0] || 'Generation marked unverified/failed during atomic ingestion.',
        status: 'failed',
        actionLabel: 'View Audit Log',
        actionTab: 'audit',
      });
    }
  });

  return items;
}

/**
 * Coordinate Format Converter (DD ↔ DMS)
 * Canonical Storage Format: WGS84 Decimal Degrees [lng, lat]
 * Display Formats:
 *  - 'DD': Decimal Degrees (e.g., 1.2833°, 103.8500°)
 *  - 'DMS': Degrees Minutes Seconds (e.g., 01°17'00"N 103°51'00"E)
 */
export function formatCoordinates(
  coords: [number, number], // [lng, lat]
  format: 'DD' | 'DMS' = 'DD'
): string {
  const [lng, lat] = coords;
  if (!lng && !lat) return '0.0000°, 0.0000°';

  if (format === 'DD') {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
  }

  // Convert to DMS
  const convertToDMS = (val: number, isLat: boolean): string => {
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = Math.round((minFloat - min) * 60);

    const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    const degStr = deg.toString().padStart(isLat ? 2 : 3, '0');
    const minStr = min.toString().padStart(2, '0');
    const secStr = sec.toString().padStart(2, '0');

    return `${degStr}°${minStr}'${secStr}"${dir}`;
  };

  return `${convertToDMS(lat, true)} ${convertToDMS(lng, false)}`;
}

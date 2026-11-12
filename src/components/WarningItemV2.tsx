import React, { useState } from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { NavWarning, SourceRegistryItem } from '../types';
import { formatSpatialCoordinates } from '../utils/coordinateParser';
import { copyToClipboard } from '../utils/coordinateConversion';
import { resolveIssuingAuthority } from '../utils/warningAnalyzer';
import { WarningStatusBadge } from './WarningStatusBadge';
import { getWarningBulletinText, getWarningDate, getWarningPositionCount } from '../utils/warningHelpers';

export type WarningSeverityBand = 'CRITICAL' | 'HIGH' | 'MODERATE';

/**
 * Standardized v2 severity banding, aligned with the map marker bands
 * (critical = confidence 1, high >= 0.8, otherwise moderate) and with the
 * status bar "N High" count (confidence >= 0.8).
 */
export function warningSeverity(w: NavWarning): { label: WarningSeverityBand; className: string } {
  const c = w.extraction_confidence;
  if (c === 1) return { label: 'CRITICAL', className: 'bg-rose-50 text-rose-700 border border-rose-200 font-bold' };
  if (typeof c === 'number' && c >= 0.8) return { label: 'HIGH', className: 'bg-orange-50 text-orange-700 border border-orange-200 font-bold' };
  return { label: 'MODERATE', className: 'bg-gw-secondary text-gw-accent border border-gw-secondary font-medium' };
}

export function warningHeadline(w: NavWarning): string {
  return w.title || w.area_text || w.issued_text;
}

export function warningSourceLabel(w: NavWarning, sources?: SourceRegistryItem[]): string {
  if (sources && sources.length > 0) {
    const match = sources.find((s) => s.source_id === w.source_id);
    if (match && match.publisher_name) return match.publisher_name;
  }
  return resolveIssuingAuthority(w);
}

function shortUtcDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatWarningValidity(w: NavWarning): string {
  const from = w.valid_from;
  const to = w.valid_to || w.valid_until || null;
  if (!from && !to) return w.issued_date ? `Issued ${shortUtcDate(w.issued_date)}` : '';
  if (from && to) {
    const d1 = new Date(from);
    const d2 = new Date(to);
    if (d1.getUTCFullYear() === d2.getUTCFullYear()) {
      const s1 = d1.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      const s2 = d2.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      return `${s1} – ${s2} ${d2.getUTCFullYear()}`;
    }
    return `${shortUtcDate(from)} – ${shortUtcDate(to)}`;
  }
  if (from) return `${shortUtcDate(from)} – open`;
  return `until ${shortUtcDate(to as string)}`;
}

/** Same pure coastal check as the map drawer (kept local to avoid an import cycle). */
export const isCoastalWarning = (w: NavWarning): boolean => {
  const s = (w.series || '').toLowerCase();
  const id = (w.source_warning_id || '').toLowerCase();
  const sub = (w.sub_area || '').toLowerCase();
  const raw = (w.raw_text || '').toLowerCase();
  const area = (w.area_text || '').toLowerCase();
  return (
    s.includes('coastal') ||
    id.includes('coastal') ||
    sub.includes('coastal') ||
    raw.includes('coastal warning') ||
    area.includes('coastal') ||
    w.navarea === 'Baltic'
  );
};

function statusDotClass(status: NavWarning['status']): string {
  return status === 'active' ? 'bg-green-600' : status === 'unverified' ? 'bg-amber-500' : 'bg-gw-accent';
}

function statusTextClass(status: NavWarning['status']): string {
  return status === 'active' ? 'text-green-700' : status === 'unverified' ? 'text-amber-700' : 'text-gw-accent';
}

export const WarningSeverityBadge: React.FC<{ warning: NavWarning; className?: string }> = ({
  warning,
  className = '',
}) => {
  const sev = warningSeverity(warning);
  const dotColor =
    sev.label === 'CRITICAL'
      ? 'var(--sev-critical, #c44536)'
      : sev.label === 'HIGH'
      ? 'var(--sev-high, #c07a2b)'
      : 'var(--sev-medium, #6b8f9c)';
  const labelText =
    sev.label === 'CRITICAL' ? 'Critical' : sev.label === 'HIGH' ? 'High' : 'Moderate';

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-[var(--ink-body,#1f2937)] font-[450] shrink-0 ${className}`}>
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: dotColor }}
        aria-hidden="true"
      />
      <span>{labelText}</span>
    </span>
  );
};

export interface WarningHierarchyLinesProps {
  warning: NavWarning;
  sources?: SourceRegistryItem[];
  /** Extra controls rendered just before the severity badge on line 1 (drawer eye toggle). */
  line1Right?: React.ReactNode;
  /** Append the status dot+label to line 3 (table/grouped/mobile; omitted in the drawer). */
  showStatus?: boolean;
  className?: string;
}

/**
 * The mandated warning-item hierarchy, shared by the v2 Data Bank list and the
 * Map View drawer:
 *
 *   NAVAREA XI · 977/26                      [HIGH]
 *   Survey operations in specified area
 *   17 Sep – 15 Oct 2026 · Japan Coast Guard
 */
export const WarningHierarchyLines: React.FC<WarningHierarchyLinesProps> = ({
  warning: w,
  sources,
  line1Right,
  showStatus = true,
  className = '',
}) => {
  const coastal = isCoastalWarning(w);
  const source = warningSourceLabel(w, sources);
  const validity = formatWarningValidity(w);
  return (
    <div className={`space-y-0.5 ${className}`}>
      {/* Line 1 — ID & NAVAREA (secondary, prominent) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-[11px] font-medium text-[var(--accent,#2b6e8c)] truncate">
            NAVAREA {w.navarea} · {w.source_warning_id}
          </span>
          {coastal && (
            <span className="text-[8px] font-mono font-medium px-1 rounded bg-[var(--surface-subtle,#fafbfc)] text-[var(--ink-secondary,#5f6b7a)] border border-[var(--border-input,#dde2e8)] shrink-0">
              COASTAL
            </span>
          )}
          {/TRUNCATED/i.test(w.raw_text || '') && (
            <span className="text-[8px] font-mono font-medium px-1 rounded bg-[var(--surface-subtle,#fafbfc)] text-[var(--sev-high,#c07a2b)] border border-[var(--border-input,#dde2e8)] shrink-0">
              LIST TRUNCATED
            </span>
          )}
          {(!w.spatial?.geometries?.length && !w.spatial?.circles?.length && !w.latitude) && (
            <span className="text-[8px] font-mono font-medium px-1 rounded bg-[var(--surface-subtle,#fafbfc)] text-[var(--ink-secondary,#5f6b7a)] border border-[var(--border-input,#dde2e8)] shrink-0">
              {/IN\s+FORCE/i.test(w.raw_text || '') ? 'UNPLOTTED: META_LIST' : 'UNPLOTTED: NO_COORDS'}
            </span>
          )}
          <WarningStatusBadge warning={w} compact />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {line1Right}
          <WarningSeverityBadge warning={w} />
        </div>
      </div>

      {/* Line 2 — headline (strongest) */}
      <p className="text-[13px] font-[450] text-[var(--ink-body,#1f2937)] leading-snug line-clamp-2">{warningHeadline(w)}</p>

      {/* Line 3 — validity · source · status */}
      <div className="flex items-center gap-1.5 text-[10px] text-[var(--ink-secondary,#5f6b7a)] font-mono min-w-0">
        {validity && <span className="shrink-0">{validity}</span>}
        {validity && <span className="shrink-0 text-[var(--ink-tertiary,#8b97a5)]">·</span>}
        <span className="truncate" title={source}>
          {source}
        </span>
        {showStatus && (
          <span className="flex items-center gap-1 shrink-0 font-medium ml-auto">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(w.status)}`} />
            <span className={statusTextClass(w.status)}>{w.status}</span>
          </span>
        )}
      </div>
    </div>
  );
};

export interface WarningItemDetailsProps {
  warning: NavWarning;
}

/**
 * Expandable technical panel behind "Details". Keeps every technical field
 * that the classic rows exposed (coordinates, issued text/date, confidence,
 * raw message) without competing with the hierarchy lines above.
 */
export const WarningItemDetails: React.FC<WarningItemDetailsProps> = ({ warning: w }) => {
  const conf = w.extraction_confidence;
  const [copiedKey, setCopiedKey] = useState<'coords' | 'raw' | 'uuid' | null>(null);
  const handleCopy = (key: 'coords' | 'raw' | 'uuid', text: string) => {
    copyToClipboard(text).then((success) => {
      if (!success) return;
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2200);
    });
  };
  const positionCount = getWarningPositionCount(w);
  return (
    <div className="mt-2 p-3 bg-gw-bg/60 border-t border-gw-secondary/60 space-y-2.5 text-[11px] animate-in fade-in duration-150">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <span className="text-[10px] font-bold uppercase text-gw-accent block mb-0.5">NAVAREA Region</span>
          <span className="font-bold text-gw-primary inline-block px-2 py-0.5 bg-gw-panel border border-gw-secondary rounded">
            NAVAREA {w.navarea}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase text-gw-accent block mb-0.5">Supabase ID</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (w.db_uuid) handleCopy('uuid', w.db_uuid);
            }}
            disabled={!w.db_uuid}
            title={w.db_uuid ? 'Copy Supabase row id (nav_warnings.id)' : 'No Supabase row id on this record'}
            className={`touch-hit max-w-full truncate inline-block px-2 py-0.5 bg-gw-panel border border-gw-secondary rounded font-mono text-[10px] ${
 copiedKey === 'uuid' ? 'text-emerald-700 border-emerald-300' : 'text-gw-primary hover:text-gw-accent'
 }`}
          >
            {w.db_uuid ? (copiedKey === 'uuid' ? 'Copied!' : w.db_uuid) : '—'}
          </button>
        </div>
        <div>
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[10px] font-bold uppercase text-gw-accent">Parsed Coordinates</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy('coords', formatSpatialCoordinates(w.spatial));
              }}
              className={`touch-hit text-xs font-medium uppercase underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary ${
 copiedKey === 'coords' ? 'text-emerald-700' : 'text-gw-primary hover:text-gw-accent'
 }`}
            >
              {copiedKey === 'coords' ? 'Copied!' : 'Copy Coords'}
            </button>
          </div>
          <div className="font-bold text-gw-primary bg-gw-panel px-2 py-1 border border-gw-secondary rounded flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gw-accent shrink-0" />
            <span className="truncate font-mono">{formatSpatialCoordinates(w.spatial)}</span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[10px] font-bold uppercase text-gw-accent">Issued</span>
          {positionCount > 1 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
              Positions: {positionCount}
            </span>
          )}
        </div>
        <div className="font-bold text-gw-primary bg-gw-panel px-2 py-1 border border-gw-secondary rounded flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-gw-accent shrink-0" />
          <span className="font-mono truncate">
            {getWarningDate(w)}
          </span>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[10px] font-bold uppercase text-gw-accent">Full Raw Telemetry</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy('raw', getWarningBulletinText(w));
            }}
            className={`touch-hit text-xs font-medium uppercase underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary ${
 copiedKey === 'raw' ? 'text-emerald-700' : 'text-gw-primary hover:text-gw-accent'
 }`}
          >
            {copiedKey === 'raw' ? 'Copied!' : 'Copy Raw Telemetry'}
          </button>
        </div>
        <div className="p-2.5 bg-gw-panel border border-gw-secondary rounded text-[11px] text-gw-primary font-mono leading-relaxed max-h-36 overflow-y-auto no-scrollbar">
          {getWarningBulletinText(w)}
        </div>
      </div>

      <div className="flex justify-between items-center text-[10px] pt-1">
        <span className="text-gw-accent font-bold">Extraction Confidence:</span>
        <span className="font-bold text-gw-primary bg-gw-panel px-2 py-0.5 rounded border border-gw-secondary">
          {typeof conf === 'number' && Number.isFinite(conf) ? `${Math.round(conf * 100)}% Match` : 'Not recorded'}
        </span>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { NavWarning } from '../types';
import { fetchWarningAudit, WarningAuditRow } from '../services/warningAuditApi';
import { EcdisFeatureEditor } from './EcdisFeatureEditor';
import { extractEcdisIntermediateLayer } from '../utils/coordinateParser';
import { copyToClipboard } from '../utils/coordinateConversion';
import { getWarningBulletinText, getWarningDate, getWarningPositionCount } from '../utils/warningHelpers';
import {
  extractWarningKeywords,
  extractWarningCoordinateList,
  exportWarningAsGeoJSON,
  exportWarningAsKML,
  exportWarningAsTextCoordinates,
  downloadFile,
  GeometryCoordinatePoint,
} from '../utils/nauticalExport';
import {
  ShieldCheck,
  ShieldAlert,
  Globe,
  MapPin,
  Clock,
  FileText,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Code,
  Tag,
  ExternalLink,
  Edit3,
  Crosshair,
  Download,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Navigation,
  Compass,
  Check,
  Filter,
  History,
} from 'lucide-react';
import { useModalBehavior } from '../hooks/useModalBehavior';

interface WarningDetailModalProps {
  warning: NavWarning | null;
  onClose: () => void;
  onVerify?: (warningId: string) => void | Promise<{ ok: boolean; error?: string }>;
  /** Opens the admin edit modal for this warning (phone replacement for the desktop-only Edit FAB). */
  onEditWarning?: (warning: NavWarning) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  onIsolateWarning?: (warning: NavWarning) => void;
  isIsolated?: boolean;
  onClearIsolation?: () => void;
}

export const WarningDetailModal: React.FC<WarningDetailModalProps> = ({
  warning,
  onClose,
  onVerify,
  onEditWarning,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
  onIsolateWarning,
  isIsolated,
  onClearIsolation,
}) => {
  const [activeTab, setActiveTab] = useState<'message' | 'geometry' | 'ecdis' | 'audit'>('message');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  // Verify outcome surfaced to the operator: a failed audited VERIFY is shown
  // inline; success is announced via role=status (the row repaint is not
  // announced by assistive tech on its own).
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyAnnouncement, setVerifyAnnouncement] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalBehavior(dialogRef, !!warning);

  // Audit trail (read-only) state — lazily fetched only when the Audit tab opens.
  const [auditRows, setAuditRows] = useState<WarningAuditRow[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditLoadedFor, setAuditLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Audit trail: fetch read-only nav_warning_audits rows the first time the
  // Audit tab is opened for this warning. Reads go through the admin-guarded
  // /api/admin/warning-audit endpoint — this panel never writes.
  useEffect(() => {
    if (activeTab !== 'audit' || !warning) return;
    const key = String((warning as any).db_uuid || warning.warning_id);
    if (auditLoadedFor === key) return;
    let cancelled = false;
    setAuditLoading(true);
    setAuditError(null);
    fetchWarningAudit({
      warningId: (warning as any).db_uuid || undefined,
      canonicalId: warning.warning_id,
      limit: 100,
    }).then((res) => {
      if (cancelled) return;
      setAuditLoading(false);
      if (res.ok) {
        setAuditRows(res.audits);
        setAuditLoadedFor(key);
      } else {
        setAuditRows([]);
        setAuditError(res.error || 'Audit lookup failed.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, warning, auditLoadedFor]);

  if (!warning) return null;

  const positionCount = getWarningPositionCount(warning);

  const warningIdCode = warning.source_warning_id || `NAVAREA ${warning.navarea} ${warning.warning_number}/${warning.warning_year}`;
  const keywords = extractWarningKeywords(warning.raw_text || warning.issued_text || warning.area_text);
  const coordinatePoints = extractWarningCoordinateList(warning);

  const handleCopy = async (text: string, type: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2200);
    }
  };

  // Single-fire Verify: Quick Verify goes through the admin-guarded,
  // audited warning-edit endpoint, so a double-click must not fire two
  // VERIFY writes. The lock releases when the write settles; the modal only
  // auto-advances to the next queue candidate when the verify succeeded.
  const handleVerifyClick = () => {
    if (!onVerify || verifyPending) return;
    setVerifyPending(true);
    setVerifyError(null);
    setVerifyAnnouncement('');
    Promise.resolve(onVerify(warning.warning_id))
      .then((result) => {
        if (result && result.ok === false) {
          // Failure must be visible and the modal must stay on this warning:
          // the operator must never mistake a failed verify for a saved one.
          setVerifyError(result.error ? `Verify failed — not saved. ${result.error}` : 'Verify failed — not saved.');
        } else {
          setVerifyAnnouncement('Verified');
          if (hasNext && onNext) onNext();
        }
      })
      .catch(() => {
        setVerifyError('Verify failed — not saved.');
      })
      .finally(() => {
        setVerifyPending(false);
      });
  };

  const handleExportGeoJSON = () => {
    const json = exportWarningAsGeoJSON(warning);
    const filename = `${warning.source_warning_id.replace(/[/\\?%*:|"<>]/g, '_')}_geometry.geojson`;
    downloadFile(json, filename, 'application/geo+json');
    setIsExportMenuOpen(false);
  };

  const handleExportKML = () => {
    const kml = exportWarningAsKML(warning);
    const filename = `${warning.source_warning_id.replace(/[/\\?%*:|"<>]/g, '_')}_geometry.kml`;
    downloadFile(kml, filename, 'application/vnd.google-earth.kml+xml');
    setIsExportMenuOpen(false);
  };

  const handleExportTextCoords = () => {
    const txt = exportWarningAsTextCoordinates(warning);
    const filename = `${warning.source_warning_id.replace(/[/\\?%*:|"<>]/g, '_')}_coords.txt`;
    downloadFile(txt, filename, 'text/plain');
    setIsExportMenuOpen(false);
  };

  return (
    <div className="fixed inset-0 z-console-overlay bg-gw-primary/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <span role="status" aria-live="polite" className="sr-only">{verifyAnnouncement}</span>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="warning-detail-title" className="bg-gw-panel border-2 border-gw-primary rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header Metadata */}
        <div className="p-4 sm:p-5 border-b-2 border-gw-primary bg-gw-bg">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1 min-w-0">
              {/* Badge Row */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="bg-gw-primary text-gw-secondary font-mono text-xs font-bold px-2.5 py-0.5 rounded uppercase tracking-wider shadow-xs">
                  NAVAREA {warning.navarea}
                </span>

                {warning.series && (
                  <span className="bg-gw-secondary text-gw-primary border border-gw-primary font-mono text-xs font-bold px-2 py-0.5 rounded uppercase">
                    {warning.series}
                  </span>
                )}

                <span
                  className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase border shadow-xs ${
                    warning.status === 'active'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-500'
                      : 'bg-rose-100 text-rose-900 border-rose-500'
                  }`}
                >
                  {warning.status === 'active' ? '● Active' : '○ Cancelled'}
                </span>

                  <span className="flex items-center gap-1 text-[11px] font-mono text-gw-accent font-bold px-1.5 py-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{getWarningDate(warning)} UTC</span>
                  </span>
                  {positionCount > 1 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      Positions: {positionCount}
                    </span>
                  )}
              </div>

              {/* Title & Warning Code */}
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2 id="warning-detail-title" className="text-xl sm:text-2xl font-bold text-gw-primary font-mono tracking-tight">
                  {warningIdCode}
                </h2>
                {warning.publisher_id && (
                  <span className="text-xs font-mono text-gw-accent">
                    Pub: {warning.publisher_id}
                  </span>
                )}
              </div>

              {/* Area Subtitle */}
              {warning.area_text && (
                <p className="text-xs font-bold text-gw-primary line-clamp-2">
                  {warning.area_text}
                </p>
              )}

              {/* Parsed Keyword Badges */}
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <Tag className="w-3 h-3 text-gw-accent shrink-0 mr-0.5" />
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-[10px] font-mono font-bold px-2 py-0.5 bg-sky-100 text-sky-900 border border-sky-300 rounded-md uppercase shadow-xs"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            {/* Close Modal Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="text-gw-accent hover:text-gw-primary font-bold text-xl p-1.5 rounded-lg hover:bg-gw-secondary transition-colors shrink-0"
              title="Close modal (Esc)"
            >
              ✕
            </button>
          </div>

          {/* Dual Tab Navigation */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gw-secondary">
            <button
              type="button"
              onClick={() => setActiveTab('message')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all shadow-xs ${
                activeTab === 'message'
                  ? 'bg-gw-primary text-gw-bg shadow-sm'
                  : 'bg-secondary text-gw-primary border-primary hover:bg-gw-bg'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Tab 1: Message</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('geometry')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all shadow-xs ${
                activeTab === 'geometry'
                  ? 'bg-gw-primary text-gw-bg shadow-sm'
                  : 'bg-secondary text-gw-primary border-primary hover:bg-gw-bg'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Tab 2: Geometry</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-gw-secondary text-gw-primary border border-gw-primary font-bold">
                {coordinatePoints.length > 0 ? coordinatePoints.length : '0'} pts
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ecdis')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                activeTab === 'ecdis'
                  ? 'bg-gw-primary text-gw-bg'
                  : 'text-gw-accent hover:text-gw-primary hover:bg-gw-secondary'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ECDIS Layer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                activeTab === 'audit'
                  ? 'bg-gw-primary text-gw-bg'
                  : 'text-gw-accent hover:text-gw-primary hover:bg-gw-secondary'
              }`}
              title="Read-only audit trail for this warning (nav_warning_audits)"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Audit Trail</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs text-gw-primary">
          {/* TAB 1: MESSAGE */}
          {activeTab === 'message' && (
            <div className="space-y-4">
              {/* Verbatim Broadcast Container */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold text-gw-primary uppercase tracking-wider">
                    <FileText className="w-4 h-4 text-gw-primary" />
                    <span>Verbatim Raw NAVTEX / Broadcast Notice</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(getWarningBulletinText(warning), 'raw')}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-gw-bg hover:bg-gw-primary hover:text-gw-bg border border-gw-primary rounded text-xs font-mono font-bold uppercase transition-all"
                  >
                    {copiedType === 'raw' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Message</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="bg-gw-primary text-gw-secondary p-4 sm:p-5 rounded-xl font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto shadow-inner border border-gw-primary select-all">
                  {getWarningBulletinText(warning)}
                </pre>
              </div>

              {/* Machine Translation if present */}
              {warning.translated_text && (
                <div className="space-y-2 pt-2 border-t border-gw-secondary">
                  <div className="flex items-center gap-2 text-xs font-bold text-gw-primary uppercase tracking-wider">
                    <Globe className="w-4 h-4 text-sky-600" />
                    <span>
                      English Translation (Source: {warning.original_language?.toUpperCase() || 'ORIGINAL'})
                    </span>
                  </div>
                  <div className="bg-gw-bg border border-gw-primary p-4 rounded-xl text-gw-primary font-medium italic leading-relaxed text-xs sm:text-sm">
                    "{warning.translated_text}"
                  </div>
                </div>
              )}

              {/* Operator Quarantine Banner if AMBIGUOUS or INVALID */}
              {((warning.ambiguous_positions && warning.ambiguous_positions.length > 0) ||
                warning.data_quality === 'AMBIGUOUS' ||
                warning.data_quality === 'INVALID') && (
                <div className="p-4 bg-rose-50 border-2 border-rose-500 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-900 font-bold font-mono text-xs uppercase">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>⚠️ Operator Quarantine: Automated Charting Blocked</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed font-sans">
                    This warning contains coordinates with missing or ambiguous hemisphere identifiers, or failed grounding checks. In accordance with maritime safety rules, geometric mapping is blocked until manually reconciled.
                  </p>
                  {warning.ambiguous_positions && warning.ambiguous_positions.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-mono font-bold uppercase text-rose-900">Quarantined Position Candidates:</div>
                      {warning.ambiguous_positions.map((pos, pidx) => (
                        <div key={pidx} className="bg-gw-panel/80 p-2 rounded border border-rose-300 font-mono text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-rose-900">{pos.raw_text}</span>
                            <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold uppercase">
                              {pos.reason}
                            </span>
                          </div>
                          <div className="text-[10px] text-gw-accent flex items-center gap-3">
                            <span>Lat Hem: {pos.has_lat_hem ? '✓ Present' : '✗ Missing'}</span>
                            <span>Lon Hem: {pos.has_lon_hem ? '✓ Present' : '✗ Missing'}</span>
                            {pos.suggested_lat_dir && (
                              <span className="text-blue-700 font-bold">Suggested: {pos.suggested_lat_dir}/{pos.suggested_lon_dir}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Grounding Diagnostic Box */}
              {warning.grounding_diagnostic && (
                <div className="p-3 bg-gw-secondary border border-gw-secondary rounded-xl space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between font-bold text-gw-primary text-[11px] uppercase">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-gw-accent" />
                      <span>Coordinate Grounding Diagnostic</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      warning.grounding_diagnostic.grounded
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {warning.grounding_diagnostic.grounded ? 'GROUNDED (100% VERBATIM)' : 'UNGROUNDED'}
                    </span>
                  </div>
                  <div className="text-[10px] text-gw-accent space-y-1">
                    <div>Checked: {warning.grounding_diagnostic.checked_count} coordinate phrase(s)</div>
                    {warning.grounding_diagnostic.matched_phrases.length > 0 && (
                      <div className="text-emerald-700 truncate">
                        Matched: {warning.grounding_diagnostic.matched_phrases.join(', ')}
                      </div>
                    )}
                    {warning.grounding_diagnostic.unmatched_phrases.length > 0 && (
                      <div className="text-rose-700 font-bold">
                        Unmatched / Hallucinated: {warning.grounding_diagnostic.unmatched_phrases.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Radius Specification Box if present */}
              {warning.radius_specifications && warning.radius_specifications.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1 font-mono text-xs">
                  <div className="text-[10px] font-bold text-blue-900 uppercase">Radius Specification (Normalised)</div>
                  {warning.radius_specifications.map((r, ridx) => (
                    <div key={ridx} className="text-[11px] text-blue-800 flex items-center justify-between">
                      <span>"{r.raw_text}"</span>
                      <span className="font-bold bg-gw-panel px-2 py-0.5 rounded border border-blue-300 text-blue-900">
                        {r.radius_nm} NM ({r.stated_value} {r.stated_unit})
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Provenance & Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-gw-bg p-3.5 rounded-xl border border-gw-primary font-mono text-[11px]">
                <div>
                  <div className="text-gw-accent uppercase font-bold text-[10px]">Publisher</div>
                  <div className="text-gw-primary font-bold truncate">{warning.publisher_id || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-gw-accent uppercase font-bold text-[10px]">Data Quality</div>
                  <div className={`font-bold uppercase text-[11px] ${
                    warning.data_quality === 'EXPLICIT'
                      ? 'text-emerald-700'
                      : warning.data_quality === 'INFERRED'
                      ? 'text-amber-700'
                      : 'text-rose-700'
                  }`}>
                    {warning.data_quality || 'EXPLICIT'}
                  </div>
                </div>
                <div>
                  <div className="text-gw-accent uppercase font-bold text-[10px]">Spatial Integrity</div>
                  <div className="text-gw-primary font-bold uppercase">
                    {warning.spatial?.validation_status || 'passed'}
                  </div>
                </div>
                <div>
                  <div className="text-gw-accent uppercase font-bold text-[10px]">Status Basis</div>
                  <div className="text-gw-primary font-bold truncate" title={warning.status_basis}>
                    {warning.status_basis || 'In-force feed'}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <div className="text-gw-accent uppercase font-bold text-[10px]">Supabase Row ID (nav_warnings.id)</div>
                  <button
                    type="button"
                    onClick={() => {
                      const uuid = (warning as any).db_uuid;
                      if (uuid) handleCopy(uuid, 'uuid');
                    }}
                    disabled={!(warning as any).db_uuid}
                    title={(warning as any).db_uuid ? 'Copy Supabase row id' : 'No Supabase row id on this record'}
                    className={`max-w-full truncate inline-block px-2 py-0.5 bg-gw-panel border rounded font-bold ${
                      copiedType === 'uuid' ? 'text-emerald-700 border-emerald-300' : 'text-gw-primary border-gw-secondary hover:text-gw-accent'
                    }`}
                  >
                    {(warning as any).db_uuid ? (copiedType === 'uuid' ? 'Copied!' : (warning as any).db_uuid) : '—'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GEOMETRY */}
          {activeTab === 'geometry' && (
            <div className="space-y-5">
              {/* Parsed Coordinate Points Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold text-gw-primary uppercase tracking-wider">
                    <Navigation className="w-4 h-4 text-sky-600" />
                    <span>Parsed Bounding Coordinates & Segment Bearings</span>
                  </span>
                  <span className="text-[11px] font-mono text-gw-accent font-bold">
                    {coordinatePoints.length} discrete vertices
                  </span>
                </div>

                {coordinatePoints.length === 0 ? (
                  <div className={`p-6 text-center rounded-xl border font-mono ${
                    warning.ambiguous_positions && warning.ambiguous_positions.length > 0
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : 'bg-gw-bg border-gw-secondary text-gw-accent'
                  }`}>
                    {warning.ambiguous_positions && warning.ambiguous_positions.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="font-bold flex items-center justify-center gap-1.5 text-rose-900">
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Geometry Quarantined (Defective Hemisphere / Safety Policy)</span>
                        </div>
                        <p className="text-xs text-rose-700 max-w-lg mx-auto">
                          Automated spatial geometry generation was suppressed because coordinate candidates lacked full hemisphere indicators.
                        </p>
                      </div>
                    ) : (
                      <span>No discrete boundary coordinates parsed for this notice.</span>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto border-2 border-gw-primary rounded-xl shadow-xs">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="bg-gw-primary text-gw-bg uppercase tracking-wider text-[10px]">
                          <th className="p-2.5 border-r border-gw-tertiary">#</th>
                          <th className="p-2.5 border-r border-gw-tertiary">Latitude (DMM / DD)</th>
                          <th className="p-2.5 border-r border-gw-tertiary">Longitude (DMM / DD)</th>
                          <th className="p-2.5">Segment Bearing & Dist</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gw-secondary bg-gw-panel">
                        {coordinatePoints.map((pt) => (
                          <tr key={pt.index} className="hover:bg-gw-bg transition-colors">
                            <td className="p-2.5 font-bold text-gw-primary border-r border-gw-secondary">
                              #{pt.index}
                            </td>
                            <td className="p-2.5 border-r border-gw-secondary">
                              <div className="font-bold text-gw-primary">{pt.nauticalLat}</div>
                              <div className="text-[10px] text-gw-accent">{pt.decimalLat}</div>
                            </td>
                            <td className="p-2.5 border-r border-gw-secondary">
                              <div className="font-bold text-gw-primary">{pt.nauticalLng}</div>
                              <div className="text-[10px] text-gw-accent">{pt.decimalLng}</div>
                            </td>
                            <td className="p-2.5">
                              {pt.bearingToNext ? (
                                <div className="flex items-center gap-1.5">
                                  <Compass className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                  <span className="font-bold text-sky-900">{pt.bearingToNext}</span>
                                  <span className="text-gw-accent font-medium">({pt.distanceToNext})</span>
                                </div>
                              ) : (
                                <span className="text-gw-accent italic">---</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Safety Circles & Buffers if present */}
              {warning.spatial?.circles && warning.spatial.circles.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gw-secondary">
                  <div className="text-xs font-bold text-gw-primary uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Safety / Exclusion Circle Hazards</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {warning.spatial.circles.map((c, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-amber-50/70 border border-amber-300 rounded-lg font-mono text-xs space-y-1"
                      >
                        <div className="font-bold text-amber-900">
                          Zone #{idx + 1}: {c.label || 'Safety Radius'}
                        </div>
                        <div className="text-gw-primary font-bold">
                          Center: [{c.center[1]}°N, {c.center[0]}°E]
                        </div>
                        <div className="text-amber-800 text-[11px]">
                          Radius: {c.radius_nm} NM ({c.radius_nm * 1852} meters)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ECDIS MANUAL UPDATE OFFICER LAYER */}
          {activeTab === 'ecdis' && (
            <div className="space-y-4">
              <EcdisFeatureEditor
                warningId={warning.source_warning_id || warning.warning_id}
                navarea={warning.navarea}
                rawText={warning.raw_text}
              />
            </div>
          )}

          {/* TAB 4: READ-ONLY AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold text-gw-primary uppercase tracking-wider">
                  <History className="w-4 h-4 text-gw-primary" />
                  <span>Audit History (Read-Only)</span>
                </span>
                <span className="text-[11px] font-mono text-gw-accent font-bold">
                  {auditRows ? `${auditRows.length} entr${auditRows.length === 1 ? 'y' : 'ies'}` : ''}
                </span>
              </div>

              {auditLoading && (
                <div className="p-4 text-center text-xs font-mono text-gw-accent" role="status">
                  Loading audit rows…
                </div>
              )}
              {auditError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-[11px] font-mono text-rose-800" role="alert">
                  {auditError}
                </div>
              )}
              {auditRows && auditRows.length === 0 && !auditError && (
                <div className="p-6 text-center rounded-xl border border-gw-secondary bg-gw-bg text-gw-accent font-mono text-xs">
                  No audit rows recorded for this warning.
                </div>
              )}
              {auditRows && auditRows.length > 0 && (
                <ul className="space-y-1.5">
                  {auditRows.map((row, i) => (
                    <li
                      key={row.audit_id || i}
                      className="border border-gw-secondary rounded-lg px-3 py-2 bg-gw-bg/40 font-mono text-[11px]"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gw-primary uppercase">{String(row.action || '—')}</span>
                        {row.previous_tier && row.new_tier && (
                          <span className="text-gw-accent">
                            tier {String(row.previous_tier).toUpperCase()} → {String(row.new_tier).toUpperCase()}
                          </span>
                        )}
                        <span className="text-gw-accent ml-auto">
                          {row.created_at ? String(row.created_at).replace('T', ' ').slice(0, 19) + 'Z' : ''}
                        </span>
                      </div>
                      <div className="text-gw-accent pt-0.5">
                        by {String(row.operator_id || 'unknown')}
                        {row.reason ? ' — ' + row.reason : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[10px] text-gw-accent font-mono pt-1">
                Audit rows are append-only (no update/delete); this panel is read-only.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t-2 border-gw-primary flex flex-wrap items-center justify-between gap-2.5 bg-gw-bg">
          {/* Left Actions: Export Dropdown & Source Link */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Export Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gw-panel border-2 border-gw-primary hover:bg-gw-bg text-gw-primary font-medium text-xs uppercase rounded-lg shadow-xs transition-all"
              >
                <Download className="w-3.5 h-3.5 text-gw-primary" />
                <span>Export Geometry</span>
                <ChevronDown className="w-3.5 h-3.5 text-gw-accent" />
              </button>

              {isExportMenuOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-52 bg-gw-panel border-2 border-gw-primary rounded-xl shadow-2xl p-1.5 z-50 text-xs font-mono">
                  <div className="px-2 py-1 text-[10px] text-gw-accent uppercase font-bold border-b border-gw-secondary mb-1">
                    Select Export Format:
                  </div>
                  <button
                    type="button"
                    onClick={handleExportGeoJSON}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-gw-bg rounded text-gw-primary font-bold flex items-center justify-between transition-colors"
                  >
                    <span>GeoJSON (.geojson)</span>
                    <Code className="w-3.5 h-3.5 text-gw-accent" />
                  </button>
                  <button
                    type="button"
                    onClick={handleExportKML}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-gw-bg rounded text-gw-primary font-bold flex items-center justify-between transition-colors"
                  >
                    <span>Google Earth KML (.kml)</span>
                    <Globe className="w-3.5 h-3.5 text-gw-accent" />
                  </button>
                  <button
                    type="button"
                    onClick={handleExportTextCoords}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-gw-bg rounded text-gw-primary font-bold flex items-center justify-between transition-colors"
                  >
                    <span>Plain Coordinate List (.txt)</span>
                    <FileText className="w-3.5 h-3.5 text-gw-accent" />
                  </button>
                </div>
              )}
            </div>

            {/* Official Source Link */}
            {warning.source_url && (
              <a
                href={warning.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gw-primary hover:underline text-xs flex items-center gap-1 font-mono font-bold uppercase px-2 py-1.5"
              >
                <span>Source Doc</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Right Actions: Isolation Mode & Navigation (2-col grid on <sm so
              Prev/Next, Verify and Close keep deterministic rows on phones) */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:flex-wrap">
            {/* Show Only This Message (Isolation Mode) */}
            {isIsolated ? (
              <button
                type="button"
                onClick={() => {
                  if (onClearIsolation) onClearIsolation();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)] font-medium text-xs uppercase rounded-lg transition-all shadow-xs"
                title="Exit Isolation Mode and show all warnings on map"
              >
                <Filter className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Exit Isolation Mode</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onIsolateWarning) onIsolateWarning(warning);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-transparent border border-[var(--ink)]/30 text-[var(--ink)] hover:bg-[var(--ink)]/5 font-medium text-xs uppercase rounded-lg transition-all shadow-xs tracking-wider"
                title="Filter map to show only this warning's polygon/corridor and zoom to bounds"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Show Only This Message</span>
              </button>
            )}

            {/* Verification Button for Candidate Reviews */}
            {onPrevious && (
              <button
                type="button"
                onClick={onPrevious}
                disabled={!hasPrevious}
                title="Previous unverified candidate in queue"
                className="flex items-center gap-1 px-2.5 py-2 bg-gw-panel border-2 border-gw-primary hover:bg-gw-bg text-gw-primary font-medium text-xs uppercase rounded-lg transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
            )}
            {onNext && (
              <button
                type="button"
                onClick={onNext}
                disabled={!hasNext}
                title="Next unverified candidate in queue"
                className="flex items-center gap-1 px-2.5 py-2 bg-gw-panel border-2 border-gw-primary hover:bg-gw-bg text-gw-primary font-medium text-xs uppercase rounded-lg transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onVerify && (
              <button
                type="button"
                onClick={handleVerifyClick}
                disabled={verifyPending}
                title="Mark this warning verified (audited VERIFY write)"
                className="bg-[var(--accent)] hover:brightness-110 text-[var(--canvas)] font-medium text-xs uppercase tracking-wider px-3 py-2 rounded-lg transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{verifyPending ? 'Verifying…' : 'Verify'}</span>
              </button>
            )}

            {onEditWarning && (
              <button
                type="button"
                onClick={() => onEditWarning(warning)}
                title="Edit this warning (admin) — type, time/expiry, status, tier, geometry, NAVAREA move"
                className="flex items-center gap-1.5 px-3 py-2 bg-gw-panel border-2 border-gw-primary hover:bg-gw-bg text-gw-primary font-medium text-xs uppercase rounded-lg transition-all shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
            {verifyError && (
              <span role="alert" className="text-rose-700 text-xs font-bold col-span-2 sm:col-span-1">
                {verifyError}
              </span>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="bg-gw-panel border-2 border-gw-primary hover:bg-gw-bg text-gw-primary font-medium text-xs uppercase tracking-wider px-4 py-2 rounded-lg transition-all shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

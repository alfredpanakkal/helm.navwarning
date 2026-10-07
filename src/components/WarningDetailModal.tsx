import React, { useEffect, useState } from 'react';
import { NavWarning } from '../types';
import { EcdisFeatureEditor } from './EcdisFeatureEditor';
import { extractEcdisIntermediateLayer } from '../utils/coordinateParser';
import { copyToClipboard } from '../utils/coordinateConversion';
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
  Navigation,
  Compass,
  Check,
  Filter,
} from 'lucide-react';

interface WarningDetailModalProps {
  warning: NavWarning | null;
  onClose: () => void;
  onVerify?: (warningId: string) => void;
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
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
  onIsolateWarning,
  isIsolated,
  onClearIsolation,
}) => {
  const [activeTab, setActiveTab] = useState<'message' | 'geometry' | 'ecdis'>('message');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!warning) return null;

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
    <div className="fixed inset-0 z-50 bg-gw-primary/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
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

                {warning.issued_date && (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-gw-accent font-bold px-1.5 py-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{warning.issued_date} UTC</span>
                  </span>
                )}
              </div>

              {/* Title & Warning Code */}
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-gw-primary font-mono tracking-tight">
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
              onClick={onClose}
              className="text-gw-accent hover:text-gw-primary font-bold text-xl p-1.5 rounded-lg hover:bg-gw-secondary transition-colors shrink-0"
              title="Close modal (Esc)"
            >
              ✕
            </button>
          </div>

          {/* Dual Tab Navigation */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gw-secondary">
            <button
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
                    onClick={() => handleCopy(warning.raw_text, 'raw')}
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
                  {warning.raw_text || warning.issued_text || 'No verbatim broadcast text recorded.'}
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

              {/* Provenance & Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-gw-bg p-3.5 rounded-xl border border-gw-primary font-mono text-[11px]">
                <div>
                  <div className="text-gw-accent uppercase font-bold text-[10px]">Publisher</div>
                  <div className="text-gw-primary font-bold truncate">{warning.publisher_id || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-gw-accent uppercase font-bold text-[10px]">Extraction Method</div>
                  <div className="text-gw-primary font-bold uppercase">
                    {warning.extraction_method === 'llm_assisted' ? 'AI Assisted' : 'Deterministic'}
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
                  <div className="p-8 text-center bg-gw-bg rounded-xl border border-gw-secondary text-gw-accent font-mono">
                    No discrete boundary coordinates parsed for this notice.
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
                      <tbody className="divide-y divide-gw-secondary bg-white">
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
                className="flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-gw-primary hover:bg-gw-bg text-gw-primary font-bold text-xs uppercase rounded-lg shadow-xs transition-all"
              >
                <Download className="w-3.5 h-3.5 text-sky-600" />
                <span>Export Geometry</span>
                <ChevronDown className="w-3.5 h-3.5 text-gw-accent" />
              </button>

              {isExportMenuOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-52 bg-white border-2 border-gw-primary rounded-xl shadow-2xl p-1.5 z-50 text-xs font-mono">
                  <div className="px-2 py-1 text-[10px] text-gw-accent uppercase font-bold border-b border-gw-secondary mb-1">
                    Select Export Format:
                  </div>
                  <button
                    onClick={handleExportGeoJSON}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-gw-bg rounded text-gw-primary font-bold flex items-center justify-between transition-colors"
                  >
                    <span>GeoJSON (.geojson)</span>
                    <Code className="w-3.5 h-3.5 text-gw-accent" />
                  </button>
                  <button
                    onClick={handleExportKML}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-gw-bg rounded text-gw-primary font-bold flex items-center justify-between transition-colors"
                  >
                    <span>Google Earth KML (.kml)</span>
                    <Globe className="w-3.5 h-3.5 text-gw-accent" />
                  </button>
                  <button
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

          {/* Right Actions: Isolation Mode & Navigation */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Show Only This Message (Isolation Mode) */}
            {isIsolated ? (
              <button
                type="button"
                onClick={() => {
                  if (onClearIsolation) onClearIsolation();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border-2 border-amber-600 font-bold text-xs uppercase rounded-lg transition-all shadow-xs"
                title="Exit Isolation Mode and show all warnings on map"
              >
                <Filter className="w-3.5 h-3.5 text-amber-700" />
                <span>Exit Isolation Mode</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onIsolateWarning) onIsolateWarning(warning);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase rounded-lg transition-all shadow-xs tracking-wider"
                title="Filter map to show only this warning's polygon/corridor and zoom to bounds"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Show Only This Message</span>
              </button>
            )}

            {/* Verification Button for Candidate Reviews */}
            {onVerify && (
              <button
                onClick={() => {
                  onVerify(warning.warning_id);
                  if (hasNext && onNext) {
                    onNext();
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider px-3 py-2 rounded-lg transition-all shadow-xs flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verify</span>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="bg-white border-2 border-gw-primary hover:bg-gw-bg text-gw-primary font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg transition-all shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

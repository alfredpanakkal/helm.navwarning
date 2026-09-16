import React, { useEffect, useState } from 'react';
import { NavWarning } from '../types';
import { EcdisFeatureEditor } from './EcdisFeatureEditor';
import { extractEcdisIntermediateLayer } from '../utils/coordinateParser';
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
} from 'lucide-react';


interface WarningDetailModalProps {
  warning: NavWarning | null;
  onClose: () => void;
  onVerify?: (warningId: string) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export const WarningDetailModal: React.FC<WarningDetailModalProps> = ({
  warning,
  onClose,
  onVerify,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
}) => {
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gw-primary/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-2 border-gw-primary rounded-xl sm:rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b-2 border-gw-primary flex items-start justify-between gap-4 bg-gw-bg">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-gw-primary text-gw-secondary font-mono text-xs font-bold px-2 py-0.5 rounded uppercase">
                NAVAREA {warning.navarea}
              </span>
              <span className="text-gw-accent text-xs font-mono font-bold uppercase">{warning.series}</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase border ${
                  warning.status === 'active'
                    ? 'bg-green-100 text-green-900 border-green-500'
                    : 'bg-red-100 text-red-900 border-red-500'
                }`}
              >
                {warning.status}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gw-primary font-mono">{warning.source_warning_id}</h2>
            <p className="text-xs text-gw-accent font-bold mt-1">{warning.area_text}</p>
          </div>

          <button
            onClick={onClose}
            className="text-gw-accent hover:text-gw-primary font-bold text-lg p-1.5 rounded transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-gw-primary">
          {/* Status & Provenance Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gw-bg p-4 rounded-xl border border-gw-primary font-mono">
            <div>
              <div className="text-gw-accent text-[10px] uppercase font-bold">Publisher ID</div>
              <div className="text-gw-primary font-bold">{warning.publisher_id}</div>
            </div>

            <div>
              <div className="text-gw-accent text-[10px] uppercase font-bold">Issued Date</div>
              <div className="text-gw-primary font-bold">{warning.issued_date}</div>
            </div>

            <div>
              <div className="text-gw-accent text-[10px] uppercase font-bold">Extraction Method</div>
              <div
                className={`font-bold uppercase ${
                  warning.extraction_method === 'llm_assisted' ? 'text-amber-800' : 'text-green-800'
                }`}
              >
                {warning.extraction_method === 'llm_assisted' ? 'LLM assisted' : 'Deterministic'}
              </div>
            </div>

            <div>
              <div className="text-gw-accent text-[10px] uppercase font-bold">Status Basis</div>
              <div className="text-gw-primary text-[10px] font-bold truncate" title={warning.status_basis}>
                {warning.status_basis}
              </div>
            </div>
          </div>

          {/* Raw Text Card */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gw-primary uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gw-primary" />
                <span>Immutable Raw Warning Text (<code className="font-mono text-gw-primary">raw_text</code>)</span>
              </span>
              <button
                onClick={() => copyToClipboard(warning.raw_text)}
                className="text-gw-accent hover:text-gw-primary flex items-center gap-1 font-mono text-[11px] font-bold uppercase transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Raw</span>
              </button>
            </div>
            <pre className="bg-gw-primary text-gw-secondary p-4 rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed">
              {warning.raw_text}
            </pre>
          </div>

          {/* English Machine Translation if present */}
          {warning.translated_text && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gw-primary uppercase tracking-wider">
                <Globe className="w-4 h-4 text-gw-primary" />
                <span>Machine Translation (<code className="font-mono">translated_text</code>, from {warning.original_language.toUpperCase()})</span>
              </div>
              <div className="bg-gw-bg border-2 border-gw-primary p-4 rounded-xl text-gw-primary font-medium italic leading-relaxed">
                "{warning.translated_text}"
              </div>
            </div>
          )}

          {/* Extracted Spatial Geometries */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-gw-primary uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gw-primary" />
                <span>Extracted Geometries & Spatial Validation ({warning.spatial.validation_status})</span>
              </span>
            </div>

            <div className="bg-gw-bg p-4 rounded-xl border border-gw-primary space-y-3">
              {warning.spatial.geometries.length > 0 ? (
                warning.spatial.geometries.map((g, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border border-gw-primary space-y-1 font-mono">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gw-primary font-bold">[{g.type}] Feature #{idx + 1}</span>
                      <span className="text-gw-accent font-bold">{g.label}</span>
                    </div>
                    <div className="text-[11px] text-gw-primary break-all font-bold">
                      {JSON.stringify(g.coordinates)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gw-accent text-xs italic font-bold">No point or polygon geometries parsed</div>
              )}

              {warning.spatial.circles.length > 0 && (
                <div className="pt-2 border-t border-gw-primary space-y-2">
                  <div className="text-xs font-bold text-gw-primary uppercase tracking-wider">Circle Hazards:</div>
                  {warning.spatial.circles.map((c, idx) => (
                    <div key={idx} className="text-xs font-mono text-gw-primary bg-white p-2 rounded border border-gw-primary font-bold">
                      Center: [{c.center[1]}°N, {c.center[0]}°E] | Radius: {c.radius_nm} NM ({c.radius_nm * 1852} meters)
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ECDIS Manual Update Officer Editor */}
          <div className="space-y-3 pt-2 border-t-2 border-gw-primary">
            <div className="flex items-center justify-between text-xs font-bold text-gw-primary uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-gw-primary" />
                <span>ECDIS Manual Update Intermediate Layer (IMO MSC.232 / MSC.530)</span>
              </span>
            </div>
            <EcdisFeatureEditor
              warningId={warning.source_warning_id || warning.warning_id}
              navarea={warning.navarea}
              rawText={warning.raw_text}
            />
          </div>

          {/* GeoJSON Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gw-primary uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <Code className="w-4 h-4 text-gw-primary" />
                <span>GeoJSON Export Representation</span>
              </span>
              <button
                onClick={() => copyToClipboard(JSON.stringify(extractEcdisIntermediateLayer(warning.source_warning_id || warning.warning_id, warning.navarea, warning.raw_text), null, 2))}
                className="text-gw-accent hover:text-gw-primary text-[11px] font-mono font-bold uppercase"
              >
                Copy GeoJSON
              </button>
            </div>
            <pre className="bg-gw-primary text-gw-secondary p-3 rounded-xl font-mono text-[11px] max-h-40 overflow-y-auto">
              {JSON.stringify(extractEcdisIntermediateLayer(warning.source_warning_id || warning.warning_id, warning.navarea, warning.raw_text), null, 2)}
            </pre>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t-2 border-gw-primary flex flex-wrap items-center justify-between gap-3 bg-gw-bg">
          <div className="flex items-center gap-2">
            <a
              href={warning.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gw-primary hover:underline text-xs flex items-center gap-1 font-mono font-bold uppercase"
            >
              <span>Official Source Document</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            {hasPrevious && onPrevious && (
              <button
                onClick={onPrevious}
                className="bg-white border-2 border-gw-primary hover:bg-gw-bg text-gw-primary font-bold text-xs uppercase px-3 py-2 rounded transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary"
              >
                ← Prev
              </button>
            )}

            {onVerify && (
              <button
                onClick={() => {
                  onVerify(warning.warning_id);
                  if (hasNext && onNext) {
                    onNext();
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded transition-all shadow-sm flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Verify Candidate</span>
              </button>
            )}

            {hasNext && onNext && (
              <button
                onClick={onNext}
                className="bg-gw-primary hover:bg-gw-accent text-gw-secondary font-bold text-xs uppercase px-3 py-2 rounded transition-all shadow-2xs flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary"
              >
                <span>Next</span>
                <span>→</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="bg-white border border-gw-primary hover:bg-gw-bg text-gw-primary font-bold text-xs uppercase tracking-wider px-4 py-2 rounded transition-all shadow-2xs ml-2"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

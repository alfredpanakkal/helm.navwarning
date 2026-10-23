import React, { useEffect, useMemo, useState } from 'react';
import { NavWarning, EcdisIntermediateLayer, EcdisPointFeature, GeometryIntent } from '../types';
import { EcdisFeatureEditor } from './EcdisFeatureEditor';
import {
  saveWarningEdit,
  WarningEditPatch,
  WarningGeometryPatch,
  WarningEditResult,
} from '../services/warningEditApi';
import {
  X, Save, Clock, Tag, LifeBuoy, Globe, AlertTriangle, CheckCircle2, History, Loader2,
} from 'lucide-react';

const CATEGORY_OPTIONS = [
  { id: 'military', label: 'Military' },
  { id: 'aton', label: 'AtoN' },
  { id: 'subsea', label: 'Subsea' },
  { id: 'drifting', label: 'Drifting' },
  { id: 'offshore', label: 'Offshore' },
  { id: 'electronic', label: 'Electronic' },
  { id: 'general', label: 'General' },
];
const STATUS_OPTIONS = ['active', 'cancelled', 'expired', 'superseded', 'unverified'];
const TIER_OPTIONS = ['A', 'B', 'C'];
const QUALITY_OPTIONS = ['EXPLICIT', 'INFERRED', 'AMBIGUOUS', 'INVALID'];
const NAVAREA_OPTIONS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII',
  'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'Baltic',
];

type EditTab = 'classification' | 'time' | 'lifecycle' | 'geometry';

interface WarningEditModalProps {
  warning: NavWarning | null;
  onClose: () => void;
  onSaved: (result: WarningEditResult, warning: NavWarning) => void;
}

/** datetime-local value from an ISO string (or '' when null). */
function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Builds an editable point layer from the warning's existing geometries. */
function layerFromWarning(w: NavWarning): EcdisIntermediateLayer | null {
  const geoms = (w as any).spatial?.geometries as any[] | undefined;
  const features: EcdisPointFeature[] = [];
  let idx = 0;
  for (const g of geoms || []) {
    let pts: number[][] = [];
    if (g?.type === 'Point' && Array.isArray(g.coordinates)) pts = [g.coordinates];
    else if (g?.type === 'LineString' && Array.isArray(g.coordinates)) pts = g.coordinates;
    else if (g?.type === 'Polygon' && Array.isArray(g?.coordinates?.[0])) pts = g.coordinates[0];
    else if (g?.type === 'MultiPoint' && Array.isArray(g.coordinates)) pts = g.coordinates;
    for (const p of pts) {
      if (!Array.isArray(p) || p.length < 2) continue;
      features.push({
        type: 'Feature',
        id: 'edit-' + idx + '-' + Math.random().toString(36).slice(2, 8),
        geometry: { type: 'Point', coordinates: [Number(p[0]), Number(p[1])] },
        properties: {
          sequence_index: idx,
          raw_text: '',
          inference: 'explicit',
          confidence: 'verified',
          modification_state: 'original',
          user_notes: '',
          errors: [],
          role_hint: null,
        },
      });
      idx++;
    }
  }
  const hasPoly = (geoms || []).some((g: any) => g?.type === 'Polygon');
  const hasLine = (geoms || []).some((g: any) => g?.type === 'LineString');
  const intent: GeometryIntent = hasPoly ? 'area' : hasLine ? 'route' : 'unknown';
  if (features.length === 0) return null;
  return { warningId: w.warning_id, navarea: w.navarea, editable: true, geometry_intent: intent, features };
}

/** Converts the edited point layer into geometry patches (one per shape). */
function layerToGeometryPatches(layer: EcdisIntermediateLayer): WarningGeometryPatch[] {
  const pts = layer.features
    .filter((f) => f.properties.modification_state !== 'deleted')
    .filter((f) => f.properties.errors.length === 0)
    .map((f) => f.geometry.coordinates as [number, number]);
  if (pts.length === 0) return [];
  const zone = 'PRIMARY_HAZARD';
  if (layer.geometry_intent === 'area' && pts.length >= 3) {
    const ring = pts.slice();
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    return [{ zone_label: zone, feature_type: 'POLYGON', geojson: { type: 'Polygon', coordinates: [ring] } }];
  }
  if (layer.geometry_intent === 'route' && pts.length >= 2) {
    return [{ zone_label: zone, feature_type: 'LINE', geojson: { type: 'LineString', coordinates: pts } }];
  }
  // Unknown intent: each point is its own geometry row.
  return pts.map((p) => ({ zone_label: zone, feature_type: 'POINT', geojson: { type: 'Point', coordinates: p } }));
}

const inputCls =
  'w-full bg-white border border-gw-secondary rounded px-3 py-2 outline-none text-sm focus:border-gw-primary transition-colors';

export const WarningEditModal: React.FC<WarningEditModalProps> = ({ warning, onClose, onSaved }) => {
  const [tab, setTab] = useState<EditTab>('classification');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<WarningEditResult | null>(null);
  const [conflict, setConflict] = useState<{ updated_at: string } | null>(null);

  const [title, setTitle] = useState('');
  const [areaText, setAreaText] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [status, setStatus] = useState('active');
  const [tier, setTier] = useState('B');
  const [quality, setQuality] = useState('EXPLICIT');
  const [note, setNote] = useState('');
  const [moveTarget, setMoveTarget] = useState('');
  const [geometryLayer, setGeometryLayer] = useState<EcdisIntermediateLayer | null>(null);
  const [includeGeometry, setIncludeGeometry] = useState(false);

  useEffect(() => {
    if (!warning) return;
    const w = warning as any;
    setTitle(w.title || '');
    setAreaText(w.area_text || '');
    const cats = Array.isArray(w.categories) ? w.categories : [];
    setCategories(cats.map(String).map((c: string) => c.toLowerCase()));
    setValidFrom(isoToLocal(w.valid_from));
    setValidTo(isoToLocal(w.valid_to));
    setStatus(String(w.status || 'active').toLowerCase());
    setTier(String(w.triage_tier || 'B').toUpperCase());
    setQuality(String(w.data_quality || 'EXPLICIT').toUpperCase());
    setNote('');
    setMoveTarget('');
    setTab('classification');
    setResult(null);
    setConflict(null);
    const layer = layerFromWarning(warning);
    setGeometryLayer(layer);
    setIncludeGeometry(false);
  }, [warning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const identity = useMemo(() => {
    const w = (warning || {}) as any;
    return {
      canonical: w.canonical_id || w.source_warning_id || w.warning_id || '—',
      navarea: w.navarea || '—',
      updatedAt: w.updated_at || null,
      uuid: w.db_uuid || null,
    };
  }, [warning]);

  if (!warning) return null;

  const toggleCategory = (id: string) => {
    setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const buildPatch = (): WarningEditPatch => {
    const w = warning as any;
    const patch: WarningEditPatch = {};
    if ((title || '') !== (w.title || '')) patch.title = title;
    if ((areaText || '') !== (w.area_text || '')) patch.area_text = areaText;
    const currentCats = (Array.isArray(w.categories) ? w.categories : []).map((c: string) => String(c).toLowerCase()).sort();
    if (JSON.stringify([...categories].sort()) !== JSON.stringify(currentCats)) patch.categories = categories;
    if (localToIso(validFrom) !== (w.valid_from ? new Date(w.valid_from).toISOString() : null)) patch.valid_from = localToIso(validFrom);
    if (localToIso(validTo) !== (w.valid_to ? new Date(w.valid_to).toISOString() : null)) patch.valid_to = localToIso(validTo);
    if (String(status).toLowerCase() !== String(w.status || '').toLowerCase()) patch.status = status;
    if (String(tier).toUpperCase() !== String(w.triage_tier || '').toUpperCase()) {
      patch.triage_tier = tier;
      if (String(quality).toUpperCase() !== String(w.data_quality || '').toUpperCase()) patch.data_quality = quality;
    }
    if (String(quality).toUpperCase() !== String(w.data_quality || '').toUpperCase() && patch.triage_tier === undefined) {
      patch.data_quality = quality;
    }
    if (moveTarget) patch.move_to_navarea = moveTarget;
    if (includeGeometry && geometryLayer) patch.geometry = layerToGeometryPatches(geometryLayer);
    if (note.trim()) patch.note = note.trim();
    return patch;
  };

  const handleSave = async () => {
    const patch = buildPatch();
    const hasChanges = Object.keys(patch).length > 0;
    if (!hasChanges) {
      setResult({ ok: false, status: 0, error: 'No changes to save.' });
      return;
    }
    if (moveTarget) {
      const confirmed = window.confirm(
        `Move this warning to NAVAREA ${moveTarget.toUpperCase()}?\n\n` +
        `The original (${identity.canonical}) will be marked SUPERSEDED and a new copy ` +
        `will be created in NAVAREA ${moveTarget.toUpperCase()} with its geometries. ` +
        `The new warning starts at Tier B for review.`
      );
      if (!confirmed) return;
    }
    setSaving(true);
    setResult(null);
    setConflict(null);
    const res = await saveWarningEdit({
      warningId: identity.uuid || undefined,
      canonicalId: identity.canonical !== '—' ? identity.canonical : undefined,
      expectedUpdatedAt: identity.updatedAt,
      patch,
    });
    setSaving(false);
    if (res.ok) {
      onSaved(res, warning);
      return;
    }
    setResult(res);
    if (res.status === 409 && res.conflict) setConflict(res.conflict);
  };

  const tabBtn = (id: EditTab, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wider transition-colors ${
        tab === id ? 'bg-gw-primary text-gw-bg' : 'bg-white text-gw-primary hover:bg-gw-bg'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[950] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-gw-bg w-full max-w-3xl max-h-[92vh] rounded-xl shadow-2xl border-2 border-gw-primary overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gw-primary text-gw-bg">
          <div className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            <span className="font-bold text-sm uppercase tracking-wider">Edit Warning</span>
            <span className="text-xs opacity-80 font-mono ml-2">{identity.canonical}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-black/10 transition-colors" title="Close (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Identity strip (read-only: raw_text + canonical id are evidence) */}
        <div className="px-4 py-2 bg-white border-b border-gw-secondary flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          <span><strong>NAVAREA:</strong> {identity.navarea} <em>(change via Lifecycle → Move)</em></span>
          <span><strong>Canonical ID:</strong> <span className="font-mono">{identity.canonical}</span></span>
          {identity.updatedAt && <span><strong>Version:</strong> {new Date(identity.updatedAt).toLocaleString()}</span>}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-2 bg-white border-b border-gw-secondary">
          {tabBtn('classification', <Tag className="w-3.5 h-3.5" />, 'Type / Text')}
          {tabBtn('time', <Clock className="w-3.5 h-3.5" />, 'Time / Expiry')}
          {tabBtn('lifecycle', <LifeBuoy className="w-3.5 h-3.5" />, 'Status / Tier')}
          {tabBtn('geometry', <Globe className="w-3.5 h-3.5" />, 'Geometry')}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'classification' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1">Title</label>
                <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1">Categories (type)</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                        categories.includes(c.id)
                          ? 'bg-gw-primary text-gw-bg border-gw-primary'
                          : 'bg-white text-gw-primary border-gw-secondary hover:border-gw-primary'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1">Area text</label>
                <textarea className={inputCls + ' min-h-[80px]'} value={areaText} onChange={(e) => setAreaText(e.target.value)} maxLength={2000} />
              </div>
              <div className="text-[11px] text-gray-500 border border-gw-secondary rounded p-2 bg-white/60">
                <strong>Raw bulletin text is read-only</strong> — it is the evidence anchor. Edits apply to derived fields only.
              </div>
            </div>
          )}

          {tab === 'time' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1">Effective from (valid_from)</label>
                  <input type="datetime-local" className={inputCls} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1">Expiry (valid_to)</label>
                  <input type="datetime-local" className={inputCls} value={validTo} onChange={(e) => setValidTo(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setValidTo('')}
                  className="px-3 py-1.5 bg-white border border-gw-secondary rounded text-xs font-bold hover:border-gw-primary transition-colors"
                >
                  No expiry (clear)
                </button>
                <span className="text-[11px] text-gray-500">
                  Setting an expiry date <strong>never</strong> auto-changes the status — lifecycle changes are explicit operator actions.
                </span>
              </div>
            </div>
          )}

          {tab === 'lifecycle' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1">Status</label>
                  <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1">Triage tier</label>
                  <select className={inputCls} value={tier} onChange={(e) => setTier(e.target.value)}>
                    {TIER_OPTIONS.map((t) => <option key={t} value={t}>Tier {t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1">Data quality</label>
                  <select className={inputCls} value={quality} onChange={(e) => setQuality(e.target.value)}>
                    {QUALITY_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
              </div>
              <div className="text-[11px] text-gray-500 bg-amber-50 border border-amber-300 rounded p-2">
                Tier A invariants: geometry required, EXPLICIT quality, not superseded. The server enforces them and rejects the edit otherwise.
              </div>
              <div className="border-t border-gw-secondary pt-3">
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                  <History className="w-3.5 h-3.5" /> Move to another NAVAREA (supersede + recreate)
                </label>
                <div className="flex items-center gap-2">
                  <select className={inputCls + ' max-w-xs'} value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
                    <option value="">— keep in {identity.navarea} —</option>
                    {NAVAREA_OPTIONS.map((n) => <option key={n} value={n}>NAVAREA {n}</option>)}
                  </select>
                  <span className="text-[11px] text-gray-500">Creates a new warning in the target region; original becomes superseded.</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'geometry' && (
            <div className="space-y-3">
              {!geometryLayer && (
                <div className="text-xs text-gray-500 border border-gw-secondary rounded p-3 bg-white/60">
                  No existing geometry found on this warning. The editor below extracts an editable layer from the raw
                  bulletin text — edit the points, tick “include”, then Save.
                </div>
              )}
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={includeGeometry}
                  onChange={(e) => setIncludeGeometry(e.target.checked)}
                  className="accent-gw-primary w-4 h-4"
                />
                Include geometry changes in this save
              </label>
              <div className="border border-gw-secondary rounded bg-white">
                <EcdisFeatureEditor
                  initialLayer={geometryLayer || undefined}
                  rawText={warning.raw_text || ''}
                  warningId={identity.canonical}
                  navarea={identity.navarea}
                  onLayerChange={setGeometryLayer}
                />
              </div>
            </div>
          )}
        </div>

        {/* Result banner */}
        {result && !result.ok && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-300 text-xs text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div>{result.error}</div>
              {conflict && (
                <div className="mt-1 flex items-center gap-2">
                  <span>Changed at {new Date(conflict.updated_at).toLocaleString()} by another operator.</span>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-2 py-1 bg-red-600 text-white rounded text-[11px] font-bold uppercase"
                  >
                    Reload latest
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {result && result.ok && (
          <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-300 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Saved. Geometry {result.geometry || 'unchanged'}; audit row {result.audit || 'skipped'}.</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 bg-white border-t-2 border-gw-primary">
          <input
            className={inputCls + ' flex-1'}
            placeholder="Edit reason (stored on the audit row)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-gw-primary hover:bg-gw-accent text-gw-bg font-bold text-xs uppercase tracking-wider rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{moveTarget ? 'Move + Save' : 'Save'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gw-secondary text-gw-primary font-bold text-xs uppercase tracking-wider rounded hover:bg-gw-bg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

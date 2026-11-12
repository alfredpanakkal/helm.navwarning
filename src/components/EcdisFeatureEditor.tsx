import React, { useRef, useState } from 'react';
import { EcdisIntermediateLayer, EcdisPointFeature, GeometryIntent, FeatureRoleHint } from '../types';
import { extractEcdisIntermediateLayer, testFourWayInference, isPointInNavArea } from '../utils/coordinateParser';
import { Layers, MapPin, Download, Copy, Plus, Trash2, ArrowUp, ArrowDown, AlertTriangle, CheckCircle2, ShieldAlert, Edit3, Undo2, Redo2, RotateCcw, FileDiff } from 'lucide-react';

interface EcdisFeatureEditorProps {
  initialLayer?: EcdisIntermediateLayer;
  rawText?: string;
  warningId?: string;
  navarea?: string | null;
  onLayerChange?: (layer: EcdisIntermediateLayer) => void;
}

/** Human-readable officer-layer diff against the extracted original. */
function summarizeLayerDiff(original: EcdisIntermediateLayer, current: EcdisIntermediateLayer): string | null {
  if (JSON.stringify(original) === JSON.stringify(current)) return null;
  const bits: string[] = [];
  if (original.geometry_intent !== current.geometry_intent) bits.push('intent changed');
  const added = Math.max(0, current.features.length - original.features.length);
  const removed = Math.max(0, original.features.length - current.features.length);
  const origById = new Map(original.features.map((f) => [f.id, f]));
  let movedCount = 0;
  let noteEdits = 0;
  for (const f of current.features) {
    const o = origById.get(f.id);
    if (!o) continue;
    const coordChanged =
      o.geometry.coordinates[0] !== f.geometry.coordinates[0] ||
      o.geometry.coordinates[1] !== f.geometry.coordinates[1];
    const roleChanged = (o.properties.role_hint || null) !== (f.properties.role_hint || null);
    if (coordChanged || roleChanged) movedCount++;
    if (o.properties.user_notes !== f.properties.user_notes) noteEdits++;
  }
  if (added > 0) bits.push(`${added} point(s) added`);
  if (removed > 0) bits.push(`${removed} point(s) removed`);
  if (movedCount > 0) bits.push(`${movedCount} point(s) moved/edited`);
  if (noteEdits > 0) bits.push(`${noteEdits} note edit(s)`);
  return bits.length > 0 ? bits.join(' · ') : 'layer modified (reordered)';
}

export const EcdisFeatureEditor: React.FC<EcdisFeatureEditorProps> = ({
  initialLayer,
  rawText = '',
  warningId = 'NAVWARN-001',
  navarea = 'I',
  onLayerChange,
}) => {
  const [layer, setLayer] = useState<EcdisIntermediateLayer>(() => {
    if (initialLayer) return initialLayer;
    return extractEcdisIntermediateLayer(warningId, navarea, rawText);
  });

  const [copySuccess, setCopySuccess] = useState(false);

  // Officer-layer edit history (undo/redo) + the extracted original snapshot
  // used for reset-to-original and the original-vs-proposed diff.
  const originalLayerRef = useRef<EcdisIntermediateLayer>(layer);
  const [undoStack, setUndoStack] = useState<EcdisIntermediateLayer[]>([]);
  const [redoStack, setRedoStack] = useState<EcdisIntermediateLayer[]>([]);

  const updateLayer = (newLayer: EcdisIntermediateLayer) => {
    setUndoStack((prev) => [...prev.slice(-49), layer]);
    setRedoStack([]);
    setLayer(newLayer);
    if (onLayerChange) onLayerChange(newLayer);
  };

  /** Apply a historical layer without pushing a new history entry. */
  const applyHistorical = (next: EcdisIntermediateLayer) => {
    setLayer(next);
    if (onLayerChange) onLayerChange(next);
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const prevLayer = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, layer]);
    applyHistorical(prevLayer);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const nextLayer = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, layer]);
    applyHistorical(nextLayer);
  };

  /** Reset the officer layer to the extracted original (undoable). */
  const resetToOriginal = () => {
    const original: EcdisIntermediateLayer = JSON.parse(JSON.stringify(originalLayerRef.current));
    if (JSON.stringify(layer) === JSON.stringify(original)) return;
    setUndoStack((prev) => [...prev.slice(-49), layer]);
    setRedoStack([]);
    applyHistorical(original);
  };

  const handleIntentChange = (newIntent: GeometryIntent) => {
    const updatedFeatures = layer.features.map((f, idx) => {
      let role: FeatureRoleHint = f.properties.role_hint;
      if (newIntent === 'area') role = 'vertex';
      else if (newIntent === 'route') {
        if (idx === 0) role = 'start';
        else if (idx === layer.features.length - 1) role = 'end';
        else role = 'intermediate';
      }
      return {
        ...f,
        properties: { ...f.properties, role_hint: role },
      };
    });

    updateLayer({
      ...layer,
      geometry_intent: newIntent,
      features: updatedFeatures,
    });
  };

  const handleCoordinateChange = (id: string, lonStr: string, latStr: string) => {
    const lon = parseFloat(lonStr);
    const lat = parseFloat(latStr);

    const updatedFeatures = layer.features.map((f) => {
      if (f.id !== id) return f;

      const isMalformed = isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180;
      if (isMalformed) {
        return {
          ...f,
          geometry: { type: 'Point' as const, coordinates: [0, 0] as [number, number] },
          properties: {
            ...f.properties,
            modification_state: 'edited' as const,
            confidence: 'rejected' as const,
            errors: ['COORD_MALFORMED'],
          },
        };
      }

      const isInside = isPointInNavArea(lat, lon, layer.navarea);
      return {
        ...f,
        geometry: { type: 'Point' as const, coordinates: [lon, lat] as [number, number] },
        properties: {
          ...f.properties,
          modification_state: f.properties.modification_state === 'inserted' ? ('inserted' as const) : ('edited' as const),
          confidence: isInside ? ('verified' as const) : ('partial' as const),
          errors: isInside ? [] : ['COORD_OUTSIDE_NAVAREA'],
        },
      };
    });

    updateLayer({ ...layer, features: updatedFeatures });
  };

  const handleNotesChange = (id: string, notes: string) => {
    const updatedFeatures = layer.features.map((f) => {
      if (f.id !== id) return f;
      return {
        ...f,
        properties: {
          ...f.properties,
          user_notes: notes,
          modification_state: f.properties.modification_state === 'inserted' ? ('inserted' as const) : ('edited' as const),
        },
      };
    });
    updateLayer({ ...layer, features: updatedFeatures });
  };

  const handleRoleChange = (id: string, role: FeatureRoleHint) => {
    const updatedFeatures = layer.features.map((f) => {
      if (f.id !== id) return f;
      return {
        ...f,
        properties: {
          ...f.properties,
          role_hint: role,
          modification_state: f.properties.modification_state === 'inserted' ? ('inserted' as const) : ('edited' as const),
        },
      };
    });
    updateLayer({ ...layer, features: updatedFeatures });
  };

  const handleMovePoint = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= layer.features.length) return;

    const newFeatures = [...layer.features];
    const temp = newFeatures[index];
    newFeatures[index] = newFeatures[targetIdx];
    newFeatures[targetIdx] = temp;

    // Recalculate sequence index
    const reindexed = newFeatures.map((f, i) => ({
      ...f,
      properties: { ...f.properties, sequence_index: i + 1 },
    }));

    updateLayer({ ...layer, features: reindexed });
  };

  const handleInsertPoint = (afterIndex: number) => {
    const prevCoords = layer.features[afterIndex]?.geometry.coordinates || [0, 0];
    const newFeature: EcdisPointFeature = {
      type: 'Feature',
      id: `feat-${layer.warningId}-insert-${Date.now()}`,
      geometry: {
        type: 'Point',
        coordinates: [prevCoords[0] + 0.05, prevCoords[1] + 0.05],
      },
      properties: {
        sequence_index: afterIndex + 2,
        raw_text: 'Manual Officer Insertion',
        inference: 'explicit',
        confidence: 'verified',
        modification_state: 'inserted',
        user_notes: 'Inserted during shipboard manual route review',
        errors: [],
        role_hint: layer.geometry_intent === 'area' ? 'vertex' : 'intermediate',
      },
    };

    const newFeatures = [...layer.features];
    newFeatures.splice(afterIndex + 1, 0, newFeature);

    const reindexed = newFeatures.map((f, i) => ({
      ...f,
      properties: { ...f.properties, sequence_index: i + 1 },
    }));

    updateLayer({ ...layer, features: reindexed });
  };

  const handleDeletePoint = (id: string) => {
    const filtered = layer.features.filter((f) => f.id !== id);
    const reindexed = filtered.map((f, i) => ({
      ...f,
      properties: { ...f.properties, sequence_index: i + 1 },
    }));

    updateLayer({ ...layer, features: reindexed });
  };

  const handleCopyGeoJson = () => {
    navigator.clipboard.writeText(JSON.stringify(layer, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDownloadGeoJson = () => {
    const blob = new Blob([JSON.stringify(layer, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ECDIS-Intermediate-Layer-${layer.warningId.replace(/[/\\?%*:|"<>]/g, '_')}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const diffSummary = summarizeLayerDiff(originalLayerRef.current, layer);
  const isDirty = diffSummary !== null;

  return (
    <div className="bg-gw-panel border-2 border-gw-primary rounded-xl overflow-hidden shadow-md font-mono text-xs text-gw-primary">
      {/* Layer Header */}
      <div className="p-4 bg-gw-bg border-b-2 border-gw-primary flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-gw-primary text-gw-bg text-[10px] font-bold px-2 py-0.5 rounded uppercase">
              IMO ECDIS Intermediate Layer (MSC.232)
            </span>
            <span className="text-gw-accent text-[10px] font-bold">Editable Officer Layer</span>
          </div>
          <div className="text-sm font-bold text-gw-primary">
            Warning ID: {layer.warningId} · NAVAREA {layer.navarea || 'GLOBAL'}
          </div>
        </div>

        {/* Geometry Intent Selector */}
        <div className="flex items-center gap-2 bg-gw-panel border border-gw-primary rounded p-1.5 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-gw-accent">Geometry Intent:</span>
          <select
            aria-label="Geometry intent" value={layer.geometry_intent}
            onChange={(e) => handleIntentChange(e.target.value as GeometryIntent)}
            className="bg-transparent font-bold text-xs outline-none cursor-pointer text-gw-primary"
          >
            <option value="points">Points (Discrete Hazards)</option>
            <option value="area">Area (Bounding Polygon)</option>
            <option value="route">Route (Trackline Waypoints)</option>
            <option value="unknown">Unknown / Unclassified</option>
          </select>
        </div>
      </div>

      {/* Original-vs-proposed diff banner */}
      {isDirty && (
        <div className="px-4 py-1.5 bg-sky-50 border-b border-sky-300 text-[10px] text-sky-900 flex items-center gap-1.5">
          <FileDiff className="w-3 h-3 shrink-0" />
          <span>Officer layer vs extracted original: {diffSummary}</span>
        </div>
      )}

      {/* Feature List */}
      <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto no-scrollbar">
        {layer.features.length === 0 ? (
          <div className="text-center py-6 text-gw-accent font-bold">
            No extracted coordinate points. Click below to add a manual point.
          </div>
        ) : (
          layer.features.map((feat, idx) => {
            const [lon, lat] = feat.geometry.coordinates;
            const isRejected = feat.properties.confidence === 'rejected';
            const isPartial = feat.properties.confidence === 'partial';

            return (
              <div
                key={feat.id}
                className={`p-3 rounded-lg border-2 transition-all space-y-2 ${
                  isRejected
                    ? 'bg-red-50 border-red-500'
                    : isPartial
                    ? 'bg-amber-50 border-amber-500'
                    : 'bg-gw-bg border-gw-primary'
                }`}
              >
                {/* Feature Header */}
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <div className="flex items-center gap-2">
                    <span className="bg-gw-primary text-gw-bg w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                      {feat.properties.sequence_index}
                    </span>
                    <span className="uppercase tracking-wider">Point #{feat.properties.sequence_index}</span>

                    {/* Confidence Badge */}
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded font-bold uppercase border ${
                        isRejected
                          ? 'bg-red-200 text-red-900 border-red-400'
                          : isPartial
                          ? 'bg-amber-200 text-amber-900 border-amber-400'
                          : 'bg-green-100 text-green-900 border-green-400'
                      }`}
                    >
                      {feat.properties.confidence}
                    </span>

                    {/* Inference Badge */}
                    <span className="text-[11px] text-gw-accent bg-gw-panel px-1.5 py-0.5 rounded border border-gw-secondary">
                      {feat.properties.inference}
                    </span>

                    {/* State Badge */}
                    {feat.properties.modification_state !== 'original' && (
                      <span className="text-[11px] bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded border border-purple-400 uppercase font-bold">
                        {feat.properties.modification_state}
                      </span>
                    )}
                  </div>

                  {/* Reorder & Remove Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMovePoint(idx, 'up')}
                      className="p-1 text-gw-primary hover:bg-gw-panel rounded disabled:opacity-30"
                      title="Move Point Up"
                      aria-label="Move point up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === layer.features.length - 1}
                      onClick={() => handleMovePoint(idx, 'down')}
                      className="p-1 text-gw-primary hover:bg-gw-panel rounded disabled:opacity-30"
                      title="Move Point Down"
                      aria-label="Move point down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePoint(feat.id)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                      title="Delete Point"
                      aria-label="Delete point"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Coordinates & Role Edit Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-gw-accent uppercase block mb-0.5" htmlFor={`lat-${feat.id}`}>Latitude (°N/S)</label>
                    <input
                      type="number"
                      step="0.0001"
                      id={`lat-${feat.id}`} value={lat}
                      onChange={(e) => handleCoordinateChange(feat.id, lon.toString(), e.target.value)}
                      className="w-full bg-gw-panel border border-gw-primary rounded px-2 py-1 text-xs font-bold outline-none focus:ring-1 focus:ring-gw-primary"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gw-accent uppercase block mb-0.5" htmlFor={`lon-${feat.id}`}>Longitude (°E/W)</label>
                    <input
                      type="number"
                      step="0.0001"
                      id={`lon-${feat.id}`} value={lon}
                      onChange={(e) => handleCoordinateChange(feat.id, e.target.value, lat.toString())}
                      className="w-full bg-gw-panel border border-gw-primary rounded px-2 py-1 text-xs font-bold outline-none focus:ring-1 focus:ring-gw-primary"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gw-accent uppercase block mb-0.5" htmlFor={`role-${feat.id}`}>Role Hint</label>
                    <select
                      id={`role-${feat.id}`} value={feat.properties.role_hint || ''}
                      onChange={(e) =>
                        handleRoleChange(feat.id, (e.target.value || null) as FeatureRoleHint)
                      }
                      className="w-full bg-gw-panel border border-gw-primary rounded px-2 py-1 text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="">None (Null)</option>
                      <option value="vertex">Vertex (Polygon)</option>
                      <option value="start">Start (Waypoint)</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="end">End (Waypoint)</option>
                    </select>
                  </div>
                </div>

                {/* Errors display if any */}
                {feat.properties.errors.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-800 font-bold bg-red-100 px-2 py-1 rounded border border-red-300">
                    <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                    <span>Error Code: {feat.properties.errors.join(', ')}</span>
                  </div>
                )}

                {/* Raw Snippet & Officer Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-gw-accent font-bold">Source Raw Snippet:</span>
                    <div className="text-gw-primary font-mono bg-gw-panel/80 p-1.5 rounded border border-gw-secondary truncate">
                      {feat.properties.raw_text}
                    </div>
                  </div>
                  <div>
                    <span className="text-gw-accent font-bold">Officer User Notes:</span>
                    <input
                      type="text"
                      aria-label="Officer notes / remarks" placeholder="Add officer notes / remarks..."
                      value={feat.properties.user_notes}
                      onChange={(e) => handleNotesChange(feat.id, e.target.value)}
                      className="w-full bg-gw-panel border border-gw-secondary rounded px-2 py-1 outline-none text-[10px]"
                    />
                  </div>
                </div>

                {/* Insert Point button below item */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleInsertPoint(idx)}
                    className="flex items-center gap-1 text-xs text-gw-primary hover:text-gw-accent font-bold uppercase"
                  >
                    <Plus className="w-3 h-3" /> Insert Point Below
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-3 bg-gw-bg border-t-2 border-gw-primary flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <button
            type="button"
            onClick={() => handleInsertPoint(layer.features.length - 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gw-panel border border-gw-primary rounded text-xs font-bold uppercase hover:bg-gw-primary hover:text-gw-bg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Point Feature
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={undoStack.length === 0}
            className="p-1.5 bg-gw-panel border border-gw-secondary rounded text-gw-accent hover:text-gw-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo last layer change"
            aria-label="Undo last layer change"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-1.5 bg-gw-panel border border-gw-secondary rounded text-gw-accent hover:text-gw-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo"
            aria-label="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={resetToOriginal}
            disabled={!isDirty}
            className="p-1.5 bg-gw-panel border border-gw-secondary rounded text-gw-accent hover:text-gw-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Reset officer layer to the extracted original"
            aria-label="Reset officer layer to the extracted original"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyGeoJson}
            className="flex items-center gap-1 px-3 py-1.5 bg-gw-panel border border-gw-primary rounded text-xs font-bold uppercase hover:bg-gw-primary hover:text-gw-bg transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copySuccess ? 'Copied GeoJSON!' : 'Copy Layer GeoJSON'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadGeoJson}
            className="flex items-center gap-1 px-3 py-1.5 bg-gw-primary text-gw-bg rounded text-xs font-bold uppercase hover:bg-gw-accent transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export ECDIS Layer</span>
          </button>
        </div>
      </div>
    </div>
  );
};

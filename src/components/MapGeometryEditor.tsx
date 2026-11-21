import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { NavWarning } from '../types';
import { saveWarningEdit, WarningGeometryPatch } from '../services/warningEditApi';
import { clearDraft, loadDraft, saveDraft } from '../lib/geometryDraft';
import { geometryEditBlockReason } from '../lib/geometryEditSafety';
import { PenTool, Save, X, RotateCcw, Loader2, MousePointerClick, Circle as CircleIcon, Square, Route, Undo2, Redo2, FileDiff } from 'lucide-react';

/**
 * Phase E2 — Map-native geometry editing for admins.
 *
 * Renders nothing on the map until an admin activates it for the warning that
 * is currently selected on the map. Two modes:
 *  - "Edit vertices": every vertex of the warning's existing geometries gets a
 *    draggable handle; double-click removes a vertex; circles get a center
 *    handle plus a radius handle (radius in NM).
 *  - "Draw new": click on the map appends vertices for a new polygon / route /
 *    point / circle; Finish converts the clicked points into the new geometry
 *    (replace-all semantics on save, exactly like the E1 modal).
 *
 * Saves go through the same admin-guarded /api/admin/warning-edit endpoint as
 * the modal — never directly to Supabase from the browser.
 */

interface MapGeometryEditorProps {
  map: L.Map | null;
  isAdminMode: boolean;
  selectedWarning: NavWarning | null;
  onGeometrySaved?: () => void;
}

type EditKind = 'polygon' | 'line' | 'points' | 'circle';
type DrawShape = 'polygon' | 'line' | 'point' | 'circle';

export interface EditablePart {
  kind: EditKind;
  /** [lat, lng] pairs; for circles this holds exactly the center. */
  latlngs: [number, number][];
  /** Circle radius in nautical miles (circle parts only). */
  bufferNm?: number;
  zoneLabel?: string | null;
  featureType?: string;
}

const DRAW_PANE = 'adminEditPane';

/** Meters per nautical mile. */
const M_PER_NM = 1852;

function buildPartsFromWarning(w: NavWarning | null): EditablePart[] {
  if (!w) return [];
  const parts: EditablePart[] = [];
  const geoms = (w.spatial?.geometries || []) as any[];
  for (const g of geoms) {
    if (!g || !Array.isArray(g.coordinates)) continue;
    const zoneLabel = g.label || g.zone_label || null;
    if (g.type === 'Polygon') {
      const ring = g.coordinates[0] as number[][];
      const latlngs = ring
        .filter((p) => Array.isArray(p) && p.length >= 2)
        .map((p) => [Number(p[1]), Number(p[0])] as [number, number]);
      // Drop the closing duplicate vertex for editing; it is re-added on save.
      if (latlngs.length > 1) {
        const f = latlngs[0];
        const l = latlngs[latlngs.length - 1];
        if (f[0] === l[0] && f[1] === l[1]) latlngs.pop();
      }
      if (latlngs.length >= 3) {
        const featureType = ['SWEEP_ARC', 'BOUNDING_BOX'].includes(String(g.feature_type).toUpperCase())
          ? String(g.feature_type).toUpperCase() : 'POLYGON';
        parts.push({ kind: 'polygon', latlngs, zoneLabel, featureType });
      }
    } else if (g.type === 'LineString') {
      const latlngs = (g.coordinates as number[][])
        .filter((p) => Array.isArray(p) && p.length >= 2)
        .map((p) => [Number(p[1]), Number(p[0])] as [number, number]);
      if (latlngs.length >= 2) {
        const featureType = String(g.feature_type).toUpperCase() === 'CORRIDOR' ? 'CORRIDOR' : 'LINE';
        parts.push({ kind: 'line', latlngs, zoneLabel, featureType });
      }
    } else if (g.type === 'Point') {
      const p = g.coordinates as number[];
      if (Array.isArray(p) && p.length >= 2) {
        const center: [number, number] = [Number(p[1]), Number(p[0])];
        const bufferNm = Number(g.buffer_nm || g.radius_nm || 0);
        if (bufferNm > 0) {
          parts.push({ kind: 'circle', latlngs: [center], bufferNm, zoneLabel, featureType: 'POINT' });
        } else {
          parts.push({ kind: 'points', latlngs: [center], zoneLabel, featureType: 'POINT' });
        }
      }
    } else if (g.type === 'Circle') {
      const p = Array.isArray(g.coordinates?.[0]) ? (g.coordinates as any[])[0] : g.coordinates;
      if (Array.isArray(p) && p.length >= 2) {
        const radiusNm = Number(g.radius_nm || g.buffer_nm) || 1;
        parts.push({ kind: 'circle', latlngs: [[Number(p[1]), Number(p[0])]], bufferNm: radiusNm, zoneLabel, featureType: 'POINT' });
      }
    }
  }
  return parts;
}

function partsToPatches(parts: EditablePart[]): { patches: WarningGeometryPatch[]; skipped: number } {
  const patches: WarningGeometryPatch[] = [];
  let skipped = 0;
  for (const p of parts) {
    if (p.kind === 'polygon') {
      if (p.latlngs.length < 3) { skipped++; continue; }
      const ring = p.latlngs.map(([lat, lng]) => [lng, lat] as number[]);
      const f = ring[0];
      const l = ring[ring.length - 1];
      if (f[0] !== l[0] || f[1] !== l[1]) ring.push(f);
      patches.push({ zone_label: p.zoneLabel || 'PRIMARY_HAZARD', feature_type: p.featureType || 'POLYGON', geojson: { type: 'Polygon', coordinates: [ring] } });
    } else if (p.kind === 'line') {
      if (p.latlngs.length < 2) { skipped++; continue; }
      patches.push({ zone_label: p.zoneLabel || 'PRIMARY_HAZARD', feature_type: p.featureType || 'LINE', geojson: { type: 'LineString', coordinates: p.latlngs.map(([lat, lng]) => [lng, lat]) } });
    } else if (p.kind === 'circle') {
      if (p.latlngs.length !== 1) { skipped++; continue; }
      patches.push({
        zone_label: p.zoneLabel || 'PRIMARY_HAZARD',
        feature_type: p.featureType || 'POINT',
        buffer_nm: p.bufferNm || 1,
        geojson: { type: 'Point', coordinates: [p.latlngs[0][1], p.latlngs[0][0]] },
      });
    } else {
      for (const [lat, lng] of p.latlngs) {
        patches.push({ zone_label: p.zoneLabel || 'PRIMARY_HAZARD', feature_type: p.featureType || 'POINT', geojson: { type: 'Point', coordinates: [lng, lat] } });
      }
    }
  }
  return { patches, skipped };
}

/** Human-readable original-vs-proposed diff between two part snapshots. */
function summarizeDiff(original: EditablePart[], current: EditablePart[]): string | null {
  if (JSON.stringify(original) === JSON.stringify(current)) return null;
  let movedShapes = 0;
  let structChanges = 0;
  const max = Math.max(original.length, current.length);
  for (let i = 0; i < max; i++) {
    const o = original[i];
    const c = current[i];
    if (!o || !c) {
      structChanges++;
      continue;
    }
    const moved =
      o.kind !== c.kind ||
      o.latlngs.length !== c.latlngs.length ||
      o.latlngs.some((ll, j) => Math.abs(ll[0] - c.latlngs[j][0]) > 1e-9 || Math.abs(ll[1] - c.latlngs[j][1]) > 1e-9) ||
      Math.abs((o.bufferNm || 0) - (c.bufferNm || 0)) > 1e-9;
    if (moved) movedShapes++;
  }
  const bits: string[] = [];
  if (movedShapes > 0) bits.push(`${movedShapes} shape(s) moved/edited`);
  if (structChanges > 0) bits.push(`${structChanges} shape(s) added/removed`);
  return bits.length > 0 ? bits.join(' · ') : 'geometry modified';
}

export const MapGeometryEditor: React.FC<MapGeometryEditorProps> = ({ map, isAdminMode, selectedWarning, onGeometrySaved }) => {
  const [mode, setMode] = useState<'off' | 'edit' | 'draw'>('off');
  const [drawShape, setDrawShape] = useState<DrawShape>('polygon');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'info' | 'success' | 'error'>('info');
  const [histLen, setHistLen] = useState({ undo: 0, redo: 0 });

  const partsRef = useRef<EditablePart[]>([]);
  const drawPtsRef = useRef<[number, number][]>([]);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  // Edit history (undo/redo) — snapshots of the draft taken before each mutation.
  const undoStackRef = useRef<EditablePart[][]>([]);
  const redoStackRef = useRef<EditablePart[][]>([]);
  // The stored geometry snapshot: reset-to-original + original-vs-proposed diff.
  const originalPartsRef = useRef<EditablePart[]>([]);

  const active = isAdminMode && !!selectedWarning && !!map && mode !== 'off';
  // Crash/reload draft key: prefer the DB uuid, fall back to the canonical id.
  const warningKey = selectedWarning ? ((selectedWarning as any).db_uuid || selectedWarning.warning_id) : null;
  const canonical = selectedWarning?.source_warning_id || selectedWarning?.warning_id || '—';

  /** Clear all draft layers from the map. */
  const clearDraftLayers = useCallback(() => {
    if (layerGroupRef.current && map) {
      map.removeLayer(layerGroupRef.current);
      layerGroupRef.current = null;
    }
  }, [map]);

  /** Deep copy of a parts snapshot (for undo/redo + original diff). */
  const cloneParts = useCallback((parts: EditablePart[]): EditablePart[] =>
    parts.map((p) => ({ kind: p.kind, latlngs: p.latlngs.map((ll) => [ll[0], ll[1]] as [number, number]), bufferNm: p.bufferNm, zoneLabel: p.zoneLabel, featureType: p.featureType })), []);

  const syncHistState = useCallback(() => {
    setHistLen({ undo: undoStackRef.current.length, redo: redoStackRef.current.length });
  }, []);

  /** Push the current draft onto the undo stack before each mutation. */
  const pushHistory = useCallback(() => {
    undoStackRef.current.push(cloneParts(partsRef.current));
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
    syncHistState();
  }, [cloneParts, syncHistState]);

  /** Recompute the dirty flag against the stored (original) geometry. */
  const markDirtyIfChanged = useCallback(() => {
    const changed = JSON.stringify(partsRef.current) !== JSON.stringify(originalPartsRef.current);
    setDirty(changed);
    // Persist the crash draft on every real change; clear it when the draft
    // is back to the stored geometry. Storage failures are silent (lib guard).
    if (!warningKey) return;
    if (changed) {
      saveDraft(warningKey, {
        v: 1,
        baseUpdatedAt: (selectedWarning as any)?.updated_at ?? null,
        savedAt: new Date().toISOString(),
        parts: partsRef.current,
      });
    } else {
      clearDraft(warningKey);
    }
  }, [warningKey, selectedWarning]);

  /** Re-render the current draft (parts + in-progress draw points) imperatively. */
  const renderDraft = useCallback(() => {
    if (!map) return;
    clearDraftLayers();
    if (mode === 'off') return;
    const group = L.layerGroup().addTo(map);
    layerGroupRef.current = group;

    const shapeStyle = (kind: EditKind) => ({
      color: '#dc2626',
      weight: 2.5,
      dashArray: '6, 6',
      fillColor: kind === 'polygon' ? '#ef4444' : undefined,
      fillOpacity: 0.25,
      pane: DRAW_PANE,
      bubblingMouseEvents: false,
    });

    partsRef.current.forEach((part, pi) => {
      let radiusHandle: L.Marker | null = null;
      if (part.kind === 'polygon' && part.latlngs.length >= 3) {
        const poly = L.polygon(part.latlngs, shapeStyle('polygon') as any).addTo(group);
        poly.on('dblclick', (e) => L.DomEvent.stopPropagation(e as unknown as Event));
      } else if (part.kind === 'line' && part.latlngs.length >= 2) {
        L.polyline(part.latlngs, shapeStyle('line') as any).addTo(group);
      } else if (part.kind === 'circle' && part.latlngs.length === 1) {
        const center = part.latlngs[0];
        const radiusM = (part.bufferNm || 1) * M_PER_NM;
        L.circle(center, { ...shapeStyle('circle'), radius: radiusM } as any).addTo(group);
        // Radius handle: due east of the center at the current radius.
        const handleLat = center[0];
        const handleLng = center[1] + (radiusM / 111320) / Math.max(Math.cos((center[0] * Math.PI) / 180), 0.01);
        const handle = L.marker([handleLat, handleLng], {
          draggable: true,
          icon: vertexIcon('#f59e0b'),
          pane: DRAW_PANE,
        }).addTo(group);
        radiusHandle = handle;
        handle.bindTooltip('Drag to set radius', { direction: 'top', offset: [0, -6] });
        handle.on('dragstart', () => pushHistory());
        handle.on('drag', (e: any) => {
          const latlng = e.target.getLatLng();
          const meters = L.latLng(center[0], center[1]).distanceTo(L.latLng(latlng.lat, latlng.lng));
          part.bufferNm = Math.max(meters / M_PER_NM, 0.1);
          setDirty(true);
          // Live-update the circle radius.
          const layers = (layerGroupRef.current as any)?.getLayers?.() || [];
          layers.forEach((ly: any) => {
            if (ly instanceof L.CircleMarker && !(ly instanceof L.Marker)) return;
            if (ly && ly.setRadius && ly.getLatLng && ly instanceof L.Circle) {
              const c = ly.getLatLng();
              if (Math.abs(c.lat - center[0]) < 1e-9 && Math.abs(c.lng - center[1]) < 1e-9) {
                ly.setRadius(part.bufferNm * M_PER_NM);
              }
            }
          });
        });
        handle.on('dragend', () => {
          setMessage(`Circle radius: ${((part.bufferNm || 1)).toFixed(2)} NM`);
          markDirtyIfChanged();
          renderDraft();
        });
        // Keyboard access (WCAG 2.1.1): arrows adjust the radius in NM (Shift = x10).
        const rEl = handle.getElement() as HTMLElement | null;
        if (rEl) {
          rEl.setAttribute('role', 'button');
          rEl.setAttribute('tabindex', '0');
          rEl.setAttribute('aria-label', 'Circle radius — arrow keys adjust radius in NM (Shift = x10)');
          rEl.addEventListener('keydown', (ev: KeyboardEvent) => {
            let delta = 0;
            if (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') delta = ev.shiftKey ? 1 : 0.1;
            else if (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') delta = ev.shiftKey ? -1 : -0.1;
            if (delta === 0) return;
            ev.preventDefault();
            ev.stopPropagation();
            pushHistory();
            part.bufferNm = Math.max((part.bufferNm || 1) + delta, 0.1);
            markDirtyIfChanged();
            const radiusM = part.bufferNm * M_PER_NM;
            const layers = (layerGroupRef.current as any)?.getLayers?.() || [];
            layers.forEach((ly: any) => {
              if (ly instanceof L.Circle) {
                const cc = ly.getLatLng();
                if (Math.abs(cc.lat - center[0]) < 1e-9 && Math.abs(cc.lng - center[1]) < 1e-9) ly.setRadius(radiusM);
              }
            });
            handle.setLatLng([center[0], center[1] + (radiusM / 111320) / Math.max(Math.cos((center[0] * Math.PI) / 180), 0.01)]);
            setMessage(`Circle radius: ${part.bufferNm.toFixed(2)} NM`);
          });
        }
      } else if (part.kind === 'points') {
        part.latlngs.forEach((ll) => {
          L.circleMarker(ll, { radius: 5, color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.9, weight: 1.5, pane: DRAW_PANE }).addTo(group);
        });
      }

      // Draggable vertex handles (polygons, lines, points and circle centers).
      if (part.kind !== 'circle') {
        part.latlngs.forEach((ll, vi) => {
          const marker = L.marker(ll, { draggable: true, icon: vertexIcon('#dc2626'), pane: DRAW_PANE }).addTo(group);
          marker.bindTooltip(`V${vi + 1} — drag to move, double-click to delete`, { direction: 'top', offset: [0, -8] });
          marker.on('dragstart', () => pushHistory());
          marker.on('drag', (e: any) => {
            const p = e.target.getLatLng();
            part.latlngs[vi] = [p.lat, p.lng];
            setDirty(true);
            // Live-update the outline shape.
            const layers = (layerGroupRef.current as any)?.getLayers?.() || [];
            layers.forEach((ly: any) => {
              if (ly instanceof L.Polygon && part.kind === 'polygon') ly.setLatLngs(part.latlngs);
              if (ly instanceof L.Polyline && !(ly instanceof L.Polygon) && part.kind === 'line') ly.setLatLngs(part.latlngs);
            });
          });
          marker.on('dragend', () => { markDirtyIfChanged(); renderDraft(); });
          marker.on('dblclick', (e: any) => {
            L.DomEvent.stopPropagation(e);
            const min = part.kind === 'polygon' ? 3 : part.kind === 'line' ? 2 : 1;
            if (part.latlngs.length <= min) {
              setMessage(`A ${part.kind} needs at least ${min} vertices.`);
              return;
            }
            pushHistory();
            part.latlngs.splice(vi, 1);
            markDirtyIfChanged();
            renderDraft();
          });
          // Keyboard access (WCAG 2.1.1): Tab to a handle, arrow keys nudge
          // (Shift = x10), Delete removes — mirroring drag/double-click.
          const vEl = marker.getElement() as HTMLElement | null;
          if (vEl) {
            vEl.setAttribute('role', 'button');
            vEl.setAttribute('tabindex', '0');
            vEl.setAttribute('aria-label', `Vertex ${vi + 1} of ${part.latlngs.length} — arrow keys move (Shift = x10), Delete removes`);
            vEl.addEventListener('keydown', (ev: KeyboardEvent) => {
              const step = ev.shiftKey ? 0.01 : 0.001;
              let nudged = false;
              if (ev.key === 'ArrowUp') { part.latlngs[vi][0] += step; nudged = true; }
              else if (ev.key === 'ArrowDown') { part.latlngs[vi][0] -= step; nudged = true; }
              else if (ev.key === 'ArrowRight') { part.latlngs[vi][1] += step; nudged = true; }
              else if (ev.key === 'ArrowLeft') { part.latlngs[vi][1] -= step; nudged = true; }
              if (nudged) {
                ev.preventDefault();
                ev.stopPropagation();
                pushHistory();
                marker.setLatLng(part.latlngs[vi]);
                markDirtyIfChanged();
                const layers = (layerGroupRef.current as any)?.getLayers?.() || [];
                layers.forEach((ly: any) => {
                  if (ly instanceof L.Polygon && part.kind === 'polygon') ly.setLatLngs(part.latlngs);
                  if (ly instanceof L.Polyline && !(ly instanceof L.Polygon) && part.kind === 'line') ly.setLatLngs(part.latlngs);
                });
                return;
              }
              if (ev.key === 'Delete' || ev.key === 'Backspace') {
                ev.preventDefault();
                ev.stopPropagation();
                const min = part.kind === 'polygon' ? 3 : part.kind === 'line' ? 2 : 1;
                if (part.latlngs.length <= min) {
                  setMessage(`A ${part.kind} needs at least ${min} vertices.`);
                  return;
                }
                pushHistory();
                part.latlngs.splice(vi, 1);
                markDirtyIfChanged();
                renderDraft();
              }
            });
          }
        });
      } else if (part.latlngs.length === 1) {
        const center = part.latlngs[0];
        const centerHandle = L.marker(center, { draggable: true, icon: vertexIcon('#dc2626'), pane: DRAW_PANE }).addTo(group);
        centerHandle.bindTooltip('Circle center — drag to move', { direction: 'top', offset: [0, -8] });
        centerHandle.on('dragstart', () => pushHistory());
        centerHandle.on('drag', (e: any) => {
          const p = e.target.getLatLng();
          part.latlngs[0] = [p.lat, p.lng];
          setDirty(true);
          renderDraft();
        });
        centerHandle.on('dragend', () => markDirtyIfChanged());
        // Keyboard access (WCAG 2.1.1): arrows move the circle center (Shift = x10).
        const cEl = centerHandle.getElement() as HTMLElement | null;
        if (cEl) {
          cEl.setAttribute('role', 'button');
          cEl.setAttribute('tabindex', '0');
          cEl.setAttribute('aria-label', 'Circle center — arrow keys move (Shift = x10)');
          cEl.addEventListener('keydown', (ev: KeyboardEvent) => {
            const step = ev.shiftKey ? 0.01 : 0.001;
            const prev: [number, number] = [part.latlngs[0][0], part.latlngs[0][1]];
            let nudged = false;
            if (ev.key === 'ArrowUp') { part.latlngs[0][0] += step; nudged = true; }
            else if (ev.key === 'ArrowDown') { part.latlngs[0][0] -= step; nudged = true; }
            else if (ev.key === 'ArrowRight') { part.latlngs[0][1] += step; nudged = true; }
            else if (ev.key === 'ArrowLeft') { part.latlngs[0][1] -= step; nudged = true; }
            if (!nudged) return;
            ev.preventDefault();
            ev.stopPropagation();
            pushHistory();
            const c = part.latlngs[0];
            centerHandle.setLatLng(c);
            markDirtyIfChanged();
            const layers = (layerGroupRef.current as any)?.getLayers?.() || [];
            layers.forEach((ly: any) => {
              if (ly instanceof L.Circle) {
                const cc = ly.getLatLng();
                if (Math.abs(cc.lat - prev[0]) < 1e-9 && Math.abs(cc.lng - prev[1]) < 1e-9) ly.setLatLng(c);
              }
            });
            if (radiusHandle && part.bufferNm) {
              const radiusM = part.bufferNm * M_PER_NM;
              radiusHandle.setLatLng([c[0], c[1] + (radiusM / 111320) / Math.max(Math.cos((c[0] * Math.PI) / 180), 0.01)]);
            }
          });
        }
      }
      void pi;
    });

    // In-progress draw points.
    if (mode === 'draw' && drawPtsRef.current.length > 0) {
      const pts = drawPtsRef.current;
      if (pts.length > 1) {
        L.polyline(pts, { color: '#2563eb', weight: 2, dashArray: '4, 6', pane: DRAW_PANE }).addTo(group);
        if (drawShape === 'polygon' && pts.length >= 3) {
          L.polygon(pts, { color: '#2563eb', weight: 1.5, dashArray: '4, 6', fillColor: '#3b82f6', fillOpacity: 0.12, pane: DRAW_PANE }).addTo(group);
        }
      }
      pts.forEach((ll, i) => {
        L.marker(ll, { icon: vertexIcon('#2563eb'), pane: DRAW_PANE })
          .bindTooltip(i === 0 ? 'First point' : `P${i + 1}`, { direction: 'top', offset: [0, -8] })
          .addTo(group);
      });
    }
  }, [map, mode, drawShape, clearDraftLayers, pushHistory, markDirtyIfChanged]);

  const vertexIcon = (color: string) =>
    L.divIcon({
      className: 'admin-vertex-handle',
      html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.6);cursor:move;"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

  // Reset state whenever the selected warning changes.
  useEffect(() => {
    setMode('off');
    setDirty(false);
    setMessage(null);
    drawPtsRef.current = [];
  }, [selectedWarning?.warning_id]);

  // Enter/exit a mode.
  const enterMode = (next: 'off' | 'edit' | 'draw') => {
    if (!selectedWarning) return;
    const storedGeometries = selectedWarning.spatial?.geometries || [];
    const tierBWithStoredGeometry =
      String((selectedWarning as any).triage_tier || '').toUpperCase() === 'B' && storedGeometries.length > 0;
    if (next === 'edit' || (next === 'draw' && tierBWithStoredGeometry)) {
      const reason = geometryEditBlockReason(storedGeometries, {
        allowMultiple: true,
        allowBufferedPoints: true,
        allowCircle: true,
        metadataComplete: !tierBWithStoredGeometry,
      });
      if (reason) {
        setMessageKind('error');
        setMessage(reason);
        return;
      }
    }
    // Draw-new starts empty: it must never load a partial view of unsupported shapes.
    partsRef.current = next === 'draw' ? [] : buildPartsFromWarning(selectedWarning);
    originalPartsRef.current = cloneParts(partsRef.current);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistLen({ undo: 0, redo: 0 });
    setMessageKind('info');
    drawPtsRef.current = [];
    setDirty(false);
    setMessage(null);
    setMode(next);

    // Crash/reload draft recovery (console save resilience). The draft is
    // restored only against the same warning version — a stale draft is
    // discarded loudly, never applied silently.
    if (warningKey) {
      const d = loadDraft(warningKey);
      if (d) {
        if (d.baseUpdatedAt === ((selectedWarning as any).updated_at ?? null)) {
          const when = new Date(d.savedAt).toLocaleString();
          if (window.confirm('An unsaved geometry draft from ' + when + ' exists for this warning. Restore it?')) {
            partsRef.current = cloneParts(d.parts);
            markDirtyIfChanged();
            setMessage('Draft restored. Not saved yet.');
            setMessageKind('info');
          } else {
            clearDraft(warningKey);
          }
        } else {
          clearDraft(warningKey);
          setMessage('A stored draft was discarded because this warning changed since it was made.');
          setMessageKind('error');
        }
      }
    }
  };

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    redoStackRef.current.push(cloneParts(partsRef.current));
    partsRef.current = undoStackRef.current.pop() || [];
    syncHistState();
    markDirtyIfChanged();
    setMessage('Undo.');
    setMessageKind('info');
    renderDraft();
  }, [cloneParts, syncHistState, markDirtyIfChanged, renderDraft]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    undoStackRef.current.push(cloneParts(partsRef.current));
    partsRef.current = redoStackRef.current.pop() || [];
    syncHistState();
    markDirtyIfChanged();
    setMessage('Redo.');
    setMessageKind('info');
    renderDraft();
  }, [cloneParts, syncHistState, markDirtyIfChanged, renderDraft]);

  const exitMode = () => {
    if (warningKey) clearDraft(warningKey);
    setMode('off');
    setDirty(false);
    setMessage(null);
    setMessageKind('info');
    drawPtsRef.current = [];
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistLen({ undo: 0, redo: 0 });
    clearDraftLayers();
  };

  // Re-render draft whenever mode/shape changes; create the high z-index pane.
  useEffect(() => {
    if (!map) return;
    if (!map.getPane(DRAW_PANE)) {
      const p = map.createPane(DRAW_PANE);
      p.style.zIndex = '470';
      p.style.pointerEvents = 'auto';
    }
    renderDraft();
    if (mode === 'off') clearDraftLayers();
    return () => clearDraftLayers();
  }, [mode, map, renderDraft, clearDraftLayers]);

  // Suppress double-click zoom while editing; wire map click for draw mode.
  useEffect(() => {
    if (!map) return;
    if (mode !== 'off') map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();

    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (mode !== 'draw') return;
      drawPtsRef.current.push([e.latlng.lat, e.latlng.lng]);
      setMessage(`Draw: ${drawPtsRef.current.length} point(s) placed. Click Finish or double-click to complete.`);
      renderDraft();
    };
    const onMapDblClick = () => {
      if (mode === 'draw') finishDraw();
    };
    map.on('click', onMapClick);
    map.on('dblclick', onMapDblClick);
    return () => {
      map.off('click', onMapClick);
      map.off('dblclick', onMapDblClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mode, drawShape]);

  // Ctrl/Cmd+Z and Ctrl/Cmd+Y while an edit/draw mode is active.
  useEffect(() => {
    if (mode === 'off') return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        undo();
      } else if (k === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, undo, redo]);

  const finishDraw = () => {
    const pts = drawPtsRef.current;
    if (pts.length === 0) { setMessage('Draw: no points placed yet.'); return; }
    let part: EditablePart | null = null;
    if (drawShape === 'polygon' && pts.length >= 3) part = { kind: 'polygon', latlngs: pts.slice() };
    else if (drawShape === 'line' && pts.length >= 2) part = { kind: 'line', latlngs: pts.slice() };
    else if (drawShape === 'point') part = { kind: 'points', latlngs: pts.slice() };
    else if (drawShape === 'circle' && pts.length >= 1) {
      // Circle: first click = center; second click (if any) = radius point.
      const center = pts[0];
      let radiusNm = 1;
      if (pts.length >= 2) {
        radiusNm = Math.max(L.latLng(center[0], center[1]).distanceTo(L.latLng(pts[1][0], pts[1][1])) / M_PER_NM, 0.1);
      }
      part = { kind: 'circle', latlngs: [center], bufferNm: radiusNm };
    }
    if (!part) {
      setMessage(drawShape === 'polygon' ? 'A polygon needs at least 3 points.' : 'A route needs at least 2 points.');
      return;
    }
    pushHistory();
    partsRef.current = [part]; // Draw-new replaces the existing geometry on save.
    drawPtsRef.current = [];
    markDirtyIfChanged();
    setMessage('Draft created from drawn points. Adjust vertices, then Save.');
    renderDraft();
  };

  const handleSave = async () => {
    if (!selectedWarning) return;
    const { patches, skipped } = partsToPatches(partsRef.current);
    if (patches.length === 0) {
      setMessage('Nothing to save — all shapes are empty (removing all geometry requires the modal and a lower tier).');
      return;
    }
    setSaving(true);
    setMessage(null);
    const w = selectedWarning as any;
    // Hemisphere-ambiguity guard: a manual edit is allowed only as an explicit
    // human decision — never an automated guess. The AMBIGUOUS flag itself is
    // cleared through the edit modal (quality change + audit note), never
    // implicitly by a map geometry edit.
    if (w.data_quality === 'AMBIGUOUS' || (Array.isArray(w.ambiguous_positions) && w.ambiguous_positions.length > 0)) {
      const proceed = window.confirm(
        'This warning is flagged AMBIGUOUS (hemisphere-ambiguous coordinates).\n\n' +
        'Saving a manual geometry edit is allowed only as an explicit human decision — never an automated guess. ' +
        'The AMBIGUOUS flag stays until it is cleared through the edit modal with a quality change and an audit note.\n\nProceed with this manual edit?'
      );
      if (!proceed) {
        setSaving(false);
        return;
      }
    }
    const res = await saveWarningEdit({
      warningId: w.db_uuid || undefined,
      canonicalId: selectedWarning.warning_id,
      expectedUpdatedAt: w.updated_at ?? undefined,
      patch: {
        geometry: patches,
        note: 'Map-native geometry edit (E2)',
      },
    });
    setSaving(false);
    if (res.ok) {
      setMessageKind('success');
      setMessage(`Saved (${res.geometry || 'replaced'}${skipped ? `, ${skipped} empty shape(s) skipped` : ''}). Geometry updated and audit row written.`);
      if (warningKey) clearDraft(warningKey);
      setDirty(false);
      exitMode();
      onGeometrySaved?.();
    } else if ((res as any).status === 409) {
      setMessageKind('error');
      setMessage('Save conflict: this warning was changed by another operator. Reload the latest version, then re-apply your edit.');
    } else {
      setMessageKind('error');
      setMessage(res.error || 'Save failed — the geometry and audit trail are unchanged.');
    }
  };

  if (!isAdminMode || !selectedWarning || !map) return null;

  const diffSummary = summarizeDiff(originalPartsRef.current, partsRef.current);

  const modeBtn = (m: 'edit' | 'draw', icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => (mode === m ? exitMode() : enterMode(m))}
      className={`flex items-center gap-1.5 px-3 py-2 rounded text-[10px] font-medium uppercase border transition-colors ${
 mode === m ? 'bg-gw-primary text-gw-bg border-gw-primary' : 'bg-gw-panel text-gw-primary border-gw-secondary hover:border-gw-primary'
 }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[480] w-[calc(100%-24px)] max-w-lg pointer-events-auto">
      <div className="bg-gw-panel/95 border-2 border-gw-primary rounded-xl backdrop-blur-xs p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-2 min-w-0 text-[11px] font-bold uppercase tracking-wider text-gw-primary truncate">
            <PenTool className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Geometry — {canonical}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {modeBtn('edit', <MousePointerClick className="w-3.5 h-3.5" />, 'Edit vertices')}
            {modeBtn('draw', <PenTool className="w-3.5 h-3.5" />, 'Draw new')}
            {mode !== 'off' && (
              <>
                <button
                  type="button"
                  onClick={() => { pushHistory(); partsRef.current = mode === 'draw' ? [] : buildPartsFromWarning(selectedWarning); drawPtsRef.current = []; markDirtyIfChanged(); setMessage(mode === 'draw' ? 'Draw-new draft cleared.' : 'Draft reset to the stored geometry.'); setMessageKind('info'); renderDraft(); }}
                  className="flex items-center gap-1 p-2 bg-gw-panel border border-gw-secondary text-gw-accent rounded text-[10px] font-medium uppercase hover:text-gw-primary transition-colors"
                  title="Reset draft to stored geometry"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={undo}
                  disabled={histLen.undo === 0}
                  className="p-2 bg-gw-panel border border-gw-secondary text-gw-accent rounded hover:text-gw-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Undo (Ctrl+Z)"
                  aria-label="Undo"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={histLen.redo === 0}
                  className="p-2 bg-gw-panel border border-gw-secondary text-gw-accent rounded hover:text-gw-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Redo (Ctrl+Y)"
                  aria-label="Redo"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gw-primary hover:bg-gw-accent text-gw-bg rounded text-[10px] font-medium uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={exitMode}
                  aria-label="Cancel geometry edits"
                  className="p-2 bg-gw-panel border border-gw-secondary text-gw-accent rounded hover:text-gw-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {mode === 'draw' && (
          <div className="flex items-center gap-2 text-[10px] text-gw-accent flex-wrap">
            <span className="font-bold uppercase">Shape:</span>
            {([['polygon', Square], ['line', Route], ['point', MousePointerClick], ['circle', CircleIcon]] as const).map(([shape, Icon]) => (
              <button
                key={shape}
                type="button"
                onClick={() => setDrawShape(shape)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded border font-medium uppercase ${
 drawShape === shape ? 'bg-gw-primary text-gw-bg border-gw-primary' : 'bg-gw-panel text-gw-primary border-gw-secondary'
 }`}
              >
                <Icon className="w-3 h-3" />
                <span>{shape}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={finishDraw}
              className="ml-auto px-3 py-2 bg-[var(--accent)] hover:brightness-110 text-[var(--canvas)] rounded font-medium uppercase"
            >
              Finish shape
            </button>
          </div>
        )}

        {mode !== 'off' && (
          <div className="text-[10px] text-gw-accent leading-relaxed">
            {mode === 'edit'
              ? 'Drag vertex handles to move them · double-click a handle to delete it · circle: drag center to move, drag amber handle for radius (NM). Keyboard: Tab to a handle, arrow keys nudge (Shift = x10), Delete removes; circle center and radius handles take arrows too. Save writes through the admin-guarded API.'
              : 'Click the chart to place vertices (polygon ≥3, route ≥2; circle: center then radius point). Finish or double-click to complete. Point placement is pointer-based — for full keyboard point entry use the Edit modal Geometry tab (editable point table).'}
          </div>
        )}

        {mode !== 'off' && dirty && diffSummary && (
          <div className="text-[10px] font-mono px-2.5 py-1.5 rounded border bg-sky-50 text-sky-900 border-sky-300 flex items-center gap-1.5">
            <FileDiff className="w-3 h-3 shrink-0" />
            <span>Proposed change vs stored geometry: {diffSummary}</span>
          </div>
        )}

        {message && (
          <div className={`text-[10px] font-mono px-2.5 py-1.5 rounded border ${
            messageKind === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : messageKind === 'error'
              ? 'bg-red-50 text-red-800 border-red-300'
              : 'bg-amber-50 text-amber-900 border-amber-300'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

// src/components/MaritimeMap.tsx
// Comprehensive Maritime Spatial Engine & Multi-Plot Map Component

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { NavWarning, NavAreaId, SourceRegistryItem } from '../types';
import { SpatialPlotType, MapFilterState } from '../types/maritime';
import {
  computeDistanceNm,
  computePolygonAreaSqNm,
  computeCentroid,
  computeLineCorridor,
  parseClearanceDirective,
  parseDriftVector,
  formatWgs84Dms,
} from '../core/coordinates';
import {
  Search,
  MapPin,
  Layers,
  Sliders,
  Globe,
  Waves,
  X,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Compass,
  AlertTriangle,
  Anchor,
  Radio,
  Eye,
  EyeOff,
  Crosshair,
  Filter,
} from 'lucide-react';
import { MAP_PANES, BASE_LAYERS, OVERLAY_LAYERS } from '../config/mapLayers';
import { NAVAREA_ZONE_LIST, NAVAREA_ZONES_BY_ID } from '../utils/navareaZones';
import { classifyWarning } from '../parsers/warningClassifier';
import { extractMaritimePlots } from '../parsers/geometryExtractor';
import { renderHazardBadgeHtml } from '../utils/hazardIcons';
import { getWarningDate, getWarningBulletinText } from '../utils/warningHelpers';

export interface MaritimeMapProps {
  warnings: NavWarning[];
  selectedNavArea?: NavAreaId | 'ALL';
  sources?: SourceRegistryItem[];
  onSelectWarning: (warning: NavWarning) => void;
  isolatedWarning?: NavWarning | null;
  onClearIsolation?: () => void;
  className?: string;
}

export const MaritimeMap: React.FC<MaritimeMapProps> = ({
  warnings,
  selectedNavArea: initialNavArea = 'ALL',
  sources,
  onSelectWarning,
  isolatedWarning,
  onClearIsolation,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);

  // Layer groups refs
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const seamarksLayerRef = useRef<L.TileLayer | null>(null);
  const soundingsLayerRef = useRef<L.TileLayer | null>(null);
  const markerClusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const vectorLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Filter & Layer States
  const [selectedNavArea, setSelectedNavArea] = useState<string>(initialNavArea);
  const [activeBaseMapId, setActiveBaseMapId] = useState<string>('openseamap-base');
  const [activePlotType, setActivePlotType] = useState<SpatialPlotType>('all');
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Mobile Bottom Sheet state
  const [isSheetExpanded, setIsSheetExpanded] = useState<boolean>(false);

  // Granular Layer & Plot Toggles
  const [layerFilters, setLayerFilters] = useState<MapFilterState>({
    plotType: 'all',
    showPolygons: true,
    showCircles: true,
    showLines: true,
    showCorridors: true,
    showDriftVectors: true,
    showPointMarkers: true,
    showVertexPins: true,
    showCentroidBadges: true,
    showRadialLines: true,
    showSeamarks: true,
    showSoundings: false,
    enableClustering: true,
  });

  // Filter warnings by selected NAVAREA
  const filteredWarnings = useMemo(() => {
    return warnings.filter((w) => {
      if (selectedNavArea !== 'ALL' && w.navarea !== selectedNavArea) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const id = (w.warning_id || w.source_warning_id || '').toLowerCase();
        const text = (w.raw_text || w.title || '').toLowerCase();
        if (!id.includes(q) && !text.includes(q)) return false;
      }
      return true;
    });
  }, [warnings, selectedNavArea, searchQuery]);

  // Real-time Counts by Plot Type
  const plotTypeCounts = useMemo(() => {
    const counts = {
      all: filteredWarnings.length,
      polygon: 0,
      circle: 0,
      line: 0,
      corridor: 0,
      drift: 0,
      point: 0,
      rig: 0,
    };

    filteredWarnings.forEach((w) => {
      const plots = extractMaritimePlots(w);
      plots.forEach((p) => {
        if (p.plotType === 'polygon') counts.polygon++;
        else if (p.plotType === 'circle') counts.circle++;
        else if (p.plotType === 'line') counts.line++;
        else if (p.plotType === 'corridor') counts.corridor++;
        else if (p.plotType === 'drift_vector') counts.drift++;
        else if (p.plotType === 'point') counts.point++;
        if (p.hazardType === 'platform' || p.hazardType === 'rig') counts.rig++;
      });
      if (plots.length === 0) {
        counts.point++;
      }
    });

    return counts;
  }, [filteredWarnings]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || leafletMapRef.current) return;

    const isMobile = window.innerWidth <= 768;
    const initialCenter: [number, number] = [30.0, 0.0];
    const initialZoom = isMobile ? 2 : 3;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      worldCopyJump: true,
      zoomControl: false,
      attributionControl: false,
    });

    leafletMapRef.current = map;

    // Create Custom Stacking Panes
    Object.values(MAP_PANES).forEach((p) => {
      const pane = map.createPane(p.name);
      pane.style.zIndex = String(p.zIndex);
      if (p.pointerEvents) {
        pane.style.pointerEvents = p.pointerEvents;
      }
    });

    // Add Base Tile Layer
    const baseConfig =
      BASE_LAYERS.find((b) => b.id === activeBaseMapId) || BASE_LAYERS[0];
    const baseTile = L.tileLayer(baseConfig.url, {
      maxZoom: baseConfig.maxZoom,
      pane: 'basePane',
      attribution: baseConfig.attribution,
    }).addTo(map);
    baseTileLayerRef.current = baseTile;

    // Add Seamarks Overlay
    const seamarksConfig = OVERLAY_LAYERS.find((o) => o.id === 'openseamap');
    if (seamarksConfig) {
      const seamarksTile = L.tileLayer(seamarksConfig.url, {
        maxZoom: seamarksConfig.maxZoom,
        pane: 'seamarksPane',
      });
      if (layerFilters.showSeamarks) {
        seamarksTile.addTo(map);
      }
      seamarksLayerRef.current = seamarksTile;
    }

    // Add Soundings Overlay
    const soundingsConfig = OVERLAY_LAYERS.find((o) => o.id === 'esri-labels');
    if (soundingsConfig) {
      const soundingsTile = L.tileLayer(soundingsConfig.url, {
        maxZoom: soundingsConfig.maxZoom,
        pane: 'soundingsPane',
      });
      if (layerFilters.showSoundings) {
        soundingsTile.addTo(map);
      }
      soundingsLayerRef.current = soundingsTile;
    }

    // Setup Marker Cluster and Vector Groups
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 40,
      disableClusteringAtZoom: 8,
      showCoverageOnHover: false,
    }).addTo(map);
    markerClusterGroupRef.current = clusterGroup;

    const vectorGroup = L.layerGroup().addTo(map);
    vectorLayerGroupRef.current = vectorGroup;

    // Responsive Orientation & Resize Listener
    const handleMapResize = () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.invalidateSize();
      }
    };

    window.addEventListener('resize', handleMapResize);
    window.addEventListener('orientationchange', handleMapResize);

    return () => {
      window.removeEventListener('resize', handleMapResize);
      window.removeEventListener('orientationchange', handleMapResize);
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  // Handle Base Layer Switch
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;

    const baseConfig =
      BASE_LAYERS.find((b) => b.id === activeBaseMapId) || BASE_LAYERS[0];
    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
    }

    const newBase = L.tileLayer(baseConfig.url, {
      maxZoom: baseConfig.maxZoom,
      pane: 'basePane',
      attribution: baseConfig.attribution,
    });
    newBase.addTo(map);
    baseTileLayerRef.current = newBase;
  }, [activeBaseMapId]);

  // Handle Seamarks Toggle
  useEffect(() => {
    if (!leafletMapRef.current || !seamarksLayerRef.current) return;
    const map = leafletMapRef.current;
    if (layerFilters.showSeamarks) {
      if (!map.hasLayer(seamarksLayerRef.current)) {
        seamarksLayerRef.current.addTo(map);
      }
    } else {
      if (map.hasLayer(seamarksLayerRef.current)) {
        map.removeLayer(seamarksLayerRef.current);
      }
    }
  }, [layerFilters.showSeamarks]);

  // Handle Soundings Toggle
  useEffect(() => {
    if (!leafletMapRef.current || !soundingsLayerRef.current) return;
    const map = leafletMapRef.current;
    if (layerFilters.showSoundings) {
      if (!map.hasLayer(soundingsLayerRef.current)) {
        soundingsLayerRef.current.addTo(map);
      }
    } else {
      if (map.hasLayer(soundingsLayerRef.current)) {
        map.removeLayer(soundingsLayerRef.current);
      }
    }
  }, [layerFilters.showSoundings]);

  // Re-center on NAVAREA
  const handleRecenterNavArea = useCallback((navAreaId: string) => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;

    if (navAreaId === 'ALL') {
      const isMobile = window.innerWidth <= 768;
      map.setView([30.0, 0.0], isMobile ? 2 : 3, { animate: true });
      return;
    }

    const zone = NAVAREA_ZONES_BY_ID[navAreaId as NavAreaId];
    if (zone?.bounds) {
      const { minLat, maxLat, minLng, maxLng } = zone.bounds;
      map.fitBounds(
        [
          [minLat, minLng],
          [maxLat, maxLng],
        ],
        { padding: [30, 30], maxZoom: 6, animate: true }
      );
    } else if (zone?.center) {
      map.flyTo(zone.center, zone.zoom || 5, { animate: true });
    }
  }, []);

  // Main Render Plotting Routine
  useEffect(() => {
    if (!leafletMapRef.current || !vectorLayerGroupRef.current || !markerClusterGroupRef.current) {
      return;
    }

    const vectorGroup = vectorLayerGroupRef.current;
    const clusterGroup = markerClusterGroupRef.current;

    vectorGroup.clearLayers();
    clusterGroup.clearLayers();

    filteredWarnings.forEach((w) => {
      const isIsolated = isolatedWarning?.warning_id === w.warning_id;
      const classification = classifyWarning(w.raw_text || w.title || '');
      const plots = extractMaritimePlots(w);

      plots.forEach((plot) => {
        if (activePlotType !== 'all') {
          if (activePlotType === 'polygon' && plot.plotType !== 'polygon') return;
          if (activePlotType === 'circle' && plot.plotType !== 'circle') return;
          if (activePlotType === 'line' && plot.plotType !== 'line') return;
          if (activePlotType === 'corridor' && plot.plotType !== 'corridor') return;
          if (activePlotType === 'drift' && plot.plotType !== 'drift_vector') return;
          if (activePlotType === 'rig' && plot.hazardType !== 'platform' && plot.hazardType !== 'rig') return;
          if (activePlotType === 'point' && plot.plotType !== 'point') return;
        }

        if (plot.plotType === 'polygon' && layerFilters.showPolygons) {
          try {
            const latLngs = plot.coordinates;
            if (latLngs.length < 3) return;

            const isFiringOrBombing = plot.hazardType === 'firing' || plot.hazardType === 'bombing' || plot.hazardType === 'danger_area';
            const polyColor = isFiringOrBombing ? '#dc2626' : '#2563eb';

            const polyLayer = L.polygon(latLngs, {
              color: polyColor,
              weight: isIsolated ? 3 : 2,
              opacity: 0.95,
              fillColor: polyColor,
              fillOpacity: isIsolated ? 0.35 : 0.18,
              dashArray: '6, 6',
              pane: 'navWarnVectorPane',
            }).addTo(vectorGroup);

            polyLayer.on('click', () => {
              onSelectWarning(w);
              setIsSheetExpanded(true);
            });

            if (layerFilters.showVertexPins) {
              latLngs.forEach((coord, idx) => {
                const vertexIcon = L.divIcon({
                  className: 'nw-vertex-pin-wrap',
                  html: `<div class="vertex-pin touch-tap-active">${idx + 1}</div>`,
                  iconSize: [20, 20],
                  iconAnchor: [10, 10],
                });
                const vertexMarker = L.marker(coord, { icon: vertexIcon, pane: 'navWarnVectorPane' }).addTo(vectorGroup);
                vertexMarker.bindTooltip(`Vertex ${idx + 1}: ${formatWgs84Dms(coord[0], coord[1])}`);
                vertexMarker.on('click', (e) => {
                  L.DomEvent.stopPropagation(e);
                  onSelectWarning(w);
                  setIsSheetExpanded(true);
                });
              });
            }

            if (layerFilters.showCentroidBadges && plot.areaSqNm && plot.areaSqNm > 0) {
              const centroid = computeCentroid(latLngs);
              const warningCode = w.warning_number ? `${w.warning_number}/${w.warning_year || '26'}` : w.source_warning_id || w.warning_id;
              const centroidIcon = L.divIcon({
                className: 'nw-centroid-wrap',
                html: `<div class="centroid-metric-badge touch-tap-active"><span class="dot"></span><span>${warningCode} · ${plot.areaSqNm} sq NM</span></div>`,
                iconSize: [120, 24],
                iconAnchor: [60, 12],
              });
              const centroidMarker = L.marker(centroid, { icon: centroidIcon, pane: 'navWarnVectorPane' }).addTo(vectorGroup);
              centroidMarker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                onSelectWarning(w);
                setIsSheetExpanded(true);
              });
            }
          } catch (err) {
            console.warn('Polygon render error:', err);
          }
        }

        if (plot.plotType === 'circle' && layerFilters.showCircles) {
          try {
            const center = plot.coordinates[0];
            const radiusNm = plot.radiusNm || 1.0;
            const radiusM = radiusNm * 1852;
            const isRigZone = plot.hazardType === 'platform' || plot.hazardType === 'rig';

            const circleLayer = L.circle(center, {
              color: isRigZone ? '#059669' : '#d97706',
              weight: isRigZone ? 1.8 : 2,
              fillColor: isRigZone ? '#10b981' : '#f59e0b',
              fillOpacity: isIsolated ? 0.28 : 0.14,
              dashArray: '4, 4',
              radius: radiusM,
              pane: 'navWarnVectorPane',
            }).addTo(vectorGroup);

            circleLayer.bindTooltip(plot.label || `Safety Clearance (${radiusNm} NM)`);

            circleLayer.on('click', () => {
              onSelectWarning(w);
              setIsSheetExpanded(true);
            });

            const crosshairIcon = L.divIcon({
              className: 'nw-crosshair-wrap',
              html: `<div class="w-2.5 h-2.5 rounded-full ${isRigZone ? 'bg-emerald-600' : 'bg-amber-500'} border border-white shadow-xs"></div>`,
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            });
            const centerMarker = L.marker(center, { icon: crosshairIcon, pane: 'navWarnVectorPane' }).addTo(vectorGroup);
            centerMarker.bindTooltip(plot.label || w.title || 'Rig Position');
            centerMarker.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              onSelectWarning(w);
              setIsSheetExpanded(true);
            });
          } catch (err) {
            console.warn('Circle render error:', err);
          }
        }

        if (plot.plotType === 'line' && layerFilters.showLines) {
          try {
            const latLngs = plot.coordinates;
            if (latLngs.length < 2) return;
            const totalDistNm = computeDistanceNm(latLngs[0], latLngs[latLngs.length - 1]);

            L.polyline(latLngs, {
              color: '#06b6d4',
              weight: 6,
              opacity: 0.35,
              pane: 'navWarnVectorPane',
            }).addTo(vectorGroup);

            const mainLine = L.polyline(latLngs, {
              color: '#0891b2',
              weight: 2.5,
              dashArray: '5, 5',
              pane: 'navWarnVectorPane',
            }).addTo(vectorGroup);

            mainLine.on('click', () => {
              onSelectWarning(w);
              setIsSheetExpanded(true);
            });

            const pAIcon = L.divIcon({ className: 'nw-terminus-wrap', html: `<div class="route-terminus-pin">A</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
            const pBIcon = L.divIcon({ className: 'nw-terminus-wrap', html: `<div class="route-terminus-pin">B</div>`, iconSize: [20, 20], iconAnchor: [10, 10] });

            L.marker(latLngs[0], { icon: pAIcon, pane: 'navWarnVectorPane' }).addTo(vectorGroup).bindTooltip(`Origin A`);
            L.marker(latLngs[latLngs.length - 1], { icon: pBIcon, pane: 'navWarnVectorPane' }).addTo(vectorGroup).bindTooltip(`Terminus B (${totalDistNm} NM)`);
          } catch (err) {
            console.warn('Line render error:', err);
          }
        }

        if (plot.plotType === 'corridor' && layerFilters.showCorridors) {
          try {
            const latLngs = plot.coordinates;
            if (latLngs.length < 2) return;
            const width = plot.bufferNm ? plot.bufferNm * 2 : 3.0;
            const corridor = computeLineCorridor(latLngs, width);

            const swathLayer = L.polygon(corridor.boundaryPolygon, {
              color: '#f59e0b',
              weight: 1.5,
              fillColor: '#fbbf24',
              fillOpacity: 0.15,
              dashArray: '3, 4',
              pane: 'navWarnVectorPane',
            }).addTo(vectorGroup);

            swathLayer.bindTooltip(`Corridor Swath: ${width} NM`);
            swathLayer.on('click', () => {
              onSelectWarning(w);
              setIsSheetExpanded(true);
            });
          } catch (err) {
            console.warn('Corridor render error:', err);
          }
        }

        if (plot.plotType === 'drift_vector' && layerFilters.showDriftVectors) {
          try {
            const origin = plot.coordinates[0];
            const drift = parseDriftVector(origin, w.raw_text || '');
            if (drift) {
              L.polyline([drift.origin, drift.destination], {
                color: '#ea580c',
                weight: 2,
                dashArray: '4, 4',
                pane: 'navWarnVectorPane',
              }).addTo(vectorGroup);

              const arrowIcon = L.divIcon({
                className: 'drift-arrow-wrap',
                html: `<div class="drift-arrow-icon" style="transform: rotate(${drift.bearingDeg}deg);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="7 13 12 8 17 13"></polyline><line x1="12" y1="8" x2="12" y2="20"></line></svg></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              });
              L.marker(drift.destination, { icon: arrowIcon, pane: 'navWarnVectorPane' }).addTo(vectorGroup).bindTooltip(`Drift: ${drift.directionLabel}`);
            }
          } catch (err) {
            console.warn('Drift render error:', err);
          }
        }

        if (plot.plotType === 'point' && layerFilters.showPointMarkers) {
          try {
            const coord = plot.coordinates[0];
            const isLiveFiring = classification.category === 'mil_fire';
            const isRig = plot.hazardType === 'platform' || plot.hazardType === 'rig' || classification.category === 'rig';
            const categoryToUse = isRig ? 'rig' : classification.category;
            const badgeHtml = renderHazardBadgeHtml(
              categoryToUse,
              isRig ? 'active' : classification.displayStyle,
              isLiveFiring,
              isRig ? (plot.label ? plot.label.split(' ')[0] : 'RIG') : (w.sub_area || undefined)
            );

            const pointIcon = L.divIcon({
              className: 'nw-marker-wrap',
              html: `<div class="touch-tap-active">${badgeHtml}</div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            });

            const marker = L.marker(coord, { icon: pointIcon, pane: 'navWarnMarkerPane' });
            marker.bindTooltip(plot.label || w.title || 'Navigational Hazard');
            marker.on('click', () => {
              onSelectWarning(w);
              setIsSheetExpanded(true);
            });

            if (layerFilters.enableClustering) {
              clusterGroup.addLayer(marker);
            } else {
              vectorGroup.addLayer(marker);
            }
          } catch (err) {
            console.warn('Point render error:', err);
          }
        }
      });
    });
  }, [
    filteredWarnings,
    activePlotType,
    layerFilters,
    isolatedWarning,
    onSelectWarning,
  ]);

  return (
    <div className={`relative flex flex-col w-full overflow-hidden bg-gw-bg border border-gw-primary rounded-xl shadow-hard ${className}`}>
      {/* ──────────────────────────────────────────────────────────
          RESPONSIVE TOP BAR (Search, NAVAREA, Base Layers)
         ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 sm:p-4 bg-white border-b border-gw-primary z-20">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gw-accent absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Search warnings, IDs, buoys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-gw-bg border border-gw-primary rounded focus:outline-none focus:ring-1 focus:ring-gw-primary"
            />
          </div>

          <div className="navarea-select-wrapper relative">
            <select
              value={selectedNavArea}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedNavArea(val);
                handleRecenterNavArea(val);
              }}
              className="navarea-select text-xs font-mono font-bold bg-white border border-gw-primary px-3 py-1.5 rounded pr-7 cursor-pointer focus:outline-none"
            >
              <option value="ALL">ALL NAVAREAs ({warnings.length})</option>
              {NAVAREA_ZONE_LIST.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  NAVAREA {zone.id} · {zone.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gw-accent absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Right Actions: Re-center & Layers Panel Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleRecenterNavArea(selectedNavArea)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gw-bg hover:bg-white text-gw-primary text-xs font-mono font-bold uppercase rounded border border-gw-primary transition-all active:scale-95"
            title="Re-center map on selected region"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Re-center</span>
          </button>

          <button
            type="button"
            onClick={() => setIsLayersPanelOpen(!isLayersPanelOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase rounded border border-gw-primary transition-all ${
              isLayersPanelOpen
                ? 'bg-gw-primary text-gw-bg'
                : 'bg-white hover:bg-gw-bg text-gw-primary'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Layers</span>
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          TOUCH-OPTIMIZED PLOT TYPE FILTER TOOLBAR
         ────────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full px-3 sm:px-4 py-2 bg-white/95 backdrop-blur-md border-b border-gw-secondary/70">
        <div className="flex items-center gap-1.5 overflow-x-auto touch-momentum-scroll no-scrollbar py-0.5">
          <span className="text-[10px] font-mono font-bold text-gw-accent uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>Plots:</span>
          </span>

          {[
            { id: 'all', label: 'All Plots', icon: '✦', count: plotTypeCounts.all },
            { id: 'polygon', label: 'Polygons', icon: '⬡', count: plotTypeCounts.polygon },
            { id: 'circle', label: 'Circles', icon: '◯', count: plotTypeCounts.circle },
            { id: 'line', label: 'Lines', icon: '〰', count: plotTypeCounts.line },
            { id: 'corridor', label: 'Corridors', icon: '▱', count: plotTypeCounts.corridor },
            { id: 'drift', label: 'Drift', icon: '➔', count: plotTypeCounts.drift },
            { id: 'rig', label: 'Rigs / MODUs', icon: '⛽', count: plotTypeCounts.rig },
            { id: 'point', label: 'Points', icon: '⚲', count: plotTypeCounts.point },
          ].map((pill) => {
            const isActive = activePlotType === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setActivePlotType(pill.id as SpatialPlotType)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold rounded shrink-0 transition-all select-none ${
                  isActive
                    ? 'bg-gw-primary text-gw-bg shadow-xs'
                    : 'bg-gw-bg/80 text-gw-primary hover:bg-gw-secondary/50 border border-gw-secondary/60'
                }`}
              >
                <span>{pill.icon}</span>
                <span>{pill.label}</span>
                <span
                  className={`text-[10px] px-1 rounded font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gw-secondary text-gw-primary'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          MAIN LEAFLET MAP VIEWPORT
         ────────────────────────────────────────────────────────── */}
      <div className="relative w-full h-[460px] sm:h-[580px] lg:h-[680px] bg-slate-900">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* ──────────────────────────────────────────────────────────
            GRANULAR LAYERS & PLOTS CONTROL PANEL
           ────────────────────────────────────────────────────────── */}
        {isLayersPanelOpen && (
          <div className="absolute top-3 right-3 z-[650] w-64 max-h-[70vh] overflow-y-auto bg-white border-2 border-gw-primary rounded-lg shadow-2xl p-3 text-xs font-mono space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-gw-secondary">
              <span className="font-bold text-gw-primary uppercase flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                <span>Map Controls</span>
              </span>
              <button
                type="button"
                onClick={() => setIsLayersPanelOpen(false)}
                className="text-gw-accent hover:text-gw-primary p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Base Layer Chooser */}
            <div>
              <span className="text-[10px] font-bold text-gw-accent uppercase block mb-1">
                Base Cartography
              </span>
              <div className="space-y-1">
                {BASE_LAYERS.map((base) => (
                  <label
                    key={base.id}
                    className="flex items-center gap-2 text-[11px] p-1 rounded hover:bg-gw-bg cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="baseMapChoice"
                      value={base.id}
                      checked={activeBaseMapId === base.id}
                      onChange={() => setActiveBaseMapId(base.id)}
                      className="accent-gw-primary"
                    />
                    <span>{base.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Geometry Display Toggles */}
            <div className="pt-2 border-t border-gw-secondary space-y-1">
              <span className="text-[10px] font-bold text-gw-accent uppercase block mb-1">
                Geometry Layers
              </span>
              {[
                { key: 'showPolygons', label: '⬡ Polygons & Boundaries' },
                { key: 'showVertexPins', label: '• Corner Vertex Pins' },
                { key: 'showCentroidBadges', label: '🏷 Area Metric Badges' },
                { key: 'showCircles', label: '◯ Radial Clearance Zones' },
                { key: 'showLines', label: '〰 Subsea Cable Tracks' },
                { key: 'showCorridors', label: '▱ Wide Berth Swaths' },
                { key: 'showDriftVectors', label: '➔ Drift Bearing Lines' },
                { key: 'showPointMarkers', label: '⚲ Nautical Glyph Markers' },
                { key: 'enableClustering', label: '☷ Marker Clustering' },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center justify-between text-[11px] p-1 rounded hover:bg-gw-bg cursor-pointer"
                >
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={(layerFilters as any)[key]}
                    onChange={(e) =>
                      setLayerFilters((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                    className="accent-gw-primary rounded"
                  />
                </label>
              ))}
            </div>

            {/* Nautical Overlays */}
            <div className="pt-2 border-t border-gw-secondary space-y-1">
              <span className="text-[10px] font-bold text-gw-accent uppercase block mb-1">
                Nautical Overlays
              </span>
              <label className="flex items-center justify-between text-[11px] p-1 rounded hover:bg-gw-bg cursor-pointer">
                <span>OpenSeaMap Seamarks</span>
                <input
                  type="checkbox"
                  checked={layerFilters.showSeamarks}
                  onChange={(e) =>
                    setLayerFilters((prev) => ({
                      ...prev,
                      showSeamarks: e.target.checked,
                    }))
                  }
                  className="accent-gw-primary rounded"
                />
              </label>
              <label className="flex items-center justify-between text-[11px] p-1 rounded hover:bg-gw-bg cursor-pointer">
                <span>Ocean Soundings (Esri)</span>
                <input
                  type="checkbox"
                  checked={layerFilters.showSoundings}
                  onChange={(e) =>
                    setLayerFilters((prev) => ({
                      ...prev,
                      showSoundings: e.target.checked,
                    }))
                  }
                  className="accent-gw-primary rounded"
                />
              </label>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────
            COLLAPSIBLE MARITIME SYMBOLOGY LEGEND
           ────────────────────────────────────────────────────────── */}
        <div className="absolute bottom-16 sm:bottom-4 left-3 z-[540]">
          <div className="bg-white/95 backdrop-blur-md border border-gw-primary rounded shadow-md text-xs font-mono overflow-hidden">
            <button
              type="button"
              onClick={() => setIsLegendOpen(!isLegendOpen)}
              className="flex items-center justify-between gap-3 px-3 py-1.5 font-bold uppercase text-[11px] text-gw-primary hover:bg-gw-bg transition-colors w-full"
            >
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-gw-accent" />
                <span>Symbology Legend</span>
              </span>
              {isLegendOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>

            {isLegendOpen && (
              <div className="p-3 border-t border-gw-secondary space-y-2 max-w-[260px] animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-2 rounded-xs border border-blue-600 bg-blue-500/30"></span>
                  <span className="text-[11px] text-gw-primary">Polygon Hazard Area</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600 flex items-center justify-center text-[7px] font-bold">1</div>
                  <span className="text-[11px] text-gw-primary">Numbered Boundary Vertex</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border border-amber-600 bg-amber-400/20"></span>
                  <span className="text-[11px] text-gw-primary">Safety Clearance Circle</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-cyan-500"></span>
                  <span className="text-[11px] text-gw-primary">Subsea Cable / Pipeline</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-2 border border-dashed border-amber-500 bg-amber-200/20"></span>
                  <span className="text-[11px] text-gw-primary">Wide Berth Towing Swath</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-orange-600 font-bold">➔</span>
                  <span className="text-[11px] text-gw-primary">Drifting Hazard Vector</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">⛽</span>
                  <span className="text-[11px] text-gw-primary">Offshore Rig / MODU Platform</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────
            MOBILE & DESKTOP ACTIVE WARNINGS DRAWER / BOTTOM SHEET
           ────────────────────────────────────────────────────────── */}
        <div
          className={`absolute z-[550] transition-all duration-300 ease-in-out bg-white border border-gw-primary rounded-t-xl sm:rounded-xl shadow-2xl ${
            // Mobile Docking: Bottom Sheet
            'sm:top-4 sm:right-4 sm:bottom-auto sm:left-auto sm:w-80 ' +
            (isSheetExpanded
              ? 'bottom-0 left-0 right-0 h-[50vh] sm:h-auto sm:max-h-[80vh]'
              : 'bottom-0 left-0 right-0 h-11 sm:h-auto sm:max-h-[80vh]')
          }`}
        >
          {/* Mobile Drag Handle */}
          <div
            className="sm:hidden block w-full pt-1 pb-0 cursor-pointer"
            onClick={() => setIsSheetExpanded(!isSheetExpanded)}
          >
            <div className="bottom-sheet-drag-handle"></div>
          </div>

          {/* Drawer Header */}
          <div
            className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-gw-secondary cursor-pointer sm:cursor-default"
            onClick={() => setIsSheetExpanded(!isSheetExpanded)}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-bold text-xs text-gw-primary uppercase tracking-wider font-mono">
                In-Force Warnings ({filteredWarnings.length})
              </span>
            </div>

            <button
              type="button"
              className="text-gw-accent hover:text-gw-primary sm:hidden"
              aria-label="Toggle Bottom Sheet"
            >
              {isSheetExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Scrollable List Body */}
          <div
            className={`overflow-y-auto divide-y divide-gw-secondary/60 ${
              isSheetExpanded ? 'block max-h-[calc(50vh-48px)] sm:max-h-[70vh]' : 'hidden sm:block sm:max-h-[70vh]'
            }`}
          >
            {filteredWarnings.length === 0 ? (
              <div className="p-4 text-center text-xs text-gw-accent font-mono">
                No active warnings match filter.
              </div>
            ) : (
              filteredWarnings.map((w) => {
                const isSelected = isolatedWarning?.warning_id === w.warning_id;
                const warningCode =
                  w.source_warning_id ||
                  (w.warning_number
                    ? `NAVAREA ${w.navarea} ${w.warning_number}/${w.warning_year || '26'}`
                    : w.warning_id);

                return (
                  <div
                    key={w.warning_id}
                    id={`warning-item-${w.warning_id}`}
                    onClick={() => onSelectWarning(w)}
                    className={`p-2.5 sm:p-3 cursor-pointer text-xs font-mono transition-colors ${
                      isSelected
                        ? 'bg-gw-primary text-gw-bg'
                        : 'hover:bg-gw-bg text-gw-primary'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold">{warningCode}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded uppercase ${
                          w.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {w.status}
                      </span>
                    </div>

                    <p className={`line-clamp-2 text-[11px] leading-tight mb-1.5 ${isSelected ? 'text-gw-secondary' : 'text-gw-accent'}`}>
                      {w.title || getWarningBulletinText(w)}
                    </p>

                    <div className="flex items-center justify-between text-[10px] opacity-75">
                      <span>NAVAREA {w.navarea}</span>
                      <span>{getWarningDate(w)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

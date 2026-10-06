import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { NavWarning, NavAreaId } from '../types';
import {
  Search,
  MapPin,
  Maximize2,
  List,
  X,
  Copy,
  Check,
  Eye,
  EyeOff,
  Navigation,
  Crosshair,
  ExternalLink,
  CornerDownRight,
  AlertCircle,
  Layers,
  Sliders,
  Globe,
  Waves,
} from 'lucide-react';
import { getLeafletLatLng } from '../utils/coordinateParser';
import { useMapNavigation } from '../hooks/useMapNavigation';
import { formatDecimalCoordinates, type CoordinateParseError } from '../utils/coordinateConversion';
import { NAVAREA_ZONE_LIST, NAVAREA_ZONES_BY_ID } from '../utils/navareaZones';
import { MAP_PANES, BASE_LAYERS, OVERLAY_LAYERS } from '../config/mapLayers';
import { useMapLayers, WarningSeverityLevel } from '../hooks/useMapLayers';

export type ScopeFilterType = 'all' | 'navarea' | 'coastal';

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

interface LeafletMapProps {
  warnings: NavWarning[];
  selectedNavArea?: NavAreaId | 'ALL';
  onSelectWarning: (warning: NavWarning) => void;
  isolatedWarning?: NavWarning | null;
  onClearIsolation?: () => void;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  warnings,
  selectedNavArea: initialNavArea = 'ALL',
  onSelectWarning,
  isolatedWarning,
  onClearIsolation,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState<L.Map | null>(null);

  // Layer references
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const esriLabelsLayerRef = useRef<L.TileLayer | null>(null);
  const seamarksLayerRef = useRef<L.TileLayer | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const unclusteredGroupRef = useRef<L.LayerGroup | null>(null);
  const vectorLayersGroupRef = useRef<L.LayerGroup | null>(null);
  const jumpBeaconRef = useRef<L.Marker | null>(null);

  // Layer configuration and dynamic styling state
  const {
    activeBaseLayerId,
    activeBaseLayerConfig,
    enabledOverlays,
    setBaseLayer,
    toggleOverlay,
    isOverlayEnabled,
    isDarkBasemap,
    getVectorStyle,
    getCircleStyle,
  } = useMapLayers('esri-ocean', ['esri-labels', 'openseamap']);

  // Vector & Marker Toggles
  const [showPolygons, setShowPolygons] = useState<boolean>(true);
  const [enableClusters, setEnableClusters] = useState<boolean>(true);

  // Sidebar & Filter States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilterType>('all');
  const [currentNavArea, setCurrentNavArea] = useState<string>(initialNavArea);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick-Jump Navigation State
  const [jumpInput, setJumpInput] = useState('');
  const [jumpError, setJumpError] = useState<string | null>(null);
  const [jumpFeedback, setJumpFeedback] = useState<{
    lat: number;
    lng: number;
    nautical: string;
    format: 'DMM' | 'DD';
  } | null>(null);
  const [isQuickJumpExpanded, setIsQuickJumpExpanded] = useState<boolean>(true);

  // Real-time navigation and coordinate tracking hook
  const {
    cursorState,
    copyCursorPosition,
    parseAndJump,
    contextMenu,
    handleLayerContextMenu,
    closeContextMenu,
    copyLayerLocation,
    contextMenuCopySuccess,
    hiddenWarningIds,
    toggleWarningVisibility,
    unhideAllWarnings,
  } = useMapNavigation(mapReady);

  // Center and fit bounds on a warning geometry
  const centerOnWarningArea = useCallback((warning: NavWarning) => {
    if (!leafletInstance.current) return;
    const map = leafletInstance.current;

    const points: [number, number][] = [];
    if (warning.spatial?.geometries) {
      warning.spatial.geometries.forEach((geom) => {
        if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
          const ring = Array.isArray(geom.coordinates[0]) ? geom.coordinates[0] : geom.coordinates;
          (ring as any[]).forEach((pt) => {
            if (Array.isArray(pt) && pt.length >= 2) {
              points.push([pt[1], pt[0]]);
            }
          });
        } else if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
          const pt = geom.coordinates as number[];
          if (pt.length >= 2) {
            points.push([Number(pt[1]), Number(pt[0])]);
          }
        }
      });
    }

    if (warning.spatial?.circles) {
      warning.spatial.circles.forEach((c) => {
        points.push([c.center[1], c.center[0]]);
      });
    }

    if (
      points.length === 0 &&
      warning.latitude !== null &&
      warning.longitude !== null &&
      (warning.latitude !== 0 || warning.longitude !== 0)
    ) {
      points.push([warning.latitude, warning.longitude]);
    }

    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10, animate: true });
        return;
      }
    }

    if (points.length === 1) {
      map.flyTo(points[0], 9, { duration: 1.2 });
    }
  }, []);

  // Initialize Map and create custom strict ordering panes
  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletInstance.current) {
      const map = L.map(mapRef.current, {
        center: [20, 10],
        zoom: 2,
        zoomControl: false,
        attributionControl: true,
        worldCopyJump: true,
        minZoom: 2,
        maxZoom: 19,
      });

      // Strict Leaflet Pane Architecture
      Object.values(MAP_PANES).forEach((paneDef) => {
        if (!map.getPane(paneDef.name)) {
          const p = map.createPane(paneDef.name);
          p.style.zIndex = paneDef.zIndex.toString();
          if (paneDef.pointerEvents) {
            p.style.pointerEvents = paneDef.pointerEvents;
          }
        }
      });

      // Cluster Group bound strictly to navWarnMarkerPane (z-index 600)
      clusterGroupRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        clusterPane: 'navWarnMarkerPane',
      }).addTo(map);

      unclusteredGroupRef.current = L.layerGroup().addTo(map);
      vectorLayersGroupRef.current = L.layerGroup().addTo(map);

      leafletInstance.current = map;
      setMapReady(map);
    }

    return () => {
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
        setMapReady(null);
      }
    };
  }, []);

  // Base Layer Synchronization (basePane: z-index 200)
  useEffect(() => {
    if (!leafletInstance.current) return;
    const map = leafletInstance.current;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }

    const cfg = activeBaseLayerConfig;
    const layer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      maxNativeZoom: cfg.maxNativeZoom,
      subdomains: cfg.subdomains || 'abc',
      pane: cfg.pane, // 'basePane'
    }).addTo(map);

    baseTileLayerRef.current = layer;
  }, [activeBaseLayerConfig, mapReady]);

  // Overlay Layers Synchronization with OpenSeaMap Tile Error Handling
  useEffect(() => {
    if (!leafletInstance.current) return;
    const map = leafletInstance.current;

    // 1. ESRI Ocean Labels & Soundings (soundingsPane: z-index 250)
    const esriLabelsConfig = OVERLAY_LAYERS.find((l) => l.id === 'esri-labels')!;
    if (isOverlayEnabled('esri-labels')) {
      if (!esriLabelsLayerRef.current) {
        esriLabelsLayerRef.current = L.tileLayer(esriLabelsConfig.url, {
          attribution: esriLabelsConfig.attribution,
          maxZoom: esriLabelsConfig.maxZoom,
          maxNativeZoom: esriLabelsConfig.maxNativeZoom,
          pane: esriLabelsConfig.pane,
          opacity: 0.95,
        }).addTo(map);
      }
    } else {
      if (esriLabelsLayerRef.current) {
        map.removeLayer(esriLabelsLayerRef.current);
        esriLabelsLayerRef.current = null;
      }
    }

    // 2. OpenSeaMap Seamarks (seamarksPane: z-index 300) with tile error handling
    const osmSeamarksConfig = OVERLAY_LAYERS.find((l) => l.id === 'openseamap')!;
    if (isOverlayEnabled('openseamap')) {
      if (!seamarksLayerRef.current) {
        const seamarkLayer = L.tileLayer(osmSeamarksConfig.url, {
          attribution: osmSeamarksConfig.attribution,
          maxZoom: osmSeamarksConfig.maxZoom,
          pane: osmSeamarksConfig.pane,
          opacity: 1.0,
        });

        // Handle OpenSeaMap tile loading errors without breaking map
        seamarkLayer.on('tileerror', (e: L.TileErrorEvent) => {
          console.warn(`[OpenSeaMap] Tile load error at z=${e.coords.z}, x=${e.coords.x}, y=${e.coords.y}`);
        });

        seamarkLayer.addTo(map);
        seamarksLayerRef.current = seamarkLayer;
      }
    } else {
      if (seamarksLayerRef.current) {
        map.removeLayer(seamarksLayerRef.current);
        seamarksLayerRef.current = null;
      }
    }
  }, [enabledOverlays, isOverlayEnabled, mapReady]);

  // Handle Isolation Mode Camera auto-focus
  useEffect(() => {
    if (isolatedWarning && mapReady) {
      centerOnWarningArea(isolatedWarning);
    }
  }, [isolatedWarning, mapReady, centerOnWarningArea]);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!mapReady) return;

    const handleMapClick = () => closeContextMenu();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };

    mapReady.on('click', handleMapClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      mapReady.off('click', handleMapClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mapReady, closeContextMenu]);

  // Filter warnings
  const filteredWarnings = warnings.filter((w) => {
    if (isolatedWarning) {
      return w.warning_id === isolatedWarning.warning_id;
    }

    if (scopeFilter === 'coastal' && !isCoastalWarning(w)) return false;
    if (scopeFilter === 'navarea' && isCoastalWarning(w)) return false;

    if (currentNavArea !== 'ALL' && w.navarea !== currentNavArea) return false;

    if (filterSeverity === 'critical' && w.extraction_confidence < 1) return false;
    if (filterSeverity === 'high' && (w.extraction_confidence >= 1 || w.extraction_confidence < 0.8)) return false;
    if (filterSeverity === 'moderate' && (w.extraction_confidence >= 0.8 || w.extraction_confidence < 0.5)) return false;
    if (filterSeverity === 'low' && w.extraction_confidence >= 0.5) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        w.source_warning_id.toLowerCase().includes(q) ||
        w.area_text?.toLowerCase().includes(q) ||
        w.raw_text?.toLowerCase().includes(q) ||
        `navarea ${w.navarea}`.toLowerCase().includes(q)
      );
    }

    return true;
  });

  const renderedWarnings = filteredWarnings.filter(
    (w) => w.status === 'active' && !hiddenWarningIds.has(w.warning_id)
  );

  const autoFrameMap = useCallback((activeList: NavWarning[]) => {
    if (!leafletInstance.current) return;

    const validCoords: L.LatLngExpression[] = activeList
      .map((w) => getLeafletLatLng(w.spatial, w.latitude, w.longitude))
      .filter(([lat, lng]) => lat !== 0 || lng !== 0);

    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      if (bounds.isValid()) {
        leafletInstance.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 6,
          animate: true,
        });
      }
    }
  }, []);

  const handleSelectNavArea = (navAreaId: string) => {
    setCurrentNavArea(navAreaId);
    if (!leafletInstance.current) return;

    if (navAreaId === 'ALL') {
      leafletInstance.current.flyTo([20, 10], 2, { duration: 1.5 });
    } else {
      const zone = NAVAREA_ZONES_BY_ID[navAreaId];
      if (zone) {
        leafletInstance.current.flyTo(zone.center, zone.zoom, { duration: 1.4 });
      }
    }
  };

  // Render markers and vector geometries into respective panes
  useEffect(() => {
    if (!leafletInstance.current) return;

    const clusterGroup = clusterGroupRef.current;
    const unclusteredGroup = unclusteredGroupRef.current;
    const vectorGroup = vectorLayersGroupRef.current;

    if (clusterGroup) clusterGroup.clearLayers();
    if (unclusteredGroup) unclusteredGroup.clearLayers();
    if (vectorGroup) vectorGroup.clearLayers();

    const activeMarkerLayer = enableClusters ? clusterGroup : unclusteredGroup;

    renderedWarnings.forEach((w) => {
      const coords = getLeafletLatLng(w.spatial, w.latitude, w.longitude);
      const isIsolated = isolatedWarning?.warning_id === w.warning_id;
      const severity: WarningSeverityLevel =
        w.extraction_confidence === 1
          ? 'critical'
          : w.extraction_confidence >= 0.8
          ? 'high'
          : 'moderate';

      // Marker element with high-contrast palette
      const icon = L.divIcon({
        className: 'nw-marker-wrap',
        html: `<div class="nw-marker ${
          w.extraction_confidence === 1
            ? 'sev-critical'
            : isDarkBasemap
            ? 'sev-high-dark'
            : 'sev-high'
        }"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      if (activeMarkerLayer) {
        // Marker rendered in navWarnMarkerPane (z-index 600)
        const m = L.marker(coords, {
          icon,
          pane: 'navWarnMarkerPane',
        }).addTo(activeMarkerLayer);

        m.on('click', () => onSelectWarning(w));
        m.on('contextmenu', (e: L.LeafletMouseEvent) => handleLayerContextMenu(e, w, coords));
      }

      // Geometries rendered in navWarnVectorPane (z-index 400)
      if (showPolygons && vectorGroup) {
        const polyStyle = getVectorStyle(severity, isIsolated);

        if (w.spatial?.geometries) {
          w.spatial.geometries.forEach((geom) => {
            if (geom.type === 'Polygon' && Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
              try {
                const ringCoords = geom.coordinates[0];
                const latLngs: L.LatLngExpression[] = Array.isArray(ringCoords)
                  ? (ringCoords as any[]).map((pt) => [pt[1], pt[0]])
                  : (geom.coordinates as any[]).map((pt) => [pt[1], pt[0]]);

                const poly = L.polygon(latLngs, {
                  ...polyStyle,
                  pane: 'navWarnVectorPane',
                }).addTo(vectorGroup);

                poly.on('click', () => onSelectWarning(w));
                poly.on('contextmenu', (e: L.LeafletMouseEvent) => {
                  handleLayerContextMenu(e, w, [e.latlng.lat, e.latlng.lng]);
                });
              } catch {
                // Malformed geometry fallback
              }
            }
          });
        }

        // Circular hazard buffers
        if (w.spatial?.circles) {
          const circleStyle = getCircleStyle(isIsolated);
          w.spatial.circles.forEach((circ) => {
            if (circ.center && Array.isArray(circ.center) && circ.radius_nm) {
              try {
                const center: [number, number] = [circ.center[1], circ.center[0]];
                const radiusM = circ.radius_nm * 1852;
                const circleLayer = L.circle(center, {
                  ...circleStyle,
                  pane: 'navWarnVectorPane',
                  radius: radiusM,
                }).addTo(vectorGroup);

                circleLayer.on('click', () => onSelectWarning(w));
                circleLayer.on('contextmenu', (e: L.LeafletMouseEvent) => handleLayerContextMenu(e, w, center));
              } catch {
                // Malformed circle fallback
              }
            }
          });
        }
      }
    });
  }, [
    renderedWarnings,
    enableClusters,
    showPolygons,
    isDarkBasemap,
    getVectorStyle,
    getCircleStyle,
    handleLayerContextMenu,
    onSelectWarning,
    isolatedWarning,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      leafletInstance.current?.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [isSidebarOpen]);

  // Jump-to-coordinate executor
  const handleExecuteJump = (input: string) => {
    setJumpError(null);
    if (!input.trim()) {
      setJumpError('Please enter coordinates in DMM or Decimal format');
      return;
    }

    const result = parseAndJump(input);
    if (!result.success) {
      setJumpError((result as CoordinateParseError).error);
      return;
    }

    if (leafletInstance.current) {
      if (jumpBeaconRef.current) {
        leafletInstance.current.removeLayer(jumpBeaconRef.current);
        jumpBeaconRef.current = null;
      }

      const beaconIcon = L.divIcon({
        className: 'jump-beacon-wrap',
        html: `<div class="jump-beacon-pulse"><div class="beacon-center"></div></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const beacon = L.marker([result.lat, result.lng], {
        icon: beaconIcon,
        pane: 'navWarnMarkerPane',
      }).addTo(leafletInstance.current);

      jumpBeaconRef.current = beacon;

      setJumpFeedback({
        lat: result.lat,
        lng: result.lng,
        nautical: result.nauticalFormatted,
        format: result.format,
      });

      setTimeout(() => {
        if (jumpBeaconRef.current && leafletInstance.current) {
          leafletInstance.current.removeLayer(jumpBeaconRef.current);
          jumpBeaconRef.current = null;
        }
      }, 9000);
    }
  };

  return (
    <div className="relative h-[calc(100vh-140px)] min-h-[520px] border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden bg-gw-bg isolate">
      {/* Map Canvas */}
      <div
        id="map"
        ref={mapRef}
        role="region"
        aria-label="Interactive chart of live navigational warnings. Use arrow keys to pan and plus or minus to zoom."
        className="absolute inset-0 z-0"
      ></div>

      {/* ISOLATION MODE BANNER */}
      {isolatedWarning && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[460] w-[calc(100%-24px)] max-w-xl pointer-events-auto">
          <div className="bg-amber-50 border-2 border-amber-600 rounded-xl shadow-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse shrink-0" />
              <div className="truncate">
                <span className="font-bold text-amber-950 uppercase tracking-wide">
                  Isolation Mode Active:
                </span>{' '}
                <span className="font-mono font-bold text-amber-900">
                  {isolatedWarning.source_warning_id || isolatedWarning.warning_id}
                </span>{' '}
                <span className="text-amber-800 text-[11px] hidden sm:inline">
                  (NAVAREA {isolatedWarning.navarea})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onSelectWarning(isolatedWarning)}
                className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-500 rounded text-amber-950 font-bold uppercase text-[10px] transition-all"
              >
                Details
              </button>
              {onClearIsolation && (
                <button
                  type="button"
                  onClick={onClearIsolation}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold uppercase text-[10px] transition-all shadow-xs"
                >
                  Show All Warnings
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TOP-LEFT TOOLBAR: Sidebar Toggle & Search */}
      <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-[420] flex items-center gap-2 pointer-events-auto max-w-[calc(100%-24px)] sm:max-w-md">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="flex items-center gap-1.5 px-3 py-2 bg-white/95 border-2 border-gw-primary rounded-lg text-xs font-bold uppercase shadow-hard hover:bg-gw-primary hover:text-gw-bg transition-all shrink-0 min-h-[40px]"
          title={isSidebarOpen ? 'Collapse active warnings drawer' : 'Expand active warnings drawer'}
        >
          <List className="w-4 h-4" />
          <span className="hidden sm:inline">
            {isSidebarOpen ? 'Drawer' : `Warnings (${renderedWarnings.length})`}
          </span>
          <span className="sm:hidden">{renderedWarnings.length}</span>
        </button>

        <div className="flex items-center gap-2 px-3 py-2 bg-white/95 border-2 border-gw-primary rounded-lg shadow-hard flex-1 min-w-[160px]">
          <Search className="w-4 h-4 text-gw-accent shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search active notices..."
            className="bg-transparent border-none outline-none text-xs sm:text-sm w-full text-gw-primary placeholder:text-gw-accent font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-gw-accent hover:text-gw-primary font-bold px-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* TOP-RIGHT MAP CONTROLS: Coordinates, Quick-Jump & Basemap Stack */}
      <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-[440] pointer-events-auto max-w-[360px] sm:max-w-[400px] w-full sm:w-auto">
        <div className="bg-white/95 border-2 border-gw-primary rounded-xl shadow-hard overflow-hidden backdrop-blur-xs flex flex-col">
          {/* Header & Cursor Coordinate Readout */}
          <div className="p-2.5 sm:p-3 bg-gw-bg border-b border-gw-primary flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                  cursorState.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
                title={cursorState.isActive ? 'Tracking pointer' : 'Off canvas'}
              />
              <div className="font-mono text-xs font-bold text-gw-primary truncate select-all">
                {cursorState.isActive && cursorState.nauticalString ? (
                  <span>{cursorState.nauticalString}</span>
                ) : (
                  <span className="text-gw-accent font-normal italic text-[11px]">
                    Move mouse over map
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={copyCursorPosition}
                disabled={!cursorState.isActive || !cursorState.nauticalString}
                title="Copy current cursor coordinates (DMM format)"
                className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-sans font-bold transition-all ${
                  cursorState.hasCopied
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : cursorState.isActive
                    ? 'bg-white hover:bg-gw-primary hover:text-gw-bg text-gw-primary border-gw-primary'
                    : 'bg-gw-secondary text-gw-accent border-gw-tertiary cursor-not-allowed'
                }`}
              >
                {cursorState.hasCopied ? (
                  <>
                    <Check className="w-3 h-3 text-white" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsQuickJumpExpanded(!isQuickJumpExpanded)}
                className="p-1 text-gw-accent hover:text-gw-primary rounded hover:bg-gw-secondary transition-all"
                title={isQuickJumpExpanded ? 'Collapse controls' : 'Expand controls'}
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick-Jump & Basemap Layer Configuration */}
          {isQuickJumpExpanded && (
            <div className="p-3 space-y-2.5 text-xs bg-white">
              {/* Go to Coordinates */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleExecuteJump(jumpInput);
                }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                  <span className="flex items-center gap-1 text-gw-primary">
                    <Crosshair className="w-3 h-3 text-sky-600" />
                    <span>Go to Coordinates</span>
                  </span>
                  <span className="font-mono">DMM / DD</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={jumpInput}
                    onChange={(e) => {
                      setJumpInput(e.target.value);
                      setJumpError(null);
                    }}
                    placeholder="e.g. 55-23.90N 003-48.70E or 55.3983, 3.8116"
                    className="flex-1 px-2.5 py-1.5 bg-gw-bg border border-gw-primary rounded text-xs font-mono font-bold text-gw-primary placeholder:text-gw-accent outline-none focus:bg-white focus:ring-1 focus:ring-gw-primary"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-gw-primary text-gw-bg rounded font-bold uppercase text-[11px] hover:bg-gw-tertiary transition-all shadow-xs flex items-center gap-1 shrink-0"
                  >
                    <CornerDownRight className="w-3 h-3" />
                    <span>Go</span>
                  </button>
                </div>

                {jumpError && (
                  <div className="p-1.5 bg-rose-50 border border-rose-300 rounded text-rose-800 text-[10px] font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                    <span className="truncate">{jumpError}</span>
                  </div>
                )}

                {jumpFeedback && !jumpError && (
                  <div className="p-1 bg-sky-50 border border-sky-200 rounded text-sky-900 text-[10px] font-mono flex items-center justify-between">
                    <span>Focused: {jumpFeedback.nautical}</span>
                    <span className="text-[9px] uppercase font-bold text-sky-700">
                      {jumpFeedback.format}
                    </span>
                  </div>
                )}
              </form>

              {/* Basemap & Overlay Stacking Controls */}
              <div className="pt-2 border-t border-gw-secondary space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gw-primary flex items-center gap-1">
                    <Waves className="w-3 h-3 text-sky-600" />
                    <span>Base Cartography</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => autoFrameMap(renderedWarnings)}
                    className="text-[10px] font-bold uppercase text-gw-accent hover:text-gw-primary flex items-center gap-1"
                    title="Fit viewport to all active warnings"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Fit Bounds</span>
                  </button>
                </div>

                {/* Base Layer Switcher */}
                <div className="grid grid-cols-3 gap-1 bg-gw-bg p-1 rounded-lg border border-gw-secondary text-[10px] font-mono font-bold">
                  {BASE_LAYERS.map((base) => (
                    <button
                      key={base.id}
                      type="button"
                      onClick={() => setBaseLayer(base.id)}
                      className={`py-1 px-1 rounded text-center transition-all ${
                        activeBaseLayerId === base.id
                          ? 'bg-gw-primary text-gw-bg shadow-xs'
                          : 'text-gw-accent hover:text-gw-primary hover:bg-white'
                      }`}
                      title={base.name}
                    >
                      {base.id === 'esri-ocean'
                        ? 'ESRI Ocean'
                        : base.id === 'carto-voyager'
                        ? 'Voyager'
                        : 'Dark All'}
                    </button>
                  ))}
                </div>

                {/* Overlays (soundingsPane & seamarksPane) */}
                <div className="space-y-1.5 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-medium text-gw-primary hover:text-gw-tertiary">
                    <input
                      type="checkbox"
                      checked={isOverlayEnabled('esri-labels')}
                      onChange={() => toggleOverlay('esri-labels')}
                      className="rounded border-gw-primary text-gw-primary focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>ESRI Ocean Labels & Soundings</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-medium text-gw-primary hover:text-gw-tertiary">
                    <input
                      type="checkbox"
                      checked={isOverlayEnabled('openseamap')}
                      onChange={() => toggleOverlay('openseamap')}
                      className="rounded border-gw-primary text-gw-primary focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>OpenSeaMap Seamarks</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Layer Context Menu */}
      {contextMenu && contextMenu.isOpen && (
        <div
          style={{
            left: Math.min(contextMenu.pixelPosition.x, (mapRef.current?.clientWidth || 600) - 260),
            top: Math.min(contextMenu.pixelPosition.y, (mapRef.current?.clientHeight || 600) - 240),
          }}
          className="absolute z-[500] w-64 bg-white border-2 border-gw-primary rounded-xl shadow-2xl overflow-hidden text-xs pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gw-primary text-gw-bg px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] truncate">
              <Navigation className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">
                {contextMenu.targetWarning?.source_warning_id || 'Nautical Feature'}
              </span>
            </div>
            <button
              onClick={closeContextMenu}
              className="text-gw-secondary hover:text-white p-0.5 rounded transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-2.5 bg-gw-bg/60 border-b border-gw-secondary">
            <div className="text-[10px] text-gw-accent uppercase font-bold flex items-center justify-between">
              <span>Anchor Coordinates</span>
              <span className="text-[9px] font-mono bg-white px-1 py-0.5 border border-gw-secondary rounded font-bold">
                DMM
              </span>
            </div>
            <div className="font-mono text-xs font-bold text-gw-primary mt-1 tracking-tight select-all">
              {contextMenu.nauticalCoordinates}
            </div>
            <div className="font-mono text-[10px] text-gw-accent mt-0.5">
              DD: {formatDecimalCoordinates(contextMenu.latLng[0], contextMenu.latLng[1])}
            </div>
          </div>

          <div className="p-1 space-y-0.5 bg-white">
            <button
              onClick={() => copyLayerLocation(contextMenu.nauticalCoordinates)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-gw-bg text-gw-primary transition-all font-medium text-left text-[11px]"
            >
              <span className="flex items-center gap-2">
                {contextMenuCopySuccess ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-gw-accent" />
                )}
                <span>
                  {contextMenuCopySuccess ? 'Copied Nautical Coordinates!' : 'Copy Anchor Coordinates'}
                </span>
              </span>
            </button>

            {contextMenu.targetWarning && (
              <button
                onClick={() => toggleWarningVisibility(contextMenu.targetWarning!.warning_id)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-amber-50 text-amber-900 transition-all font-medium text-left text-[11px]"
              >
                <EyeOff className="w-3.5 h-3.5 text-amber-700" />
                <span>Hide From View</span>
              </button>
            )}

            {contextMenu.targetWarning && (
              <button
                onClick={() => {
                  centerOnWarningArea(contextMenu.targetWarning!);
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-gw-bg text-gw-primary transition-all font-medium text-left text-[11px]"
              >
                <Crosshair className="w-3.5 h-3.5 text-sky-600" />
                <span>Center on Area</span>
              </button>
            )}

            {contextMenu.targetWarning && (
              <button
                onClick={() => {
                  onSelectWarning(contextMenu.targetWarning!);
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-gw-bg text-gw-primary transition-all font-medium text-left text-[11px]"
              >
                <ExternalLink className="w-3.5 h-3.5 text-gw-accent" />
                <span>Open Warning Details</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* COLLAPSIBLE SIDEBAR: Active Warnings & Filter Drawer */}
      {isSidebarOpen && (
        <aside className="absolute top-[64px] sm:top-[72px] left-3 sm:left-4 bottom-3 sm:bottom-4 w-[calc(100%-24px)] sm:w-[320px] md:w-[350px] bg-white border-2 border-gw-primary rounded-xl shadow-2xl pointer-events-auto z-[410] flex flex-col overflow-hidden">
          <div className="flex justify-between items-center p-3 border-b border-gw-secondary bg-gw-bg">
            <div className="font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 text-gw-primary">
              <Layers className="w-4 h-4 text-gw-primary" />
              <span>Active Warnings</span>
              <span className="text-[10px] px-2 py-0.5 bg-gw-primary text-gw-bg rounded-full font-mono font-bold">
                {renderedWarnings.length}
              </span>
              {hiddenWarningIds.size > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded font-mono font-bold">
                  {hiddenWarningIds.size} hidden
                </span>
              )}
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded text-gw-accent hover:text-gw-primary hover:bg-gw-secondary transition-all"
              title="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filters & Pane Toggles */}
          <div className="p-3 border-b border-gw-secondary bg-gw-bg/40 space-y-3">
            {/* Scope Switcher */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent flex items-center justify-between">
                <span>Scope Switcher</span>
                <span className="font-mono text-gw-primary font-bold">
                  {scopeFilter.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-gw-primary shadow-xs">
                {(['all', 'navarea', 'coastal'] as ScopeFilterType[]).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setScopeFilter(scope)}
                    className={`py-1 text-[10px] font-bold uppercase rounded text-center transition-all ${
                      scopeFilter === scope
                        ? 'bg-gw-primary text-gw-bg shadow-xs'
                        : 'text-gw-accent hover:text-gw-primary hover:bg-gw-bg'
                    }`}
                  >
                    {scope === 'all' ? 'All' : scope === 'navarea' ? 'NAVAREA' : 'Coastal'}
                  </button>
                ))}
              </div>
            </div>

            {/* NAVAREA Selector */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent flex items-center justify-between">
                <span>NAVAREA Selector</span>
                <Globe className="w-3 h-3 text-gw-accent" />
              </div>
              <select
                value={currentNavArea}
                onChange={(e) => handleSelectNavArea(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-gw-primary rounded-lg text-xs font-mono font-bold text-gw-primary outline-none focus:ring-1 focus:ring-gw-primary shadow-xs cursor-pointer"
              >
                <option value="ALL">All Regions (Global View)</option>
                {NAVAREA_ZONE_LIST.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name} — {zone.subTitle}
                  </option>
                ))}
              </select>
            </div>

            {/* Strict Pane Layer Toggles */}
            <div className="space-y-1.5 pt-1 border-t border-gw-secondary">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gw-accent">
                Layer Visibility & Panes
              </div>
              <div className="space-y-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-medium text-gw-primary hover:text-gw-tertiary">
                  <input
                    type="checkbox"
                    checked={showPolygons}
                    onChange={(e) => setShowPolygons(e.target.checked)}
                    className="rounded border-gw-primary text-gw-primary focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Warning Polygons (navWarnVectorPane)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-medium text-gw-primary hover:text-gw-tertiary">
                  <input
                    type="checkbox"
                    checked={enableClusters}
                    onChange={(e) => setEnableClusters(e.target.checked)}
                    className="rounded border-gw-primary text-gw-primary focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Marker Clusters (navWarnMarkerPane)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-medium text-gw-primary hover:text-gw-tertiary">
                  <input
                    type="checkbox"
                    checked={isOverlayEnabled('esri-labels')}
                    onChange={() => toggleOverlay('esri-labels')}
                    className="rounded border-gw-primary text-gw-primary focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Ocean Soundings (soundingsPane)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-medium text-gw-primary hover:text-gw-tertiary">
                  <input
                    type="checkbox"
                    checked={isOverlayEnabled('openseamap')}
                    onChange={() => toggleOverlay('openseamap')}
                    className="rounded border-gw-primary text-gw-primary focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>OpenSeaMap Seamarks (seamarksPane)</span>
                </label>
              </div>
            </div>

            {hiddenWarningIds.size > 0 && (
              <button
                onClick={unhideAllWarnings}
                className="w-full py-1.5 px-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-500 rounded text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-amber-700" />
                <span>Restore {hiddenWarningIds.size} Hidden Layers</span>
              </button>
            )}
          </div>

          {/* Quick Severity Filters */}
          <div className="flex items-center gap-1 p-2 border-b border-gw-secondary bg-white overflow-x-auto no-scrollbar">
            {['all', 'critical', 'high', 'moderate'].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold border transition-all shrink-0 ${
                  filterSeverity === sev
                    ? 'bg-gw-primary text-gw-bg border-gw-primary'
                    : 'bg-gw-bg text-gw-primary border-gw-secondary hover:border-gw-primary'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Warning List Items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
            {filteredWarnings.length === 0 ? (
              <div className="text-center py-8 text-xs text-gw-accent font-mono">
                No active warnings match filter criteria.
              </div>
            ) : (
              filteredWarnings.map((w) => {
                const isHidden = hiddenWarningIds.has(w.warning_id);
                const coastal = isCoastalWarning(w);

                return (
                  <div
                    key={w.warning_id}
                    onClick={() => onSelectWarning(w)}
                    className={`p-2.5 border-2 rounded-lg cursor-pointer transition-all shadow-xs group ${
                      isHidden
                        ? 'bg-amber-50/50 border-amber-300 opacity-60'
                        : 'bg-gw-bg hover:bg-white border-gw-secondary hover:border-gw-primary'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-mono font-bold text-gw-accent group-hover:text-gw-primary">
                        {w.source_warning_id} · NA {w.navarea}
                      </span>
                      <div className="flex items-center gap-1">
                        {coastal && (
                          <span className="text-[8px] font-mono font-bold px-1 rounded bg-sky-100 text-sky-800 border border-sky-300">
                            COASTAL
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWarningVisibility(w.warning_id);
                          }}
                          className={`p-0.5 rounded transition-all ${
                            isHidden
                              ? 'text-amber-700 hover:bg-amber-200'
                              : 'text-gw-accent hover:text-gw-primary hover:bg-gw-secondary'
                          }`}
                          title={isHidden ? 'Unhide this layer' : 'Hide this layer from map'}
                        >
                          {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-gw-primary text-gw-bg">
                          {w.extraction_confidence === 1 ? 'CRIT' : 'HIGH'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gw-primary line-clamp-2 mb-1.5">
                      {w.issued_text || w.area_text}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gw-accent font-mono">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gw-primary" />
                        {w.issued_date}
                      </span>
                      <span className="text-gw-primary font-bold group-hover:underline">
                        Details →
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}
    </div>
  );
};

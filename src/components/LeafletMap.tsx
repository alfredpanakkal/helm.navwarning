import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { NavWarning, NavAreaId, SourceRegistryItem } from '../types';
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
import { useMapFocus } from '../hooks/useMapFocus';
import { formatDecimalCoordinates, type CoordinateParseError } from '../utils/coordinateConversion';
import { NAVAREA_ZONE_LIST, NAVAREA_ZONES_BY_ID } from '../utils/navareaZones';
import { MAP_PANES, BASE_LAYERS, OVERLAY_LAYERS } from '../config/mapLayers';
import { useMapLayers, WarningSeverityLevel } from '../hooks/useMapLayers';
import { useUILegacy } from '../lib/uiFlags';
import { WarningHierarchyLines } from './WarningItemV2';
import { classifyWarning } from '../parsers/warningClassifier';
import { renderHazardBadgeHtml } from '../utils/hazardIcons';
import { parseBerthAndRadius } from '../parsers/berthParser';
import {
  computeDistanceNm,
  computePolygonAreaSqNm,
  computeCentroid,
  computeLineCorridor,
  parseClearanceDirective,
  parseDriftVector,
  formatWgs84Dms,
} from '../core/coordinates';
import { SpatialPlotType } from '../types/maritime';

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
  sources?: SourceRegistryItem[];
  onSelectWarning: (warning: NavWarning) => void;
  isolatedWarning?: NavWarning | null;
  onClearIsolation?: () => void;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  warnings,
  selectedNavArea: initialNavArea = 'ALL',
  sources,
  onSelectWarning,
  isolatedWarning,
  onClearIsolation,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState<L.Map | null>(null);
  const legacyUI = useUILegacy();
  const { isFocused, setFocused, toggleFocus } = useMapFocus();

  // Layer references
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const esriLabelsLayerRef = useRef<L.TileLayer | null>(null);
  const seamarksLayerRef = useRef<L.TileLayer | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const unclusteredGroupRef = useRef<L.LayerGroup | null>(null);
  const vectorLayersGroupRef = useRef<L.LayerGroup | null>(null);
  const jumpBeaconRef = useRef<L.Marker | null>(null);
  const hoverHaloLayerRef = useRef<L.Circle | null>(null);

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
  } = useMapLayers('osm-standard', ['openseamap']);

  // Vector & Marker Toggles
  const [showPolygons, setShowPolygons] = useState<boolean>(true);
  const [enableClusters, setEnableClusters] = useState<boolean>(true);
  const [activePlotType, setActivePlotType] = useState<SpatialPlotType>('all');
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);
  const [isMobileSheetExpanded, setIsMobileSheetExpanded] = useState<boolean>(false);

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
    (w) =>
      w.status === 'active' &&
      !hiddenWarningIds.has(w.warning_id) &&
      w.data_quality !== 'AMBIGUOUS' &&
      w.data_quality !== 'INVALID' &&
      (!w.ambiguous_positions || w.ambiguous_positions.length === 0)
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
      // Skip Null Island / ungrounded warnings
      if (coords[0] === 0 && coords[1] === 0) {
        return;
      }

      const isIsolated = isolatedWarning?.warning_id === w.warning_id;
      const classification = classifyWarning(w.raw_text || w.area_text || '');
      const statedBerth = parseBerthAndRadius(w.raw_text || '');

      // Determine geometry presence
      const hasPolygons = Boolean(
        w.spatial?.geometries?.some(
          (g) => g.type === 'Polygon' && Array.isArray(g.coordinates) && g.coordinates.length > 0
        )
      );
      const hasCircles = Boolean(w.spatial?.circles && w.spatial.circles.length > 0);

      // User Decision: Hide center point when area or circle is visible
      const hideCenterPoint = showPolygons && (hasPolygons || hasCircles);

      // User Decision: Pulsating animation for active firing or live hazard zones
      const isLiveFiring =
        classification.category === 'mil_fire' ||
        /GUNNERY|FIRING\s+EXERCISE|MISSILE\s+FIRING|ROCKET\s+LAUNCH/i.test(w.raw_text || '');

      // Render Point Marker only if center point is NOT suppressed
      if (!hideCenterPoint && activeMarkerLayer) {
        const badgeHtml = renderHazardBadgeHtml(
          classification.category,
          classification.displayStyle,
          isLiveFiring,
          w.sub_area || undefined
        );

        const icon = L.divIcon({
          className: 'nw-marker-wrap',
          html: badgeHtml,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const m = L.marker(coords, {
          icon,
          pane: 'navWarnMarkerPane',
        }).addTo(activeMarkerLayer);

        m.on('click', () => onSelectWarning(w));
        m.on('contextmenu', (e: L.LeafletMouseEvent) => handleLayerContextMenu(e, w, coords));

        // User Decision: Show hazard radius buffer on hover for single point warnings
        m.on('mouseover', () => {
          if (!leafletInstance.current) return;
          if (hoverHaloLayerRef.current) {
            leafletInstance.current.removeLayer(hoverHaloLayerRef.current);
            hoverHaloLayerRef.current = null;
          }
          const radiusNm = statedBerth?.radiusNm ?? statedBerth?.clearanceNm ?? 0.5;
          const radiusMeters = radiusNm * 1852;
          const halo = L.circle(coords, {
            pane: 'navWarnHaloPane',
            radius: radiusMeters,
            color: classification.displayStyle === 'critical' ? '#dc2626' : '#ea580c',
            weight: 1.5,
            dashArray: '4, 4',
            fillColor: classification.displayStyle === 'critical' ? '#dc2626' : '#ea580c',
            fillOpacity: 0.14,
          }).addTo(leafletInstance.current);
          hoverHaloLayerRef.current = halo;
        });

        m.on('mouseout', () => {
          if (leafletInstance.current && hoverHaloLayerRef.current) {
            leafletInstance.current.removeLayer(hoverHaloLayerRef.current);
            hoverHaloLayerRef.current = null;
          }
        });
      }

      // Geometries rendered in navWarnVectorPane (z-index 400)
      if (showPolygons && vectorGroup) {
        const polyStyle = getVectorStyle(classification.severity as WarningSeverityLevel, isIsolated);

        // 1. Polygons & Polylines / Corridors
        if (w.spatial?.geometries) {
          w.spatial.geometries.forEach((geom) => {
            if (geom.type === 'Polygon' && Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
              try {
                const latLngs = (geom.coordinates[0] as number[][]).map(([lng, lat]) => [lat, lng] as [number, number]);
                const areaSqNm = computePolygonAreaSqNm(latLngs);
                const centroid = computeCentroid(latLngs);

                const poly = L.polygon(latLngs, {
                  color: '#2563eb',       // Clean marine blue border
                  weight: 2,
                  dashArray: '6, 6',     // Nautical dashed perimeter
                  opacity: 0.9,
                  fillColor: '#3b82f6',   // Semi-transparent blue fill
                  fillOpacity: 0.25,
                  pane: 'navWarnVectorPane'
                });
                poly.bindTooltip(`${w.source_warning_id || 'Warning'}${areaSqNm > 0 ? ` · ${areaSqNm} sq NM` : ''}`, {
                  direction: 'center',
                  permanent: false
                });
                poly.on('click', () => onSelectWarning(w));
                poly.on('contextmenu', (e: L.LeafletMouseEvent) => {
                  handleLayerContextMenu(e, w, [e.latlng.lat, e.latlng.lng]);
                });
                vectorGroup.addLayer(poly);

                // Centroid Metric Badge
                if (areaSqNm > 0 && centroid[0] !== 0) {
                  const metricBadge = L.marker(centroid, {
                    icon: L.divIcon({
                      className: 'polygon-metric-pill',
                      html: `<div style="background: rgba(15, 23, 42, 0.85); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 2px 7px; border-radius: 9999px; font-family: monospace; font-size: 10px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3); pointer-events: auto; cursor: pointer;">${w.source_warning_id || w.warning_id} · ${areaSqNm} sq NM</div>`,
                      iconSize: [0, 0],
                      iconAnchor: [45, 10]
                    }),
                    pane: 'navWarnVectorPane'
                  });
                  metricBadge.on('click', () => onSelectWarning(w));
                  vectorGroup.addLayer(metricBadge);
                }

                latLngs.forEach((latLng, idx) => {
                  const vertexMarker = L.circleMarker(latLng, {
                    radius: 5,
                    fillColor: '#fbbf24', // Amber/yellow accent
                    color: '#d97706',
                    weight: 1.5,
                    fillOpacity: 0.95,
                    pane: 'navWarnVectorPane'
                  });
                  const dmsLabel = formatWgs84Dms(latLng[0], latLng[1]);
                  vertexMarker.bindTooltip(`Vertex ${idx + 1}: ${dmsLabel} (${latLng[0].toFixed(3)}°, ${latLng[1].toFixed(3)}°)`, {
                    direction: 'top',
                    offset: [0, -5]
                  });
                  vertexMarker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    onSelectWarning(w);
                  });
                  vertexMarker.on('contextmenu', (e: L.LeafletMouseEvent) => {
                    handleLayerContextMenu(e, w, latLng);
                  });
                  vectorGroup.addLayer(vertexMarker);
                });
              } catch {
                // Malformed polygon fallback
              }
            } else if (
              (geom.type === 'LineString' || (geom as any).type === 'Polyline') &&
              Array.isArray(geom.coordinates) &&
              geom.coordinates.length > 0
            ) {
              // User Decision: Render linear polyline corridors for cable and tow routes
              try {
                const latLngs: [number, number][] = (geom.coordinates as any[]).map((pt) => [pt[1], pt[0]]);
                const polyline = L.polyline(latLngs, {
                  color: classification.displayStyle === 'critical' ? '#dc2626' : '#059669',
                  weight: 3,
                  dashArray: '6, 6',
                  pane: 'navWarnVectorPane',
                }).addTo(vectorGroup);

                polyline.on('click', () => onSelectWarning(w));
                polyline.on('contextmenu', (e: L.LeafletMouseEvent) => {
                  handleLayerContextMenu(e, w, [e.latlng.lat, e.latlng.lng]);
                });

                // Corridor calculation
                const directive = parseClearanceDirective(w.raw_text || w.issued_text || '');
                const corridorWidth = directive ? (directive.radiusNm * 2) : 2.0;
                const corridor = computeLineCorridor(latLngs, corridorWidth);
                if (corridor.boundaryPolygon && corridor.boundaryPolygon.length > 2) {
                  const corridorPoly = L.polygon(corridor.boundaryPolygon, {
                    color: '#0ea5e9',
                    weight: 1.5,
                    dashArray: '4, 4',
                    opacity: 0.7,
                    fillColor: '#38bdf8',
                    fillOpacity: 0.12,
                    pane: 'navWarnVectorPane'
                  });
                  corridorPoly.bindTooltip(`Corridor: ${corridor.lengthNm} NM · Berth: ±${(corridor.widthNm / 2).toFixed(1)} NM`, {
                    direction: 'center'
                  });
                  corridorPoly.on('click', () => onSelectWarning(w));
                  vectorGroup.addLayer(corridorPoly);
                }
              } catch {
                // Malformed polyline fallback
              }
            }
          });
        }

        // 2. Circular hazard exclusion buffers
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

                circleLayer.bindTooltip(`Radius: ${circ.radius_nm} NM`, {
                  direction: 'center',
                  permanent: false
                });

                const centerMarker = L.circleMarker(center, {
                  radius: 5,
                  fillColor: '#f59e0b',
                  color: '#78350f',
                  weight: 1.5,
                  fillOpacity: 0.95,
                  pane: 'navWarnVectorPane'
                });
                centerMarker.bindTooltip(`Center: ${circ.radius_nm} NM Radius`, { direction: 'top', offset: [0, -5] });
                centerMarker.on('click', (e) => {
                  L.DomEvent.stopPropagation(e);
                  onSelectWarning(w);
                });
                centerMarker.on('contextmenu', (e: L.LeafletMouseEvent) => {
                  handleLayerContextMenu(e, w, center);
                });
                vectorGroup.addLayer(centerMarker);

                circleLayer.on('click', () => onSelectWarning(w));
                circleLayer.on('contextmenu', (e: L.LeafletMouseEvent) => handleLayerContextMenu(e, w, center));
              } catch {
                // Malformed circle fallback
              }
            }
          });
        }

        // 3. Directive-derived circular clearance and drift vectors if no explicit circles exist
        if ((!w.spatial?.circles || w.spatial.circles.length === 0) && w.latitude && w.longitude) {
          const directive = parseClearanceDirective(w.raw_text || w.issued_text || '');
          if (directive) {
            try {
              const center: [number, number] = [w.latitude, w.longitude];
              const radiusM = directive.radiusNm * 1852;
              const circleLayer = L.circle(center, {
                color: '#ea580c',
                weight: 1.5,
                dashArray: '4, 4',
                fillColor: '#ea580c',
                fillOpacity: 0.15,
                pane: 'navWarnVectorPane',
                radius: radiusM,
              }).addTo(vectorGroup);

              circleLayer.bindTooltip(`${directive.rawText} (${directive.radiusNm} NM)`, { direction: 'center' });
              circleLayer.on('click', () => onSelectWarning(w));
            } catch {
              // fallback
            }
          }

          // Drift vector for unmoored/drifting hazards
          const drift = parseDriftVector([w.latitude, w.longitude], w.raw_text || w.issued_text || '');
          if (drift) {
            try {
              const driftLine = L.polyline([drift.origin, drift.destination], {
                color: '#f59e0b',
                weight: 2.5,
                dashArray: '3, 6',
                pane: 'navWarnVectorPane'
              }).addTo(vectorGroup);
              driftLine.bindTooltip(`${drift.directionLabel}${drift.speedKts ? ` @ ${drift.speedKts} kts` : ''} (~${drift.distanceNm} NM)`, {
                direction: 'center'
              });
              driftLine.on('click', () => onSelectWarning(w));
            } catch {
              // fallback
            }
          }
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

  // Robust container resize and visibility observer (handles tab switches & responsive layout)
  useEffect(() => {
    if (!mapRef.current) return;
    const observer = new ResizeObserver(() => {
      leafletInstance.current?.invalidateSize();
    });
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, [mapReady]);

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

{/* TOP-RIGHT COMPACT MAP CONTROLS */}
<div
          className={`absolute top-3 sm:top-4 right-3 sm:right-4 z-[440] pointer-events-auto ${
            isFocused ? 'hidden' : 'flex'
          } max-w-[360px] sm:max-w-[400px] w-full sm:w-auto`}
          id="map-controls"
        >
        <div
          className="bg-white/95 border-2 border-gw-primary rounded-xl shadow-hard overflow-hidden backdrop-blur-xs flex flex-col"
        >
          {/* Compact control group with 5 entries */}
          <div className="flex flex-col sm:flex-row gap-1.5 px-2 py-1.5">
            {/* Layers entry - opens secondary panel */}
            <button
              type="button"
              onClick={() => setFocused(true)}
              className="flex-1 flex items-center justify-center py-1.5 px-2 rounded border text-[9px] font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary"
              aria-label="Layer configuration"
              title="Layer configuration"
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />{' '}
              <span>Layers</span>
            </button>

            {/* Warnings entry - reset filters or focus */}
            <button
              type="button"
              onClick={() => {
                setScopeFilter('all');
                setCurrentNavArea('ALL');
                setFilterSeverity('all');
                setSearchQuery('');
              }}
              className="flex-1 flex items-center justify-center py-1.5 px-2 rounded border text-[9px] font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary"
              aria-label="Reset warnings filters"
              title="Reset warnings filters"
            >
              <span className="text-[10px]">↺</span>
              <span>Warnings</span>
            </button>

            {/* Seamarks entry - toggle overlay */}
            <button
              type="button"
              onClick={() => toggleOverlay('openseamap')}
              className="flex-1 flex items-center justify-center py-1.5 px-2 rounded border ${
                isOverlayEnabled('openseamap')
                  ? 'bg-gw-primary text-gw-bg shadow-xs'
                  : 'text-gw-accent hover:text-gw-primary hover:bg-gw-bg'
              } transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary"
              aria-label="Toggle seamarks overlay"
              title="Toggle seamarks overlay"
            >
              <span className="w-3.5 h-3.5 rounded border text-gw-primary" />
              <span>Seamarks</span>
            </button>

            {/* Reset view entry - fit bounds */}
            <button
              type="button"
              onClick={() => autoFrameMap(renderedWarnings)}
              className="flex-1 flex items-center justify-center py-1.5 px-2 rounded border text-[9px] font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary"
              aria-label="Fit viewport to warnings"
              title="Fit viewport to all active warnings"
            >
              <Maximize2 className="w-3.5 h-3.5 shrink-0" />{' '}
              <span>Reset view</span>
            </button>

            {/* Fullscreen entry */}
            <button
              type="button"
              onClick={() => {
                if (leafletInstance.current) {
                  const map = leafletInstance.current as any;
                  if (map._fullscreen) {
                    map._fullscreen.stop();
                  } else if (typeof map._fullscreen?.start === 'function') {
                    map._fullscreen.start();
                  }
                }
              }}
              className="flex-1 flex items-center justify-center py-1.5 px-2 rounded border text-[9px] font-bold uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary"
              aria-label="Fullscreen mode"
              title="Fullscreen mode"
            >
              <span className="self-stretch w-3.5 h-3.5" />{' '}
              <span>Fullscreen</span>
            </button>
          </div>

          {/* Secondary panel: advanced layer config (not always visible) */}
          {isQuickJumpExpanded && (
            <div
              className="p-3 space-y-2.5 text-xs bg-white absolute right-0 sm:right-auto top-full sm:top-full w-64 sm:w-80 border border-gw-secondary rounded-xl shadow-md bg-opacity-80"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-gw-primary mb-2">Advanced Layer Config</div>

              {/* Base Layer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gw-primary">
                    <Waves className="w-3 h-3 text-sky-600" /> Base Cartography
                  </span>
                  <button
                    type="button"
                    onClick={() => setFocused(false)}
                    className="text-[10px] text-gw-accent hover:text-gw-primary"
                  >
                    Close
                  </button>
                </div>

                {/* Base Layer Switcher */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 bg-gw-bg p-1 rounded-lg border border-gw-secondary text-[10px] font-mono font-bold">
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
                        : base.id === 'carto-dark'
                        ? 'Dark Matter'
                        : base.id === 'carto-positron'
                        ? 'Positron'
                        : 'OSM'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Overlay Toggles */}
              <div className="pt-2 border-t border-gw-secondary space-y-2">
                <div className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-medium text-gw-primary hover:text-gw-tertiary">
                  <input
                    type="checkbox"
                    checked={isOverlayEnabled('esri-labels')}
                    onChange={() => toggleOverlay('esri-labels')}
                    className="rounded border-gw-primary text-gw-primary focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Ocean Soundings</span>
                </div>

                <div className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-medium text-gw-primary hover:text-gw-tertiary">
                  <input
                    type="checkbox"
                    checked={isOverlayEnabled('openseamap')}
                    onChange={() => toggleOverlay('openseamap')}
                    className="rounded border-gw-primary text-gw-primary focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Seamarks</span>
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
            <div className="space-y-1.5 pt-1 border-t border-gw-secondary sidebar-layer-toggles">
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
                  <span>Ocean Soundings</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-medium text-gw-primary hover:text-gw-tertiary">
                  <input
                    type="checkbox"
                    checked={isOverlayEnabled('openseamap')}
                    onChange={() => toggleOverlay('openseamap')}
                    className="rounded border-gw-primary text-gw-primary focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Seamarks</span>
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
                const drawerItemClass = `p-2.5 border-2 rounded-lg cursor-pointer transition-all shadow-xs group ${
                  isHidden
                    ? 'bg-amber-50/50 border-amber-300 opacity-60'
                    : 'bg-gw-bg hover:bg-white border-gw-secondary hover:border-gw-primary'
                }`;

                if (legacyUI) {
                  return (
                    <div
                      key={w.warning_id}
                      onClick={() => onSelectWarning(w)}
                      className={drawerItemClass}
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
                }

                return (
                  <div
                    key={w.warning_id}
                    onClick={() => onSelectWarning(w)}
                    className={`p-2.5 border rounded-lg cursor-pointer transition-all shadow-xs group ${
                      isHidden
                        ? 'bg-amber-50/50 border-amber-300 opacity-60'
                        : 'bg-gw-bg hover:bg-white border-gw-secondary hover:border-gw-primary'
                    }`}
                  >
                    <WarningHierarchyLines
                      warning={w}
                      sources={sources}
                      showStatus={false}
                      line1Right={
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
                      }
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          centerOnWarningArea(w);
                        }}
                        title="View this warning on the map"
                        className="flex items-center gap-1 px-2 py-1 bg-white border border-gw-primary text-gw-primary rounded text-[10px] font-bold uppercase hover:bg-gw-primary hover:text-gw-bg transition-colors"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>View on map</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWarning(w);
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-white border border-gw-secondary text-gw-accent rounded text-[10px] font-bold uppercase hover:border-gw-primary hover:text-gw-primary transition-colors"
                      >
                        <span>Details</span>
                      </button>
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

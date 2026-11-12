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
  Minimize2,
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
  Edit3,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Info,
} from 'lucide-react';
import { getLeafletLatLng } from '../utils/coordinateParser';
import { hasRenderablePolygons, isTextDerivedGeometryOnly } from '../utils/warningHelpers';
import { useMapNavigation } from '../hooks/useMapNavigation';
import { useMapFocus } from '../hooks/useMapFocus';
import { formatDecimalCoordinates, formatPositionDisplay, type CoordinateParseError } from '../utils/coordinateConversion';
import { NAVAREA_ZONE_LIST, NAVAREA_ZONES_BY_ID } from '../utils/navareaZones';
import { MAP_PANES, BASE_LAYERS, OVERLAY_LAYERS } from '../config/mapLayers';
import { useMapLayers, WarningSeverityLevel } from '../hooks/useMapLayers';
import { WarningHierarchyLines } from './WarningItemV2';
import { classifyWarning } from '../parsers/warningClassifier';
import { extractGeometry } from '../parsers/geometryExtractor';
import { renderHazardBadgeHtml, renderPrimarySymbolSvg } from '../utils/hazardIcons';
import { toPrimarySymbol, PRIMARY_SYMBOLS, PrimarySymbol } from '../utils/symbolMapping';
import { parseBerthAndRadius } from '../parsers/berthParser';
import {
  computeDistanceNm,
  computePolygonAreaSqNm,
  computeCentroid,
  computeLineCorridor,
  computeSectorPolygon,
  parseSectorDirective,
  parseClearanceDirective,
  parseDriftVector,
  formatWgs84Dms,
} from '../core/coordinates';
import {
  getBoundaryDashArray,
  getZoomScaleCategory,
  shouldShowVertexPills,
  shouldShowVertexDots,
  shouldShowSwathPill,
  shouldHideCenterPoint,
} from '../utils/boundaryStyles';
import { SpatialPlotType } from '../types/maritime';
import { MapGeometryEditor } from './MapGeometryEditor';

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
  isAdminMode?: boolean;
  selectedWarning?: NavWarning | null;
  /** Brief pulse beacon at the edited warning after an admin save confirms (edit-repaint feedback, PR #77 follow-up). */
  recentlySaved?: { id: string; at: number } | null;
  onGeometrySaved?: () => void;
  onEditWarning?: (warning: NavWarning) => void;
  isVisible?: boolean;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  warnings,
  selectedNavArea: initialNavArea = 'ALL',
  sources,
  onSelectWarning,
  isolatedWarning,
  onClearIsolation,
  isAdminMode = false,
  selectedWarning,
  recentlySaved,
  onGeometrySaved,
  onEditWarning,
  isVisible = true,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState<L.Map | null>(null);
  const legacyUI = false; // legacy UI path retired (was: useUILegacy())
  const { isFocused, setFocused, toggleFocus } = useMapFocus();

  // Layer references
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const esriLabelsLayerRef = useRef<L.TileLayer | null>(null);
  const seamarksLayerRef = useRef<L.TileLayer | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const unclusteredGroupRef = useRef<L.LayerGroup | null>(null);
  const vectorLayersGroupRef = useRef<L.LayerGroup | null>(null);
  const jumpBeaconRef = useRef<L.Marker | null>(null);
  const savedPulseRef = useRef<L.Marker | null>(null);
  const hoverHaloLayerRef = useRef<L.Circle | null>(null);
  // WCAG 1.4.13: the currently open hover tooltip, so Escape can dismiss
  // it without moving the pointer.
  const openTooltipRef = useRef<L.Tooltip | null>(null);

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
  const [currentZoom, setCurrentZoom] = useState<number>(2);

  // Modern Navigation & Drawer States (harmonized with public map + bottom sheet)
  const [bottomSheetState, setBottomSheetState] = useState<'minimized' | 'normal' | 'maximized'>('normal');
  const [expandedWarningId, setExpandedWarningId] = useState<string | null>(null);
  const [selectedZoneLabel, setSelectedZoneLabel] = useState<string | null>(null);
  const [isLayerSettingsOpen, setIsLayerSettingsOpen] = useState<boolean>(false);
  // Phase 3 progressive disclosure: per-layer extras hidden behind "Advanced".
  const [showAdvancedLayers, setShowAdvancedLayers] = useState<boolean>(false);
  const [isCoordPickerActive, setIsCoordPickerActive] = useState<boolean>(false);
  const [isTopFiltersOpen, setIsTopFiltersOpen] = useState<boolean>(false);
  const [copiedCoordNotice, setCopiedCoordNotice] = useState<boolean>(false);

  // Filter States
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
  const [isQuickJumpExpanded, setIsQuickJumpExpanded] = useState<boolean>(false);
  // Screen Reader Live Announcement & Escape Key Dismissal
  const [srAnnouncement, setSrAnnouncement] = useState<string>('');

  const handleSelectWarningWithAnnouncement = useCallback((w: NavWarning) => {
    setSrAnnouncement(`Selected warning ${w.source_warning_id || w.warning_id}, NAVAREA ${w.navarea}, status ${w.status}. ${w.area_text || ''}`);
    onSelectWarning(w);
  }, [onSelectWarning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isQuickJumpExpanded) setIsQuickJumpExpanded(false);
        if (isLayerSettingsOpen) setIsLayerSettingsOpen(false);
        if (isLegendOpen) setIsLegendOpen(false);
        if (isTopFiltersOpen) setIsTopFiltersOpen(false);
        if (openTooltipRef.current && leafletInstance.current) {
          leafletInstance.current.closeTooltip(openTooltipRef.current);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickJumpExpanded, isLayerSettingsOpen, isLegendOpen, isTopFiltersOpen]);

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

      // Cluster Group with Dual-Ring Severity Badges (Plan Spec 2.1)
      clusterGroupRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        clusterPane: 'navWarnMarkerPane',
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          const markers = cluster.getAllChildMarkers();
          
          let ringColor = '#687169'; // Default neutral ink-tertiary
          let highestRank = 0;

          markers.forEach((m) => {
            const w = (m as any).warningData as NavWarning | undefined;
            if (w) {
              const cls = classifyWarning(w.raw_text || w.area_text || '');
              if (cls.displayStyle === 'critical' && highestRank < 3) {
                ringColor = '#B42318'; // Critical (--sev-critical)
                highestRank = 3;
              } else if (cls.displayStyle === 'high' && highestRank < 2) {
                ringColor = '#8C5208'; // High (--sev-high)
                highestRank = 2;
              } else if (cls.displayStyle === 'active' && highestRank < 1) {
                ringColor = '#2F6B4F'; // Moderate / Active (--accent)
                highestRank = 1;
              }
            }
          });

          return L.divIcon({
            html: `<div style="
              width: 36px; height: 36px; border-radius: 50%;
              background: #14161c;
              border: 3px solid ${ringColor};
              color: #ffffff;
              font-family: monospace;
              font-size: 13px; font-weight: 700;
              display: flex; align-items: center; justify-content: center;
              box-shadow: 0 4px 10px rgba(0,0,0,0.4);
            ">${count}</div>`,
            className: 'nw-dual-ring-cluster',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });
        },
      }).addTo(map);

      unclusteredGroupRef.current = L.layerGroup().addTo(map);
      vectorLayersGroupRef.current = L.layerGroup().addTo(map);

      leafletInstance.current = map;
      setMapReady(map);

      map.on('zoomend', () => {
        setCurrentZoom(map.getZoom());
      });
      setCurrentZoom(map.getZoom());

      map.on('tooltipopen', (e: L.TooltipEvent) => { openTooltipRef.current = e.tooltip; });
      map.on('tooltipclose', () => { openTooltipRef.current = null; });
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
      keepBuffer: 4,              // keep more tiles around the screen so edges don't go grey
      updateWhenZooming: false,   // wait until the zoom ends before loading new tiles
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
          keepBuffer: 4,              // keep more tiles around the screen so edges don't go grey
          updateWhenZooming: false,   // wait until the zoom ends before loading new tiles
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

  // Close context menu on outside click or Escape, & handle orientation/resize/visibility protection
  useEffect(() => {
    if (!mapReady) return;

    const handleMapClick = () => closeContextMenu();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };
    const invalidate = () => {
      if (leafletInstance.current) {
        leafletInstance.current.invalidateSize();
      }
    };

    mapReady.on('click', handleMapClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', invalidate);
    window.addEventListener('orientationchange', invalidate);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', invalidate);
    }

    // Multiple staggered invalidation ticks upon mount or visibility transition
    const t0 = requestAnimationFrame(invalidate);
    const t1 = setTimeout(invalidate, 100);
    const t2 = setTimeout(invalidate, 300);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapRef.current) {
      ro = new ResizeObserver(() => {
        invalidate();
      });
      ro.observe(mapRef.current);
    }

    return () => {
      mapReady.off('click', handleMapClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('orientationchange', invalidate);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', invalidate);
      }
      cancelAnimationFrame(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      if (ro) ro.disconnect();
    };
  }, [mapReady, isVisible, closeContextMenu]);

  // Bottom sheet drawer transition resize handler
  useEffect(() => {
    if (!mapReady) return;
    const timer = setTimeout(() => {
      if (leafletInstance.current) {
        leafletInstance.current.invalidateSize();
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [bottomSheetState, mapReady]);

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
      (!w.ambiguous_positions || w.ambiguous_positions.length === 0) &&
      // Text-derived fallback geometry (validation_status 'parsed_from_text') is
      // not a real map position — persisted backend geometry only. Such warnings
      // stay discoverable in the Data Bank instead of plotting a guessed marker.
      !isTextDerivedGeometryOnly(w)
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
      // 2026-10-26: Tier B / INFERRED warnings render dashed amber "Unverified"
      // — their geometry is provisional (AI escalation or a NAVAREA move copy).
      const isUnverified = String(w.triage_tier || 'A').toUpperCase() === 'B';

      // Determine geometry presence
      const parsedGeom = extractGeometry(w.raw_text || '');
      const dataQuality = (w.data_quality || (parsedGeom as any).dataQuality || 'EXPLICIT').toUpperCase();
      // Persisted geometry wins: browser-parsed polygons only count when the
      // warning has no persisted geometries (matching the fallback render guard
      // below), so a text parse can never suppress a persisted feature.
      const hasPolygons = hasRenderablePolygons(w, parsedGeom.geometry.polygons);
      const hasCircles = Boolean(w.spatial?.circles && w.spatial.circles.length > 0);

      // Phase 4.1 & User Decision: At global zoom (z <= 5), show centroid points with cluster groups.
      // At regional and detailed zoom (z > 5), hide center point if polygon or circle is visible.
      const hideCenterPoint = shouldHideCenterPoint(hasPolygons || hasCircles, showPolygons, currentZoom);

      // User Decision: Pulsating animation for active firing or live hazard zones
      const isLiveFiring =
        classification.category === 'mil_fire' ||
        /GUNNERY|FIRING\s+EXERCISE|MISSILE\s+FIRING|ROCKET\s+LAUNCH/i.test(w.raw_text || '');

      // Render Point Marker only if center point is NOT suppressed
      if (!hideCenterPoint && activeMarkerLayer) {
        const primarySymbol = toPrimarySymbol(classification.category);
        const badgeHtml = renderHazardBadgeHtml(
          primarySymbol,
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
        (m as any).warningData = w;

        m.on('click', () => onSelectWarning(w));
        m.on('contextmenu', (e: L.LeafletMouseEvent) => handleLayerContextMenu(e, w, coords));

        // User Decision: Show hazard radius buffer on hover for single point warnings
        m.on('mouseover', () => {
          if (!leafletInstance.current) return;
          if (hoverHaloLayerRef.current) {
            leafletInstance.current.removeLayer(hoverHaloLayerRef.current);
            hoverHaloLayerRef.current = null;
          }
          // Persisted buffer_nm wins; a text-parsed berth radius is the explicit
          // fallback. No persisted buffer and no stated radius means NO halo —
          // never fabricate a default hazard radius.
          const persistedBufferNm = w.spatial?.geometries?.find(
            (g) => g.type === 'Point' && typeof g.buffer_nm === 'number' && g.buffer_nm > 0
          )?.buffer_nm;
          const radiusNm = persistedBufferNm ?? statedBerth?.radiusNm ?? statedBerth?.clearanceNm ?? null;
          if (radiusNm != null) {
            const radiusMeters = radiusNm * 1852;
            const haloColor = classification.displayStyle === 'critical' ? '#B42318' : '#8C5208';
            const halo = L.circle(coords, {
              pane: 'navWarnHaloPane',
              radius: radiusMeters,
              color: haloColor,
              weight: 1.5,
              dashArray: '4, 4',
              fillColor: haloColor,
              fillOpacity: 0.14,
            }).addTo(leafletInstance.current);
            hoverHaloLayerRef.current = halo;
          }
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
                const zoneLabel = geom.label || (geom as any).zone_label || (geom as any).zoneLabel;
                const isZoneSelected = (zoneLabel && selectedZoneLabel === zoneLabel) || isIsolated;

                const polyColor = isUnverified ? '#8C5208' : isZoneSelected ? '#B42318' : classification.displayStyle === 'critical' ? '#B42318' : '#2F6B4F';
                const polyFill = isUnverified ? '#8C5208' : isZoneSelected ? '#B42318' : classification.displayStyle === 'critical' ? '#B42318' : '#2F6B4F';
                const borderDashArray = getBoundaryDashArray(isUnverified, dataQuality);

                const poly = L.polygon(latLngs, {
                  color: polyColor,
                  weight: isZoneSelected ? 3.5 : 2,
                  dashArray: borderDashArray,
                  opacity: currentZoom <= 5 ? 0.75 : 0.9,
                  fillColor: polyFill,
                  fillOpacity: isZoneSelected ? 0.35 : currentZoom <= 5 ? 0.12 : 0.22,
                  pane: 'navWarnVectorPane'
                });

                // Anchored Map Popup with Quick Details
                poly.bindPopup(`
                  <div style="font-family: monospace; padding: 4px; max-width: 240px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                      <span style="font-weight: 700; font-size: 13px; color: #1e293b;">${w.source_warning_id || w.warning_id}</span>
                      ${zoneLabel ? `<span style="background: #2F6B4F; color: #ffffff; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">${zoneLabel}</span>` : isUnverified ? '<span style="background: #8C5208; color: #ffffff; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">UNVERIFIED</span>' : '<span style="background: #2F6B4F; color: #ffffff; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">ACTIVE</span>'}
                    </div>
                    <div style="font-size: 11px; color: #475569; margin-bottom: 8px; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${w.title || w.area_text || w.raw_text}</div>
                    <div style="font-size: 10px; color: #0284c7; font-weight: 600;">Area: ${areaSqNm} sq NM</div>
                  </div>
                `);

                poly.bindTooltip(zoneLabel ? `${zoneLabel} (${areaSqNm} sq NM)` : isUnverified ? 'Unverified (Tier B) — needs review' : `Area: ${areaSqNm} sq NM`, { direction: 'center' });
                poly.on('click', () => {
                  if (zoneLabel) setSelectedZoneLabel(zoneLabel);
                  onSelectWarning(w);
                });
                poly.on('contextmenu', (e: L.LeafletMouseEvent) => {
                  handleLayerContextMenu(e, w, [e.latlng.lat, e.latlng.lng]);
                });
                vectorGroup.addLayer(poly);

                // Progressive disclosure: tooltips and selection state handle identification (no permanent clutter badge)

                // Plan Spec 4.1 & Phase 4.1: Hybrid Vertex Handles
                // Suppressed completely at global zoom (z <= 5) to eliminate chart clutter.
                // At regional zoom (z 6..9), only show numbered pills if warning is isolated/selected.
                // At detailed zoom (z >= 10), show numbered pills if isolated, minimal dots if unselected.
                latLngs.forEach((latLng, idx) => {
                  const dmsLabel = formatWgs84Dms(latLng[0], latLng[1]);

                  if (shouldShowVertexPills(currentZoom, isIsolated)) {
                    // Numbered Vertex Pill (V1, V2, V3...) when selected
                    const pillIcon = L.divIcon({
                      className: 'vertex-pill-marker',
                      html: `<div style="background: #14161c; color: #fbbf24; border: 1.5px solid #f59e0b; border-radius: 9999px; padding: 1px 6px; font-family: monospace; font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">V${idx + 1}</div>`,
                      iconSize: [26, 18],
                      iconAnchor: [13, 9]
                    });
                    const vertexMarker = L.marker(latLng, { icon: pillIcon, pane: 'navWarnVectorPane' });
                    vertexMarker.bindTooltip(`Vertex V${idx + 1}: ${dmsLabel} (${latLng[0].toFixed(3)}°, ${latLng[1].toFixed(3)}°)`, {
                      direction: 'top',
                      offset: [0, -8]
                    });
                    vertexMarker.on('click', (e) => {
                      L.DomEvent.stopPropagation(e);
                      onSelectWarning(w);
                    });
                    vertexMarker.on('contextmenu', (e: L.LeafletMouseEvent) => {
                      handleLayerContextMenu(e, w, latLng);
                    });
                    vectorGroup.addLayer(vertexMarker);
                  } else if (shouldShowVertexDots(currentZoom, isIsolated)) {
                    // Minimal subtle dot marker when unselected, only visible at detailed zoom (z >= 10)
                    const vertexMarker = L.circleMarker(latLng, {
                      radius: 3.5,
                      fillColor: '#fbbf24',
                      color: '#d97706',
                      weight: 1,
                      fillOpacity: 0.9,
                      pane: 'navWarnVectorPane'
                    });
                    vertexMarker.bindTooltip(`Vertex V${idx + 1}: ${dmsLabel}`, {
                      direction: 'top',
                      offset: [0, -4]
                    });
                    vertexMarker.on('click', (e) => {
                      L.DomEvent.stopPropagation(e);
                      onSelectWarning(w);
                    });
                    vertexMarker.on('contextmenu', (e: L.LeafletMouseEvent) => {
                      handleLayerContextMenu(e, w, latLng);
                    });
                    vectorGroup.addLayer(vertexMarker);
                  }
                });
              } catch {
                // Malformed polygon fallback
              }
            } else if (
              (geom.type === 'LineString' || (geom as any).type === 'Polyline') &&
              Array.isArray(geom.coordinates) &&
              geom.coordinates.length > 0
            ) {
              // Plan Spec 4.3: Double-Pass LineString & Wide-Berth Corridor Rendering
              try {
                const latLngs: [number, number][] = (geom.coordinates as any[]).map((pt) => [pt[1], pt[0]]);
                
                // Pass 1: Casing Glow Line Underneath
                const casingLine = L.polyline(latLngs, {
                  color: '#06b6d4',
                  weight: 6,
                  opacity: 0.35,
                  pane: 'navWarnVectorPane',
                }).addTo(vectorGroup);

                // Pass 2: Primary Core Track Line On Top
                const lineDashArray = getBoundaryDashArray(isUnverified, dataQuality);
                const coreLine = L.polyline(latLngs, {
                  color: isUnverified ? '#d97706' : classification.displayStyle === 'critical' ? '#dc2626' : '#0284c7',
                  weight: 3,
                  dashArray: lineDashArray,
                  pane: 'navWarnVectorPane',
                }).addTo(vectorGroup);
                if (isUnverified) coreLine.bindTooltip('Unverified (Tier B) — needs review', { direction: 'top' });

                coreLine.on('click', () => onSelectWarning(w));
                casingLine.on('click', () => onSelectWarning(w));

                // Termini Endpoint Markers (Point A / Point B) - only at regional/detailed scale (z >= 6)
                if (latLngs.length >= 2 && currentZoom >= 6) {
                  const startMarker = L.circleMarker(latLngs[0], {
                    radius: 4,
                    fillColor: '#38bdf8',
                    color: '#0284c7',
                    weight: 1.5,
                    fillOpacity: 1,
                    pane: 'navWarnVectorPane'
                  });
                  startMarker.bindTooltip('Point A (Route Start)', { direction: 'top' });
                  vectorGroup.addLayer(startMarker);

                  const endMarker = L.circleMarker(latLngs[latLngs.length - 1], {
                    radius: 4,
                    fillColor: '#38bdf8',
                    color: '#0284c7',
                    weight: 1.5,
                    fillOpacity: 1,
                    pane: 'navWarnVectorPane'
                  });
                  endMarker.bindTooltip('Point B (Route Terminus)', { direction: 'top' });
                  vectorGroup.addLayer(endMarker);
                }

                // Corridor calculation & Gold Swath Rendering. Persisted
                // corridor_half_width_nm wins; a text-parsed clearance directive is
                // the explicit fallback. No persisted half-width and no stated
                // clearance means NO swath polygon — never fabricate a default width.
                const directive = parseClearanceDirective(w.raw_text || w.issued_text || '');
                const persistedHalfWidthNm =
                  typeof geom.corridor_half_width_nm === 'number' && geom.corridor_half_width_nm > 0
                    ? geom.corridor_half_width_nm
                    : null;
                const corridorWidthNm = persistedHalfWidthNm != null
                  ? persistedHalfWidthNm * 2
                  : directive
                    ? directive.radiusNm * 2
                    : null;
                const corridor = corridorWidthNm != null ? computeLineCorridor(latLngs, corridorWidthNm) : null;

                if (corridor && corridor.boundaryPolygon && corridor.boundaryPolygon.length > 2) {
                  const corridorPoly = L.polygon(corridor.boundaryPolygon, {
                    color: '#eab308',
                    weight: 1.5,
                    dashArray: isUnverified ? '3, 5' : '5, 5',
                    opacity: currentZoom <= 5 ? 0.6 : 0.8,
                    fillColor: '#eab308',
                    fillOpacity: currentZoom <= 5 ? 0.08 : 0.16,
                    pane: 'navWarnVectorPane'
                  });
                  corridorPoly.bindTooltip(`Swath: ${corridor.widthNm} NM Corridor · Length: ${corridor.lengthNm} NM`, {
                    direction: 'center'
                  });
                  corridorPoly.on('click', () => onSelectWarning(w));
                  vectorGroup.addLayer(corridorPoly);

                  // Midpoint Metric Pill ("6 NM Swath") - shown at detailed zoom (z >= 10) or when isolated
                  if (shouldShowSwathPill(currentZoom, isIsolated)) {
                    const midIdx = Math.floor(latLngs.length / 2);
                    const midPoint = latLngs[midIdx] || latLngs[0];
                    const swathPill = L.marker(midPoint, {
                      icon: L.divIcon({
                        className: 'swath-metric-pill',
                        html: `<div style="background: #eab308; color: #14161c; border: 1px solid #ca8a04; padding: 2px 8px; border-radius: 9999px; font-family: monospace; font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.3); pointer-events: auto; cursor: pointer;">${corridor.widthNm} NM Swath</div>`,
                        iconSize: [0, 0],
                        iconAnchor: [35, 10]
                      }),
                      pane: 'navWarnVectorPane'
                    });
                    swathPill.on('click', () => onSelectWarning(w));
                    vectorGroup.addLayer(swathPill);
                  }
                }
              } catch {
                // Malformed polyline fallback
              }
            }
          });
        }

        // 1b. Fallback multi-zone parsed polygons if no explicit PostGIS geometries exist
        if ((!w.spatial?.geometries || w.spatial.geometries.length === 0) && parsedGeom.geometry.polygons && parsedGeom.geometry.polygons.length > 0) {
          parsedGeom.geometry.polygons.forEach((polyCoords, idx) => {
            try {
              const latLngs: [number, number][] = polyCoords.map((c) => [c.lat, c.lng]);
              if (latLngs.length >= 3) {
                const areaSqNm = computePolygonAreaSqNm(latLngs);
                const zoneLabel = parsedGeom.geometry.zoneLabels?.[idx] || polyCoords[0]?.label || `Zone ${idx + 1}`;
                const isZoneSelected = selectedZoneLabel === zoneLabel || isIsolated;

                const polyColor = isUnverified ? '#8C5208' : isZoneSelected ? '#B42318' : classification.displayStyle === 'critical' ? '#B42318' : '#2F6B4F';
                const polyFill = isUnverified ? '#8C5208' : isZoneSelected ? '#B42318' : classification.displayStyle === 'critical' ? '#B42318' : '#2F6B4F';
                const fallbackDashArray = getBoundaryDashArray(isUnverified, dataQuality);

                const poly = L.polygon(latLngs, {
                  color: polyColor,
                  weight: isZoneSelected ? 3.5 : 2,
                  dashArray: fallbackDashArray,
                  opacity: currentZoom <= 5 ? 0.75 : 0.9,
                  fillColor: polyFill,
                  fillOpacity: isZoneSelected ? 0.35 : currentZoom <= 5 ? 0.12 : 0.2,
                  pane: 'navWarnVectorPane',
                });

                poly.bindPopup(`
                  <div style="font-family: monospace; padding: 4px; max-width: 240px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                      <span style="font-weight: 700; font-size: 13px; color: #1e293b;">${w.source_warning_id || w.warning_id}</span>
                      <span style="background: #2F6B4F; color: #ffffff; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">${zoneLabel}</span>
                    </div>
                    <div style="font-size: 11px; color: #475569; margin-bottom: 8px; line-height: 1.3;">${w.title || w.area_text || w.raw_text}</div>
                    <div style="font-size: 10px; color: #0284c7; font-weight: 600;">Area: ${areaSqNm} sq NM</div>
                  </div>
                `);

                poly.bindTooltip(`${zoneLabel} (${areaSqNm} sq NM)`, { direction: 'center' });
                poly.on('click', () => {
                  setSelectedZoneLabel(zoneLabel);
                  onSelectWarning(w);
                });
                vectorGroup.addLayer(poly);

                // Hybrid Vertex Handles for fallback multi-zone polygons
                latLngs.forEach((latLng, vIdx) => {
                  const dmsLabel = formatWgs84Dms(latLng[0], latLng[1]);
                  if (shouldShowVertexPills(currentZoom, isIsolated)) {
                    const pillIcon = L.divIcon({
                      className: 'vertex-pill-marker',
                      html: `<div style="background: #14161c; color: #fbbf24; border: 1.5px solid #f59e0b; border-radius: 9999px; padding: 1px 6px; font-family: monospace; font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">V${vIdx + 1}</div>`,
                      iconSize: [26, 18],
                      iconAnchor: [13, 9]
                    });
                    const vMarker = L.marker(latLng, { icon: pillIcon, pane: 'navWarnVectorPane' });
                    vMarker.bindTooltip(`Vertex V${vIdx + 1}: ${dmsLabel}`, { direction: 'top', offset: [0, -8] });
                    vMarker.on('click', (e) => {
                      L.DomEvent.stopPropagation(e);
                      onSelectWarning(w);
                    });
                    vectorGroup.addLayer(vMarker);
                  } else if (shouldShowVertexDots(currentZoom, isIsolated)) {
                    const vMarker = L.circleMarker(latLng, {
                      radius: 3.5,
                      fillColor: '#fbbf24',
                      color: '#d97706',
                      weight: 1,
                      fillOpacity: 0.9,
                      pane: 'navWarnVectorPane'
                    });
                    vMarker.bindTooltip(`Vertex V${vIdx + 1}: ${dmsLabel}`, { direction: 'top', offset: [0, -4] });
                    vMarker.on('click', (e) => {
                      L.DomEvent.stopPropagation(e);
                      onSelectWarning(w);
                    });
                    vectorGroup.addLayer(vMarker);
                  }
                });
              }
            } catch {
              // fallback
            }
          });
        }

        // 2. Circular hazard exclusion buffers
        if (w.spatial?.circles) {
          const circleDashArray = getBoundaryDashArray(isUnverified, dataQuality);
          const circleStyle = {
            ...getCircleStyle(isIsolated),
            dashArray: circleDashArray,
            opacity: currentZoom <= 5 ? 0.75 : 0.9,
            fillOpacity: isIsolated ? 0.35 : currentZoom <= 5 ? 0.1 : 0.22,
            ...(isUnverified ? { color: '#8C5208', fillColor: '#8C5208' } : {}),
          };
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

                circleLayer.bindTooltip(
                  isUnverified ? `Radius: ${circ.radius_nm} NM · Unverified (Tier B)` : `Radius: ${circ.radius_nm} NM`,
                  {
                    direction: 'center',
                    permanent: false
                  }
                );

                if (currentZoom >= 6 || isIsolated) {
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
                }

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
                color: '#8C5208',
                weight: 1.5,
                dashArray: isUnverified ? '3, 5' : '8, 6',
                fillColor: '#8C5208',
                fillOpacity: currentZoom <= 5 ? 0.08 : 0.15,
                pane: 'navWarnVectorPane',
                radius: radiusM,
              }).addTo(vectorGroup);

              circleLayer.bindTooltip(`${directive.rawText} (${directive.radiusNm} NM)`, { direction: 'center' });
              circleLayer.on('click', () => onSelectWarning(w));
            } catch {
              // fallback
            }
          }

          // 4. Sector / Sweep Arc Geometry Rendering (Phase 2.1)
          const sector = parseSectorDirective(w.raw_text || w.issued_text || '');
          if (sector) {
            try {
              const center: [number, number] = [w.latitude, w.longitude];
              const radius = sector.radiusNm || 5.0;
              const sectorPoly = computeSectorPolygon(center, radius, sector.startBearing, sector.endBearing);

              if (sectorPoly.length >= 3) {
                const sectorColor = isUnverified ? '#8C5208' : classification.displayStyle === 'critical' ? '#B42318' : '#2F6B4F';
                const sectorFill = isUnverified ? '#8C5208' : classification.displayStyle === 'critical' ? '#B42318' : '#2F6B4F';
                const sectorDashArray = getBoundaryDashArray(isUnverified, dataQuality);

                const sectorLayer = L.polygon(sectorPoly, {
                  color: sectorColor,
                  weight: isIsolated ? 3 : 1.5,
                  dashArray: sectorDashArray,
                  fillColor: sectorFill,
                  fillOpacity: isIsolated ? 0.32 : currentZoom <= 5 ? 0.1 : 0.18,
                  pane: 'navWarnVectorPane',
                }).addTo(vectorGroup);

                sectorLayer.bindTooltip(
                  `Sector Arc: ${sector.startBearing}°–${sector.endBearing}° · Radius: ${radius} NM`,
                  { direction: 'center' }
                );
                sectorLayer.on('click', () => onSelectWarning(w));
              }
            } catch {
              // fallback
            }
          }

          // 5. Drift vector for unmoored/drifting hazards (Phase 2.2)
          const drift = parseDriftVector([w.latitude, w.longitude], w.raw_text || w.issued_text || '');
          if (drift) {
            try {
              const driftLine = L.polyline([drift.origin, drift.destination], {
                color: '#8C5208',
                weight: 2.5,
                dashArray: '3, 6',
                pane: 'navWarnVectorPane',
              }).addTo(vectorGroup);
              const lineTooltipText = drift.speedKts
                ? `Estimated Drift (6h projection): ${drift.directionLabel} @ ${drift.speedKts} kts (~${drift.distanceNm} NM)`
                : `Indicative Drift Vector: ${drift.directionLabel} (Speed Unknown, Indicative ~${drift.distanceNm} NM)`;
              driftLine.bindTooltip(lineTooltipText, {
                direction: 'center',
              });
              driftLine.on('click', () => onSelectWarning(w));

              // Projected destination marker (Clearly distinguished as an unverified estimate)
              const destMarker = L.circleMarker(drift.destination, {
                radius: 3.5,
                color: '#8C5208',
                fillColor: '#8C5208',
                fillOpacity: 0.7,
                dashArray: '2, 2',
                pane: 'navWarnVectorPane',
              }).addTo(vectorGroup);
              const destTooltipText = drift.speedKts
                ? `Estimated 6h Position: ${drift.directionLabel} (Unverified Projection)`
                : `Indicative Direction: ${drift.directionLabel} (Not a Verified Position)`;
              destMarker.bindTooltip(destTooltipText, { direction: 'top' });
              destMarker.on('click', () => onSelectWarning(w));
            } catch {
              // fallback
            }
          }
        }

        // 6. Relocation displacement rendering (Phase 2.2)
        if (parsedGeom.geometry.archetype === 'relocation' && parsedGeom.geometry.displacementVector) {
          try {
            const fromPoint: [number, number] = [
              parsedGeom.geometry.displacementVector.from.lat,
              parsedGeom.geometry.displacementVector.from.lng,
            ];
            const toPoint: [number, number] = [
              parsedGeom.geometry.displacementVector.to.lat,
              parsedGeom.geometry.displacementVector.to.lng,
            ];

            // Ghost marker at former coordinate
            const ghostMarker = L.circleMarker(fromPoint, {
              radius: 6,
              color: '#8C5208',
              weight: 1.5,
              dashArray: '3, 3',
              fillColor: '#8C5208',
              fillOpacity: 0.15,
              pane: 'navWarnVectorPane',
            }).addTo(vectorGroup);
            ghostMarker.bindTooltip('Former Position (Relocated)', { direction: 'top' });
            ghostMarker.on('click', () => onSelectWarning(w));

            // Directional relocation connector line
            const vectorLine = L.polyline([fromPoint, toPoint], {
              color: '#8C5208',
              weight: 2,
              dashArray: '4, 4',
              pane: 'navWarnVectorPane',
            }).addTo(vectorGroup);
            const distNm = computeDistanceNm(fromPoint, toPoint);
            vectorLine.bindTooltip(`Relocated ~${distNm} NM`, { direction: 'center' });
            vectorLine.on('click', () => onSelectWarning(w));

            // Established new position terminus marker
            const newMarker = L.circleMarker(toPoint, {
              radius: 4.5,
              color: '#2F6B4F',
              weight: 2,
              fillColor: '#2F6B4F',
              fillOpacity: 0.9,
              pane: 'navWarnVectorPane',
            }).addTo(vectorGroup);
            newMarker.bindTooltip('New Established Position', { direction: 'top' });
            newMarker.on('click', () => onSelectWarning(w));
          } catch {
            // fallback
          }
        }
      }
    });
  }, [
    renderedWarnings,
    enableClusters,
    showPolygons,
    isDarkBasemap,
    currentZoom,
    selectedZoneLabel,
    getVectorStyle,
    getCircleStyle,
    handleLayerContextMenu,
    onSelectWarning,
    isolatedWarning,
  ]);

  // Save-confirmation pulse: a 3-second beacon at the edited warning's
  // anchor the moment Supabase confirms an admin edit (reuses the quick-jump
  // beacon's CSS so no new stylesheet is needed). Non-interactive: it never
  // swallows marker clicks underneath it.
  useEffect(() => {
    const map = leafletInstance.current;
    if (!recentlySaved || !map) return;
    if (savedPulseRef.current) {
      map.removeLayer(savedPulseRef.current);
      savedPulseRef.current = null;
    }
    const w = warnings.find((x) => x.warning_id === recentlySaved.id);
    if (!w) return;
    const coords = getLeafletLatLng(w.spatial, w.latitude, w.longitude);
    if (coords[0] === 0 && coords[1] === 0) return; // Null Island / ungrounded
    const pulse = L.marker(coords, {
      icon: L.divIcon({
        className: 'saved-pulse-wrap',
        html: '<div class="jump-beacon-pulse"><div class="beacon-center"></div></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
      pane: 'navWarnMarkerPane',
      interactive: false,
    }).addTo(map);
    savedPulseRef.current = pulse;
    const timer = setTimeout(() => {
      if (savedPulseRef.current === pulse && leafletInstance.current) {
        leafletInstance.current.removeLayer(pulse);
        savedPulseRef.current = null;
      }
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentlySaved, mapReady]);

  useEffect(() => {
    const timer = setTimeout(() => {
      leafletInstance.current?.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [bottomSheetState]);

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
        nautical: formatPositionDisplay(result.lat, result.lng),
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
    <div className="relative w-full h-full min-h-[480px] flex-1 border border-gw-secondary rounded-xl sm:rounded-2xl overflow-hidden bg-gw-primary isolate shadow-xs">
      {/* Map Canvas */}
      <div
        id="map"
        ref={mapRef}
        role="region"
        aria-label="Interactive chart of live navigational warnings. Use arrow keys to pan and plus or minus to zoom."
        className="absolute inset-0 z-0 w-full h-full"
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
                className="px-2.5 py-1 bg-gw-panel hover:bg-amber-100 border border-amber-500 rounded text-amber-950 font-medium uppercase text-xs transition-all"
              >
                Details
              </button>
              {onClearIsolation && (
                <button
                  type="button"
                  onClick={onClearIsolation}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium uppercase text-xs transition-all "
                >
                  Show All Warnings
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FLOATING MAP CONTROLS CHIP (Harmonized with Public Map) */}
      <button
        type="button"
        className={`map-controls-chip ${isTopFiltersOpen ? 'is-expanded' : ''}`}
        onClick={() => setIsTopFiltersOpen(!isTopFiltersOpen)}
        aria-label="Toggle map filter controls"
        title="Toggle navigation area filter and controls"
        aria-expanded={isTopFiltersOpen}
      >
        <span className="chip-dot" />
        <span id="chipNavAreaText">
          {currentNavArea === 'ALL' ? 'Global View' : `NAVAREA ${currentNavArea}`}
        </span>
        <span className="chip-count" id="chipLiveCount">
          {renderedWarnings.length} live
        </span>
        <ChevronDown
          className={`chip-chevron w-3.5 h-3.5 transition-transform duration-200 ${
            isTopFiltersOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* TOP FILTERS POPDOWN PANEL */}
      {isTopFiltersOpen && (
        <div
          className="absolute top-[60px] left-3.5 z-[530] w-[calc(100%-28px)] max-w-xl bg-gw-panel border-2 border-gw-primary rounded-xl shadow-2xl p-3.5 pointer-events-auto space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gw-secondary pb-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gw-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-gw-primary">
                Region &amp; Scope Filters
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsTopFiltersOpen(false)}
              className="p-2 min-h-[32px] min-w-[32px] flex items-center justify-center rounded text-gw-accent hover:text-gw-primary hover:bg-gw-secondary transition-all"
              title="Close filter menu"
              aria-label="Close filter menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gw-accent mb-1">
                NAVAREA Region
              </label>
              <select
                value={currentNavArea}
                onChange={(e) => handleSelectNavArea(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gw-panel border border-gw-primary rounded-lg text-xs font-mono font-bold text-gw-primary outline-none focus:ring-1 focus:ring-gw-primary shadow-xs cursor-pointer"
              >
                <option value="ALL">All Regions (Global View)</option>
                {NAVAREA_ZONE_LIST.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name} — {zone.subTitle}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gw-accent mb-1">
                Broadcast Scope
              </label>
              <div className="grid grid-cols-3 gap-1 bg-gw-panel p-1 rounded-lg border border-gw-primary shadow-xs">
                {(['all', 'navarea', 'coastal'] as ScopeFilterType[]).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setScopeFilter(scope)}
                    className={`py-1 text-xs font-medium uppercase rounded text-center transition-all ${
 scopeFilter === scope
 ? 'bg-gw-primary text-gw-bg '
 : 'text-gw-accent hover:text-gw-primary hover:bg-gw-bg'
 }`}
                  >
                    {scope === 'all' ? 'All' : scope === 'navarea' ? 'Nav' : 'Coast'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-gw-secondary">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gw-accent mb-1">
                Confidence Level
              </label>
              <div className="grid grid-cols-4 gap-1 bg-gw-bg p-1 rounded-lg border border-gw-secondary">
                {['all', 'critical', 'high', 'moderate'].map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setFilterSeverity(sev)}
                    className={`py-1 text-xs uppercase font-medium rounded transition-all text-center ${
 filterSeverity === sev
 ? 'bg-gw-primary text-gw-bg'
 : 'text-gw-accent hover:text-gw-primary hover:bg-gw-panel'
 }`}
                  >
                    {sev === 'critical' ? 'Max' : sev === 'moderate' ? 'Med' : sev.slice(0, 4)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gw-accent mb-1">
                Notice Search
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gw-accent absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Keyword, series, or area..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs font-mono bg-gw-panel border border-gw-primary rounded-lg text-gw-primary placeholder:text-gw-accent outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear notice search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gw-accent hover:text-gw-primary"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gw-secondary text-[11px]">
            <span className="font-mono text-gw-accent">
              Showing {renderedWarnings.length} of {warnings.length} notices
            </span>
            <button
              type="button"
              onClick={() => {
                setScopeFilter('all');
                setCurrentNavArea('ALL');
                setFilterSeverity('all');
                setSearchQuery('');
              }}
              className="flex items-center gap-1 text-xs font-medium uppercase text-gw-accent hover:text-gw-primary"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>
      )}

      {/* TOP-RIGHT TOOLBAR: Re-center, Focus, Layers, Coordinate Picker (Public Harmonized) */}
      <div className="map-ctrl-topright" role="toolbar" aria-label="Map Navigation Controls">
        <button
          type="button"
          className="map-recenter-pill-btn"
          onClick={() => autoFrameMap(renderedWarnings)}
          title="Re-center / Locate all active warnings"
          aria-label="Re-center navigation area on map"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
            <circle cx="12" cy="12" r="8" />
          </svg>
          <span>Re-center</span>
        </button>

        <button
          type="button"
          className={`map-focus-btn ${isFocused ? 'active' : ''}`}
          onClick={toggleFocus}
          title={isFocused ? 'Exit Focus Mode (Esc)' : 'Maximize Map View (Focus Mode)'}
          aria-label={isFocused ? 'Exit focus mode' : 'Maximize map view full screen'}
        >
          {isFocused ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          className={`map-gear-btn ${isLayerSettingsOpen ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (isLegendOpen) setIsLegendOpen(false);
            setIsLayerSettingsOpen(!isLayerSettingsOpen);
          }}
          title="Layers & Chart Type"
          aria-label="Map layers and chart settings"
          aria-expanded={isLayerSettingsOpen}
        >
          <Sliders className="w-4 h-4" />
        </button>

        <button
          type="button"
          className={`map-coord-btn ${isLegendOpen ? 'is-active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (isLayerSettingsOpen) setIsLayerSettingsOpen(false);
            setIsLegendOpen(!isLegendOpen);
          }}
          title="Map Symbols & Severity Legend"
          aria-label="Map symbols and severity legend"
          aria-expanded={isLegendOpen}
        >
          <Info className="w-4 h-4" />
        </button>

        <button
          type="button"
          className={`map-coord-btn ${isCoordPickerActive ? 'is-active' : ''}`}
          onClick={() => setIsCoordPickerActive(!isCoordPickerActive)}
          title="Coordinate Picker — click map for exact position"
          aria-label="Toggle coordinate picker"
          aria-pressed={isCoordPickerActive}
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* DESKTOP LAYERS & CHART SETTINGS POPOVER */}
      {isLayerSettingsOpen && (
        <div
          className="map-settings-popover open"
          role="dialog"
          aria-labelledby="adminSettingsPopoverTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="settings-header">
            <span className="settings-title" id="adminSettingsPopoverTitle">
              Layers &amp; Chart Type
            </span>
            <button
              type="button"
              className="settings-close-btn"
              onClick={() => setIsLayerSettingsOpen(false)}
              aria-label="Close settings"
            >
              ✕
            </button>
          </div>
          <div className="settings-body">
            <div className="settings-section-title">Base Cartography</div>
            {BASE_LAYERS.map((base) => (
              <label key={base.id} className="settings-item">
                <input
                  type="radio"
                  name="admin-basemap"
                  value={base.id}
                  checked={activeBaseLayerId === base.id}
                  onChange={() => setBaseLayer(base.id)}
                />
                <span>{base.name}</span>
              </label>
            ))}

            <div className="settings-divider"></div>

            <div className="settings-section-title">
              <span>Maritime Overlays</span>
              <button
                type="button"
                className={`master-toggle-btn ${showPolygons && enableClusters ? '' : 'off'}`}
                onClick={() => {
                  const nextState = !(showPolygons && enableClusters);
                  setShowPolygons(nextState);
                  setEnableClusters(nextState);
                  toggleOverlay('openseamap', nextState);
                  toggleOverlay('esri-labels', nextState);
                }}
              >
                {showPolygons && enableClusters ? '[ON]' : '[OFF]'}
              </button>
            </div>

            <label className="settings-item">
              <input
                type="checkbox"
                checked={enableClusters}
                onChange={(e) => setEnableClusters(e.target.checked)}
              />
              <span>Hazard Points &amp; Clusters</span>
            </label>

            <label className="settings-item">
              <input
                type="checkbox"
                checked={showPolygons}
                onChange={(e) => setShowPolygons(e.target.checked)}
              />
              <span>Danger Areas &amp; Polygons</span>
            </label>

            {/* Advanced layers disclosure (Phase 3): OpenSeaMap seamarks and
                ESRI soundings are secondary — hidden by default so the popover
                leads with the master toggle + the two primary hazard layers. */}
            <button
              type="button"
              className="settings-disclosure-btn"
              onClick={() => setShowAdvancedLayers((v) => !v)}
              aria-expanded={showAdvancedLayers}
            >
              <span>Advanced layers</span>
              <ChevronDown
                className={'w-3.5 h-3.5 transition-transform ' + (showAdvancedLayers ? 'rotate-180' : '')}
                aria-hidden="true"
              />
            </button>
            {showAdvancedLayers && (
              <>
            <label className="settings-item">
              <input
                type="checkbox"
                checked={isOverlayEnabled('openseamap')}
                onChange={() => toggleOverlay('openseamap')}
              />
              <span>OpenSeaMap Seamarks</span>
            </label>

            <label className="settings-item">
              <input
                type="checkbox"
                checked={isOverlayEnabled('esri-labels')}
                onChange={() => toggleOverlay('esri-labels')}
              />
              <span>Ocean Soundings (ESRI)</span>
            </label>
              </>
            )}          </div>
          <div className="settings-footer">
            <button
              type="button"
              className="settings-reset-btn"
              onClick={() => {
                setBaseLayer('osm-standard');
                setShowPolygons(true);
                setEnableClusters(true);
                toggleOverlay('openseamap', true);
                toggleOverlay('esri-labels', false);
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to defaults</span>
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP MAP SYMBOL & SEVERITY LEGEND POPOVER */}
      {isLegendOpen && (
        <div
          className="map-settings-popover open"
          style={{ width: '360px', maxHeight: '80vh', overflowY: 'auto' }}
          role="dialog"
          aria-labelledby="adminLegendPopoverTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="settings-header">
            <span className="settings-title" id="adminLegendPopoverTitle">
              Map Symbols &amp; Severity
            </span>
            <button
              type="button"
              className="settings-close-btn"
              onClick={() => setIsLegendOpen(false)}
              aria-label="Close legend"
            >
              ✕
            </button>
          </div>
          <div className="settings-body space-y-3">
            {/* 6 Primary Symbols */}
            <div>
              <div className="settings-section-title mb-2">6 Primary Warning Symbols</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(Object.keys(PRIMARY_SYMBOLS) as PrimarySymbol[]).map((symKey) => {
                  const item = PRIMARY_SYMBOLS[symKey];
                  return (
                    <div
                      key={symKey}
                      className="p-1.5 rounded-lg border border-gw-secondary bg-gw-bg/40 flex items-start gap-2"
                    >
                      <div
                        className="shrink-0 w-6 h-6 rounded-full bg-[#14161c] border border-gw-secondary flex items-center justify-center text-white"
                        dangerouslySetInnerHTML={{
                          __html: renderPrimarySymbolSvg(symKey, 14, '#ffffff'),
                        }}
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-gw-primary leading-tight text-[11px] truncate">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-gw-accent leading-tight line-clamp-2 mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="settings-divider"></div>

            {/* 3 Severity States */}
            <div>
              <div className="settings-section-title mb-2">Severity Rings</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-[#B42318] bg-[#14161c] shrink-0" />
                  <div className="flex-1">
                    <span className="font-semibold text-gw-primary text-[11px]">Critical</span>
                    <span className="text-[10px] text-gw-accent block">Immediate danger (live firing, active SAR, floating mines)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-[#8C5208] bg-[#14161c] shrink-0" />
                  <div className="flex-1">
                    <span className="font-semibold text-gw-primary text-[11px]">High</span>
                    <span className="text-[10px] text-gw-accent block">Significant hazard (major AtoN unlit, adrift derelicts)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-[#2F6B4F] bg-[#14161c] shrink-0" />
                  <div className="flex-1">
                    <span className="font-semibold text-gw-primary text-[11px]">Moderate / Active</span>
                    <span className="text-[10px] text-gw-accent block">Routine operations, subsea surveys, scheduled hazards</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-divider"></div>

            {/* Boundary Conventions */}
            <div>
              <div className="settings-section-title mb-1.5">Boundary Conventions</div>
              <div className="space-y-1 text-[11px] text-gw-accent">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-0.5 bg-gw-primary inline-block" />
                  <span>Solid: Explicit verified boundary</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-0.5 border-t border-dashed border-gw-primary inline-block" />
                  <span>Dashed: Inferred or algorithmic boundary</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-0.5 border-t-2 border-dotted border-amber-600 inline-block" />
                  <span>Dotted: Tier B unverified review boundary</span>
                </div>
              </div>
            </div>

            <div className="settings-divider"></div>

            {/* Disclaimer */}
            <div className="text-[10px] text-gw-accent italic leading-relaxed">
              Severity ratings reflect algorithmic rule matching from bulletin text, not official IMO/IHO hazard gradings.
            </div>
          </div>
        </div>
      )}

      {/* COORDINATE PICKER STATUS PANEL */}
      {isCoordPickerActive && cursorState && cursorState.rawDecimal && (
        <div
          className="coord-panel open"
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            bottom: bottomSheetState === 'minimized' ? '54px' : bottomSheetState === 'normal' ? '290px' : 'calc(75vh + 10px)',
            transition: 'bottom 0.3s ease',
          }}
        >
          <span className="coord-label">Cursor</span>
          <span className="font-mono text-xs font-bold text-gw-primary">{cursorState.nauticalString}</span>
          <span className="text-[10px] text-gw-accent font-mono">
            ({formatDecimalCoordinates(cursorState.rawDecimal[0], cursorState.rawDecimal[1])})
          </span>
          <button
            type="button"
            onClick={() => {
              copyCursorPosition();
              setCopiedCoordNotice(true);
              setTimeout(() => setCopiedCoordNotice(false), 2000);
            }}
            className="p-2 min-h-[32px] min-w-[32px] flex items-center justify-center hover:bg-gw-secondary rounded text-gw-primary transition-colors ml-1"
            title="Copy coordinate"
          >
            {copiedCoordNotice ? (
              <Check className="w-3.5 h-3.5 text-gw-primary" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-gw-accent" />
            )}
          </button>
        </div>
      )}

      {/* Layer Context Menu */}
      {contextMenu && contextMenu.isOpen && (
        <div
          style={{
            left: Math.min(contextMenu.pixelPosition.x, (mapRef.current?.clientWidth || 600) - 260),
            top: Math.min(contextMenu.pixelPosition.y, (mapRef.current?.clientHeight || 600) - 240),
          }}
          className="absolute z-[500] w-64 bg-gw-panel border-2 border-gw-primary rounded-xl shadow-2xl overflow-hidden text-xs pointer-events-auto"
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
              type="button"
              onClick={closeContextMenu}
              aria-label="Close context menu"
              className="text-gw-secondary hover:text-white p-0.5 rounded transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-2.5 bg-gw-bg/60 border-b border-gw-secondary">
            <div className="text-[10px] text-gw-accent uppercase font-bold flex items-center justify-between">
              <span>Anchor Coordinates</span>
              <span className="text-[11px] font-mono bg-gw-panel px-1 py-0.5 border border-gw-secondary rounded font-bold">
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

          <div className="p-1 space-y-0.5 bg-gw-panel">
            <button
              type="button"
              onClick={() => copyLayerLocation(contextMenu.nauticalCoordinates)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-gw-bg text-gw-primary transition-all font-medium text-left text-[11px]"
            >
              <span className="flex items-center gap-2">
                {contextMenuCopySuccess ? (
                  <Check className="w-3.5 h-3.5 text-gw-primary" />
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
                type="button"
                onClick={() => toggleWarningVisibility(contextMenu.targetWarning!.warning_id)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-amber-50 text-amber-900 transition-all font-medium text-left text-[11px]"
              >
                <EyeOff className="w-3.5 h-3.5 text-amber-700" />
                <span>Hide From View</span>
              </button>
            )}

            {contextMenu.targetWarning && (
              <button
                type="button"
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
                type="button"
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

            {/* E3: Admin edit entry inside the map context menu */}
            {isAdminMode && onEditWarning && contextMenu.targetWarning && (
              <button
                type="button"
                onClick={() => {
                  onEditWarning(contextMenu.targetWarning!);
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-gw-primary/10 text-gw-primary transition-all font-medium text-left text-[11px] border-t border-gw-secondary mt-0.5 pt-2"
              >
                <Edit3 className="w-3.5 h-3.5 text-gw-primary" />
                <span>Edit Warning (Admin)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* FULL-WIDTH BOTTOM SHEET OVERLAY: Active Warnings & Admin Triage (Harmonized) */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-[500] pointer-events-auto bg-gw-panel/95 backdrop-blur-md border-t-2 border-gw-primary shadow-[0_-8px_30px_rgba(0,0,0,0.18)] transition-all duration-300 ease-in-out flex flex-col ${
          bottomSheetState === 'minimized'
            ? 'h-[46px]'
            : bottomSheetState === 'maximized'
            ? 'h-[75vh] max-h-[calc(100%-80px)]'
            : 'h-[280px] sm:h-[300px]'
        }`}
      >
        {/* Bottom Sheet Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-gw-secondary bg-gw-bg/90 select-none shrink-0 min-h-[44px]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-gw-primary">
              <Layers className="w-4 h-4 text-gw-primary shrink-0" />
              <span>Active Warnings</span>
              <span className="text-[10px] px-2 py-0.5 bg-gw-primary text-gw-bg rounded-full font-mono font-bold">
                {renderedWarnings.length}
              </span>
            </div>

            {hiddenWarningIds.size > 0 && (
              <button
                type="button"
                onClick={unhideAllWarnings}
                className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-400 rounded text-[10px] font-medium uppercase transition-all"
                title="Restore all hidden layers"
              >
                <Eye className="w-3 h-3 text-amber-700" />
                <span>{hiddenWarningIds.size} hidden</span>
              </button>
            )}

            {currentNavArea !== 'ALL' && (
              <span className="text-[10px] font-mono font-bold text-gw-accent bg-gw-panel px-1.5 py-0.5 border border-gw-secondary rounded hidden sm:inline">
                NAVAREA {currentNavArea}
              </span>
            )}
          </div>

          {/* Quick Filter Switchers in Bottom Sheet Header (when expanded) */}
          {bottomSheetState !== 'minimized' && (
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center bg-gw-panel border border-gw-secondary rounded-lg p-0.5 text-[10px] font-bold uppercase">
                {(['all', 'navarea', 'coastal'] as ScopeFilterType[]).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setScopeFilter(scope)}
                    className={`px-2 py-0.5 rounded transition-all ${
 scopeFilter === scope
 ? 'bg-gw-primary text-gw-bg '
 : 'text-gw-accent hover:text-gw-primary'
 }`}
                  >
                    {scope === 'all' ? 'All' : scope === 'navarea' ? 'NAVAREA' : 'Coastal'}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3 h-3 text-gw-accent absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter active notices..."
                  className="pl-6 pr-2 py-0.5 bg-gw-panel border border-gw-secondary rounded text-[11px] font-mono text-gw-primary placeholder:text-gw-accent outline-none w-36 lg:w-48 focus:border-gw-primary"
                />
              </div>
            </div>
          )}

          {/* Window Resize Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() =>
                setBottomSheetState(bottomSheetState === 'minimized' ? 'normal' : 'minimized')
              }
              className="p-2 min-h-[32px] min-w-[32px] flex items-center justify-center rounded text-gw-accent hover:text-gw-primary hover:bg-gw-secondary transition-all"
              title={bottomSheetState === 'minimized' ? 'Expand drawer' : 'Minimize drawer'}
              aria-label="Toggle drawer minimize"
            >
              {bottomSheetState === 'minimized' ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                setBottomSheetState(bottomSheetState === 'maximized' ? 'normal' : 'maximized')
              }
              className="p-2 min-h-[32px] min-w-[32px] hidden sm:inline-flex items-center justify-center rounded text-gw-accent hover:text-gw-primary hover:bg-gw-secondary transition-all"
              title={bottomSheetState === 'maximized' ? 'Restore drawer height' : 'Maximize drawer height'}
              aria-label="Toggle drawer maximize"
            >
              {bottomSheetState === 'maximized' ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Bottom Sheet Cards Body */}
        {bottomSheetState !== 'minimized' && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gw-bg/40">
            {filteredWarnings.length === 0 ? (
              <div className="text-center py-10 text-xs text-gw-accent font-mono">
                No active warnings match filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredWarnings.map((w) => {
                  const isHidden = hiddenWarningIds.has(w.warning_id);
                  const isExpanded = expandedWarningId === w.warning_id;
                  const coastal = isCoastalWarning(w);
                  const classification = classifyWarning(w.raw_text || w.area_text || '');
                  const sevColor =
                    classification.displayStyle === 'critical'
                      ? '#dc2626'
                      : classification.displayStyle === 'high'
                      ? '#ea580c'
                      : '#059669';

                  return (
                    <div
                      key={w.warning_id}
                      className={`bg-gw-panel border rounded-xl p-3 transition-all shadow-xs ${
                        isHidden
                          ? 'border-amber-300 bg-amber-50/40 opacity-70'
                          : isExpanded
                          ? 'border-gw-primary shadow-md ring-1 ring-gw-primary'
                          : 'border-gw-secondary hover:border-gw-primary'
                      }`}
                    >
                      {/* Card Summary Header */}
                      <div
                        className="cursor-pointer"
                        onClick={() => setExpandedWarningId(isExpanded ? null : w.warning_id)}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: sevColor }}
                            />
                            <span className="font-mono font-bold text-xs text-gw-primary truncate">
                              {w.source_warning_id || w.warning_id}
                            </span>
                            <span className="text-[10px] font-mono text-gw-accent shrink-0">
                              · NA {w.navarea}
                            </span>
                            {coastal && (
                              <span className="text-[11px] font-mono font-bold px-1 rounded bg-sky-50 text-sky-700 border border-sky-200">
                                COASTAL
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleWarningVisibility(w.warning_id);
                              }}
                              className={`p-1 rounded transition-colors ${
 isHidden
 ? 'text-amber-700 hover:bg-amber-100'
 : 'text-gw-accent hover:text-gw-primary hover:bg-gw-secondary'
 }`}
                              title={isHidden ? 'Unhide layer on map' : 'Hide layer from map'}
                              aria-label={isHidden ? 'Unhide layer on map' : 'Hide layer from map'}
                            >
                              {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-gw-accent transition-transform duration-200 ${
                                isExpanded ? 'rotate-180 text-gw-primary' : ''
                              }`}
                            />
                          </div>
                        </div>

                        <p className="text-xs font-semibold text-gw-primary line-clamp-2 leading-relaxed mb-2">
                          {w.area_text || w.title || w.issued_text || 'Navigational Notice'}
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-gw-accent font-mono pt-1 border-t border-gw-secondary">
                          <span>{w.issued_date || 'In-force'}</span>
                          <span className="text-gw-primary font-bold hover:underline">
                            {isExpanded ? 'Collapse ▲' : 'Inspect ▼'}
                          </span>
                        </div>
                      </div>

                      {/* Inline Accordion Expanded Body */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-dashed border-gw-secondary space-y-2.5">
                          {/* Metadata Badges */}
                          <div className="flex flex-wrap items-center gap-1 text-[10px]">
                            <span className="px-1.5 py-0.5 bg-gw-bg border border-gw-secondary rounded font-mono">
                              Tier {w.triage_tier || 'A'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-gw-bg border border-gw-secondary rounded font-mono">
                              {w.data_quality || 'EXPLICIT'}
                            </span>
                            {w.categories && (
                              <span className="px-1.5 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 rounded font-mono">
                                {Array.isArray(w.categories) ? w.categories.join(', ') : String(w.categories)}
                              </span>
                            )}
                          </div>

                          {/* Raw Bulletin Text */}
                          {w.raw_text && (
                            <div className="bg-gw-bg border border-gw-secondary rounded p-2 text-[10px] font-mono leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap select-all">
                              {w.raw_text}
                            </div>
                          )}

                          {/* Action Buttons Row */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => centerOnWarningArea(w)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-gw-panel border border-gw-primary text-gw-primary rounded text-[10px] font-medium uppercase hover:bg-gw-primary hover:text-white transition-colors"
                              title="Center map on hazard coordinates"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>View on map</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onSelectWarning(w)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-gw-panel border border-gw-secondary text-gw-accent hover:border-gw-primary hover:text-gw-primary rounded text-[10px] font-medium uppercase transition-colors"
                              title="Open full provenance and audit modal"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Details</span>
                            </button>

                            {/* Admin Edit Trigger */}
                            {isAdminMode && onEditWarning && (
                              <button
                                type="button"
                                onClick={() => onEditWarning(w)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-gw-primary text-gw-bg rounded text-[10px] font-medium uppercase hover:bg-gw-tertiary transition-colors "
                                title="Open admin warning editor"
                              >
                                <Edit3 className="w-3 h-3 text-sky-300" />
                                <span>Edit Warning</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* E2: map-native admin geometry editor overlay */}
      <MapGeometryEditor
        map={mapReady}
        isAdminMode={isAdminMode}
        selectedWarning={selectedWarning ?? null}
        onGeometrySaved={onGeometrySaved}
      />

      {/* Screen Reader Live Region for Marker Selections */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {srAnnouncement}
      </div>
    </div>
  );
};

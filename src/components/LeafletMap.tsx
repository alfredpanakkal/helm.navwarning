import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { NavWarning, NavAreaId } from '../types';
import { Search, MapPin, Locate, Copy, Activity, Database, Maximize2, RefreshCw, Compass } from 'lucide-react';
import { getLeafletLatLng } from '../utils/coordinateParser';
import { formatCoordinates } from '../utils/statusModel';

/**
 * CANONICAL SPATIAL STORAGE DOCUMENTATION:
 * All spatial geometry coordinates in Helm.Warning are stored canonically in
 * WGS84 Decimal Degrees as [longitude, latitude] arrays inside `SpatialData.geometries`.
 * The UI coordinate toggle converts these canonical values into 'DD' (Decimal Degrees)
 * or 'DMS' (Degrees Minutes Seconds) for navigator convenience.
 */

interface LeafletMapProps {
  warnings: NavWarning[];
  selectedNavArea: NavAreaId | 'ALL';
  onSelectWarning: (warning: NavWarning) => void;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  warnings,
  selectedNavArea,
  onSelectWarning,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<L.Map | null>(null);
  const layersGroup = useRef<L.MarkerClusterGroup | null>(null);

  const [filterSeverity, setFilterSeverity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'none' | 'list'>('none');
  const [coordFormat, setCoordFormat] = useState<'DD' | 'DMS'>('DD');

  // Initialize Leaflet Map
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
        maxZoom: 12,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        attribution: '© OpenSeaMap',
        maxZoom: 18,
        opacity: 0.9,
      }).addTo(map);

      layersGroup.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
      }).addTo(map);
      leafletInstance.current = map;
    }

    return () => {
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }
    };
  }, []);

  // Filter warnings based on severity, NAVAREA, and search text
  const filteredWarnings = warnings.filter(w => {
    // Navarea filter
    if (selectedNavArea !== 'ALL' && w.navarea !== selectedNavArea) return false;

    // Severity filter
    if (filterSeverity === 'critical' && w.extraction_confidence < 1) return false;
    if (filterSeverity === 'high' && (w.extraction_confidence >= 1 || w.extraction_confidence < 0.8)) return false;
    if (filterSeverity === 'moderate' && (w.extraction_confidence >= 0.8 || w.extraction_confidence < 0.5)) return false;
    if (filterSeverity === 'low' && w.extraction_confidence >= 0.5) return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = w.source_warning_id.toLowerCase().includes(q);
      const matchArea = w.area_text?.toLowerCase().includes(q);
      const matchText = w.raw_text?.toLowerCase().includes(q);
      const matchNavArea = `navarea ${w.navarea}`.toLowerCase().includes(q);
      return matchId || matchArea || matchText || matchNavArea;
    }

    return true;
  });

  const hiddenCount = warnings.length - filteredWarnings.length;

  // Auto-frame map bounds around active warnings
  const autoFrameMap = (activeList: NavWarning[]) => {
    if (!leafletInstance.current) return;

    const validCoords: L.LatLngExpression[] = activeList
      .map(w => getLeafletLatLng(w.spatial))
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
  };

  // Render markers & auto-fit framing whenever warnings or filters update
  useEffect(() => {
    if (!leafletInstance.current || !layersGroup.current) return;

    const layers = layersGroup.current;
    layers.clearLayers();

    const activeWarnings = filteredWarnings.filter(w => w.status === 'active');

    activeWarnings.forEach(w => {
      const coords = getLeafletLatLng(w.spatial);

      const icon = L.divIcon({
        className: 'nw-marker-wrap',
        html: `<div class="nw-marker ${w.extraction_confidence === 1 ? 'sev-critical' : 'sev-high'}"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const m = L.marker(coords, { icon }).addTo(layers);

      m.on('click', () => {
        onSelectWarning(w);
      });
    });

    // Auto-fit framing when dataset or filter changes
    autoFrameMap(activeWarnings);
  }, [warnings, filterSeverity, selectedNavArea, searchQuery]);

  // Handle invalidateSize when mobile drawer toggles
  useEffect(() => {
    const timer = setTimeout(() => {
      leafletInstance.current?.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [mobilePanel]);

  return (
    <div className="relative h-[calc(100vh-140px)] min-h-[480px] sm:min-h-[600px] border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden bg-gw-bg isolate">
      <div id="map" ref={mapRef} className="absolute inset-0 grayscale contrast-105 brightness-105 z-0"></div>

      {/* Top Overlay Controls */}
      <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-start pointer-events-none z-[400] gap-2">

        {/* Search & Auto Frame Toolbar */}
        <div className="flex items-center gap-2 pointer-events-auto w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-white/95 border-2 border-gw-primary rounded-lg shadow-hard flex-1 sm:w-[280px] md:w-[320px]">
            <Search className="w-4 h-4 text-gw-accent shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, area, coords..."
              className="bg-transparent border-none outline-none text-xs sm:text-sm w-full text-gw-primary placeholder:text-gw-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-gw-accent hover:text-gw-primary font-bold px-1"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={() => autoFrameMap(filteredWarnings)}
            title="Auto-frame map bounds to fit all warnings"
            className="flex items-center gap-1.5 px-3 py-2 bg-white/95 border-2 border-gw-primary rounded-lg text-xs font-bold uppercase shadow-hard transition-all hover:bg-gw-primary hover:text-gw-bg shrink-0 min-h-[40px]"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Auto Frame</span>
          </button>

          <button
            onClick={() => setCoordFormat((prev) => (prev === 'DD' ? 'DMS' : 'DD'))}
            title="Toggle coordinate display format between Decimal Degrees (DD) and Degrees Minutes Seconds (DMS)"
            className="flex items-center gap-1.5 px-3 py-2 bg-white/95 border-2 border-gw-primary rounded-lg text-xs font-bold uppercase shadow-hard transition-all hover:bg-gw-primary hover:text-gw-bg shrink-0 min-h-[40px]"
          >
            <Compass className="w-3.5 h-3.5 text-gw-accent" />
            <span>Format: {coordFormat}</span>
          </button>
        </div>

        {/* Mobile Toggle Controls */}
        <div className="flex lg:hidden items-center justify-between gap-2 pointer-events-auto">
          <button
            onClick={() => setMobilePanel(mobilePanel === 'list' ? 'none' : 'list')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-gw-primary rounded-lg text-xs font-bold uppercase shadow-hard transition-all min-h-[40px] ${mobilePanel === 'list' ? 'bg-gw-primary text-gw-bg' : 'bg-white/95 text-gw-primary'}`}
          >
            <span>Warnings ({filteredWarnings.length})</span>
          </button>
        </div>

        {/* Legend - Desktop & Tablet */}
        <div className="hidden sm:block bg-white/95 border-2 border-gw-primary rounded-lg shadow-hard pointer-events-auto px-3.5 py-2.5 min-w-[130px] text-[11px]">
          <div className="text-[9px] font-bold uppercase tracking-widest text-gw-accent mb-1.5">SEVERITY</div>
          <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full border border-gw-primary bg-gw-primary"></span>Critical</div>
          <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full border border-gw-primary bg-gw-tertiary"></span>High</div>
          <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full border border-gw-primary bg-gw-accent"></span>Moderate</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full border border-gw-primary bg-white"></span>Low/Info</div>
        </div>

      </div>

      {/* Left Panel - Active Warnings */}
      <aside className={`absolute top-[60px] sm:top-[70px] left-3 sm:left-4 bottom-[60px] sm:bottom-[70px] w-[calc(100%-24px)] sm:w-[320px] bg-white border-2 border-gw-primary rounded-lg shadow-2xl pointer-events-auto z-[1000] lg:z-[400] flex-col ${mobilePanel === 'list' ? 'flex' : 'hidden lg:flex'}`}>
        <div className="flex justify-between items-center p-3.5 border-b border-gw-secondary">
          <div className="font-bold text-sm sm:text-base uppercase tracking-wider flex items-center gap-2">
            <span>Active Warnings</span>
            {hiddenCount > 0 && (
              <span className="text-[10px] font-mono text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded font-bold border border-amber-300">
                ({hiddenCount} hidden)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 bg-gw-primary text-gw-bg rounded font-bold">{filteredWarnings.length}</span>
            <button
              onClick={() => setMobilePanel('none')}
              aria-label="Close mobile list panel"
              className="lg:hidden text-gw-primary font-bold text-base px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 p-2.5 border-b border-gw-secondary">
          {['all', 'critical', 'high', 'moderate', 'low'].map(sev => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              aria-label={`Filter severity ${sev}`}
              className={`flex items-center gap-1 px-2 py-1 bg-transparent border border-gw-secondary rounded text-[10px] uppercase font-bold transition-all hover:border-gw-accent ${filterSeverity === sev ? 'bg-gw-primary text-gw-bg border-gw-primary' : ''}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full border border-current ${
                sev === 'all' || sev === 'critical' ? 'bg-gw-primary' :
                sev === 'high' ? 'bg-gw-tertiary' :
                sev === 'moderate' ? 'bg-gw-accent' : 'bg-gw-secondary'
              }`}></span>
              {sev}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
          {filteredWarnings.map(w => (
            <div
              key={w.warning_id}
              onClick={() => {
                onSelectWarning(w);
              }}
              className={`p-3 bg-gw-bg border border-gw-secondary border-l-4 rounded cursor-pointer transition-all hover:translate-x-0.5 ${
                w.extraction_confidence === 1 ? 'border-l-gw-primary' : 'border-l-gw-tertiary'
              }`}
            >
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-gw-accent tracking-wide">{w.source_warning_id} · NA {w.navarea}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  w.extraction_confidence === 1 ? 'bg-gw-primary text-gw-bg' : 'bg-gw-tertiary text-gw-bg'
                }`}>{w.extraction_confidence === 1 ? 'CRIT' : 'HIGH'}</span>
              </div>
              <div className="text-xs sm:text-sm font-bold mb-1 line-clamp-2">{w.issued_text}</div>
              <div className="flex items-center gap-3 text-[10px] text-gw-accent mt-2">
                <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{w.issued_date}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Bottom Overlay Info */}
      <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 flex justify-between items-center pointer-events-none z-[400]">
        <div className="bg-white/95 border-2 border-gw-primary rounded-lg shadow-hard pointer-events-auto flex items-center gap-3 px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs">
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-gw-accent" />
            <span>DISPLAY:</span>
            <span className="font-bold">{filteredWarnings.length} Warnings</span>
          </div>
          <div className="flex items-center gap-1">
            <Database className="w-3 h-3 text-gw-accent" />
            <span>FRAME:</span>
            <span className="font-bold">Auto</span>
          </div>
        </div>
      </div>
    </div>
  );
};


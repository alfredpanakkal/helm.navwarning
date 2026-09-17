import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { NavWarning, NavAreaId } from '../types';
import { Search, MapPin, Activity, Maximize2, Compass, ChevronLeft, ChevronRight, List, X } from 'lucide-react';
import { getLeafletLatLng } from '../utils/coordinateParser';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
    if (selectedNavArea !== 'ALL' && w.navarea !== selectedNavArea) return false;

    if (filterSeverity === 'critical' && w.extraction_confidence < 1) return false;
    if (filterSeverity === 'high' && (w.extraction_confidence >= 1 || w.extraction_confidence < 0.8)) return false;
    if (filterSeverity === 'moderate' && (w.extraction_confidence >= 0.8 || w.extraction_confidence < 0.5)) return false;
    if (filterSeverity === 'low' && w.extraction_confidence >= 0.5) return false;

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

  // Auto-frame map bounds around active warnings
  const autoFrameMap = (activeList: NavWarning[]) => {
    if (!leafletInstance.current) return;

    const validCoords: L.LatLngExpression[] = activeList
      .map(w => getLeafletLatLng(w.spatial, w.latitude, w.longitude))
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
      const coords = getLeafletLatLng(w.spatial, w.latitude, w.longitude);

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

    autoFrameMap(activeWarnings);
  }, [warnings, filterSeverity, selectedNavArea, searchQuery]);

  // Invalidate map size on sidebar toggle
  useEffect(() => {
    const timer = setTimeout(() => {
      leafletInstance.current?.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [isSidebarOpen]);

  return (
    <div className="relative h-[calc(100vh-140px)] min-h-[500px] border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden bg-gw-bg isolate">
      <div id="map" ref={mapRef} className="absolute inset-0 grayscale contrast-105 brightness-105 z-0"></div>

      {/* Top Controls Toolbar */}
      <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-[400]">
        <div className="flex items-center gap-2 pointer-events-auto flex-1 sm:flex-initial min-w-[240px] max-w-md">
          {/* Sidebar Toggle */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/95 border-2 border-gw-primary rounded-lg text-xs font-bold uppercase shadow-hard hover:bg-gw-primary hover:text-gw-bg transition-all shrink-0 min-h-[40px]"
            title={isSidebarOpen ? "Collapse warnings list" : "Expand warnings list"}
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">{isSidebarOpen ? "Hide List" : `Warnings (${filteredWarnings.length})`}</span>
            <span className="sm:hidden">{filteredWarnings.length}</span>
          </button>

          {/* Search Input */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white/95 border-2 border-gw-primary rounded-lg shadow-hard flex-1 min-w-[160px]">
            <Search className="w-4 h-4 text-gw-accent shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search warnings, area, coords..."
              className="bg-transparent border-none outline-none text-xs sm:text-sm w-full text-gw-primary placeholder:text-gw-accent"
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

        {/* Map View Tools */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => autoFrameMap(filteredWarnings)}
            title="Fit map view to all active warnings"
            className="flex items-center gap-1.5 px-3 py-2 bg-white/95 border-2 border-gw-primary rounded-lg text-xs font-bold uppercase shadow-hard hover:bg-gw-primary hover:text-gw-bg transition-all shrink-0 min-h-[40px]"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fit Bounds</span>
          </button>

          <button
            onClick={() => setCoordFormat((prev) => (prev === 'DD' ? 'DMS' : 'DD'))}
            title="Toggle coordinate format (DD/DMS)"
            className="flex items-center gap-1.5 px-3 py-2 bg-white/95 border-2 border-gw-primary rounded-lg text-xs font-bold uppercase shadow-hard hover:bg-gw-primary hover:text-gw-bg transition-all shrink-0 min-h-[40px]"
          >
            <Compass className="w-3.5 h-3.5 text-gw-accent" />
            <span>{coordFormat}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Left Panel - Active Warnings List */}
      {isSidebarOpen && (
        <aside className="absolute top-[64px] sm:top-[72px] left-3 sm:left-4 bottom-[48px] sm:bottom-[54px] w-[calc(100%-24px)] sm:w-[320px] md:w-[340px] bg-white border-2 border-gw-primary rounded-xl shadow-2xl pointer-events-auto z-[400] flex flex-col overflow-hidden">
          <div className="flex justify-between items-center p-3 border-b border-gw-secondary bg-gw-bg/50">
            <div className="font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
              <span>Active Warnings</span>
              <span className="text-[10px] px-2 py-0.5 bg-gw-primary text-gw-bg rounded-full font-mono font-bold">
                {filteredWarnings.length}
              </span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded text-gw-accent hover:text-gw-primary hover:bg-gw-secondary transition-all"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Severity Filters */}
          <div className="flex items-center gap-1 p-2 border-b border-gw-secondary bg-white overflow-x-auto no-scrollbar">
            {['all', 'critical', 'high', 'moderate'].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold border transition-all shrink-0 ${
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
                No active warnings match search filters.
              </div>
            ) : (
              filteredWarnings.map((w) => (
                <div
                  key={w.warning_id}
                  onClick={() => onSelectWarning(w)}
                  className="p-3 bg-gw-bg hover:bg-white border-2 border-gw-secondary hover:border-gw-primary rounded-lg cursor-pointer transition-all shadow-xs group"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-mono font-bold text-gw-accent group-hover:text-gw-primary">
                      {w.source_warning_id} · NA {w.navarea}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-gw-primary text-gw-bg">
                      {w.extraction_confidence === 1 ? 'CRIT' : 'HIGH'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-gw-primary line-clamp-2 mb-1.5">
                    {w.issued_text}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gw-accent font-mono">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gw-primary" />
                      {w.issued_date}
                    </span>
                    <span className="text-gw-primary font-bold group-hover:underline">
                      View Detail →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* Bottom Status Ribbon */}
      <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 pointer-events-none z-[400]">
        <div className="bg-white/95 border-2 border-gw-primary rounded-lg shadow-hard pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-[10px] sm:text-xs font-mono font-bold">
          <Activity className="w-3.5 h-3.5 text-gw-accent" />
          <span>Active Map Warnings: {filteredWarnings.length}</span>
        </div>
      </div>
    </div>
  );
};



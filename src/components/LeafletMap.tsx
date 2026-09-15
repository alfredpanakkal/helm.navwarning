import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { NavWarning, NavAreaId } from '../types';
import { Search, MapPin, Locate, Copy, ExternalLink, Activity, Database } from 'lucide-react';
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
  const layersGroup = useRef<L.LayerGroup | null>(null);

  const [activeWarning, setActiveWarning] = useState<NavWarning | null>(null);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [mobilePanel, setMobilePanel] = useState<'none' | 'list' | 'detail'>('none');

  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletInstance.current) {
      const map = L.map(mapRef.current, {
        center: [25, 20],
        zoom: 3,
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

      layersGroup.current = L.layerGroup().addTo(map);
      leafletInstance.current = map;
    }

    return () => {
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }
    };
  }, []);

  const filteredWarnings = warnings.filter(w => {
    if (filterSeverity === 'all') return true;
    if (filterSeverity === 'critical') return w.extraction_confidence === 1;
    if (filterSeverity === 'high') return w.extraction_confidence < 1 && w.extraction_confidence >= 0.8;
    if (filterSeverity === 'moderate') return w.extraction_confidence < 0.8 && w.extraction_confidence >= 0.5;
    return w.extraction_confidence < 0.5;
  });

  const hiddenCount = warnings.length - filteredWarnings.length;

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
        iconSize: [16,16],
        iconAnchor: [8,8],
      });

      const m = L.marker(coords, {icon}).addTo(layers);
      
      m.bindPopup(`
        <div style="min-width:200px">
          <div style="font-size:10px; color:var(--color-gw-accent); margin-bottom:4px">${w.source_warning_id} · NAVAREA ${w.navarea}</div>
          <div style="font-weight:700; margin-bottom:6px; font-size:13px">${w.issued_text.substring(0, 40)}...</div>
          <div style="font-size:11px; color:var(--color-gw-primary); background:var(--color-gw-bg); padding:3px 6px; border-radius:4px; display:inline-block">${coords[0].toFixed(2)}, ${coords[1].toFixed(2)}</div>
        </div>
      `);
      
      m.on('click', () => setActiveWarning(w));
    });
  }, [warnings, filterSeverity]);

  const handleLocate = (w: NavWarning) => {
    setActiveWarning(w);
    const coords = getLeafletLatLng(w.spatial);
    leafletInstance.current?.setView(coords, Math.max(leafletInstance.current.getZoom(), 5), {animate: true});
  };

  return (
    <div className="relative h-[calc(100vh-140px)] min-h-[500px] sm:min-h-[600px] border-2 border-gw-primary rounded-xl sm:rounded-2xl overflow-hidden bg-gw-bg isolate">
      <div id="map" ref={mapRef} className="absolute inset-0 grayscale contrast-105 brightness-105 z-0"></div>
      
      {/* Top Overlay */}
      <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-start pointer-events-none z-[400] gap-2">
        
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white/95 border-2 border-gw-primary rounded-lg shadow-hard pointer-events-auto w-full sm:w-[280px] md:w-[300px]">
          <Search className="w-4 h-4 text-gw-accent shrink-0" />
          <input 
            type="text" 
            placeholder="Search ID, area, coords..." 
            className="bg-transparent border-none outline-none text-xs sm:text-sm w-full text-gw-primary placeholder:text-gw-accent" 
          />
        </div>

        {/* Mobile Toggle Controls */}
        <div className="flex lg:hidden items-center justify-between gap-2 pointer-events-auto">
          <button 
            onClick={() => setMobilePanel(mobilePanel === 'list' ? 'none' : 'list')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-gw-primary rounded-lg text-xs font-bold uppercase shadow-hard transition-all min-h-[40px] ${mobilePanel === 'list' ? 'bg-gw-primary text-gw-bg' : 'bg-white/95 text-gw-primary'}`}
          >
            <span>Warnings ({warnings.length})</span>
          </button>
          <button 
            onClick={() => setMobilePanel(mobilePanel === 'detail' ? 'none' : 'detail')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-gw-primary rounded-lg text-xs font-bold uppercase shadow-hard transition-all min-h-[40px] ${mobilePanel === 'detail' ? 'bg-gw-primary text-gw-bg' : 'bg-white/95 text-gw-primary'}`}
          >
            <span>Inspector</span>
            {activeWarning && <span className="w-2 h-2 rounded-full bg-green-400"></span>}
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
          {['all', 'critical', 'high', 'moderate', 'low', 'info'].map(sev => (
            <button 
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              aria-label={`Filter severity ${sev}`}
              className={`flex items-center gap-1 px-2 py-1 bg-transparent border border-gw-secondary rounded text-[10px] uppercase font-bold transition-all hover:border-gw-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gw-primary ${filterSeverity === sev ? 'bg-gw-primary text-gw-bg border-gw-primary' : ''}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full border border-current ${
                sev === 'all' || sev === 'critical' ? 'bg-gw-primary' :
                sev === 'high' ? 'bg-gw-tertiary' :
                sev === 'moderate' ? 'bg-gw-accent' :
                sev === 'low' ? 'bg-gw-secondary' : 'bg-white'
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
                handleLocate(w);
                if (window.innerWidth < 1024) setMobilePanel('detail');
              }}
              className={`p-3 bg-gw-bg border border-gw-secondary border-l-4 rounded cursor-pointer transition-all hover:translate-x-0.5 ${activeWarning?.warning_id === w.warning_id ? 'border-r-gw-primary border-t-gw-primary border-b-gw-primary shadow-[2px_2px_0_var(--color-gw-tertiary)]' : ''} ${
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

      {/* Right Panel - Detail View */}
      <aside className={`absolute top-[60px] sm:top-[70px] right-3 sm:right-4 bottom-[60px] sm:bottom-[70px] w-[calc(100%-24px)] sm:w-[340px] bg-white border-2 border-gw-primary rounded-lg shadow-2xl pointer-events-auto z-[1000] lg:z-[400] flex-col ${mobilePanel === 'detail' ? 'flex' : 'hidden lg:flex'}`}>
        {!activeWarning ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
            <div className="flex justify-end w-full lg:hidden">
              <button onClick={() => setMobilePanel('none')} className="text-gw-primary font-bold text-base px-2">✕</button>
            </div>
            <div className="w-12 h-12 border-2 border-dashed border-gw-accent rounded-full flex items-center justify-center text-gw-accent">
              <Activity className="w-6 h-6" />
            </div>
            <div className="text-xs sm:text-sm text-gw-accent">Select a warning to inspect its full record, parsed geometry, and provenance.</div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="p-3.5 border-b-2 border-gw-primary">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-gw-accent">{activeWarning.source_warning_id} · NAVAREA {activeWarning.navarea}</span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>{activeWarning.status}
                  </span>
                  <button onClick={() => setMobilePanel('none')} className="lg:hidden text-gw-primary font-bold text-base px-2">✕</button>
                </div>
              </div>
              <div className="text-base sm:text-lg font-bold leading-snug">{activeWarning.issued_text.substring(0, 40)}...</div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4 no-scrollbar">
              
              <div>
                <div className="text-[10px] font-bold tracking-widest uppercase text-gw-accent mb-1.5">PARSED GEOMETRY · {activeWarning.spatial.geometries[0]?.type}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gw-bg border border-gw-secondary rounded p-2">
                    <div className="text-[10px] text-gw-accent mb-0.5">COORDINATES</div>
                    <div className="text-xs font-bold text-gw-primary">Available</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold tracking-widest uppercase text-gw-accent mb-1.5">RAW SOURCE TEXT · {activeWarning.extraction_method.toUpperCase()}</div>
                <div className="text-xs text-gw-primary leading-relaxed p-2.5 bg-gw-bg border border-gw-secondary border-l-4 border-l-gw-primary rounded">
                  {activeWarning.raw_text}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold tracking-widest uppercase text-gw-accent mb-1.5">METADATA</div>
                <div className="flex justify-between py-1 text-xs border-b border-dashed border-gw-secondary last:border-0">
                  <span className="text-gw-accent">Issued</span>
                  <span className="font-bold">{activeWarning.issued_date}</span>
                </div>
                <div className="flex justify-between py-1 text-xs border-b border-dashed border-gw-secondary last:border-0">
                  <span className="text-gw-accent">Publisher</span>
                  <span className="font-bold">{activeWarning.publisher_id}</span>
                </div>
                <div className="flex justify-between py-1 text-xs border-b border-dashed border-gw-secondary last:border-0">
                  <span className="text-gw-accent">Extraction</span>
                  <span className="font-bold">{activeWarning.extraction_method}</span>
                </div>
              </div>

            </div>

            <div className="flex gap-2 p-3 border-t-2 border-gw-primary">
              <button 
                onClick={() => {
                  handleLocate(activeWarning);
                  setMobilePanel('none');
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-transparent border border-gw-secondary rounded text-[10px] font-bold uppercase transition-all hover:bg-gw-primary hover:text-gw-bg min-h-[40px]"
              >
                <Locate className="w-3.5 h-3.5" /> Locate
              </button>
              <button 
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-transparent border border-gw-secondary rounded text-[10px] font-bold uppercase transition-all hover:bg-gw-primary hover:text-gw-bg min-h-[40px]"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Bottom Overlay */}
      <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 flex justify-between items-center pointer-events-none z-[400]">
        
        <div className="bg-white/95 border-2 border-gw-primary rounded-lg shadow-hard pointer-events-auto flex items-center gap-3 px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs">
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-gw-accent" />
            <span>SYNC:</span>
            <span className="font-bold">2m 14s</span>
          </div>
          <div className="flex items-center gap-1">
            <Database className="w-3 h-3 text-gw-accent" />
            <span>GEN:</span>
            <span className="font-bold">0247</span>
          </div>
        </div>

      </div>
    </div>
  );
};

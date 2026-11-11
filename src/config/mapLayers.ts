// Leaflet Maritime Map Layer Configuration & Schema
export interface MapLayerConfig {
  id: string;
  name: string;
  url: string;
  type: 'base' | 'overlay';
  attribution: string;
  maxZoom: number;
  maxNativeZoom?: number;
  subdomains?: string[];
  pane: string;
}

// Custom Leaflet Pane Registry with strict z-index stacking
export interface PaneDefinition {
  name: string;
  zIndex: number;
  pointerEvents?: 'auto' | 'none';
}

export const MAP_PANES: Record<string, PaneDefinition> = {
  basePane: { name: 'basePane', zIndex: 200 },
  soundingsPane: { name: 'soundingsPane', zIndex: 250, pointerEvents: 'none' },
  seamarksPane: { name: 'seamarksPane', zIndex: 300, pointerEvents: 'none' },
  navWarnVectorPane: { name: 'navWarnVectorPane', zIndex: 400 },
  navWarnHaloPane: { name: 'navWarnHaloPane', zIndex: 500, pointerEvents: 'none' },
  navWarnMarkerPane: { name: 'navWarnMarkerPane', zIndex: 600 },
};

// Base Cartography Layers
export const BASE_LAYERS: MapLayerConfig[] = [
  {
    id: 'openseamap-base',
    name: 'OpenSeaMap Standard',
    url: '/navarea/api/tiles/osm/{z}/{x}/{y}',
    type: 'base',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, OpenSeaMap',
    maxZoom: 19,
    pane: 'basePane',
  },
  {
    id: 'carto-voyager',
    name: 'CARTO Voyager',
    url: '/navarea/api/tiles/carto/voyager/{z}/{x}/{y}',
    type: 'base',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    pane: 'basePane',
  },
  {
    id: 'carto-dark',
    name: 'CARTO Dark Matter',
    url: '/navarea/api/tiles/carto/dark_all/{z}/{x}/{y}',
    type: 'base',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    pane: 'basePane',
  },
  {
    id: 'carto-positron',
    name: 'CARTO Positron',
    url: '/navarea/api/tiles/carto/light_all/{z}/{x}/{y}',
    type: 'base',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    pane: 'basePane',
  },
  {
    id: 'osm-standard',
    name: 'OpenStreetMap',
    url: '/navarea/api/tiles/osm/{z}/{x}/{y}',
    type: 'base',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    pane: 'basePane',
  },
  {
    id: 'esri-ocean',
    name: 'ESRI Ocean Base',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    type: 'base',
    attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
    maxZoom: 19,
    maxNativeZoom: 13,
    pane: 'basePane',
  },
];

// Nautical Overlays
export const OVERLAY_LAYERS: MapLayerConfig[] = [
  {
    id: 'esri-labels',
    name: 'ESRI Ocean Labels & Soundings',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',
    type: 'overlay',
    attribution: 'Tiles &copy; Esri &mdash; NOAA, GEBCO, Garmin',
    maxZoom: 19,
    maxNativeZoom: 13,
    pane: 'soundingsPane',
  },
  {
    id: 'openseamap',
    name: 'OpenSeaMap Seamarks',
    url: '/navarea/api/tiles/openseamap/{z}/{x}/{y}',
    type: 'overlay',
    attribution: 'Map style: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a>',
    maxZoom: 18,
    pane: 'seamarksPane',
  },
];


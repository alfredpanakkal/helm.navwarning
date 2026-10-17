export interface NavAreaZone {
  id: string;
  name: string;
  subTitle: string;
  center: [number, number]; // [lat, lng]
  zoom: number;
  bounds?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export const NAVAREA_ZONE_LIST: NavAreaZone[] = [
  { id: 'I', name: 'NAVAREA I', subTitle: 'North Sea & NE Atlantic (UK)', center: [58.5, 2.5], zoom: 5 },
  { id: 'Baltic', name: 'Baltic Sea', subTitle: 'Baltic Sea Sub-area (Sweden)', center: [57.5, 19.0], zoom: 6 },
  { id: 'II', name: 'NAVAREA II', subTitle: 'Atlantic East & Bay of Biscay (France)', center: [36.0, -15.0], zoom: 4 },
  { id: 'III', name: 'NAVAREA III', subTitle: 'Mediterranean & Black Sea (Spain)', center: [36.5, 18.0], zoom: 5 },
  { id: 'IV', name: 'NAVAREA IV', subTitle: 'Western North Atlantic (USA/NGA)', center: [28.0, -65.0], zoom: 4 },
  { id: 'V', name: 'NAVAREA V', subTitle: 'South Atlantic West (Brazil)', center: [-16.0, -35.0], zoom: 4 },
  { id: 'VI', name: 'NAVAREA VI', subTitle: 'South Atlantic SW (Argentina)', center: [-45.0, -58.0], zoom: 4 },
  { id: 'VII', name: 'NAVAREA VII', subTitle: 'South Atlantic SE & S Indian Ocean (South Africa)', center: [-34.0, 22.0], zoom: 4 },
  { id: 'VIII', name: 'NAVAREA VIII', subTitle: 'Northern Indian Ocean (India)', center: [12.0, 75.0], zoom: 5 },
  { id: 'IX', name: 'NAVAREA IX', subTitle: 'Red Sea, Gulf of Aden & Persian Gulf (Pakistan)', center: [24.0, 56.0], zoom: 5 },
  { id: 'X', name: 'NAVAREA X', subTitle: 'Australia & Southern Ocean (Australia)', center: [-25.0, 133.0], zoom: 4 },
  { id: 'XI', name: 'NAVAREA XI', subTitle: 'Western Pacific & East Asia (Japan)', center: [20.0, 125.0], zoom: 4 },
  { id: 'XII', name: 'NAVAREA XII', subTitle: 'Eastern North Pacific (USA/NGA)', center: [25.0, -125.0], zoom: 4 },
  { id: 'XIII', name: 'NAVAREA XIII', subTitle: 'Sea of Okhotsk & NW Pacific (Russia)', center: [52.0, 150.0], zoom: 4 },
  { id: 'XIV', name: 'NAVAREA XIV', subTitle: 'South Pacific & Tasman Sea (New Zealand)', center: [-35.0, -175.0], zoom: 4 },
  { id: 'XV', name: 'NAVAREA XV', subTitle: 'South Pacific SE (Chile)', center: [-38.0, -80.0], zoom: 4 },
  { id: 'XVI', name: 'NAVAREA XVI', subTitle: 'South Pacific East (Peru)', center: [-10.0, -85.0], zoom: 4 },
  { id: 'XVII', name: 'NAVAREA XVII', subTitle: 'Arctic Ocean NW (Canada)', center: [73.0, -125.0], zoom: 3 },
  { id: 'XVIII', name: 'NAVAREA XVIII', subTitle: 'Arctic Ocean NE (Canada)', center: [72.0, -68.0], zoom: 3 },
  { id: 'XIX', name: 'NAVAREA XIX', subTitle: 'Arctic Ocean North (Norway)', center: [75.0, 20.0], zoom: 3 },
  { id: 'XX', name: 'NAVAREA XX', subTitle: 'Arctic Ocean Russia West (Russia)', center: [75.0, 60.0], zoom: 3 },
  { id: 'XXI', name: 'NAVAREA XXI', subTitle: 'Arctic Ocean Russia East (Russia)', center: [75.0, 150.0], zoom: 3 },
];

export const NAVAREA_ZONES_BY_ID: Record<string, NavAreaZone> = NAVAREA_ZONE_LIST.reduce(
  (acc, z) => {
    acc[z.id] = z;
    return acc;
  },
  {} as Record<string, NavAreaZone>
);

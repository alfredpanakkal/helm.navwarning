import {
  addWaypoint,
  assessRouteWarnings,
  calculateRoute,
  exportRouteCsv,
  exportRouteGeoJson,
  exportRouteGpx,
  createRoute,
  deleteRoute,
  formatLatitude,
  formatLongitude,
  loadRoutes,
  parseCoordinates,
  parseRouteImport,
  removeWaypoint,
  renameRoute,
  reorderWaypoint,
  saveRoutes,
  updateWaypoint,
  voyageRouteSchema,
  wrapLongitudeForChart,
  DEFAULT_WARNING_RANGE_NM,
  type StorageLike,
  type VoyageRoute,
  type RouteWarningAssessment,
  type WarningAssessmentWarningInput,
  type Waypoint,
} from './index';

declare global {
  interface Window {
    hwMap?: import('leaflet').Map;
    L?: typeof import('leaflet');
    getPublicWarningSnapshot?: () => {
      warnings: WarningAssessmentWarningInput[];
      available: boolean;
      cached: boolean;
      textIncomplete: boolean;
      savedAt: string | null;
    };
  }
}

const workspace = document.querySelector<HTMLElement>('.public-warning-workspace');
const panel = document.getElementById('voyagePlannerPanel');
const content = document.getElementById('voyagePlannerContent');
const toggleButton = document.getElementById('btnVoyagePlanner');
const closeButton = document.getElementById('btnVoyagePlannerClose');
const collapseButton = document.getElementById('btnVoyagePlannerCollapse');

if (workspace && panel && content && toggleButton) {
  const context = {
    idFactory: () => window.crypto?.randomUUID?.() ?? 'wp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    now: () => new Date().toISOString().replace('.000Z', 'Z'),
  };

  let storage: StorageLike | null = null;
  let storageBlocked = false;
  let notice = '';
  let routes: VoyageRoute[] = [];
  let activeRouteId: string | null = null;
  let draftRoute: VoyageRoute | null = null;
  let draftOriginalRouteId: string | null = null;
  let selectedWaypointId: string | null = null;
  let map: import('leaflet').Map | null = null;
  let routeLayer: import('leaflet').LayerGroup | null = null;
  let addMode = false;
  let coordinateFormat: 'dmd' | 'decimal' = 'dmd';
  let pendingInsertion: { position: { lat: number; lon: number }; afterIndex: number } | null = null;
  let warningHighlightLayer: import('leaflet').FeatureGroup | null = null;
  const undoHistory: VoyageRoute[][] = [];
  const redoHistory: VoyageRoute[][] = [];
  let warningSnapshot: {
    warnings: WarningAssessmentWarningInput[];
    available: boolean;
    cached: boolean;
    textIncomplete: boolean;
    savedAt: string | null;
  } | null = null;
  let warningAssessmentCache: {
    route: VoyageRoute;
    warnings: WarningAssessmentWarningInput[];
    result: RouteWarningAssessment;
  } | null = null;

  try {
    storage = window.localStorage;
  } catch {
    storageBlocked = true;
    notice = 'Local storage is unavailable in this browser. Routes cannot be saved.';
  }

  const initialLoad = storage
    ? loadRoutes(storage)
    : { status: 'storage_error' as const, routes: [] as [], reason: notice || 'Local storage is unavailable.' };

  if (initialLoad.status === 'loaded' || initialLoad.status === 'empty') {
    routes = initialLoad.routes;
  } else {
    storageBlocked = true;
    notice = initialLoad.status === 'unsupported_version'
      ? 'Saved route data uses an unsupported version (' + String(initialLoad.version) + '). Original data was preserved; editing is disabled.'
      : initialLoad.reason;
  }
  activeRouteId = routes[0]?.id ?? null;
  selectedWaypointId = routes[0]?.waypoints[0]?.id ?? null;

  function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character] ?? character);
  }

  function activeRoute(): VoyageRoute | null {
    return draftRoute ?? routes.find((route) => route.id === activeRouteId) ?? null;
  }

  function localDateTimeValue(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }

  function displayUtc(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toISOString().replace('T', ' ').replace('.000Z', ' UTC').replace(/Z$/, ' UTC');
  }

  function displayCourse(value: number | null): string {
    return value === null ? '—' : String(Math.round(value) % 360).padStart(3, '0') + '°T';
  }

  function importRouteFile(file: File): void {
    const reader = new FileReader();
    reader.onerror = () => { notice = 'Could not read the selected route file.'; render(); };
    reader.onload = () => {
      const parsed = parseRouteImport(String(reader.result ?? ''), file.name);
      if ('error' in parsed) { notice = parsed.error; render(); return; }
      const current = activeRoute();
      const created = createRoute(parsed.name, current?.defaultSpeedKn ?? 10, context, current?.warningRangeNm ?? DEFAULT_WARNING_RANGE_NM);
      if (!created.ok) { notice = 'Could not create a route from this file.'; render(); return; }
      let imported = created.value;
      for (const waypoint of parsed.waypoints) {
        const added = addWaypoint(imported, waypoint, context);
        if (!added.ok) { notice = 'The imported route contains invalid waypoint data.'; render(); return; }
        imported = added.value;
      }
      if (draftRoute) {
        notice = 'Save or cancel the current draft before importing another route.';
        render();
        return;
      }
      draftRoute = imported;
      draftOriginalRouteId = null;
      activeRouteId = imported.id;
      selectedWaypointId = imported.waypoints[0]?.id ?? null;
      notice = 'Imported route is ready for review. Save it to keep it on this device.';
      render(); renderMap();
    };
    if (file.size > 1_000_000) {
      notice = 'The file is larger than 1 MB. Nothing was imported.';
      render();
      return;
    }
    reader.readAsText(file);
  }

  function printRouteReport(route: VoyageRoute): void {
    const calculation = calculateRoute(route);
    const assessment = warningSnapshot?.available ? assessRouteWarnings(route, warningSnapshot.warnings) : null;
    const popup = window.open('', '_blank');
    if (!popup) { notice = 'Allow pop-ups to print the route report.'; render(); return; }
    const coordinates: Array<[number, number]> = [];
    route.waypoints.forEach((waypoint, index) => {
      let longitude = waypoint.position.lon;
      if (index > 0) {
        const previous = coordinates[index - 1][0];
        while (longitude - previous > 180) longitude -= 360;
        while (longitude - previous < -180) longitude += 360;
      }
      coordinates.push([longitude, waypoint.position.lat]);
    });
    const longitudes = coordinates.map((point) => point[0]);
    const latitudes = coordinates.map((point) => point[1]);
    const minLon = Math.min(...longitudes), maxLon = Math.max(...longitudes);
    const minLat = Math.min(...latitudes), maxLat = Math.max(...latitudes);
    const x = (lon: number) => 24 + ((lon - minLon) / Math.max(0.000001, maxLon - minLon)) * 552;
    const y = (lat: number) => 176 - ((lat - minLat) / Math.max(0.000001, maxLat - minLat)) * 132;
    const sketchPoints = coordinates.map((point) => x(point[0]) + ',' + y(point[1])).join(' ');
    const sketchMarkers = coordinates.map((point, index) => '<circle cx="' + x(point[0]) + '" cy="' + y(point[1]) + '" r="4"/><text x="' + (x(point[0]) + 7) + '" y="' + (y(point[1]) - 7) + '">' + (index + 1) + '</text>').join('');
    const waypointRows = route.waypoints.map((waypoint, index) => {
      const leg = calculation.legs[index - 1];
      return '<tr><td>' + (index + 1) + '</td><td>' + escapeHtml(waypoint.name) + '</td><td>' + escapeHtml(formatLatitude(waypoint.position.lat)) + '</td><td>' + escapeHtml(formatLongitude(waypoint.position.lon)) + '</td><td>' + (index === 0 ? '—' : leg?.distanceNm === null || !leg ? 'Not calculated' : leg.distanceNm.toFixed(2) + ' NM') + '</td><td>' + (index === 0 ? '—' : displayCourse(leg?.courseDeg ?? null)) + '</td></tr>';
    }).join('');
    const warningRows = assessment?.results.map((item) => '<tr><td>' + escapeHtml(item.warningId) + '</td><td>' + escapeHtml(item.navarea) + '</td><td>' + escapeHtml(item.severity) + '</td><td>' + (item.status === 'INTERSECTS' ? 'Intersects' : item.status === 'WITHIN_RANGE' ? 'Nearby' : 'Not assessed') + '</td><td>' + escapeHtml(warningValidityLabel(item.validFrom, item.validTo)) + '</td></tr>').join('') ?? '';
    const report = '<!doctype html><html><head><meta charset="utf-8"><title>' + escapeHtml(route.name) + ' — Route Report</title><style>body{font:13px Arial,sans-serif;color:#17212b;margin:28px}h1{font-size:22px;margin:0 0 6px}h2{font-size:15px;margin:22px 0 8px}p{color:#52606d;line-height:1.5}.meta{display:flex;gap:24px;margin:14px 0}.meta strong{display:block;font-size:18px;color:#17212b}svg{width:100%;height:210px;border:1px solid #d7dee5;border-radius:8px}svg polyline{fill:none;stroke:#28724f;stroke-width:3}svg circle{fill:#28724f;stroke:white;stroke-width:2}svg text{font:11px Arial;fill:#17212b}table{width:100%;border-collapse:collapse;font-size:11px}th,td{text-align:left;padding:7px;border-bottom:1px solid #d7dee5;vertical-align:top}th{background:#f2f5f7}footer{margin-top:24px;padding-top:10px;border-top:1px solid #d7dee5;font-size:10px;color:#52606d}@media print{body{margin:12mm}h2{break-after:avoid}tr{break-inside:avoid}}</style></head><body><h1>' + escapeHtml(route.name) + '</h1><p>Helm.Warning route summary · Generated ' + escapeHtml(new Date().toISOString()) + '</p><div class="meta"><div><strong>' + calculation.totalDistanceNm.toFixed(1) + ' NM</strong>Total route distance</div><div><strong>' + route.waypoints.length + '</strong>Waypoints</div><div><strong>' + (assessment?.examinedWarnings ?? '—') + '</strong>Warnings examined</div></div><h2>Route shape</h2><p>Schematic only; not a navigational chart and not to scale.</p><svg viewBox="0 0 600 200" role="img" aria-label="Schematic route connecting numbered waypoints"><polyline points="' + sketchPoints + '"/>' + sketchMarkers + '</svg><h2>Waypoints and legs</h2><table><thead><tr><th>#</th><th>Waypoint</th><th>Latitude</th><th>Longitude</th><th>Leg distance</th><th>Course</th></tr></thead><tbody>' + waypointRows + '</tbody></table><h2>NAVAREA warning assessment</h2>' + (assessment ? '<p>' + assessment.intersectsCount + ' intersecting · ' + assessment.withinRangeCount + ' nearby · ' + assessment.notAssessedCount + ' not assessed · Search distance ' + assessment.rangeNm + ' NM</p><table><thead><tr><th>Warning</th><th>NAVAREA</th><th>Severity</th><th>Route relation</th><th>Validity</th></tr></thead><tbody>' + (warningRows || '<tr><td colspan="5">No warning results.</td></tr>') + '</tbody></table>' : '<p>Warning data unavailable; no assessment was performed.</p>') + '<footer>Decision-support information only. This report is not an ECDIS output, safety clearance or substitute for official navigational warnings, approved charts and publications, or the Master\'s judgement. Warning data may be delayed, incomplete or unavailable. Validity is compared with the current date only, not estimated passage time.</footer></body></html>';
    popup.document.open(); popup.document.write(report); popup.document.close();
    let printed = false;
    const printOnce = () => {
      if (printed) return;
      printed = true;
      try { popup.focus(); popup.print(); } catch { /* User can print manually. */ }
    };
    popup.addEventListener('load', printOnce, { once: true });
    window.setTimeout(printOnce, 500);
  }

  function downloadRouteExport(route: VoyageRoute, format: 'geojson' | 'gpx' | 'csv'): void {
    try {
      const contentByFormat = {
        geojson: () => exportRouteGeoJson(route),
        gpx: () => exportRouteGpx(route),
        csv: () => exportRouteCsv(route),
      };
      const mimeByFormat = {
        geojson: 'application/geo+json;charset=utf-8',
        gpx: 'application/gpx+xml;charset=utf-8',
        csv: 'text/csv;charset=utf-8',
      };
      const safeName = route.name.normalize('NFKC')
        .replace(/[^A-Za-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'voyage-route';
      const body = contentByFormat[format]();
      const blob = new Blob([format === 'csv' ? '\uFEFF' + body : body], { type: mimeByFormat[format] });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = safeName + '.' + format;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      notice = format.toUpperCase() + ' export generated locally.';
    } catch {
      notice = 'Could not export this route. Check the route data and try again.';
    }
    render();
  }

  function warningValidityLabel(validFrom: string | null, validTo: string | null): string {
    const parseBoundary = (value: string, endOfDay: boolean): number => {
      const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? value + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z')
        : value;
      return Date.parse(dateValue);
    };
    const from = validFrom ? parseBoundary(validFrom, false) : null;
    const to = validTo ? parseBoundary(validTo, true) : null;
    if ((validFrom && !Number.isFinite(from)) || (validTo && !Number.isFinite(to))) return 'Validity uncertain — invalid date';
    if (from === null && to === null) return 'Validity dates unavailable';
    const now = Date.now();
    if (from !== null && now < from) return 'Scheduled — not yet effective';
    if (to !== null && now > to) return 'Expired by stated date';
    return 'Active by stated dates';
  }

  function locateWarning(warningId: string): void {
    if (!map || !window.L || !warningSnapshot) return;
    const warning = warningSnapshot.warnings.find((item) =>
      (item.canonical_id || item.warning_id || item.id || 'Unknown warning') === warningId,
    );
    if (!warning || !Array.isArray(warning.geometries)) {
      notice = 'Warning geometry is unavailable for map highlighting.';
      render();
      return;
    }
    if (!warningHighlightLayer) warningHighlightLayer = window.L.featureGroup();
    warningHighlightLayer.clearLayers();
    let added = 0;
    warning.geometries.forEach((geometry) => {
      const blob = geometry.geojson_blob;
      if (!blob || typeof blob !== 'object') return;
      try {
        const layer = window.L!.geoJSON(blob as import('geojson').GeoJsonObject, {
          style: { color: '#D97706', weight: 4, opacity: 1, fillColor: '#F59E0B', fillOpacity: 0.2 },
          pointToLayer: (_feature, latlng) => window.L!.circleMarker(latlng, {
            radius: 9, color: '#D97706', weight: 3, fillColor: '#F59E0B', fillOpacity: 0.65,
          }),
        });
        layer.addTo(warningHighlightLayer!);
        added += 1;
      } catch { /* Unsupported geometry stays unhighlighted. */ }
    });
    if (!added) {
      notice = 'Warning geometry could not be displayed on the map.';
      render();
      return;
    }
    warningHighlightLayer.addTo(map);
    const bounds = warningHighlightLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.35), { maxZoom: 8 });
    notice = 'Highlighted ' + warningId + ' on the map.';
    render();
  }

  function renderWarningAssessment(route: VoyageRoute): string {
    if (!warningSnapshot || !warningSnapshot.available) {
      return '<section class="voyage-planner-section voyage-assessment"><div class="voyage-planner-section-title"><strong>NAVAREA warning assessment</strong></div><p class="voyage-planner-disclaimer">Waiting for the public Tier A warning dataset. Geometry assessment is unavailable until the dataset loads.</p></section>';
    }

    if (!warningAssessmentCache || warningAssessmentCache.route !== route
      || warningAssessmentCache.warnings !== warningSnapshot.warnings) {
      warningAssessmentCache = {
        route,
        warnings: warningSnapshot.warnings,
        result: assessRouteWarnings(route, warningSnapshot.warnings),
      };
    }
    const assessment = warningAssessmentCache.result;
    const freshness = warningSnapshot.cached
      ? '<p class="voyage-assessment-notice is-warning">Using a saved warning snapshot from ' + escapeHtml(warningSnapshot.savedAt ? displayUtc(warningSnapshot.savedAt) : 'an unknown time') + '. Current warning status could not be confirmed.</p>'
      : '<p class="voyage-assessment-notice">Using the currently loaded public Tier A warning snapshot.</p>';
    const textNotice = warningSnapshot.textIncomplete
      ? '<p class="voyage-assessment-notice is-warning">Bulletin text hydration is incomplete. Warnings without a confirmed quality state remain Not assessed.</p>'
      : '';
    const validityNotice = '<p class="voyage-assessment-notice">Warning validity is compared with the current date only. Estimated passage-time overlap and altitude limits are not evaluated. This is not a safety clearance.</p>';

    if (!assessment.ready) {
      return '<section class="voyage-planner-section voyage-assessment"><div class="voyage-planner-section-title"><strong>NAVAREA warning assessment</strong><span>' + route.warningRangeNm + ' NM search range</span></div>' +
        freshness + textNotice + '<p class="voyage-planner-disclaimer">' + escapeHtml(assessment.reason ?? 'Add route waypoints to begin.') + '</p>' + validityNotice + '</section>';
    }

    const rows = assessment.results.map((item) => {
      const leg = item.nearestLegIndex === null
        ? 'Nearest leg unavailable'
        : 'Leg ' + item.nearestLegIndex + ': ' + escapeHtml(item.nearestFromWaypoint ?? '—') + ' to ' + escapeHtml(item.nearestToWaypoint ?? '—');
      const distance = item.nearestDistanceNm === null ? '—' : item.nearestDistanceNm.toFixed(2) + ' NM';
      const status = item.status === 'INTERSECTS' ? 'Intersects'
        : item.status === 'WITHIN_RANGE' ? 'Within range' : 'Not assessed';
      const flags = item.qaFlags.length
        ? '<span class="voyage-assessment-meta">QA: ' + escapeHtml(item.qaFlags.join(', ')) + '</span>'
        : '';
      const validity = '<span class="voyage-assessment-meta">' + escapeHtml(warningValidityLabel(item.validFrom, item.validTo)) +
        (item.validFrom || item.validTo ? ' · ' + (item.validFrom ? 'from ' + escapeHtml(Number.isFinite(Date.parse(item.validFrom)) ? displayUtc(item.validFrom) : 'invalid') : 'start not stated') +
          ' · ' + (item.validTo ? 'to ' + escapeHtml(Number.isFinite(Date.parse(item.validTo)) ? displayUtc(item.validTo) : 'invalid') : 'no end stated') : '') + '</span>';
      const reason = item.reason
        ? '<span class="voyage-assessment-reason">' + escapeHtml(item.reason) + '</span>'
        : '';
      const partial = item.hasUnassessedGeometry
        ? '<span class="voyage-assessment-reason">One or more additional zones could not be assessed.</span>'
        : '';
      return '<button type="button" class="voyage-assessment-row is-' + item.status.toLowerCase().replace('_', '-') + '" data-action="locate-warning" data-warning-id="' + escapeHtml(item.warningId) + '" aria-label="Locate warning ' + escapeHtml(item.warningId) + ' on map">' +
        '<span class="voyage-assessment-row-head"><strong>' + escapeHtml(item.warningId) + '</strong><span class="voyage-assessment-status">' + status + '</span></span>' +
        '<span class="voyage-assessment-meta">' + escapeHtml(item.title) + ' · ' + escapeHtml(item.navarea) + ' · ' + escapeHtml(item.severity) + '</span>' +
        '<span class="voyage-assessment-meta">' + escapeHtml(item.nearestZone ?? 'Zone unavailable') + ' · ' + leg + ' · ' + distance + '</span>' +
        '<span class="voyage-assessment-meta">Quality: ' + escapeHtml(item.dataQuality) + ' · Tier ' + escapeHtml(item.triageTier) + (item.isVerified ? ' · Quality gate passed' : ' · Review required') + '</span>' +
        validity + flags + reason + partial + '</button>';
    }).join('');

    const empty = assessment.examinedWarnings === 0
      ? '<p class="voyage-planner-disclaimer">No warning records were loaded. A route assessment cannot be made.</p>'
      : assessment.results.length === 0
        ? '<p class="voyage-planner-disclaimer">No assessed warning geometry intersects the route or falls within ' + assessment.rangeNm + ' NM. This is not a safety clearance.</p>'
        : '';
    const summary = '<div class="voyage-assessment-counts"><span>Intersects <strong>' + assessment.intersectsCount + '</strong></span><span>Within range <strong>' + assessment.withinRangeCount + '</strong></span><span>Not assessed <strong>' + assessment.notAssessedCount + '</strong></span></div>';
    const routeNotice = assessment.reason
      ? '<p class="voyage-assessment-notice is-warning">' + escapeHtml(assessment.reason) + '</p>'
      : '';

    return '<section class="voyage-planner-section voyage-assessment"><div class="voyage-planner-section-title"><strong>NAVAREA warning assessment</strong><span>' + assessment.rangeNm + ' NM · ' + assessment.assessedWarnings + '/' + assessment.examinedWarnings + ' assessed</span></div>' +
      freshness + textNotice + routeNotice + summary + empty + '<div class="voyage-assessment-list">' + rows + '</div>' +
      '<p class="voyage-planner-disclaimer">Rhumb-line route approximation; proximity sampled at 0.5 NM intervals. Only supported geometry that passes the public Tier A quality gate is assessed. Not a certified ECDIS.</p>' +
      validityNotice + '</section>';
  }

  function persist(nextRoutes: VoyageRoute[]): boolean {
    if (!storage || storageBlocked) {
      notice = notice || 'Local storage is unavailable; changes were not saved.';
      render();
      return false;
    }
    const result = saveRoutes(storage, nextRoutes);
    if ('reason' in result) {
      storageBlocked = true;
      notice = result.detail || 'Route save failed: ' + result.reason;
      render();
      return false;
    }
    if (JSON.stringify(nextRoutes) !== JSON.stringify(routes)) {
      undoHistory.push(routes);
      if (undoHistory.length > 30) undoHistory.shift();
      redoHistory.length = 0;
    }
    routes = nextRoutes;
    notice = 'Saved on this device';
    render();
    renderMap();
    return true;
  }

  function applyHistory(source: VoyageRoute[][], destination: VoyageRoute[][], label: string): void {
    if (!storage || storageBlocked || source.length === 0) return;
    const snapshot = source[source.length - 1];
    const result = saveRoutes(storage, snapshot);
    if ('reason' in result) {
      notice = result.detail || 'Could not ' + label.toLowerCase() + ' route changes.';
      render();
      return;
    }
    source.pop();
    destination.push(routes);
    routes = snapshot;
    if (!routes.some((route) => route.id === activeRouteId)) activeRouteId = routes[0]?.id ?? null;
    selectedWaypointId = activeRoute()?.waypoints[0]?.id ?? null;
    pendingInsertion = null;
    notice = label + ' completed.';
    render();
    renderMap();
  }

  function commitRouteChange(nextRoute: VoyageRoute): boolean {
    if (!draftRoute || nextRoute.id !== draftRoute.id || storageBlocked) return false;
    draftRoute = nextRoute;
    notice = 'Unsaved draft changes';
    render();
    renderMap();
    return true;
  }

  function updateActiveRoute(nextRoute: VoyageRoute): boolean {
    return commitRouteChange(nextRoute);
  }

  function beginRouteEdit(): void {
    const route = activeRoute();
    if (!route || draftRoute || storageBlocked) return;
    draftOriginalRouteId = route.id;
    draftRoute = {
      ...route,
      waypoints: route.waypoints.map((waypoint) => ({
        ...waypoint,
        position: { ...waypoint.position },
      })),
    };
    notice = 'Editing a working copy. The saved route remains unchanged until Save.';
    render();
    renderMap();
  }

  function saveDraftRoute(): void {
    if (!draftRoute || storageBlocked) return;
    if (draftRoute.waypoints.length < 2) {
      notice = 'Add at least two waypoints before saving a completed route.';
      render();
      return;
    }
    const validation = voyageRouteSchema.safeParse(draftRoute);
    if (!validation.success) {
      notice = validation.error.issues[0]?.message ?? 'Route is invalid and was not saved.';
      render();
      return;
    }
    const completed = validation.data;
    const nextRoutes = draftOriginalRouteId
      ? routes.map((route) => route.id === draftOriginalRouteId ? completed : route)
      : [...routes, completed];
    const previousDraft = draftRoute;
    draftRoute = null;
    if (!persist(nextRoutes)) {
      draftRoute = previousDraft;
      render();
      renderMap();
      return;
    }
    activeRouteId = completed.id;
    draftOriginalRouteId = null;
    selectedWaypointId = completed.waypoints[0]?.id ?? null;
    notice = 'Route saved on this device. You can now assess NAVAREA warnings.';
    render();
    renderMap();
  }

  function cancelDraftRoute(): void {
    if (!draftRoute) return;
    const originalId = draftOriginalRouteId;
    draftRoute = null;
    draftOriginalRouteId = null;
    activeRouteId = originalId ?? routes[0]?.id ?? null;
    selectedWaypointId = activeRoute()?.waypoints[0]?.id ?? null;
    pendingInsertion = null;
    setAddMode(false);
    notice = 'Draft cancelled. Saved routes were not changed.';
    render();
    renderMap();
  }

  function finishPlacement(): void {
    if (!draftRoute || !addMode) return;
    pendingInsertion = null;
    setAddMode(false);
    notice = draftRoute.waypoints.length < 2
      ? 'Placement finished. Add at least two waypoints before saving the route.'
      : 'Placement finished. Review the waypoint list, then save the route.';
    render();
    renderMap();
    content.querySelector<HTMLButtonElement>('[data-action="select-waypoint"]')?.focus();
  }

  function undoLastDraftWaypoint(): void {
    if (!draftRoute || draftRoute.waypoints.length === 0) return;
    const lastWaypoint = draftRoute.waypoints[draftRoute.waypoints.length - 1];
    const result = removeWaypoint(draftRoute, lastWaypoint.id, context);
    if ('error' in result) {
      notice = 'Could not undo waypoint: ' + result.error;
      render();
      return;
    }
    draftRoute = result.value;
    selectedWaypointId = draftRoute.waypoints[draftRoute.waypoints.length - 1]?.id ?? null;
    notice = 'Last waypoint removed from the draft.';
    render();
    renderMap();
  }

  function createNewRoute(): void {
    if (storageBlocked) return;
    if (draftRoute) {
      notice = 'Save or cancel the current draft before creating another route.';
      render();
      return;
    }
    const result = createRoute('New voyage', 10, context, DEFAULT_WARNING_RANGE_NM);
    if ('error' in result) {
      notice = 'Could not create route: ' + result.error;
      render();
      return;
    }
    draftRoute = result.value;
    draftOriginalRouteId = null;
    activeRouteId = result.value.id;
    selectedWaypointId = null;
    notice = 'New route draft. Tap or click the chart to place waypoints.';
    setAddMode(true);
    render();
    renderMap();
  }

  function setAddMode(enabled: boolean): void {
    addMode = enabled;
    document.body.classList.toggle('voyage-add-mode', enabled);
    const button = content?.querySelector<HTMLButtonElement>('[data-action="toggle-add-mode"]');
    if (button) {
      button.setAttribute('aria-pressed', String(enabled));
      button.textContent = enabled ? 'Click chart to place waypoint…' : 'Add waypoint on chart';
    }
  }

  function setPanelOpen(open: boolean): void {
    panel.hidden = !open;
    panel.setAttribute('aria-hidden', String(!open));
    if (open) {
      panel.classList.remove('is-collapsed');
      collapseButton?.setAttribute('aria-expanded', 'true');
    }
    workspace.classList.toggle('is-voyage-planner', open);
    toggleButton.setAttribute('aria-pressed', String(open));
    toggleButton.setAttribute('aria-label', open ? 'Close Voyage Planner' : 'Open Voyage Planner');
    document.body.classList.toggle('voyage-planner-open', open);
    if (!open) {
      pendingInsertion = null;
      setAddMode(false);
      toggleButton.focus();
      if (map && routeLayer && map.hasLayer(routeLayer)) map.removeLayer(routeLayer);
      if (map && warningHighlightLayer && map.hasLayer(warningHighlightLayer)) map.removeLayer(warningHighlightLayer);
      warningHighlightLayer?.clearLayers();
    } else {
      render();
      renderMap();
      panel.querySelector<HTMLElement>('h2')?.focus();
    }
    map?.invalidateSize({ pan: false });
  }

  function render(): void {
    const route = activeRoute();
    const noticeMarkup = notice
      ? '<div class="voyage-planner-notice' + (storageBlocked ? ' is-error' : '') + '" role="' + (storageBlocked ? 'alert' : 'status') + '">' + escapeHtml(notice) + '</div>'
      : '';

    if (!route) {
      content.innerHTML = noticeMarkup + (storageBlocked
        ? '<p class="voyage-planner-disclaimer">The stored route data has not been changed. Resolve the storage issue before creating a route.</p>'
        : '<section class="voyage-planner-section"><strong>No saved routes</strong><p class="voyage-planner-disclaimer">Create a local route to begin adding waypoints.</p><button class="voyage-planner-btn is-primary" type="button" data-action="create-route">Create route</button></section>');
      return;
    }

    if (!selectedWaypointId || !route.waypoints.some((waypoint) => waypoint.id === selectedWaypointId)) {
      selectedWaypointId = route.waypoints[0]?.id ?? null;
    }

    const calculation = calculateRoute(route);
    const duplicateWaypoints = route.waypoints.filter((waypoint, index) => route.waypoints.some((other, otherIndex) =>
      otherIndex < index && other.position.lat === waypoint.position.lat && other.position.lon === waypoint.position.lon,
    ));
    const routeValidation = route.waypoints.length < 2
      ? '<div class="voyage-planner-notice is-warning">Add at least two waypoints before assessing this route.</div>'
      : duplicateWaypoints.length
        ? '<div class="voyage-planner-notice is-warning">' + duplicateWaypoints.length + ' waypoint(s) share coordinates with an earlier waypoint. Review zero-length legs.</div>'
        : '<div class="voyage-planner-notice">Route structure checks passed. This does not establish navigational safety.</div>';
    const selector = routes.length > 1
      ? '<div class="voyage-planner-field is-wide"><label for="voyageRouteSelect">Saved route</label><select id="voyageRouteSelect" data-action="select-route">' +
        routes.map((item) => '<option value="' + escapeHtml(item.id) + '"' + (item.id === route.id ? ' selected' : '') + '>' + escapeHtml(item.name) + '</option>').join('') +
        '</select></div>'
      : '';

    const waypointRows = route.waypoints.map((waypoint, index) => {
      const leg = calculation.legs[index - 1];
      const coordinates = formatLatitude(waypoint.position.lat) + ' · ' + formatLongitude(waypoint.position.lon);
      const meta = index === 0
        ? coordinates
        : leg && leg.distanceNm !== null
          ? coordinates + ' · ' + leg.distanceNm.toFixed(1) + ' NM · ' + displayCourse(leg.courseDeg)
          : coordinates + ' · ' + (leg?.status ?? 'Leg pending');
      return '<div class="voyage-waypoint-row' + (waypoint.id === selectedWaypointId ? ' is-selected' : '') + '">' +
        '<button type="button" class="voyage-waypoint-select" data-action="select-waypoint" data-id="' + escapeHtml(waypoint.id) + '">' +
        '<span class="voyage-waypoint-name">' + (index + 1) + '. ' + escapeHtml(waypoint.name) + '</span>' +
        '<span class="voyage-waypoint-meta">' + escapeHtml(meta) + '</span></button>' +
        '<div class="voyage-waypoint-controls">' +
        '<button type="button" data-action="move-up" data-index="' + index + '" aria-label="Move ' + escapeHtml(waypoint.name) + ' up"' + (index === 0 || storageBlocked || !draftRoute ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" data-action="move-down" data-index="' + index + '" aria-label="Move ' + escapeHtml(waypoint.name) + ' down"' + (index === route.waypoints.length - 1 || storageBlocked || !draftRoute ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" data-action="remove-waypoint" data-id="' + escapeHtml(waypoint.id) + '" aria-label="Remove ' + escapeHtml(waypoint.name) + '"' + (storageBlocked || !draftRoute ? ' disabled' : '') + '>×</button>' +
        '</div></div>';
    }).join('');

    const selected = route.waypoints.find((waypoint) => waypoint.id === selectedWaypointId) ?? null;
    const selectedLatitude = selected ? coordinateFormat === 'decimal' ? selected.position.lat.toFixed(6) : formatLatitude(selected.position.lat) : '';
    const selectedLongitude = selected ? coordinateFormat === 'decimal' ? selected.position.lon.toFixed(6) : formatLongitude(selected.position.lon) : '';
    const selectedForm = selected
      ? '<form class="voyage-planner-section" data-form="waypoint">' +
        '<div class="voyage-planner-section-title"><strong>Edit waypoint</strong></div>' +
        '<div class="voyage-planner-field"><label for="voyageCoordinateFormat">Coordinate format</label><select id="voyageCoordinateFormat" data-action="coordinate-format"><option value="dmd"' + (coordinateFormat === 'dmd' ? ' selected' : '') + '>Degrees / decimal minutes</option><option value="decimal"' + (coordinateFormat === 'decimal' ? ' selected' : '') + '>Decimal degrees</option></select></div>' +
        '<div class="voyage-planner-fields">' +
        '<div class="voyage-planner-field is-wide"><label for="voyageWaypointName">Waypoint name</label><input id="voyageWaypointName" name="name" maxlength="40" required value="' + escapeHtml(selected.name) + '"' + (storageBlocked || !draftRoute ? ' disabled' : '') + '></div>' +
        '<div class="voyage-planner-field"><label for="voyageWaypointLat">Latitude</label><input id="voyageWaypointLat" name="latitude" inputmode="' + (coordinateFormat === 'decimal' ? 'decimal' : 'text') + '" autocomplete="off" required value="' + escapeHtml(selectedLatitude) + '"' + (storageBlocked || !draftRoute ? ' disabled' : '') + '></div>' +
        '<div class="voyage-planner-field"><label for="voyageWaypointLon">Longitude</label><input id="voyageWaypointLon" name="longitude" inputmode="' + (coordinateFormat === 'decimal' ? 'decimal' : 'text') + '" autocomplete="off" required value="' + escapeHtml(selectedLongitude) + '"' + (storageBlocked || !draftRoute ? ' disabled' : '') + '></div>' +
        '</div><button class="voyage-planner-btn is-primary" type="submit"' + (storageBlocked || !draftRoute ? ' disabled' : '') + '>Update waypoint</button></form>'
      : '<p class="voyage-planner-disclaimer">Add a waypoint from the chart to start the route.</p>';

    content.innerHTML = noticeMarkup +
      '<section class="voyage-planner-section"><div class="voyage-planner-section-title"><strong>Route' + (draftRoute ? ' · Draft' : '') + '</strong><button class="voyage-planner-btn" type="button" data-action="create-route"' + (storageBlocked || draftRoute ? ' disabled' : '') + '>New route</button></div>' +
      (draftRoute ? '' : '<div class="voyage-planner-actions"><button class="voyage-planner-btn is-primary" type="button" data-action="edit-route"' + (storageBlocked ? ' disabled' : '') + '>Edit saved route</button></div>') +
      '<form data-form="route-settings"><div class="voyage-planner-fields">' + (draftRoute ? '' : selector) +
      '<div class="voyage-planner-field is-wide"><label for="voyageRouteName">Route name</label><input id="voyageRouteName" name="name" maxlength="80" required value="' + escapeHtml(route.name) + '"' + (storageBlocked || !draftRoute ? ' disabled' : '') + '></div>' +
      '<div class="voyage-planner-field"><label for="voyageWarningRange">Warning search distance (NM)</label><input id="voyageWarningRange" name="warningRangeNm" type="number" min="1" max="100" step="1" required value="' + route.warningRangeNm + '"' + (storageBlocked || !draftRoute ? ' disabled' : '') + '></div>' +
      '</div><div class="voyage-planner-actions"><button class="voyage-planner-btn" type="submit"' + (storageBlocked || !draftRoute ? ' disabled' : '') + '>Update draft settings</button></div></form>' +
      (draftRoute ? '<div class="voyage-planner-actions"><button class="voyage-planner-btn is-primary" type="button" data-action="save-route"' + (storageBlocked || addMode ? ' disabled' : '') + '>Save completed route</button><button class="voyage-planner-btn" type="button" data-action="cancel-draft">Cancel draft</button></div>' : '') +
      '<div class="voyage-planner-actions voyage-route-management">' +
      '<button class="voyage-planner-btn" type="button" data-action="duplicate-route"' + (storageBlocked || draftRoute ? ' disabled' : '') + '>Duplicate route</button>' +
      '<button class="voyage-planner-btn is-danger" type="button" data-action="delete-route"' + (storageBlocked || draftRoute ? ' disabled' : '') + '>Delete route</button>' +
      '<button class="voyage-planner-btn" type="button" data-action="undo"' + (!undoHistory.length || storageBlocked || draftRoute ? ' disabled' : '') + '>Undo</button>' +
      '<button class="voyage-planner-btn" type="button" data-action="redo"' + (!redoHistory.length || storageBlocked || draftRoute ? ' disabled' : '') + '>Redo</button></div></section>' +
      '<section class="voyage-planner-summary"><div class="voyage-planner-stat"><span>' + (calculation.status === 'incomplete' ? 'Calculated distance (partial)' : 'Total distance') + '</span><strong>' + calculation.totalDistanceNm.toFixed(1) + ' NM</strong></div>' +
      '<div class="voyage-planner-stat"><span>Waypoints</span><strong>' + route.waypoints.length + '</strong></div></section>' +
      routeValidation +
      (routes.length > 1 ? '<details class="voyage-route-comparison"><summary>Compare saved routes (' + routes.length + ')</summary><div class="voyage-route-comparison-list">' +
        routes.map((item) => {
          const otherCalculation = calculateRoute(item);
          const otherAssessment = warningSnapshot?.available ? assessRouteWarnings(item, warningSnapshot.warnings) : null;
          const warningCount = otherAssessment
            ? otherAssessment.intersectsCount + ' intersecting · ' + otherAssessment.withinRangeCount + ' nearby · ' + otherAssessment.notAssessedCount + ' unassessed'
            : 'Not assessed';
          return '<button type="button" class="voyage-route-comparison-row' + (item.id === route.id ? ' is-current' : '') + '" data-action="select-comparison-route" data-id="' + escapeHtml(item.id) + '"><strong>' + escapeHtml(item.name) + (item.id === route.id ? ' · Current' : '') + '</strong><span>' + otherCalculation.totalDistanceNm.toFixed(1) + ' NM · ' + item.waypoints.length + ' waypoints</span><span>' + escapeHtml(warningCount) + '</span></button>';
        }).join('') + '</div></details>' : '') +
      '<section class="voyage-planner-section"><div class="voyage-planner-section-title"><strong>Export route</strong><span>Local files only</span></div>' +
      '<div class="voyage-planner-actions voyage-export-actions">' +
      '<button class="voyage-planner-btn" type="button" data-action="export-geojson">GeoJSON</button>' +
      '<button class="voyage-planner-btn" type="button" data-action="export-gpx">GPX</button>' +
      '<button class="voyage-planner-btn" type="button" data-action="export-csv">CSV</button>' +
      '<button class="voyage-planner-btn" type="button" data-action="choose-import"' + (storageBlocked || draftRoute ? ' disabled' : '') + '>Import GPX / GeoJSON</button>' +
      '<button class="voyage-planner-btn" type="button" data-action="print-report"' + (draftRoute ? ' disabled' : '') + '>Print / PDF report</button></div>' +
      '<input type="file" accept=".gpx,.geojson,.json,application/gpx+xml,application/geo+json,application/json" data-action="import-file" hidden>' +
      '<p class="voyage-planner-disclaimer">Files are processed locally in this browser. PDF is generated through the browser print dialog.</p></section>' +
      (draftRoute
        ? '<section class="voyage-planner-section voyage-planner-notice is-warning"><strong>Assessment unavailable</strong><p class="voyage-planner-disclaimer">Save this route before running NAVAREA warning assessment. Any previous assessment belongs to the saved route.</p></section>'
        : renderWarningAssessment(route)) +
      (calculation.status === 'incomplete' ? '<div class="voyage-planner-notice">One or more route legs cannot be calculated. Review the affected waypoint coordinates.</div>' : '') +
      (pendingInsertion ? '<section class="voyage-planner-section voyage-insert-prompt"><strong>Insert waypoint on leg ' + (pendingInsertion.afterIndex + 1) + '</strong><span class="voyage-planner-disclaimer">Confirm to add a waypoint at the selected point on the chart.</span><div class="voyage-planner-actions"><button class="voyage-planner-btn is-primary" type="button" data-action="confirm-insert">Insert waypoint</button><button class="voyage-planner-btn" type="button" data-action="cancel-insert">Cancel</button></div></section>' : '') +
      '<section class="voyage-planner-section"><div class="voyage-planner-section-title"><strong>Waypoints (' + route.waypoints.length + ')</strong></div>' +
      (draftRoute ? '<div class="voyage-planner-actions voyage-placement-controls" role="group" aria-label="Waypoint placement controls">' +
        '<button class="voyage-planner-btn" type="button" data-action="undo-last-waypoint"' + (storageBlocked || route.waypoints.length === 0 ? ' disabled' : '') + '>Undo last</button>' +
        (addMode
          ? '<button class="voyage-planner-btn is-primary" type="button" data-action="finish-placement">Finish</button>'
          : '<button class="voyage-planner-btn is-primary" type="button" data-action="resume-placement">Add more waypoints</button>') +
        '<button class="voyage-planner-btn is-danger" type="button" data-action="cancel-draft">Cancel</button></div>' : '') +
      '<div class="voyage-waypoint-list">' + (waypointRows || '<p class="voyage-planner-disclaimer">No waypoints yet. Choose Add waypoint on chart, then click the chart.</p>') + '</div></section>' +
      (selectedForm ? selectedForm : '') +
      '<p class="voyage-planner-disclaimer">Decision-support aid only; not certified ECDIS. Rhumb-line distances and true courses are approximate. Verify the passage plan against approved charts and publications.</p>';
  }

  function buildRhumbPath(from: { lat: number; lon: number }, to: { lat: number; lon: number }, startLongitude: number, endLongitude: number, distanceNm: number): [number, number][] {
    const radians = Math.PI / 180;
    const psi1 = Math.asinh(Math.tan(from.lat * radians));
    const psi2 = Math.asinh(Math.tan(to.lat * radians));
    const sampleCount = Math.max(1, Math.min(500, Math.ceil(distanceNm / 5)));
    const points: [number, number][] = [];
    for (let step = 0; step <= sampleCount; step += 1) {
      const fraction = step / sampleCount;
      const psi = psi1 + (psi2 - psi1) * fraction;
      const latitude = Math.atan(Math.sinh(psi)) / radians;
      const longitude = startLongitude + (endLongitude - startLongitude) * fraction;
      points.push([latitude, longitude]);
    }
    return points;
  }

  function nearestLongitude(longitude: number, reference: number): number {
    let result = longitude;
    while (result - reference > 180) result -= 360;
    while (result - reference < -180) result += 360;
    return result;
  }

  function renderMap(): void {
    if (!map || !panel || panel.hidden || !window.L) return;
    const L = window.L;
    if (!routeLayer) routeLayer = L.layerGroup();
    routeLayer.clearLayers();
    if (!map.hasLayer(routeLayer)) routeLayer.addTo(map);

    const route = activeRoute();
    if (!route) return;
    const calculation = calculateRoute(route);
    const chartLongitudes: number[] = [];
    route.waypoints.forEach((waypoint, index) => {
      const longitude = wrapLongitudeForChart(waypoint.position.lon);
      chartLongitudes[index] = index === 0 ? longitude : nearestLongitude(longitude, chartLongitudes[index - 1]);
    });

    route.waypoints.forEach((waypoint, index) => {
      if (index > 0 && calculation.legs[index - 1]?.status === 'ok') {
        const previous = route.waypoints[index - 1];
        const legDistance = calculation.legs[index - 1].distanceNm ?? 0;
        const legPath = buildRhumbPath(previous.position, waypoint.position, chartLongitudes[index - 1], chartLongitudes[index], legDistance);
        L.polyline(legPath, { color: '#2F6B4F', weight: 4, opacity: 0.92, lineCap: 'round', interactive: false }).addTo(routeLayer!);
        L.polyline(legPath, { color: '#000', weight: 20, opacity: 0.01, lineCap: 'round', bubblingMouseEvents: false })
          .addTo(routeLayer!).on('click', (event: import('leaflet').LeafletMouseEvent) => {
          if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
          const current = activeRoute();
          if (!current || current.id !== route.id || storageBlocked || !draftRoute) return;
          pendingInsertion = { position: { lat: event.latlng.lat, lon: event.latlng.lng }, afterIndex: index - 1 };
          render();
        });
      }

      const marker = L.marker([waypoint.position.lat, chartLongitudes[index]], {
        draggable: !storageBlocked && Boolean(draftRoute),
        icon: L.divIcon({
          className: 'voyage-waypoint-marker' + (selectedWaypointId === waypoint.id ? ' is-selected' : ''),
          html: '<span>' + (index + 1) + '</span>',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        title: waypoint.name,
      }).addTo(routeLayer!);

      marker.on('click', (event: import('leaflet').LeafletMouseEvent) => {
        if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
        selectedWaypointId = waypoint.id;
        render();
        renderMap();
      });
      marker.on('dragend', (event: import('leaflet').LeafletEvent) => {
        const dragged = event.target as import('leaflet').Marker;
        const position = dragged.getLatLng();
        const current = activeRoute();
        if (!current || current.id !== route.id) return;
        const result = updateWaypoint(current, waypoint.id, {
          position: { lat: position.lat, lon: wrapLongitudeForChart(position.lng) },
        }, context);
        if ('error' in result) {
          notice = 'Waypoint move was rejected: ' + result.error;
          render();
          renderMap();
          return;
        }
        if (!updateActiveRoute(result.value)) renderMap();
      });
    });
  }

  function addWaypointAt(position: { lat: number; lon: number }, insertAfterIndex?: number): void {
    position = { lat: position.lat, lon: wrapLongitudeForChart(position.lon) };
    const route = activeRoute();
    if (!route || storageBlocked) return;
    const added = addWaypoint(route, {
      name: 'WP ' + String(route.waypoints.length + 1),
      position,
    }, context);
    if ('error' in added) {
      notice = 'Could not add waypoint: ' + added.error;
      render();
      return;
    }
    let nextRoute = added.value;
    if (insertAfterIndex !== undefined) {
      const reordered = reorderWaypoint(nextRoute, nextRoute.waypoints.length - 1, insertAfterIndex + 1, context);
      if ('error' in reordered) {
        notice = 'Waypoint was added, but could not be inserted at that leg.';
        render();
        return;
      }
      nextRoute = reordered.value;
    }
    const insertedIndex = insertAfterIndex === undefined ? nextRoute.waypoints.length - 1 : insertAfterIndex + 1;
    selectedWaypointId = nextRoute.waypoints[insertedIndex]?.id ?? null;
    commitRouteChange(nextRoute);
  }

  function onMapClick(event: import('leaflet').LeafletMouseEvent): void {
    if (!addMode || !draftRoute) return;
    addWaypointAt({ lat: event.latlng.lat, lon: event.latlng.lng });
  }

  function attachMap(): void {
    const candidate = window.hwMap;
    if (!candidate || !window.L || map === candidate) return;
    map = candidate;
    map.on('click', onMapClick);
    if (!routeLayer) routeLayer = window.L.layerGroup();
    renderMap();
  }

  function handleClick(event: MouseEvent): void {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-action]') : null;
    if (!target) return;
    const action = target.dataset.action;
    const route = activeRoute();

    if (action === 'create-route') {
      createNewRoute();
    } else if (route && action === 'export-geojson') {
      downloadRouteExport(route, 'geojson');
    } else if (route && action === 'export-gpx') {
      downloadRouteExport(route, 'gpx');
    } else if (route && action === 'export-csv') {
      downloadRouteExport(route, 'csv');
    } else if (route && action === 'print-report') {
      printRouteReport(route);
    } else if (action === 'choose-import') {
      content.querySelector<HTMLInputElement>('[data-action="import-file"]')?.click();
    } else if (action === 'edit-route') {
      beginRouteEdit();
    } else if (action === 'save-route') {
      saveDraftRoute();
    } else if (action === 'cancel-draft') {
      cancelDraftRoute();
    } else if (action === 'finish-placement') {
      finishPlacement();
    } else if (action === 'undo-last-waypoint') {
      undoLastDraftWaypoint();
    } else if (action === 'resume-placement') {
      if (storageBlocked || !draftRoute) return;
      pendingInsertion = null;
      setAddMode(true);
      notice = 'Tap or click the chart to add more waypoints.';
      render();
    } else if (action === 'toggle-add-mode') {
      if (storageBlocked || !draftRoute) return;
      setAddMode(!addMode);
    } else if (action === 'duplicate-route' && route) {
      if (storageBlocked || draftRoute) return;
      const now = context.now();
      const copy = voyageRouteSchema.safeParse({
        ...route,
        id: context.idFactory(),
        name: (route.name + ' copy').slice(0, 80),
        waypoints: route.waypoints.map((waypoint) => ({ ...waypoint, id: context.idFactory() })),
        createdAt: now,
        updatedAt: now,
      });
      if (!copy.success) { notice = 'Could not duplicate this route.'; render(); return; }
      if (persist([...routes, copy.data])) { activeRouteId = copy.data.id; selectedWaypointId = copy.data.waypoints[0]?.id ?? null; render(); renderMap(); }
    } else if (action === 'delete-route' && route) {
      if (storageBlocked || draftRoute || !window.confirm('Delete the route "' + route.name + '"? This can be recovered with Undo.')) return;
      const removed = deleteRoute(routes, route.id);
      if (!removed.ok) { notice = 'Could not delete this route.'; render(); return; }
      if (persist(removed.value)) { activeRouteId = removed.value[0]?.id ?? null; selectedWaypointId = activeRoute()?.waypoints[0]?.id ?? null; render(); renderMap(); }
    } else if (action === 'undo') {
      if (!draftRoute) applyHistory(undoHistory, redoHistory, 'Undo');
    } else if (action === 'redo') {
      if (!draftRoute) applyHistory(redoHistory, undoHistory, 'Redo');
    } else if (action === 'confirm-insert' && pendingInsertion) {
      const insertion = pendingInsertion; pendingInsertion = null;
      addWaypointAt(insertion.position, insertion.afterIndex);
      render();
    } else if (action === 'cancel-insert') {
      pendingInsertion = null; render();
    } else if (action === 'locate-warning' && target.dataset.warningId) {
      locateWarning(target.dataset.warningId);
    } else if (action === 'select-comparison-route' && target.dataset.id) {
      if (draftRoute) return;
      activeRouteId = target.dataset.id;
      selectedWaypointId = activeRoute()?.waypoints[0]?.id ?? null;
      pendingInsertion = null;
      render(); renderMap();
    } else if (action === 'select-waypoint') {
      selectedWaypointId = target.dataset.id ?? null;
      pendingInsertion = null;
      render();
      renderMap();
    } else if ((action === 'move-up' || action === 'move-down') && route) {
      const from = Number(target.dataset.index);
      const to = from + (action === 'move-up' ? -1 : 1);
      const result = reorderWaypoint(route, from, to, context);
      if (!draftRoute) return;
      if ('error' in result) notice = 'Could not reorder waypoint: ' + result.error;
      else commitRouteChange(result.value);
    } else if (action === 'remove-waypoint' && route && target.dataset.id) {
      if (!draftRoute) return;
      const result = removeWaypoint(route, target.dataset.id, context);
      if ('error' in result) notice = 'Could not remove waypoint: ' + result.error;
      else {
        selectedWaypointId = result.value.waypoints[0]?.id ?? null;
        commitRouteChange(result.value);
      }
    }
  }

  function handleSubmit(event: SubmitEvent): void {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.dataset.form) return;
    event.preventDefault();
    if (storageBlocked) return;
    const data = new FormData(form);
    const route = activeRoute();

    if (form.dataset.form === 'create-route') {
      createNewRoute();
      return;
    }

    if (form.dataset.form === 'route-settings' && route && draftRoute) {
      const renamed = renameRoute(route, String(data.get('name') ?? ''), context);
      if ('error' in renamed) {
        notice = 'Route name is invalid.';
        render();
        return;
      }
      const next = {
        ...renamed.value,
        defaultSpeedKn: route.defaultSpeedKn,
        warningRangeNm: Number(data.get('warningRangeNm')),
        departureTimeUtc: route.departureTimeUtc,
      };
      const validation = voyageRouteSchema.safeParse(next);
      if (!validation.success) {
        notice = validation.error.issues[0]?.message ?? 'Route settings are invalid.';
        render();
        return;
      }
      commitRouteChange(validation.data);
      return;
    }

    if (form.dataset.form === 'waypoint' && route && draftRoute && selectedWaypointId) {
      const parsed = parseCoordinates(String(data.get('latitude') ?? ''), String(data.get('longitude') ?? ''));
      if ('error' in parsed) {
        notice = parsed.error;
        render();
        return;
      }
      const changes: Partial<Omit<Waypoint, 'id'>> = {
        name: String(data.get('name') ?? ''),
        position: parsed.value,
      };
      const updated = updateWaypoint(route, selectedWaypointId, changes, context);
      if ('error' in updated) {
        notice = 'Waypoint update rejected: ' + updated.error;
        render();
        return;
      }
      commitRouteChange(updated.value);
    }
  }

  content.addEventListener('click', handleClick);
  content.addEventListener('submit', handleSubmit);
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (panel.hidden || !draftRoute) return;
    const target = event.target;
    const editingText = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
    if (editingText || event.altKey) return;
    if (event.key === 'Escape' && addMode) {
      event.preventDefault();
      finishPlacement();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undoLastDraftWaypoint();
      return;
    }
    if (event.key === 'Enter' && addMode) {
      event.preventDefault();
      finishPlacement();
    }
  });
  content.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.dataset.action === 'coordinate-format') {
      coordinateFormat = target.value === 'decimal' ? 'decimal' : 'dmd';
      render();
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.action === 'import-file') {
      const file = target.files?.[0];
      target.value = '';
      if (file) importRouteFile(file);
      return;
    }
    if (target instanceof HTMLSelectElement && target.dataset.action === 'select-route') {
      if (draftRoute) return;
      activeRouteId = target.value;
      selectedWaypointId = activeRoute()?.waypoints[0]?.id ?? null;
      pendingInsertion = null;
      render();
      renderMap();
    }
  });

  toggleButton.addEventListener('click', () => setPanelOpen(panel.hidden));
  closeButton?.addEventListener('click', () => setPanelOpen(false));
  collapseButton?.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('is-collapsed');
    const label = collapsed ? 'Expand route sheet' : 'Collapse route sheet';
    collapseButton.setAttribute('aria-expanded', String(!collapsed));
    collapseButton.setAttribute('aria-label', label);
    collapseButton.setAttribute('title', label);
    collapseButton.textContent = collapsed ? '⌃' : '⌄';
  });

  window.addEventListener('helm:public-warning-data-updated', (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (!detail || !Array.isArray(detail.warnings)) return;
    warningSnapshot = {
      warnings: detail.warnings,
      available: detail.available === true,
      cached: detail.cached === true,
      textIncomplete: detail.textIncomplete === true,
      savedAt: typeof detail.savedAt === 'string' ? detail.savedAt : null,
    };
    render();
  });

  const initialWarningSnapshot = window.getPublicWarningSnapshot?.();
  if (initialWarningSnapshot && Array.isArray(initialWarningSnapshot.warnings)) {
    warningSnapshot = initialWarningSnapshot;
  }

  window.addEventListener('helm:map-ready', attachMap);
  if (window.hwMap) attachMap();
  render();
}

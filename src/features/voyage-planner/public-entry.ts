import {
  addWaypoint,
  calculateRoute,
  createRoute,
  formatLatitude,
  formatLongitude,
  loadRoutes,
  parseCoordinates,
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
  type Waypoint,
} from './index';

declare global {
  interface Window {
    hwMap?: import('leaflet').Map;
    L?: typeof import('leaflet');
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
  let selectedWaypointId: string | null = null;
  let map: import('leaflet').Map | null = null;
  let routeLayer: import('leaflet').LayerGroup | null = null;
  let addMode = false;

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
    return routes.find((route) => route.id === activeRouteId) ?? null;
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
    routes = nextRoutes;
    notice = 'Saved on this device';
    render();
    renderMap();
    return true;
  }

  function updateActiveRoute(nextRoute: VoyageRoute): boolean {
    return persist(routes.map((route) => route.id === nextRoute.id ? nextRoute : route));
  }

  function createNewRoute(): void {
    if (storageBlocked) return;
    const result = createRoute('New voyage', 10, context, DEFAULT_WARNING_RANGE_NM);
    if ('error' in result) {
      notice = 'Could not create route: ' + result.error;
      render();
      return;
    }
    if (persist([...routes, result.value])) {
      activeRouteId = result.value.id;
      selectedWaypointId = null;
      render();
      renderMap();
    }
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
      setAddMode(false);
      toggleButton.focus();
      if (map && routeLayer && map.hasLayer(routeLayer)) map.removeLayer(routeLayer);
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
    const selector = routes.length > 1
      ? '<div class="voyage-planner-field is-wide"><label for="voyageRouteSelect">Saved route</label><select id="voyageRouteSelect" data-action="select-route">' +
        routes.map((item) => '<option value="' + escapeHtml(item.id) + '"' + (item.id === route.id ? ' selected' : '') + '>' + escapeHtml(item.name) + '</option>').join('') +
        '</select></div>'
      : '';

    const waypointRows = route.waypoints.map((waypoint, index) => {
      const leg = calculation.legs[index - 1];
      const meta = index === 0
        ? formatLatitude(waypoint.position.lat) + ' · ' + formatLongitude(waypoint.position.lon)
        : leg && leg.distanceNm !== null
          ? leg.distanceNm.toFixed(1) + ' NM · ' + displayCourse(leg.courseDeg) + ' · ' + (leg.speedKn?.toFixed(1) ?? '—') + ' kn · ETA ' + (leg.etaUtc ? displayUtc(leg.etaUtc) : '—')
          : (leg?.status ?? 'Leg pending');
      return '<div class="voyage-waypoint-row' + (waypoint.id === selectedWaypointId ? ' is-selected' : '') + '">' +
        '<button type="button" class="voyage-waypoint-select" data-action="select-waypoint" data-id="' + escapeHtml(waypoint.id) + '">' +
        '<span class="voyage-waypoint-name">' + (index + 1) + '. ' + escapeHtml(waypoint.name) + '</span>' +
        '<span class="voyage-waypoint-meta">' + escapeHtml(meta) + '</span></button>' +
        '<div class="voyage-waypoint-controls">' +
        '<button type="button" data-action="move-up" data-index="' + index + '" aria-label="Move ' + escapeHtml(waypoint.name) + ' up"' + (index === 0 || storageBlocked ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" data-action="move-down" data-index="' + index + '" aria-label="Move ' + escapeHtml(waypoint.name) + ' down"' + (index === route.waypoints.length - 1 || storageBlocked ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" data-action="remove-waypoint" data-id="' + escapeHtml(waypoint.id) + '" aria-label="Remove ' + escapeHtml(waypoint.name) + '"' + (storageBlocked ? ' disabled' : '') + '>×</button>' +
        '</div></div>';
    }).join('');

    const selected = route.waypoints.find((waypoint) => waypoint.id === selectedWaypointId) ?? null;
    const selectedForm = selected
      ? '<form class="voyage-planner-section" data-form="waypoint">' +
        '<div class="voyage-planner-section-title"><strong>Edit waypoint</strong><span class="voyage-planner-disclaimer">DMD coordinates</span></div>' +
        '<div class="voyage-planner-fields">' +
        '<div class="voyage-planner-field is-wide"><label for="voyageWaypointName">Waypoint name</label><input id="voyageWaypointName" name="name" maxlength="40" required value="' + escapeHtml(selected.name) + '"' + (storageBlocked ? ' disabled' : '') + '></div>' +
        '<div class="voyage-planner-field"><label for="voyageWaypointLat">Latitude</label><input id="voyageWaypointLat" name="latitude" required value="' + escapeHtml(formatLatitude(selected.position.lat)) + '"' + (storageBlocked ? ' disabled' : '') + '></div>' +
        '<div class="voyage-planner-field"><label for="voyageWaypointLon">Longitude</label><input id="voyageWaypointLon" name="longitude" required value="' + escapeHtml(formatLongitude(selected.position.lon)) + '"' + (storageBlocked ? ' disabled' : '') + '></div>' +
        '<div class="voyage-planner-field is-wide"><label for="voyageWaypointSpeed">Inbound speed (kn, optional)</label><input id="voyageWaypointSpeed" name="speedKn" type="number" min="0.1" max="50" step="0.1" value="' + (selected.speedKn ?? '') + '"' + (storageBlocked ? ' disabled' : '') + '></div>' +
        '</div><button class="voyage-planner-btn is-primary" type="submit"' + (storageBlocked ? ' disabled' : '') + '>Save waypoint</button></form>'
      : '<p class="voyage-planner-disclaimer">Add a waypoint from the chart to start the route.</p>';

    content.innerHTML = noticeMarkup +
      '<section class="voyage-planner-section"><div class="voyage-planner-section-title"><strong>Route</strong><button class="voyage-planner-btn" type="button" data-action="create-route"' + (storageBlocked ? ' disabled' : '') + '>New route</button></div>' +
      '<form data-form="route-settings"><div class="voyage-planner-fields">' + selector +
      '<div class="voyage-planner-field is-wide"><label for="voyageRouteName">Route name</label><input id="voyageRouteName" name="name" maxlength="80" required value="' + escapeHtml(route.name) + '"' + (storageBlocked ? ' disabled' : '') + '></div>' +
      '<div class="voyage-planner-field"><label for="voyageDefaultSpeed">Default speed (kn)</label><input id="voyageDefaultSpeed" name="defaultSpeedKn" type="number" min="0.1" max="50" step="0.1" required value="' + route.defaultSpeedKn + '"' + (storageBlocked ? ' disabled' : '') + '></div>' +
      '<div class="voyage-planner-field"><label for="voyageWarningRange">Warning search distance (NM)</label><input id="voyageWarningRange" name="warningRangeNm" type="number" min="1" max="100" step="1" required value="' + route.warningRangeNm + '"' + (storageBlocked ? ' disabled' : '') + '></div>' +
      '<div class="voyage-planner-field is-wide"><label for="voyageDeparture">Departure (device local time)</label><input id="voyageDeparture" name="departureLocal" type="datetime-local" value="' + localDateTimeValue(route.departureTimeUtc) + '"' + (storageBlocked ? ' disabled' : '') + '></div>' +
      '</div><div class="voyage-planner-actions"><button class="voyage-planner-btn" type="submit"' + (storageBlocked ? ' disabled' : '') + '>Save route settings</button></div></form></section>' +
      '<section class="voyage-planner-summary"><div class="voyage-planner-stat"><span>Total distance</span><strong>' + calculation.totalDistanceNm.toFixed(1) + ' NM</strong></div>' +
      '<div class="voyage-planner-stat"><span>Estimated arrival (UTC)</span><strong style="font-size:11px">' + displayUtc(calculation.arrivalTimeUtc) + '</strong></div></section>' +
      (calculation.status === 'incomplete' ? '<div class="voyage-planner-notice">One or more legs cannot be calculated. Downstream ETAs are left unknown.</div>' : '') +
      '<section class="voyage-planner-section"><div class="voyage-planner-section-title"><strong>Waypoints (' + route.waypoints.length + ')</strong></div>' +
      '<div class="voyage-planner-actions"><button class="voyage-planner-btn is-primary" type="button" data-action="toggle-add-mode"' + (storageBlocked ? ' disabled' : '') + ' aria-pressed="' + addMode + '">' + (addMode ? 'Click chart to place waypoint…' : 'Add waypoint on chart') + '</button></div>' +
      '<div class="voyage-waypoint-list">' + (waypointRows || '<p class="voyage-planner-disclaimer">No waypoints yet. Choose Add waypoint on chart, then click the chart.</p>') + '</div></section>' +
      (selectedForm ? selectedForm : '') +
      '<p class="voyage-planner-disclaimer">Decision-support aid only; not certified ECDIS. Rhumb-line distances and true courses are approximate. Verify the passage plan against approved charts and publications. Warning assessment is not included in this phase.</p>';
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
        L.polyline(
          [[previous.position.lat, chartLongitudes[index - 1]], [waypoint.position.lat, chartLongitudes[index]]],
          { color: '#2F6B4F', weight: 3, opacity: 0.9, lineCap: 'round' },
        ).addTo(routeLayer!).on('click', (event: import('leaflet').LeafletMouseEvent) => {
          if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
          const current = activeRoute();
          if (!current || current.id !== route.id || storageBlocked) return;
          addWaypointAt({ lat: event.latlng.lat, lon: event.latlng.lng }, index - 1);
        });
      }

      const marker = L.marker([waypoint.position.lat, chartLongitudes[index]], {
        draggable: !storageBlocked,
        icon: L.divIcon({
          className: 'voyage-waypoint-marker',
          html: '<span>' + (index + 1) + '</span>',
          iconSize: [27, 27],
          iconAnchor: [13.5, 13.5],
        }),
        title: waypoint.name,
      }).addTo(routeLayer!);

      marker.on('click', () => {
        selectedWaypointId = waypoint.id;
        render();
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
        updateActiveRoute(result.value);
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
    persist(routes.map((item) => item.id === nextRoute.id ? nextRoute : item));
  }

  function onMapClick(event: import('leaflet').LeafletMouseEvent): void {
    if (!addMode) return;
    addWaypointAt({ lat: event.latlng.lat, lon: event.latlng.lng });
    setAddMode(false);
    render();
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
    } else if (action === 'toggle-add-mode') {
      if (storageBlocked) return;
      setAddMode(!addMode);
    } else if (action === 'select-waypoint') {
      selectedWaypointId = target.dataset.id ?? null;
      render();
      renderMap();
    } else if ((action === 'move-up' || action === 'move-down') && route) {
      const from = Number(target.dataset.index);
      const to = from + (action === 'move-up' ? -1 : 1);
      const result = reorderWaypoint(route, from, to, context);
      if ('error' in result) notice = 'Could not reorder waypoint: ' + result.error;
      else persist(routes.map((item) => item.id === route.id ? result.value : item));
    } else if (action === 'remove-waypoint' && route && target.dataset.id) {
      const result = removeWaypoint(route, target.dataset.id, context);
      if ('error' in result) notice = 'Could not remove waypoint: ' + result.error;
      else {
        selectedWaypointId = result.value.waypoints[0]?.id ?? null;
        persist(routes.map((item) => item.id === route.id ? result.value : item));
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

    if (form.dataset.form === 'route-settings' && route) {
      const renamed = renameRoute(route, String(data.get('name') ?? ''), context);
      if ('error' in renamed) {
        notice = 'Route name is invalid.';
        render();
        return;
      }
      const departureLocal = String(data.get('departureLocal') ?? '');
      let departureTimeUtc: string | undefined;
      if (departureLocal) {
        const date = new Date(departureLocal);
        if (!Number.isFinite(date.getTime())) {
          notice = 'Departure time is invalid.';
          render();
          return;
        }
        departureTimeUtc = date.toISOString().replace('.000Z', 'Z');
      }
      const next = {
        ...renamed.value,
        defaultSpeedKn: Number(data.get('defaultSpeedKn')),
        warningRangeNm: Number(data.get('warningRangeNm')),
        departureTimeUtc,
      };
      const validation = voyageRouteSchema.safeParse(next);
      if (!validation.success) {
        notice = validation.error.issues[0]?.message ?? 'Route settings are invalid.';
        render();
        return;
      }
      persist(routes.map((item) => item.id === route.id ? validation.data : item));
      return;
    }

    if (form.dataset.form === 'waypoint' && route && selectedWaypointId) {
      const parsed = parseCoordinates(String(data.get('latitude') ?? ''), String(data.get('longitude') ?? ''));
      if ('error' in parsed) {
        notice = parsed.error;
        render();
        return;
      }
      const speedValue = String(data.get('speedKn') ?? '');
      const changes: Partial<Omit<Waypoint, 'id'>> = {
        name: String(data.get('name') ?? ''),
        position: parsed.value,
        speedKn: speedValue === '' ? undefined : Number(speedValue),
      };
      const updated = updateWaypoint(route, selectedWaypointId, changes, context);
      if ('error' in updated) {
        notice = 'Waypoint update rejected: ' + updated.error;
        render();
        return;
      }
      persist(routes.map((item) => item.id === route.id ? updated.value : item));
    }
  }

  content.addEventListener('click', handleClick);
  content.addEventListener('submit', handleSubmit);
  content.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.dataset.action === 'select-route') {
      activeRouteId = target.value;
      selectedWaypointId = activeRoute()?.waypoints[0]?.id ?? null;
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

  window.addEventListener('helm:map-ready', attachMap);
  if (window.hwMap) attachMap();
  render();
}

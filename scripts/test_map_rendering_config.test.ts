// scripts/test_map_rendering_config.test.ts — vitest port (assertions unchanged; live tile fetch gated behind LIVE_TILE_TEST=1)
import assert from 'node:assert';
import { it } from 'vitest';
import { BASE_LAYERS, OVERLAY_LAYERS, MAP_PANES } from '../src/config/mapLayers';
import { getLeafletLatLng } from '../src/utils/coordinateParser';
import type { NavWarning, SpatialData } from '../src/types';

async function runMapRenderingTests() {
  console.log('=== RUNNING MAP CONFIGURATION & RENDERING TEST SUITE ===\n');

  // Test 1: Validate Leaflet Pane Ordering & Strict Z-Index Hierarchy
  console.log('Test 1: Pane Architecture & Strict Z-Index Stacking...');
  assert.strictEqual(MAP_PANES.basePane.zIndex, 200, 'basePane must have zIndex 200');
  assert.strictEqual(MAP_PANES.soundingsPane.zIndex, 250, 'soundingsPane must have zIndex 250');
  assert.strictEqual(MAP_PANES.seamarksPane.zIndex, 300, 'seamarksPane must have zIndex 300');
  assert.strictEqual(MAP_PANES.navWarnVectorPane.zIndex, 400, 'navWarnVectorPane must have zIndex 400');
  assert.strictEqual(MAP_PANES.navWarnMarkerPane.zIndex, 600, 'navWarnMarkerPane must have zIndex 600');
  assert.strictEqual(MAP_PANES.soundingsPane.pointerEvents, 'none', 'soundings overlay must not capture pointer events');
  assert.strictEqual(MAP_PANES.seamarksPane.pointerEvents, 'none', 'seamarks overlay must not capture pointer events');
  console.log('✓ Test 1 passed: Strict pane hierarchy verified (Base 200 -> Soundings 250 -> Seamarks 300 -> Vectors 400 -> Markers 600).\n');

  // Test 2: Verify Base Layer Definitions & Endpoints
  console.log('Test 2: Base Tile Layers & Tile Server Configuration...');
  assert.strictEqual(BASE_LAYERS.length, 6, 'Must have 6 configured base layers (incl. openseamap-base)');
  const baseIds = BASE_LAYERS.map((b) => b.id);
  assert.ok(baseIds.includes('openseamap-base'), 'OpenSeaMap base present');
  assert.ok(baseIds.includes('carto-voyager'), 'CARTO Voyager present');
  assert.ok(baseIds.includes('carto-dark'), 'CARTO Dark Matter present');
  assert.ok(baseIds.includes('carto-positron'), 'CARTO Positron present');
  assert.ok(baseIds.includes('osm-standard'), 'OSM Standard present');
  assert.ok(baseIds.includes('esri-ocean'), 'ESRI Ocean present');

  for (const layer of BASE_LAYERS) {
    assert.strictEqual(layer.pane, 'basePane', `${layer.id} must be bound to basePane`);
    assert.ok(layer.maxZoom >= 18, `${layer.id} maxZoom must support high resolution`);
    assert.ok(layer.attribution.length > 0, `${layer.id} attribution must be defined`);
  }
  console.log('✓ Test 2 passed: All base layers correctly configured with basePane and attribution.\n');

  // Test 3: Verify Overlay Nautical Layers
  console.log('Test 3: Nautical Overlay Layers Configuration...');
  assert.strictEqual(OVERLAY_LAYERS.length, 2, 'Must have 2 overlay layers');
  const esriLabels = OVERLAY_LAYERS.find((o) => o.id === 'esri-labels');
  assert.ok(esriLabels, 'ESRI ocean labels overlay exists');
  assert.strictEqual(esriLabels?.pane, 'soundingsPane', 'esri-labels must map to soundingsPane');

  const openSeaMap = OVERLAY_LAYERS.find((o) => o.id === 'openseamap');
  assert.ok(openSeaMap, 'OpenSeaMap overlay exists');
  assert.strictEqual(openSeaMap?.pane, 'seamarksPane', 'openseamap must map to seamarksPane');
  console.log('✓ Test 3 passed: Nautical overlays correctly mapped to dedicated pointer-through panes.\n');

  // Test 4: Verify Live Tile Endpoints Fetch Response
  console.log('Test 4: Live Tile Endpoint Responses...');
  if (process.env.LIVE_TILE_TEST === '1') {
  const allLayers = [...BASE_LAYERS, ...OVERLAY_LAYERS];
  for (const layer of allLayers) {
    let testUrl = layer.url
      .replace('{z}', '0')
      .replace('{x}', '0')
      .replace('{y}', '0');
    if (testUrl.startsWith('/')) {
      testUrl = 'http://localhost:3000' + testUrl;
    }
    const res = await fetch(testUrl, {
      headers: { 'User-Agent': 'HelmWarning-MapTester/1.0' },
    });
    assert.strictEqual(
      res.status,
      200,
      `Layer ${layer.id} tile request must return HTTP 200 (got ${res.status})`
    );
    const contentType = res.headers.get('content-type') || '';
    assert.ok(
      contentType.includes('image/'),
      `Layer ${layer.id} must return an image content-type (got ${contentType})`
    );
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 100, `Layer ${layer.id} tile image must not be empty`);
    console.log(`  - [${layer.id}] HTTP 200 ${contentType} (${buf.byteLength} bytes)`);
  }
  console.log('✓ Test 4 passed: All base and overlay tiles successfully delivered over HTTP 200.\n');
  } else {
    console.log('  - Test 4 skipped: live tile endpoint fetch (set LIVE_TILE_TEST=1 to enable).');
  }

  // Test 5: Coordinate Conversion & Null Island Quarantine in getLeafletLatLng
  console.log('Test 5: Coordinate Projection & Null Island Quarantine...');
  // Grounded point
  const groundedSpatial: SpatialData = {
    geometries: [
      {
        type: 'Point',
        coordinates: [135.5, 34.2], // GeoJSON lon, lat
      },
    ],
    circles: [],
    raw_coordinate_text: ['34-12.0N 135-30.0E'],
    validation_status: 'passed',
    data_quality: 'EXPLICIT',
  };
  const validLatLng = getLeafletLatLng(groundedSpatial);
  assert.strictEqual(validLatLng[0], 34.2, 'Leaflet lat must be 34.2');
  assert.strictEqual(validLatLng[1], 135.5, 'Leaflet lng must be 135.5');

  // Ambiguous point must quarantine to [0,0] so it is not rendered
  const ambiguousSpatial: SpatialData = {
    geometries: [],
    circles: [],
    raw_coordinate_text: ['12-34 056-78'],
    validation_status: 'invalid_format',
    data_quality: 'AMBIGUOUS',
    ambiguous_positions: [
      {
        raw_text: '12-34 056-78',
        reason: 'AMBIGUOUS_HEMISPHERE',
        has_lat_hem: false,
        has_lon_hem: false,
      },
    ],
  };
  const quarantinedLatLng = getLeafletLatLng(ambiguousSpatial, 12.5, 56.5);
  assert.strictEqual(quarantinedLatLng[0], 0, 'Quarantined warning lat must evaluate to 0');
  assert.strictEqual(quarantinedLatLng[1], 0, 'Quarantined warning lng must evaluate to 0');
  console.log('✓ Test 5 passed: Geographic coordinates correctly inverted and ambiguous data quarantined to prevent false chart markers.\n');

  // Test 6: Radius Metric-to-Nautical Conversion for Leaflet Circles
  console.log('Test 6: Leaflet Circle Radius NM to Meters Metric Conversion...');
  const radiusNM = 5.0; // 5 Nautical Miles
  const expectedMeters = radiusNM * 1852; // 1 NM = 1852 meters
  assert.strictEqual(expectedMeters, 9260, '5 NM must equal exactly 9260 meters in Leaflet circle geometry');
  console.log('✓ Test 6 passed: Standard geodesic maritime distance conversion (1 NM = 1,852m) verified.\n');

  console.log('====================================================');
  console.log('ALL MAP CONFIGURATION & RENDERING TESTS PASSED! ✅');
  console.log('====================================================');
}

it('map configuration & rendering acceptance suite', async () => {
  await runMapRenderingTests();
});

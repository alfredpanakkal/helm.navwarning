import assert from 'node:assert';
import { parseCoordinatesDeterministic, parseRadiusSpecification, parseSingleCoordinatePair } from '../src/utils/coordinateParser';
import { getNavareaPlugin, getAllNavareaPlugins } from '../src/schemas/plugins/registry';
import { verifyCoordinateGrounded, convertJhodToNavWarning, splitJhodTelexStream } from '../src/schemas/jhodAiContract';
import { JHOD_19_NOTICES_CORPUS } from '../src/components/ManualParserView';

console.log('=== RUNNING P0 SAFETY & REGRESSION TEST SUITE ===\n');

// -------------------------------------------------------------
// Test 1: Full-absent hemisphere triggers quarantine (P0 Policy)
// -------------------------------------------------------------
console.log('Test 1: Full-absent hemisphere coordinates...');
const missingHemiText = `NO.26-0499 Date:2026/10/11 08 UTC
NORTH PACIFIC, MARIANAS.
DERELICT BARGE ADRIFT IN VICINITY OF
11-52 146-04 AT 110700Z OCT.
CANCEL THIS MSG 150800Z OCT.`;

const resMissing = parseCoordinatesDeterministic(missingHemiText, 'XI');
assert.strictEqual(resMissing.geometries.length, 0, 'Geometries array MUST be empty on missing hemisphere');
assert.strictEqual(resMissing.circles.length, 0, 'Circles array MUST be empty on missing hemisphere');
assert.strictEqual(resMissing.data_quality, 'AMBIGUOUS', 'Data quality must roll up to AMBIGUOUS');
assert.strictEqual(resMissing.hemisphere_status, 'AMBIGUOUS_HEMISPHERE');
assert.ok(resMissing.ambiguous_positions && resMissing.ambiguous_positions.length > 0, 'Must record ambiguous_positions');
assert.strictEqual(resMissing.ambiguous_positions[0].has_lat_hem, false, 'has_lat_hem must be false');
assert.strictEqual(resMissing.ambiguous_positions[0].has_lon_hem, false, 'has_lon_hem must be false');
assert.strictEqual(resMissing.ambiguous_positions[0].reason, 'AMBIGUOUS_HEMISPHERE');
console.log('✓ Test 1 passed: Missing hemisphere correctly quarantined with empty geometries & AMBIGUOUS quality.\n');

// -------------------------------------------------------------
// Test 2: Partial hemisphere triggers quarantine (P0 Policy)
// -------------------------------------------------------------
console.log('Test 2: Partial hemisphere coordinates (Lat present, Lon missing)...');
const partialHemiText = `NO.26-0498 Date:2026/10/11 08 UTC
NORTH PACIFIC, OKINOTORI SHIMA.
HATCH COVER ADRIFT IN
16-54.1N 134-39.5 AT 110730Z OCT.
CANCEL THIS MSG 150800Z OCT.`;

const resPartial = parseCoordinatesDeterministic(partialHemiText, 'XI');
assert.strictEqual(resPartial.geometries.length, 0, 'Geometries array MUST be empty on partial hemisphere');
assert.strictEqual(resPartial.data_quality, 'AMBIGUOUS', 'Data quality must roll up to AMBIGUOUS');
assert.ok(resPartial.ambiguous_positions && resPartial.ambiguous_positions.length > 0, 'Must record ambiguous_positions');
assert.strictEqual(resPartial.ambiguous_positions[0].has_lat_hem, true, 'has_lat_hem must be true');
assert.strictEqual(resPartial.ambiguous_positions[0].has_lon_hem, false, 'has_lon_hem must be false');
assert.strictEqual(resPartial.ambiguous_positions[0].reason, 'PARTIAL_HEMISPHERE');
console.log('✓ Test 2 passed: Partial hemisphere correctly quarantined with has_lat_hem=true, has_lon_hem=false.\n');

// -------------------------------------------------------------
// Test 3: Broadened Radius Regex & Unit Normalisation (Metres -> NM)
// -------------------------------------------------------------
console.log('Test 3: Broadened radius regex & metric normalisation...');
const radius500m = parseRadiusSpecification('UNEXPLODED ORDNANCE FOUND. WITHIN A RADIUS OF 500 METRES.');
assert.ok(radius500m, 'Must parse WITHIN A RADIUS OF 500 METRES');
assert.strictEqual(radius500m?.stated_value, 500);
assert.strictEqual(radius500m?.stated_unit, 'METRE');
assert.strictEqual(radius500m?.radius_nm, 0.27, '500m must convert to 0.270 NM');

const radiusPoint6Mi = parseRadiusSpecification('DRILLING RIG. WITHIN 0.6 MILES KEEP CLEAR.');
assert.ok(radiusPoint6Mi, 'Must parse WITHIN 0.6 MILES');
assert.strictEqual(radiusPoint6Mi?.stated_value, 0.6);
assert.strictEqual(radiusPoint6Mi?.radius_nm, 0.6);

const radius500MNoOf = parseRadiusSpecification('DANGER AREA. RADIUS 500 METRES FROM BUOY.');
assert.ok(radius500MNoOf, 'Must parse RADIUS 500 METRES');
assert.strictEqual(radius500MNoOf?.radius_nm, 0.27);

console.log('✓ Test 3 passed: All radius patterns and metric-to-NM conversions validated.\n');

// -------------------------------------------------------------
// Test 4: Plugin Architecture & Registry Resolution
// -------------------------------------------------------------
console.log('Test 4: Modular Plugin Architecture...');
const allPlugins = getAllNavareaPlugins();
assert.ok(allPlugins.length >= 2, 'Must have at least JHOD and Universal plugins');

const jhodPlug = getNavareaPlugin('XI', 'NO.26-0453');
assert.strictEqual(jhodPlug.navareaId, 'XI');
assert.ok(jhodPlug.name.includes('JHOD'));

const univPlug = getNavareaPlugin('I', 'NAVAREA I 0145/26');
assert.ok(univPlug.name.includes('Universal IMO/IHO NAVAREA'));
console.log('✓ Test 4 passed: Plugin architecture resolves NAVAREA XI and Universal fallbacks.\n');

// -------------------------------------------------------------
// Test 5: Hallucination Guard & Grounding Diagnostics
// -------------------------------------------------------------
console.log('Test 5: Coordinate Grounding Guard & Diagnostic generation...');
const rawNotice = 'NO.26-0453 NORTH PACIFIC. DRIFTING CONTAINER IN 05-05.79N 167-14.00E.';
const groundedGeom = [{
  type: 'Point' as const,
  coordinates: [167.233, 5.096],
  raw_coordinate_text: ['05-05.79N 167-14.00E'],
  precision: 'exact' as const,
}];
const passGuard = verifyCoordinateGrounded(rawNotice, groundedGeom);
assert.strictEqual(passGuard.grounded, true, 'Exact verbatim coordinate must pass');
assert.strictEqual(passGuard.diagnostic.grounded, true);
assert.strictEqual(passGuard.diagnostic.checked_count, 1);
assert.strictEqual(passGuard.diagnostic.unmatched_phrases.length, 0);

const hallucinatedGeom = [{
  type: 'Point' as const,
  coordinates: [150.0, 20.0],
  raw_coordinate_text: ['20-00.00N 150-00.00E'],
  precision: 'exact' as const,
}];
const failGuard = verifyCoordinateGrounded(rawNotice, hallucinatedGeom);
assert.strictEqual(failGuard.grounded, false, 'Hallucinated coordinate must be rejected');
assert.strictEqual(failGuard.diagnostic.grounded, false);
assert.strictEqual(failGuard.diagnostic.unmatched_phrases.length, 1);
assert.ok(failGuard.diagnostic.rejection_reason?.includes('not grounded'));
console.log('✓ Test 5 passed: Grounding guard cleanly separates grounded vs hallucinated coordinates.\n');

// -------------------------------------------------------------
// Test 6: Dual-Layer Empty Geometry Policy
// -------------------------------------------------------------
console.log('Test 6: Dual-Layer Empty Geometry Enforcement...');
const ambiguousFakeJhod: any = {
  warning_id: { number: '0498', year: 2026 },
  title: 'TEST AMBIGUOUS',
  hazard_category: 'drifting',
  geometries: [
    {
      type: 'Point',
      coordinates: [134.65, 16.90],
      raw_coordinate_text: ['16-54.1N 134-39.5'],
      precision: 'exact',
    }
  ],
  unparsed_lines: [],
  confidence: 0.9,
};
const convertedWarn = convertJhodToNavWarning(ambiguousFakeJhod, partialHemiText, true);
assert.strictEqual(convertedWarn.data_quality, 'AMBIGUOUS', 'Must be AMBIGUOUS');
assert.strictEqual(convertedWarn.latitude, null, 'Layer 2 must wipe latitude');
assert.strictEqual(convertedWarn.longitude, null, 'Layer 2 must wipe longitude');
assert.strictEqual(convertedWarn.spatial?.geometries.length, 0, 'Layer 2 must wipe geometries');
assert.strictEqual(convertedWarn.spatial?.validation_status, 'invalid_format');
console.log('✓ Test 6 passed: Layer 2 wiped all geometries and coordinates for ambiguous input.\n');

// -------------------------------------------------------------
// Test 7: JHOD 19-Notice Corpus Regression Test
// -------------------------------------------------------------
console.log('Test 7: 19-Notice JHOD Corpus Regression...');
const bulletins = splitJhodTelexStream(JHOD_19_NOTICES_CORPUS);
assert.strictEqual(bulletins.length, 19, `Expected 19 notices in corpus, found ${bulletins.length}`);

let totalCoordinatesExtracted = 0;
let manifestFound = false;

bulletins.forEach((block, idx) => {
  const isManifest = /MESSAGES IN FORCE/i.test(block);
  if (isManifest) manifestFound = true;
  const parsed = parseCoordinatesDeterministic(block, 'XI');
  totalCoordinatesExtracted += parsed.geometries.length;
  // None of the official 19 notices contain ambiguous hemisphere defects
  assert.strictEqual(parsed.ambiguous_positions?.length || 0, 0, `Notice ${idx + 1} has unexpected ambiguous positions`);
  if (idx === 1) {
    // Notice 2 is earthquake in 080.8W (outside NAVAREA XI)
    assert.strictEqual(parsed.validation_status, 'out_of_bounds');
    assert.strictEqual(parsed.data_quality, 'INVALID');
  } else if (idx === 0) {
    // Notice 1 is Manifest
    assert.strictEqual(parsed.validation_status, 'not_present');
  } else {
    assert.strictEqual(parsed.validation_status, 'passed');
    assert.strictEqual(parsed.data_quality, 'EXPLICIT');
  }
});

assert.ok(manifestFound, 'Manifest notice must be detected');
assert.strictEqual(totalCoordinatesExtracted, 18, `Expected 18 features across 19 notices, got ${totalCoordinatesExtracted}`);
console.log(`✓ Test 7 passed: All 19 notices parsed without regression (${totalCoordinatesExtracted} features extracted, 17 in-bounds EXPLICIT, 1 out-of-bounds INVALID, 1 manifest).\n`);

console.log('====================================================');
console.log('ALL P0 SAFETY & REGRESSION TESTS PASSED CLEANLY! ✅');
console.log('====================================================');

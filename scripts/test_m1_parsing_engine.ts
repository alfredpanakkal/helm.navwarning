// scripts/test_m1_parsing_engine.ts
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { parseCoordinatesFull } from '../src/parsers/coordinateParser';
import { extractGeometry } from '../src/parsers/geometryExtractor';
import { parseBerthAndRadius } from '../src/parsers/berthParser';
import { splitBroadcastFeed } from '../src/parsers/messageSplitter';

console.log('=== RUNNING MILESTONE M1 PARSING ENGINE TEST SUITE ===\n');

// 1. Test IV 306 leading zero stripping (Safe Coordinate Repair Discipline)
console.log('1. Testing Safe Coordinate Repair on IV 306/24 (lat-only zero stripping)...');
const iv306Text = `NAVAREA IV 306/24
CARIBBEAN SEA.
CORAL HEAD DISCOVERED IN 021-26.90N 068-15.30W.`;
const iv306Res = parseCoordinatesFull(iv306Text);
assert.strictEqual(iv306Res.coordinates.length, 1, 'IV 306 must yield 1 coordinate');
assert.ok(Math.abs(iv306Res.coordinates[0].lat - (21 + 26.9 / 60)) < 0.0001, 'Latitude must be ~21.4483 after zero-strip');
assert.ok(Math.abs(iv306Res.coordinates[0].lng - (-(68 + 15.3 / 60))) < 0.0001, 'Longitude must NOT have zero stripped incorrectly');
assert.ok(iv306Res.repairsApplied.some(r => r.includes('leading zero')), 'Must record repair in telemetry');
console.log('✓ IV 306 safe repair passed: 021-26.90N successfully repaired to 21°26.9\'N, longitude intact.');

// 2. Test Space-separated coordinates (IX 546)
console.log('\n2. Testing Space-separated coordinate format (IX 546/24)...');
const ix546Text = `NAVAREA IX 546/24
ARABIAN SEA.
GEOPHYSICAL SURVEY OPERATIONS BY R/V INDUS ALONG TRACK:
23 30.00N 064 10.00E
23 45.00N 064 30.00E
24 00.00N 065 00.00E.`;
const ix546Geom = extractGeometry(ix546Text);
assert.strictEqual(ix546Geom.geometry.coordinates.length, 3, 'IX 546 must extract 3 vertices');
assert.strictEqual(ix546Geom.geometry.archetype, 'polyline', 'IX 546 must be archetype polyline');
console.log('✓ IX 546 space-separated coordinates parsed into 3-vertex polyline.');

// 3. Test DMS coordinate format (IX 327)
console.log('\n3. Testing Degrees Minutes Seconds format (IX 327/24)...');
const ix327Text = `NAVAREA IX 327/24
GULF OF OMAN.
SUBMERGED OBSTRUCTION LOCATED IN 24° 15' 30"N 057° 45' 12"E.`;
const ix327Res = parseCoordinatesFull(ix327Text);
assert.strictEqual(ix327Res.coordinates.length, 1, 'IX 327 must yield 1 coordinate');
assert.ok(Math.abs(ix327Res.coordinates[0].lat - (24 + 15 / 60 + 30 / 3600)) < 0.0001);
assert.ok(Math.abs(ix327Res.coordinates[0].lng - (57 + 45 / 60 + 12 / 3600)) < 0.0001);
console.log('✓ IX 327 DMS parsed accurately.');

// 4. Test Relocation archetype (IX 349)
console.log('\n4. Testing Relocation archetype (IX 349/24)...');
const ix349Text = `NAVAREA IX 349/24
PERSIAN GULF, UAE.
SPECIAL MARK BUOY RELOCATED FROM 24-10.00N 054-12.00E TO NEW POSITION 24-12.50N 054-15.20E.`;
const ix349Geom = extractGeometry(ix349Text);
assert.strictEqual(ix349Geom.geometry.archetype, 'relocation');
assert.ok(ix349Geom.geometry.displacementVector, 'Must have displacementVector');
assert.strictEqual(ix349Geom.geometry.displacementVector?.from.isGhost, true, 'Former position must be ghosted');
console.log('✓ IX 349 relocation parsed with origin ghost and displacement vector.');

// 5. Test Polygon archetype (IX 365)
console.log('\n5. Testing Polygon archetype (IX 365/24)...');
const ix365Text = `NAVAREA IX 365/24
ARABIAN SEA, OMAN.
MILITARY FIRING PRACTICE IN AREA BOUNDED BY:
23-45.00N 058-20.00E
23-55.00N 058-20.00E
23-55.00N 058-40.00E
23-45.00N 058-40.00E`;
const ix365Geom = extractGeometry(ix365Text);
assert.strictEqual(ix365Geom.geometry.archetype, 'polygon');
assert.strictEqual(ix365Geom.geometry.coordinates.length, 4);
console.log('✓ IX 365 4-vertex polygon extracted.');

// 6. Test Corridor archetype (IV 649, IV 877)
console.log('\n6. Testing Corridor archetype (IV 649/24, IV 877/24)...');
const iv649Text = `NAVAREA IV 649/24
SUBMARINE CABLE OPERATIONS IN PROGRESS ALONG ROUTE:
38-40.00N 074-20.00W
38-50.00N 073-50.00W
39-05.00N 073-10.00W.
0.5 NM SAFETY ZONE REQUESTED.`;
const iv649Geom = extractGeometry(iv649Text);
assert.strictEqual(iv649Geom.geometry.archetype, 'corridor');
assert.strictEqual(iv649Geom.geometry.clearanceNm, 0.5);
console.log('✓ IV 649 cable route corridor extracted with 0.5 NM clearance.');

// 7. Test Point Radius variants (IX 041, IX 214)
console.log('\n7. Testing Point Radius variants (metric 500m & NM)...');
const ix041Text = `EXPLOSIVE ORDNANCE DISPOSAL WITHIN 500 METRES OF 26-20.00N 050-30.00E`;
const ix041Geom = extractGeometry(ix041Text);
assert.strictEqual(ix041Geom.geometry.archetype, 'point_radius');
assert.strictEqual(ix041Geom.geometry.radiusNm, 0.27, '500m converts to 0.27 NM');

const ix214Text = `DRILLING RIG IN 26-14.80N 053-12.40E. SAFETY ZONE RADIUS 1 NM.`;
const ix214Geom = extractGeometry(ix214Text);
assert.strictEqual(ix214Geom.geometry.archetype, 'point_radius');
assert.strictEqual(ix214Geom.geometry.radiusNm, 1.0);
console.log('✓ Metric 500m and 1 NM point_radius variants verified.');

// 8. Test Held-Out Slice Evaluation (Decision 1 & Milestone M1 criteria)
console.log('\n8. Evaluating frozen 15% held-out slice against extraction engine...');
const heldoutPath = path.resolve('src/data/fixtures/heldout-slice.json');
const heldoutSlice = JSON.parse(fs.readFileSync(heldoutPath, 'utf8'));

const ixRaw = fs.readFileSync(path.resolve('src/data/fixtures/raw/NAVAREA_IX.txt'), 'utf8');
const ivRaw = fs.readFileSync(path.resolve('src/data/fixtures/raw/NAVAREA_IV.txt'), 'utf8');
const allBlocks = [
  ...splitBroadcastFeed(ixRaw, { defaultNavarea: 'IX' }),
  ...splitBroadcastFeed(ivRaw, { defaultNavarea: 'IV' }),
];

let coordErrors = 0;
let archetypeMatches = 0;
const failures: any[] = [];

for (const target of heldoutSlice) {
  const block = allBlocks.find(b => b.warningId === target.warningId);
  assert.ok(block, `Target ${target.warningId} must exist in corpus`);

  const geomRes = extractGeometry(block!.rawText);

  // Check archetype
  const archMatch = geomRes.geometry.archetype === target.archetype;
  if (archMatch) {
    archetypeMatches++;
  } else {
    failures.push({
      warningId: target.warningId,
      expected: target.archetype,
      actual: geomRes.geometry.archetype,
      reason: 'archetype_mismatch'
    });
  }

  // Check coordinates if target has expected
  if (target.expectedCoordinates) {
    if (geomRes.geometry.coordinates.length !== target.expectedCoordinates.length) {
      coordErrors++;
      failures.push({
        warningId: target.warningId,
        error: `Expected ${target.expectedCoordinates.length} coords, got ${geomRes.geometry.coordinates.length}`
      });
    } else {
      for (let i = 0; i < target.expectedCoordinates.length; i++) {
        const exp = target.expectedCoordinates[i];
        const act = geomRes.geometry.coordinates[i];
        const latDiff = Math.abs(exp.lat - act.lat);
        const lngDiff = Math.abs(exp.lng - act.lng);
        if (latDiff > 0.005 || lngDiff > 0.005) {
          coordErrors++;
          failures.push({
            warningId: target.warningId,
            error: `Coordinate mismatch at vertex ${i}: exp [${exp.lat}, ${exp.lng}], got [${act.lat}, ${act.lng}]`
          });
        }
      }
    }
  }
}

const archetypeAccuracy = (archetypeMatches / heldoutSlice.length) * 100;
console.log(`Held-Out Slice Results:`);
console.log(`  Coordinate Errors: ${coordErrors} (Target: 0)`);
console.log(`  Archetype Accuracy: ${archetypeAccuracy.toFixed(1)}% (Target: >= 90%)`);

assert.strictEqual(coordErrors, 0, 'Held-out slice MUST have 0 coordinate errors');
assert.ok(archetypeAccuracy >= 90, 'Held-out slice must achieve >= 90% archetype accuracy');
console.log('✓ Frozen held-out slice passed with zero coordinate errors and >=90% accuracy!\n');

console.log('=== ALL MILESTONE M1 ACCEPTANCE TESTS PASSED ===\n');

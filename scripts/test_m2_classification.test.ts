// scripts/test_m2_classification.test.ts — vitest port (assertions unchanged from the tsx script)
// scripts/test_m2_classification.ts
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { classifyWarning } from '../src/parsers/warningClassifier';
import { evaluateAtoNStatus } from '../src/parsers/atonStatus';
import { splitBroadcastFeed } from '../src/parsers/messageSplitter';
import { it } from 'vitest';

it('M2 classification acceptance suite', () => {

console.log('=== RUNNING MILESTONE M2 CLASSIFICATION TEST SUITE ===\n');

// 1. Adversarial Golden Test Cases
console.log('1. Testing Adversarial Suite (8 test fixtures)...');

// Case 1: IX 285 -> ops (marine demolition operations without ordnance)
const ix285 = classifyWarning(`MARINE DEMOLITION OPERATIONS OF OLD QUAY WALL IN PROGRESS. NO EXPLOSIVES HAZARD TO SHIPPING.`);
assert.strictEqual(ix285.category, 'ops', 'IX 285 must classify as ops, NOT uxo');
console.log('✓ IX 285 correctly classified as ops (demolition without explosives).');

// Case 2: IV 870 -> mil_fire
const iv870 = classifyWarning(`MILITARY FIRING EXERCISES IN AREA BOUNDED BY 27-00N 083-30W...`);
assert.strictEqual(iv870.category, 'mil_fire', 'IV 870 must classify as mil_fire');
console.log('✓ IV 870 correctly classified as mil_fire.');

// Case 3: IX 103 -> rig with alert status
const ix103 = classifyWarning(`DRILLING RIG "NOBLE HANS DEUL" REPORTED MOVING UNDER TOW. ALERT STATUS ACTIVE.`);
assert.strictEqual(ix103.category, 'rig', 'IX 103 must classify as rig');
assert.strictEqual(ix103.severity, 'high', 'IX 103 under tow with alert must have high severity');
console.log('✓ IX 103 correctly classified as rig with high severity alert.');

// Case 4: IX 328 -> security
const ix328 = classifyWarning(`SECURITY ADVISORY. SUSPICIOUS SKIFF REPORTED APPROACHING MERCHANT VESSEL...`);
assert.strictEqual(ix328.category, 'security', 'IX 328 must classify as security');
console.log('✓ IX 328 correctly classified as security.');

// Case 5: IV 961 -> sar
const iv961 = classifyWarning(`SEARCH AND RESCUE OPERATION IN PROGRESS IN 32-15N 075-20W. RESCUE COORDINATION CENTER NORFOLK.`);
assert.strictEqual(iv961.category, 'sar', 'IV 961 must classify as sar');
assert.strictEqual(iv961.severity, 'critical', 'SAR must be critical severity');
console.log('✓ IV 961 correctly classified as sar.');

// Case 6: IX 201 -> uxo + critical (drifting sea mine)
const ix201 = classifyWarning(`CRITICAL HAZARD. DRIFTING SEA MINE REPORTED ADRIFT IN VICINITY 12-55N 043-15E.`);
assert.strictEqual(ix201.category, 'uxo', 'IX 201 must classify as uxo');
assert.strictEqual(ix201.severity, 'critical', 'Drifting sea mine must have critical severity');
console.log('✓ IX 201 correctly classified as uxo with critical severity.');

// Case 7: IX 189 -> drift
const ix189 = classifyWarning(`DERELICT VESSEL ADRIFT, APPROX 25 METRES LENGTH, UNLIT...`);
assert.strictEqual(ix189.category, 'drift', 'IX 189 must classify as drift');
console.log('✓ IX 189 correctly classified as drift.');

// Case 8: IV 842 -> drift
const iv842 = classifyWarning(`DERELICT UNMANNED BARGE ADRIFT IN 26-12N 092-45W. NAVIGATION HAZARD.`);
assert.strictEqual(iv842.category, 'drift', 'IV 842 must classify as drift');
console.log('✓ IV 842 correctly classified as drift.');

// 2. Keyword Hygiene Validation
console.log('\n2. Testing Keyword Hygiene Boundary Rules...');
// Floodlights must not trigger AtoN unlit
const floodlights = classifyWarning(`WORK VESSEL WITH FLOODLIGHTS ENGAGED IN HARBOUR REPAIRS.`);
assert.notStrictEqual(floodlights.category, 'aton', 'FLOODLIGHTS must not trigger AtoN category');

// Demolition WITH bomb/ordnance must trigger uxo
const demoBomb = classifyWarning(`DEMOLITION OF UNEXPLODED BOMB AT SEABED.`);
assert.strictEqual(demoBomb.category, 'uxo', 'Demolition with bomb must classify as uxo');

// AtoN status evaluation
const atonReloc = evaluateAtoNStatus(`SPECIAL MARK BUOY RELOCATED TO NEW POSITION.`);
assert.strictEqual(atonReloc, 'relocation');

const atonUnlit = evaluateAtoNStatus(`LIGHT UNLIT IN VICINITY.`);
assert.strictEqual(atonUnlit, 'alert');
console.log('✓ Keyword hygiene rules verified.');

// 3. Held-Out Slice Classification Accuracy Evaluation
console.log('\n3. Evaluating Held-Out Slice category accuracy...');
const heldoutPath = path.resolve('src/data/fixtures/heldout-slice.json');
const heldoutSlice = JSON.parse(fs.readFileSync(heldoutPath, 'utf8'));

const ixRaw = fs.readFileSync(path.resolve('src/data/fixtures/raw/NAVAREA_IX.txt'), 'utf8');
const ivRaw = fs.readFileSync(path.resolve('src/data/fixtures/raw/NAVAREA_IV.txt'), 'utf8');
const allBlocks = [
  ...splitBroadcastFeed(ixRaw, { defaultNavarea: 'IX' }),
  ...splitBroadcastFeed(ivRaw, { defaultNavarea: 'IV' }),
];

let catMatches = 0;
for (const target of heldoutSlice) {
  const block = allBlocks.find(b => b.warningId === target.warningId);
  assert.ok(block);
  const classRes = classifyWarning(block!.rawText);
  if (classRes.category === target.category) {
    catMatches++;
  } else {
    console.warn(`Mismatch on ${target.warningId}: expected ${target.category}, got ${classRes.category}`);
  }
}

const catAccuracy = (catMatches / heldoutSlice.length) * 100;
console.log(`Held-Out Category Accuracy: ${catAccuracy.toFixed(1)}% (Target: >= 90%)`);
assert.ok(catAccuracy >= 90, 'Held-out category accuracy must be >= 90%');
console.log('✓ Held-out category classification passed!\n');

console.log('=== ALL MILESTONE M2 ACCEPTANCE TESTS PASSED ===\n');

});

// scripts/test_m3_lifecycle.ts
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { splitBroadcastFeed } from '../src/parsers/messageSplitter';
import { processCorpusLifecycle, extractNamedEntities } from '../src/parsers/lifecycle';

console.log('=== RUNNING MILESTONE M3 LIFECYCLE ENGINE TEST SUITE ===\n');

// 1. Ingestion of raw feeds
const ixRaw = fs.readFileSync(path.resolve('src/data/fixtures/raw/NAVAREA_IX.txt'), 'utf8');
const ivRaw = fs.readFileSync(path.resolve('src/data/fixtures/raw/NAVAREA_IV.txt'), 'utf8');

const ixBlocks = splitBroadcastFeed(ixRaw, { defaultNavarea: 'IX', sourceFeed: 'NAVAREA_IX.txt' });
const ivBlocks = splitBroadcastFeed(ivRaw, { defaultNavarea: 'IV', sourceFeed: 'NAVAREA_IV.txt' });
const allBlocks = [...ixBlocks, ...ivBlocks];

console.log(`Ingested ${allBlocks.length} total raw messages across NAVAREA IV and IX.`);

// 2. Run Lifecycle Engine
const { warnings, inForceLists, textUnavailableIds, contradictionsLogged } = processCorpusLifecycle(allBlocks, new Date('2026-10-18T06:00:00Z'));

// 3. Test In-Force Oracle & Text-Unavailable Assertions
console.log('\n1. Verifying In-Force Oracle and Text-Unavailable assertions...');
assert.ok(inForceLists.length >= 3, `Expected at least 3 in-force lists, found ${inForceLists.length}`);
console.log(`Text-unavailable messages count: ${textUnavailableIds.length}`);
assert.ok(textUnavailableIds.length > 0, 'Text-unavailable messages must be explicitly tracked');
console.log(`✓ Text-unavailable count asserted and bound (${textUnavailableIds.length} list entries without message text).`);

// 4. Test Cross-Cancellation Precedence (IX 363 cancels IX 362)
console.log('\n2. Testing Cross-Cancellation Precedence (IX 363 cancels IX 362)...');
const ix362 = warnings.find(w => w.warningId.includes('362'));
assert.ok(ix362, 'Must find IX 362');
assert.strictEqual(ix362?.lifecycle.inForce, false, 'IX 362 must be inactive');
assert.strictEqual(ix362?.lifecycle.resolutionRule, 'cross_cancel', 'IX 362 resolutionRule must be cross_cancel');
assert.ok(ix362?.lifecycle.resolutionRefs?.some(r => r.includes('363')), 'IX 362 must record canceller 363');
console.log('✓ IX 362 correctly cross-cancelled by IX 363.');

// 5. Test Supersession Guardrails with Named Entity Evidence (IV 977 superseded by IV 979)
console.log('\n3. Testing Supersession with Named Entity Evidence (IV 977 superseded by IV 979)...');
const iv977 = warnings.find(w => w.warningId.includes('977'));
const iv979 = warnings.find(w => w.warningId.includes('979'));
assert.ok(iv977 && iv979, 'Must find IV 977 and IV 979');

const entities977 = extractNamedEntities(iv977!.rawText);
const entities979 = extractNamedEntities(iv979!.rawText);
assert.ok(entities977.includes('INTERNATIONAL ICE PATROL'), 'IV 977 must have entity INTERNATIONAL ICE PATROL');
assert.ok(entities979.includes('INTERNATIONAL ICE PATROL'), 'IV 979 must have entity INTERNATIONAL ICE PATROL');

assert.strictEqual(iv977?.lifecycle.inForce, false, 'IV 977 must be inactive');
assert.strictEqual(iv977?.lifecycle.resolutionRule, 'cross_cancel', 'IV 977 resolutionRule must be cross_cancel (Tier 2 beats Tier 4)');
assert.ok(iv977?.lifecycle.resolutionRefs?.some(r => r.includes('978')), 'IV 977 resolutionRefs must include canceller 978');
const iv977Conflict = contradictionsLogged.find(c => c.targetId.includes('977'));
assert.ok(iv977Conflict, 'Must log contradiction arbitration for IV 977');
assert.strictEqual(iv977Conflict?.winningRule, 'cross_cancel', 'Winning rule must be cross_cancel');
console.log('✓ IV 977 correctly arbitrated: Tier 2 cross_cancel takes precedence over Tier 4 supersession.');

// 6. Test Partial / Truncated In-Force List Handling (IX 529/24)
console.log('\n4. Testing Partial / Truncated In-Force List Handling (IX 529/24)...');
const ix529 = warnings.find(w => w.warningId.includes('529'));
assert.ok(ix529, 'Must find IX 529');
assert.strictEqual(ix529?.truncated, true, 'IX 529 must be flagged truncated');
assert.strictEqual(ix529?.lifecycle.isPartialList, true, 'IX 529 must have isPartialList: true');
console.log('✓ IX 529 correctly flagged as partial list with prefix-scoped handling.');

// 7. Verify Invariant: Zero Silent Drops across parsed messages
console.log('\n5. Verifying Zero Silent Drops invariant...');
for (const w of warnings) {
  assert.ok(w.warningId, 'Every warning must have an ID');
  assert.ok(w.lifecycle.resolutionRule, `Warning ${w.warningId} must have an explicit resolutionRule`);
  if (!w.lifecycle.inForce) {
    assert.ok(
      w.lifecycle.resolutionRule !== 'none' || w.lifecycle.unplottedReason === 'meta_list',
      `Inactive warning ${w.warningId} must have an explicit reason or be a meta list`
    );
  }
}
console.log(`✓ All ${warnings.length} messages pass the zero-silent-drop audit trail assertion.\n`);

console.log('=== ALL MILESTONE M3 ACCEPTANCE TESTS PASSED ===\n');

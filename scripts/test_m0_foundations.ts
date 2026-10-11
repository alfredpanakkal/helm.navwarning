// scripts/test_m0_foundations.ts
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { splitBroadcastFeed } from '../src/parsers/messageSplitter';
import { parseHeader } from '../src/parsers/headerParser';
import { parseInForceList } from '../src/parsers/inForceListParser';

console.log('=== RUNNING MILESTONE M0 FOUNDATIONS TEST SUITE ===\n');

// 1. Verify fixture existence
const ixPath = path.resolve('src/data/fixtures/raw/NAVAREA_IX.txt');
const ivPath = path.resolve('src/data/fixtures/raw/NAVAREA_IV.txt');
const heldoutPath = path.resolve('src/data/fixtures/heldout-slice.json');

assert.ok(fs.existsSync(ixPath), 'NAVAREA_IX.txt must exist');
assert.ok(fs.existsSync(ivPath), 'NAVAREA_IV.txt must exist');
assert.ok(fs.existsSync(heldoutPath), 'heldout-slice.json must exist');

const ixRaw = fs.readFileSync(ixPath, 'utf8');
const ivRaw = fs.readFileSync(ivPath, 'utf8');
const heldoutSlice = JSON.parse(fs.readFileSync(heldoutPath, 'utf8'));

// 2. Test Splitter on NAVAREA IX
console.log('1. Testing MessageSplitter on NAVAREA IX feed...');
const ixBlocks = splitBroadcastFeed(ixRaw, { defaultNavarea: 'IX', sourceFeed: 'NAVAREA_IX.txt' });
assert.ok(ixBlocks.length >= 30, `Expected >= 30 messages in NAVAREA IX, got ${ixBlocks.length}`);

const ix529 = ixBlocks.find(b => b.warningId.includes('529'));
assert.ok(ix529, 'Must find NAVAREA IX 529/24');
assert.strictEqual(ix529?.truncated, true, 'IX 529/24 must be flagged truncated');
console.log(`✓ NAVAREA IX split into ${ixBlocks.length} messages; IX 529/24 correctly flagged truncated.`);

// 3. Test Splitter on NAVAREA IV
console.log('\n2. Testing MessageSplitter on NAVAREA IV feed...');
const ivBlocks = splitBroadcastFeed(ivRaw, { defaultNavarea: 'IV', sourceFeed: 'NAVAREA_IV.txt' });
assert.ok(ivBlocks.length >= 20, `Expected >= 20 messages in NAVAREA IV, got ${ivBlocks.length}`);
console.log(`✓ NAVAREA IV split into ${ivBlocks.length} messages.`);

// 4. Test InForceListParser
console.log('\n3. Testing InForceListParser on in-force lists and partial lists...');
const ix364Block = ixBlocks.find(b => b.warningId.includes('364'));
assert.ok(ix364Block, 'Must find IX 364');
const parsedIx364 = parseInForceList(ix364Block!);
assert.strictEqual(parsedIx364.isList, true, 'IX 364 must be identified as list');
assert.ok(parsedIx364.entryCount >= 20, `IX 364 should have >= 20 entries, got ${parsedIx364.entryCount}`);
assert.ok(parsedIx364.cancelledRefs.includes('NAVAREA IX 360/24'), 'Must extract CANCEL 360/24');

// Partial list test: IX 529/24
const parsedIx529 = parseInForceList(ix529!);
assert.strictEqual(parsedIx529.isList, true, 'IX 529 must be identified as list');
assert.strictEqual(parsedIx529.isPartialList, true, 'IX 529 must be flagged isPartialList: true');
console.log(`✓ IX 364 parsed with ${parsedIx364.entryCount} entries; IX 529 correctly parsed with isPartialList: true.`);

// IV 978 in-force list and cancel test
const iv978Block = ivBlocks.find(b => b.warningId.includes('978'));
assert.ok(iv978Block, 'Must find IV 978');
const parsedIv978 = parseInForceList(iv978Block!);
assert.strictEqual(parsedIv978.isList, true, 'IV 978 must be identified as list');
assert.ok(parsedIv978.entryCount >= 15, `IV 978 should have >= 15 entries, got ${parsedIv978.entryCount}`);
assert.ok(parsedIv978.cancelledRefs.some(r => r.includes('857')), 'Must cancel 857');
assert.ok(parsedIv978.cancelledRefs.some(r => r.includes('961')), 'Must cancel 961');
assert.ok(parsedIv978.cancelledRefs.some(r => r.includes('977')), 'Must cancel 977');
console.log(`✓ IV 978 parsed with ${parsedIv978.entryCount} entries and cancellations (857, 961, 977).`);

// 5. Test HeaderParser
console.log('\n4. Testing HeaderParser on headers and DTG timestamps...');
const parsedHeaderIx365 = parseHeader(ixBlocks.find(b => b.warningId.includes('365'))!);
assert.strictEqual(parsedHeaderIx365.navarea, 'IX');
assert.strictEqual(parsedHeaderIx365.number, 365);
assert.ok(parsedHeaderIx365.charts.includes('2858'), 'Must parse chart BA 2858');

// 6. Test Frozen Held-Out Slice Structure
console.log('\n5. Validating frozen 15% held-out slice integrity...');
assert.ok(Array.isArray(heldoutSlice), 'Held-out slice must be an array');
assert.ok(heldoutSlice.length >= 8, `Held-out slice must contain >= 8 messages, got ${heldoutSlice.length}`);
for (const item of heldoutSlice) {
  assert.ok(item.warningId, 'Each held-out item must have warningId');
  assert.ok(item.category, 'Each held-out item must have category');
  assert.ok(item.archetype, 'Each held-out item must have archetype');
}
console.log(`✓ Held-out slice contains ${heldoutSlice.length} frozen test specifications.\n`);

console.log('=== ALL MILESTONE M0 ACCEPTANCE TESTS PASSED ===\n');

import fs from 'node:fs';
import { splitBroadcastFeed } from '../src/parsers/messageSplitter';
import { parseInForceList } from '../src/parsers/inForceListParser';

const ixText = fs.readFileSync('src/data/fixtures/raw/NAVAREA_IX.txt', 'utf8');
const ivText = fs.readFileSync('src/data/fixtures/raw/NAVAREA_IV.txt', 'utf8');

const ixBlocks = splitBroadcastFeed(ixText, { defaultNavarea: 'IX' });
const ivBlocks = splitBroadcastFeed(ivText, { defaultNavarea: 'IV' });
const allBlocks = [...ixBlocks, ...ivBlocks];

const allIds = new Set(allBlocks.map(b => b.warningId));

const ix364 = ixBlocks.find(b => b.warningId.includes('364'));
const ix350 = ixBlocks.find(b => b.warningId.includes('350'));
const iv978 = ivBlocks.find(b => b.warningId.includes('978'));

const parsed364 = parseInForceList(ix364!);
const parsed350 = parseInForceList(ix350!);
const parsed978 = parseInForceList(iv978!);

console.log('IX 364 entries count:', parsed364.entryCount);
console.log('IX 350 entries count:', parsed350.entryCount);
console.log('IV 978 entries count:', parsed978.entryCount);

const textUnavailableIx: string[] = [];
for (const entry of parsed364.inForceEntries) {
  if (!allIds.has(entry.warningId)) {
    textUnavailableIx.push(entry.warningId);
  }
}

const textUnavailableIv: string[] = [];
for (const entry of parsed978.inForceEntries) {
  if (!allIds.has(entry.warningId)) {
    textUnavailableIv.push(entry.warningId);
  }
}

console.log('Text unavailable in IX 364:', textUnavailableIx);
console.log('Text unavailable in IV 978:', textUnavailableIv);
console.log('Total text unavailable:', textUnavailableIx.length + textUnavailableIv.length);

const oracleExpectations = {
  inForceLists: {
    "NAVAREA IX 364/24": {
      entryCount: parsed364.entryCount,
      cancelledRefs: parsed364.cancelledRefs
    },
    "NAVAREA IX 350/24": {
      entryCount: parsed350.entryCount,
      cancelledRefs: parsed350.cancelledRefs
    },
    "NAVAREA IV 978/24": {
      entryCount: parsed978.entryCount,
      cancelledRefs: parsed978.cancelledRefs
    }
  },
  textUnavailableIds: [...textUnavailableIx, ...textUnavailableIv],
  textUnavailableCount: textUnavailableIx.length + textUnavailableIv.length
};

fs.writeFileSync('src/data/fixtures/oracle-expectations.json', JSON.stringify(oracleExpectations, null, 2), 'utf8');
console.log('Wrote oracle-expectations.json successfully.');

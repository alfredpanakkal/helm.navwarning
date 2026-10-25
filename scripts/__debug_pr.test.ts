import { it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseCoordinatesDeterministic } from '../src/utils/coordinateParser';
import { extractGeometry } from '../src/parsers/geometryExtractor';
import { splitBroadcastFeed } from '../src/parsers/messageSplitter';
import { processCorpusLifecycle } from '../src/parsers/lifecycle';

it('debug round 2', () => {
  const t041 = `EXPLOSIVE ORDNANCE DISPOSAL WITHIN 500 METRES OF 26-20.00N 050-30.00E`;
  const det = parseCoordinatesDeterministic(t041, 'IX');
  const detDump = { geometries: det.geometries, circles: det.circles, validation_status: det.validation_status, ambiguous: det.ambiguous_positions, rawCoordText: det.raw_coordinate_text, radiusSpecs: det.radius_specifications, escalation: det.escalation_triggers, dataQuality: det.data_quality };

  const ixRaw = fs.readFileSync(path.resolve('src/data/fixtures/raw/NAVAREA_IX.txt'), 'utf8');
  const ixBlocks = splitBroadcastFeed(ixRaw, { defaultNavarea: 'IX', sourceFeed: 'NAVAREA_IX.txt' });
  const block214 = ixBlocks.find(b => b.warningId.includes('214'));
  const corpus214 = block214 ? { warningId: block214.warningId, rawText: block214.rawText, geomDirect: extractGeometry(block214.rawText).geometry } : null;
  const allBlocks = [...ixBlocks, ...splitBroadcastFeed(fs.readFileSync(path.resolve('src/data/fixtures/raw/NAVAREA_IV.txt'), 'utf8'), { defaultNavarea: 'IV', sourceFeed: 'NAVAREA_IV.txt' })];
  const { warnings } = processCorpusLifecycle(allBlocks, new Date('2026-10-18T06:00:00Z'));
  const w214 = warnings.find(w => w.warningId.includes('214'));
  const life214 = w214 ? { warningId: w214.warningId, geometry: w214.geometry } : null;
  const out = JSON.stringify({ det041: detDump, corpus214, life214 }, null, 1);
  console.log('DEBUG2 ' + out);
  throw new Error('DEBUG2 ' + out);
});
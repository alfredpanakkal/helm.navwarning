// TEMP diagnostic for IV 877 corridor/point_radius question — delete before merge.
import { it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { splitBroadcastFeed } from '../src/parsers/messageSplitter';
import { parseCoordinatesFull } from '../src/parsers/coordinateParser';
import { extractGeometry } from '../src/parsers/geometryExtractor';
import { parseCoordinatesDeterministic } from '../src/utils/coordinateParser';

it('debug IV 877', () => {
  const ivRaw = fs.readFileSync(path.resolve('src/data/fixtures/raw/NAVAREA_IV.txt'), 'utf8');
  const blocks = splitBroadcastFeed(ivRaw, { defaultNavarea: 'IV', sourceFeed: 'NAVAREA_IV.txt' });
  const b = blocks.find(x => x.warningId.includes('877'));
  const full = parseCoordinatesFull(b.rawText);
  const det = parseCoordinatesDeterministic(b.rawText, 'IV');
  const geom = extractGeometry(b.rawText);
  const info = JSON.stringify({
    rawText: b.rawText,
    fullCoords: full.coordinates,
    detGeoms: (det.geometries || []).map(g => ({ type: g.type, n: Array.isArray(g.coordinates) ? g.coordinates.length : 0, label: g.label })),
    detCircles: det.circles,
    detQuality: det.data_quality,
    archetype: geom.geometry.archetype,
  }, null, 1);
  expect(info).toBe('FORCE_FAIL');
});

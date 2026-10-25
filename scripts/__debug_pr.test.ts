import { it } from 'vitest';
import { parseCoordinatesFull } from '../src/parsers/coordinateParser';
import { parseBerthAndRadius } from '../src/parsers/berthParser';
import { extractGeometry } from '../src/parsers/geometryExtractor';
import { extractGroupLabels } from '../src/parsers/labelExtractor';

it('debug 041/214 diagnostics', () => {
  const t041 = `EXPLOSIVE ORDNANCE DISPOSAL WITHIN 500 METRES OF 26-20.00N 050-30.00E`;
  const t214 = `DRILLING RIG IN 26-14.80N 053-12.40E. SAFETY ZONE RADIUS 1 NM.`;
  const diag = (t: string) => ({
    coords: parseCoordinatesFull(t).coordinates,
    berth: parseBerthAndRadius(t),
    labels: extractGroupLabels(t),
    geom: extractGeometry(t).geometry,
  });
  const out = JSON.stringify({ t041: diag(t041), t214: diag(t214) }, null, 1);
  console.log('DEBUG_DIAGNOSTICS ' + out);
  if (true) throw new Error('DEBUG_DIAGNOSTICS ' + out);
});
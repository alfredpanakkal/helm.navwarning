// src/utils/__tests__/p0SafetyRegression.test.ts
// Vitest port of scripts/test_p0_safety_regression.ts (assert-based tsx script).
// Assertions are identical to the original; only the test harness changed.
import { describe, it, expect } from 'vitest';
import { parseCoordinatesDeterministic, parseRadiusSpecification } from '../coordinateParser';
import { getNavareaPlugin, getAllNavareaPlugins } from '../../schemas/plugins/registry';
import { verifyCoordinateGrounded, convertJhodToNavWarning, splitJhodTelexStream } from '../../schemas/jhodAiContract';
import { JHOD_19_NOTICES_CORPUS } from '../../data/jhod19NoticesCorpus';

const partialHemiText = `NO.26-0498 Date:2026/10/11 08 UTC
NORTH PACIFIC, OKINOTORI SHIMA.
HATCH COVER ADRIFT IN
16-54.1N 134-39.5 AT 110730Z OCT.
CANCEL THIS MSG 150800Z OCT.`;

describe('P0 safety & regression', () => {
  it('Test 1: full-absent hemisphere triggers quarantine', () => {
    const missingHemiText = `NO.26-0499 Date:2026/10/11 08 UTC
NORTH PACIFIC, MARIANAS.
DERELICT BARGE ADRIFT IN VICINITY OF
11-52 146-04 AT 110700Z OCT.
CANCEL THIS MSG 150800Z OCT.`;

    const resMissing = parseCoordinatesDeterministic(missingHemiText, 'XI');
    expect(resMissing.geometries.length).toBe(0);
    expect(resMissing.circles.length).toBe(0);
    expect(resMissing.data_quality).toBe('AMBIGUOUS');
    expect(resMissing.hemisphere_status).toBe('AMBIGUOUS_HEMISPHERE');
    expect(resMissing.ambiguous_positions && resMissing.ambiguous_positions.length > 0).toBe(true);
    expect(resMissing.ambiguous_positions[0].has_lat_hem).toBe(false);
    expect(resMissing.ambiguous_positions[0].has_lon_hem).toBe(false);
    expect(resMissing.ambiguous_positions[0].reason).toBe('AMBIGUOUS_HEMISPHERE');
  });

  it('Test 2: partial hemisphere triggers quarantine (lat present, lon missing)', () => {
    const resPartial = parseCoordinatesDeterministic(partialHemiText, 'XI');
    expect(resPartial.geometries.length).toBe(0);
    expect(resPartial.data_quality).toBe('AMBIGUOUS');
    expect(resPartial.ambiguous_positions && resPartial.ambiguous_positions.length > 0).toBe(true);
    expect(resPartial.ambiguous_positions[0].has_lat_hem).toBe(true);
    expect(resPartial.ambiguous_positions[0].has_lon_hem).toBe(false);
    expect(resPartial.ambiguous_positions[0].reason).toBe('PARTIAL_HEMISPHERE');
  });

  it('Test 3: broadened radius regex & metric normalisation', () => {
    const radius500m = parseRadiusSpecification('UNEXPLODED ORDNANCE FOUND. WITHIN A RADIUS OF 500 METRES.');
    expect(radius500m).toBeTruthy();
    expect(radius500m?.stated_value).toBe(500);
    expect(radius500m?.stated_unit).toBe('METRE');
    expect(radius500m?.radius_nm).toBe(0.27);

    const radiusPoint6Mi = parseRadiusSpecification('DRILLING RIG. WITHIN 0.6 MILES KEEP CLEAR.');
    expect(radiusPoint6Mi).toBeTruthy();
    expect(radiusPoint6Mi?.stated_value).toBe(0.6);
    expect(radiusPoint6Mi?.radius_nm).toBe(0.6);

    const radius500MNoOf = parseRadiusSpecification('DANGER AREA. RADIUS 500 METRES FROM BUOY.');
    expect(radius500MNoOf).toBeTruthy();
    expect(radius500MNoOf?.radius_nm).toBe(0.27);
  });

  it('Test 4: plugin architecture & registry resolution', () => {
    const allPlugins = getAllNavareaPlugins();
    expect(allPlugins.length >= 2).toBe(true);

    const jhodPlug = getNavareaPlugin('XI', 'NO.26-0453');
    expect(jhodPlug.navareaId).toBe('XI');
    expect(jhodPlug.name.includes('JHOD')).toBe(true);

    const univPlug = getNavareaPlugin('I', 'NAVAREA I 0145/26');
    expect(univPlug.name.includes('Universal IMO/IHO NAVAREA')).toBe(true);
  });

  it('Test 5: hallucination guard & grounding diagnostics', () => {
    const rawNotice = 'NO.26-0453 NORTH PACIFIC. DRIFTING CONTAINER IN 05-05.79N 167-14.00E.';
    const groundedGeom = [{
      type: 'Point' as const,
      coordinates: [167.233, 5.096],
      raw_coordinate_text: ['05-05.79N 167-14.00E'],
      precision: 'exact' as const,
    }];
    const passGuard = verifyCoordinateGrounded(rawNotice, groundedGeom);
    expect(passGuard.grounded).toBe(true);
    expect(passGuard.diagnostic.grounded).toBe(true);
    expect(passGuard.diagnostic.checked_count).toBe(1);
    expect(passGuard.diagnostic.unmatched_phrases.length).toBe(0);

    const hallucinatedGeom = [{
      type: 'Point' as const,
      coordinates: [150.0, 20.0],
      raw_coordinate_text: ['20-00.00N 150-00.00E'],
      precision: 'exact' as const,
    }];
    const failGuard = verifyCoordinateGrounded(rawNotice, hallucinatedGeom);
    expect(failGuard.grounded).toBe(false);
    expect(failGuard.diagnostic.grounded).toBe(false);
    expect(failGuard.diagnostic.unmatched_phrases.length).toBe(1);
    expect(failGuard.diagnostic.rejection_reason?.includes('not grounded')).toBe(true);
  });

  it('Test 6: dual-layer empty geometry policy', () => {
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
        },
      ],
      unparsed_lines: [],
      confidence: 0.9,
    };
    const convertedWarn = convertJhodToNavWarning(ambiguousFakeJhod, partialHemiText, true);
    expect(convertedWarn.data_quality).toBe('AMBIGUOUS');
    expect(convertedWarn.latitude).toBe(null);
    expect(convertedWarn.longitude).toBe(null);
    expect(convertedWarn.spatial?.geometries.length).toBe(0);
    expect(convertedWarn.spatial?.validation_status).toBe('invalid_format');
  });

  it('Test 7: JHOD 19-notice corpus regression', () => {
    const bulletins = splitJhodTelexStream(JHOD_19_NOTICES_CORPUS);
    expect(bulletins.length).toBe(19);

    let totalCoordinatesExtracted = 0;
    let manifestFound = false;

    bulletins.forEach((block: string, idx: number) => {
      const isManifest = /MESSAGES IN FORCE/i.test(block);
      if (isManifest) manifestFound = true;
      const parsed = parseCoordinatesDeterministic(block, 'XI');
      totalCoordinatesExtracted += parsed.geometries.length;
      // None of the official 19 notices contain ambiguous hemisphere defects
      expect(parsed.ambiguous_positions?.length || 0).toBe(0);
      if (idx === 1) {
        // Notice 2 is earthquake in 080.8W (outside NAVAREA XI)
        expect(parsed.validation_status).toBe('out_of_bounds');
        expect(parsed.data_quality).toBe('INVALID');
      } else if (idx === 0) {
        // Notice 1 is Manifest
        expect(parsed.validation_status).toBe('not_present');
      } else {
        expect(parsed.validation_status).toBe('passed');
        expect(parsed.data_quality).toBe('EXPLICIT');
      }
    });

    expect(manifestFound).toBe(true);
    expect(totalCoordinatesExtracted).toBe(18);
  });
});

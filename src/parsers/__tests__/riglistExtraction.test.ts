// src/parsers/__tests__/riglistExtraction.test.ts
import { describe, it, expect } from 'vitest';
import { extractMaritimePlots } from '../geometryExtractor';

describe('RIGLIST Multi-Point Extraction & Safety Circles Verification', () => {
  it('extracts one point and one 500m safety circle per rig from a NAVAREA I RIGLIST message', () => {
    const rawRiglistText = `NAVAREA I 227/26
RIGLIST CORRECT AT 171200 UTC OCT 2026
SOUTHERN NORTH SEA
53-31.70N 003-45.20E TRANSOCEAN ARCTIC
54-12.00N 002-15.00E NOBLE RESOLUTE
55-05.00N 004-10.00E MAERSK GUARDIAN
NOTES:
500 METRE SAFETY ZONE AROUND ALL DRILLING RIGS.`;

    const warning = {
      warning_id: 'NAV-I-227-26',
      navarea: 'I',
      raw_text: rawRiglistText,
      title: 'NAVAREA I 227/26 RIGLIST',
    };

    const plots = extractMaritimePlots(warning);

    const pointPlots = plots.filter(p => p.plotType === 'point');
    const circlePlots = plots.filter(p => p.plotType === 'circle');

    console.log(`[Verification] Total plots extracted: ${plots.length}`);
    console.log(`[Verification] Point plots (rigs): ${pointPlots.length}`);
    console.log(`[Verification] Circle plots (500m safety zones): ${circlePlots.length}`);

    expect(pointPlots.length).toBe(3);
    expect(circlePlots.length).toBe(3);

    pointPlots.forEach((pt) => {
      expect(pt.hazardType).toBe('platform');
      expect(pt.plotType).toBe('point');
      expect(Array.isArray(pt.coordinates[0])).toBe(true);
    });

    circlePlots.forEach((circ) => {
      expect(circ.hazardType).toBe('platform');
      expect(circ.plotType).toBe('circle');
      expect(circ.radiusNm).toBeCloseTo(0.27, 2);
    });
  });
});

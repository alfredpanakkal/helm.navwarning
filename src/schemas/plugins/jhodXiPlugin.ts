import { NavareaPlugin, NavareaIdentityResult } from './types';
import { jhodSystemInstruction } from '../jhodAiContract';

export const jhodXiPlugin: NavareaPlugin = {
  navareaId: 'XI',
  name: 'Japan Hydrographic-Oceanographic Department (JHOD) NAVAREA XI',
  identityRegex: /(?:^|\s)NO\.(\d{2})-(\d{4})/i,
  cancellationPatterns: [
    /CANCEL\s+(\d{4}\/\d{2})/gi,
    /CANCEL\s+THIS\s+MSG\s+([0-9]{6}Z\s+[A-Z]{3})/gi,
  ],
  // NAVAREA XI spans -10 to +45 latitude and 95 to 170 longitude, crossing the equator,
  // so no default single-hemisphere convention is declared.
  isSingleHemisphere: false,
  systemInstruction: jhodSystemInstruction,
  parseIdentity(rawText: string): NavareaIdentityResult | null {
    if (!rawText) return null;
    const match = rawText.match(/(?:^|\s)NO\.(\d{2})-(\d{4})/i);
    if (!match) return null;
    const yy = parseInt(match[1], 10);
    const num = match[2];
    const fullYear = yy < 50 ? 2000 + yy : 1900 + yy;
    const refId = `${num}/${match[1]}`;
    return {
      number: num,
      year: fullYear,
      referenceId: refId,
    };
  },
};

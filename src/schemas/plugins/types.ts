import { NavAreaId, AmbiguousPosition, DataQualityRating } from '../../types';
import { SemanticGeometryType } from '../../utils/coordinateParser';

export interface NavareaIdentityResult {
  number: string;
  year: number;
  referenceId: string;
}

export interface NavareaPlugin {
  navareaId: NavAreaId | 'UNIVERSAL';
  name: string;
  identityRegex: RegExp;
  cancellationPatterns: RegExp[];
  defaultHemisphereConvention?: { latDir: 'N' | 'S'; lonDir: 'E' | 'W' };
  isSingleHemisphere?: boolean;
  coordinatePatterns?: RegExp[];
  geometryKeywordMap?: Record<string, SemanticGeometryType>;
  systemInstruction: string;
  parseIdentity(rawText: string): NavareaIdentityResult | null;
}

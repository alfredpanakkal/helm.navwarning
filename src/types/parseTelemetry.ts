// src/types/parseTelemetry.ts
// Per-message provenance & parsing diagnostic telemetry

import type { HazardCategory, Archetype } from './navarea';

export interface ParseTelemetry {
  warningId: string;
  triggerPhrase?: string;
  coordinateFormat?: string;
  disambiguationRung?: number;
  extractedArchetype: Archetype;
  confidence: 'high' | 'medium' | 'low';
  repairsApplied?: string[];
  gazetteerFallback?: boolean;
  classifiedCategory: HazardCategory;
  winningKeyword?: string;
  vertexCount?: number;
  radiusNm?: number;
  clearanceNm?: number;
  notes?: string;
}

export interface TelemetryReportSummary {
  totalMessages: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  repairedCoordinatesCount: number;
  gazetteerFallbackCount: number;
  unplottedCount: number;
  categoryDistribution: Record<HazardCategory, number>;
  archetypeDistribution: Record<Archetype, number>;
}

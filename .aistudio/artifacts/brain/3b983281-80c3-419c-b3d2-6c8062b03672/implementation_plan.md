# Implementation Plan (Locked & Polished): NAVWARN Ingestion Pipeline — P0 Safety Hardening & Multi-NAVAREA Architecture

## 1. Executive Summary & Design Principles
This production-ready plan establishes **P0 Safety / Correctness Hardening** and a **Universal Multi-NAVAREA Plugin Architecture** with dual-layer safety nets, strict hemisphere defect quarantine, and zero regressions on the certified JHOD NAVAREA XI pipeline.

### Confirmed Principles & Directives:
1. **Explicit Hemisphere Integrity Guard (Boolean Check)**:
   - For every candidate coordinate pair, evaluate:
     ```typescript
     const hasLatHem = /[NS]/i.test(latPart);
     const hasLonHem = /[EW]/i.test(lonPart);
     ```
   - If `!hasLatHem || !hasLonHem`, and no explicit global convention statement applies:
     - Flag immediately as `PARTIAL_HEMISPHERE` (if one exists) or `AMBIGUOUS_HEMISPHERE` (if neither exists).
     - Explicitly populate `has_lat_hem: Boolean(hasLatHem)` and `has_lon_hem: Boolean(hasLonHem)` on `AmbiguousPosition`.
     - **Dual-Layer Empty Geometry Policy**:
       - *Layer 1 (Coordinate Parser)*: Return `geometries: []`, push to `ambiguous_positions` and `unparsed_lines`.
       - *Layer 2 (Warning Assembly / Ingestion Gate)*: If `ambiguous_positions.length > 0` or `data_quality === 'AMBIGUOUS'`, wipe `geometries: []` and force `spatial = null` on the top-level warning to prevent any automated map render.
2. **Suggested Hemisphere — Strict Guard**:
   - `suggested_lat_dir` and `suggested_lon_dir` are **ONLY** populated when the resolved plugin declares an explicit `defaultHemisphereConvention` and the NAVAREA is verified single-hemisphere (e.g. Baltic $\rightarrow$ N/E).
   - Under the universal plugin or multi-hemisphere NAVAREAs, suggestions remain strictly `undefined` to eliminate automated guessing.
3. **Broadened Radius Normalisation Pattern**:
   - Regex matches:
     ```typescript
     /(?:(?:WITHIN\s+(?:A\s+)?)?RADIUS\s*(?:OF\s+)?|WITHIN\s+)\s*([0-9]+(?:\.[0-9]+)?)\s*(MILES?|NAUTICAL\s+MILES?|NM|METRES?|METERS?|M)\b/i
     ```
   - Catches: `RADIUS OF 0.6 MILES`, `WITHIN A RADIUS OF 500 METRES`, `WITHIN 0.6 MILES`, and `RADIUS 500 METRES`.
   - Converts metres to nautical miles ($1\text{ NM} = 1852\text{ m}$, rounded to 3 decimal places) and retains `raw_radius_text` and `raw_stated_unit` even if normalisation fails.
4. **Data Quality Roll-Up (Worst-of Policy)**:
   - Priority hierarchy: `INVALID` > `AMBIGUOUS` > `INFERRED` > `EXPLICIT`.
   - Feature-level rating attached to every geometry. Warning-level rating represents the worst rating across geometries, parsing anomalies, and grounding checks.
5. **Structured Grounding Diagnostics Attached to Warning**:
   - The full `GroundingDiagnostic` record is attached directly to `NavWarning.grounding_diagnostic` (not buried only in geometries) so operators can immediately see why a warning was verified or flagged.
6. **Universal Plugin Architecture with Regional Overrides**:
   - Isolates `jhodXiPlugin.ts` (100% preserving certified Rules 1–13, telex splitting, in-force reconciliation, OpenAPI schema).
   - Introduces `NavareaPlugin` interface supporting optional `coordinatePatterns` and `geometryKeywordMap`.
   - Provides `universalPlugin.ts` as standard IMO/IHO fallback for NAVAREAs I through XXI.

---

## 2. Core Technical Specifications

### A. Data Schema Updates (`src/types/index.ts` & `src/schemas/jhodAiContract.ts`)
```typescript
export type DataQualityRating = 'EXPLICIT' | 'INFERRED' | 'AMBIGUOUS' | 'INVALID';

export interface AmbiguousPosition {
  raw_text: string;
  reason: 'AMBIGUOUS_HEMISPHERE' | 'PARTIAL_HEMISPHERE' | 'MALFORMED' | 'UNRESOLVED_ROLE';
  has_lat_hem: boolean;
  has_lon_hem: boolean;
  suggested_lat_dir?: 'N' | 'S';
  suggested_lon_dir?: 'E' | 'W';
  line_number?: number;
}

export interface GroundingDiagnostic {
  grounded: boolean;
  checked_count: number;
  matched_phrases: string[];
  unmatched_phrases: string[];
  rejection_reason?: string;
  timestamp: string;
}

export interface RadiusSpecification {
  raw_text: string;
  stated_value: number;
  stated_unit: 'NM' | 'MILE' | 'METRE' | 'M';
  raw_stated_unit: string;
  radius_nm: number;
}
```

### B. Ordered Regex Precedence with Explicit Boolean Checks (`src/utils/coordinateParser.ts`)
The parser evaluates candidate coordinate pairs sequentially:
1. **Tier 1A - Sub-Second DMS**:
   `(\d{1,3})[°\s\-](\d{1,2})[′'\s\-](\d{1,2}\.\d+)[″"]?\s*([NS])[\s,]+(\d{1,3})[°\s\-](\d{1,2})[′'\s\-](\d{1,2}\.\d+)[″"]?\s*([EW])`
2. **Tier 1B - Standard DMS**:
   `(\d{1,3})[°\s\-](\d{1,2})[′'\s\-](\d{1,2})[″"]?\s*([NS])[\s,]+(\d{1,3})[°\s\-](\d{1,2})[′'\s\-](\d{1,2})[″"]?\s*([EW])`
3. **Tier 1C - Decimal Minutes (High Precision)**:
   `(\d{1,3})[°\s\-](\d{1,2}\.\d+)[′']?\s*([NS])[\s,]+(\d{1,3})[°\s\-](\d{1,2}\.\d+)[′']?\s*([EW])`
4. **Tier 1D - Integer Minutes**:
   `(\d{1,3})[°\s\-](\d{1,2})[′']?\s*([NS])[\s,]+(\d{1,3})[°\s\-](\d{1,2})[′']?\s*([EW])`
5. **Tier 1E - Decimal Degrees**:
   `(\d{1,3}\.\d+)[°]?\s*([NS])[\s,]+(\d{1,3}\.\d+)[°]?\s*([EW])`
6. **Tier 1F - Space/Punctuation Telex (e.g. 11 52 N 146 04 E)**:
   `(\d{1,3})\s+(\d{1,2}(?:\.\d+)?)\s*([NS])[\s,]+(\d{1,3})\s+(\d{1,2}(?:\.\d+)?)\s*([EW])`
7. **Tier 1G - Hemisphere Integrity & Defect Quarantine**:
   - Broad pre-filter detects candidate coordinate tuples (numbers followed by optional degrees/minutes/separators and optional single hemisphere letters, e.g. `16-54.1N 134-39.5` or `04-32-31.8 114-01-36.0`).
   - Check:
     ```typescript
     const hasLatHem = /[NS]/i.test(latPart);
     const hasLonHem = /[EW]/i.test(lonPart);
     ```
   - If `!hasLatHem || !hasLonHem` and no global convention:
     - Quarantine as `PARTIAL_HEMISPHERE` (if one is true) or `AMBIGUOUS_HEMISPHERE` (if neither is true).
     - Populate `has_lat_hem: hasLatHem` and `has_lon_hem: hasLonHem`.
     - Log matched tier as `Tier-1G-Quarantine`.
     - Empty `geometries: []`.
     - If plugin provides `defaultHemisphereConvention` and is single-hemisphere, set `suggested_lat_dir` / `suggested_lon_dir`, otherwise leave undefined.

### C. Radius Unit Normalisation Helper (`src/utils/coordinateParser.ts`)
```typescript
export function parseRadiusSpecification(text: string): RadiusSpecification | null {
  const regex = /(?:(?:WITHIN\s+(?:A\s+)?)?RADIUS\s*(?:OF\s+)?|WITHIN\s+)\s*([0-9]+(?:\.[0-9]+)?)\s*(MILES?|NAUTICAL\s+MILES?|NM|METRES?|METERS?|M)\b/i;
  const match = regex.exec(text);
  if (!match) return null;
  const val = parseFloat(match[1]);
  const rawUnit = match[2];
  const unitStr = rawUnit.toUpperCase();
  const isMetres = unitStr.startsWith('M') && !unitStr.startsWith('MI');
  const radius_nm = isMetres ? Math.round((val / 1852) * 1000) / 1000 : Math.round(val * 1000) / 1000;
  return {
    raw_text: match[0],
    stated_value: val,
    stated_unit: isMetres ? 'METRE' : 'NM',
    raw_stated_unit: rawUnit,
    radius_nm,
  };
}
```

### D. Modular Plugin Architecture (`src/schemas/plugins/`)
- **`types.ts`**:
  ```typescript
  export interface NavareaPlugin {
    navareaId: NavAreaId | 'UNIVERSAL';
    identityRegex: RegExp;
    cancellationPatterns: RegExp[];
    defaultHemisphereConvention?: { latDir: 'N' | 'S'; lonDir: 'E' | 'W' };
    coordinatePatterns?: RegExp[];
    geometryKeywordMap?: Record<string, SemanticGeometryType>;
    systemInstruction: string;
    parseIdentity(rawText: string): { number: string; year: number; referenceId: string } | null;
  }
  ```
- **`jhodXiPlugin.ts`**: Implements `NavareaPlugin` for JHOD NAVAREA XI, preserving Rules 1–13, telex splitting, in-force reconciliation, and OpenAPI schema.
- **`universalPlugin.ts`**: Standard IMO/IHO fallback for NAVAREAs I through XXI.
- **`registry.ts`**: Plugin dispatcher with fallback to `universalPlugin`.

### E. Belt-and-Suspenders Empty Geometry Enforcement
In warning assembly:
```typescript
if ((warning.ambiguous_positions && warning.ambiguous_positions.length > 0) || warning.data_quality === 'AMBIGUOUS' || warning.data_quality === 'INVALID') {
  warning.spatial = null;
  warning.geometries = [];
}
```

### F. Operator Review UI Updates (`src/components/ManualParserView.tsx`)
1. **Data Quality Pill**:
   - `EXPLICIT` (Emerald pill)
   - `INFERRED` (Amber pill)
   - `AMBIGUOUS` (Rose pill with quarantine icon)
   - `INVALID` (Dark red pill)
2. **Quarantined Positions Banner**:
   - Displays defect details (missing latitude hemisphere vs missing longitude hemisphere).
   - If `suggested_lat_dir` / `suggested_lon_dir` are present, provides one-click manual confirmation button.
3. **Grounding Diagnostics Panel**:
   - Expandable inspector showing `grounding_diagnostic.matched_phrases` and `unmatched_phrases`.

---

## 3. Comprehensive Test Matrix

1. **JHOD NAVAREA XI Regression Test Suite**:
   - All 19 raw notices from corpus (`0455/26` through `0034/26`).
   - Expect 100% pass on identity, manifest reconciliation, geometry grounding, and self-cancels.
2. **Hemisphere Integrity Tests**:
   - *Completely absent*: `DERELICT BARGE IN 11-52 146-04` $\rightarrow$ Quarantined as `AMBIGUOUS_HEMISPHERE`, `has_lat_hem: false`, `has_lon_hem: false`, `geometries: []`, `data_quality: AMBIGUOUS`.
   - *Partial hemisphere*: `HATCH COVER IN 16-54.1N 134-39.5` (missing E) $\rightarrow$ Quarantined as `PARTIAL_HEMISPHERE`, `has_lat_hem: true`, `has_lon_hem: false`, `geometries: []`, `data_quality: AMBIGUOUS`.
3. **Radius Normalisation Tests**:
   - `RADIUS OF 0.6 MILES` $\rightarrow$ `0.6` NM.
   - `WITHIN 0.6 MILES` $\rightarrow$ `0.6` NM.
   - `RADIUS 500 METRES` $\rightarrow$ `0.270` NM.
   - `WITHIN A RADIUS OF 500 METRES` $\rightarrow$ `0.270` NM.
4. **Universal Plugin Routing**:
   - Test sample warnings from NAVAREA I, IV, and V.
5. **Codebase Verification**:
   - `lint_applet` and `compile_applet` must pass cleanly.

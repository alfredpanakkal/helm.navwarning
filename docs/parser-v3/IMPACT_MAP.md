# Helm.Warning — Parser v3.0 Impact Map (Phase 0 Recon)

## 1. Domain Types (`src/types/navarea.ts`, `src/types/maritime.ts`, `src/types.ts`, `src/schemas/`)
- **`NavWarnCoordinate`**: `{ lat: number; lng: number; label?: string; eta?: string; isGhost?: boolean; }`
- **`NavWarnGeometry`**: `{ archetype: Archetype; coordinates: NavWarnCoordinate[]; polygons?: NavWarnCoordinate[][]; radiusNm?: number; clearanceNm?: number; statedRadiusNm?: number; displacementVector?: { from: NavWarnCoordinate; to: NavWarnCoordinate; }; regionName?: string; bbox?: [number, number, number, number]; }`
- **`Archetype`**: `'point' | 'point_radius' | 'polygon' | 'polyline' | 'corridor' | 'multipoint' | 'relocation' | 'geometry_group' | 'region' | 'drift_vector' | 'none'`
- **`Lifecycle`**: `{ inForce: boolean; cancelledBy?: string[]; expiresAt?: string; supersedes?: string[]; supersededBy?: string[]; truncated?: boolean; isPartialList?: boolean; unplottedReason?: ...; resolutionRule?: ...; resolutionRefs?: string[]; }`
- **`RawMessageBlock`**: `{ warningId: string; navarea: string; number: number; year: number; rawHeader: string; rawBody: string; rawText: string; issuedAt?: string; subjectCode?: string; regionTokens: string[]; charts: string[]; truncated?: boolean; filePosition: number; sourceFeed: string; }`
- **`HazardCategory`**: 16 categories (`sar`, `mil_fire`, `uxo`, `weather`, `ice`, `security`, `drift`, `wreck`, `cable`, `survey`, `rig`, `aton`, `restricted`, `ops`, `service_status`, `general_chart`)
- **`DisplayStyle`**: `'critical' | 'high' | 'active' | 'verified' | 'neutral'`
- **`AtoNStatus`**: `'alert' | 'info' | 'chart_correction' | 'relocation' | 'standard'`
- **`MaritimePlot`**: `{ id: string; warningId: string; navarea: string; hazardType: HazardType; plotType: PlotType; coordinates: [number, number][]; radiusNm?: number; bufferNm?: number; bearingDeg?: number; areaSqNm?: number; lengthNm?: number; label: string; rawTextSnippet: string; }`

## 2. Parser Callers & Function Inventory (11 Parsers)
1. **`atonStatus.ts`**: Called by warning classifier / UI badge renderers.
2. **`berthParser.ts`**: Called by `geometryExtractor.ts`.
3. **`coordinateParser.ts`**: Called by `geometryExtractor.ts`, `server.ts`, and test scripts.
4. **`geometryExtractor.ts`**: Called by `MaritimeMap.tsx`, `server.ts`, export utils.
5. **`headerParser.ts`**: Called by message splitter and corpus ingestion scripts.
6. **`inForceListParser.ts`**: Called by `server.ts` ingestion, lifecycle resolution, and `inForceListParser.test.ts`.
7. **`labelExtractor.ts`**: Called by `geometryExtractor.ts`.
8. **`lifecycle.ts`**: Called by `server.ts` sync engine and warning lifecycle status calculation.
9. **`messageSplitter.ts`**: Called by `server.ts` ingestion and corpus build scripts.
10. **`temporalParser.ts`**: Called by warning processors and UI detail modals.
11. **`warningClassifier.ts`**: Called by `MaritimeMap.tsx`, `DataBank.tsx`, and warning cards.

## 3. Database & State Store
- **Table**: `public.nav_warnings` (Supabase PostgreSQL via `@supabase/supabase-js`).
- **Columns**: `warning_id`, `navarea`, `series`, `source_warning_id`, `warning_number`, `warning_year`, `issued_at`, `valid_from`, `valid_to`, `status`, `raw_text`, `spatial` (JSONB), `ai_triage` (JSONB), etc.
- **State Storage**: Stored as JSONB records and in-memory fallback store (`server.ts`).

## 4. Test Infrastructure
- **Runner**: Vitest v5.0.4 (`npm test` runs `vitest run src/`).
- **Smoke Tests**: Playwright (`npm run ux:smoke` runs `playwright test`).

## 5. Verification Queue & Public Portal
- **Verification / Admin**: `admin.html`, admin tabs, ingestion procedures.
- **Public Map / Portal**: `index.html`, `App.tsx`, `MaritimeMap.tsx`, `DataBank.tsx`. Renders `point`, `polygon`, `line`, `corridor`, `circle`, `drift_vector`.

## 6. Deterministic vs AI Pipeline
- Deterministic parsers run first. LLM-assisted / Gemini extraction runs as a fallback when deterministic confidence is low or when raw feeds require unstructured parsing.

## 7. Lifecycle Execution
- `processCorpusLifecycle` runs during corpus building (`scripts/build_full_corpus.ts`) and server sync (`api/supabase/sync.ts`).

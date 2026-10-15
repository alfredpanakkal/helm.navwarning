# NAVAREA v4 Test Restore & Comprehensive Validation Plan

A deterministic recovery and validation workflow to restore the NAVAREA v4 test harness, integrate the standalone `src/riglistParser.ts`, run the full probe and adversarial stress test suites, and produce certified scorecards without modifying test assertions.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The delivery strategy and file placement have been confirmed:
> - **Two-Stage Restore Delivery**: Code blocks will be received and integrated in two sequential batches: Files 1 & 2 first (`src/riglistParser.ts` and pipeline wiring), followed by Files 3 & 4 (`riglist-probe.test.ts` and `navarea-stress.test.ts`).
> - **Root-Relative Module Placement**: The riglist parser is positioned at `src/riglistParser.ts` to maintain 100% path compatibility with existing test imports.
> - **Zero Test Modification Invariant**: Test assertions in `riglist-probe.test.ts` and `navarea-stress.test.ts` remain strictly immutable. Any divergence between parser output and test expectation must be resolved in the parser implementation or reported as an evidence-backed spec conflict.
> - **Precedence Chain Integrity**: The resolved contradiction log (2 arbitrations: IX 103/24 in-force membership vs stale supersession, and IV 977/24 Tier 2 cross-cancel over Tier 4 supersession) remains intact and protected against regression.

---

## 1. Overview & Core Concept

### What It Does
Restores the comprehensive test harness for the NAVAREA v4 maritime safety pipeline. It integrates the high-density RIGLIST parser (extracting drilling units, coordinates, and regional sectors from complex tabular telexes such as NAVAREA I 223/26), installs the dedicated evaluation probe and stress suites, and executes full verification across all spatial archetypes, coordinate repairs, and lifecycle transitions.

### Target Audience & Persona
Navigational analysts, maritime safety auditors, and test engineers verifying zero silent drops, precise spatial coordinates (including negative W-longitudes), and rock-solid rule precedence across global NAVAREA broadcasts.

### Key Value
- **Full Ingestion Accountability**: Proves every single rig entry and hazardous entity is parsed with precise spatial coordinates.
- **Auditable Rig Extraction**: Captures all 43 rig positions, negative West longitudes, and 4 distinct geographical groups from NAVAREA I 223/26.
- **Zero-Drop Blocker Defense**: Ensures S1–S4 blocker requirements in the stress test suite pass cleanly with detailed scorecards.

---

## 2. User Experience & Visual Design

### Test Execution & Scorecard Reporting Flow
1. **Stage 1 Intake**:
   - Ingest and verify `src/riglistParser.ts` (File 1) and any pipeline wiring (File 2).
   - Ensure clean compilation and export compatibility with existing parsers.

2. **Stage 2 Intake**:
   - Ingest and place `src/__tests__/riglist-probe.test.ts` (File 3) and `src/__tests__/navarea-stress.test.ts` (File 4).
   - Verify unescaped template literals, intact regexes, and pristine test syntax.

3. **Automated Suite Execution**:
   - Execute `npx vitest run riglist-probe.test.ts` to evaluate the 43-rig extraction, coordinate sign conversion (W → negative), and quadrant sector grouping.
   - Execute `npx vitest run navarea-stress.test.ts` to evaluate S1–S4 blocker scenarios and stress criteria.

4. **Transparent Scorecard Publication**:
   - Output both complete test run scorecards in the terminal and chat summary with exact assertion pass/fail matrices and timing.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Root-Relative `src/riglistParser.ts` Placement
- **Chosen Approach**: Place `riglistParser.ts` directly in `src/` rather than inside `src/parsers/`.
- **Why**: Existing test suites import directly from `../riglistParser` or `src/riglistParser`. Preserving this location avoids re-export indirection and prevents test file churn.
- **Alternatives Considered**: Placing in `src/parsers/riglistParser.ts` with re-exports in `src/index.ts` was considered, but rejected to guarantee zero edits to test imports.

### Decision 2: Strict Coordinate Sign Handling (West / South Conversion)
- **Chosen Approach**: Rig coordinates with `W` hemisphere suffix are parsed to negative decimal longitudes (`-DDD.dddd`), and `S` latitudes to negative decimal latitudes.
- **Why**: Navigational cartography (Leaflet/GIS) strictly requires signed decimal degrees for accurate spatial geometry.

### Decision 3: Sector and Group Preservation
- **Chosen Approach**: Group rig entries into their 4 respective geographical zones (e.g., North Sea, Norwegian Sea, English Channel, West of Shetland) as demarcated in NAVAREA I 223/26.
- **Why**: Preserves operational context so mariners can filter and isolate drilling units by operating basin.

---

## 4. Technical Architecture & Data Strategy

### Component & Execution Flow

```
┌────────────────────────────────────────────────────────┐
│            NAVAREA I 223/26 Tabular Rig Telex          │
│               (43 Rigs across 4 Groups)                │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               src/riglistParser.ts                     │
│  ├─ Header & Group Demarcation Extractor               │
│  ├─ Rig Name & Status Tokenizer                        │
│  ├─ Coordinate Parser (Deg/Min to Signed Decimal)      │
│  └─ Group Aggregator (4 Groups, 43 Entities)           │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│  riglist-probe.test.ts    │ │   navarea-stress.test.ts  │
│  • 43 Positions Asserted  │ │  • S1: Adversarial Spans  │
│  • Negative W-Longitudes  │ │  • S2: Coordinate Zoo     │
│  • 4 Groups Validated     │ │  • S3: Lifecycle Invariants│
│  • Zero Dropped Entities  │ │  • S4: Blocker Matrix     │
└───────────────────────────┘ └───────────────────────────┘
```

### Next Steps Upon Approval
1. Request the user paste Files 1 & 2 (`src/riglistParser.ts` and integration code).
2. Write and compile the parser modules.
3. Request the user paste Files 3 & 4 (`riglist-probe.test.ts` and `navarea-stress.test.ts`).
4. Execute `npx vitest run riglist-probe.test.ts` and `npx vitest run navarea-stress.test.ts`.
5. Present the complete test scorecards.

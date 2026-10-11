# JHOD NAVAREA XI Structured-Output Parser & Hallucination Guard

A specialized, certified Maritime Safety Information (MSI) extraction pipeline for Japan Hydrographic-Oceanographic Department (JHOD) NAVAREA XI telex bulletins, powered by Gemini 3.1 Flash Lite structured output (`config.responseSchema`), with a zero-tolerance coordinate hallucination guard and deterministic fallback.

## User Review & Critical Decisions

> [!IMPORTANT]
> The architectural directions below were confirmed in Phase 1 clarification:

- **Confirmed Integration Surface**: Fully wired into both the backend API (`server.ts` routes `/api/ai/parse-jhod` and `/api/parse-manual`) and the frontend Manual Parser UI (`ManualParserView.tsx`).
- **Confirmed Hallucination Policy**: If Gemini emits any coordinates not found verbatim in the raw input block, the system rejects the AI geometries, falls back to deterministic regex parsing, and flags the notice for watchstander review (`is_verified: false`, audit note tagged).
- **Confirmed Default Model**: `gemini-3.1-flash-lite` configured with `temperature: 0`, `responseMimeType: "application/json"`, and the OpenAPI response schema.

---

## 1. Overview & Core Concept

### What It Does
Converts unstructured, hard-wrapped radio-telex text blocks from JHOD (Japan Coast Guard) NAVAREA XI bulletins into strictly validated WGS 84 geographic warnings and in-force manifest records.

### Target Audience & Persona
Maritime watchstanders, ECDIS navigators, and safety officers reviewing high-traffic Western Pacific sea lanes (Japan, Marshall Islands, South China Sea, East China Sea).

### Key Value
- **Zero Coordinate Invention**: Every latitude and longitude must have an exact character-for-character origin in the raw bulletin.
- **No-Data-Loss Contract**: Any unparsed lines (e.g. advisory remarks, tsunami warnings) are captured in `unparsed_lines` and preserved in the audit log.
- **Bi-Modal Processing**: Distinguishes between individual operational warnings and multi-warning `IN_FORCE_MANIFEST` status blocks.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Manual Parser Workflow (`ManualParserView.tsx`)**:
   - The operator selects the **"JHOD NAVAREA XI (Japan)"** preset button or pastes a telex block (e.g., `NO.26-0453`).
   - The UI displays an active **"Gemini Structured Output (JHOD Schema)"** badge.
   - Upon clicking **Parse**, the system invokes the backend endpoint.
   - If the AI coordinates match the input verbatim, a green **"Verbatim Grounding Verified"** badge appears with parsed geometries on the Leaflet map preview.
   - If the hallucination guard triggers, an amber warning banner appears: *"Hallucination Guard Engaged: Raw text lacked verbatim coordinate; fell back to deterministic parser"*.
2. **Batch & API Ingestion**:
   - Ingestion jobs send blocks to `/api/ai/parse-jhod`, receiving normalized `NavWarning` records ready for Supabase persistence in schema `navarea_11`.

### Interactive Feedback & States
- **Parsing Spinner**: Displays model status (*"Gemini 3.1 Flash Lite structured extraction in progress..."*).
- **Inspection Drawer**: Shows extracted details (AtoN light characteristics, towed cable lengths, work vessel names, and cancellation references).
- **Audit Line Counter**: Highlights the count of unparsed lines to ensure 100% data traceability.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Dedicated Contract Module (`src/schemas/jhodAiContract.ts`)
- **Chosen Approach**: Isolate the system instruction, OpenAPI `responseSchema`, and TypeScript interfaces in a dedicated contract file.
- **Why**: Clean separation of concerns; simplifies unit testing and enables copy-paste synchronization with Google AI Studio prompts.
- **Alternatives Considered**: Inlining the 100-line JSON schema inside `server.ts` was rejected due to maintainability and testing complexity.

### Decision 2: Verbatim Coordinate Hallucination Guard
- **Chosen Approach**: Before accepting AI geometries, normalize whitespace and verify that every substring in `raw_coordinate_text` appears inside the raw input block.
- **Why**: Maritime safety mandates absolute navigational integrity. An LLM must never hallucinate a reef or drifting barge coordinate.
- **Fallback**: Automatically runs `parseCoordinatesDeterministic` and marks `extraction_method: "deterministic_hallucination_fallback"`.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RAW JHOD TELEX INPUT                            │
│  "NO.26-0453 Date:2026/10/09 13 UTC ... 05-05.79N 167-14.00E ..."     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   BACKEND ROUTE (/api/ai/parse-jhod)                   │
│  - Gemini 3.1 Flash Lite (@google/genai SDK)                           │
│  - System Instruction: certified MSI parser rules                      │
│  - Config: responseSchema (OpenAPI subset) + responseMimeType JSON     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   HALLUCINATION GUARD & AUDIT CHECK                    │
│  - Check: raw_coordinate_text ⊆ raw_input_block                        │
│  ├─ PASS ──► Convert to NavWarning (WGS 84 GeoJSON + Details)          │
│  └─ FAIL ──► Deterministic Fallback + Flag is_verified: false          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                   ┌────────────────┴────────────────┐
                   ▼                                 ▼
┌─────────────────────────────────────┐  ┌───────────────────────────────┐
│       MANUAL PARSER VIEW (UI)       │  │   SUPABASE DATABASE (navarea_11│
│  - Map preview                      │  │   & public.nav_warnings)      │
│  - Geometry inspection              │  │  - Verbatim raw_messages      │
│  - AtoN / Vessel / Cable badges     │  │  - Parsed warning attributes  │
└─────────────────────────────────────┘  └───────────────────────────────┘
```

### Component & File Mapping
- **`src/schemas/jhodAiContract.ts`**: Contains `jhodSystemInstruction`, `jhodResponseSchema`, TypeScript types (`JhodWarningOutput`), and the `verifyCoordinateGrounded()` guard.
- **`server.ts`**:
  - Implements route `POST /api/ai/parse-jhod`.
  - Updates `/api/parse-manual` to support `mode: "jhod_structured"`.
  - Connects `@google/genai` with model `gemini-3.1-flash-lite`.
- **`src/components/ManualParserView.tsx`**:
  - Adds JHOD NAVAREA XI template button.
  - Adds parsing mode toggle and validation badges.
- **`src/services/api.ts`**:
  - Exports `parseJhodWarning(rawText: string)`.

# Helm.Warning — Admin Section Design Critique Framework & Baseline Audit Plan

A structured methodology and live baseline critique for the **Helm.Warning Admin Console** (`admin.html` and `public/assets/js/admin.js`), balancing maritime safety operator rigor (`CORRECT + TRACEABLE + EXPLICITLY UNCERTAIN`) with enterprise UI design system standards.

---

## User Context & Confirmed Decisions

> [!IMPORTANT]
> The following parameters were confirmed via clarifying discovery:
> - **Deliverable Location**: Authoritative reference document located at `/docs/admin-design-critique-framework.md`.
> - **Scope**: Complete evaluation framework methodology **plus** a comprehensive, live baseline audit of all 5 existing admin console sub-tabs (Overview, Pipeline Orchestrator, Import Wizard, Verification Queue, System Diagnostics).
> - **Evaluator Perspective**: Balanced maritime safety operator and UI design system perspective, ensuring that human-in-the-loop safety, PostGIS geometry fidelity, and zero-fabrication rules carry equal weight with WCAG 2.1 AA accessibility, token consistency, and interaction ergonomics.

---

## 1. Overview & Framework Architecture

The framework establishes an ongoing, repeatable protocol for critiquing, testing, and hardening administrative interfaces in safety-critical maritime warning systems.

### Scope of the Framework
1. **Critique Structure**:
   - What Works Well (strengths, alignment with tokens, established affordances).
   - Areas for Improvement (cognitive friction, accessibility gaps, risk surfaces).
   - Questions and Concerns (ambiguities, data traceability, edge-case risks).
   - Actionable Recommendations (direct, code-level remediation steps).
2. **Evaluation Criteria**:
   - Usability (task efficiency, error tolerance, cognitive load during watchkeeping).
   - Visual Design (typography scale, spatial density, visual hierarchy, dark theme cohesion).
   - Accessibility (WCAG 2.1 AA, keyboard roving tabindex, screen reader live regions, touch targets).
   - Consistency (strict adherence to design tokens `--critical`, `--high`, `--active`, `--verified`, `--neutral`).
   - Innovation (intelligent pre-flight triage, spatial verification, differential auditing).
3. **Feedback Categories**:
   - User Experience (operator mental models, navigational flow, triage throughput).
   - Visual Design (token discipline, color semantics, typography hierarchy).
   - Interaction Design (state transitions, debounce/spinners, destructive confirmations).
   - Content & Copy (maritime terminology, WWNWS/GMDSS standard phrasing, clear error notices).
   - Technical Feasibility & Security (RLS policies, SSRF bounds, service-role isolation, API limits).
4. **Feedback Format & Priority Matrix**:
   - Standard observation template with Observation, Impact Assessment, Priority Level (P0–P3), and Suggested Solution.
   - Maritime Priority Scale:
     - **P0 Safety-Critical**: Risk of false navigational publication, coordinate distortion, or silent guessing.
     - **P1 Operational Blocker**: Functional failure, broken authentication, or unhandled pipeline state.
     - **P2 Operator Friction / Polish**: Inefficient workflow, minor token deviation, lack of keyboard shortcuts.
     - **P3 Enhancement / Innovation**: Advanced spatial preview, historical diff inspection, telemetry enhancements.
5. **Collaborative Approach & Review Lifecycle**:
   - Presentation protocol (objective, blameless, evidence-backed with DOM/code references).
   - Reception and triage workflow for engineering and GIS teams.
   - Follow-up verification (Playwright UX smoke tests, schema contract validation).
   - Documentation & change logs.

---

## 2. Live Baseline Evaluation of Existing Admin Console

The deliverable will apply the framework directly to the current implementation (`admin.html` and `public/assets/js/admin.js`), inspecting:

### Tab 1: Overview
- **Strengths**: Clear high-level health card, quick action shortcuts, clean connection status.
- **Deficiencies**: Static pipeline status without real-time worker heartbeat; quick action cards lack keyboard focus outlines.

### Tab 2: Pipeline Orchestrator
- **Strengths**: 4-stage pipeline visualization (Fetch -> Parse -> Geocode -> Publish).
- **Critical Deficiency (P0/P1)**: `runPipelineCycle()` executes a simulated 2-second sleep (`showToast('Pipeline cycle complete (simulated)')`), violating the fundamental project rule against fabricating pipeline activity. Plan outlines real worker trigger / RPC status binding.

### Tab 3: Bulk Import Wizard
- **Strengths**: 4-step linear progression, live line/byte calculation, real-time Supabase subscription (`manual_ingest_queue`).
- **Deficiencies**: Only "Paste Warning Text" is enabled; CSV/GPX/S-124 methods are absent or unselectable; Step 3 pre-flight lacks coordinate extraction preview.

### Tab 4: Verification Queue (Safety-Critical)
- **Strengths**: Displays raw message text, promotes to Tier A with operator audit entry in `nav_warning_audits`.
- **Critical Deficiencies (P0/P1)**:
  - "Verify All" button executes bulk promotion without requiring per-warning coordinate or geometry confirmation, creating a high-risk failure mode for maritime safety.
  - Absence of Leaflet map preview or coordinate bounding box in the verification card: operator cannot visually confirm geometry before publishing.
  - Hardcoded fake `severity: 'HIGH'` fallback instead of reflecting authoritative `categories` array.

### Tab 5: System Diagnostics
- **Strengths**: Live Gemini API connection test with real latency benchmarking; schema reference display.
- **Deficiencies**: Schema display is static hardcoded text rather than queryable diagnostics; Mistral fallback status is missing from the AI Extraction chain display.

---

## 3. Implementation Deliverable

- **Primary Artifact**: `/docs/admin-design-critique-framework.md`
- **Structure**:
  1. Executive Summary & Purpose
  2. The 5-Pillar Critique Methodology
  3. Evaluation Criteria & Maritime Scoring Rubrics
  4. Standardized Feedback Protocol & Priority Matrix
  5. Collaborative Governance & Follow-Up Lifecycle
  6. Comprehensive Baseline Audit of Existing Admin Console (Tabs 1–5 with concrete code references)
  7. High-Priority Remediation Roadmap & Test Plan
- **Verification**:
  - Validate markdown formatting and internal links.
  - Verify that no admin secrets or operational credentials are included.
  - Run `compile_applet` and `lint_applet` to ensure repository integrity.

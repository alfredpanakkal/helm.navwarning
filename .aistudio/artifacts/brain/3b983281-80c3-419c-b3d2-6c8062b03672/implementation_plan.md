# Implementation Plan: Helm.Warning Administrator Console Audit & Hardening

Comprehensive roadmap for consolidating the console audit fixes and systematically hardening the 9 administrator workflows across HTML, CSS, and TypeScript.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The primary tab switching blockage (caused by client-side admin-mode gating, dev server route rewrites, and z-index collisions) has been resolved. This plan defines the hardening and verification checklist for each administrator tab.

- **Confirmed Architecture**: The admin console (`/console`) operates with read-only inspection by default for unauthenticated operators, while write mutations (verifying warnings, committing manual parses, and triggering ingestion procedures) are strictly guarded both on the client (`isAdminMode`) and on the server (`server/auth.ts` Bearer JWT role verification).
- **Design System Constraint**: Pure Helm.Ports design token scale (`src/index.css`), single accent `#2b6e8c`, weight ≤ 500, no shadows, no pill shapes, Inter typography.

---

## 1. Overview & Core Concept

**Helm.Warning** is an operational maritime safety information (MSI) decision-support platform. The administrative console provides watchstanders and hydrographic administrators with safety-critical verification, ingestion orchestration, and geometry validation tools.

### Administrator Console Views
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             HELM.WARNING CONSOLE                            │
├─────────────┬───────────────────────────────────────────────────────────────┤
│ [Nav Rail]  │  [Operator Mode Banner: Read-Only / Admin Session Active]     │
│             ├───────────────────────────────────────────────────────────────┤
│ • Map       │                                                               │
│ • Data Bank │   ACTIVE TAB VIEWPORT (1 of 9 Canonical Administrator Views)  │
│ • Sources   │                                                               │
│ • Pipeline  │   - Map View: Spatial projection & layers popover             │
│ • Imports   │   - Data Bank: Tier B verification queue & inline review      │
│ • Manual    │   - Sources: Hydrographic candidate registry                  │
│ • Audit     │   - Pipeline: Ingestion procedure orchestrator                │
│ • Evidence  │   - Bulk Import: CSV / GPX / S-124 validator                  │
│ • Supabase  │   - Manual Parser: Deterministic rule-first coordinate parser │
│             │   - Audit Log: Append-only ledger & atomic generation records │
│             │   - Evidence Locker: Raw bulletin artifact storage            │
│             │   - Supabase Server: PostgREST & RLS connectivity diagnostics │
└─────────────┴───────────────────────────────────────────────────────────────┘
```

---

## 2. Administrator Tabs Audit & Hardening Matrix

### Tab 1: Map View (`#/warnings/map` or `#/map`)
- **Status**: Operational.
- **Key Capabilities**: Leaflet maritime map, Esri Ocean Base, seamarks, cluster markers, spatial geometry overlay.
- **Hardening Items**:
  - Verify coordinate projection and null-island quarantine (prevent plotting `[0, 0]` on unparsed points).
  - Synchronize map selection bidirectionally with the selected warning detail drawer.
  - Ensure layers settings popover uses CSS design tokens with no hardcoded offsets.

### Tab 2: Data Bank & Verification Queue (`#/warnings/list` or `#/databank`)
- **Status**: Operational.
- **Key Capabilities**: Full MSI inventory, Tier A / Tier B classification, inline inspection, status filtering (active, cancelled, expired, superseded, unverified).
- **Hardening Items**:
  - Enforce single-fire guards (`verifyPending`, `verifyingIds`) so double-clicking verification buttons never generates duplicate audit records.
  - Ensure the Quick Verify FAB renders only when unverified candidates exist and an authenticated administrative session is active.
  - Verify optimistic locking via `expected_updated_at` (returns 409 on conflict).

### Tab 3: Candidate Sources Registry (`#/sources` or `#/ingest/sources`)
- **Status**: Operational.
- **Key Capabilities**: Hydrographic provider registry, fetch frequency, source health, and toggle controls.
- **Hardening Items**:
  - Verify source toggling is protected by session verification and disables the control while in flight.
  - Maintain SSRF approved-host validation for all hydrographic endpoint configurations.

### Tab 4: Workspace Pipeline Orchestrator (`#/ingest/pipeline` or `#/workspace`)
- **Status**: Operational.
- **Key Capabilities**: 4-stage pipeline visualization (Fetch Sources → Parse & Normalize → Geocode Geometry → Publish Generation).
- **Hardening Items**:
  - Ensure Ingestion Procedure modal cannot trigger duplicate concurrent pipeline runs (`isRefreshing` guard).
  - Verify pipeline run telemetry correctly records in `pipeline_runs` table with atomic generation pointers.

### Tab 5: Bulk Import Wizard (`#/ingest/bulk` or `#/imports`)
- **Status**: Operational.
- **Key Capabilities**: CSV, GPX, and S-124 ZIP batch ingestion with pre-validation.
- **Hardening Items**:
  - Hard coordinate bounds validation (Latitude: -90° to +90°, Longitude: -180° to +180°).
  - Never clamp invalid values (e.g. `91°N` must be marked invalid, not clamped to `90°N`).
  - Batch commit confirmation requires active admin session.

### Tab 6: Manual Warning Parser & Override (`#/ingest/manual` or `#/manual`)
- **Status**: Operational.
- **Key Capabilities**: Raw text input, rule-first coordinate extraction, AI escalation preview, geometry builder.
- **Hardening Items**:
  - Never guess hemisphere; flag ambiguous coordinates as `AMBIGUOUS`.
  - Ensure rule-parsed coordinates are stamped `RULE_PARSED`, reserving `VERIFIED` strictly for human verification.
  - Keep raw bulletin text immutable and untruncated.

### Tab 7: Generation Audit Ledger (`#/trace/audit` or `#/audit`)
- **Status**: Operational.
- **Key Capabilities**: Append-only log of all warning modifications and verifications (`nav_warning_audits`).
- **Hardening Items**:
  - Verify that failed audit inserts persist an `AUDIT_FAILED` record and refuse un-audited state updates.
  - Maintain human-readable timestamp and operator ID formatting.

### Tab 8: Evidence Locker (`#/trace/evidence` or `#/evidence`)
- **Status**: Operational.
- **Key Capabilities**: Object storage inspection of raw bulletin artifacts and source payloads.
- **Hardening Items**:
  - Verify read-only artifact viewer with cryptographic hash checksum display.
  - Retain raw source lineage for all extracted warnings.

### Tab 9: Supabase Server Hub (`#/system/supabase` or `#/supabase`)
- **Status**: Operational.
- **Key Capabilities**: Real-time database connection diagnostics, schema version inspection, RLS policy verification.
- **Hardening Items**:
  - Verify live ping to PostgREST endpoint with latency metrics.
  - Ensure zero authenticated write policies are exposed on public tables.

---

## 3. Technical Architecture & Security Boundary

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER (React SPA)               │
│                                                             │
│  [Read-Only Operations]          [Admin Mutating Operations]│
│  - Browse all 9 tabs             - Verify Warning           │
│  - Filter / Search Data Bank     - Save Edited Geometry     │
│  - Inspect Audit Ledger          - Run Ingestion Pipeline   │
│  - View Evidence Artifacts       - Toggle Source Active     │
│          │                                   │              │
│          ▼ Direct PostgREST                  ▼ Bearer JWT   │
└──────────┬───────────────────────────────────┬──────────────┘
           │                                   │
           │                                   ▼
           │                     ┌───────────────────────────┐
           │                     │   SERVERLESS API / ADMIN  │
           │                     │   (api/admin/*.ts)        │
           │                     │                           │
           │                     │   verifyAdminRequest()    │
           │                     │   (app_metadata.role in   │
           │                     │    {admin, superadmin})   │
           │                     └─────────────┬─────────────┘
           │                                   │
           ▼                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE POSTGRESQL                     │
│  - public.nav_warnings (RLS read-only for anon)             │
│  - public.nav_warning_audits (append-only ledger)           │
│  - public.pipeline_runs (atomic execution records)          │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Verification & Testing Plan

1. **Static Analysis & Type Checking**:
   - `tsc --noEmit` clean compilation (0 errors).
   - Verify all 22 Vitest test suites (220 tests) pass.
2. **Interactive UI Verification**:
   - Verify instant switching across all 9 tabs via mouse click on sidebar navigation rail.
   - Verify keyboard shortcut single-key jumps (`m`, `d`, `s`, `p`, `i`, `n`, `a`, `e`, `y`).
   - Verify deep linking: direct navigation to `/#/warnings/list`, `/#/ingest/pipeline`, `/#/system/supabase`, etc.
   - Verify the "Console Read-Only Mode" banner appears cleanly when signed out, and opens the login prompt upon clicking "Admin sign in".
   - Verify all mutating actions remain disabled or gated when in read-only mode.

---

## 5. Console Dock & Content Frame Dynamic Reflow (COMPLETED)

Remediated the layout defect where the fixed navigation dock obscured the left 32px–200px of content across console tabs.

- **Root Cause**: `<main>` had `sm:p-6` (`padding: 1.5rem = 24px`), which clobbered `.console-rail-pad-lg` in the cascade. The fixed dock (56px collapsed or 224px expanded) therefore sat directly on top of the left side of the content.
- **Solution**:
  - Bound `--active-rail-w` to `224px` by default and `56px` when `.console-rail-collapsed`.
  - Introduced `.console-content-frame` with `margin-left: var(--active-rail-w) !important` and `width: calc(100% - var(--active-rail-w)) !important`.
  - Synchronized CSS transitions (`transition: margin-left 0.15s ease, width 0.15s ease`) with the dock width transition (`transition: width 0.15s ease`), allowing content to automatically and smoothly adjust as the dock size changes.


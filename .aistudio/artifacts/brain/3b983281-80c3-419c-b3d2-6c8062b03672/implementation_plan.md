# Implementation Plan: Standalone Complete Frontend Single HTML File

Build a complete, production-grade, self-contained single HTML file (`public/export/helm-warning-complete.html`) uniting both the **Public Maritime Portal** and the **Gated Admin Console**, with all CSS tokens, vendor libraries (Leaflet, Supabase JS), and client operational logic inlined for 100% offline functionality.

---

## 1. Overview & Scope

### Core Objective
Produce a single, standalone distribution file (`public/export/helm-warning-complete.html`) that can be opened locally in any browser (via `file://` or static HTTP server) without external CDN or asset dependencies.

### What is Included
1. **Public Portal**:
   - Interactive Leaflet maritime chart with layer controls, quick-recenter pill, and floating warning list.
   - NAVAREA Data Bank with live search, multi-level dropdown filters (NAVAREA, Severity, Category), inline accordion inspection (`.table-detail-row`), and mobile cards.
   - Executive statistics strip (in-force count, global coverage %, critical/high tally, georeferencing status).
   - Global Hydrographic Source Registry cards with status badges and authority metadata.
2. **Admin Console & Login Gate**:
   - Secure login view with session persistence in `sessionStorage` (2-hour expiry).
   - 5 Operational Sub-tabs: Overview (Attention items & quick actions), Pipeline Orchestrator (live stage visualization), Bulk Import Wizard (4-step parsing & atomic publishing), Verification Queue (human-in-the-loop triage), and System Diagnostics (AI connectivity & database schema).
   - Seamless top-bar transition between Public Site view and Admin Console.
3. **100% Offline Self-Containment**:
   - Inlined vendor libraries: Leaflet v1.9.4 JS & CSS directly from local `node_modules/leaflet/dist/`.
   - Inlined Supabase client: `@supabase/supabase-js` v2 UMD bundle from `node_modules/@supabase/supabase-js/dist/umd/supabase.js`.
   - Inlined design system tokens (`tokens.css`) and modular components (`components.css`).
   - Built-in maritime fallback dataset (`SEED_WARNINGS`) ensuring full functionality even when disconnected from the live Supabase database.

---

## 2. User Experience & Visual Design

### Unified Layout & View State Machine
- **Default State**: Public Maritime Portal (`#main`), featuring the Map View with active warnings list and Data Bank.
- **Admin Access**: Discrete "Admin Console" entry in the header menu or direct access trigger.
- **Gated Authentication**: Clicking "Admin" opens the dark security modal/view (`#loginView`). Authenticated sessions transition to `#adminView` displaying the 5 administrative sub-tabs.
- **Return to Portal**: Admin console includes a "View Site ↗" header link and "Sign Out" button to switch back instantly.

### Design Tokens & Aesthetics
- **Colors**:
  - Backgrounds: `--bg: #fafafa`, `--surface: #ffffff`, `--surface-dark: #0f172a`, `--border: #e2e8f0`
  - Text Hierarchy: Primary `--text: #1e293b`, Muted `--text-muted: #64748b`, Subtle `--text-light: #94a3b8`
  - Hazard Accents: Critical `--critical: #dc2626`, High `--high: #ea580c`, Active `--active: #059669`, Verified `--verified: #0d9488`, Neutral `--neutral: #64748b`
- **Typography**: Clean system UI font stack (`system-ui, -apple-system, sans-serif`) with monospace tabular numbers for coordinates and timestamps (`ui-monospace, monospace`).
- **Responsive Layout**: Fluid breakpoints for Mobile ($\le 768\text{px}$ with bottom navigation and touch drawers), Tablet ($769\text{px} - 1024\text{px}$), and Desktop ($> 1024\text{px}$).

---

## 3. Technical Architecture & Inlining Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│             public/export/helm-warning-complete.html                   │
├────────────────────────────────────────────────────────────────────────┤
│ <head>                                                                 │
│   ├─ Meta tags (viewport-fit=cover, theme-color, title)                │
│   ├─ <style> Leaflet CSS (inlined from node_modules)                   │
│   ├─ <style> Tokens & Components CSS (tokens.css + components.css)     │
│   └─ <style> Portal & Admin Responsive Layout CSS                      │
├────────────────────────────────────────────────────────────────────────┤
│ <body>                                                                 │
│   ├─ Skip links & Top navigation header                                │
│   ├─ Public Portal Markup:                                             │
│   │   ├─ Tab: Map View (#tab-map, #map, layer drawer, warning list)   │
│   │   ├─ Tab: Data Bank (#tab-data, metrics grid, table, mobile cards) │
│   │   └─ Tab: Sources Registry (#tab-sources, grid cards)              │
│   ├─ Login Gate Markup (#loginView, form, error banners)               │
│   ├─ Admin Console Markup (#adminView):                                │
│   │   ├─ Sub-tab: Overview (#admin-overview, attention alert panel)    │
│   │   ├─ Sub-tab: Pipeline (#admin-pipeline, 4-stage pipeline tracker) │
│   │   ├─ Sub-tab: Import (#admin-import, 4-step wizard)                │
│   │   ├─ Sub-tab: Verify (#admin-verify, human verification cards)     │
│   │   └─ Sub-tab: System (#admin-system, AI model & DB diagnostics)    │
│   ├─ Shared Modals (Warning Detail Modal, Toasts)                      │
│   ├─ <script> Leaflet JS (inlined from node_modules)                   │
│   ├─ <script> Supabase JS UMD (inlined from node_modules)              │
│   └─ <script> Unified Runtime Controller (public + admin state logic)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Steps

### Step 1: Prepare Inlined Asset Payloads
- Read `node_modules/leaflet/dist/leaflet.css` and `node_modules/leaflet/dist/leaflet.js`.
- Read `node_modules/@supabase/supabase-js/dist/umd/supabase.js`.
- Read `public/assets/css/tokens.css` and `public/assets/css/components.css`.
- Merge custom layout and responsive styles from `index.html` and `admin.html`.

### Step 2: Combine Public Portal and Admin HTML Markup
- Assemble unified HTML structure in `public/export/helm-warning-complete.html`.
- Integrate public header with a discrete "Admin Console" link.
- Include all public views (`#tab-map`, `#tab-data`, `#tab-sources`) and modal templates.
- Include admin views (`#loginView` and `#adminView` with all 5 operational workspaces).

### Step 3: Integrate and Harmonize JavaScript Runtime
- Unify `supabase.js`, `public.js`, and `admin.js` into a cohesive, namespace-safe execution script.
- Ensure the live Supabase client gracefully falls back to local storage and seed records when offline.
- Enable smooth view switching:
  - `switchTab('map' | 'data' | 'sources')` for public tabs.
  - `openAdmin()` / `returnToPublic()` to toggle between public portal and admin workspace.
  - `switchAdminSub('overview' | 'pipeline' | 'import' | 'verify' | 'system')` for admin sub-tabs.

### Step 4: Verification & Offline Validation
- Test file generation and verify that no external stylesheet (`<link rel="stylesheet">`) or script (`<script src="...">`) dependencies remain.
- Validate DOM rendering, tab switching, map initialization, and modal triggers via automated smoke tests or browser verification.

---

## 5. Rollback & Safety Invariant
- This operation only creates a new distribution file at `public/export/helm-warning-complete.html`.
- It does **not** overwrite the active `index.html`, `admin.html`, or React source files in `src/`.
- The live production app and dev server continue to operate without interference.

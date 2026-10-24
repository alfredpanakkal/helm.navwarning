# NavWarn Design System: GATEWORKS

> Verified 2026-10-24 against `public/assets/css/tokens.css` and `src/index.css` at `257730d`.
> This document describes what the shipped code actually does.

## 1. Surfaces & Entry Points

| Entry point | Surface | Style source |
|---|---|---|
| `index.html` | Public portal (Map / Data Bank / Sources) | `public/assets/css/tokens.css` |
| `admin.html` | Admin login gateway (card only, redirects to `/console#/warnings/list`) | `tokens.css` + inline `<style>` (see deviations, §8) |
| `console.html` | React admin console (mounts `src/main.tsx` at `/console`) | `src/index.css` (Tailwind 4 `@theme`) |

All three are Vite build inputs (`vite.config.ts` rollupOptions.input). The gateway never mounts the React app.

## 2. Token System A - Status & Layout Tokens (`tokens.css`)

### Status Colors (5 only)
- `--critical: #dc2626` (red)
- `--high: #ea580c` (orange)
- `--active: #059669` (green)
- `--verified: #0d9488` (teal)
- `--neutral: #64748b` (slate)

These 5 tokens are the canonical status palette. The previously documented
functional colors `#4ade80` (green) and `#ca8a04` (amber) do not exist anywhere
in the shipped code and have been removed from this document.

### Surfaces & Text
- `--bg: #fafafa`, `--surface: #ffffff`, `--surface-dark: #0f172a`
- `--border: #e2e8f0`, `--text: #1e293b`, `--text-muted: #64748b`, `--text-light: #94a3b8`

### Typography (3 levels)
- `--font-h1: 600 28px/1.3 system-ui`
- `--font-h2: 600 20px/1.4 system-ui`
- `--font-body: 400 14px/1.5 system-ui`

### Spacing Scale
`--space-xs: 4px`, `--space-sm: 8px`, `--space-md: 16px`, `--space-lg: 24px`, `--space-xl: 40px`, `--space-2xl: 64px`

### Radius, Safe Areas, Component Heights
- `--radius: 8px`, `--radius-sm: 4px`, `--radius-lg: 12px`
- `--safe-top/bottom/left/right: env(safe-area-inset-*)`
- `--touch-min: 44px`, `--header-h: 56px`, `--bottomnav-h: 56px`

## 3. Token System B - GATEWORKS Palette (`src/index.css` @theme, React console)

### Colors
- `--color-gw-primary: #14161c` (deep black/graphite - backgrounds, borders, text)
- `--color-gw-secondary: #c8ccd8` (light grey/steel - borders, secondary text)
- `--color-gw-tertiary: #262a34` (dark grey/charcoal - panels, shadows)
- `--color-gw-bg: #e8e8f0` (light grey - page background)
- `--color-gw-accent: #5a5f70` (mid grey/slate - labels, meta text)
- `--color-gw-accent-on-dark: #8d93a6` - muted lift for dark chrome;
  5.9:1 on primary and 4.7:1 on tertiary (WCAG AA), applied via the
  `.gw-dark-surface` utility which re-points `--color-gw-accent` locally.

### Typography
`--font-mono`, `--font-sans`, `--font-ui` are ALL `Courier New, Courier, monospace`.
This is a deliberate all-monospace identity: the console is intentionally
terminal/chartroom-styled. Do not introduce a second display font without a
design decision (see UI_UX_AUDIT_REPORT.md 2-font recommendation).

### Hierarchy tokens (Sprint 0 Task 2)
- `--border-primary: 1px solid var(--color-gw-primary)` - clear border for primary containers
- `--border-subtle: 1px solid var(--color-gw-secondary)` - secondary containers
- Rule: secondary containers, rows and most buttons use background contrast +
  spacing only. Never border every nested div.
- `--bg-secondary: #ffffff`, `--space-compact: 0.5rem`
- `--radius-sm: 0.25rem`, `--radius-md: 0.375rem`

## 4. Status Color Usage Per Surface (canonical mapping)

- **Public portal + gateway**: the 5 status tokens in §2 (critical/high/active/verified/neutral).
- **Console map markers**: grayscale severity tiers, NOT colored tokens:
  `.nw-marker.sev-critical` = `--color-gw-primary`, `.sev-high` = `--color-gw-tertiary`,
  `.sev-moderate` = `--color-gw-accent`, `.sev-low` = `--color-gw-secondary`, `.sev-info` = `--color-gw-bg`.

## 5. Component Patterns

- **Buttons**: square/slightly rounded (4px), solid borders, uppercase.
- **Cards**: white or solid backgrounds with 2px graphite borders and hard drop shadows.
- **Hard shadows**: `.shadow-hard` = `4px 4px 0 --color-gw-tertiary`;
  `.shadow-hard-hover` lifts to `8px 8px 0` with `translateY(-4px)`.
- **Map elements**: grayscale base maps with vibrant status markers;
  Leaflet controls/popups are restyled to the GATEWORKS palette (2px borders,
  4px radius, hard shadow). Jump-target beacons use `.jump-beacon-pulse`.
- **Skip link**: `.gw-skip-link` - hidden until keyboard-focused, high-contrast.
- **Grid backdrop**: `body::before` renders a 40px engineering-grid overlay at 15% opacity.

## 6. Technical Architecture

- **Build**: Vite multi-input build (`index.html`, `admin.html`, `console.html`),
  Tailwind 4 via `@tailwindcss/vite`, React via `@vitejs/plugin-react`,
  `@` alias to repo root.
- **Hosting parity**: Vercel (`vercel.json` - cleanUrls, rewrites, security headers
  on `/admin` + `/console`, daily cron on `/api/scrape-navwarn`) and self-hosted
  Express (`server.ts`, including the `/console` route).
- **Data**: Supabase Postgres (PostGIS). Reads with anon key (RLS SELECT-only),
  writes through the `upsert_nav_warning` RPC / service role. Map renders only the
  `nav_warnings_active_spatial` view. See `docs/supabase-backend-contract.md`.

## 7. Component Boundaries & State Flow

- **Public portal** (`index.html`, legacy HTML/JS): Map, Data Bank, Sources.
  ZERO admin code (AGENTS.md Rule 2).
- **Admin gateway** (`admin.html`): login card only. Server-side authorization
  (`server/auth.ts` requireAdmin / verifyAdminRequest); no client-side trust flags.
- **React console** (`src/`, mounted at `/console`): Data Bank tools, manual parser,
  imports, audit and Supabase views. Hash routing (`/console#/warnings/list`).
- **State flow**: server fetches hydrate from Supabase; live updates via Supabase
  realtime channels on `nav_warnings` / `nav_warning_geometries`; offline mode is
  surfaced with dedicated indicators when Supabase is unavailable. Admin mode is
  derived from the server-verified session on mount.

## 8. Token Governance & Known Deviations

Rule: design tokens ONLY - no hardcoded colors/fonts (AGENTS.md Rule 6).
Currently tracked deviations (fix or formally accept, do not copy):

- `admin.html` gateway inline `<style>` uses hardcoded colors
  (`#eff6ff`, `#1d4ed8`, `rgba(0,0,0,.4)`) instead of `--color-gw-*` / status tokens.
- `src/index.css` map decorations use hardcoded colors:
  jump beacon `#0284c7`/`#0369a1`, vertex pins `#fbbf24`/`#d97706`,
  route terminus `#06b6d4`/`#0e7490`, drift arrow `#ea580c` (coincidentally `--high`),
  centroid badge `#38bdf8`/`#0f172a`.
- `console.html` sets `theme-color` `#0f172a` (Token System A dark surface,
  not the GATEWORKS primary `#14161c`).

Token-unification pass (audit Finding 1.2): System A and System B intentionally
coexist today; any future unification must keep the 5 status tokens in §2 as the
canonical status palette and the GATEWORKS palette in §3 as the console identity.

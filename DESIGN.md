# Design System — Helm.Ports conventions

> Verified 2026-11-03 against `public/assets/css/tokens.css` and `src/index.css` on `main` (post PR #104).
> This document describes what the shipped code actually does. Hard constraints are summarized in [UI-DESIGN-FUNDAMENTALS.md](UI-DESIGN-FUNDAMENTALS.md).

## 1. Surfaces & Entry Points

| Entry point | Surface | Style source |
|---|---|---|
| `index.html` | Public portal (Map / Data Bank / Info tabs on `/`) | `public/assets/css/tokens.css` |
| `admin.html` | Admin login gateway (card only; redirects to `/console#/warnings/list`) | `tokens.css` + inline `<style>` (see deviations, §8) |
| `console.html` | React admin console (mounts `src/main.tsx` at `/console`) | `src/index.css` (Tailwind 4 `@theme`) |

All three are Vite build inputs (`vite.config.ts` rollupOptions.input). The gateway never mounts the React app.

## 2. Public tokens (`tokens.css`)

Both surfaces share one palette: Helm.Ports tokens (canvas white, hairline borders, ink scale, single accent `#2b6e8c`). Semantic severity tokens are for dots only:

- `--sev-critical: #c44536`, `--sev-high: #c07a2b`, `--sev-medium: #6b8f9c`, `--sev-low: #9aa6b2`

Legacy aliases (`--bg`, `--text`, `--critical`, …) are mapped onto the new tokens for older public CSS; do not use them in new code.

### Type
Inter everywhere. `--font-h1: 500 clamp(2rem,5vw,3.25rem)/1.15`, `--font-h2: 500 1.25rem`, `--font-body: 400 0.9rem/1.5`. Weight 500 is the maximum anywhere.

### Spacing, radius, touch
`--space-*`: 8 / 24 / 64 (+ console-only 4/12/16/40). `--radius-btn: 6px`, `--radius-input: 12px`, `--radius-chip: 999px`. `--touch-min: 44px`, `--header-h` / `--bottomnav-h`: 56px. Reading width `--max-width: 1180px`.

### Themes
Three public themes via `data-theme`: light (default), dark, night. Each re-maps every token (canvas/ink/accent/severity) — components must consume token names, never raw values.

## 3. Console tokens (`src/index.css`)

- The `gw-*` Tailwind theme tokens are re-mapped onto the Helm.Ports palette (`--color-gw-primary: #0b0e11`, `--color-gw-secondary: #dde2e8`, `--color-gw-bg/panel: #ffffff`, `--color-gw-accent: #5f6b7a`; severity `--color-gw-critical/high/moderate` mirror `--sev-*`). Existing `gw-*` class usage keeps working; new work should prefer the ink/accent token names.
- Hard constraints enforced in `@layer base`: all `b/strong/.font-bold/.font-semibold/…` forced to weight 500; every `shadow-*` class (including `.shadow-hard`) neutralized; `:focus-visible` = 1.5px accent outline.
- Console stacking tokens: `--z-console-sticky: 10` < chrome `50` < overlay `60` < fab `65` < overlay-raised `70`; sticky strips use `top-[var(--console-sticky-offset)]` (57px, matching the single 56px header bar + border).
- Console shell is fluid full-width (1180px cap applies to the public site only).

## 4. Status color usage

- **Public portal + gateway**: semantic severity tokens (`--sev-*`), dots only.
- **Console map markers**: `.nw-marker` classes take severity backgrounds from the same `--sev-*` tokens; `sev-info` is the canvas (hollow) marker.

## 5. Component patterns

- **Buttons**: hairline borders, 6px radius, weight 500. No filled buttons except the master toggle (ink background) and small primary action buttons in the console.
- **Edit drawer**: the admin warning editor (`WarningEditModal`) is a full-height 560px right-side drawer with a hairline left border and 40% scrim — the map stays visible during geometry edits.
- **Map settings popover**: 320px, hairline border, no shadow; OpenSeaMap and ocean soundings sit behind an "Advanced layers" disclosure.
- **Tables**: hairline header underline (`--hairline`), row dividers (`--hairline-alt`), no zebra striping.
- **Skip link**: `.gw-skip-link` — hidden until keyboard-focused.
- **Map controls**: restyled Leaflet controls (hairline border, 6px radius, no shadow).

## 6. Technical architecture

- **Build**: Vite multi-input build (`index.html`, `admin.html`, `console.html`), Tailwind 4 via `@tailwindcss/vite`, React via `@vitejs/plugin-react`, `@` alias to repo root.
- **Hosting**: Vercel (`vercel.json`: cleanUrls, redirects `/about` and `/sources` → `/?tab=info`, tile rewrites through the single `/api/tiles` function, `X-Frame-Options: DENY` + `noindex` on `/admin` and `/console`). Self-hosted Express (`server.ts`) parity exists for dev.
- **Data**: Supabase Postgres (PostGIS). Reads with the anon key (RLS SELECT-only); writes through the `upsert_nav_warning` RPC / service role. The map renders only the `nav_warnings_active_spatial` view. See `docs/supabase-backend-contract.md`.

## 7. Component boundaries

- **Public portal** (`index.html`, vanilla JS): Map / Data Bank / Info tabs. Zero admin code.
- **Admin gateway** (`admin.html`): login card only. Authorization is server-side (`server/auth.ts`); no client-side trust flags.
- **React console** (`src/`, at `/console`): four sections — Warnings, Ingest, Trace, System; legacy hash aliases (`#/map`, `#/databank`, `#/sources`, `#/imports`, `#/audit`, …) still resolve.
- **State flow**: server fetches hydrate from Supabase; live updates via Supabase realtime on `nav_warnings` / `nav_warning_geometries`; offline surfaced with dedicated indicators; admin mode derived from the server-verified session.

## 8. Token governance & known deviations

Rule: tokens only — no hardcoded colors/fonts. Tracked deviations (fix or formally accept, do not copy):

- `admin.html` gateway inline `<style>` uses hardcoded colors (`#eff6ff`, `#1d4ed8`, `rgba(0,0,0,.4)`) instead of tokens.
- Map toolbar controls in `src/index.css` (`.map-recenter-pill-btn`, `.map-focus-btn`, `.map-gear-btn`, `.map-coord-btn`) still use `font: 600`, `translateY`/`scale` hover motion, and rgba shadows — a residual pre-Helm.Ports dialect.
- Map decoration colors (jump beacon, vertex pins, terminus, drift arrow) were hardcoded as of the 2026-10-24 audit; re-verify before relying on that list.
- `console.html` sets `theme-color: #0f172a` (a pre-Helm.Ports dark surface, not `--ink-primary #0b0e11`).

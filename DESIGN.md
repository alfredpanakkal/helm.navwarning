# NavWarn Design System: GATEWORKS

## Palette (CSS Variables)
- `--color-gw-primary`: `#14161c` (Deep Black/Graphite - backgrounds, borders, text)
- `--color-gw-secondary`: `#c8ccd8` (Light Grey/Steel - borders, secondary text)
- `--color-gw-tertiary`: `#262a34` (Dark Grey/Charcoal - panels, shadows)
- `--color-gw-bg`: `#e8e8f0` (Light Grey/White - page background, inputs)
- `--color-gw-accent`: `#5a5f70` (Mid Grey/Slate - labels, meta text)

## Functional Colors
- **Success / Healthy**: `#4ade80` (Green)
- **Warning / Degraded / Expiring**: `#ca8a04` (Amber/Yellow)
- **Error / Down / Critical**: `#dc2626` (Red)

## Component Patterns
- **Buttons**: Square/slightly rounded (`4px`), solid borders, uppercase.
- **Cards**: White or solid backgrounds with `2px` graphite borders and hard drop shadows.
- **Map Elements**: Grayscale base maps with vibrant status markers.

## Entry Points & Token Sources (updated 2026-10-24)
- `index.html` (public portal) and `admin.html` (admin gateway) — tokens from
  `public/assets/css/tokens.css` (`--surface`, `--surface-dark`, `--critical`, ...).
- `console.html` (React admin console, PR #24) — styles from `src/index.css`
  (Tailwind 4 `@theme`, GATEWORKS palette above). Minimal HTML shell that
  mounts `src/main.tsx` at `/console`; no design tokens in the shell itself.
- Known gap: the gateway card still uses the legacy `--surface*` token names,
  not the `--color-gw-*` palette — see UI_UX_AUDIT_REPORT.md Finding 1.2
  (a token-unification pass is recommended).

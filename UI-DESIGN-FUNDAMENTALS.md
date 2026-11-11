# UI Design Fundamentals

The binding design system is [DESIGN.md](DESIGN.md), verified against the shipped CSS. The token source of truth is `public/assets/css/tokens.css` (public site) and `src/index.css` (console). This file lists the hard constraints that apply everywhere.

## Principles

- Information-first minimalism. The data is the design; chrome recedes.
- Whitespace and typographic hierarchy carry structure — not cards, shadows, or decoration.

## Hard constraints

| Rule | Value |
|---|---|
| Accent color | Exactly one: `--accent: #2F6B4F` (console `--color-accent` same). Focus halo `rgba(47,107,79,0.10)` only. |
| Font weight | 500 is the maximum anywhere. Never 600/700/bold (`b`, `strong`, `.font-bold` etc. are forced to 500 in `src/index.css`). |
| Font family | Inter everywhere (`'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`). Do not add a second display font. |
| Shadows | None. All `shadow-*` classes (including `.shadow-hard`) are neutralized; the only halo allowed is the search focus ring. |
| Motion | Micro and chromatic only, 100–150ms (`--transition: 0.12s ease`). No hover lift, `translateY`, or scale. |
| Semantic colors | Dots only — never fills, never pills. |
| Casing | Sentence case except tiny uppercase table labels (`--fs-label`, letter-spacing 0.06em). |
| Radius | `--radius-btn: 6px`, `--radius-input: 12px`, `--radius-chip: 999px`. |
| Layout width | Public reading width 1180px; the console shell is fluid full-width. |
| z-index | Never use magic values — use the console stacking tokens (sticky 10 < chrome 50 < overlay 60 < fab 65 < overlay-raised 70). |
| Touch targets | 44px minimum on coarse pointers (`--touch-min`). |

## Spacing

Scale: 4 / 8 / 12 / 16 / 24 / 40 / 64 (`--space-xs` … `--space-section`). 16px within a group, 24px between groups, 40px+ between page sections.

## Themes

The public site ships three themes in `tokens.css`: light (default), dark, night (`data-theme` attribute). All themes re-map the same token names — components must consume tokens, never raw hex values.

## Known deviations (fix or formally accept; do not copy)

Tracked in [DESIGN.md §8](DESIGN.md). Largest remaining: the dark/night override blocks in `components.css` use intentional literal neutrals, and map decoration colors stay hardcoded. The old map-toolbar weight/motion deviation is fixed.

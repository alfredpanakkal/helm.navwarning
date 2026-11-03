# Implementation Plan: Map Settings & Layers Bottom Sheet Remediation (COMPLETED)

Restored the missing CSS styles and interaction behavior for the **Map Navigation Toolbar** and **Layers & Chart Type Settings** (bottom sheet on mobile, popover on desktop), matching the production design (`helmwarning.vercel.app`).

---

## Why It Was Rendering Broken in AI Studio

In the user's mobile screenshot (`Screenshot 1`), the settings panel appeared as raw, unstyled text dumped at the bottom of the page beneath the bottom navigation bar.

1. **Missing CSS Declarations**:
   The HTML markup in `index.html` (lines 521–610 for the toolbar & desktop popover, and lines 908–975 for the mobile bottom sheet & scrim) defines all the necessary elements (`.map-ctrl-topright`, `.map-recenter-pill-btn`, `.map-focus-btn`, `.map-gear-btn`, `.map-settings-sheet`, `.map-settings-scrim`, `.map-settings-popover`, `.settings-item`, etc.). However, **zero CSS rules** existed for any of these classes in `public/assets/css/components.css`, `public/assets/css/tokens.css`, or `index.html`.
2. **Document Flow Leakage**:
   Because `.map-settings-sheet` had no CSS:
   - The browser defaulted it to `display: block; position: static;` in normal document flow.
   - Instead of being hidden off-screen (`transform: translateY(100%)`) and sliding up only when the gear icon is tapped, it remained permanently visible at the very end of the page body.
   - The radio inputs and checkboxes used default raw browser form controls with no spacing or custom styling.
3. **Missing Floating Map Toolbar**:
   The top-right floating toolbar buttons (`Re-center`, `Focus`, `Settings Gear`, `Coordinate Picker`) lacked their floating pill and button styling, preventing the clean floating controls shown in `Screenshot 3`.

---

## 1. Overview & Target Experience

Deliver pixel-precise parity with `helmwarning.vercel.app` (as seen in `Screenshot 2` and `Screenshot 3`):

```
┌────────────────────────────────────────────────────────┐
│ HELM.WARNING                                       [≡] │
├────────────────────────────────────────────────────────┤
│ Live NAVAREA Warnings                                  │
│ ...                                                    │
├────────────────────────────────────────────────────────┤
│ [● Global View 406]     [(⌖) Re-center] [⛶] [⚙] [⌖]    │ <- Floating Toolbar
│                                                        │
│                     MAP VIEW                           │
│                                                        │
├────────────────────────────────────────────────────────┤
│ [Map 406]             [Data]      [Sources]     [Info] │
└────────────────────────────────────────────────────────┘
                          ▲
                          │ Tapping [⚙] triggers smooth slide-up
                          ▼
┌────────────────────────────────────────────────────────┐
│ [════════════════════════════════════════════════════] │ <- Dimmed Scrim
│ ┌────────────────────────────────────────────────────┐ │
│ │                      ━                             │ │ <- Drag Handle
│ │ Layers & Chart Type                            [✕] │ │ <- Sheet Header
│ │ ────────────────────────────────────────────────── │ │
│ │ BASE MAP                                           │ │
│ │   (•) OpenStreetMap                                │ │ <- Custom Radios
│ │   ( ) CARTO Voyager                                │ │
│ │   ( ) CARTO Dark Matter                            │ │
│ │   ( ) CARTO Positron                               │ │
│ │   ( ) ESRI Ocean Base                              │ │
│ │ ────────────────────────────────────────────────── │ │
│ │ MARITIME OVERLAYS                             [ON] │ │ <- Master Toggle
│ │   [✓] Hazard Points                                │ │ <- Custom Checkboxes
│ │   [✓] Danger Areas & Polygons                      │ │
│ │   [✓] Safety Zones & Circles                       │ │
│ │   [✓] Corridors & Cables                           │ │
│ │   [✓] OpenSeaMap Seamarks                          │ │
│ │   [ ] Ocean Soundings                              │ │
│ │ ────────────────────────────────────────────────── │ │
│ │ ⟲ Reset to defaults                                │ │ <- Reset Link
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

---

## 2. Proposed Changes & Component Specifications

### 2.1 Floating Top-Right Map Toolbar
Add comprehensive CSS in `public/assets/css/components.css` (and mirrored in `src/index.css` for console parity):
- `.map-ctrl-topright`: `position: absolute; top: 14px; right: 14px; z-index: 520; display: inline-flex; align-items: center; gap: 6px;`
- `.map-recenter-pill-btn`: Translucent white pill (`rgba(255, 255, 255, 0.94)` / `var(--canvas)`), 38px height, 1px solid hairline border, subtle shadow `0 2px 10px rgba(0,0,0,0.08)`, SVG locate icon, 12px semibold label.
- `.map-focus-btn`, `.map-gear-btn`, `.map-coord-btn`: 38×38px rounded-lg square buttons, translucent white background, active state transitioning to solid dark (`#0b0e11` / `var(--ink-primary)` with `#ffffff` icon).

### 2.2 Mobile Bottom Sheet & Backdrop Scrim (`#mapSettingsSheet`, `#mapSettingsScrim`)
- **Scrim**:
  - `position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(3px); z-index: 3400;`
  - Hidden by default (`opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 0.25s ease, visibility 0.25s;`).
  - Active state (`.map-settings-scrim.open`): `opacity: 1; visibility: visible; pointer-events: auto;`.
- **Bottom Sheet Container**:
  - `position: fixed; bottom: 0; left: 0; right: 0; z-index: 3500; background: var(--canvas, #ffffff); border-radius: 20px 20px 0 0; box-shadow: 0 -8px 32px rgba(0,0,0,0.22); max-height: 85vh; overflow-y: auto; padding: 12px 20px calc(24px + var(--safe-bottom)) 20px; display: flex; flex-direction: column;`
  - Hidden by default (`transform: translateY(100%); visibility: hidden; transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.28s;`).
  - Active state (`.map-settings-sheet.open`): `transform: translateY(0); visibility: visible;`.
- **Handle & Header**:
  - Drag handle: `w-10 h-1 bg-slate-300 rounded-full mx-auto my-1.5`.
  - Header: flex row with `Layers & Chart Type` (15px semibold `#0b0e11`) and close `✕` button with minimum $44 \times 44$px touch area.
- **Section Headers & Master Toggle**:
  - Section title: 11px uppercase bold `#5f6b7a` with `0.06em` letter spacing.
  - Master toggle badge: `[ON]` / `[OFF]` pill badge with smooth color shift.
- **Form Controls (Custom Radios & Checkboxes)**:
  - Touch target: $\ge 44$px height row with centered alignment and generous hit area.
  - Radio input: 18px circle with `#0b0e11` checked ring and inner dot.
  - Checkbox input: 18px rounded square with `#0b0e11` fill and clean white checkmark vector.
- **Reset Button**:
  - "Reset to defaults" with reload SVG icon, muted secondary ink color, and subtle hover transition.

### 2.3 Desktop Settings Popover (`#mapSettingsPopover`)
- Positioned floating at `top: 58px; right: 14px; z-index: 520;`.
- Width: 280px–300px with 12px border radius, 1px border, and `0 8px 30px rgba(0,0,0,0.12)` shadow.
- Displayed only when `.map-settings-popover.open` is active.

### 2.4 Parity in React Console (`src/index.css`)
- Export and harmonize the classes into `src/index.css` so `LeafletMap.tsx` in the admin console (`/console#/map`) receives identical styling for its layers popover and top-right toolbar.

---

## 3. Verification & Testing Plan

1. **Compilation & Static Analysis**:
   - Run `lint_applet` (`tsc --noEmit`).
   - Run `compile_applet` (`npm run build`).
2. **Unit Test Suite**:
   - Run `npm test` to verify all 22 test suites and 220 tests pass.
3. **Visual & Interactive Validation**:
   - Verify on mobile viewports ($\le 768$px) that the settings sheet is completely hidden from normal page flow on initial load.
   - Verify that tapping the gear icon on the map slides up the bottom sheet with darkened backdrop scrim.
   - Verify that radio selections (Base Map) and checkboxes (Maritime Overlays) render with custom modern inputs matching Screenshot 2.
   - Verify that tapping the scrim or close button smoothly dismisses the sheet.
   - Verify that on desktop viewports (> 768px), tapping the gear icon opens the compact popover below the button.

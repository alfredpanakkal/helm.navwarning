# Graph Report - helm.navwarning  (2026-09-30)

## Corpus Check
- Corpus is ~23,736 words - fits in a single context window. You may not need a graph.

## Summary
- 234 nodes · 297 edges · 16 communities (11 shown, 5 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Third-party runtime dependencies
- Server runtime, auth and API handlers
- Frontend API client and views
- Build tooling devDependencies
- GATEWORKS design tokens and shell
- App shell and analysis type definitions
- TypeScript compiler configuration
- SSRF guard engine
- Package manifest and scripts
- Vite client type shims
- Single-file build script
- HTML entry shell
- Grid and spacing scale
- Vercel cron schedule

## God Nodes (most connected - your core abstractions)
1. `verifyAdminRequest()` - 15 edges
2. `compilerOptions` - 15 edges
3. `startServer()` - 11 edges
4. `getAdminHeaders()` - 8 edges
5. `scrapeNavwarnHandler()` - 6 edges
6. `scripts` - 6 edges
7. `GATEWORKS Palette (CSS Variables)` - 6 edges
8. `validateUrlForSSRF()` - 5 edges
9. `SupabaseStatusView()` - 5 edges
10. `GATEWORKS Component Patterns (Buttons, Cards, Map Elements)` - 5 edges

## Surprising Connections (you probably didn't know these)
- `JetBrains Mono Webfont` --semantically_similar_to--> `Courier New Monospace Font Family`  [INFERRED] [semantically similar]
  index.html → UI-DESIGN-FUNDAMENTALS.md
- `GATEWORKS Component Patterns (Buttons, Cards, Map Elements)` --references--> `Radius sm: 4px Interactive Elements`  [INFERRED]
  DESIGN.md → UI-DESIGN-FUNDAMENTALS.md
- `GATEWORKS Component Patterns (Buttons, Cards, Map Elements)` --references--> `UPPERCASE Labels, Statuses, Headers`  [INFERRED]
  DESIGN.md → UI-DESIGN-FUNDAMENTALS.md
- `handler()` --calls--> `verifyAdminRequest()`  [EXTRACTED]
  api/admin/test-gemini.ts → server/auth.ts
- `handler()` --calls--> `verifyAdminRequest()`  [EXTRACTED]
  api/admin/verify.ts → server/auth.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **GATEWORKS Core Palette Token Set** — design_gw_palette, design_gw_primary, design_gw_secondary, design_gw_tertiary, design_gw_bg, design_gw_accent [EXTRACTED 1.00]
- **GATEWORKS Visual Foundation (Grid, Type, Radii, Effects)** — ui_design_fundamentals_grid_spacing, ui_design_fundamentals_typography, ui_design_fundamentals_radii, ui_design_fundamentals_effects [EXTRACTED 1.00]
- **Industrial / Technical Aesthetic Execution** — design_component_patterns, design_map_elements, ui_design_fundamentals_grid_background, ui_design_fundamentals_hard_offset_shadows, ui_design_fundamentals_hover_transform [INFERRED 0.75]

## Communities (16 total, 5 thin omitted)

### Community 0 - "Third-party runtime dependencies"
Cohesion: 0.05
Nodes (39): cheerio, dotenv, express, express-rate-limit, firebase, @google/genai, leaflet, leaflet.markercluster (+31 more)

### Community 1 - "Server runtime, auth and API handlers"
Cohesion: 0.11
Nodes (26): handler(), handler(), extractWarnings(), isCronAuthorized(), scrapeNavwarnHandler(), handler(), handler(), artifactsDb (+18 more)

### Community 2 - "Frontend API client and views"
Cohesion: 0.11
Nodes (20): Header(), HeaderProps, SupabaseStatusView(), SupabaseStatusViewProps, adminLogin(), adminLogout(), BulkIngestAiResponse, enrichEvidence() (+12 more)

### Community 3 - "Build tooling devDependencies"
Cohesion: 0.08
Nodes (26): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+18 more)

### Community 4 - "GATEWORKS design tokens and shell"
Cohesion: 0.09
Nodes (24): GATEWORKS Component Patterns (Buttons, Cards, Map Elements), Functional Status Colors (Success/Warning/Error), --color-gw-accent (Mid Grey/Slate), --color-gw-bg (Light Grey/White), GATEWORKS Palette (CSS Variables), --color-gw-primary (Deep Black/Graphite), --color-gw-secondary (Light Grey/Steel), --color-gw-tertiary (Dark Grey/Charcoal) (+16 more)

### Community 5 - "App shell and analysis type definitions"
Cohesion: 0.13
Nodes (17): jszip, jszip, App(), AnalysisProgress, ArchitectureModule, ArchitectureResult, CodeInsight, CommentDensity (+9 more)

### Community 6 - "TypeScript compiler configuration"
Cohesion: 0.11
Nodes (18): DOM, DOM.Iterable, ES2022, compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules (+10 more)

### Community 7 - "SSRF guard engine"
Cohesion: 0.19
Nodes (14): RFC-1918, RFC-2544, RFC-4193, RFC-4291, RFC-6598, isDisallowedIP(), isHostnameAllowed(), isPrivateIPv4() (+6 more)

### Community 8 - "Package manifest and scripts"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, clean, dev, lint, start (+2 more)

## Knowledge Gaps
- **98 isolated node(s):** `generate_single_file.sh script`, `name`, `private`, `version`, `type` (+93 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Third-party runtime dependencies` to `Package manifest and scripts`, `Build tooling devDependencies`, `App shell and analysis type definitions`?**
  _High betweenness centrality (0.359) - this node is a cross-community bridge._
- **Why does `jszip` connect `App shell and analysis type definitions` to `Third-party runtime dependencies`?**
  _High betweenness centrality (0.285) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `startServer()` (e.g. with `scrapeNavwarnHandler()` and `requireAdmin()`) actually correct?**
  _`startServer()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `generate_single_file.sh script`, `name`, `private` to the rest of the system?**
  _98 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Third-party runtime dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `Server runtime, auth and API handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.10756302521008404 - nodes in this community are weakly interconnected._
- **Should `Frontend API client and views` be split into smaller, more focused modules?**
  _Cohesion score 0.10967741935483871 - nodes in this community are weakly interconnected._
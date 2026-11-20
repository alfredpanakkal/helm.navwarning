<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/logofordark.svg">
  <img src="docs/brand/logoforlight.svg" alt="Helm.Warning logo" width="210">
</picture>

# Helm.Warning

**Global NAVAREA maritime safety information, chart visualisation and voyage route planning.**

[![Live App](https://img.shields.io/badge/Live-navarea.helmology.com-00C7B7?style=for-the-badge&logo=vercel&logoColor=white)](https://navarea.helmology.com)
[![CI](https://github.com/alfredpanakkal/helm.navwarning/actions/workflows/ci.yml/badge.svg)](https://github.com/alfredpanakkal/helm.navwarning/actions/workflows/ci.yml)
[![Last Commit](https://img.shields.io/github/last-commit/alfredpanakkal/helm.navwarning)](https://github.com/alfredpanakkal/helm.navwarning/commits)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

[React](https://react.dev/) · [TypeScript](https://www.typescriptlang.org/) · [Vite](https://vite.dev/) · [Tailwind CSS](https://tailwindcss.com/) · [Leaflet](https://leafletjs.com/) · [Supabase](https://supabase.com/)

</div>

---

Helm.Warning is a maritime awareness and planning application for viewing navigational warnings across the 21 NAVAREAs and the Baltic region. It brings warning information, chart-based visualisation and a lightweight voyage route planner into one browser-based workspace.

The public portal can be used without an account. Warning information is provided for convenience and should always be checked against current official maritime safety information.

## Features

### Public chart and warning information

- Interactive nautical chart with warning points, lines, areas and other supported geometries.
- NAVAREA, severity, status and warning-category filters.
- Searchable warning list with details linked to chart selections.
- Light, dark and night watch themes.
- Regional NAVAREA pages and individual warning pages for browsing and search discovery.
- Public information page with source information, FAQs and safety guidance.

### Voyage route planner

- Create and edit routes directly alongside the warning chart.
- Add waypoints by selecting positions on the chart or entering coordinates.
- Work with degrees and decimal coordinate formats.
- Insert a waypoint along an existing route leg, reorder or remove waypoints, and undo edits.
- Review route distance and compare route geometry with available navigational warnings.
- Import routes from GPX, GeoJSON or JSON files; export routes as GPX, GeoJSON or CSV.
- Touch-friendly controls as well as keyboard and mouse interaction.
- Route data is saved in the browser on the device where it was created; it is not currently synchronised between devices or accounts.

Route assessment is an informational aid, not an automatic route approval or navigational safety determination. It does not replace appraisal of the full voyage, chart and publication corrections, weather and other operational factors.

### Administration

A separate authenticated console supports warning review, geometry editing, data imports and operational oversight. It is intended for authorised maintainers rather than general public use.

## How it works

The application presents navigational warning information gathered from recognised hydrographic and maritime sources. Warning content is processed and made available to the chart, searchable data bank and regional pages.

~~~mermaid
flowchart TD
    A[Hydrographic and maritime sources] --> B[Warning data processing]
    B --> C[Warning information store]
    C --> D[Public chart and Data Bank]
    C --> E[Regional and warning pages]
    D --> F[Voyage route planner]
    G[Maintainer console] --> C
~~~

## Technology

| Area | Technology |
|---|---|
| User interface | React, TypeScript |
| Build and development | Vite |
| Styling | Tailwind CSS |
| Interactive charts | Leaflet |
| Warning data | Supabase / PostgreSQL with spatial data support |
| Coordinate and geometry utilities | Turf.js |
| Testing | Vitest, Playwright |

## Local development

### Requirements

- Node.js 20 or later
- npm 10 or later

### Install

~~~bash
git clone https://github.com/alfredpanakkal/helm.navwarning.git
cd helm.navwarning
npm install
~~~

### Environment

Create a local environment file from the example:

~~~bash
cp .env.example .env
~~~

Set the values required for the features you want to run. Refer to `.env.example` for the variable names. Keep real credentials in your local environment or deployment secret manager; do not commit them to the repository or paste them into issues and pull requests.

### Useful commands

| Command | Description |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run lint` | Run the TypeScript check |
| `npm test` | Run unit tests |
| `npm run build` | Generate public pages and build the production application |
| `npm start` | Start the built application |
| `npm run ux:smoke` | Run browser-based smoke tests |
| `npm run ux:capture` | Capture UI audit screenshots |

## Project documentation

- [Product overview and current capabilities](PRD.md)
- [Design system and interface guidance](DESIGN.md)

## Safety notice

Helm.Warning is an independent decision-support and visualisation tool. It is **not an official MSI distributor** and does not replace official navigational warnings, Notices to Mariners, nautical charts, publications, GMDSS broadcasts or the judgement of the Master and bridge team.

Warning data may be delayed, incomplete, unavailable or presented with uncertain geometry. Always verify information with the relevant official source and use approved navigational products and procedures for passage planning. Do not rely on this application as the sole source of navigational information.

## License

This project is distributed under the [MIT License](LICENSE).

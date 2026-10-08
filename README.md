# Helm.Warning (NAVAREA Maritime Safety Information Pipeline)

> **Live Application:** [helmwarning.vercel.app](https://helmwarning.vercel.app/)  
> **Repository:** [github.com/alfredpanakkal/helm.navwarning](https://github.com/alfredpanakkal/helm.navwarning)

Helm.Warning is an automated pipeline, spatial geometry visualizer, and navigational warning management platform for global **NAVAREA** maritime safety information (MSI). It aggregates data from national hydrographic offices, parses geographic coordinates, verifies active hazard areas, and visualizes them on nautical chart layers.

---

## 🚀 Key Features

### 🌐 Public Portal (`/`)
- **Interactive Maritime Map:** Powered by Leaflet.js with Esri Ocean Base, seamark layers, and cluster markers.
- **Collapsible Floating Warnings Drawer:**
  - **Minimize Button:** Collapses the panel down to 44px to provide an unobstructed chart view.
  - **Maximize Button:** Expands the panel up to 520px (75vh on mobile) for reviewing multiple active hazards simultaneously.
- **Inline Accordion Hazard Inspection:** Clicking any warning in the floating list or the Data Bank expands its full details, metadata badges, coordinates, and raw bulletin text **in-place within the list**—eliminating modal overlays and keeping visual context intact.
- **Bidirectional Geo-Synchronization:**
  - Clicking **📍 Focus on Map** within any expanded warning smoothly centers and zooms the Leaflet chart on that coordinate.
  - Clicking any chart pin automatically scrolls to and expands that warning inside the list.
- **Executive Data Bank Metrics Strip:** A compact summary strip displaying real-time metrics (Active in-force, Global Coverage %, Critical/High count, and GPS Georeferenced %) with designated status icons.
- **NAVAREA Data Bank Table & Mobile Cards:** Searchable and filterable by NAVAREA region, severity (`Critical`, `High`, `Moderate`), and hazard category (`Military`, `Drifting`, `AtoN`, `Subsea`, `General`). Desktop table features inline expansion rows (`.table-detail-row`).
- **Source Registry:** Live tracking across global hydrographic offices (UKHO, NGA, SHOM, AMSA, etc.).
- **Zero-Admin Decoupling:** Strictly read-only public interface containing zero administrative code, internal schemas, or leaked credentials.

### 🔐 Admin Console (`/admin`)
- **Gated Authentication:** Authenticates against Supabase Auth, strictly validating unalterable administrative roles (`app_metadata.role === 'admin'`).
- **Defense-in-Depth Headers:** Hardened with `X-Frame-Options: DENY`, `noindex, nofollow, noarchive` robots tags, and strict Content Security Policies.
- **5 Operational Workspaces:**
  1. **Overview:** Health monitoring, attention notifications, and pipeline operational stats.
  2. **Pipeline Orchestrator:** Stage-by-stage pipeline inspection (`Fetch Sources` → `Parse & Normalize` → `Geocode Geometry` → `Publish Generation`), feed latency, and live log streaming.
  3. **Bulk Import Wizard:** 4-step wizard supporting manual bulletin text, CSV, GPX, and S-124 formats with real-time validation and deduplication preview.
  4. **Verification Queue:** Human-in-the-loop triage interface to review, corroborate, and confirm or reject warnings before publication.
  5. **System Diagnostics:** Live connectivity test for AI extraction models (Gemini Flash-Lite primary, Mistral fallback) and database health metrics.

---

## 🏗️ Architecture

The application operates as a full-stack maritime system supporting both Express server runtime (with Vite middleware) and Vercel Serverless / Cron environments:

```
helm-warning/
├── index.html              # Approved public maritime portal (Map, Data Bank, Sources)
├── admin.html              # Approved gated Admin console (5 management tabs)
├── server.ts               # Express full-stack server (SSR proxies, SSRF guard, dev middleware)
├── server/                 # Server security & authentication
│   ├── auth.ts             # Server-side admin JWT & role verification middleware
│   ├── securityHeaders.ts  # CSP, frameguard, and security header configurations
│   └── ssrfGuard.ts        # Outbound fetch protection (IP blocklist, DNS validation, redirects)
├── public/                 # Static production assets
│   └── assets/
│       ├── css/
│       │   ├── tokens.css     # Design tokens (5 status colors, typography scale)
│       │   └── components.css # Modular component styles (buttons, badges, modals, toasts)
│       └── js/
│           ├── public.js      # Public portal logic & Leaflet controller
│           ├── admin.js       # Admin portal logic & auth state machine
│           └── supabase.js    # Supabase JS client & DB helper wrappers
├── src/                    # Modular application code & React SPA core
│   ├── components/         # UI components (LeafletMap, DataBank, SourceRegistry)
│   ├── data/               # Hydrographic source registries & initial seeds
│   ├── hooks/              # Navigation, layer, and state hooks
│   ├── lib/                # Database clients, UI flags, and versioning
│   ├── schemas/            # WWNWS navigational warning validation schemas
│   └── utils/              # DMS coordinate parsers, nautical export, markdown parsers
├── api/                    # Serverless API endpoints & cron targets
│   ├── scrape-navwarn.ts      # Automated ingestion crawler (Vercel Cron: 0 6 * * *)
│   ├── admin/                 # Protected admin verification & test endpoints
│   └── supabase/              # Database health & synchronization endpoints
├── docs/                   # Specifications, SQL schemas, and UX audits
│   └── supabase_setup.sql     # Database DDL, RLS policies & migration scripts
├── scripts/ux-audit/       # Playwright UI capture & UX smoke test harness
├── playwright.config.ts    # End-to-end browser testing configuration
├── vercel.json             # Deployment routing, cleanUrls, and cron configuration
└── vite.config.ts          # Multi-page build configuration
```

---

## 🔒 Security & Database Model

### Database Security (Supabase PostgreSQL + RLS)
The database uses Row Level Security (RLS) on all tables to ensure public callers can never write or modify navigational warnings:

| Table | Public Access (`anon`) | Admin Access (`authenticated`) |
|---|---|---|
| `public.nav_warnings` | `SELECT` where `status = 'active'` | `ALL` (insert, update, delete) |
| `public.ingestion_generations` | `SELECT` | `ALL` |
| `public.sources_registry` | `SELECT` | `ALL` |
| `public.pipeline_logs` | No access | `ALL` |

To set up or inspect the database schema, run [`docs/supabase_setup.sql`](docs/supabase_setup.sql) in your Supabase SQL Editor.

### Proxy Security & SSRF Protection
- **SSRF Guard (`server/ssrfGuard.ts`):** All outbound network requests for evidence enrichment or bulletin crawling validate hostnames against an approved hydrographic registry, resolve DNS to block private/internal IP ranges (IPv4/IPv6 RFC 1918, loopbacks), and restrict response payloads to 2MB with strict 10s timeouts.
- **CARTO Basemap Proxy (`/api/tiles/carto/*`):** Proxies maritime map tiles server-side to prevent exposing `CARTO_API_KEY` to public clients while enforcing dedicated rate limits (600 req/min per IP).
- **AI Fallback Resilience:** Primary extraction runs via Google Gemini (`gemini-3.1-flash-lite`); if rate limits or outages occur, the pipeline fails over smoothly to Mistral AI (`mistral-small-latest`).

---

## 🛠️ Local Development

### Prerequisites
- Node.js (v20+ or v22)
- npm (v10+)

### Installation
```bash
git clone https://github.com/alfredpanakkal/helm.navwarning.git
cd helm.navwarning
npm install
```

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Populate the required environment variables:
| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Your Supabase project URL (`https://xyz.supabase.co`) |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon public API key |
| `SUPABASE_SECRET_KEY` | Yes | Supabase service role key (for serverless/cron DB writes) |
| `CRON_SECRET` | Recommended | Bearer token for authorized scraper cron invocations |
| `GEMINI_API_KEY` | Recommended | API key for automated coordinate & text extraction |
| `MISTRAL_API_KEY` | Optional | Secondary fallback AI provider key for rate limit failover |
| `CARTO_API_KEY` | Optional | Secret key for CARTO basemap tile proxy |

### Development Server
Start the local server with live Vite middleware on port 3000:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) for the public portal or [http://localhost:3000/admin.html](http://localhost:3000/admin.html) for the admin console.

### Build & Verification
```bash
# Typecheck codebase
npm run lint

# Build client bundle & compile server.ts to dist/server.cjs
npm run build

# Start production server
npm start

# Run Playwright UX regression smoke tests
npm run ux:smoke
```

---

## 🚢 Deployment

The project is configured for automated continuous deployment on **Vercel**:
- Deployments trigger automatically on pushes to `main`.
- `cleanUrls: true` enables clean routing (`/` for public, `/admin` for console).
- Scheduled cron `/api/scrape-navwarn` triggers daily at `06:00 UTC` with `Bearer <CRON_SECRET>` authorization.

---

## 📜 Disclaimer
*This system is an automated decision-support tool. It is not an official Maritime Safety Information (MSI) distributor and is not a substitute for the Global Maritime Distress and Safety System (GMDSS) or official hydrographic publications.*

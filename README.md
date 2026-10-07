# Helm.Warning (NAVAREA Maritime Safety Information Pipeline)

> **Live Application:** [helmwarning.vercel.app](https://helmwarning.vercel.app/)  
> **Repository:** [github.com/alfredpanakkal/helm.navwarning](https://github.com/alfredpanakkal/helm.navwarning)

Helm.Warning is an automated pipeline, spatial geometry visualizer, and navigational warning management platform for global **NAVAREA** maritime safety warnings (MSI). It aggregates data from national hydrographic offices, parses geographic coordinates, verifies active hazard areas, and visualizes them on nautical chart layers.

---

## 🚀 Key Features

### 🌐 Public Site (`/`)
- **Interactive Maritime Map:** Powered by Leaflet.js with Esri Ocean Base and nautical layer support.
- **NAVAREA Data Bank:** Fast search and multi-criteria filters by NAVAREA region, severity (Critical, High, Moderate), and category (Military, Drifting, AtoN, Subsea, General).
- **Source Registry:** Status and sync tracking across global Hydrographic Offices (UKHO, NGA, SHOM, AMSA, etc.).
- **Zero-Admin Decoupling:** Fully read-only, sanitized public interface with zero exposure of administrative tools, internal schemas, or API keys.
- **Responsive Layout:** Adaptive desktop, tablet, and mobile views with dedicated drawers and bottom navigation.

### 🔐 Admin Console (`/admin`)
- **Gated Authentication:** Secured via Supabase Auth email/password login.
- **Noindex Protection:** Protected by `X-Frame-Options: DENY`, `noindex, nofollow, noarchive` headers.
- **5 Operational Workspaces:**
  1. **Overview:** Health monitoring, attention notifications, and pipeline operational stats.
  2. **Pipeline:** Stage-by-stage pipeline inspection (`Fetch Sources` → `Parse & Normalize` → `Geocode Geometry` → `Publish Generation`), feed latency, and live log streaming.
  3. **Bulk Import Wizard:** 4-step wizard supporting manual bulletin text, CSV, GPX, and S-124 formats with real-time validation and deduplication preview.
  4. **Verification Queue:** Human-in-the-loop triage interface to confirm or reject parsed warnings.
  5. **System Diagnostics:** Live connectivity test for AI extraction models (Gemini Flash-Lite) and database health metrics.

---

## 🏗️ Architecture

```
helm-warning/
├── index.html              # Public maritime portal (Map, Data Bank, Sources)
├── admin.html              # Gated Admin console (5 management tabs)
├── public/
│   └── assets/
│       ├── css/
│       │   ├── tokens.css     # Design tokens (5 status colors, typography scale)
│       │   └── components.css # Modular component styles (buttons, badges, modals, toasts)
│       └── js/
│           ├── public.js      # Public portal logic & Leaflet controller
│           ├── admin.js       # Admin portal logic & auth state machine
│           └── supabase.js    # Supabase JS client & DB helper wrappers
├── api/                    # Vercel serverless functions
│   ├── scrape-navwarn.ts      # Automated ingestion crawler (Vercel Cron: 0 6 * * *)
│   ├── admin/                 # Protected admin API endpoints
│   └── supabase/              # Database health & sync endpoints
├── docs/
│   └── supabase_setup.sql     # Database DDL, RLS policies & emergency unlocks
├── vercel.json             # Deployment routing, cleanUrls, and cron configuration
└── vite.config.ts          # Multi-page build configuration
```

---

## 🔒 Security & Database Model

The database is built on **Supabase (PostgreSQL)** with Row Level Security (RLS) actively enforced:

| Table | Public Access (Anon) | Admin Access (Auth) |
|---|---|---|
| `public.nav_warnings` | `SELECT` where `status = 'active'` | `ALL` (insert, update, delete) |
| `public.ingestion_generations` | `SELECT` | `ALL` |
| `public.sources_registry` | `SELECT` | `ALL` |
| `public.pipeline_logs` | No access | `ALL` |

To set up or inspect the database schema, run [`docs/supabase_setup.sql`](docs/supabase_setup.sql) in your Supabase SQL Editor.

---

## 🛠️ Local Development

### Prerequisites
- Node.js (v18+)
- npm

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
Populate your environment variables:
- `SUPABASE_URL`: Your Supabase Project URL
- `SUPABASE_PUBLISHABLE_KEY`: Your Supabase anon public key
- `SUPABASE_SECRET_KEY`: Service role key (for serverless functions)
- `CRON_SECRET`: Bearer token for authorized scraper cron invocations
- `GEMINI_API_KEY`: API key for automated coordinate & text extraction

### Build & Run
```bash
# Build the multi-page static bundle
npx vite build

# Run local preview
npx vite preview
```

---

## 🚢 Deployment

The project is configured for automated continuous deployment on **Vercel**:
- Deployments trigger automatically on pushes to `main` and `master`.
- `cleanUrls: true` enables clean routing (`/` for public, `/admin` for console).
- Scheduled cron `/api/scrape-navwarn` triggers daily at `06:00 UTC`.

---

## 📜 Disclaimer
*This system is an automated decision-support tool. It is not an official Maritime Safety Information (MSI) distributor and is not a substitute for the Global Maritime Distress and Safety System (GMDSS) or official hydrographic publications.*

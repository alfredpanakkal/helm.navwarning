# Product Requirements Document (PRD)
## NavWarning System - Maritime Navigational Warnings Management Platform

### 1. Executive Summary

The NavWarning system is a comprehensive web application designed for the collection, management, visualization, and dissemination of maritime navigational warnings (NAVAREA warnings) as mandated by the International Hydrographic Organization (IHO) and World-Wide Navigational Warning Service (WWNWS). The system enables maritime authorities, navigators, and shipping companies to access real-time hazard information critical for safe navigation.

### 2. Product Vision

To provide a centralized, secure, and intelligent platform for maritime safety information that:
- Aggregates navigational warnings from global maritime authorities
- Provides real-time visualization on maritime charts
- Enables verification and validation of warning data
- Supports AI-assisted parsing and triage of warning messages
- Maintains an auditable trail of all warning information
- Ensures data integrity and security through robust controls

### 3. Target Users & Roles

#### 3.1 Public Users (View-only access)
- Maritime navigators and ship operators
- Port authorities and harbor masters
- Maritime pilots and VTS operators
- Shipping company operations centers
- Search and rescue organizations
- Maritime insurers and risk assessors

#### 3.2 Administrative Users (Full access)
- National Hydrographic Offices (NHOs)
- NAVAREA coordinators
- Maritime safety information (MSI) providers
- System administrators and data curators
- AI/ML engineers maintaining parsing models

### 4. Core Features

#### 4.1 Map Visualization (LeafletMap Component)
- Interactive map display using Leaflet.js with multiple basemap options
- Spatial representation of navigational warnings:
  - Point hazards (drifting containers, unlit buoys)
  - Polygon areas (exercise zones, rocket launch areas)
  - Circle exclusion zones (UXO, anchoring prohibited)
  - LineString routes (if implemented)
- Click-to-select warning details with drill-down capability
- Layer toggling by NAVAREA, source, status, and hazard type
- Spatial filtering and bounds-based querying
- Offline tile caching for low-bandwidth environments

#### 4.2 Data Bank (DataBank/DataBankV2 Components)
- Tabular listing of all navigational warnings with sortable columns
- Status filtering (Active, Cancelled, Expired, Unknown, Unverified)
- Source filtering by maritime authority
- NAVAREA filtering for regional focus
- Bulk verification workflow for administrators
- Commit warnings to persist parsed data
- Refresh pipeline triggers for data synchronization
- Export capabilities (CSV/JSON - implied from import symmetry)
- Pagination and virtual scrolling for large datasets
- Offline mode indicators when Supabase unavailable

#### 4.3 Sources Registry (SourceRegistryView/SourceRegistryViewV2)
- Registry of maritime authority data sources with metadata:
  - Source ID, publisher name, NAVAREA coverage
  - Publication semantics (complete_in_force, incremental_feed, archive_lookup)
  - Entry points, discovery URLs, allowed hosts
  - Parser identification and format (JSON/HTML/PDF/Text)
  - Polling intervals and staleness thresholds
  - Verification status (verified/unverified/investigating/disabled)
  - Health metrics (last run, success status, active warning count)
- Enable/disable toggles for individual sources
- Manual refresh triggers for specific sources
- Health status indicators with color-coding
- Last run timestamps and success/failure tracking

#### 4.4 Workspace Pipeline (WorkspaceView - Admin Only)
- Ingestion pipeline monitoring and control
- Generation history with timestamps and processing metrics
- Artifact management (raw fetched data)
- Pipeline event logging with FETCH→PARSE→EXTRACT→CHECK→SAVE→DONE stages
- Manual pipeline trigger for specific sources or all sources
- Status indicators (READY/RUNNING/ERROR/UNAVAILABLE)
- Database connectivity status (CONNECTED/UNAVAILABLE/OFFLINE)
- Last run statistics (records found/stored/updated/failed/unchanged)

#### 4.5 Import Functionality (CsvUploaderView - Admin Only)
- CSV file upload for bulk warning import
- GPX and S-124 ZIP format support (planned/implied)
- Field mapping interface for custom CSV formats
- Validation preview before commitment
- Deduplication against existing warnings
- Progress indication during processing
- Error reporting for malformed records

#### 4.6 Manual Parser (ManualParserView - Admin Only)
- Direct text entry for warning messages
- NAVAREA selection for context
- Parsing mode selection (hybrid/LLM/regex)
- AI model selection (Gemini variants)
- Real-time parsing with spatial coordinate extraction
- Deterministic fallback when AI services unavailable
- Warning preview before commitment to database
- AI parsing failure indication with error details
- Support for cancellation message parsing ("CANCEL THIS MSG...")

#### 4.7 Audit Trail (GenerationInspectorView - Admin Only)
- Ingestion generation history with completeness status
- Validation issue tracking per generation
- Evidence hash verification for data integrity
- Artifact reference tracking to storage systems
- Explicit cancellation tracking per generation
- Semantic publication kind tracking
- Source attribution per generation
- Temporal tracking (created_at timestamps)

#### 4.8 Evidence Locker (EvidenceLockerView - Admin Only)
- Raw artifact storage from source fetches
- Content type identification (JSON/HTML/PDF/Text)
- Size and timestamp tracking
- Content hash for integrity verification
- Preview text snippets for quick identification
- Full content retrieval for detailed examination
- GCS-style path naming convention (`gs://navwarn-evidence/...`)

#### 4.9 Supabase Status (SupabaseStatusView - Admin Only)
- Connection status to Supabase backend
- Table-level counts (warnings, sources, generations, artifacts)
- Local vs. synchronized count comparison
- Health indicators and latency metrics
- Manual synchronization triggers
- Error diagnostics and troubleshooting information

#### 4.10 Disclaimer Banner (DisclaimerBanner Component)
- Prominent display of data currency and accuracy disclaimers
- Last update timestamps
- Source attribution requirements
- Usage limitations and liability disclaimers
- Acknowledgment of data source authorities

#### 4.11 Legacy/Modern UI Switcher (UILegacySwitcher Component)
- Toggle between classic and modern interface variants
- Persistent user preference storage
- Graceful degradation for older browsers
- Consistent functionality across UI variants

### 5. Technical Architecture

#### 5.1 Frontend Stack
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6 with ESBuild optimization
- **Styling**: Tailwind CSS 4 with custom design tokens (`gw-*` color palette)
- **State Management**: React hooks with local state and Supabase synchronization
- **Mapping**: Leaflet.js with OpenStreetMap/CARTO basemaps
- **Icons**: Lucide React for lightweight, consistent icons
- **Form Handling**: React Hook Form implied (validation patterns)
- **HTTP Client**: Fetch API with wrapper functions in services layer

#### 5.1.1 Entry-Point Architecture (v2.5, PR #24)
- `index.html` — public portal (Map / Data Bank / Sources)
- `admin.html` — admin gateway: login card only; on successful sign-in (or an
  existing admin session) it redirects to `/console#/warnings/list`. It never mounts
  the React app and writes no client-side trust flags.
- `console.html` — React admin console entry page; mounts `src/main.tsx`
  (noindex, frame-DENY). Served at `/console` on both Vercel (security headers
  in vercel.json) and the self-hosted Express server (server.ts route).
- All three pages are Vite build inputs (`vite.config.ts` rollupOptions.input).

#### 5.2 Backend Stack
- **Primary Server**: Express.js (Node.js) for development and self-hosted deployment
- **Serverless Option**: Vercel Serverless Functions for specific endpoints
- **Database**: Supabase (PostgreSQL) with real-time capabilities
- **Authentication**: Supabase Auth with JWT and role-based access control
- **Storage**: Supabase Storage for evidence locker artifacts
- **Edge Functions**: Deno-based functions for scheduled scraping (referenced but external)
- **AI Integration**: 
  - Google Gemini API (sole AI provider for all AI tasks)
- **Security**: Custom SSRF protection, CSP headers, rate limiting, input validation
- **Proxying**: Server-side proxies for CARTO tiles and FreeOpenAPI to protect API keys

#### 5.3 Data Model
Based on `src/types.ts` and initialization data:

##### Core Entities
- **NavWarning**: Individual navigational warning with:
  - Identity fields (warning_id, source_warning_id, publisher)
  - Temporal fields (issued_at, valid_from, valid_to, cancelled_at)
  - Spatial field (Point, Polygon, Circle geometries with validation)
  - Status fields (active/cancelled/expired/unknown/unverified)
  - Metadata fields (area_text, original_language, raw_text)
  - Extended fields (title, authority, risk_level, charts, categories)
  - AI assessment (ai_triage with decision, confidence, hazard_category)
  - Provenance (generation_id, extraction_method, confidence)
  - Validation (identity, dates, geometry status)

- **SourceRegistryItem**: Maritime authority configuration:
  - Identification (source_id, publisher details)
  - Coverage (navareas array)
  - Technical details (format, languages, parser_id, entrypoints)
  - Operational semantics (publication_semantics, poll intervals)
  - Verification and health tracking

- **IngestionGeneration**: Processing batch record:
  - Generation identification and timing
  - Source attribution and publication semantics
  - Processing metrics (parsed_count, active_count)
  - Completeness status (verified/unverified/failed/sync_failed)
  - Evidence tracking (evidence_hash, artifact_ref)
  - Validation issues array

- **RawArtifact**: Immutable source data:
  - Artifact identification and sourcing
  - Timestamp and content metadata
  - Storage path and content hash
  - Size and preview text

- **EcdisIntermediateLayer**: IMO ECDIS-ready format:
  - Geometry intent (points/area/route/unknown)
  - Feature inference (explicit/inferred)
  - Feature confidence (verified/partial/rejected)
  - Feature modification state (original/edited/inserted/deleted)
  - Feature role hints (vertex/start/end/intermediate/null)

#### 5.4 Security Architecture
- **Authentication**: Supabase JWT with app_metadata role verification (admin/superadmin/is_admin)
- **Authorization**: Dual-layer check (app_metadata + optional admin_users table)
- **Transport Security**: HTTPS enforcement, HSTS with preload
- **Network Security**: 
  - Custom SSRF protection with hostname allowlisting
  - DNS resolution and IP blocklisting (private/reserved ranges)
  - Connection IP pinning to prevent DNS rebinding
  - Step-by-step redirect validation with size/time limits
- **Application Security**:
  - Content Security Policy with strict directives
  - Permissions Policy disabling camera/microphone/geolocation
  - X-Frame-Options: SAMEORIGIN
  - X-Content-Type-Options: nosniff
  - Referrer Policy: strict-origin-when-cross-origin
  - Rate limiting (global 100req/15min/IP, AI 10req/min/user, tiles 600req/min/IP)
  - Input sanitization and length limits (10k chars for AI prompts)
  - API key protection via server-side proxies
  - Timing attack prevention with constant-time comparisons

### 6. Data Flow & Processing Pipeline

#### 6.1 Ingestion Pipeline
1. **Trigger Mechanisms**:
   - Scheduled: Vercel cron → `/api/scrape-navwarn` (06:00 UTC daily)
   - Manual: Admin UI → `/api/pipeline/trigger` (specific source or all)
   - Client-initiated: `triggerPipelineRefresh()` → Supabase Edge Functions
   - Import: CSV/markdown/manual entry → processing endpoints

2. **Processing Stages**:
   - **FETCH**: Retrieve source material via HTTP with SSRF protection
   - **PARSE**: Extract warning blocks using regex/splitters
   - **EXTRACT**: Parse coordinates and structure (deterministic → AI fallback)
   - **CHECK**: Validate against business rules and spatial constraints
   - **SAVE**: Persist to database with deduplication
   - **DONE**: Complete run with metrics and event logging

3. **Persistence Strategy**:
   - In-memory database for low-latency UI access
   - Periodic synchronization to Supabase (chunks of 100 rows)
   - Fallback to static seed data when Supabase unavailable
   - Artifact storage in Supabase Storage with GCS-style paths
   - Immutable generations with evidence hashes for audit trails

4. **Data Synchronization**:
   - Bidirectional sync between in-memory store and Supabase
   - Conflict resolution via `onConflict: source_id,warning_id` (fallback to warning_id)
   - Health tracking for sources (consecutive failures → error status)
   - Generation immutability via content hashes and audit trails

#### 6.2 AI Processing Flows
- **Single Warning Parse** (`/api/parse-navwarn`):
  - Input: Raw warning text
  - Process: Gemini → Structured WWNWS JSON
  - Output: Parsed warning with spatial data and metadata
  - Auth: Required (admin only)

- **Bulk Ingest with AI** (`/api/pipeline/bulk-ingest-ai`):
  - Input: Raw notice text (multiple warnings)
  - Process: AI triage → ACCEPTED/REJECTED/NEEDS_REVIEW + metadata
  - Output: Accepted warnings + rejected items with codes/reasons
  - Auth: Required (admin only)

- **Batch Audit with AI** (`/api/pipeline/bulk-audit-ai`):
  - Input: Staged warnings needing verification
  - Process: AI review → Accepted/Rejected/Needs Review + confidence
  - Output: Audited warnings with updated metadata
  - Auth: Required (admin only)

- **Markdown Parsing** (`/api/pipeline/parse-markdown`):
  - Input: Markdown document with multiple warnings
  - Process: Deterministic → Gemini chunked extraction (max 20 chunks)
  - Output: Array of parsed warnings
  - Auth: **Public** (notable exception - potential risk)

- **Manual Parse** (`/api/pipeline/parse-manual`):
  - Input: Single warning text + NAVAREA + mode preference
  - Process: Deterministic → Gemini fallback
  - Output: Parsed warning with AI failure flags
  - Auth: Required (admin only)

### 7. Non-Functional Requirements

#### 7.1 Performance
- Page load time < 3s on 3G connection
- Map rendering < 2s for 1000+ warnings
- API response time < 500ms for cached data
- Support for 10,000+ active warnings in database
- Concurrent user support: 100+ simultaneous users
- Batch processing of 1000+ warnings per pipeline run

#### 7.2 Scalability
- Horizontal scaling via Supabase (PostgreSQL)
- Stateless frontend suitable for CDN hosting
- Microservice-style API endpoints
- Configurable polling intervals per source
- Adjustable AI batch sizes for cost control

#### 7.3 Reliability
- Offline mode with local data persistence
- Graceful degradation when AI services unavailable
- Circuit breaker patterns for external dependencies
- Automated retry with exponential backoff
- Data validation at multiple ingress points
- Backup and recovery procedures documented

#### 7.4 Security
- OWASP ASVS Level 2 compliance target
- Regular security scanning and penetration testing
- Secure cookie settings (HttpOnly, Secure, SameSite)
- SQL injection prevention via parameterized queries
- XSS prevention via React auto-escaping and CSP
- CSRF protection via SameSite cookies and token validation
- Role-based access control with least privilege principle
- Audit logging for administrative actions
- Regular key rotation and secret management

#### 7.5 Usability
- WCAG 2.1 AA accessibility compliance
- Keyboard navigation support
- Screen reader compatibility
- Color contrast ratios meeting AA standards
- Responsive design for mobile/tablet/desktop
- Internationalization ready (English primary, multilingual sources)
- Error prevention via confirmation dialogs
- Undo/redo capabilities where appropriate
- Help documentation and tooltips

#### 7.6 Maintainability
- Modular component architecture
- Comprehensive type safety with TypeScript
- Consistent code formatting and linting
- Automated test coverage targets
- Clear separation of concerns (presentation/business/data)
- Documentation of APIs and data models
- Dependency management with lock files
- Feature flagging for gradual rollouts

### 8. Constraints and Assumptions

#### 8.1 Technical Constraints
- Browser support: Modern browsers (Chrome, Firefox, Safari, Edge) - last 2 versions
- Mobile support: Responsive design, not native app
- AI dependency: Requires a valid Gemini API key
- Supabase dependency: Requires valid Supabase project credentials
- Network dependency: Requires internet connectivity for live data
- Storage limits: Subject to Supabase storage plan limits
- Rate limits: Subject to AI provider and tile service rate limits

#### 8.2 Assumptions
- Maritime authorities provide machine-readable warning feeds
- Standard NAVAREA numbering and geographic boundaries apply
- WWNWS message formats follow established conventions
- Users have basic maritime navigation knowledge
- Administrative users have authority to manage sources
- Data accuracy ultimately rests with source authorities
- System is decision-support, not primary navigation source
- Legal disclaimers mitigate liability for data inaccuracies

### 9. Success Metrics

#### 9.1 Adoption Metrics
- Number of active maritime authorities integrated
- Monthly active users (maritime professionals)
- Average session duration
- Warning verification rate (% of warnings verified)
- Data freshness (average age of warnings in system)

#### 9.2 Performance Metrics
- Page load performance (LCP, FID, CLS)
- API latency percentiles (p50, p95, p99)
- Error rates (HTTP 5xx, validation failures)
- AI parsing accuracy (% correct extractions)
- System uptime and availability

#### 9.3 Quality Metrics
- Data completeness (% of expected warnings captured)
- Spatial accuracy (% warnings with valid geometry)
- Temporal accuracy (% warnings with correct validity periods)
- Deduplication effectiveness (% reduction in duplicates)
- User satisfaction scores (NPS or similar)

#### 9.4 Operational Metrics
- Mean time to detect (MTTD) data issues
- Mean time to resolve (MTTR) system issues
- Frequency of false positives/negatives in AI triage
- Cost per warning processed (AI/API costs)
- Administrative overhead for source management

### 10. Open Questions and Considerations

#### 10.1 Feature Prioritization
- Should ECDIS export (S-124/S-57) be a core feature or future enhancement?
- What is the optimal balance between AI automation vs. human verification?
- Should the system support cooperative editing or conflict resolution for concurrent edits?
- How should we handle conflicting information from different sources for same geographic area?

#### 10.2 Integration Points
- What are the priority integrations with ECDIS/ECS platforms?
- Should we provide APIs for external systems to consume warning data?
- How should we integrate with GMDSS and SafetyNET systems?
- What is the relationship with existing MSI distribution systems?

#### 10.3 Data Quality and Validation
- What validation rules should apply to different warning types?
- How should we handle ambiguous or incomplete coordinate information?
- What is the policy for dealing with expired vs. cancelled warnings?
- How should we validate spatial geometry correctness (self-intersecting polygons, etc.)?

#### 10.4 Operational Considerations
- What is the recommended monitoring and alerting strategy?
- How should we handle data source outages or degradations?
- What is the backup and disaster recovery procedure?
- How should we handle version upgrades and data migrations?

### 11. Implementation Roadmap (Suggested)

#### Phase 1: Foundation (Current State)
- Core map visualization and data bank
- Sources registry with health monitoring
- Basic authentication and admin gating
- Supabase integration for persistence
- Basic import/export functionality

#### Phase 2: Intelligence Layer
- AI-assisted parsing and triage
- Bulk ingest and audit capabilities
- Manual parser with fallback strategies
- Evidence locker and artifact management
- Pipeline monitoring and control

#### Phase 3: Collaboration and Assurance
- Verification workflows and audit trails
- Generation history and data lineage
- Evidence correlation and validation
- Offline mode enhancement
- Performance optimization and caching

#### Phase 4: Expansion and Integration
- ECDIS export formats (S-124/S-57)
- External API for warning consumption
- Integration with voyage planning systems
- Advanced analytics and prediction capabilities
- Multilingual support and localization

---

*This PRD was generated based on comprehensive code analysis of the NavWarning system. It represents the current state and suggested future direction of the product.*
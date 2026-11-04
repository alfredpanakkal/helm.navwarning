# Phase 5: In-Force Status Computation Design

## 1. Objective

NAVAREA coordinators periodically broadcast **In-Force Lists** (Lists of Effective Warnings) — all warnings that remain legally active in a sea area at a given time. Phase 5 compares the stored in-force snapshots against the live warning database and computes, deterministically:
1. **Coverage Rate**: What fraction of legally active warnings does our database hold?
2. **Missing Warnings**: Which in-force notices are missing from our database?
3. **Extra/Orphaned Warnings**: Which active warnings are stored in our database that the coordinator did not list (indicating missed cancellations or delays)?
4. **Enrichment Depth**: How many held warnings have parsed geographic coordinates/geometries versus text-only representations?

---

## 2. Mathematical Coverage Model

Given a NAVAREA $A$, an authoritative or latest snapshot $S_A$ with deduplicated listed entries $E(S_A)$, and the set of database warnings $W_A$:

### 2.1 Deduplicated Listed Warnings ($N_{listed}$)
Raw in-force lists occasionally repeat warning references across series or broadcast sections. Let $Norm(id)$ be the canonical identifier transformation:
$$E_{unique} = \{ Norm(e.warning\_id) \mid e \in S_A.entries \}$$
$$N_{listed} = |E_{unique}|$$

### 2.2 Held Warnings ($N_{held}$)
A listed warning is considered held if there exists an active or recognized record in $W_A$ whose normalized identifier matches:
$$W_{held} = \{ e \in E_{unique} \mid \exists w \in W_A \text{ s.t. } Norm(w.id) = e \}$$
$$N_{held} = |W_{held}|$$

### 2.3 Spatial & Verification Ensembles
- **With Geometry ($N_{geom}$)**:
  $$N_{geom} = |\{ w \in W_{held} \mid HasGeometry(w) \}|$$
  where $HasGeometry(w)$ is true if $w$ contains at least one geometry polygon/linestring/point, a circle with positive radius, or valid non-null latitude/longitude coordinates.
- **Verified ($N_{verified}$)**:
  $$N_{verified} = |\{ w \in W_{held} \mid IsVerified(w) \}|$$
  where $IsVerified(w)$ is true if $w.is\_verified = \text{true}$, $w.status = \text{'verified'}$, or $w.extraction\_confidence \ge 0.8$.

### 2.4 Missing Warnings ($N_{missing}$)
$$W_{missing} = E_{unique} \setminus W_{held}$$
$$N_{missing} = |W_{missing}| = N_{listed} - N_{held}$$

### 2.5 Extra Active Warnings ($N_{extra}$)
Extra warnings represent notices present in the database marked as `active` that are **absent** from the latest authoritative in-force list. To prevent false positives:
- Exclude notices with status `cancelled` or `expired`.
- Exclude the in-force bulletin notices themselves (detected via regex `/IN\s*FORCE/i` on title/raw text).
$$W_{extra} = \{ w \in W_A \mid w.status \notin \{\text{'cancelled'}, \text{'expired'}\} \land \neg IsInForceBulletin(w) \land Norm(w.id) \notin E_{unique} \}$$
$$N_{extra} = |W_{extra}|$$

### 2.6 Coverage Percentage
$$\text{Coverage \%} = \begin{cases}
100 & \text{if } N_{listed} = 0 \\
\operatorname{round}\left(\frac{N_{held}}{N_{listed}} \times 100\right) & \text{if } N_{listed} > 0
\end{cases}$$

---

## 3. Warning Status Taxonomy

Each listed warning entry is classified into exactly one mutually exclusive status:

| Status | Code | Geometry Present? | Verified? | Description |
|---|---|---|---|---|
| **Not Held** | `not_held` | N/A | N/A | Listed by the coordinator, but no matching record exists in the local database. |
| **Held with Geometry** | `held_with_geometry` | Yes | Any | Warning exists locally and has parsed spatial coordinates/features ready for GIS mapping. |
| **Held without Geometry** | `held_without_geometry` | No | Yes | Warning exists locally without coordinates, but is verified or has high extraction confidence ($\ge 0.8$). |
| **Held Text Only** | `held_text_only` | No | No | Warning exists locally as unverified/raw text without spatial coordinates. |

---

## 4. Identifier Normalization Architecture

Because coordinators and scraping pipelines use divergent string formats, comparison requires strict canonical normalization into the WWNWS standard:
$$\text{NAVAREA } \{AREA\} \text{ } \{NUMBER\}/\{2\text{-DIGIT-YEAR}\}$$

The `normalizeWarningId(warningId: string, defaultNavarea?: string)` engine handles:

1. **Standard Full Prefix**:
   - `"NAVAREA IX 364/24"` $\to$ `"NAVAREA IX 364/24"`
   - `"NAVAREA IV 12/26"` $\to$ `"NAVAREA IV 12/26"`
2. **Four-Digit Year Normalization**:
   - `"NAVAREA IX 364/2024"` $\to$ `"NAVAREA IX 364/24"`
   - `"NAVAREA IV 005/2005"` $\to$ `"NAVAREA IV 5/05"`
3. **Dash-Delimited & Compact Tokens**:
   - `"IX-364-24"` $\to$ `"NAVAREA IX 364/24"`
   - `"IV-012-2024"` $\to$ `"NAVAREA IV 12/24"`
4. **Leading Zero Stripping on Warning Numbers**:
   - Notice numbers like `"001/26"` or `"0364/24"` strip leading zeros to `1/26` and `364/24` via integer parsing, ensuring numeric equivalence between database entries and telex broadcasts.
   - Two-digit year representations preserve leading zeros (e.g. `05` for 2005).
5. **Number/Year Only with Default NAVAREA**:
   - `"364/24"` (with `defaultNavarea = 'IX'`) $\to$ `"NAVAREA IX 364/24"`
   - `"12/2024"` (with `defaultNavarea = 'IV'`) $\to$ `"NAVAREA IV 12/24"`

---

## 5. Performance, invalidation & caching

Coverage is computed over thousands of notices, so results are cached and invalidated precisely:

1. **Module-Level Status Cache**:
   - In-memory cache keyed by NAVAREA ID: `Map<string, CacheEntry>`.
   - **Time-to-Live (TTL)**: 5 minutes (300,000 ms).
2. **Granular Identity Hash (`warningsHash`)**:
   - Cache keys must immediately invalidate if any warning is edited, verified, or updated.
   - Hash formulation:
     $$\text{hash} = \bigoplus_{w \in W} \left( id : navarea : status : is\_verified : hasGeometry \right)$$
   - If a warning receives verified status or coordinates are added, the hash changes and forces re-computation.
3. **Zero-Side-Effect Reads**:
   - `getInForceStatus(navarea)` in `useDataBankModel` reads from the cache or executes a pure synchronous computation. It never invokes React state setters, preventing recursive render loops.

---

## 6. Lifecycle Fallback Strategy

When a NAVAREA has not yet published an in-force list or the snapshot table is being populated:
- If `FEATURE_FLAGS.inForceFallbackToLifecycle` is enabled:
  - System inspects currently held active warnings for that NAVAREA.
  - Generates a fallback coverage summary where $N_{listed} = N_{held} = |W_{active}|$.
  - Reports $100\%$ nominal coverage without crashing or showing blank screens.
- If disabled or if no active warnings exist:
  - Returns a graceful empty result with `isLoading: false`.

---

## 7. Feature flags

- `FEATURE_FLAGS.inForceUIDisplay`: Master switch for in-force coverage UI indicators.
- `FEATURE_FLAGS.inForceFallbackToLifecycle`: Governs whether empty snapshots fall back to active database records.
- Flags dynamically evaluate `process.env.FEATURE_FLAGS` in tests and runtime overrides without restarting the application.

# Open Questions & Operator Decision Framework

The following questions represent business policy decisions, human labeling resource allocations, or operator preferences that cannot be answered solely by inspecting source code. Each item includes a recommended default for approval.

## Operator Policy Decisions Needed

### Decision D1: Public Text-Only Display for Tier B / Tier C Warnings
- **Question**: Should active warnings with unverified or unparsed geometries (Tier B or Tier C) display warning text on the public portal accompanied by a warning banner ("position not verified, see original text"), while withholding the map plot?
- **Recommended Default**: **YES**. Suppressing active hazard text on the public portal violates safety asymmetry invariant I5 ("never hide an active warning because of an unparsed position"). Display text with a prominent "Position Unverified" banner and omit map vector overlays until operator verification.

### Decision D2: Acceptance Test Set Labeling & Human Qualification
- **Question**: Who produces and confirms the ground-truth labels for the 55-message + 28-fixture acceptance test suite, and what is the weekly labeling capacity?
- **Recommended Default**: **Operator Alfred or a named maritime-qualified reviewer**. Ground-truth labels must be verified by a human against raw broadcast text and recorded per fixture. AI draft outputs may assist drafting speed, but AI output is never treated as its own expected result.

### Decision D3: Triage Tier Downgrade Policy (Tier B -> Tier A)
- **Question**: Under what exact criteria may a value-preserving rule (e.g., zero-padding removal, whitespace normalization, NBSP stripping outside coordinate tokens) be downgraded from Tier B to Tier A auto-accept?
- **Recommended Default**: **Permit downgrade ONLY after rule-specific unit fixtures pass 100% AND the operator explicitly approves**. Value-changing repairs (e.g., spelled number rewriting, coordinate dialect fixes, derived identities) are permanently barred from downgrade and remain in Tier B.

### Decision D4: Forward Holdout Window Duration
- **Question**: How long should the forward holdout evaluation window run for testing post-freeze parser performance on newly ingested feeds?
- **Recommended Default**: **4 Weeks**. Ingested messages over a 4-week window following rule stabilization will be hand-labelled by a qualified operator to evaluate zero-error coordinate accuracy on genuinely unseen data.

---

## Architectural Open Questions

1. **Splitter Empty Stub Linkage**: When dual-criteria message splitting produces a fragment with a valid header but no body text, should it be classified as an `empty_stub` (Rule 5) linked to the parent feed, or re-combined with the preceding text block if no DTG line is present?
   - *Default*: Classify as `empty_stub` with linked parent reference.

2. **Rule 105 Historical Cross-Generation Revocation Depth**: Should Rule 105 `"MESSAGES CANCELLED SINCE [DATE] = [LIST]"` clauses evaluate across historical database generations or strictly within the active NAVAREA's current generation snapshot?
   - *Default*: Restricted to the same NAVAREA, same serial number, and same issuance year within the active generation snapshot (proposal only).

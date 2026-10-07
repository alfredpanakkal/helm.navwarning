/**
 * Task 6 (plan §1.4) — sanctioned user-visible terminology renames.
 *
 * The Sprint-0 baselines under docs/ux-audit/dom/ are "before" evidence and
 * must never be rewritten, but the classic-path parity diffs compare the
 * current render against them. Applying this map to BOTH sides keeps those
 * diffs meaningful (structure/content parity) while acknowledging the
 * deliberate constraint-10 cleanup: pane identifiers, "worker" and "LLM" are
 * gone from user-visible strings on every path (controller ruling, Task 6).
 *
 * Only the exact, pre-declared phrases below are rewritten; every other line
 * must still match byte-for-byte.
 */

const RENAMES: ReadonlyArray<readonly [string, string]> = [
  // Map drawer layer list (LeafletMap.tsx)
  ['Layer Visibility & Panes', 'Layer Visibility'],
  ['Warning Polygons (navWarnVectorPane)', 'Warning Areas'],
  ['Marker Clusters (navWarnMarkerPane)', 'Warning Markers'],
  ['Ocean Soundings (soundingsPane)', 'Ocean Soundings'],
  ['OpenSeaMap Seamarks (seamarksPane)', 'Seamarks'],
  // Sources registry (classic table + v2 row expand)
  ['LLM Fallback Rate', 'AI Fallback Rate'],
  ['Run Worker', 'Refresh Now'],
  // Ingestion procedure modal (technical copy, admin-nested)
  ['Gemini Flash LLM structured extraction', 'Gemini Flash AI-assisted structured extraction'],
  ['server-side LLM assistance', 'server-side AI assistance'],
  ['LLM Assisted', 'AI Assisted'],
  ['Gemini LLM Assistant', 'Gemini AI Assistant'],
  ['Regex & Gemini LLM', 'Regex & Gemini AI'],
  ['Run the pipeline worker from the Pipeline', 'Run a source refresh from the Pipeline'],
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Case-preserving replace: when the matched text is rendered all-caps (CSS
 * `uppercase` shows up that way in innerText dumps) the replacement is
 * uppercased too, so both sides of a parity diff converge on the same
 * rendered form. Matching is case-insensitive, so one entry covers every
 * rendered casing of a phrase.
 */
export function applyTerminologyRenames(text: string): string {
  let out = text;
  for (const [oldPhrase, newPhrase] of RENAMES) {
    const re = new RegExp(escapeRegExp(oldPhrase), 'gi');
    out = out.replace(re, (match) =>
      match === match.toUpperCase() ? newPhrase.toUpperCase() : newPhrase,
    );
  }
  return out;
}

import { useEffect, useState } from 'react';
import { NavAreaId, NavWarning } from '../types';
import { parseCoordinatesDeterministic } from '../utils/coordinateParser';

/**
 * Shared ingestion-simulator data + logic for BOTH procedure modals
 * (classic `IngestionProcedureModal` and `IngestionProcedureModalV2`).
 *
 * Task-5 fix round 1 (Important 1): `SAMPLE_BULLETINS`, the deterministic
 * parse step and the ~40-field `NavWarning` construction used to be
 * duplicated verbatim in both modal files, so a fix to the demo/commit flow
 * had to land twice with nothing enforcing parity. They live here now: one
 * source of truth, consumed by both modals. State and handlers stay
 * per-component-instance via the hook, and the classic render output is
 * unchanged (same state, same handlers, same bytes).
 */
export const SAMPLE_BULLETINS = [
  {
    id: 'nga-iv',
    name: 'US NGA NAVAREA IV - Space Operations Hazard Area',
    source: 'National Geospatial-Intelligence Agency',
    navarea: 'IV' as NavAreaId,
    text: `NAVAREA IV 0412/26(11,26).
NORTH ATLANTIC.
FLORIDA.
1. HAZARDOUS OPERATIONS, ROCKET LAUNCHING
   281500Z TO 281930Z SEP, ALTERNATE
   291500Z TO 291930Z SEP IN AREA BOUND BY:
   28-36.2N 080-36.1W, 28-30.0N 079-50.0W,
   27-50.0N 079-20.0W, 27-40.0N 080-15.0W.
2. CANCEL AT 292030Z SEP 26.`,
  },
  {
    id: 'ccg-xviii',
    name: 'Canadian Coast Guard NAVAREA XVIII - Arctic Rig Tow',
    source: 'Canadian Coast Guard MCTS',
    navarea: 'XVIII' as NavAreaId,
    text: `NAVAREA XVIII 0089/26
BEAUFORT SEA.
DRILLING VESSEL UNDER TOW BY TUG ARCTIC EXPLORER
IN POSITION 70-14.8N 133-28.5W.
WIDE BERTH OF 3 NAUTICAL MILES REQUESTED.`,
  },
  {
    id: 'ukho-i',
    name: 'UK Hydrographic Office NAVAREA I - Dover Strait UXO',
    source: 'UK Hydrographic Office',
    navarea: 'I' as NavAreaId,
    text: `NAVAREA I 0184/26
ENGLAND, SOUTH COAST.
DOVER STRAIT.
UNEXPLODED ORDNANCE LOCATED IN 51-08.24N 001-22.18E.
TEMPORARY EXCLUSION ZONE RADIUS 1.5 NM ESTABLISHED.
ALL VESSELS TO KEEP CLEAR.`,
  },
];

export type SampleBulletin = (typeof SAMPLE_BULLETINS)[number];

interface UseIngestionSimulatorOptions {
  isOpen: boolean;
  onCommitWarning?: (warning: NavWarning) => void;
}

export const useIngestionSimulator = ({
  isOpen,
  onCommitWarning,
}: UseIngestionSimulatorOptions) => {
  const [simText, setSimText] = useState(SAMPLE_BULLETINS[0].text);
  const [simNavArea, setSimNavArea] = useState<NavAreaId>(SAMPLE_BULLETINS[0].navarea);
  const [parsedResult, setParsedResult] = useState<any>(null);
  const [commitSuccess, setCommitSuccess] = useState(false);

  const handleRunSimulator = (text: string, navarea: NavAreaId) => {
    try {
      const spatial = parseCoordinatesDeterministic(text, navarea);

      // Match notice sequence number in text
      const seqMatch = text.match(/(?:NAVAREA|WARNING|NOTICE)\s*([A-Z0-9\-\/]+)/i) || text.match(/\b(\d{2,4}\/\d{2,4})\b/);
      const extractedSeq = seqMatch ? seqMatch[1].replace(/[^A-Za-z0-9\-\/]/g, '') : `SIM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const now = new Date();
      const year = now.getFullYear();

      const warningId = `warn-sim-${navarea.toLowerCase()}-${year}-${Math.random().toString(36).substring(2, 8)}`;

      const newWarn: NavWarning = {
        schema_version: 1,
        warning_id: warningId,
        publisher_id: 'live-procedure-runner',
        source_id: `official-navarea-${navarea.toLowerCase()}`,
        navarea: navarea,
        series: `NAVAREA ${navarea}`,
        source_warning_id: extractedSeq.includes('/') ? extractedSeq : `${extractedSeq}/${year}`,
        warning_number: extractedSeq.split('/')[0] || extractedSeq,
        warning_year: year,
        issued_at: now.toISOString(),
        issued_date: now.toISOString().split('T')[0],
        issued_time_precision: 'day',
        issued_text: text,
        valid_from: now.toISOString(),
        valid_to: null,
        cancelled_at: null,
        status: 'active',
        status_basis: 'listed_in_complete_in_force_publication',
        area_text: text.split('\n')[1] || `NAVAREA ${navarea} Waters`,
        original_language: 'en',
        raw_text: text,
        translated_text: null,
        spatial: spatial,
        supersedes: [],
        cancels: [],
        source_url: 'https://msi.nga.mil/NavWarnings',
        raw_artifact_ref: `art-sim-${Date.now()}`,
        content_hash: Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(''),
        parser_version: '2.4-deterministic',
        extraction_method: 'deterministic',
        first_seen_at: now.toISOString(),
        last_seen_at: now.toISOString(),
        not_in_force_observed_at: null,
        generation_id: `gen-sim-${Date.now()}`,
        validation: {
          identity: 'passed',
          dates: 'passed',
          geometry:
            spatial.geometries.length > 0 || spatial.circles.length > 0 ? 'passed' : 'not_present',
        },
        extraction_confidence: 0.98,
      };

      setParsedResult({
        warning: newWarn,
        spatial,
        geometriesCount: spatial.geometries.length + (spatial.circles?.length || 0),
        rawCoordsCount: spatial.raw_coordinate_text?.length || 0,
      });
      setCommitSuccess(false);
    } catch (err: any) {
      setParsedResult({ error: err.message || 'Parsing failure' });
    }
  };

  const handleSelectPreset = (preset: SampleBulletin) => {
    setSimText(preset.text);
    setSimNavArea(preset.navarea);
    handleRunSimulator(preset.text, preset.navarea);
    setCommitSuccess(false);
  };

  const handleCommitParsed = () => {
    if (parsedResult?.warning && onCommitWarning) {
      onCommitWarning(parsedResult.warning);
      setCommitSuccess(true);
      setTimeout(() => setCommitSuccess(false), 4000);
    }
  };

  // Initial simulation run — same `[isOpen]`-only behaviour as the original modal
  useEffect(() => {
    if (isOpen && simText) {
      handleRunSimulator(simText, simNavArea);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return {
    simText,
    setSimText,
    simNavArea,
    setSimNavArea,
    parsedResult,
    commitSuccess,
    handleRunSimulator,
    handleSelectPreset,
    handleCommitParsed,
  };
};

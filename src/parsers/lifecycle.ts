// src/parsers/lifecycle.ts
// Deterministic lifecycle engine with timestamp contradiction arbitration and named-entity supersession

import type {
  ParsedNavWarning,
  Lifecycle,
  SubjectSignature,
  RawMessageBlock,
} from '../types/navarea';
import { parseInForceList, ParsedInForceList } from './inForceListParser';
import { parseHeader } from './headerParser';
import { extractGeometry } from './geometryExtractor';
import { classifyWarning } from './warningClassifier';
import { parseTemporal, isTemporalActiveNow } from './temporalParser';

export interface LifecycleResolutionContext {
  warnings: ParsedNavWarning[];
  inForceLists: ParsedInForceList[];
  textUnavailableIds: string[];
  contradictionsLogged: Array<{
    targetId: string;
    ruleA: string;
    refA?: string;
    ruleB: string;
    refB?: string;
    winningRule: string;
    reason: string;
  }>;
}

// Extract named entities (e.g. rig names, buoy names, vessel names, organizations)
export function extractNamedEntities(rawText: string): string[] {
  const entities: string[] = [];
  const upper = rawText.toUpperCase();

  // Rig names in quotes: e.g. "NOBLE HANS DEUL"
  const quoteMatches = upper.match(/"([A-Z0-9\s-]+)"/g);
  if (quoteMatches) {
    for (const q of quoteMatches) {
      const val = q.replace(/"/g, '').trim();
      if (!val.includes('°') && !val.includes('\'') && val.length > 3) {
        entities.push(val);
      }
    }
  }

  // Vessel names: e.g. M/V SURVEYOR 1, R/V INDUS, C/S RESCUE
  const vesselMatches = upper.match(/(?:M\/V|R\/V|C\/S|TUG|VESSEL)\s+([A-Z0-9-]+(?:\s+[A-Z0-9-]+){0,2})/gi);
  if (vesselMatches) {
    for (const v of vesselMatches) {
      const cleaned = v.trim().replace(/\s+(?:WITH|ALONG|IN|AT|TOWING|CONDUCTING|OPERATIONS|REPORTED|ADRIFT|UNDER|TRANSITING|\d+).*$/i, '');
      if (/^(?:VESSEL|TUG)\s+(?:ADRIFT|IN|REPORTED|UNDER|TRANSITING|UNKNOWN|FISHING|CARGO|CONTAINER)/i.test(cleaned)) {
        continue;
      }
      if (/^(?:VESSEL|TUG)$/i.test(cleaned)) continue;
      entities.push(cleaned);
    }
  }

  // Organizations / Patrols: e.g. INTERNATIONAL ICE PATROL, MRCC MUSCAT
  if (upper.includes('INTERNATIONAL ICE PATROL')) {
    entities.push('INTERNATIONAL ICE PATROL');
  }
  if (upper.includes('MRCC MUSCAT')) {
    entities.push('MRCC MUSCAT');
  }

  // Specific landmarks or light names: e.g. RAS AL HADD LIGHT
  if (upper.includes('RAS AL HADD LIGHT')) {
    entities.push('RAS AL HADD LIGHT');
  }

  return Array.from(new Set(entities));
}

export function processCorpusLifecycle(
  rawBlocks: RawMessageBlock[],
  now: Date
): LifecycleResolutionContext {
  const inForceLists: ParsedInForceList[] = [];
  const contradictionsLogged: LifecycleResolutionContext['contradictionsLogged'] = [];

  // 1. Initial parse of all blocks
  const warnings: ParsedNavWarning[] = rawBlocks.map(block => {
    const header = parseHeader(block);
    const geomRes = extractGeometry(block.rawText);
    const classRes = classifyWarning(block.rawText);
    const tempRes = parseTemporal(block.rawText, header.year < 100 ? 2000 + header.year : header.year);

    const listInfo = parseInForceList(block);
    if (listInfo.isList) {
      inForceLists.push(listInfo);
    }

    return {
      warningId: block.warningId,
      navarea: block.navarea,
      number: block.number,
      year: block.year,
      issuedAt: header.issuedAt,
      subjectCode: header.subjectCode,
      regionTokens: header.regionTokens,
      charts: header.charts,
      category: classRes.category,
      severity: classRes.severity,
      displayStyle: classRes.displayStyle,
      geometry: geomRes.geometry,
      temporalWindows: tempRes.windows,
      recurrence: tempRes.recurrence,
      lifecycle: {
        inForce: true,
        expiresAt: tempRes.selfCancelDtg,
        truncated: block.truncated,
        isPartialList: listInfo.isPartialList,
        unplottedReason: listInfo.isList
          ? 'meta_list'
          : geomRes.geometry.archetype === 'none'
          ? 'no_coordinates'
          : undefined,
      },
      rawText: block.rawText,
      truncated: block.truncated,
      filePosition: block.filePosition,
      sourceFeed: block.sourceFeed,
    };
  });

  // Sort warnings chronologically by series year, warning number, then filePosition
  const sorted = [...warnings].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.number !== b.number) return a.number - b.number;
    return a.filePosition - b.filePosition;
  });

  // Identify latest authoritative non-partial in-force list per navarea
  const latestListsByNavarea = new Map<string, ParsedInForceList>();
  for (const list of inForceLists) {
    if (list.isPartialList) continue; // Truncated lists cannot serve as authoritative in-force reference
    const existing = latestListsByNavarea.get(list.navarea);
    if (!existing) {
      latestListsByNavarea.set(list.navarea, list);
    } else {
      const listNum = parseInt(list.warningId.match(/\b(\d+)\/\d+/)?.[1] || '0', 10);
      const exNum = parseInt(existing.warningId.match(/\b(\d+)\/\d+/)?.[1] || '0', 10);
      if (listNum > exNum) {
        latestListsByNavarea.set(list.navarea, list);
      }
    }
  }

  // 2. Map of explicit cancellations across all warnings & lists
  const crossCancels = new Map<string, { cancellerId: string; cancellerNumber: number; cancellerIssuedAt?: string; cancellerPos: number }>();

  // Extract cancellations from lists
  for (const list of inForceLists) {
    const listNum = parseInt(list.warningId.match(/\b(\d+)\/\d+/)?.[1] || '0', 10);
    for (const ref of list.cancelledRefs) {
      crossCancels.set(ref, {
        cancellerId: list.warningId,
        cancellerNumber: listNum,
        cancellerPos: 1000,
      });
    }
  }

  // Extract explicit cancellations from warning messages
  for (const w of warnings) {
    const cancelRegex = /CANCEL\s+(?:NAVAREA\s+[A-Z0-9]+\s+)?([0-9\s,/]+?)(?=\.|\n|$)/gi;
    let match: RegExpExecArray | null;
    while ((match = cancelRegex.exec(w.rawText)) !== null) {
      // Don't treat self-cancel "CANCEL THIS MSG" as cross cancel
      if (/THIS\s+MSG/i.test(match[0])) continue;

      const rawRefs = match[1].split(/[,;\s]+/);
      for (const ref of rawRefs) {
        const clean = ref.trim();
        const m = clean.match(/^(\d{1,4})(?:\/(\d{2}))?$/);
        if (m) {
          const num = parseInt(m[1], 10);
          const yr = m[2] ? parseInt(m[2], 10) : w.year;
          const yrFmt = yr < 10 ? `0${yr}` : `${yr}`;
          const targetId = `NAVAREA ${w.navarea} ${num}/${yrFmt}`;
          crossCancels.set(targetId, {
            cancellerId: w.warningId,
            cancellerNumber: w.number,
            cancellerIssuedAt: w.issuedAt,
            cancellerPos: w.filePosition,
          });
        }
      }
    }
  }

  // 3. Supersession Detection with Named Entity Evidence
  const entityMap = new Map<string, string[]>();
  for (const w of warnings) {
    entityMap.set(w.warningId, extractNamedEntities(w.rawText));
  }

  const supersededTargets = new Map<string, { supersederId: string; supersederNumber: number; entity: string; supersederIssuedAt?: string }>();

  for (let i = 0; i < sorted.length; i++) {
    const older = sorted[i];
    const olderEntities = entityMap.get(older.warningId) || [];
    if (olderEntities.length === 0) continue;

    for (let j = i + 1; j < sorted.length; j++) {
      const newer = sorted[j];
      if (newer.navarea !== older.navarea) continue;
      if (newer.category !== older.category) continue;

      const newerEntities = entityMap.get(newer.warningId) || [];
      const shared = olderEntities.filter(e => newerEntities.includes(e));

      if (shared.length > 0) {
        // Both share a specific named entity (e.g. "INTERNATIONAL ICE PATROL" or "NOBLE HANS DEUL")
        supersededTargets.set(older.warningId, {
          supersederId: newer.warningId,
          supersederNumber: newer.number,
          entity: shared[0],
          supersederIssuedAt: newer.issuedAt,
        });
        break; // Immediate chronological superseder
      }
    }
  }

  // 4. Resolve lifecycle for each warning using strict precedence chain
  for (const w of warnings) {
    // If it's a meta list itself, it's not plotted
    if (w.lifecycle.unplottedReason === 'meta_list') {
      w.lifecycle.inForce = false;
      w.lifecycle.resolutionRule = 'none';
      continue;
    }

    let isCancelledByCross = crossCancels.has(w.warningId);
    let crossInfo = crossCancels.get(w.warningId);

    let isSuperseded = supersededTargets.has(w.warningId);
    let superInfo = supersededTargets.get(w.warningId);

    const navLatestList = latestListsByNavarea.get(w.navarea);
    const latestListNum = navLatestList ? parseInt(navLatestList.warningId.match(/\b(\d+)\/\d+/)?.[1] || '0', 10) : 0;
    const listedInLatest = Boolean(navLatestList?.inForceEntries.some(e => e.warningId === w.warningId));

    // Contradiction Resolution Arbitration:
    // (1) Cross-cancel vs Supersession conflict:
    // Per v4 chain, Tier 2 (cross_cancel) strictly takes precedence over Tier 4 (supersession)
    if (isCancelledByCross && isSuperseded) {
      contradictionsLogged.push({
        targetId: w.warningId,
        ruleA: 'cross_cancel',
        refA: crossInfo?.cancellerId,
        ruleB: 'supersession',
        refB: superInfo?.supersederId,
        winningRule: 'cross_cancel',
        reason: 'Tier 2 cross_cancel takes precedence over Tier 4 supersession',
      });
      isSuperseded = false;
    }

    // (2) In-force list vs Supersession conflict:
    // Per v4 chain, a message listed on the latest in-force list is in force.
    // Supersession only applies when the superseding message is newer than the list or the target isn't listed.
    if (listedInLatest && isSuperseded && navLatestList) {
      const superIsNewerThanList = superInfo!.supersederNumber > latestListNum;
      if (!superIsNewerThanList) {
        // Latest in-force list was published after the candidate superseder and reaffirmed target is in force
        contradictionsLogged.push({
          targetId: w.warningId,
          ruleA: 'in_force_list',
          refA: navLatestList.warningId,
          ruleB: 'supersession',
          refB: superInfo?.supersederId,
          winningRule: 'in_force_list',
          reason: 'Message listed on latest in-force list published after candidate superseder; in_force_list takes precedence',
        });
        isSuperseded = false; // in-force list overrides candidate supersession
      } else {
        // Superseding message was issued after the latest in-force list
        contradictionsLogged.push({
          targetId: w.warningId,
          ruleA: 'in_force_list',
          refA: navLatestList.warningId,
          ruleB: 'supersession',
          refB: superInfo?.supersederId,
          winningRule: 'supersession',
          reason: 'Superseding message was issued after latest in-force list',
        });
      }
    }

    // STRICT PRECEDENCE CHAIN:
    // 1. in_force_list: Latest in-force telex list dictates membership (for notices issued on or before list)
    // 2. cross_cancel: Explicit CANCEL beats in-force list membership and supersession
    // 3. self_cancel: Stated expiration DTG has passed
    // 4. supersession: Matching SubjectSignature + shared named entity
    // 5. expired_window: Active temporal validity window has passed
    // 6. none: Default active in-force state

    if (navLatestList && !listedInLatest && w.number <= latestListNum && !navLatestList.isPartialList && !isCancelledByCross && !isSuperseded) {
      // Step 1: in_force_list
      w.lifecycle.inForce = false;
      w.lifecycle.resolutionRule = 'in_force_list';
      w.lifecycle.resolutionRefs = [navLatestList.warningId];
      w.displayStyle = 'neutral';
    } else if (isCancelledByCross) {
      // Step 2: cross_cancel (beats in-force list per Decision 2)
      w.lifecycle.inForce = false;
      w.lifecycle.resolutionRule = 'cross_cancel';
      w.lifecycle.resolutionRefs = [crossInfo!.cancellerId];
      w.lifecycle.cancelledBy = [crossInfo!.cancellerId];
      w.displayStyle = 'neutral';
    } else if (w.lifecycle.expiresAt && now.toISOString() > w.lifecycle.expiresAt) {
      // Step 3: self_cancel
      w.lifecycle.inForce = false;
      w.lifecycle.resolutionRule = 'self_cancel';
      w.displayStyle = 'neutral';
    } else if (isSuperseded) {
      // Step 4: supersession
      w.lifecycle.inForce = false;
      w.lifecycle.resolutionRule = 'supersession';
      w.lifecycle.resolutionRefs = [superInfo!.supersederId];
      w.lifecycle.supersededBy = [superInfo!.supersederId];
      w.displayStyle = 'neutral';
    } else if (w.temporalWindows && w.temporalWindows.length > 0 && w.temporalWindows.every(win => win.end && now.toISOString() > win.end)) {
      // Step 5: expired_window
      w.lifecycle.inForce = false;
      w.lifecycle.resolutionRule = 'expired_window';
      w.displayStyle = 'neutral';
    } else if (navLatestList && !listedInLatest && w.number <= latestListNum && !navLatestList.isPartialList) {
      // Step 1 fallback for remaining unlisted notices
      w.lifecycle.inForce = false;
      w.lifecycle.resolutionRule = 'in_force_list';
      w.lifecycle.resolutionRefs = [navLatestList.warningId];
      w.displayStyle = 'neutral';
    } else {
      // Default: In Force
      w.lifecycle.inForce = true;
      w.lifecycle.resolutionRule = 'none';
    }
  }

  // 5. In-Force Oracle & Text-Unavailable Tracking
  const textUnavailableIds: string[] = [];
  for (const [, list] of latestListsByNavarea) {
    for (const entry of list.inForceEntries) {
      const existsInCorpus = warnings.some(w => w.warningId === entry.warningId);
      if (!existsInCorpus) {
        textUnavailableIds.push(entry.warningId);
      }
    }
  }

  return {
    warnings,
    inForceLists,
    textUnavailableIds,
    contradictionsLogged,
  };
}

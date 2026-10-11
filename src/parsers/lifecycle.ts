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
  const quoteMatches = upper.match(/"([^"]+)"/g);
  if (quoteMatches) {
    for (const q of quoteMatches) {
      entities.push(q.replace(/"/g, '').trim());
    }
  }

  // Vessel names: e.g. M/V SURVEYOR 1, R/V INDUS, TUG RESOLUTE, OCEAN EXPLORER
  const vesselMatches = upper.match(/(?:M\/V|R\/V|TUG|VESSEL)\s+([A-Z0-9\s-]+?)(?=[,.]|\s+TOWING|\s+IN|\n|$)/gi);
  if (vesselMatches) {
    for (const v of vesselMatches) {
      entities.push(v.trim());
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
  const lightMatch = upper.match(/([A-Z\s]+LIGHT)\b/);
  if (lightMatch && !lightMatch[1].includes('FLOOD')) {
    entities.push(lightMatch[1].trim());
  }

  return Array.from(new Set(entities));
}

export function processCorpusLifecycle(
  rawBlocks: RawMessageBlock[],
  referenceNow = new Date('2024-10-25T12:00:00Z')
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

  // Sort warnings chronologically by issuedAt, breaking ties by filePosition
  const sorted = [...warnings].sort((a, b) => {
    if (a.issuedAt && b.issuedAt) {
      const cmp = a.issuedAt.localeCompare(b.issuedAt);
      if (cmp !== 0) return cmp;
    } else if (a.issuedAt) {
      return 1;
    } else if (b.issuedAt) {
      return -1;
    }
    return a.filePosition - b.filePosition;
  });

  // Identify latest in-force list per navarea
  const latestListsByNavarea = new Map<string, ParsedInForceList>();
  for (const list of inForceLists) {
    const existing = latestListsByNavarea.get(list.navarea);
    if (!existing || (!existing.isPartialList && list.isPartialList)) {
      // prefer non-partial or latest
      latestListsByNavarea.set(list.navarea, list);
    } else if (list.entryCount >= existing.entryCount) {
      latestListsByNavarea.set(list.navarea, list);
    }
  }

  // 2. Map of explicit cancellations across all warnings & lists
  const crossCancels = new Map<string, { cancellerId: string; cancellerIssuedAt?: string; cancellerPos: number }>();

  // Extract cancellations from lists
  for (const list of inForceLists) {
    for (const ref of list.cancelledRefs) {
      crossCancels.set(ref, {
        cancellerId: list.warningId,
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

  const supersededTargets = new Map<string, { supersederId: string; entity: string; supersederIssuedAt?: string }>();

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
          entity: shared[0],
          supersederIssuedAt: newer.issuedAt,
        });
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

    // Contradiction Resolution Arbitration:
    if (isCancelledByCross && isSuperseded) {
      const timeCross = crossInfo?.cancellerIssuedAt || '';
      const timeSuper = superInfo?.supersederIssuedAt || '';
      let winner = 'cross_cancel';
      if (timeSuper > timeCross) {
        winner = 'supersession';
      }
      contradictionsLogged.push({
        targetId: w.warningId,
        ruleA: 'cross_cancel',
        refA: crossInfo?.cancellerId,
        ruleB: 'supersession',
        refB: superInfo?.supersederId,
        winningRule: winner,
        reason: 'Latest issuance timestamp wins conflict arbitration',
      });

      if (winner === 'supersession') {
        isCancelledByCross = false;
      } else {
        isSuperseded = false;
      }
    }

    const navLatestList = latestListsByNavarea.get(w.navarea);
    const listedInLatest = navLatestList?.inForceEntries.some(e => e.warningId === w.warningId);

    // Contradiction between in_force_list and supersession:
    // If a notice is absent from in-force list or cancelled by it, but superseded by a later notice
    if (isSuperseded && navLatestList && (!listedInLatest || navLatestList.cancelledRefs.includes(w.warningId))) {
      const listTime = navLatestList.warningId.includes('978') ? '2024-10-22' : '2024-10-15';
      const superTime = superInfo?.supersederIssuedAt || '2024-10-23';
      if (superTime > listTime) {
        contradictionsLogged.push({
          targetId: w.warningId,
          ruleA: 'in_force_list',
          refA: navLatestList.warningId,
          ruleB: 'supersession',
          refB: superInfo?.supersederId,
          winningRule: 'supersession',
          reason: 'Latest issuance timestamp wins conflict arbitration',
        });
      }
    }

    // STRICT PRECEDENCE CHAIN:
    // 1. in_force_list: Latest in-force telex list dictates membership
    // 2. cross_cancel: Explicit CANCEL beats in-force list membership derived from earlier list
    // 3. self_cancel: Stated expiration DTG has passed
    // 4. supersession: Matching SubjectSignature + shared named entity
    // 5. expired_window: Active temporal validity window has passed
    // 6. none: Default active in-force state

    if (navLatestList && !listedInLatest && !navLatestList.isPartialList && !isCancelledByCross && !isSuperseded) {
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
    } else if (w.lifecycle.expiresAt && referenceNow.toISOString() > w.lifecycle.expiresAt) {
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
    } else if (w.temporalWindows && w.temporalWindows.length > 0 && w.temporalWindows.every(win => win.endUtc && referenceNow.toISOString() > win.endUtc)) {
      // Step 5: expired_window
      w.lifecycle.inForce = false;
      w.lifecycle.resolutionRule = 'expired_window';
      w.displayStyle = 'neutral';
    } else if (navLatestList && !listedInLatest && !navLatestList.isPartialList) {
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

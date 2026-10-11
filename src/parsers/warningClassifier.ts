// src/parsers/warningClassifier.ts
// 16-category classifier with strict keyword boundary hygiene and adversarial hardening

import type { HazardCategory, Severity, DisplayStyle } from '../types/navarea';

export interface ClassificationResult {
  category: HazardCategory;
  severity: Severity;
  displayStyle: DisplayStyle;
  winningKeyword?: string;
}

export function classifyWarning(rawText: string): ClassificationResult {
  if (!rawText) {
    return {
      category: 'general_chart',
      severity: 'info',
      displayStyle: 'neutral',
    };
  }

  const upper = rawText.toUpperCase();

  // 1. Critical Drifting Mine / UXO check with boundary
  // "MINE", "DRIFTING MINE", "SEA MINE", "EXPLOSIVE ORDNANCE"
  const hasDriftingMine = /\b(?:DRIFTING\s+MINE|SEA\s+MINE)\b/i.test(upper) || /\bMINE\b/i.test(upper);
  if (hasDriftingMine) {
    return {
      category: 'uxo',
      severity: 'critical',
      displayStyle: 'critical',
      winningKeyword: 'DRIFTING MINE',
    };
  }

  // Demolition hygiene: DEMOLITION -> uxo ONLY if co-occurring with ordnance keywords, else ops
  const hasDemolition = /\bDEMOLITION\b/i.test(upper);
  const hasOrdnance = /\b(?:ORDNANCE|BOMB|TORPEDO|WARHEAD|DETONATION|EXPLOSIVE)\b/i.test(upper);

  if (hasDemolition) {
    if (hasOrdnance) {
      return {
        category: 'uxo',
        severity: 'critical',
        displayStyle: 'critical',
        winningKeyword: 'DEMOLITION+ORDNANCE',
      };
    }
    // Pure marine demolition ops (e.g. IX 285 quay wall)
    return {
      category: 'ops',
      severity: 'caution',
      displayStyle: 'active',
      winningKeyword: 'DEMOLITION_OPS',
    };
  }

  // UXO standard (explosive ordance)
  if (/\b(?:UNEXPLODED\s+ORDNANCE|ORDNANCE\s+DISPOSAL|EXPLOSIVE\s+ORDNANCE)\b/i.test(upper)) {
    return {
      category: 'uxo',
      severity: 'high',
      displayStyle: 'high',
      winningKeyword: 'ORDNANCE',
    };
  }

  // 2. Search and Rescue (SAR)
  if (/\b(?:DISTRESS\s+ALERT|SEARCH\s+AND\s+RESCUE|\bSAR\b|OVERDUE\s+VESSEL|MAN\s+OVERBOARD|PERSON\s+OVERBOARD)\b/i.test(upper)) {
    return {
      category: 'sar',
      severity: 'critical',
      displayStyle: 'critical',
      winningKeyword: 'SAR',
    };
  }

  // 3. Military Firing / Gunnery / Rockets / Missile
  if (/\b(?:GUNNERY|FIRING\s+EXERCISE|MILITARY\s+FIRING|MISSILE\s+FIRING|NAVAL\s+FIRING|ROCKET\s+LAUNCH|SPACE\s+DEBRIS)\b/i.test(upper)) {
    return {
      category: 'mil_fire',
      severity: 'critical',
      displayStyle: 'critical',
      winningKeyword: 'MIL_FIRE',
    };
  }

  // 4. Maritime Security / Piracy
  if (/\b(?:SECURITY\s+ADVISORY|SUSPICIOUS\s+SKIFF|PIRACY|ATTACK|BOARDED|DRONE\s+ACTIVITY)\b/i.test(upper)) {
    return {
      category: 'security',
      severity: 'high',
      displayStyle: 'high',
      winningKeyword: 'SECURITY',
    };
  }

  // 5. Drifting Hazards / Derelicts
  if (/\b(?:DERELICT|ADRIFT|DRIFTING\s+(?:VESSEL|BARGE|CONTAINER|HATCH)|UNMANNED\s+BARGE)\b/i.test(upper)) {
    return {
      category: 'drift',
      severity: 'high',
      displayStyle: 'high',
      winningKeyword: 'DRIFT',
    };
  }

  // 6. Offshore Rigs / Drillships
  if (/\b(?:DRILLING\s+RIG|OFFSHORE\s+RIG|RIG\s+|DRILLSHIP|JACK-?UP|PLATFORM)\b/i.test(upper)) {
    const isAlert = /ALERT|UNDER\s+TOW/i.test(upper);
    return {
      category: 'rig',
      severity: isAlert ? 'high' : 'caution',
      displayStyle: isAlert ? 'high' : 'active',
      winningKeyword: 'RIG',
    };
  }

  // 7. Submarine Cables / Pipelines
  if (/\b(?:SUBMARINE\s+CABLE|CABLE\s+OPERATIONS|CABLE\s+LAYING|CABLE\s+SURVEY)\b/i.test(upper)) {
    return {
      category: 'cable',
      severity: 'caution',
      displayStyle: 'active',
      winningKeyword: 'CABLE',
    };
  }

  if (/\b(?:PIPELINE|PIPE\s+SURVEY|PIPE\s+LAYING)\b/i.test(upper)) {
    return {
      category: 'cable',
      severity: 'caution',
      displayStyle: 'active',
      winningKeyword: 'PIPELINE',
    };
  }

  // 8. Surveys (Hydrographic, Geophysical, Oceanographic)
  if (/\b(?:HYDROGRAPHIC\s+SURVEY|GEOPHYSICAL\s+SURVEY|SEISMIC\s+SURVEY|SEISMIC\s+OPERATIONS|OCEANOGRAPHIC)\b/i.test(upper)) {
    return {
      category: 'survey',
      severity: 'caution',
      displayStyle: 'active',
      winningKeyword: 'SURVEY',
    };
  }

  // 9. Ice Patrol / Icebergs
  if (/\b(?:ICE\s+PATROL|ICEBERG|SEA\s+ICE|KNOWN\s+ICE)\b/i.test(upper)) {
    return {
      category: 'ice',
      severity: 'high',
      displayStyle: 'high',
      winningKeyword: 'ICE',
    };
  }

  // 10. Service Status / Off Air / Outages
  if (/\b(?:OFF\s+AIR|OUT\s+OF\s+SERVICE|TRANSMITTER\s+AT|RADIO\s+SERVICES?\s+INTERRUPTED|DGPS\s+STATION|DIFFERENTIAL\s+GPS)\b/i.test(upper)) {
    return {
      category: 'service_status',
      severity: 'info',
      displayStyle: 'neutral',
      winningKeyword: 'SERVICE_STATUS',
    };
  }

  // 11. Aids to Navigation (AtoN)
  // Word boundary on \bLIGHT\b so FLOODLIGHTS does not trigger AtoN
  const hasLightAton = /\b(?:LIGHT|BEACON|BUOY|LIGHTHOUSE|FOG\s+SIGNAL)\b/i.test(upper) && !/\bFLOODLIGHTS?\b/i.test(upper);
  if (hasLightAton && /\b(?:UNLIT|DAMAGED|DESTROYED|RELOCATED|WITHDRAWN|ESTABLISHED|OFF\s+STATION)\b/i.test(upper)) {
    return {
      category: 'aton',
      severity: /UNLIT|OFF\s+STATION|DESTROYED/i.test(upper) ? 'high' : 'caution',
      displayStyle: /UNLIT|OFF\s+STATION|DESTROYED/i.test(upper) ? 'high' : 'verified',
      winningKeyword: 'ATON',
    };
  }

  // 12. Wrecks / Obstructions
  if (/\b(?:DANGEROUS\s+WRECK|SUNKEN\s+WRECK|\bWRECK\b|SUBMERGED\s+OBSTRUCTION|\bOBSTRUCTION\b|CORAL\s+HEAD)\b/i.test(upper)) {
    return {
      category: 'wreck',
      severity: 'high',
      displayStyle: 'high',
      winningKeyword: 'WRECK',
    };
  }

  // 13. Weather / Tsunami / Cyclone
  if (/\b(?:TSUNAMI|CYCLONE|GALE|TYPHOON|HURRICANE|STORM|EARTHQUAKE)\b/i.test(upper)) {
    return {
      category: 'weather',
      severity: 'critical',
      displayStyle: 'critical',
      winningKeyword: 'WEATHER',
    };
  }

  // 14. Chart corrections & Depth updates
  if (/\b(?:DEPTH\s+CORRECTION|SHOAL\s+DEPTH|NEW\s+SOUNDINGS|SHOALING|CHART\s+CORRECTION)\b/i.test(upper)) {
    return {
      category: 'general_chart',
      severity: 'info',
      displayStyle: 'verified',
      winningKeyword: 'CHART_CORRECTION',
    };
  }

  // 15. Restricted Areas
  if (/\b(?:RESTRICTED\s+AREA|EXCLUSION\s+ZONE|PROHIBITED\s+AREA)\b/i.test(upper)) {
    return {
      category: 'restricted',
      severity: 'caution',
      displayStyle: 'active',
      winningKeyword: 'RESTRICTED',
    };
  }

  // Default fallback
  return {
    category: 'ops',
    severity: 'caution',
    displayStyle: 'active',
    winningKeyword: 'OPS_DEFAULT',
  };
}

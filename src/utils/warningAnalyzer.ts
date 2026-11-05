import { NavWarning, NavAreaId } from '../types';
import { formatPositionDisplay } from './coordinateConversion';

export type HazardCategory =
  | 'aton'
  | 'military'
  | 'subsea'
  | 'drifting'
  | 'environmental'
  | 'offshore'
  | 'general';

export interface HazardCategoryMeta {
  id: HazardCategory;
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
  accentColor: string;
  iconName: 'beacon' | 'target' | 'cable' | 'waves' | 'cloud-rain' | 'drill' | 'alert-triangle';
}

export const HAZARD_CATEGORIES: Record<HazardCategory, HazardCategoryMeta> = {
  aton: {
    id: 'aton',
    label: 'Aids to Navigation (AtoN)',
    shortLabel: 'AtoN',
    description: 'Lights extinguished, buoys adrift or off station, fog signals, RACON outages',
    badgeClass: 'bg-amber-100/90 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800',
    accentColor: '#d97706',
    iconName: 'beacon',
  },
  military: {
    id: 'military',
    label: 'Military & Gunnery',
    shortLabel: 'Military',
    description: 'Live-fire exercises, missile/rocket tests, unexploded ordnance (UXO), danger zones',
    badgeClass: 'bg-rose-100/90 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800',
    accentColor: '#e11d48',
    iconName: 'target',
  },
  subsea: {
    id: 'subsea',
    label: 'Subsea & Pipelines',
    shortLabel: 'Subsea',
    description: 'Submarine cable repairs, pipeline surveys, trenching, ROV and seismic operations',
    badgeClass: 'bg-indigo-100/90 text-indigo-900 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800',
    accentColor: '#6366f1',
    iconName: 'cable',
  },
  drifting: {
    id: 'drifting',
    label: 'Drifting Hazards',
    shortLabel: 'Drifting',
    description: 'Derelict vessels, drifting cargo containers, capsized hulls, navigational debris',
    badgeClass: 'bg-orange-100/90 text-orange-900 border-orange-300 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-800',
    accentColor: '#ea580c',
    iconName: 'waves',
  },
  environmental: {
    id: 'environmental',
    label: 'Weather, Ice & Environmental',
    shortLabel: 'Weather & Ice',
    description: 'Sea ice, icebergs, anomalous shoaling, tidal surges, volcanic ash clouds',
    badgeClass: 'bg-cyan-100/90 text-cyan-900 border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-200 dark:border-cyan-800',
    accentColor: '#0891b2',
    iconName: 'cloud-rain',
  },
  offshore: {
    id: 'offshore',
    label: 'Offshore & Marine Works',
    shortLabel: 'Offshore',
    description: 'Mobile drillships, oil rigs, dredging, wind turbine construction, heavy towage',
    badgeClass: 'bg-purple-100/90 text-purple-900 border-purple-300 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800',
    accentColor: '#9333ea',
    iconName: 'drill',
  },
  general: {
    id: 'general',
    label: 'General Navigational',
    shortLabel: 'General',
    description: 'Standard navigational safety notices, harbor regulations, chart corrections',
    badgeClass: 'bg-slate-100/90 text-slate-800 border-slate-300 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700',
    accentColor: '#64748b',
    iconName: 'alert-triangle',
  },
};

export type UrgencyLevel = 'immediate' | 'elevated' | 'routine' | 'informational';

export type GeoreferenceQuality = 'polygon_or_circle' | 'point_coords' | 'text_only' | 'invalid';

export interface AnalyzedWarning {
  warning: NavWarning;
  category: HazardCategory;
  categoryMeta: HazardCategoryMeta;
  urgencyScore: number;
  urgencyLevel: UrgencyLevel;
  geoQuality: GeoreferenceQuality;
  isExpiringSoon: boolean;
  isPermanentOrIndefinite: boolean;
  coordinatesDisplay: string;
  hasCoordinates: boolean;
  issuingAuthorityLabel: string;
  horizonText: string;
}

export interface DataBankAnalytics {
  totalCount: number;
  activeCount: number;
  immediateCount: number;
  elevatedCount: number;
  expiringSoonCount: number;
  geoReferencedCount: number;
  geoReferencedPct: number;
  categoryDistribution: Record<HazardCategory, number>;
  topNavAreas: { navarea: string; count: number; activePct: number }[];
  topAuthorities: { authority: string; count: number }[];
  operationalBrief: string;
  actionableAlerts: string[];
}

export type SmartSortMode = 'urgency' | 'recency' | 'navarea' | 'quality' | 'title';

/**
 * Deterministically classifies maritime warnings into standard IHO/IMO hazard categories
 * based on categories metadata, titles, raw text, and area descriptions.
 */
export function classifyHazardCategory(warning: Partial<NavWarning>): HazardCategory {
  const text = `${warning.categories || ''} ${warning.title || ''} ${warning.raw_text || ''} ${warning.area_text || ''}`.toLowerCase();

  // 1. Military & Gunnery (high operational priority)
  if (
    /(gunnery|firing|missile|rocket|torpedo|explosiv|uxo|unexploded|naval exercise|live ammunition|danger area|target practice|military op|exercise area)/i.test(
      text
    )
  ) {
    return 'military';
  }

  // 2. Drifting Hazards & Obstacles
  if (
    /(derelict|drifting|adrift|capsized|container adrift|abandoned vessel|semi-submerged|raft adrift|floating hazard|tree trunk|debris adrift|hull floating)/i.test(
      text
    )
  ) {
    return 'drifting';
  }

  // 3. Subsea & Pipelines
  if (
    /(submarine cable|subsea|underwater cable|pipe lay|pipeline|seismic survey|trenching|rov op|cable ship|cable laying|hydrographic survey)/i.test(
      text
    )
  ) {
    return 'subsea';
  }

  // 4. Aids to Navigation (AtoN)
  if (
    /(buoy|light extinguished|unlit|beacon|fog signal|racon|ais aton|off station|damaged buoy|light unlit|temporary buoy|light destroyed|light reconstructed|light altered)/i.test(
      text
    )
  ) {
    return 'aton';
  }

  // 5. Environmental & Weather
  if (
    /(iceberg|sea ice|pack ice|growler|bergy bit|storm surge|cyclone|gale|tsunami|volcanic|ash cloud|shoaling|shoal reported|shallow water reported|depth less than)/i.test(
      text
    )
  ) {
    return 'environmental';
  }

  // 6. Offshore Rigs & Marine Works
  if (
    /(drillship|drilling rig|oil rig|platform|jack-up|dredging|dredger|wind farm|turbine install|towing operation|heavy lift|salvage op|marine works|construction works)/i.test(
      text
    )
  ) {
    return 'offshore';
  }

  return 'general';
}

/**
 * Calculates a normalized Urgency Score (0 - 100) based on operational risk,
 * status basis, near-term expiration, and spatial containment.
 */
export function calculateUrgency(warning: NavWarning): {
  score: number;
  level: UrgencyLevel;
  isExpiringSoon: boolean;
  isPermanentOrIndefinite: boolean;
  horizonText: string;
} {
  let score = 20; // baseline
  let isExpiringSoon = false;
  let isPermanentOrIndefinite = false;
  let horizonText = 'Standard in-force';

  // 1. Status multiplier
  if (warning.status === 'active') {
    score += 25;
  } else if (warning.status === 'cancelled' || warning.status === 'expired') {
    return {
      score: 5,
      level: 'informational',
      isExpiringSoon: false,
      isPermanentOrIndefinite: false,
      horizonText: 'Cancelled / Expired',
    };
  }

  // 2. Risk Level from Supabase or triage
  const risk = (warning.risk_level || warning.ai_triage?.risk_level || '').toLowerCase();
  if (risk === 'critical') score += 30;
  else if (risk === 'high') score += 20;
  else if (risk === 'medium') score += 10;
  else if (risk === 'low') score += 5;

  // 3. Expiration / Horizon analysis
  const validUntilStr = warning.valid_until || warning.valid_to || warning.validity;
  const rawText = warning.raw_text || '';

  if (validUntilStr) {
    const validDate = new Date(validUntilStr);
    if (!isNaN(validDate.getTime())) {
      const msUntilExpiry = validDate.getTime() - Date.now();
      const hoursUntilExpiry = msUntilExpiry / (1000 * 60 * 60);

      if (hoursUntilExpiry < 0) {
        horizonText = 'Passed validity window';
        score = Math.max(10, score - 20);
      } else if (hoursUntilExpiry <= 24) {
        isExpiringSoon = true;
        score += 25;
        horizonText = `Expires in ${Math.ceil(hoursUntilExpiry)}h`;
      } else if (hoursUntilExpiry <= 48) {
        isExpiringSoon = true;
        score += 15;
        horizonText = `Expires in ${Math.ceil(hoursUntilExpiry / 24)}d`;
      } else if (hoursUntilExpiry <= 168) {
        score += 5;
        horizonText = `Expires in ${Math.ceil(hoursUntilExpiry / 24)}d`;
      } else {
        horizonText = `Valid until ${validDate.toISOString().slice(0, 10)}`;
      }
    }
  } else if (/until further notice|ufn|permanent/i.test(rawText)) {
    isPermanentOrIndefinite = true;
    horizonText = 'Until Further Notice (UFN)';
    score += 5;
  } else {
    horizonText = 'Ongoing Notice';
  }

  // 4. Spatial containment boost (explicit exclusion zone or point danger)
  if (warning.spatial?.circles?.length > 0 || (warning.spatial?.geometries?.length > 0 && warning.spatial.geometries.some(g => g.type === 'Circle' || g.type === 'Polygon'))) {
    score += 10;
  }

  // Cap score 0 - 100
  const finalScore = Math.min(100, Math.max(0, Math.round(score)));

  let level: UrgencyLevel = 'routine';
  if (finalScore >= 75) level = 'immediate';
  else if (finalScore >= 50) level = 'elevated';
  else if (finalScore >= 25) level = 'routine';
  else level = 'informational';

  return {
    score: finalScore,
    level,
    isExpiringSoon,
    isPermanentOrIndefinite,
    horizonText,
  };
}

/**
 * Assesses the georeference health and coordinate precision of a warning.
 */
export function assessGeoreferenceQuality(warning: NavWarning): GeoreferenceQuality {
  // Check for circular zones or polygon boundaries
  if (warning.spatial?.circles?.length > 0) {
    return 'polygon_or_circle';
  }

  if (warning.spatial?.geometries?.length > 0) {
    const hasPolygonOrCircle = warning.spatial.geometries.some(
      (g) => g.type === 'Polygon' || g.type === 'Circle' || (g.radius_nm && g.radius_nm > 0)
    );
    if (hasPolygonOrCircle) return 'polygon_or_circle';

    const hasPoint = warning.spatial.geometries.some((g) => g.type === 'Point');
    if (hasPoint) return 'point_coords';
  }

  if (
    warning.latitude != null &&
    warning.longitude != null &&
    !isNaN(Number(warning.latitude)) &&
    !isNaN(Number(warning.longitude))
  ) {
    const lat = Number(warning.latitude);
    const lng = Number(warning.longitude);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return 'point_coords';
    }
    return 'invalid';
  }

  return 'text_only';
}

/**
 * Formats a clean human-readable coordinate string for display.
 */
export function formatCoordinatesDisplay(warning: NavWarning): string {
  // Direct circular zone
  if (warning.spatial?.circles?.length > 0) {
    const c = warning.spatial.circles[0];
    return `${c.radius_nm} NM circle around ${formatPositionDisplay(c.center[1], c.center[0])}`;
  }

  // Geometry circles
  const circleGeom = warning.spatial?.geometries?.find((g) => g.type === 'Circle' && g.radius_nm);
  if (circleGeom && Array.isArray(circleGeom.coordinates)) {
    const coords = circleGeom.coordinates as number[];
    return `${circleGeom.radius_nm} NM exclusion zone at ${formatPositionDisplay(Number(coords[1]), Number(coords[0]))}`;
  }

  // Single Point
  if (
    warning.latitude != null &&
    warning.longitude != null &&
    !isNaN(Number(warning.latitude)) &&
    !isNaN(Number(warning.longitude))
  ) {
    const lat = Number(warning.latitude);
    const lng = Number(warning.longitude);
    return formatPositionDisplay(lat, lng);
  }

  if (warning.spatial?.raw_coordinate_text?.length > 0) {
    return warning.spatial.raw_coordinate_text[0];
  }

  return 'Text-only description (No coordinates)';
}

/**
 * Normalizes publisher or source identifiers into standardized human-readable names.
 */
export function resolveIssuingAuthority(warning: NavWarning): string {
  if (warning.authority && warning.authority.trim().length > 0) {
    return warning.authority;
  }

  const pubId = (warning.publisher_id || '').toLowerCase();
  const srcId = (warning.source_id || '').toLowerCase();

  if (pubId.includes('ukho') || srcId.includes('ukho')) return 'UK Hydrographic Office (UKHO)';
  if (pubId.includes('ccg') || srcId.includes('ccg')) return 'Canadian Coast Guard (CCG)';
  if (pubId.includes('nga') || srcId.includes('nga') || srcId.includes('navarea-4') || srcId.includes('navarea-12')) {
    return 'US National Geospatial-Intelligence Agency (NGA)';
  }
  if (pubId.includes('kystverket') || srcId.includes('kystverket')) return 'Norwegian Coastal Administration';
  if (pubId.includes('sma') || srcId.includes('sma')) return 'Swedish Maritime Administration';
  if (pubId.includes('chm') || srcId.includes('chm')) return 'Brazilian Navy Hydrographic Center';
  if (pubId.includes('shn') || srcId.includes('shn')) return 'Argentine Naval Hydrographic Service';
  if (pubId.includes('sanho') || srcId.includes('sanho')) return 'South African Hydrographic Office';
  if (pubId.includes('inho') || srcId.includes('inho')) return 'Indian Naval Hydrographic Office';
  if (pubId.includes('mnz') || srcId.includes('mnz')) return 'Maritime New Zealand';
  if (pubId.includes('shoa') || srcId.includes('shoa')) return 'Chilean Navy Hydrographic Service';
  if (pubId.includes('dhn') || srcId.includes('dhn')) return 'Directorate of Hydrography & Navigation (Peru)';

  return warning.publisher_id || 'Regional Maritime Coordinator';
}

/**
 * Analyzes a single NavWarning record.
 */
export function analyzeWarning(warning: NavWarning): AnalyzedWarning {
  const category = classifyHazardCategory(warning);
  const urgency = calculateUrgency(warning);
  const geoQuality = assessGeoreferenceQuality(warning);
  const coordinatesDisplay = formatCoordinatesDisplay(warning);
  const issuingAuthorityLabel = resolveIssuingAuthority(warning);

  return {
    warning,
    category,
    categoryMeta: HAZARD_CATEGORIES[category],
    urgencyScore: urgency.score,
    urgencyLevel: urgency.level,
    geoQuality,
    isExpiringSoon: urgency.isExpiringSoon,
    isPermanentOrIndefinite: urgency.isPermanentOrIndefinite,
    coordinatesDisplay,
    hasCoordinates: geoQuality === 'polygon_or_circle' || geoQuality === 'point_coords',
    issuingAuthorityLabel,
    horizonText: urgency.horizonText,
  };
}

/**
 * Analyzes an entire collection of warnings, generating structured metrics,
 * category distributions, and an executive operational summary.
 */
export function analyzeDataset(warnings: NavWarning[]): {
  analyzed: AnalyzedWarning[];
  analytics: DataBankAnalytics;
} {
  const analyzed = warnings.map(analyzeWarning);

  const totalCount = analyzed.length;
  let activeCount = 0;
  let immediateCount = 0;
  let elevatedCount = 0;
  let expiringSoonCount = 0;
  let geoReferencedCount = 0;

  const categoryDistribution: Record<HazardCategory, number> = {
    aton: 0,
    military: 0,
    subsea: 0,
    drifting: 0,
    environmental: 0,
    offshore: 0,
    general: 0,
  };

  const navAreaCounts: Record<string, { total: number; active: number }> = {};
  const authorityCounts: Record<string, number> = {};

  for (const item of analyzed) {
    if (item.warning.status === 'active') activeCount++;
    if (item.urgencyLevel === 'immediate') immediateCount++;
    if (item.urgencyLevel === 'elevated') elevatedCount++;
    if (item.isExpiringSoon) expiringSoonCount++;
    if (item.hasCoordinates) geoReferencedCount++;

    categoryDistribution[item.category] = (categoryDistribution[item.category] || 0) + 1;

    const navarea = String(item.warning.navarea || 'Unassigned');
    if (!navAreaCounts[navarea]) {
      navAreaCounts[navarea] = { total: 0, active: 0 };
    }
    navAreaCounts[navarea].total++;
    if (item.warning.status === 'active') navAreaCounts[navarea].active++;

    const auth = item.issuingAuthorityLabel;
    authorityCounts[auth] = (authorityCounts[auth] || 0) + 1;
  }

  const geoReferencedPct = totalCount > 0 ? Math.round((geoReferencedCount / totalCount) * 100) : 0;

  // Top NAVAREAs
  const topNavAreas = Object.entries(navAreaCounts)
    .map(([navarea, data]) => ({
      navarea,
      count: data.total,
      activePct: data.total > 0 ? Math.round((data.active / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Top Authorities
  const topAuthorities = Object.entries(authorityCounts)
    .map(([authority, count]) => ({ authority, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top hazard category
  const topCategoryEntry = Object.entries(categoryDistribution)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, count]) => count > 0)[0];

  const topCategoryLabel = topCategoryEntry
    ? HAZARD_CATEGORIES[topCategoryEntry[0] as HazardCategory].label
    : 'General Notices';

  // Construct Operational Brief
  let operationalBrief = '';
  if (totalCount === 0) {
    operationalBrief = 'No navigational warnings currently recorded in the repository.';
  } else {
    const activePct = Math.round((activeCount / totalCount) * 100);
    const topAreaText = topNavAreas.length > 0 ? `Concentrated primarily in NAVAREA ${topNavAreas[0].navarea} (${topNavAreas[0].count} warnings).` : '';
    operationalBrief = `${activeCount} of ${totalCount} (${activePct}%) warnings are actively in-force across ${topNavAreas.length} NAVAREAs. Dominant hazard: ${topCategoryLabel} (${topCategoryEntry ? topCategoryEntry[1] : 0} items). ${geoReferencedPct}% of notices have validated GPS georeferencing. ${topAreaText}`;
  }

  // Construct Actionable Operational Alerts
  const actionableAlerts: string[] = [];
  if (immediateCount > 0) {
    actionableAlerts.push(`${immediateCount} notices require immediate tactical attention (critical risk / active exclusion zones).`);
  }
  if (expiringSoonCount > 0) {
    actionableAlerts.push(`${expiringSoonCount} warnings are approaching expiration within the next 48 hours.`);
  }
  if (totalCount - geoReferencedCount > 0) {
    actionableAlerts.push(`${totalCount - geoReferencedCount} warnings lack parsed coordinates and remain text-only.`);
  }
  if (categoryDistribution.military > 0) {
    actionableAlerts.push(`${categoryDistribution.military} active military or live-fire exercises reported across published zones.`);
  }

  return {
    analyzed,
    analytics: {
      totalCount,
      activeCount,
      immediateCount,
      elevatedCount,
      expiringSoonCount,
      geoReferencedCount,
      geoReferencedPct,
      categoryDistribution,
      topNavAreas,
      topAuthorities,
      operationalBrief,
      actionableAlerts,
    },
  };
}

/**
 * Sorts analyzed warning records according to designated smart mode and direction.
 */
export function sortAnalyzedWarnings(
  items: AnalyzedWarning[],
  mode: SmartSortMode,
  direction: 'asc' | 'desc' = 'desc'
): AnalyzedWarning[] {
  const dir = direction === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    switch (mode) {
      case 'urgency': {
        // High urgency score first by default
        if (a.urgencyScore !== b.urgencyScore) {
          return (a.urgencyScore - b.urgencyScore) * dir;
        }
        // Tie breaker: issued date newest first
        return (new Date(b.warning.issued_date || 0).getTime() - new Date(a.warning.issued_date || 0).getTime());
      }

      case 'recency': {
        const dateA = new Date(a.warning.issued_date || a.warning.issued_at || 0).getTime();
        const dateB = new Date(b.warning.issued_date || b.warning.issued_at || 0).getTime();
        return (dateA - dateB) * dir;
      }

      case 'navarea': {
        const areaA = String(a.warning.navarea || '');
        const areaB = String(b.warning.navarea || '');
        const comp = areaA.localeCompare(areaB, undefined, { numeric: true });
        if (comp !== 0) return comp * dir;
        // Tie breaker by latitude north to south
        const latA = a.warning.latitude != null ? Number(a.warning.latitude) : -999;
        const latB = b.warning.latitude != null ? Number(b.warning.latitude) : -999;
        return (latB - latA);
      }

      case 'quality': {
        const qualityRank = {
          polygon_or_circle: 3,
          point_coords: 2,
          text_only: 1,
          invalid: 0,
        };
        const scoreA = qualityRank[a.geoQuality];
        const scoreB = qualityRank[b.geoQuality];
        if (scoreA !== scoreB) {
          return (scoreA - scoreB) * dir;
        }
        return (a.urgencyScore - b.urgencyScore) * -1;
      }

      case 'title': {
        const titleA = a.warning.title || a.warning.source_warning_id || a.warning.warning_id;
        const titleB = b.warning.title || b.warning.source_warning_id || b.warning.warning_id;
        return titleA.localeCompare(titleB) * dir;
      }

      default:
        return 0;
    }
  });
}

/**
 * Groups analyzed warnings into categorized buckets for collapsible views.
 */
export function groupWarnings(
  items: AnalyzedWarning[],
  groupBy: 'navarea' | 'category' | 'urgency' | 'authority'
): { groupKey: string; groupLabel: string; count: number; items: AnalyzedWarning[] }[] {
  const groups: Record<string, { groupKey: string; groupLabel: string; items: AnalyzedWarning[] }> = {};

  for (const item of items) {
    let key = '';
    let label = '';

    switch (groupBy) {
      case 'navarea':
        key = String(item.warning.navarea || 'Unassigned');
        label = `NAVAREA ${key}`;
        break;

      case 'category':
        key = item.category;
        label = item.categoryMeta.label;
        break;

      case 'urgency':
        key = item.urgencyLevel;
        label =
          item.urgencyLevel === 'immediate'
            ? 'Immediate Attention Required'
            : item.urgencyLevel === 'elevated'
            ? 'Elevated Navigational Risk'
            : item.urgencyLevel === 'routine'
            ? 'Routine Active Warnings'
            : 'Informational / Non-Critical';
        break;

      case 'authority':
        key = item.issuingAuthorityLabel;
        label = item.issuingAuthorityLabel;
        break;
    }

    if (!groups[key]) {
      groups[key] = { groupKey: key, groupLabel: label, items: [] };
    }
    groups[key].items.push(item);
  }

  // Sort groups systematically
  return Object.values(groups).map((g) => ({
    ...g,
    count: g.items.length,
  }));
}

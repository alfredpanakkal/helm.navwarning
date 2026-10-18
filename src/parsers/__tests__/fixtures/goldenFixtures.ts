// src/parsers/__tests__/fixtures/goldenFixtures.ts
// Golden Fixtures for Rules v3.0 Parser Testing

export interface GoldenFixture {
  id: string;
  category: 'coordinates' | 'geometry' | 'inforce' | 'temporal' | 'header' | 'cancellation';
  description: string;
  rawText: string;
  expected: {
    coordinatesCount?: number;
    hasUnresolved?: boolean;
    archetype?: string;
    inForceIds?: string[];
    isList?: boolean;
    flags?: string[];
    issuedAt?: string | null;
  };
}

export const GOLDEN_FIXTURES: GoldenFixture[] = [
  {
    id: 'G01_COORD_DMS',
    category: 'coordinates',
    description: 'Standard DMS formatted coordinate pair',
    rawText: 'HAZARD AT 51-27-57N 023-10-30E. KEEP CLEAR.',
    expected: {
      coordinatesCount: 1,
      hasUnresolved: false,
    },
  },
  {
    id: 'G02_COORD_DM_HYPHEN',
    category: 'coordinates',
    description: 'DM Hyphenated coordinate with decimal minutes',
    rawText: 'DRILLING RIG AT 53-31.70N 003-45.20E.',
    expected: {
      coordinatesCount: 1,
      hasUnresolved: false,
    },
  },
  {
    id: 'G03_RECTANGLE_BOUNDED_WITHIN',
    category: 'geometry',
    description: 'Bounded within lat1 to lat2 and lon1 to lon2',
    rawText: 'GUNNERY EXERCISES BOUNDED WITHIN 12-00N TO 14-00N AND 045-00E TO 047-00E.',
    expected: {
      archetype: 'polygon',
      coordinatesCount: 4,
    },
  },
  {
    id: 'G04_CABLE_CORRIDOR_BERTH',
    category: 'geometry',
    description: 'Submarine cable laying along line with wide berth',
    rawText: 'SUBMARINE CABLE LAYING ALONG LINE JOINING 20-10N 060-15E AND 21-00N 061-30E. WIDE BERTH OF 2 NM REQUESTED.',
    expected: {
      archetype: 'corridor',
      coordinatesCount: 2,
    },
  },
  {
    id: 'G05_INFORCE_SERIES_AND',
    category: 'inforce',
    description: 'In force list with SERIES and AND clause',
    rawText: 'NAVAREA IX 400/26\nNAVAREA IX WARNING MESSAGES IN FORCE ON 15 OCT 2026.\n2026 SERIES: 001, 007, 009, 015, 021, 045 AND 363.\nCANCEL 360/26.',
    expected: {
      isList: true,
      inForceIds: [
        'NAVAREA IX 1/26',
        'NAVAREA IX 7/26',
        'NAVAREA IX 9/26',
        'NAVAREA IX 15/26',
        'NAVAREA IX 21/26',
        'NAVAREA IX 45/26',
        'NAVAREA IX 363/26',
      ],
    },
  },
  {
    id: 'G06_CANCELLATION_MULTI',
    category: 'cancellation',
    description: 'Multiple cancellations including AND THIS MSG',
    rawText: 'CANCEL 1015/26 AND 1016/26 AND THIS MSG.',
    expected: {
      flags: ['CANCEL_THIS_MSG'],
    },
  },
];

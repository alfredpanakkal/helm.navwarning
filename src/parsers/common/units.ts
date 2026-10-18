// src/parsers/common/units.ts
// Shared Units Conversion & Number Words Recognizer

export const METRES_PER_NM = 1852;
export const CABLES_PER_NM = 10;
export const YARDS_PER_NM = 2025.37;
export const METRES_PER_CABLE = 185.2;

export const NUMBER_WORDS: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
  SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10,
  ELEVEN: 11, TWELVE: 12, FIFTEEN: 15, TWENTY: 20,
  THIRTY: 30, FORTY: 40, FIFTY: 50, HUNDRED: 100,
};

export interface ConvertedUnit {
  valueNm: number | null;
  rawStatedValue: number;
  rawUnit: string;
  isAmbiguous: boolean;
}

export function convertToNauticalMiles(statedValue: number, unitText: string): ConvertedUnit {
  const u = unitText.trim().toUpperCase();

  if (/^(?:NM|NAUTICAL\s+MILES?|MILES?)$/.test(u)) {
    return { valueNm: statedValue, rawStatedValue: statedValue, rawUnit: unitText, isAmbiguous: false };
  }

  if (/^(?:METRES?|METERS?|MTR)$/.test(u)) {
    return { valueNm: Number((statedValue / METRES_PER_NM).toFixed(4)), rawStatedValue: statedValue, rawUnit: unitText, isAmbiguous: false };
  }

  if (/^CABLES?$/.test(u)) {
    return { valueNm: Number((statedValue / CABLES_PER_NM).toFixed(4)), rawStatedValue: statedValue, rawUnit: unitText, isAmbiguous: false };
  }

  if (/^YARDS?$/.test(u)) {
    return { valueNm: Number((statedValue / YARDS_PER_NM).toFixed(4)), rawStatedValue: statedValue, rawUnit: unitText, isAmbiguous: false };
  }

  if (u === 'M') {
    // Bare 'M' is ambiguous unless resolved
    return { valueNm: Number((statedValue / METRES_PER_NM).toFixed(4)), rawStatedValue: statedValue, rawUnit: unitText, isAmbiguous: true };
  }

  return { valueNm: null, rawStatedValue: statedValue, rawUnit: unitText, isAmbiguous: true };
}

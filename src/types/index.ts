/**
 * Common shared domain types for runner-tools
 */

export type PaceUnit = 'km' | 'mi';

export type StandardRaceDistanceKey = 'k5' | 'k10' | 'halfMarathon' | 'marathon';

export interface StandardRaceDistance {
  key: StandardRaceDistanceKey;
  meters: number;
  highlight?: boolean;
}

export const STANDARD_RACE_DISTANCES: readonly StandardRaceDistance[] = [
  { key: 'k5', meters: 5000, highlight: false },
  { key: 'k10', meters: 10000, highlight: true },
  { key: 'halfMarathon', meters: 21097.5, highlight: true },
  { key: 'marathon', meters: 42195, highlight: true },
] as const;

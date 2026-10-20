import { Recommendation } from '../types/bookDiscovery';

/** Normalised engine score (0–1) → user-facing match score (0–10, one decimal). */
export function normalizedToMatchOutOf10(normalized: number): number {
  return Math.round(normalized * 10 * 10) / 10;
}

/** Resolve match score from API payload (prefers explicit matchScoreOutOf10). */
export function getMatchScoreOutOf10(rec: Pick<Recommendation, 'matchScoreOutOf10' | '_rankScore'>): number | null {
  if (rec.matchScoreOutOf10 != null && !Number.isNaN(rec.matchScoreOutOf10)) {
    return rec.matchScoreOutOf10;
  }
  if (rec._rankScore != null && !Number.isNaN(rec._rankScore)) {
    return normalizedToMatchOutOf10(rec._rankScore);
  }
  return null;
}

export function matchScoreColor(scoreOutOf10: number): string {
  if (scoreOutOf10 >= 9) return '#0E462B';
  if (scoreOutOf10 >= 7.5) return '#3a7a54';
  if (scoreOutOf10 >= 5) return '#b45309';
  return '#dc2626';
}

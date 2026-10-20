/**
 * TELLEX Phase 4 — Match-quality scoring & calibration (display 0–10).
 * Ranking remains deterministic; calibration maps evidence → user-facing scores.
 */

// ─── Configurable calibration ───────────────────────────────────────────────
export const MATCH_CALIBRATION = {
  /** Core match (0–1) required to qualify for the 9+ display band (primary path) */
  strongMatchThreshold: 0.80,
  /** Alternate path: min core when most alignment factors are strongly aligned */
  strongMatchAlternateCoreMin: 0.76,
  /** Min share of goal/problem/outcome/intent that must score ≥ strongComponentMin (alternate path) */
  strongAlignFactorRatio: 0.75,
  /** Min count of strongly aligned goal/problem/outcome/intent factors (alternate path) */
  strongAlignFactorMinCount: 3,
  /** Min share of core factors with meaningful user signal + alignment */
  minEvidenceCoverage: 0.55,
  /** Min core factors (with signal) that must score ≥ this for strong band */
  strongComponentMin: 0.68,
  /** Min count of high-scoring core components for strong band (primary path) */
  strongComponentMinCount: 3,
  /** Semantic component must reach this for strong band */
  strongSemanticMin: 0.68,
  /** Mismatch at or above this blocks strong band */
  majorMismatchThreshold: 0.14,
  /** Pool top cosine similarity below → weak catalog cap */
  catalogWeakSemanticBelow: 0.68,
  catalogVeryWeakSemanticBelow: 0.58,
  weakCatalogMaxOutOf10: 7.2,
  veryWeakCatalogMaxOutOf10: 6.0,
  /** Max influence of secondary factors on pre-calibration normalized score */
  secondaryInfluence: 0.12,
  coreWeights: {
    semantic: 0.26,
    goal: 0.22,
    problem: 0.22,
    outcome: 0.14,
    intent: 0.16,
  },
  legacyWeights: {
    semantic: 0.25,
    goalAlignment: 0.18,
    problemAlignment: 0.15,
    emotionalAlignment: 0.12,
    situationAlignment: 0.10,
    readingStyleMatch: 0.08,
    outcomeAlignment: 0.07,
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function normalise(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function arrayContainsAny(haystack: string[], needles: string[]): boolean {
  const h = haystack.map(normalise);
  return needles.some(n => h.some(hay => hay.includes(normalise(n)) || normalise(n).includes(hay)));
}

function textContainsAny(text: string, needles: string[]): boolean {
  const t = normalise(text);
  return needles.some(n => t.includes(normalise(n)));
}

function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const STOP_WORDS = new Set([
  'want', 'need', 'book', 'books', 'something', 'about', 'really', 'very', 'that', 'this', 'with', 'from', 'have', 'just', 'more', 'better', 'into', 'would', 'like', 'help', 'make', 'feel', 'being', 'been', 'some', 'what', 'when', 'where', 'which', 'them', 'they', 'your', 'mine',
]);

/** General query-intent signals derived from free text (not book-specific). */
const QUERY_CONCEPT_SIGNALS: {
  patterns: RegExp[];
  goals?: string[];
  problems?: string[];
  intents?: string[];
  outcomes?: string[];
}[] = [
  {
    patterns: [/meaning of life/, /\bmeaning\b.*\blife\b/, /purpose of (?:life|living)/, /understand.*\bmeaning\b/, /question life/],
    goals: ['find meaning', 'purpose', 'existential clarity', 'logotherapy'],
    problems: ['existential crisis', 'lack of purpose', 'emptiness', 'suffering'],
    intents: ['understand meaning', 'philosophical reflection', 'self-reflection'],
    outcomes: ['perspective shift', 'sense of purpose'],
  },
  {
    patterns: [/feel(?:ing)? lost/, /feel stuck/],
    problems: ['feeling lost', 'lack of direction'],
  },
  {
    patterns: [/productivity/, /can't focus/, /cannot focus/, /can not focus/, /distract/, /concentrate/, /deep work/, /get more done/],
    goals: ['improve productivity', 'better focus', 'deep work', 'concentration'],
    problems: ['lack of focus', 'distraction', 'procrastination', 'scattered attention'],
    intents: ['practical productivity', 'focus strategies'],
    outcomes: ['sustained focus', 'productive habits'],
  },
  {
    patterns: [/build better habits/, /\bhabits?\b/, /stay consistent/, /more consistent/, /routine/],
    goals: ['build habits', 'consistency', 'behavior change'],
    problems: ['inconsistent habits', 'starting and stopping', 'lack of discipline'],
    intents: ['practical habit building'],
    outcomes: ['lasting habits', 'consistent routines'],
  },
  {
    patterns: [/how money affects/, /money.*decisions/, /financial decisions/, /psychology of money/],
    goals: ['understand money psychology', 'better financial decisions'],
    problems: ['money anxiety', 'poor financial choices', 'money mindset'],
    intents: ['financial wisdom', 'money behavior'],
    outcomes: ['financial clarity', 'smarter money decisions'],
  },
  {
    patterns: [/peace and calm/, /mind will not stop/, /racing mind/, /stop racing/, /inner peace/, /mental calm/],
    goals: ['peace of mind', 'calm', 'stillness', 'present moment'],
    problems: ['racing thoughts', 'anxiety', 'mental restlessness', 'overthinking'],
    intents: ['mindfulness', 'meditation', 'present moment awareness'],
    outcomes: ['peace and calm', 'mental stillness'],
  },
];

/** When the query asks for meaning/purpose, books with greater philosophical depth align better. */
function meaningDepthBonus(book: any, profile: any, score: number): number {
  const enriched = enrichProfileFromFreeText(profile);
  const seeksMeaning = enriched.intents.some(i => /meaning|purpose|philosophical|existential/.test(i));
  if (!seeksMeaning || score == null) return score;

  const b = book.data || book;
  const depth = b.ai_metadata?.philosophical_depth ?? b.philosophical_depth ?? 5;
  if (depth >= 9) return Math.min(1, score + 0.1);
  if (depth >= 7) return Math.min(1, score + 0.05);
  return score;
}

function enrichProfileFromFreeText(profile: any): {
  goals: string[];
  problems: string[];
  intents: string[];
  outcomes: string[];
} {
  const ft = normalise(profile.freeText || '');
  const goals = new Set<string>();
  const problems = new Set<string>();
  const intents = new Set<string>();
  const outcomes = new Set<string>();

  for (const concept of QUERY_CONCEPT_SIGNALS) {
    if (concept.patterns.some(p => p.test(ft))) {
      concept.goals?.forEach(g => goals.add(g));
      concept.problems?.forEach(p => problems.add(p));
      concept.intents?.forEach(i => intents.add(i));
      concept.outcomes?.forEach(o => outcomes.add(o));
    }
  }

  return {
    goals: [...goals],
    problems: [...problems],
    intents: [...intents],
    outcomes: [...outcomes],
  };
}

function extractTerms(...sources: string[]): string[] {
  const terms = new Set<string>();
  for (const src of sources) {
    for (const w of normalise(src).split(/\s+/)) {
      if (w.length > 3 && !STOP_WORDS.has(w)) terms.add(w);
    }
  }
  return [...terms];
}

function bookHaystack(book: any): string {
  const b = book.data || book;
  const m = b.ai_metadata || {};
  return [
    b.title,
    b.description,
    m.core_concepts,
    m.main_themes,
    m.problems_addressed,
    m.user_goals,
    m.desired_outcomes,
    m.recommend_when,
    m.reading_experience,
    ...(m.tellex_goal_tags || []),
    ...(m.tellex_problem_tags || []),
    ...(m.tellex_vibe_tags || []),
  ].filter(Boolean).join(' ');
}

/** 0–1 overlap score; null if no user needles */
function scoreTermOverlap(needles: string[], haystack: string): number | null {
  if (needles.length === 0) return null;
  const hay = normalise(haystack);
  let hits = 0;
  const capped = needles.slice(0, 12);
  for (const n of capped) {
    const term = normalise(n);
    if (term.length < 3) continue;
    if (hay.includes(term)) hits += 1;
  }
  const ratio = hits / Math.max(1, Math.min(capped.length, 6));
  if (ratio >= 0.55) return 0.95;
  if (ratio >= 0.35) return 0.78;
  if (ratio >= 0.2) return 0.62;
  if (ratio >= 0.08) return 0.45;
  return 0.32;
}

// ─── User preference signals (unknown = neutral, not zero) ───────────────────
function hasExplicitDepthPreference(profile: any): boolean {
  const ft = normalise(profile.freeText || '');
  if (
    ft.includes('philosophical') ||
    ft.includes('practical') ||
    ft.includes('dont want') ||
    ft.includes("don't want") ||
    ft.includes('not want') ||
    ft.includes('actionable') ||
    ft.includes('deep') ||
    ft.includes('emotional')
  ) {
    return true;
  }
  const style = normalise(profile.problemSolvingStyle || '');
  return style.includes('action') || style.includes('analyze') || style.includes('feel');
}

function userPracticalityPreference(profile: any): number {
  const style = normalise(profile.problemSolvingStyle || '');
  const wants = (profile.desiredOutcomes || []).map(normalise);
  const ft = normalise(profile.freeText || '');
  let score = 0.5;
  if (ft.includes('practical') || ft.includes('actionable') || ft.includes('dont want philosophical')) score += 0.35;
  if (style.includes('action') || style.includes('quickly')) score += 0.25;
  if (style.includes('analyze') || style.includes('deeply')) score -= 0.12;
  if (style.includes('feel')) score -= 0.08;
  if (wants.some(w => w.includes('motivation'))) score += 0.05;
  return clamp(0, 1, score);
}

function userPhilosophicalPreference(profile: any): number {
  const style = normalise(profile.problemSolvingStyle || '');
  const reasons = (profile.readingReasons || []).map(normalise);
  const ft = normalise(profile.freeText || '');
  let score = 0.5;
  if (ft.includes('philosophical') || ft.includes('meaning') || ft.includes('question life')) score += 0.35;
  if (style.includes('analyze') || style.includes('deeply')) score += 0.22;
  if (style.includes('action') || style.includes('quickly')) score -= 0.18;
  if (reasons.some(r => r.includes('reflect') || r.includes('explore'))) score += 0.12;
  return clamp(0, 1, score);
}

function userEmotionalDepthPreference(profile: any): number {
  const style = normalise(profile.problemSolvingStyle || '');
  const wants = (profile.desiredOutcomes || []).map(normalise);
  let score = 0.5;
  if (style.includes('feel')) score += 0.28;
  if (wants.some(w => w.includes('healing') || w.includes('comfort'))) score += 0.18;
  if (style.includes('action') || style.includes('quickly')) score -= 0.1;
  return clamp(0, 1, score);
}

// ─── Core & secondary factor scores (null = no user signal → excluded) ───────
/** Maps raw cosine similarity → match-quality semantic score (not a linear copy of embedding distance). */
export function scoreSemanticRelevance(similarity: number): number {
  const s = similarity || 0;
  if (s >= 0.88) return 0.98;
  if (s >= 0.80) return 0.86 + (s - 0.80) * 1.4;
  if (s >= 0.72) return 0.76 + (s - 0.72) * 2.5;
  if (s >= 0.68) return 0.68 + (s - 0.68) * 2.0;
  if (s >= 0.55) return 0.48 + (s - 0.55) * 1.54;
  return clamp(0.22, 1, s * 0.75);
}

function scoreGoalAlignment(book: any, profile: any): number | null {
  const b = book.data || book;
  const bookGoalTags: string[] = b.ai_metadata?.tellex_goal_tags || [];
  const bookUserGoals: string = b.ai_metadata?.user_goals || b.user_goals || '';
  const enriched = enrichProfileFromFreeText(profile);
  const userGoals = [
    ...(profile.profileSignals?.goals || []),
    ...(profile.desiredOutcomes || []),
    ...(profile.readingReasons || []),
    ...enriched.goals,
    ...enriched.outcomes,
  ];
  const freeTerms = extractTerms(profile.freeText || '');
  const needles = [...userGoals, ...freeTerms];
  if (needles.length === 0) return null;

  if (arrayContainsAny(bookGoalTags, userGoals)) return meaningDepthBonus(book, profile, 1.0);
  if (textContainsAny(bookUserGoals, userGoals)) return meaningDepthBonus(book, profile, 0.82);

  const overlap = scoreTermOverlap(needles, bookHaystack(b));
  return meaningDepthBonus(book, profile, overlap ?? 0.35);
}

function scoreProblemAlignment(book: any, profile: any): number | null {
  const b = book.data || book;
  const bookProblemTags: string[] = b.ai_metadata?.tellex_problem_tags || [];
  const bookProblems: string = b.ai_metadata?.problems_addressed || b.problems_addressed || '';
  const enriched = enrichProfileFromFreeText(profile);
  const userProblems = [
    ...(profile.profileSignals?.themes || []),
    ...(profile.profileSignals?.emotions || []),
    profile.currentNeed,
    profile.emotionalState,
    profile.lifeSituation,
    ...enriched.problems,
  ].filter(Boolean);
  const freeTerms = extractTerms(profile.freeText || '');
  const needles = [...userProblems.map(String), ...freeTerms];
  if (needles.length === 0) return null;

  if (arrayContainsAny(bookProblemTags, userProblems.map(String))) return meaningDepthBonus(book, profile, 1.0);
  if (textContainsAny(bookProblems, userProblems.map(String))) return meaningDepthBonus(book, profile, 0.8);

  const overlap = scoreTermOverlap(freeTerms.length ? freeTerms : userProblems.map(String), bookProblems + ' ' + bookHaystack(b));
  return meaningDepthBonus(book, profile, overlap ?? 0.35);
}

function scoreOutcomeAlignment(book: any, profile: any): number | null {
  const b = book.data || book;
  const bookDesiredOutcome: string = b.ai_metadata?.desired_outcomes || b.desired_outcome || '';
  const bookRecommendWhen: string = b.ai_metadata?.recommend_when || '';
  const enriched = enrichProfileFromFreeText(profile);
  const userOutcomes = [...(profile.desiredOutcomes || []), ...enriched.outcomes];
  const freeTerms = extractTerms(profile.freeText || '');
  if (userOutcomes.length === 0 && freeTerms.length === 0) return null;

  if (userOutcomes.length && textContainsAny(bookDesiredOutcome, userOutcomes)) return 1.0;
  if (userOutcomes.length && textContainsAny(bookRecommendWhen, userOutcomes)) return 0.78;

  const overlap = scoreTermOverlap([...userOutcomes, ...freeTerms], bookDesiredOutcome + ' ' + bookRecommendWhen + ' ' + bookHaystack(b));
  return overlap ?? 0.38;
}

function scoreIntentAlignment(book: any, profile: any): number | null {
  const enriched = enrichProfileFromFreeText(profile);
  const intents = [
    ...(profile.profileSignals?.readingIntent || []),
    ...(profile.readingReasons || []),
    profile.currentNeed,
    ...enriched.intents,
    ...enriched.goals,
  ].filter(Boolean);
  const freeTerms = extractTerms(profile.freeText || '');
  if (intents.length === 0 && freeTerms.length === 0) return null;

  const b = book.data || book;
  const hay = (b.ai_metadata?.recommend_when || '') + ' ' + (b.ai_metadata?.reading_experience || '') + ' ' + bookHaystack(b);
  if (intents.length && textContainsAny(hay, intents.map(String))) return meaningDepthBonus(book, profile, 0.88);

  const overlap = scoreTermOverlap([...intents.map(String), ...freeTerms], hay);
  return meaningDepthBonus(book, profile, overlap ?? 0.36);
}

function scoreEmotionalAlignment(book: any, profile: any): number | null {
  const b = book.data || book;
  const userEmotions = [
    ...(profile.profileSignals?.emotions || []),
    profile.emotionalState || '',
  ].filter(Boolean);
  if (userEmotions.length === 0) return null;

  const bookEmotionTags: string[] = b.ai_metadata?.tellex_emotion_tags || [];
  const bookEmotionalTone: string = b.ai_metadata?.emotional_tone || b.emotional_tone || '';
  if (arrayContainsAny(bookEmotionTags, userEmotions)) return 1.0;
  if (textContainsAny(bookEmotionalTone, userEmotions)) return 0.72;
  return 0.48;
}

function scoreSituationAlignment(book: any, profile: any): number | null {
  const b = book.data || book;
  const userSituation = profile.lifeSituation || '';
  const situationKeywords = profile.profileSignals?.themes || [];
  const allUserSituations = [userSituation, ...situationKeywords].filter(Boolean);
  if (allUserSituations.length === 0) return null;

  const bookSituationTags: string[] = b.ai_metadata?.tellex_situation_tags || [];
  const bookLifeSituations: string = b.ai_metadata?.life_situations || '';
  if (arrayContainsAny(bookSituationTags, allUserSituations)) return 1.0;
  if (textContainsAny(bookLifeSituations, allUserSituations)) return 0.68;
  return 0.45;
}

function scoreReadingStyleMatch(book: any, profile: any): number | null {
  if (!hasExplicitDepthPreference(profile)) return null;

  const b = book.data || book;
  const bookPracticality: number = b.ai_metadata?.practicality_score ?? b.practicality_score ?? 5;
  const bookPhilosophical: number = b.ai_metadata?.philosophical_depth ?? b.philosophical_depth ?? 5;
  const bookEmotionalDepth: number = b.ai_metadata?.emotional_depth ?? b.emotional_depth ?? 5;

  const userPracticality = userPracticalityPreference(profile);
  const userPhilosophical = userPhilosophicalPreference(profile);
  const userEmotionalDepth = userEmotionalDepthPreference(profile);

  const practDiff = Math.abs(userPracticality - bookPracticality / 10);
  const philDiff = Math.abs(userPhilosophical - bookPhilosophical / 10);
  const emotDiff = Math.abs(userEmotionalDepth - bookEmotionalDepth / 10);

  return 1 - (practDiff + philDiff + emotDiff) / 3;
}

export function computeMismatchPenalty(book: any, profile: any): number {
  let penalty = 0;
  const b = book.data || book;
  const bookAvoidWhen: string = normalise(b.ai_metadata?.avoid_when || '');
  const bookNotBestFor: string = normalise(b.ai_metadata?.not_best_for || '');
  const bookWeakSignals: string = normalise(b.ai_metadata?.weak_match_signals || '');

  const explicitDepth = hasExplicitDepthPreference(profile);
  const userPracticality = userPracticalityPreference(profile);
  const userPhilosophical = userPhilosophicalPreference(profile);
  const bookPhilosophical: number = (b.ai_metadata?.philosophical_depth ?? b.philosophical_depth ?? 5) / 10;
  const bookPracticality: number = (b.ai_metadata?.practicality_score ?? b.practicality_score ?? 5) / 10;

  const ft = normalise(profile.freeText || '');
  const rejectsPhilosophical = ft.includes('dont want philosophical') || ft.includes("don't want philosophical") || (ft.includes('philosophical') && (ft.includes('dont') || ft.includes("don't")));

  if (rejectsPhilosophical && bookPhilosophical > 0.72) penalty += 0.28;
  else if (explicitDepth && userPracticality > 0.72 && bookPhilosophical > 0.78) penalty += 0.22;
  else if (explicitDepth && userPhilosophical > 0.78 && bookPracticality > 0.88 && bookPhilosophical < 0.28) penalty += 0.18;

  const userSituationWords = [
    profile.emotionalState,
    profile.lifeSituation,
    ...(profile.profileSignals?.emotions || []),
    ...(profile.profileSignals?.themes || []),
  ].filter(Boolean).map(normalise);

  if (userSituationWords.some(w => bookAvoidWhen.includes(w))) penalty += 0.18;
  if (userSituationWords.some(w => bookNotBestFor.includes(w))) penalty += 0.1;
  if (userSituationWords.some(w => bookWeakSignals.includes(w))) penalty += 0.05;

  return Math.min(penalty, 0.45);
}

function weightedCoreAverage(scores: Record<string, number | null>): { coreMatch: number; evidenceCoverage: number } {
  const weights = MATCH_CALIBRATION.coreWeights;
  let sum = 0;
  let wSum = 0;
  let withSignal = 0;
  let strongHits = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const v = scores[key as keyof typeof scores];
    if (v == null) continue;
    withSignal += 1;
    sum += v * weight;
    wSum += weight;
    if (v >= 0.65) strongHits += 1;
  }

  const coreMatch = wSum > 0 ? sum / wSum : 0.45;
  const evidenceCoverage = withSignal > 0 ? strongHits / withSignal : 0;
  return { coreMatch, evidenceCoverage };
}

function secondaryRefinement(scores: { emotional: number | null; situation: number | null; readStyle: number | null }): number {
  const vals = [scores.emotional, scores.situation, scores.readStyle].filter((v): v is number => v != null);
  if (vals.length === 0) return 0;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return (avg - 0.5) * MATCH_CALIBRATION.secondaryInfluence;
}

/** Evidence boost from Phase 2 strong_match_signals when query intent overlaps (not book-specific). */
function strongMatchEvidenceBoost(book: any, profile: any): number {
  const b = book.data || book;
  const signals: string = b.ai_metadata?.strong_match_signals || '';
  if (!signals.trim()) return 0;

  const enriched = enrichProfileFromFreeText(profile);
  const queryNeedles = [
    ...enriched.goals,
    ...enriched.problems,
    ...enriched.intents,
    ...enriched.outcomes,
    ...extractTerms(profile.freeText || ''),
  ];
  if (queryNeedles.length === 0) return 0;

  const overlap = scoreTermOverlap(queryNeedles, signals);
  if (overlap == null || overlap < 0.45) return 0;
  return Math.min(0.08, (overlap - 0.4) * 0.12);
}

export interface MatchEvaluation {
  semantic: number;
  goal: number | null;
  problem: number | null;
  outcome: number | null;
  intent: number | null;
  emotional: number | null;
  situation: number | null;
  readStyle: number | null;
  mismatch: number;
  coreMatch: number;
  evidenceCoverage: number;
  normalizedPreCalibration: number;
  qualifiesStrongMatch: boolean;
  matchScoreOutOf10: number;
  legacyRawScore: number;
  legacyScoreOutOf10: number;
}

function qualifiesStrongMatch(
  components: { semantic: number; goal: number | null; problem: number | null; outcome: number | null; intent: number | null },
  coreMatch: number,
  evidenceCoverage: number,
  mismatch: number,
): boolean {
  const cfg = MATCH_CALIBRATION;
  if (mismatch >= cfg.majorMismatchThreshold) return false;
  if (evidenceCoverage < cfg.minEvidenceCoverage) return false;
  if (components.semantic < cfg.strongSemanticMin) return false;

  const alignVals = [components.goal, components.problem, components.outcome, components.intent].filter(
    (v): v is number => v != null,
  );
  const highCount = alignVals.filter(v => v >= cfg.strongComponentMin).length;
  const alignRatio = alignVals.length > 0 ? highCount / alignVals.length : 0;

  const mostFactorsAligned =
    highCount >= cfg.strongAlignFactorMinCount &&
    alignRatio >= cfg.strongAlignFactorRatio &&
    coreMatch >= cfg.strongMatchAlternateCoreMin;

  const primaryPath =
    coreMatch >= cfg.strongMatchThreshold && highCount >= cfg.strongComponentMinCount;

  return primaryPath || mostFactorsAligned;
}

export function calibrateMatchScoreOutOf10(
  normalized: number,
  coreMatch: number,
  qualifiesStrong: boolean,
  poolBestSemantic: number,
): number {
  const cfg = MATCH_CALIBRATION;
  let outOf10: number;

  if (qualifiesStrong) {
    const t = cfg.strongMatchAlternateCoreMin;
    const span = Math.max(0.001, 1 - t);
    const evidence = Math.max(coreMatch, normalized);
    const progress = clamp(0, 1, (evidence - t) / span);
    outOf10 = 9.0 + progress * 1.0;
    outOf10 = clamp(9.0, 10.0, outOf10);
  } else if (normalized >= 0.74) {
    outOf10 = 7.2 + ((normalized - 0.74) / (cfg.strongMatchThreshold - 0.74)) * 1.79;
    outOf10 = Math.min(8.99, outOf10);
  } else if (normalized >= 0.52) {
    outOf10 = 5.0 + ((normalized - 0.52) / 0.22) * 2.0;
  } else {
    outOf10 = 3.5 + (normalized / 0.52) * 1.5;
  }

  if (poolBestSemantic < cfg.catalogVeryWeakSemanticBelow) {
    outOf10 = Math.min(outOf10, cfg.veryWeakCatalogMaxOutOf10);
  } else if (poolBestSemantic < cfg.catalogWeakSemanticBelow) {
    const weakPoolCap = qualifiesStrong ? 8.4 : cfg.weakCatalogMaxOutOf10;
    outOf10 = Math.min(outOf10, weakPoolCap);
  }

  if (!qualifiesStrong) outOf10 = Math.min(outOf10, 8.9);

  const rounded = round1(outOf10);
  if (!qualifiesStrong && rounded >= 9) return 8.9;
  return rounded;
}

/** Legacy Phase 4 formula (pre-calibration) for regression comparison */
export function computeLegacyRawScore(book: any, profile: any): number {
  const semantic = Math.min((book.similarity || 0) * 1.1, 1.0);

  const legacyGoal = (() => {
    const b = book.data || book;
    const bookGoalTags: string[] = b.ai_metadata?.tellex_goal_tags || [];
    const bookUserGoals: string = b.ai_metadata?.user_goals || b.user_goals || '';
    const userGoals = [
      ...(profile.profileSignals?.goals || []),
      ...(profile.desiredOutcomes || []),
      ...(profile.readingReasons || []),
    ];
    if (userGoals.length === 0) return 0.5;
    const tagMatch = arrayContainsAny(bookGoalTags, userGoals);
    const textMatch = textContainsAny(bookUserGoals, userGoals);
    return tagMatch ? 1.0 : textMatch ? 0.75 : 0.2;
  })();

  const legacyProblem = (() => {
    const b = book.data || book;
    const bookProblemTags: string[] = b.ai_metadata?.tellex_problem_tags || [];
    const bookProblems: string = b.ai_metadata?.problems_addressed || b.problems_addressed || '';
    const userProblems = [...(profile.profileSignals?.themes || []), ...(profile.profileSignals?.emotions || [])];
    if (userProblems.length === 0) return 0.5;
    const tagMatch = arrayContainsAny(bookProblemTags, userProblems);
    const textMatch = textContainsAny(bookProblems, userProblems);
    return tagMatch ? 1.0 : textMatch ? 0.70 : 0.2;
  })();

  const legacyEmotional = (() => {
    const b = book.data || book;
    const userEmotions = [...(profile.profileSignals?.emotions || []), profile.emotionalState || ''].filter(Boolean);
    if (userEmotions.length === 0) return 0.5;
    const bookEmotionTags: string[] = b.ai_metadata?.tellex_emotion_tags || [];
    const bookEmotionalTone: string = b.ai_metadata?.emotional_tone || b.emotional_tone || '';
    const tagMatch = arrayContainsAny(bookEmotionTags, userEmotions);
    const textMatch = textContainsAny(bookEmotionalTone, userEmotions);
    return tagMatch ? 1.0 : textMatch ? 0.65 : 0.2;
  })();

  const legacySituation = (() => {
    const b = book.data || book;
    const allUserSituations = [profile.lifeSituation, ...(profile.profileSignals?.themes || [])].filter(Boolean);
    if (allUserSituations.length === 0) return 0.5;
    const bookSituationTags: string[] = b.ai_metadata?.tellex_situation_tags || [];
    const bookLifeSituations: string = b.ai_metadata?.life_situations || '';
    const tagMatch = arrayContainsAny(bookSituationTags, allUserSituations);
    const textMatch = textContainsAny(bookLifeSituations, allUserSituations);
    return tagMatch ? 1.0 : textMatch ? 0.65 : 0.2;
  })();

  const legacyReadStyle = (() => {
    const b = book.data || book;
    const bookPracticality: number = b.ai_metadata?.practicality_score ?? b.practicality_score ?? 5;
    const bookPhilosophical: number = b.ai_metadata?.philosophical_depth ?? b.philosophical_depth ?? 5;
    const bookEmotionalDepth: number = b.ai_metadata?.emotional_depth ?? b.emotional_depth ?? 5;
    const style = normalise(profile.problemSolvingStyle || '');
    const wants = (profile.desiredOutcomes || []).map(normalise);
    let uPract = 0.5;
    if (style.includes('action') || style.includes('quickly')) uPract += 0.35;
    if (style.includes('analyze') || style.includes('deeply')) uPract -= 0.15;
    if (style.includes('feel')) uPract -= 0.10;
    if (wants.some(w => w.includes('practical') || w.includes('mindset') || w.includes('motivation'))) uPract += 0.10;
    let uPhil = 0.4;
    if (style.includes('analyze') || style.includes('deeply')) uPhil += 0.35;
    if (style.includes('action') || style.includes('quickly')) uPhil -= 0.25;
    let uEmot = 0.4;
    if (style.includes('feel')) uEmot += 0.35;
    uPract = clamp(0, 1, uPract);
    uPhil = clamp(0, 1, uPhil);
    uEmot = clamp(0, 1, uEmot);
    const avgDiff =
      (Math.abs(uPract - bookPracticality / 10) +
        Math.abs(uPhil - bookPhilosophical / 10) +
        Math.abs(uEmot - bookEmotionalDepth / 10)) /
      3;
    return 1 - avgDiff;
  })();

  const legacyOutcome = (() => {
    const b = book.data || book;
    const userOutcomes = profile.desiredOutcomes || [];
    if (userOutcomes.length === 0) return 0.5;
    const bookDesiredOutcome: string = b.ai_metadata?.desired_outcomes || b.desired_outcome || '';
    const bookRecommendWhen: string = b.ai_metadata?.recommend_when || '';
    const outcomeMatch = textContainsAny(bookDesiredOutcome, userOutcomes);
    const recWhenMatch = textContainsAny(bookRecommendWhen, userOutcomes);
    return outcomeMatch ? 1.0 : recWhenMatch ? 0.7 : 0.25;
  })();

  const w = MATCH_CALIBRATION.legacyWeights;
  const mismatch = computeMismatchPenalty(book, profile);

  return Math.max(
    0,
    w.semantic * semantic +
      w.goalAlignment * legacyGoal +
      w.problemAlignment * legacyProblem +
      w.emotionalAlignment * legacyEmotional +
      w.situationAlignment * legacySituation +
      w.readingStyleMatch * legacyReadStyle +
      w.outcomeAlignment * legacyOutcome -
      mismatch,
  );
}

export function evaluateBookMatch(book: any, profile: any, poolBestSemantic: number): MatchEvaluation {
  const semantic = scoreSemanticRelevance(book.similarity || 0);
  const goal = scoreGoalAlignment(book, profile);
  const problem = scoreProblemAlignment(book, profile);
  const outcome = scoreOutcomeAlignment(book, profile);
  const intent = scoreIntentAlignment(book, profile);
  const emotional = scoreEmotionalAlignment(book, profile);
  const situation = scoreSituationAlignment(book, profile);
  const readStyle = scoreReadingStyleMatch(book, profile);
  const mismatch = computeMismatchPenalty(book, profile);

  const { coreMatch, evidenceCoverage } = weightedCoreAverage({ semantic, goal, problem, outcome, intent });
  const secondaryDelta = secondaryRefinement({ emotional, situation, readStyle });
  const evidenceBoost = strongMatchEvidenceBoost(book, profile);
  const normalizedPreCalibration = clamp(0, 1, coreMatch + secondaryDelta + evidenceBoost - mismatch);

  const qualifiesStrong = qualifiesStrongMatch(
    { semantic, goal, problem, outcome, intent },
    coreMatch,
    evidenceCoverage,
    mismatch,
  );

  const matchScoreOutOf10 = calibrateMatchScoreOutOf10(
    normalizedPreCalibration,
    coreMatch,
    qualifiesStrong,
    poolBestSemantic,
  );

  const legacyRawScore = computeLegacyRawScore(book, profile);
  const legacyScoreOutOf10 = round1(legacyRawScore * 10);

  return {
    semantic,
    goal,
    problem,
    outcome,
    intent,
    emotional,
    situation,
    readStyle,
    mismatch,
    coreMatch,
    evidenceCoverage,
    normalizedPreCalibration,
    qualifiesStrongMatch: qualifiesStrong,
    matchScoreOutOf10,
    legacyRawScore,
    legacyScoreOutOf10,
  };
}

export function rankCandidates(candidates: any[], profile: any): any[] {
  const poolBestSemantic = candidates.reduce((m, b) => Math.max(m, b.similarity || 0), 0);

  const scored = candidates.map(book => {
    const evaluation = evaluateBookMatch(book, profile, poolBestSemantic);
    return {
      ...book,
      _rankingDetails: evaluation,
      _finalScore: evaluation.normalizedPreCalibration,
      _matchScoreOutOf10: evaluation.matchScoreOutOf10,
      _qualifiesStrongMatch: evaluation.qualifiesStrongMatch,
    };
  });

  scored.sort((a, b) => {
    if (b._matchScoreOutOf10 !== a._matchScoreOutOf10) return b._matchScoreOutOf10 - a._matchScoreOutOf10;
    return b._finalScore - a._finalScore;
  });

  return scored;
}

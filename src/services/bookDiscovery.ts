import { QuestionnaireAnswers, RecommendationResult } from "../types/bookDiscovery";
import { buildUserProfile } from "../utils/profileBuilder";
import { generateSemanticQuery } from "../utils/queryBuilder";

/**
 * Phase 4 & 5 entry point — processes questionnaire answers into a full
 * personalized recommendation result.
 */
export async function processBookDiscovery(answers: QuestionnaireAnswers): Promise<RecommendationResult> {
  // 1. Build discovery profile from questionnaire answers (with freeText intent signals)
  const profile = buildUserProfile(answers);

  // 2. Generate semantic query combining user freeText and structured intents
  const semanticQuery = generateSemanticQuery(profile);
  profile.semanticQuery = semanticQuery;

  // 3. Call recommendation API
  const response = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile,
      semanticQuery,
      excludedBooks: profile.previouslyRead,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Recommendation engine returned status ${response.status}`);
  }

  const data = await response.json();

  if (!data.recommendations) {
    throw new Error('Invalid response from recommendation engine');
  }

  return {
    recommendations: data.recommendations,
    profile,
    query: semanticQuery,
    excludedBooks: profile.previouslyRead,
    totalCandidates: data.totalCandidates,
    isUnrelated: data.isUnrelated,
    message: data.message,
  };
}

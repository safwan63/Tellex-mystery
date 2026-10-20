import { Book } from "./book";

export interface QuestionnaireAnswers {
  emotion: string;
  lifeSituation: string;
  decisionStyle: string;
  currentNeed: string;
  reasons: string[];
  wants: string[];
  bookType: string;
  readBooks: string;
  bookQuantity: string;
  freeText?: string;
  language?: string;
}

export interface ProfileSignals {
  themes: string[];
  emotions: string[];
  goals: string[];
  readingIntent: string[];
  contentPreferences: string[];
}

export interface UserDiscoveryProfile {
  bookType: string;
  previouslyRead: string[];
  readingReasons: string[];
  desiredOutcomes: string[];
  emotionalState: string;
  lifeSituation: string;
  problemSolvingStyle: string;
  quantity: number;
  freeText: string;
  semanticQuery: string;
  profileSignals: ProfileSignals;
}

export interface CandidateBook extends Book {
  similarity: number;
}

export interface RetrievalResult {
  query: string;
  profile: UserDiscoveryProfile;
  candidates: CandidateBook[];
  excludedBooks: string[];
}

// ─── Phase 4 & 5 Types ────────────────────────────────────────────────────────

export interface Recommendation {
  rank: number;
  book_id: string;
  title: string;
  author: string;
  cover_url: string;
  description: string;
  category: string;
  physical_purchase_url?: string;
  physical_purchase_provider?: string;
  ebook_purchase_url?: string;
  ebook_purchase_provider?: string;
  ai_metadata?: any;
  explanation: string;          // AI-generated personalized reason
  _displayScore?: number;       // e.g. 9.4 / 10
  matchScoreOutOf10?: number;
  _rankScore?: number;
  _scoring?: any;
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  profile: UserDiscoveryProfile;
  query: string;
  excludedBooks: string[];
  totalCandidates?: number;
  isUnrelated?: boolean;
  message?: string;
}

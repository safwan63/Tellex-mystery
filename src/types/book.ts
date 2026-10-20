export interface Book {
  book_id: string;
  title: string;
  author: string;
  isbn13: string;
  publisher: string;
  description: string;
  category: string;
  subcategory: string;
  topics: string[];
  themes: string[];
  user_goals: string[];
  problems_addressed: string[];
  emotional_tone: string;
  reading_style: string;
  difficulty: string;
  target_audience: string;
  language: string;
  publication_year: number;
  edition_notes?: string;
  cover_url: string;
  physical_purchase_url: string;
  physical_purchase_provider: string;
  physical_affiliate: string;
  ebook_purchase_url: string;
  ebook_purchase_provider: string;
  ebook_affiliate: string;
  ebook_affiliate_status: string;
  rights_status: string;
  vibe_tags: string[];
  life_stage: string;
  desired_outcome: string;
  content_style: string;
  practicality_score: number;
  emotional_depth: number;
  philosophical_depth: number;
  motivation_level: number;
  
  // Phase 2 AI Enrichment
  ai_metadata?: {
    core_concepts: string;
    key_ideas: string;
    main_themes: string;
    problems_addressed: string;
    user_goals: string;
    desired_outcomes: string;
    common_user_intents: string;
    emotional_tone: string;
    mood: string;
    emotional_needs: string;
    ideal_reader: string;
    life_situations: string;
    reading_experience: string;
    content_style: string;
    recommend_when: string;
    avoid_when: string;
    best_for: string;
    not_best_for: string;
    strong_match_signals: string;
    weak_match_signals: string;
    tellex_vibe_tags: string[];
    tellex_problem_tags: string[];
    tellex_goal_tags: string[];
    tellex_emotion_tags: string[];
    tellex_situation_tags: string[];
    practicality_score: number;
    emotional_depth: number;
    philosophical_depth: number;
    motivation_level: number;
    intensity_level: number;
  };

  semantic_search?: {
    representation: string;
    representation_version: string;
    embedding_model: string;
    embedding_generated_at: string;
    // Note: The actual embedding array is typically not downloaded to the client
  };
}

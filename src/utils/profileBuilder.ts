import { QuestionnaireAnswers, UserDiscoveryProfile, ProfileSignals } from "../types/bookDiscovery";

const QUESTIONNAIRE_OPTION_MAPPINGS: Record<string, { themes?: string[], emotions?: string[], goals?: string[], intent?: string[], content?: string[] }> = {
  // Emotions
  "Happy": { emotions: ["joyful", "positive", "content"] },
  "Peaceful": { emotions: ["calm", "grounded"] },
  "Anxious": { emotions: ["anxious", "overwhelmed"] },
  "Low / Sad": { emotions: ["sad", "grieving", "empty"] },
  "Frustrated": { emotions: ["frustrated", "angry", "stuck"] },
  "Hopeful": { emotions: ["optimistic", "forward-looking"] },
  "Empty": { emotions: ["disconnected", "numb"] },

  // Life Situations
  "New beginnings": { themes: ["fresh start", "new chapter", "change"] },
  "Heartbreak or loss": { themes: ["grief", "healing", "moving on"] },
  "Feeling stuck or confused": { themes: ["direction", "clarity", "purpose"] },
  "Seeking personal growth": { themes: ["self-improvement", "growth", "potential"] },
  "Need mental calm": { themes: ["mindfulness", "peace", "stress-relief"] },
  "Working toward a goal": { themes: ["achievement", "ambition", "focus"] },

  // Decision Styles
  "Think deeply and analyze": { content: ["analytical", "thoughtful", "philosophical", "deep"] },
  "Feel through it": { content: ["emotional", "empathetic", "heartfelt", "raw"] },
  "Take action quickly": { content: ["practical", "actionable", "straightforward", "dynamic"] },
  "Talk to someone": { content: ["relatable", "conversational", "comforting"] },

  // Current Need
  "Clarity": { goals: ["find direction", "gain perspective"] },
  "Healing": { goals: ["heal", "recover", "find comfort"] },
  "Motivation": { goals: ["get motivated", "build momentum"] },
  "Peace": { goals: ["find calm", "reduce anxiety"] },

  // Reasons
  "To relax": { intent: ["relaxation", "escapism"] },
  "To find inspiration": { intent: ["inspiration", "creativity"] },
  "To learn": { intent: ["learning", "knowledge"] },
  "To reflect": { intent: ["self-reflection", "introspection"] },
  "To explore": { intent: ["exploration", "curiosity"] },
  "To experience something unexpected": { intent: ["surprise", "novelty"] },

  // Wants
  "New mindset": { goals: ["mindset shift", "new paradigm"] },
  "Peace and calm": { goals: ["peace of mind", "stillness"] },
  "Drive": { goals: ["drive", "energy"] },
  "Connection": { goals: ["empathy", "belonging"] },
  "Perspective shift": { goals: ["new perspective", "reframe"] },
  "Creativity": { goals: ["creative spark", "imagination"] },
  "Comfort and healing": { goals: ["emotional healing", "comfort"] },
  "Something good to read": { goals: ["enjoyment", "entertainment"] },
};

function extractSignals(answers: QuestionnaireAnswers): ProfileSignals {
  const signals: ProfileSignals = {
    themes: [],
    emotions: [],
    goals: [],
    readingIntent: [],
    contentPreferences: [],
  };

  const addMappings = (key: string) => {
    const normalizedKey = key.replace(/[^a-zA-Z\s]/g, '').trim();
    const mapping = QUESTIONNAIRE_OPTION_MAPPINGS[normalizedKey] || QUESTIONNAIRE_OPTION_MAPPINGS[key];
    if (mapping) {
      if (mapping.themes) signals.themes.push(...mapping.themes);
      if (mapping.emotions) signals.emotions.push(...mapping.emotions);
      if (mapping.goals) signals.goals.push(...mapping.goals);
      if (mapping.intent) signals.readingIntent.push(...mapping.intent);
      if (mapping.content) signals.contentPreferences.push(...mapping.content);
    }
  };

  if (answers.emotion) addMappings(answers.emotion);
  if (answers.lifeSituation) addMappings(answers.lifeSituation);
  if (answers.decisionStyle) addMappings(answers.decisionStyle);
  if (answers.currentNeed) addMappings(answers.currentNeed);
  answers.reasons?.forEach(addMappings);
  answers.wants?.forEach(addMappings);

  // Extract signals from freeText if present
  if (answers.freeText && answers.freeText.trim().length > 0) {
    const text = answers.freeText.toLowerCase();

    // Habits & consistency
    if (text.includes('habit') || text.includes('routine') || text.includes('consistent')) {
      signals.themes.push('habits', 'consistency', 'routines');
      signals.goals.push('better habits', 'consistency', 'build routines');
    }
    // Focus & productivity
    if (text.includes('focus') || text.includes('productivity') || text.includes('distraction') || text.includes('time management') || text.includes('waste time')) {
      signals.themes.push('productivity', 'focus', 'time management');
      signals.goals.push('improve focus', 'stop procrastinating', 'manage time');
    }
    // Money & finance
    if (text.includes('money') || text.includes('financ') || text.includes('wealth') || text.includes('invest')) {
      signals.themes.push('finance', 'money', 'wealth');
      signals.goals.push('financial awareness', 'money mindset');
    }
    // Meaning & existential
    if (text.includes('meaning') || text.includes('purpose') || text.includes('lost') || text.includes('existential') || text.includes('direction')) {
      signals.themes.push('meaning', 'purpose', 'direction');
      signals.goals.push('find purpose', 'meaning of life');
    }
    // Confidence & resilience
    if (text.includes('confidence') || text.includes('believe in myself') || text.includes('resilience') || text.includes('stronger mentally')) {
      signals.themes.push('confidence', 'resilience', 'mental toughness');
      signals.goals.push('build confidence', 'develop mental toughness');
    }
    // Practical content preference
    if (text.includes('practical') || text.includes('actionable') || text.includes('apply immediately') || text.includes('actually do')) {
      signals.contentPreferences.push('practical', 'actionable');
    }
    // Philosophical content preference
    if (text.includes('philosophical') || text.includes('deep') || text.includes('question life')) {
      if (!text.includes("don't want") && !text.includes('not')) {
        signals.contentPreferences.push('philosophical', 'deep');
      }
    }
  }

  // Deduplicate
  return {
    themes: [...new Set(signals.themes)],
    emotions: [...new Set(signals.emotions)],
    goals: [...new Set(signals.goals)],
    readingIntent: [...new Set(signals.readingIntent)],
    contentPreferences: [...new Set(signals.contentPreferences)],
  };
}

export function buildUserProfile(answers: QuestionnaireAnswers): UserDiscoveryProfile {
  // Normalize previously read books
  const readBooksStr = answers.readBooks || "";
  let previouslyRead: string[] = [];
  
  if (readBooksStr.trim().toLowerCase() !== 'none' && readBooksStr.trim() !== '') {
    previouslyRead = readBooksStr
      .split(/\n|,/)
      .map(b => b.trim())
      .filter(b => b.length > 0)
      .filter(b => b.toLowerCase() !== 'none');
  }
  
  // Deduplicate previously read
  previouslyRead = [...new Set(previouslyRead)];

  return {
    bookType: answers.bookType || "",
    previouslyRead,
    readingReasons: answers.reasons || [],
    desiredOutcomes: answers.wants || [],
    emotionalState: answers.emotion || "",
    lifeSituation: answers.lifeSituation || "",
    problemSolvingStyle: answers.decisionStyle || "",
    quantity: parseInt(answers.bookQuantity) || 1,
    freeText: answers.freeText || "",
    semanticQuery: "", // Will be filled by queryBuilder
    profileSignals: extractSignals(answers)
  };
}

import { UserDiscoveryProfile } from "../types/bookDiscovery";

export function generateSemanticQuery(profile: UserDiscoveryProfile): string {
  const parts: string[] = [];

  // 1. Raw user words front-and-center if provided
  if (profile.freeText && profile.freeText.trim().length > 0) {
    parts.push(profile.freeText.trim());
  }

  // 2. Desired category / type
  if (profile.bookType) {
    parts.push(`Looking for a ${profile.bookType} book.`);
  }

  // 3. Extracted key goals & themes
  if (profile.profileSignals?.goals && profile.profileSignals.goals.length > 0) {
    parts.push(`Goals: ${profile.profileSignals.goals.join(", ")}.`);
  }

  // 4. Desired outcomes & reading reasons
  if (profile.desiredOutcomes && profile.desiredOutcomes.length > 0) {
    parts.push(`Wants: ${profile.desiredOutcomes.join(", ")}.`);
  }
  if (profile.readingReasons && profile.readingReasons.length > 0) {
    parts.push(`Reading to ${profile.readingReasons.join(" and ")}.`);
  }

  // 5. Emotional state & life situation context
  if (profile.emotionalState || profile.lifeSituation) {
    const emotion = (profile.emotionalState || '').replace(/[^a-zA-Z\s]/g, '').trim();
    const situation = (profile.lifeSituation || '').replace(/[^a-zA-Z\s]/g, '').trim();
    if (emotion && situation) {
      parts.push(`Feeling ${emotion} while dealing with ${situation}.`);
    } else if (emotion) {
      parts.push(`Currently feeling ${emotion}.`);
    } else if (situation) {
      parts.push(`Navigating ${situation}.`);
    }
  }

  // 6. Content preference (practical vs philosophical)
  if (profile.profileSignals?.contentPreferences && profile.profileSignals.contentPreferences.length > 0) {
    parts.push(`Prefers ${profile.profileSignals.contentPreferences.join(", ")} style.`);
  }

  return parts.join(" ").trim();
}

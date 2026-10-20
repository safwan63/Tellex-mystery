import { CandidateBook } from "../types/bookDiscovery";

function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

export function filterExcludedBooks(candidates: CandidateBook[], excludedTitles: string[]): CandidateBook[] {
  if (!excludedTitles || excludedTitles.length === 0) return candidates;

  const normalizedExclusions = excludedTitles.map(normalizeString).filter(s => s.length > 0);

  return candidates.filter(book => {
    const normalizedBookTitle = normalizeString(book.title);
    
    // Check if the book title matches any of the excluded titles
    const isExcluded = normalizedExclusions.some(excluded => {
      // Exact match or if one string is fully contained within the other
      return normalizedBookTitle === excluded || 
             normalizedBookTitle.includes(excluded) || 
             excluded.includes(normalizedBookTitle);
    });

    return !isExcluded;
  });
}

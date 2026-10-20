import { CandidateBook } from "../types/bookDiscovery";

export async function executeSemanticSearch(query: string): Promise<CandidateBook[]> {
  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to execute semantic search');
    }

    const data = await response.json();
    return data.results as CandidateBook[];
  } catch (error) {
    console.error("Error calling semantic search API:", error);
    throw error;
  }
}

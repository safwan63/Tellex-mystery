import React, { useState } from 'react';
import { Book as BookType } from '../types/book';
import { normalizedToMatchOutOf10, matchScoreColor } from '../utils/matchScore';

export default function SemanticTest() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{id: string, title: string, similarity: number, data: BookType}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to search');
      }

      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-[#0E462B] mb-8" style={{ fontFamily: "'Playfair Display', serif" }}>
          Semantic Search Test Interface
        </h1>
        
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-4">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="E.g., 'I want a book about building good habits' or 'A book for someone going through a tough breakup'"
              className="flex-1 p-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0E462B]"
            />
            <button 
              type="submit"
              disabled={loading}
              className="px-8 py-4 bg-[#0E462B] text-white rounded-xl font-bold hover:bg-[#0a3320] disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-8">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="space-y-4">
          {results.map((result) => {
            const matchOutOf10 = normalizedToMatchOutOf10(result.similarity);
            const color = matchScoreColor(matchOutOf10);
            return (
            <div key={result.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex gap-6">
              <img src={result.data.cover_url} alt={result.title} className="w-24 h-36 object-cover rounded shadow" />
              <div>
                <div className="flex items-center gap-4 mb-2 flex-wrap">
                  <h2 className="text-xl font-bold text-[#0E462B]">{result.title}</h2>
                  <span
                    className="text-sm font-black tabular-nums px-2 py-1 rounded-full bg-gray-50 border border-gray-100"
                    style={{ color }}
                  >
                    {matchOutOf10.toFixed(1)}<span className="text-xs font-medium text-gray-400">/10</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 ml-1.5">Match</span>
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-2">by {result.data.author}</p>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Vibe:</strong> {result.data.ai_metadata?.tellex_vibe_tags?.join(', ') || 'N/A'}</p>
                  <p><strong>Themes:</strong> {result.data.ai_metadata?.main_themes || 'N/A'}</p>
                </div>
              </div>
            </div>
            );
          })}
          {results.length === 0 && !loading && !error && (
            <p className="text-gray-500 text-center py-12">No results yet. Enter a query above to test the semantic search.</p>
          )}
        </div>
      </div>
    </div>
  );
}

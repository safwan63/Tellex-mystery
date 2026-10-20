/**
 * TELLEX Phase 5 — Recommendation Test Suite
 * Developer tool at /recommend-test
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

const TEST_PROFILES = [
  {
    id: 'Test A',
    label: 'Habits',
    description: "I keep starting good habits but can't stay consistent. I want something practical.",
    answers: { emotion: 'Frustrated', lifeSituation: 'Working toward a goal', decisionStyle: 'Take action quickly', currentNeed: 'Motivation', reasons: ['To learn'], wants: ['New mindset', 'Motivation'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3', freeText: "I keep starting good habits but can't stay consistent. I want something practical." },
    expected: 'Atomic Habits should be #1 with calibrated score > 9.0/10.',
  },
  {
    id: 'Test B',
    label: 'Productivity',
    description: "I struggle to focus and waste too much time on unimportant things.",
    answers: { emotion: 'Frustrated', lifeSituation: 'Working toward a goal', decisionStyle: 'Take action quickly', currentNeed: 'Clarity', reasons: ['To learn'], wants: ['New mindset', 'Motivation'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3', freeText: "I struggle to focus and waste too much time on unimportant things." },
    expected: 'The One Thing or Deep Work leading candidates in focus and productivity.',
  },
  {
    id: 'Test C',
    label: 'Money',
    description: 'I want to understand money better and make smarter financial decisions.',
    answers: { emotion: 'Anxious', lifeSituation: 'Working toward a goal', decisionStyle: 'Think deeply and analyze', currentNeed: 'Clarity', reasons: ['To learn'], wants: ['New mindset', 'Perspective shift'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3', freeText: 'I want to understand money better and make smarter financial decisions.' },
    expected: 'The Psychology of Money should be #1 leading candidate with score > 9.0/10.',
  },
  {
    id: 'Test D',
    label: 'Meaning',
    description: 'I feel lost and want to understand the meaning of life.',
    answers: { emotion: 'Empty', lifeSituation: 'Feeling stuck or confused', decisionStyle: 'Think deeply and analyze', currentNeed: 'Clarity', reasons: ['To reflect'], wants: ['Perspective shift', 'New mindset'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3', freeText: "I feel lost and want to understand the meaning of life." },
    expected: "Man's Search for Meaning should be a leading candidate with score > 9.0/10.",
  },
  {
    id: 'Test E',
    label: 'Practicality preference',
    description: "I want a practical book with actions I can apply immediately. I don't want something overly philosophical.",
    answers: { emotion: 'Frustrated', lifeSituation: 'Working toward a goal', decisionStyle: 'Take action quickly', currentNeed: 'Motivation', reasons: ['To learn'], wants: ['Motivation'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3', freeText: "I want a practical book with actions I can apply immediately. I don't want something overly philosophical." },
    expected: 'Highly practical books favored (Atomic Habits, Think and Grow Rich); philosophical penalized.',
  },
  {
    id: 'Test F',
    label: 'Philosophical preference',
    description: 'I want a deep, philosophical book that makes me think about life.',
    answers: { emotion: 'Empty', lifeSituation: 'Feeling stuck or confused', decisionStyle: 'Think deeply and analyze', currentNeed: 'Clarity', reasons: ['To reflect', 'To explore'], wants: ['Perspective shift'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3', freeText: 'I want a deep, philosophical book that makes me think about life.' },
    expected: 'Philosophical depth books (The Power of Now, Man\'s Search for Meaning) rank highest.',
  },
  {
    id: 'Test G',
    label: 'Unrelated query (Astrophysics)',
    description: 'I want to learn advanced astrophysics.',
    answers: { emotion: 'Hopeful', lifeSituation: 'Seeking personal growth', decisionStyle: 'Think deeply and analyze', currentNeed: 'Clarity', reasons: ['To learn'], wants: ['New mindset'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3', freeText: 'I want to learn advanced astrophysics and quantum mechanics.' },
    expected: 'No book should score 9+. Low scores (< 5.0) and honest catalog mismatch notice.',
  },
  {
    id: 'Test H',
    label: 'Broad query',
    description: 'I want to improve myself.',
    answers: { emotion: 'Hopeful', lifeSituation: 'Seeking personal growth', decisionStyle: 'Take action quickly', currentNeed: 'Motivation', reasons: ['To learn', 'To find inspiration'], wants: ['New mindset', 'Motivation'], bookType: 'Self-help / Mindset', readBooks: 'None', bookQuantity: '3', freeText: 'I want to improve myself.' },
    expected: 'Moderate scores (7–8.5/10), no artificial 9.5 without strong specific evidence.',
  },
];

interface TestResult {
  profileId: string;
  status: 'idle' | 'running' | 'done' | 'error';
  recommendations?: any[];
  error?: string;
  durationMs?: number;
  isUnrelated?: boolean;
  message?: string;
}

// ─── Score Badge Component ────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number | undefined | null }) {
  if (score == null) return null;

  const color =
    score >= 9.0 ? '#0E462B' :
    score >= 8.0 ? '#2d6a4f' :
    score >= 7.0 ? '#52796f' :
    score >= 5.0 ? '#b45309' :
    '#dc2626';

  const label =
    score >= 9.5 ? 'Exceptional' :
    score >= 9.0 ? 'Very Strong' :
    score >= 8.0 ? 'Strong' :
    score >= 7.0 ? 'Good' :
    score >= 5.0 ? 'Moderate' :
    'Weak';

  const barPct = `${(score / 10) * 100}%`;

  return (
    <div className="flex items-center gap-2">
      <span className="text-base font-black tabular-nums" style={{ color }}>
        {score.toFixed(1)}
        <span className="text-xs font-medium text-gray-400">/10</span>
      </span>
      <div className="flex items-center gap-1.5">
        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: barPct, backgroundColor: color }} />
        </div>
        <span className="text-xs font-medium" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

// ─── Scoring Breakdown ────────────────────────────────────────────────────────
function ScoringBreakdown({ scoring }: { scoring: any }) {
  if (!scoring) return null;
  const factors = [
    { label: 'Semantic', value: (scoring.semantic * 10).toFixed(1) },
    { label: 'Topic', value: (scoring.topic * 10).toFixed(1) },
    { label: 'Style', value: (scoring.style * 10).toFixed(1) },
    { label: 'Emot', value: (scoring.emot * 10).toFixed(1) },
    { label: 'Sit', value: (scoring.sit * 10).toFixed(1) },
    { label: 'Penalty', value: scoring.penalty ? `-${(scoring.penalty * 10).toFixed(1)}` : '0.0', isNeg: !!scoring.penalty },
  ];
  return (
    <div className="mt-2 grid grid-cols-6 gap-1 bg-gray-50 p-2 rounded-lg border border-gray-100">
      {factors.map(f => (
        <div key={f.label} className="text-center">
          <div className={`text-xs font-bold ${f.isNeg ? 'text-red-500' : 'text-gray-700'}`}>{f.value}</div>
          <div className="text-[10px] text-gray-400">{f.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RecommendTest() {
  const navigate = useNavigate();
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showBreakdown, setShowBreakdown] = useState<Record<string, boolean>>({});
  const [runningAll, setRunningAll] = useState(false);

  async function runTest(profileId: string) {
    const test = TEST_PROFILES.find(t => t.id === profileId)!;
    setResults(r => ({ ...r, [profileId]: { profileId, status: 'running' } }));
    const start = Date.now();
    try {
      const { processBookDiscovery } = await import('../services/bookDiscovery');
      const result = await processBookDiscovery(test.answers as any);
      setResults(r => ({
        ...r,
        [profileId]: {
          profileId,
          status: 'done',
          recommendations: result.recommendations,
          isUnrelated: result.isUnrelated,
          message: result.message,
          durationMs: Date.now() - start
        }
      }));
    } catch (e: any) {
      setResults(r => ({ ...r, [profileId]: { profileId, status: 'error', error: e.message, durationMs: Date.now() - start } }));
    }
  }

  async function runAll() {
    setRunningAll(true);
    for (const test of TEST_PROFILES) await runTest(test.id);
    setRunningAll(false);
  }

  const statusColor = (s?: string) =>
    s === 'running' ? 'text-yellow-600 bg-yellow-50' :
    s === 'done'    ? 'text-green-700 bg-green-50' :
    s === 'error'   ? 'text-red-600 bg-red-50' :
    'text-gray-500 bg-gray-50';

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <header className="p-4 sm:p-6 flex items-center gap-4 max-w-5xl mx-auto">
        <button onClick={() => navigate('/dashboard')} className="p-2 text-[#0E462B] hover:bg-black/5 rounded-full">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#0E462B]" style={{ fontFamily: "'Playfair Display', serif" }}>
            Phase 5 — Recommendation Test Suite
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">8 evaluation test cases with score calibration & explanations</p>
        </div>
        <div className="ml-auto">
          <button onClick={runAll} disabled={runningAll} className="px-5 py-2.5 bg-[#0E462B] text-white rounded-xl font-bold text-sm hover:bg-[#0a3320] disabled:opacity-50 flex items-center gap-2">
            <Play size={14} />
            {runningAll ? 'Running…' : 'Run All 8 Tests'}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 space-y-4">
        {TEST_PROFILES.map(test => {
          const r = results[test.id];
          const isExpanded = expanded[test.id];
          const top1Score = r?.recommendations?.[0]?._displayScore;
          return (
            <div key={test.id} className="bg-white rounded-2xl border border-[#E5E5E0] shadow-sm overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-3 p-4 sm:p-5">
                <span className="text-xs font-bold bg-[#0E462B]/10 text-[#0E462B] px-2 py-1 rounded-lg flex-shrink-0">{test.id}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800">{test.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5 truncate">{test.description}</p>
                </div>
                {/* Top-1 score preview */}
                {top1Score != null && <ScoreBadge score={top1Score} />}
                <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${statusColor(r?.status)}`}>
                  {r?.status || 'idle'}{r?.durationMs ? ` (${(r.durationMs / 1000).toFixed(1)}s)` : ''}
                </span>
                <button onClick={() => runTest(test.id)} disabled={r?.status === 'running'} className="p-2 text-[#0E462B] hover:bg-[#0E462B]/10 rounded-full disabled:opacity-40 flex-shrink-0">
                  <Play size={16} />
                </button>
                <button onClick={() => setExpanded(e => ({ ...e, [test.id]: !e[test.id] }))} className="p-2 text-gray-500 hover:bg-gray-50 rounded-full flex-shrink-0">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              </div>

              {/* Expected */}
              <div className="px-5 pb-3 text-xs text-gray-500 border-t border-gray-50">
                <span className="font-semibold text-gray-600">Expected: </span>{test.expected}
              </div>

              {/* Results */}
              {isExpanded && r?.status === 'done' && (
                <div className="border-t border-[#E5E5E0] p-5 space-y-3 bg-gray-50/50">
                  {/* Unrelated notice banner if present */}
                  {r.isUnrelated && r.message && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
                      <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
                      <div>
                        <p className="font-bold text-amber-900 text-xs">Catalog Notice</p>
                        <p className="text-amber-800 text-xs mt-0.5">{r.message}</p>
                      </div>
                    </div>
                  )}

                  {(!r.recommendations || r.recommendations.length === 0) && (
                    <p className="text-gray-500 text-sm">No recommendations returned.</p>
                  )}

                  {r.recommendations?.map((rec: any) => (
                    <div key={rec.book_id} className="bg-white rounded-xl border border-[#E5E5E0] overflow-hidden">
                      <div className="p-4 flex gap-4">
                        <img src={rec.cover_url} alt={rec.title} className="w-12 h-16 object-cover rounded shadow flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-xs font-bold bg-[#0E462B] text-white px-2 py-0.5 rounded">Rank {rec.rank}</span>
                            <ScoreBadge score={rec._displayScore} />
                          </div>
                          <p className="font-bold text-gray-800 text-sm">{rec.title}</p>
                          <p className="text-gray-500 text-xs mb-2">by {rec.author}</p>
                          {rec.explanation && <p className="text-xs text-gray-700 italic bg-gray-50 p-2 rounded-lg border border-gray-100">"{rec.explanation}"</p>}
                          <button
                            onClick={() => setShowBreakdown(b => ({ ...b, [`${test.id}-${rec.book_id}`]: !b[`${test.id}-${rec.book_id}`] }))}
                            className="text-[10px] text-[#0E462B] mt-2 font-medium hover:underline block"
                          >
                            {showBreakdown[`${test.id}-${rec.book_id}`] ? '▲ Hide factor breakdown' : '▼ Show factor breakdown'}
                          </button>
                          {showBreakdown[`${test.id}-${rec.book_id}`] && <ScoringBreakdown scoring={rec._scoring} />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isExpanded && r?.status === 'error' && (
                <div className="border-t border-red-100 bg-red-50 p-4">
                  <p className="text-red-600 text-sm font-mono">{r.error}</p>
                </div>
              )}

              {isExpanded && (!r || r.status === 'idle') && (
                <div className="border-t border-gray-100 p-4 text-gray-400 text-sm text-center">
                  Click ▶ to run this test
                </div>
              )}

              {isExpanded && r?.status === 'running' && (
                <div className="border-t border-yellow-100 bg-yellow-50 p-4 text-yellow-700 text-sm text-center animate-pulse">
                  Running recommendation engine…
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}

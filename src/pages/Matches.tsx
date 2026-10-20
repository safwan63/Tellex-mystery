import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag, BookOpen, RotateCcw, AlertCircle } from 'lucide-react';
import { RecommendationResult, Recommendation } from '../types/bookDiscovery';
import UserAvatar from '../components/UserAvatar';

// ─── Score Badge ─────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number | undefined | null }) {
  if (score == null) return null;

  const color =
    score >= 9.0 ? '#0E462B' :
    score >= 8.0 ? '#2d6a4f' :
    score >= 7.0 ? '#52796f' :
    score >= 5.0 ? '#b45309' :
    '#dc2626';

  const label =
    score >= 9.5 ? 'Exceptional match' :
    score >= 9.0 ? 'Very strong match' :
    score >= 8.0 ? 'Strong match' :
    score >= 7.0 ? 'Good match' :
    score >= 5.0 ? 'Moderate match' :
    'Weak match';

  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-black tabular-nums" style={{ color }}>
        {score.toFixed(1)}
        <span className="text-sm font-medium text-gray-400">/10</span>
      </span>
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}18`, color }}>
        {label}
      </span>
    </div>
  );
}

// ─── Recommendation Card ──────────────────────────────────────────────────────
function RecommendationCard({ rec, index }: { rec: Recommendation; index: number }) {
  const rankLabels = ['Top Pick', 'Second Pick', 'Third Pick'];
  const rankColors = ['bg-[#0E462B] text-white', 'bg-[#3a7a54] text-white', 'bg-[#6aaa88] text-white'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.15 }}
      className="bg-white rounded-3xl overflow-hidden border border-[#E5E5E0] shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex flex-col md:flex-row">
        {/* Cover */}
        <div className="w-full md:w-[240px] flex-shrink-0 bg-[#e1cfbc] flex items-center justify-center p-8 relative min-h-[220px]">
          <span className={`absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full ${rankColors[index] || rankColors[2]}`}>
            {rankLabels[index] || `Pick ${index + 1}`}
          </span>
          <img
            src={rec.cover_url}
            alt={rec.title}
            className="w-3/4 max-w-[180px] shadow-2xl rounded object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between gap-5">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0E462B] mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
              {rec.title}
            </h2>
            <p className="text-gray-500 font-medium text-sm mb-3">by {rec.author}</p>

            {/* Match score */}
            {rec._displayScore != null && (
              <div className="mb-4">
                <ScoreBadge score={rec._displayScore} />
              </div>
            )}

            {/* Personalized Explanation */}
            {rec.explanation && (
              <div className="bg-[#0E462B]/5 border-l-4 border-[#0E462B] rounded-r-xl p-4 mb-4">
                <p className="text-sm font-semibold text-[#0E462B] mb-1 uppercase tracking-wider">Why it fits you</p>
                <p className="text-gray-700 text-sm leading-relaxed italic">"{rec.explanation}"</p>
              </div>
            )}

            {/* Description */}
            {rec.description && (
              <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">{rec.description}</p>
            )}

            {/* Vibe tags */}
            {rec.ai_metadata?.tellex_vibe_tags && (
              <div className="flex flex-wrap gap-2 mt-4">
                {rec.ai_metadata.tellex_vibe_tags.slice(0, 4).map((tag: string) => (
                  <span key={tag} className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Purchase links */}
          <div className="flex flex-wrap gap-3 pt-2">
            {rec.physical_purchase_url && (
              <a
                href={rec.physical_purchase_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0E462B] text-white text-sm font-semibold rounded-xl hover:bg-[#0a3320] transition-colors shadow-sm"
              >
                <ShoppingBag size={15} />
                Buy Physical
              </a>
            )}
            {rec.ebook_purchase_url && (
              <a
                href={rec.ebook_purchase_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#0E462B] text-sm font-semibold rounded-xl border-2 border-[#0E462B] hover:bg-[#0E462B]/5 transition-colors"
              >
                <BookOpen size={15} />
                Get eBook
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Matches() {
  const location = useLocation();
  const navigate = useNavigate();

  const result = location.state?.result as RecommendationResult | null;
  if (!result) return <Navigate to="/dashboard" replace />;

  const { recommendations, isUnrelated, message } = result;

  return (
    <div className="min-h-[100svh] bg-[#FAF9F6] flex flex-col">
      {/* Header */}
      <header className="p-4 sm:p-6 flex items-center justify-between max-w-4xl mx-auto w-full">
        <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 text-[#0E462B] hover:bg-black/5 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <span className="text-xs sm:text-sm font-bold tracking-widest text-[#0E462B] bg-[#0E462B]/10 px-3 py-1 rounded-full uppercase">
          Your Picks
        </span>
        <UserAvatar />
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 pb-20">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-[#0E462B] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            {isUnrelated ? "Catalog Notice" : "Based on what you told us…"}
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto leading-relaxed">
            {isUnrelated
              ? "We couldn't find a direct match in our current catalog for this specific topic."
              : "These books were chosen specifically for your current mood, situation, and what you're looking for right now."}
          </p>
        </motion.div>

        {/* Unrelated notice banner */}
        {isUnrelated && message && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex items-start gap-4">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-amber-900 text-sm mb-1">Catalog Limitation</p>
              <p className="text-amber-800 text-sm leading-relaxed">{message}</p>
            </div>
          </div>
        )}

        {(!recommendations || recommendations.length === 0) ? (
          <div className="bg-white p-12 rounded-3xl text-center border border-[#E5E5E0] shadow-sm">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">No strong matches found right now</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">We couldn't find a suitable match. Try changing a few preferences and search again.</p>
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 px-8 py-3 bg-[#0E462B] text-white rounded-xl font-bold hover:bg-[#0a3320] transition-colors">
              <RotateCcw size={16} />
              Try Again
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {recommendations.map((rec, idx) => (
              <RecommendationCard key={rec.book_id || idx} rec={rec} index={idx} />
            ))}
          </div>
        )}

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          className="text-center text-xs text-gray-400 mt-10 max-w-md mx-auto"
        >
          Recommendations are based on your answers and may not be a perfect fit for everyone.
        </motion.p>
      </main>
    </div>
  );
}

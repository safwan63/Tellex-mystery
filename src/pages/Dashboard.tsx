import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Book, Sparkles, Search } from 'lucide-react';
import UserAvatar from '../components/UserAvatar';

// Prefetch the Flow page chunk as soon as Dashboard loads
const prefetchFlow = () => import('./Flow');

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  // Prefetch Flow chunk in idle time so navigation is instant
  useEffect(() => {
    const id = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback(() => prefetchFlow())
      : setTimeout(() => prefetchFlow(), 200);
    return () => {
      if (typeof cancelIdleCallback !== 'undefined') cancelIdleCallback(id as number);
      else clearTimeout(id as number);
    };
  }, []);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0E462B]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Top Nav for Dashboard */}
      <header className="bg-white border-b border-[#E5E5E0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold text-[#0E462B]" style={{ fontFamily: "'Playfair Display', serif" }}>
              Tellex
            </Link>
            <UserAvatar />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Delivery Banner */}
        <div className="bg-[#e1cfbc]/30 border border-[#e1cfbc] text-[#0E462B] text-sm sm:text-base font-medium text-center py-3 px-4 rounded-xl mb-12 max-w-4xl mx-auto flex items-center justify-center gap-2 shadow-sm">
          <span role="img" aria-label="package">📦</span>
          <span>Currently, delivery is available only in <span className="font-bold border-b border-[#0E462B]">India</span></span>
        </div>

        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0E462B] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Welcome back.
          </h2>
          <p className="text-gray-600 text-lg">Your next chapter awaits.</p>
        </div>

        <div className="flex justify-center max-w-md mx-auto">
          {/* Mystery Pick Card */}
          <div className="bg-white rounded-2xl p-8 border border-[#0E462B]/10 shadow-lg hover:shadow-xl transition-shadow flex flex-col w-full">
            <div className="w-14 h-14 bg-[#0E462B] rounded-xl flex items-center justify-center mb-6">
              <Sparkles className="text-[#e1cfbc]" size={28} />
            </div>
            <h3 className="text-2xl font-bold text-[#0E462B] mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
              Mystery Pick
            </h3>
            <p className="text-gray-600 mb-6 flex-grow">
              Share your mood and vibe. We'll hand-select a secret book tailored to your emotional state and deliver it to your door.
            </p>
            <div className="flex flex-col gap-3">
              <Link 
                to="/flow?type=mystery"
                className="inline-flex justify-center items-center w-full py-3.5 px-4 rounded-lg bg-[#0E462B] text-[#e1cfbc] font-medium hover:bg-[#0E462B]/90 transition-colors shadow-sm"
              >
                Reveal my pick
              </Link>
              <Link 
                to="/books"
                className="inline-flex justify-center items-center w-full py-3.5 px-4 rounded-lg border-2 border-[#0E462B] text-[#0E462B] font-medium hover:bg-[#0E462B]/5 transition-colors shadow-sm gap-2"
              >
                <Search size={18} /> Search my pick
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

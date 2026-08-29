import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Book } from '../types/book';
import { getBookById } from '../services/bookService';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { ArrowLeft, BookOpen, ShoppingBag, Loader2, Target, Zap, Heart, BrainCircuit } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BookDetails() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBook = async () => {
      try {
        if (!id) return;
        const fetchedBook = await getBookById(id);
        if (fetchedBook) {
          setBook(fetchedBook);
        } else {
          setError('Book not found.');
        }
      } catch (err) {
        setError('Failed to load book details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchBook();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAF9F6]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-[#0E462B]">
          <Loader2 className="w-12 h-12 animate-spin mb-4" />
          <p className="font-medium text-lg">Loading book details...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAF9F6]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="bg-red-50 text-red-600 p-8 rounded-2xl text-center max-w-lg border border-red-100">
            <h2 className="text-2xl font-bold mb-2">Oops!</h2>
            <p className="font-medium mb-6">{error}</p>
            <Link to="/books" className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">
              Return to Catalog
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6]">
      <Navbar />
      
      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <Link to="/books" className="inline-flex items-center text-gray-500 hover:text-[#0E462B] font-medium mb-8 transition-colors">
          <ArrowLeft size={20} className="mr-2" /> Back to Catalog
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Image & Purchasing */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-4 space-y-6"
          >
            <div className="bg-white p-6 rounded-3xl border border-[#E5E5E0] shadow-md flex items-center justify-center">
              <img 
                src={book.cover_url} 
                alt={`Cover of ${book.title}`} 
                className="w-full max-w-[280px] h-auto object-contain drop-shadow-xl rounded-sm"
              />
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-[#E5E5E0] shadow-sm space-y-4">
              <h3 className="font-bold text-gray-900 text-lg mb-2 border-b pb-2">Get Your Copy</h3>
              
              {book.physical_purchase_url && book.physical_purchase_url !== 'Not available' ? (
                <a 
                  href={book.physical_purchase_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-[#0E462B] text-[#e1cfbc] rounded-xl hover:bg-[#0E462B]/90 transition-all font-bold shadow-sm"
                >
                  <ShoppingBag size={18} />
                  Buy Physical Book
                </a>
              ) : (
                <div className="w-full text-center px-4 py-3.5 bg-gray-100 text-gray-400 rounded-xl font-bold">
                  Physical Not Available
                </div>
              )}

              {book.ebook_purchase_url && book.ebook_purchase_url !== 'Not available' ? (
                <a 
                  href={book.ebook_purchase_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 border-2 border-[#0E462B] text-[#0E462B] rounded-xl hover:bg-[#0E462B]/5 transition-all font-bold"
                >
                  <BookOpen size={18} />
                  Buy E-book
                </a>
              ) : (
                <div className="w-full text-center px-4 py-3.5 border-2 border-gray-200 text-gray-400 rounded-xl font-bold">
                  E-book Not Available
                </div>
              )}
            </div>
          </motion.div>

          {/* Right Column: Details */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-8 space-y-8"
          >
            <div>
              <div className="inline-block px-4 py-1.5 bg-[#0E462B]/10 text-[#0E462B] rounded-full font-bold text-xs uppercase tracking-wider mb-4">
                {book.category} • {book.subcategory}
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2 leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                {book.title}
              </h1>
              <p className="text-xl text-gray-600 font-medium">By {book.author}</p>
            </div>

            <div className="prose prose-lg text-gray-600">
              <p>{book.description}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Target & Problems */}
              <div className="bg-white p-6 rounded-2xl border border-[#E5E5E0]">
                <h3 className="flex items-center text-lg font-bold text-[#0E462B] mb-4">
                  <Target className="w-5 h-5 mr-2" /> Who is this for?
                </h3>
                <p className="text-gray-700 text-sm mb-4 capitalize">{book.target_audience}</p>
                
                <h4 className="text-sm font-bold text-gray-900 mb-2 mt-4">Solves these problems:</h4>
                <ul className="space-y-1">
                  {book.problems_addressed.map((prob, idx) => (
                    <li key={idx} className="text-sm text-gray-600 flex items-start">
                      <span className="text-red-400 mr-2">•</span> <span className="capitalize">{prob}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Goals & Outcomes */}
              <div className="bg-[#0E462B] p-6 rounded-2xl shadow-md text-[#e1cfbc]">
                <h3 className="flex items-center text-lg font-bold mb-4">
                  <Zap className="w-5 h-5 mr-2 text-yellow-400" /> What you'll achieve
                </h3>
                <ul className="space-y-2">
                  {book.user_goals.map((goal, idx) => (
                    <li key={idx} className="text-sm flex items-start">
                      <span className="text-yellow-400 mr-2">✓</span> <span className="capitalize">{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Deep Metadata */}
            <div className="bg-white p-6 rounded-2xl border border-[#E5E5E0]">
              <h3 className="flex items-center text-lg font-bold text-gray-900 mb-4 border-b pb-2">
                <BrainCircuit className="w-5 h-5 mr-2 text-indigo-500" /> Deep Dive Profile
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Themes</span>
                  <div className="flex flex-wrap gap-2">
                    {book.themes.map((theme, i) => (
                      <span key={i} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-md capitalize">{theme}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Topics</span>
                  <div className="flex flex-wrap gap-2">
                    {book.topics.map((topic, i) => (
                      <span key={i} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-md capitalize">{topic}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Emotional Tone</span>
                  <span className="text-sm font-medium text-gray-700 capitalize">{book.emotional_tone}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Reading Style</span>
                  <span className="text-sm font-medium text-gray-700 capitalize">{book.reading_style}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Difficulty</span>
                  <span className={`text-sm font-bold ${book.difficulty === 'Easy' ? 'text-green-600' : book.difficulty === 'Hard' ? 'text-red-600' : 'text-yellow-600'}`}>
                    {book.difficulty}
                  </span>
                </div>
              </div>
            </div>

          </motion.div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

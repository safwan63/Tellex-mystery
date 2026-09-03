import { useState, useEffect, useMemo } from 'react';
import { Book } from '../types/book';
import { getBooks } from '../services/bookService';
import BookCard from '../components/books/BookCard';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useSearchParams } from 'react-router-dom';
import { Search, BookX, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BookCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const fetchedBooks = await getBooks();
        setBooks(fetchedBooks);
      } catch (err: any) {
        setError(`Failed to load the book catalog: ${err.message || 'Unknown error'}. Please try again later.`);
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, []);

  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim()) return books;
    
    const query = searchQuery.toLowerCase().trim();
    
    return books.filter((book) => {
      const matchFields = [
        book.title,
        book.author,
        book.description,
        book.category,
        book.subcategory,
        ...(book.topics || []),
        ...(book.themes || []),
        ...(book.user_goals || []),
        ...(book.problems_addressed || []),
        ...(book.vibe_tags || [])
      ];
      
      return matchFields.some(field => 
        field && typeof field === 'string' && field.toLowerCase().includes(query)
      );
    });
  }, [books, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6]">
      <Navbar />
      
      <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Header & Search */}
        <div className="mb-12 text-center max-w-3xl mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-[#0E462B] mb-6"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Curated Library
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-gray-600 text-lg mb-8"
          >
            Discover books selected to transform your mindset, habits, and life.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative max-w-xl mx-auto"
          >
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-4 bg-white border-2 border-[#E5E5E0] rounded-2xl leading-5 bg-transparent placeholder-gray-500 focus:outline-none focus:border-[#0E462B] focus:ring-0 sm:text-md transition-colors shadow-sm"
              placeholder="Search by title, author, topic, or feeling (e.g. 'procrastination')"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value) {
                  setSearchParams({ q: e.target.value });
                } else {
                  setSearchParams({});
                }
              }}
            />
          </motion.div>
        </div>

        {/* Content State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#0E462B]">
            <Loader2 className="w-12 h-12 animate-spin mb-4" />
            <p className="font-medium text-lg">Loading curated books...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-6 rounded-2xl text-center max-w-lg mx-auto border border-red-100">
            <p className="font-medium">{error}</p>
          </div>
        ) : filteredBooks.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 bg-white rounded-3xl border border-[#E5E5E0] shadow-sm max-w-2xl mx-auto"
          >
            <BookX className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No books found</h3>
            <p className="text-gray-500">
              We couldn't find any books matching "{searchQuery}".<br/>
              Try exploring different keywords like "habits", "success", or "mindfulness".
            </p>
            <button 
              onClick={() => {
                setSearchQuery('');
                setSearchParams({});
              }}
              className="mt-6 px-6 py-2 bg-[#0E462B]/10 text-[#0E462B] font-semibold rounded-lg hover:bg-[#0E462B]/20 transition-colors"
            >
              Clear Search
            </button>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
          >
            {filteredBooks.map((book) => (
              <BookCard key={book.book_id} book={book} />
            ))}
          </motion.div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}

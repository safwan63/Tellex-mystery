import { Link } from 'react-router-dom';
import { Book } from '../../types/book';
import { BookOpen, ExternalLink, ShoppingBag } from 'lucide-react';

interface BookCardProps {
  book: Book;
}

const BookCard = ({ book }: BookCardProps) => {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E0] shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col h-full">
      <div className="relative h-64 bg-[#FDFCF7] flex items-center justify-center p-4 border-b border-[#E5E5E0]">
        <img 
          src={book.cover_url} 
          alt={`Cover of ${book.title}`} 
          className="h-full object-contain drop-shadow-md"
          loading="lazy"
        />
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-200">
          <span className="text-[11px] font-bold text-[#0E462B] uppercase tracking-wider">{book.category}</span>
        </div>
      </div>
      
      <div className="p-6 flex flex-col flex-1">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900 mb-1 leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            {book.title}
          </h3>
          <p className="text-sm font-medium text-gray-500">{book.author}</p>
        </div>
        
        <p className="text-sm text-gray-600 mb-6 line-clamp-3 flex-1">
          {book.description}
        </p>
        
        <div className="space-y-3 mt-auto">
          {/* Physical Book Purchase */}
          {book.physical_purchase_url && book.physical_purchase_url !== 'Not available' ? (
            <a 
              href={book.physical_purchase_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0E462B] text-[#e1cfbc] rounded-xl hover:bg-[#0E462B]/90 transition-colors font-medium text-sm"
            >
              <ShoppingBag size={16} />
              Buy Physical Book
            </a>
          ) : (
            <div className="w-full text-center px-4 py-2.5 bg-gray-100 text-gray-400 rounded-xl font-medium text-sm">
              Physical Not Available
            </div>
          )}

          {/* E-book Purchase */}
          {book.ebook_purchase_url && book.ebook_purchase_url !== 'Not available' ? (
            <a 
              href={book.ebook_purchase_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-[#0E462B] text-[#0E462B] rounded-xl hover:bg-[#0E462B]/5 transition-colors font-medium text-sm"
            >
              <BookOpen size={16} />
              Buy E-book
            </a>
          ) : (
            <div className="w-full text-center px-4 py-2.5 border-2 border-gray-200 text-gray-400 rounded-xl font-medium text-sm">
              E-book Not Available
            </div>
          )}
          
          <Link 
            to={`/books/${book.book_id}`}
            className="w-full flex items-center justify-center gap-1.5 pt-2 text-[#0E462B] hover:text-[#0E462B]/80 font-bold text-sm tracking-wide uppercase transition-colors"
          >
            View Details <ExternalLink size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BookCard;

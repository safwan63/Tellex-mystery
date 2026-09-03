import { useState, useEffect } from 'react';
import { Menu, X, ShoppingCart, User, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import UserAvatar from './UserAvatar';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;

export default function Navbar() {
  const { user, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const updatePath = () => {
      setCurrentPath(window.location.pathname);
      if (window.location.pathname === '/books') {
        const q = new URLSearchParams(window.location.search).get('q');
        setSearchQuery(q || '');
      }
    };

    window.addEventListener('popstate', updatePath);
    window.addEventListener('navigation', updatePath);

    const interval = setInterval(updatePath, 200);

    return () => {
      window.removeEventListener('popstate', updatePath);
      window.removeEventListener('navigation', updatePath);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    setCurrentPath(href);
    window.history.pushState({}, '', href);
  };

  const getLinkClass = (href: string) => {
    const isActive = currentPath === href;
    return `px-3 py-2 text-sm lg:text-base font-medium rounded-md transition-colors duration-200 whitespace-nowrap ${
      isActive
        ? 'bg-[#0E462B] text-white font-bold shadow-sm'
        : 'text-gray-600 hover:text-[#0E462B] hover:bg-transparent'
    }`;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/books?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsOpen(false);
    }
  };

  const iconButtonClass =
    'inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full text-[#0E462B] hover:bg-[#0E462B]/5 transition-colors duration-200';

  return (
    <>
      <header className="site-navbar fixed top-0 inset-x-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
          <div className="relative flex items-center justify-between h-16 md:h-[4.5rem] gap-3 sm:gap-4">
            {/* Logo */}
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('/');
              }}
              className="-ml-3 flex flex-col items-center justify-center shrink-0 min-w-0 max-w-[72%] sm:max-w-none transition-transform hover:scale-[1.02]"
              style={{ textDecoration: 'none' }}
            >
              <span
                className="text-[#0E462B] font-bold text-xl sm:text-2xl lg:text-[28px] leading-none tracking-tight truncate"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Tellex
              </span>
              <span
                className="text-[#0E462B]/60 text-[9px] sm:text-[10px] font-medium leading-tight mt-0.5 tracking-wide max-w-[72%] sm:max-w-none whitespace-normal text-center"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Let your feelings choose the perfect book
              </span>
            </a>

            {/* Desktop / tablet nav — centered */}
            <nav
              className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 lg:gap-1"
              aria-label="Main"
            >
              {NAV_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(href);
                  }}
                  className={getLinkClass(href)}
                >
                  {label}
                </a>
              ))}
            </nav>

            {/* Search, Cart, account, mobile menu */}
            <div className="flex items-center justify-end gap-0.5 sm:gap-1 shrink-0">
              {/* Desktop Search */}
              <form onSubmit={handleSearchSubmit} className="hidden lg:flex relative items-center mr-2">
                <input
                  type="text"
                  placeholder="Search books..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 xl:w-64 pl-4 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-[#0E462B] focus:ring-1 focus:ring-[#0E462B] transition-all"
                />
                <button type="submit" className="absolute right-3 text-gray-400 hover:text-[#0E462B]">
                  <Search size={18} />
                </button>
              </form>

              <a
                href="/my-orders"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/my-orders');
                }}
                className={iconButtonClass}
                title="My Orders"
                aria-label="My Orders"
              >
                <ShoppingCart size={22} strokeWidth={2} className="sm:w-6 sm:h-6" />
              </a>

              <div className="relative flex items-center justify-center min-w-[44px] min-h-[44px]">
                {user ? (
                  <UserAvatar />
                ) : (
                  <a
                    href="/login"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/login');
                    }}
                    className={iconButtonClass}
                    title="Login"
                    aria-label="Account"
                  >
                    <User size={22} strokeWidth={2} className="sm:w-[26px] sm:h-[26px]" />
                  </a>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`md:hidden ${iconButtonClass}`}
                aria-expanded={isOpen}
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
              >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-4 pt-4 space-y-2">
              {/* Mobile Search */}
              <form onSubmit={handleSearchSubmit} className="relative flex items-center mb-4">
                <input
                  type="text"
                  placeholder="Search books..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0E462B]"
                />
                <button type="submit" className="absolute right-4 text-gray-400">
                  <Search size={20} />
                </button>
              </form>

              {NAV_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(href);
                  }}
                  className={`block py-3 ${getLinkClass(href)}`}
                >
                  {label}
                </a>
              ))}
              {user ? (
                <div className="py-3 border-t border-gray-100 mt-2">
                  <p className="text-gray-600 text-sm mb-3 px-3">Signed in as {user.email}</p>
                  <div className="flex gap-4 px-3 flex-wrap">
                    <a
                      href="/dashboard"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/dashboard');
                        setIsOpen(false);
                      }}
                      className="text-gray-800 hover:text-[#0E462B] text-sm font-medium"
                    >
                      Dashboard
                    </a>
                    <a
                      href="/my-orders"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/my-orders');
                        setIsOpen(false);
                      }}
                      className="text-gray-800 hover:text-[#0E462B] text-sm font-medium"
                    >
                      My Orders
                    </a>
                    {isAdmin && (
                      <a
                        href="/admin"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate('/admin');
                          setIsOpen(false);
                        }}
                        className="text-amber-600 hover:text-amber-500 text-sm font-medium"
                      >
                        Admin Panel
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <a
                  href="/login"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/login');
                    setIsOpen(false);
                  }}
                  className="block py-3 mt-3 text-center rounded-xl bg-[#0E462B] text-white font-bold"
                >
                  Login to Dashboard
                </a>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Reserves space under fixed header — white so no green gap shows */}
      <div
        className="h-16 md:h-[4.5rem] bg-white shrink-0"
        aria-hidden="true"
      />
    </>
  );
}

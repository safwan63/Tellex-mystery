import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load all pages to drastically reduce the initial bundle size
const Home = lazy(() => import('./Home'));
const Explore = lazy(() => import('./Explore'));
const About = lazy(() => import('./About'));
const Contact = lazy(() => import('./Contact'));
const Privacy = lazy(() => import('./Privacy'));
const Terms = lazy(() => import('./Terms'));
const Shipping = lazy(() => import('./Shipping'));
const Return = lazy(() => import('./Return'));

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Flow = lazy(() => import('./pages/Flow'));
const MyOrders = lazy(() => import('./pages/MyOrders'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminOrders = lazy(() => import('./pages/AdminOrders'));

// Reusable animated fallback UI while chunks download
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#FDFCF7]">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0E462B]"></div>
  </div>
);

function LegacyApp() {
  const [currentPage, setCurrentPage] = useState('home');

  // 1️⃣ Sync URL → page on load & back/forward
  useEffect(() => {
    const updatePageFromPath = () => {
      const path = window.location.pathname;

      if (path === '/explore') setCurrentPage('explore');
      else if (path === '/about') setCurrentPage('about');
      else if (path === '/contact') setCurrentPage('contact');
      else if (path === '/privacy-policy') setCurrentPage('privacy');
      else if (path === '/terms-of-service') setCurrentPage('terms');
      else if (path === '/shipping-policy') setCurrentPage('shipping');
      else if (path === '/return-refund-policy') setCurrentPage('return');
      else setCurrentPage('home');
    };

    updatePageFromPath();
    window.addEventListener('popstate', updatePageFromPath);

    return () => window.removeEventListener('popstate', updatePageFromPath);
  }, []);

  // 2️⃣ Intercept internal link clicks (SPA behavior)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (!link || !link.href) return;
      if (!link.href.startsWith(window.location.origin)) return;

      const url = new URL(link.href);
      const path = url.pathname;

      const validPaths = [
        '/',
        '/explore',
        '/about',
        '/contact',
        '/privacy-policy',
        '/terms-of-service',
        '/shipping-policy',
        '/return-refund-policy',
      ];

      if (!validPaths.includes(path)) return;

      e.preventDefault();
      window.history.pushState({}, '', link.href);

      if (path === '/explore') setCurrentPage('explore');
      else if (path === '/about') setCurrentPage('about');
      else if (path === '/contact') setCurrentPage('contact');
      else if (path === '/privacy-policy') setCurrentPage('privacy');
      else if (path === '/terms-of-service') setCurrentPage('terms');
      else if (path === '/shipping-policy') setCurrentPage('shipping');
      else if (path === '/return-refund-policy') setCurrentPage('return');
      else setCurrentPage('home');
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // 3️⃣ ✅ THE FIX — scroll to top when page changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  return (
    <Suspense fallback={<PageLoader />}>
      {currentPage === 'home' && <Home />}
      {currentPage === 'explore' && <Explore />}
      {currentPage === 'about' && <About />}
      {currentPage === 'contact' && <Contact />}
      {currentPage === 'privacy' && <Privacy />}
      {currentPage === 'terms' && <Terms />}
      {currentPage === 'shipping' && <Shipping />}
      {currentPage === 'return' && <Return />}
    </Suspense>
  );
}

function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
          <Routes>
            {/* Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Protected Dashboard Routes */}
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/flow" element={<Flow />} />
            <Route path="/my-orders" element={<PrivateRoute><MyOrders /></PrivateRoute>} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
            
            {/* Catch-all for existing state-based pages */}
            <Route path="*" element={<LegacyApp />} />
          </Routes>
        </ErrorBoundary>
      </Suspense>
    </Router>
  );
}

export default App;


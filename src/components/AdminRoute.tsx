import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock } from 'lucide-react';

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, loading } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem('admin_authenticated') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0E462B]"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthenticated) {
    const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      // Ensure there is a VITE_ADMIN_PASSWORD set in .env
      const envPassword = import.meta.env.VITE_ADMIN_PASSWORD;
      
      if (!envPassword) {
        setError('Admin password not configured in .env');
        return;
      }

      if (password === envPassword) {
        sessionStorage.setItem('admin_authenticated', 'true');
        setIsAuthenticated(true);
      } else {
        setError('Incorrect password');
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] px-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-sm w-full space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-[#0E462B]/10 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-[#0E462B]" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Admin Access</h2>
            <p className="text-gray-500 mt-2 text-sm">Please enter the master password to continue.</p>
          </div>
          
          <div>
            <input 
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Enter password..."
              className="w-full px-4 py-3 border-2 border-[#E5E5E0] rounded-xl focus:border-[#0E462B] outline-none transition-colors"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mt-2 font-medium">{error}</p>}
          </div>

          <button 
            type="submit"
            className="w-full py-3 bg-[#0E462B] text-[#e1cfbc] font-bold rounded-xl shadow-lg hover:bg-[#0E462B]/90 transition-all uppercase tracking-wide"
          >
            Unlock Panel
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;

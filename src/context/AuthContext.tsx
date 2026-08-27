"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { onAuthStateChanged, User, getRedirectResult } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

const ADMIN_EMAILS = ["safwanhashim273@gmail.com"];

const AUTH_CACHE_KEY = "tellex_auth_cache";

const AuthContext = createContext<AuthContextType>({ user: null, isAdmin: false, loading: true });

export const useAuth = () => useContext(AuthContext);

// Try to read cached auth state for instant hydration (avoids blank screen on iOS)
function getCachedAuthState(): { uid: string; email: string | null; isAdmin: boolean } | null {
  try {
    const cached = sessionStorage.getItem(AUTH_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
}

function setCachedAuthState(uid: string, email: string | null, isAdmin: boolean) {
  try {
    sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ uid, email, isAdmin }));
  } catch {}
}

function clearCachedAuthState() {
  try {
    sessionStorage.removeItem(AUTH_CACHE_KEY);
  } catch {}
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Start with cached state so we don't block rendering
  const cached = getCachedAuthState();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(cached?.isAdmin ?? false);
  const [loading, setLoading] = useState(true);

  // Handle Firestore user doc creation/lookup
  const syncUserDoc = useCallback(async (currentUser: User) => {
    const isAdminUser = ADMIN_EMAILS.includes(currentUser.email || "");
    
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          isAdmin: isAdminUser,
          createdAt: serverTimestamp(),
        });
        setIsAdmin(isAdminUser);
      } else {
        if (isAdminUser && !userDoc.data().isAdmin) {
          await updateDoc(userRef, { isAdmin: true });
          setIsAdmin(true);
        } else {
          setIsAdmin(userDoc.data().isAdmin || false);
        }
      }
    } catch {
      // If Firestore fails (offline), use email-based admin check as fallback
      setIsAdmin(isAdminUser);
    }

    setCachedAuthState(currentUser.uid, currentUser.email, isAdminUser);
  }, []);

  useEffect(() => {
    // Defer getRedirectResult — it's extremely slow on iOS Safari (1-3s)
    // and only matters after an actual redirect login flow
    const handleRedirectLazy = () => {
      // Use requestIdleCallback on supporting browsers, setTimeout otherwise
      const schedule = typeof requestIdleCallback !== 'undefined' 
        ? requestIdleCallback 
        : (cb: () => void) => setTimeout(cb, 100);
      
      schedule(async () => {
        try {
          await getRedirectResult(auth);
        } catch {}
      });
    };

    handleRedirectLazy();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Don't block rendering on Firestore — set loading false immediately
        setLoading(false);
        // Sync user doc in the background
        syncUserDoc(currentUser);
      } else {
        setUser(null);
        setIsAdmin(false);
        clearCachedAuthState();
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [syncUserDoc]);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

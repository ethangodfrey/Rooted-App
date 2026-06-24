import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';

import { fetchUserProfile } from '@/lib/auth-profile';
import {
  clearAuthRouteCache,
  writeAuthRouteCache,
} from '@/lib/auth-route-cache';
import { supabase } from '@/lib/supabase';
import { isVendorApplicationComplete } from '@/lib/vendor-application';
import type { Shopper, User, Vendor } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  shopper: Shopper | null;
  vendor: Vendor | null;
  isLoading: boolean;
  isProfileLoading: boolean;
  isPasswordRecovery: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [shopper, setShopper] = useState<Shopper | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const profileRequestRef = useRef(0);

  const loadProfile = useCallback(async (userId: string) => {
    const requestId = ++profileRequestRef.current;
    setIsProfileLoading(true);

    try {
      const profile = await fetchUserProfile(userId);
      if (requestId !== profileRequestRef.current) return;

      setUser(profile.user);
      setShopper(profile.shopper);
      setVendor(profile.vendor);

      if (profile.user?.role) {
        await writeAuthRouteCache({
          userId,
          role: profile.user.role,
          hasInterests: (profile.shopper?.interests?.length ?? 0) > 0,
          vendorComplete: isVendorApplicationComplete(profile.vendor),
        });
      }
    } catch {
      // Network/unexpected failure: keep any cached profile state so routing can
      // fall back to the auth-route cache instead of hanging on a spinner.
    } finally {
      if (requestId === profileRequestRef.current) {
        setIsProfileLoading(false);
      }
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    if (!currentSession?.user) {
      profileRequestRef.current += 1;
      setUser(null);
      setShopper(null);
      setVendor(null);
      setIsProfileLoading(false);
      await clearAuthRouteCache();
      return;
    }

    await loadProfile(currentSession.user.id);
  }, [loadProfile]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(initialSession);
      setIsLoading(false);

      if (initialSession?.user) {
        void loadProfile(initialSession.user.id);
      }
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (event === 'INITIAL_SESSION') {
        setIsLoading(false);
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        navigate('/auth/reset-password');
      }

      if (nextSession?.user) {
        void loadProfile(nextSession.user.id);
      } else {
        profileRequestRef.current += 1;
        setUser(null);
        setShopper(null);
        setVendor(null);
        setIsProfileLoading(false);
        void clearAuthRouteCache();
      }

      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, navigate]);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    profileRequestRef.current += 1;
    setSession(null);
    setUser(null);
    setShopper(null);
    setVendor(null);
    setIsProfileLoading(false);
    setIsPasswordRecovery(false);
    await clearAuthRouteCache();
    navigate('/login');
  }, [navigate]);

  const value = useMemo(
    () => ({
      session,
      user,
      shopper,
      vendor,
      isLoading,
      isProfileLoading,
      isPasswordRecovery,
      signOut,
      refreshUser,
      clearPasswordRecovery,
    }),
    [
      session,
      user,
      shopper,
      vendor,
      isLoading,
      isProfileLoading,
      isPasswordRecovery,
      signOut,
      refreshUser,
      clearPasswordRecovery,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}

import { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
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

import { createSessionFromUrl, isAuthUrl, isRecoveryUrl } from '@/src/lib/auth-callback';
import { fetchUserProfile } from '@/src/lib/auth-profile';
import {
  clearAuthRouteCache,
  readAuthRouteCacheWithTimeout,
  writeAuthRouteCache,
  type AuthRouteCache,
} from '@/src/lib/auth-route-cache';
import { supabase } from '@/src/lib/supabase';
import { isVendorApplicationComplete } from '@/src/lib/vendor-application';
import type { Shopper, User, Vendor } from '@/src/types/database';

const AUTH_BOOTSTRAP_TIMEOUT_MS = 5_000;
const PROFILE_FETCH_TIMEOUT_MS = 12_000;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  shopper: Shopper | null;
  vendor: Vendor | null;
  isLoading: boolean;
  isProfileLoading: boolean;
  isPasswordRecovery: boolean;
  cacheReady: boolean;
  trustedCache: AuthRouteCache | null;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchUserProfileWithTimeout(userId: string): Promise<{
  user: User | null;
  shopper: Shopper | null;
  vendor: Vendor | null;
}> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetchUserProfile(userId),
      new Promise<{ user: null; shopper: null; vendor: null }>((resolve) => {
        timer = setTimeout(
          () => resolve({ user: null, shopper: null, vendor: null }),
          PROFILE_FETCH_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [shopper, setShopper] = useState<Shopper | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [routeCache, setRouteCache] = useState<AuthRouteCache | null | undefined>(undefined);
  const profileRequestRef = useRef(0);
  const bootstrappedRef = useRef(false);

  const loadProfile = useCallback(async (userId: string) => {
    const requestId = ++profileRequestRef.current;
    setIsProfileLoading(true);

    try {
      const profile = await fetchUserProfileWithTimeout(userId);
      if (requestId !== profileRequestRef.current) return;

      setUser(profile.user);
      setShopper(profile.shopper);
      setVendor(profile.vendor);

      if (profile.user?.role) {
        const cache: AuthRouteCache = {
          userId,
          role: profile.user.role,
          hasInterests: (profile.shopper?.interests?.length ?? 0) > 0,
          vendorComplete: isVendorApplicationComplete(profile.vendor),
        };
        setRouteCache(cache);
        await writeAuthRouteCache(cache);
      }
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
      setRouteCache(null);
      await clearAuthRouteCache();
      return;
    }

    await loadProfile(currentSession.user.id);
  }, [loadProfile]);

  useEffect(() => {
    let mounted = true;

    readAuthRouteCacheWithTimeout().then((cache) => {
      if (mounted) setRouteCache(cache);
    });

    const bootstrap = (nextSession: Session | null) => {
      if (!mounted || bootstrappedRef.current) return;
      bootstrappedRef.current = true;
      setSession(nextSession);
      setIsLoading(false);
      if (nextSession?.user) {
        void loadProfile(nextSession.user.id);
      }
    };

    const fallbackTimer = setTimeout(() => {
      void supabase.auth
        .getSession()
        .then(({ data: { session: fallbackSession } }) => bootstrap(fallbackSession))
        .catch(() => bootstrap(null));
    }, AUTH_BOOTSTRAP_TIMEOUT_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (event === 'INITIAL_SESSION') {
        clearTimeout(fallbackTimer);
        bootstrap(nextSession);
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        router.replace('/auth/reset-password');
      }

      if (nextSession?.user) {
        void loadProfile(nextSession.user.id);
      } else {
        profileRequestRef.current += 1;
        setUser(null);
        setShopper(null);
        setVendor(null);
        setIsProfileLoading(false);
        setRouteCache(null);
        void clearAuthRouteCache();
      }

      setIsLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  useEffect(() => {
    async function handleDeepLink(url: string) {
      try {
        await createSessionFromUrl(url);
        if (isRecoveryUrl(url)) {
          setIsPasswordRecovery(true);
          router.replace('/auth/reset-password');
          return;
        }
        await refreshUser();
      } catch {
        // Invalid or unrelated deep link — ignore.
      }
    }

    Linking.getInitialURL().then((url) => {
      if (url && isAuthUrl(url)) {
        handleDeepLink(url);
      }
    });

    const subscription = Linking.addEventListener('url', (event) => {
      if (isAuthUrl(event.url)) {
        handleDeepLink(event.url);
      }
    });

    return () => subscription.remove();
  }, [refreshUser]);

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
    setRouteCache(null);
    await clearAuthRouteCache();
    router.replace('/intro');
  }, []);

  const sessionUserId = session?.user.id;
  const cacheReady = routeCache !== undefined;
  const trustedCache = useMemo(() => {
    if (!sessionUserId || routeCache == null) return null;
    return routeCache.userId === sessionUserId ? routeCache : null;
  }, [routeCache, sessionUserId]);

  const value = useMemo(
    () => ({
      session,
      user,
      shopper,
      vendor,
      isLoading,
      isProfileLoading,
      isPasswordRecovery,
      cacheReady,
      trustedCache,
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
      cacheReady,
      trustedCache,
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

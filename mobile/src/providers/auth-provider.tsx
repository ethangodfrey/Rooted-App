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
import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';
import { isChefProfileComplete } from '@/src/lib/chef-profile';
import { isVendorApplicationComplete } from '@/src/lib/vendor-application';
import type { Chef, Shopper, User, Vendor } from '@/src/types/database';

const AUTH_BOOTSTRAP_TIMEOUT_MS = 800;
const PROFILE_FETCH_TIMEOUT_MS = 4_000;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  shopper: Shopper | null;
  vendor: Vendor | null;
  chef: Chef | null;
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
  chef: Chef | null;
}> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetchUserProfile(userId),
      new Promise<{ user: null; shopper: null; vendor: null; chef: null }>((resolve) => {
        timer = setTimeout(
          () => resolve({ user: null, shopper: null, vendor: null, chef: null }),
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
  const [chef, setChef] = useState<Chef | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [routeCache, setRouteCache] = useState<AuthRouteCache | null | undefined>(undefined);
  const profileRequestRef = useRef(0);
  const profileUserIdRef = useRef<string | null>(null);
  const bootstrappedRef = useRef(false);
  const cacheLoadedRef = useRef(false);
  const appliedSessionUserIdRef = useRef<string | null | undefined>(undefined);

  const loadProfile = useCallback(async (userId: string, force = false) => {
    if (!force && profileUserIdRef.current === userId) {
      return;
    }

    const requestId = ++profileRequestRef.current;
    setIsProfileLoading(true);

    try {
      const profile = await fetchUserProfileWithTimeout(userId);
      if (requestId !== profileRequestRef.current) return;

      profileUserIdRef.current = userId;
      setUser(profile.user);
      setShopper(profile.shopper);
      setVendor(profile.vendor);
      setChef(profile.chef);

      if (profile.user?.role) {
        const cache: AuthRouteCache = {
          userId,
          role: profile.user.role,
          hasInterests: (profile.shopper?.interests?.length ?? 0) > 0,
          vendorComplete: isVendorApplicationComplete(profile.vendor),
          chefComplete: isChefProfileComplete(profile.chef),
        };
        setRouteCache(cache);
        cacheLoadedRef.current = true;
        void writeAuthRouteCache(cache);
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
      profileUserIdRef.current = null;
      setUser(null);
      setShopper(null);
      setVendor(null);
      setChef(null);
      setIsProfileLoading(false);
      setRouteCache(null);
      await clearAuthRouteCache();
      return;
    }

    await loadProfile(currentSession.user.id, true);
  }, [loadProfile]);

  useEffect(() => {
    let mounted = true;

    const finishBootstrap = () => {
      if (!mounted || bootstrappedRef.current) return;
      bootstrappedRef.current = true;
      setIsLoading(false);
    };

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      const userId = nextSession?.user?.id ?? null;
      if (bootstrappedRef.current && appliedSessionUserIdRef.current === userId) {
        setSession((prev) => {
          if (
            prev?.user?.id === nextSession?.user?.id &&
            prev?.access_token === nextSession?.access_token
          ) {
            return prev;
          }
          return nextSession;
        });
        return;
      }
      appliedSessionUserIdRef.current = userId;
      setSession(nextSession);
      finishBootstrap();
      if (nextSession?.user) {
        void loadProfile(nextSession.user.id);
      } else {
        profileRequestRef.current += 1;
        profileUserIdRef.current = null;
        setUser(null);
        setShopper(null);
        setVendor(null);
        setChef(null);
        setIsProfileLoading(false);
        if (!cacheLoadedRef.current) {
          cacheLoadedRef.current = true;
          setRouteCache(null);
        }
      }
    };

    const setRouteCacheOnce = (cache: AuthRouteCache | null) => {
      if (cacheLoadedRef.current) return;
      cacheLoadedRef.current = true;
      setRouteCache(cache);
    };

    if (!isSupabaseConfigured) {
      applySession(null);
      return () => {
        mounted = false;
      };
    }

    const fallbackTimer = setTimeout(() => {
      if (!bootstrappedRef.current) {
        applySession(null);
      } else if (!cacheLoadedRef.current) {
        setRouteCacheOnce(null);
      }
    }, AUTH_BOOTSTRAP_TIMEOUT_MS);

    void supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!mounted) return;
        clearTimeout(fallbackTimer);
        applySession(initialSession);
      })
      .catch(() => {
        if (!mounted) return;
        clearTimeout(fallbackTimer);
        applySession(null);
      });

    void readAuthRouteCacheWithTimeout().then((cache) => {
      if (!mounted) return;
      setRouteCacheOnce(cache);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') {
        if (!mounted) return;
        clearTimeout(fallbackTimer);
        applySession(nextSession);
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        router.replace('/auth/reset-password');
      }

      if (nextSession?.user) {
        setSession((prev) => {
          if (
            prev?.user?.id === nextSession.user.id &&
            prev?.access_token === nextSession.access_token
          ) {
            return prev;
          }
          return nextSession;
        });
        finishBootstrap();
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          void loadProfile(nextSession.user.id, true);
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        profileRequestRef.current += 1;
        profileUserIdRef.current = null;
        appliedSessionUserIdRef.current = null;
        setSession(null);
        setUser(null);
        setShopper(null);
        setVendor(null);
        setChef(null);
        setIsProfileLoading(false);
        cacheLoadedRef.current = true;
        setRouteCache(null);
        finishBootstrap();
        void clearAuthRouteCache();
      }
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
    profileUserIdRef.current = null;
    appliedSessionUserIdRef.current = null;
    setSession(null);
    setUser(null);
    setShopper(null);
    setVendor(null);
    setChef(null);
    setIsProfileLoading(false);
    setIsPasswordRecovery(false);
    cacheLoadedRef.current = true;
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
      chef,
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
      chef,
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

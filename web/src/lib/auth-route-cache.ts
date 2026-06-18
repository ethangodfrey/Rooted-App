import type { User } from '@/types/database';

export interface AuthRouteCache {
  userId: string;
  role: 'shopper' | 'vendor' | 'admin';
  hasInterests: boolean;
  vendorComplete: boolean;
}

const CACHE_KEY = 'rooted-auth-route-cache';

export async function readAuthRouteCache(): Promise<AuthRouteCache | null> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthRouteCache;
    if (!parsed?.role || !parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeAuthRouteCache(cache: AuthRouteCache): Promise<void> {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export async function clearAuthRouteCache(): Promise<void> {
  localStorage.removeItem(CACHE_KEY);
}

/** Only trust cached role while profile is loading, or when the user row is present. */
export function getTrustedAuthCache(
  cache: AuthRouteCache | null | undefined,
  sessionUserId: string | undefined,
  options: { user: User | null; isProfileLoading: boolean },
): AuthRouteCache | null {
  if (!cache || !sessionUserId || cache.userId !== sessionUserId) return null;
  if (options.user) return cache;
  if (options.isProfileLoading) return cache;
  return null;
}

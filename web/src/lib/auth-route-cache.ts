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

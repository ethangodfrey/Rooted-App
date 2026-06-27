import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserRole } from '@/src/types/database';

const KEY = 'rooted_auth_route_cache_v1';

export interface AuthRouteCache {
  userId: string;
  role: UserRole;
  hasInterests: boolean;
  vendorComplete: boolean;
  chefComplete: boolean;
}

export async function readAuthRouteCache(): Promise<AuthRouteCache | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthRouteCache;
    if (!parsed?.role || !parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Never hang startup on a slow storage read. */
export function readAuthRouteCacheWithTimeout(
  timeoutMs = 200,
): Promise<AuthRouteCache | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    readAuthRouteCache(),
    new Promise<AuthRouteCache | null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function writeAuthRouteCache(cache: AuthRouteCache): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(cache));
}

export async function clearAuthRouteCache(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

type CacheEntry<T> = { fetchedAt: number; data: T };

const store = new Map<string, CacheEntry<unknown>>();

export function peekQueryCache<T>(key: string, ttlMs: number): T | undefined {
  const hit = store.get(key);
  if (!hit || Date.now() - hit.fetchedAt > ttlMs) return undefined;
  return hit.data as T;
}

export async function cachedQuery<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  options?: { force?: boolean },
): Promise<T> {
  if (!options?.force) {
    const hit = peekQueryCache<T>(key, ttlMs);
    if (hit !== undefined) return hit;
  }
  const data = await fn();
  store.set(key, { fetchedAt: Date.now(), data });
  return data;
}

export function invalidateQueryCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

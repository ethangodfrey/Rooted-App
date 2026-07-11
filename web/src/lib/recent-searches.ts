const STORAGE_KEY = 'vendorly-recent-searches';
const MAX_RECENT = 8;

export function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length >= 2);
  } catch {
    return [];
  }
}

export function pushRecentSearch(query: string): void {
  const trimmed = query.trim();
  if (trimmed.length < 2) return;
  const next = [trimmed, ...readRecentSearches().filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    MAX_RECENT,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearRecentSearches(): void {
  localStorage.removeItem(STORAGE_KEY);
}

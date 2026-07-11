import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'vendorly-recent-searches';
const MAX_RECENT = 8;

export async function readRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length >= 2);
  } catch {
    return [];
  }
}

export async function pushRecentSearch(query: string): Promise<void> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return;
  const existing = await readRecentSearches();
  const next = [trimmed, ...existing.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    MAX_RECENT,
  );
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function clearRecentSearches(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

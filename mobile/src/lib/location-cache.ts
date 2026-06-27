import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Coords } from '@/src/lib/geo';

const KEY = 'vendorly_last_coords_v1';
const TTL_MS = 24 * 60 * 60 * 1000;

interface StoredCoords {
  coords: Coords;
  at: number;
}

export async function readCachedCoords(): Promise<Coords | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCoords;
    if (!parsed?.coords || Date.now() - parsed.at > TTL_MS) return null;
    return parsed.coords;
  } catch {
    return null;
  }
}

export async function writeCachedCoords(coords: Coords): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ coords, at: Date.now() } satisfies StoredCoords));
  } catch {
    // non-critical
  }
}

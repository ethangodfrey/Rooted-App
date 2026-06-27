import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

import { useAuth } from '@/src/hooks/use-auth';
import type { Coords } from '@/src/lib/geo';
import { readCachedCoords, writeCachedCoords } from '@/src/lib/location-cache';
import { markLocationPermissionAsked } from '@/src/lib/location-preferences';

export type CoordsSource = 'gps' | 'submitted' | null;

async function geocodeSubmittedLocation(query: string): Promise<Coords | null> {
  try {
    const results = await Location.geocodeAsync(query);
    if (results.length > 0) {
      return { latitude: results[0].latitude, longitude: results[0].longitude };
    }
  } catch {
    // geocoding unavailable
  }
  return null;
}

async function resolveGpsCoords(): Promise<Coords | null> {
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

function applyCoords(
  coords: Coords,
  source: CoordsSource,
  setCoords: (c: Coords) => void,
  setSource: (s: CoordsSource) => void,
) {
  setCoords(coords);
  setSource(source);
  void writeCachedCoords(coords);
}

/**
 * Resolves shopper coordinates without blocking first paint.
 * Uses persisted coords instantly, then city/state geocode. GPS runs only when
 * permission is already granted — the system dialog is never shown automatically.
 */
export function useUserCoords() {
  const { user, shopper } = useAuth();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [source, setSource] = useState<CoordsSource>(null);
  const [loading, setLoading] = useState(false);

  const submittedQuery =
    [user?.city, user?.state].filter(Boolean).join(', ') ||
    user?.zip_code ||
    shopper?.default_location ||
    null;

  const resolveCoords = useCallback(async () => {
    setLoading(true);
    try {
      const persisted = await readCachedCoords();
      if (persisted) {
        applyCoords(persisted, 'submitted', setCoords, setSource);
      }

      const geocodePromise = submittedQuery
        ? geocodeSubmittedLocation(submittedQuery)
        : Promise.resolve(null);

      const permission = await Location.getForegroundPermissionsAsync();
      const gpsPromise =
        permission.status === 'granted' ? resolveGpsCoords() : Promise.resolve(null);

      const [geocoded, gps] = await Promise.all([geocodePromise, gpsPromise]);

      if (gps) {
        applyCoords(gps, 'gps', setCoords, setSource);
        return;
      }
      if (geocoded) {
        applyCoords(geocoded, 'submitted', setCoords, setSource);
      }
    } finally {
      setLoading(false);
    }
  }, [submittedQuery]);

  useEffect(() => {
    let active = true;

    void readCachedCoords().then((persisted) => {
      if (!active || !persisted) return;
      setCoords(persisted);
      setSource('submitted');
    });

    const task = InteractionManager.runAfterInteractions(() => {
      if (active) void resolveCoords();
    });

    return () => {
      active = false;
      task.cancel();
    };
  }, [resolveCoords]);

  return { coords, source, loading, refresh: resolveCoords };
}

/** Request GPS when the user explicitly taps a location control (e.g. map recenter). */
export async function requestGpsCoordsForUserAction(): Promise<Coords | null> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status === 'undetermined') {
      await markLocationPermissionAsked();
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== 'granted') return null;
    const gps = await resolveGpsCoords();
    if (gps) void writeCachedCoords(gps);
    return gps;
  } catch {
    return null;
  }
}

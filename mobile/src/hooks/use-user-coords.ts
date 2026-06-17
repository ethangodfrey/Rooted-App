import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/src/hooks/use-auth';
import {
  hasAskedLocationPermission,
  markLocationPermissionAsked,
} from '@/src/lib/location-preferences';
import type { Coords } from '@/src/lib/geo';

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

/**
 * Resolves shopper coordinates without re-prompting for location every visit.
 * GPS is used when already granted; the system dialog is shown at most once.
 * Otherwise falls back to the city/ZIP from onboarding (geocoded).
 */
export function useUserCoords() {
  const { user, shopper } = useAuth();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [source, setSource] = useState<CoordsSource>(null);
  const [loading, setLoading] = useState(true);

  const submittedQuery =
    [user?.city, user?.state].filter(Boolean).join(', ') ||
    user?.zip_code ||
    shopper?.default_location ||
    null;

  const resolveCoords = useCallback(async () => {
    setLoading(true);

    try {
      if (submittedQuery) {
        const submitted = await geocodeSubmittedLocation(submittedQuery);
        if (submitted) {
          setCoords(submitted);
          setSource('submitted');
          setLoading(false);
        }
      }

      let permission = await Location.getForegroundPermissionsAsync();

      if (permission.status === 'granted') {
        const gps = await resolveGpsCoords();
        if (gps) {
          setCoords(gps);
          setSource('gps');
          setLoading(false);
          return;
        }
      }

      if (permission.status === 'undetermined') {
        const askedBefore = await hasAskedLocationPermission();
        if (!askedBefore) {
          await markLocationPermissionAsked();
          permission = await Location.requestForegroundPermissionsAsync();
          if (permission.status === 'granted') {
            const gps = await resolveGpsCoords();
            if (gps) {
              setCoords(gps);
              setSource('gps');
              setLoading(false);
              return;
            }
          }
        }
      }

      if (!submittedQuery) {
        setCoords(null);
        setSource(null);
      }
    } finally {
      setLoading(false);
    }
  }, [submittedQuery]);

  useEffect(() => {
    resolveCoords();
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
    return resolveGpsCoords();
  } catch {
    return null;
  }
}

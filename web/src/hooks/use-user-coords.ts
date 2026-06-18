import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { geocodeUsCityState, geocodeUsZip, normalizeUsZip } from '@/lib/event-map-search';
import type { Coords } from '@/lib/geo';

export function useUserCoords() {
  const { user } = useAuth();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [source, setSource] = useState<'gps' | 'profile' | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fallbackToProfile() {
      const zip = user?.zip_code ? normalizeUsZip(user.zip_code) : null;
      if (zip) {
        const geocoded = await geocodeUsZip(zip);
        if (!cancelled && geocoded) {
          setCoords(geocoded);
          setSource('profile');
          return;
        }
      }

      if (user?.city && user?.state) {
        const geocoded = await geocodeUsCityState(user.city, user.state);
        if (!cancelled && geocoded) {
          setCoords(geocoded);
          setSource('profile');
        }
      }
    }

    if (!navigator.geolocation) {
      void fallbackToProfile();
      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setSource('gps');
      },
      () => {
        void fallbackToProfile();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );

    return () => {
      cancelled = true;
    };
  }, [user?.city, user?.state, user?.zip_code]);

  return { coords, source };
}

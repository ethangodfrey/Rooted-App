import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import type { Coords } from '@/lib/geo';
import { geocodeAddress } from '@/lib/geocode';

export function useUserCoords() {
  const { user, shopper } = useAuth();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [source, setSource] = useState<'gps' | 'profile' | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveProfileCoords() {
      const hasProfileLocation =
        Boolean(user?.city?.trim()) ||
        Boolean(user?.state?.trim()) ||
        Boolean(user?.zip_code?.trim()) ||
        Boolean(shopper?.default_location?.trim());

      if (!hasProfileLocation) return;

      const geocoded = await geocodeAddress({
        city: user?.city,
        state: user?.state,
        postalCode: user?.zip_code,
      });

      if (!cancelled && geocoded) {
        setCoords(geocoded);
        setSource('profile');
      }
    }

    if (!navigator.geolocation) {
      void resolveProfileCoords();
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
        void resolveProfileCoords();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );

    return () => {
      cancelled = true;
    };
  }, [user?.city, user?.state, user?.zip_code, shopper?.default_location]);

  return { coords, source };
}

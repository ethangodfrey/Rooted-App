import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import type { Coords } from '@/lib/geo';
import { coordsFrom, isValidCoords } from '@/lib/geo';
import { geocodeAddress } from '@/lib/geocode';

export function useUserCoords() {
  const { user, shopper } = useAuth();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [source, setSource] = useState<'gps' | 'profile' | null>(null);
  const [coordsReady, setCoordsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCoordsReady(false);

    async function resolveProfileCoords() {
      const hasProfileLocation =
        Boolean(user?.city?.trim()) ||
        Boolean(user?.state?.trim()) ||
        Boolean(user?.zip_code?.trim()) ||
        Boolean(shopper?.default_location?.trim());

      if (!hasProfileLocation) {
        if (!cancelled) setCoordsReady(true);
        return;
      }

      const geocoded = await geocodeAddress({
        city: user?.city,
        state: user?.state,
        postalCode: user?.zip_code,
      });

      if (!cancelled) {
        if (geocoded && isValidCoords(geocoded)) {
          setCoords(geocoded);
          setSource('profile');
        }
        setCoordsReady(true);
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
        const gps = coordsFrom({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (gps) {
          setCoords(gps);
          setSource('gps');
          setCoordsReady(true);
          return;
        }
        console.log('GPS returned invalid coordinates, falling back to profile geocode.');
        void resolveProfileCoords();
      },
      () => {
        console.log('Location access denied, falling back to profile geocode.');
        void resolveProfileCoords();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );

    return () => {
      cancelled = true;
    };
  }, [user?.city, user?.state, user?.zip_code, shopper?.default_location]);

  return { coords, source, coordsReady };
}

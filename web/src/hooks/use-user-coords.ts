import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import type { Coords } from '@/lib/geo';

export function useUserCoords() {
  const { user } = useAuth();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [source, setSource] = useState<'gps' | 'profile' | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setSource('gps');
      },
      () => {
        if (user?.city) {
          setSource('profile');
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, [user?.city]);

  return { coords, source };
}

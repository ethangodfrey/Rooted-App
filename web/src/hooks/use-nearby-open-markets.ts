import { useEffect, useState } from 'react';

import { eventRuntimePhase } from '@/lib/event-runtime';
import { fetchPublicEvents } from '@/lib/events-query';
import { isValidCoords } from '@/lib/geo';
import { useUserCoords } from '@/hooks/use-user-coords';
import { useNow } from '@/hooks/use-now';

/** Lightweight signal for map FAB pulse when live markets are nearby. */
export function useNearbyOpenMarkets() {
  const { coords, coordsReady } = useUserCoords();
  const now = useNow(60_000);
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    if (!coordsReady) return;

    if (!isValidCoords(coords)) {
      setOpenCount(0);
      return;
    }

    let cancelled = false;
    void fetchPublicEvents({
      forMap: true,
      near: { latitude: coords.latitude, longitude: coords.longitude },
    }).then(({ data, error }) => {
      if (cancelled) return;
      const list = error ? [] : data;
      setOpenCount(list.filter((event) => eventRuntimePhase(event, now) === 'live').length);
    }).catch(() => {
      if (!cancelled) setOpenCount(0);
    });

    return () => {
      cancelled = true;
    };
  }, [coords?.latitude, coords?.longitude, coordsReady, now]);

  return openCount > 0;
}

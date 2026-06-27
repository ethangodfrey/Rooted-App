import { useEffect, useState } from 'react';

import { eventRuntimePhase, type EventRuntimeFields } from '@/lib/event-runtime';
import { fetchNearbyEvents } from '@/lib/geo-search';
import { useUserCoords } from '@/hooks/use-user-coords';
import { useNow } from '@/hooks/use-now';

/** Lightweight signal for map FAB pulse when live markets are nearby. */
export function useNearbyOpenMarkets() {
  const { coords } = useUserCoords();
  const now = useNow(60_000);
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    if (coords?.latitude == null || coords?.longitude == null) {
      setOpenCount(0);
      return;
    }

    let cancelled = false;
    void fetchNearbyEvents(
      { latitude: coords.latitude, longitude: coords.longitude },
      { limit: 12 },
    ).then((events) => {
      if (cancelled) return;
      const list = events ?? [];
      setOpenCount(list.filter((e) => eventRuntimePhase(e as EventRuntimeFields, now) === 'live').length);
    });

    return () => {
      cancelled = true;
    };
  }, [coords?.latitude, coords?.longitude, now]);

  return openCount > 0;
}

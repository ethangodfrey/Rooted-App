import { useEffect, useRef, useState } from 'react';

import { distanceMiles, parseCoords, type Coords } from '@/lib/geo';

const SETTLE_MS = 800;
const REFETCH_DISTANCE_MILES = 20;

/** Avoid refetching map data on every minor GPS drift. */
export function useMapFetchOrigin(coords: Coords | null): Coords | null {
  const [origin, setOrigin] = useState<Coords | null>(null);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialRef = useRef(false);

  useEffect(() => {
    const parsed = parseCoords(coords?.latitude, coords?.longitude);
    if (!parsed) return;

    if (pendingRef.current) clearTimeout(pendingRef.current);

    const delay = hasInitialRef.current ? SETTLE_MS : 0;

    pendingRef.current = setTimeout(() => {
      setOrigin((prev) => {
        if (!prev) {
          hasInitialRef.current = true;
          return parsed;
        }
        if (distanceMiles(prev, parsed) >= REFETCH_DISTANCE_MILES) return parsed;
        return prev;
      });
    }, delay);

    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current);
    };
  }, [coords]);

  return origin;
}

import { useEffect, useRef, useState } from 'react';

import { distanceMiles, type Coords } from '@/src/lib/geo';

const SETTLE_MS = 800;
const REFETCH_DISTANCE_MILES = 20;

export function useMapFetchOrigin(coords: Coords | null): Coords | null {
  const [origin, setOrigin] = useState<Coords | null>(null);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!coords) return;

    if (pendingRef.current) clearTimeout(pendingRef.current);

    pendingRef.current = setTimeout(() => {
      setOrigin((prev) => {
        if (!prev) return coords;
        if (distanceMiles(prev, coords) >= REFETCH_DISTANCE_MILES) return coords;
        return prev;
      });
    }, SETTLE_MS);

    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current);
    };
  }, [coords]);

  return origin;
}

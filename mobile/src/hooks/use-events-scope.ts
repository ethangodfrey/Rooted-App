import { useCallback, useEffect, useState } from 'react';

import {
  getEventsScope,
  saveEventsScope,
  type EventsScope,
} from '@/src/lib/location-preferences';

export function useEventsScope() {
  const [scope, setScopeState] = useState<EventsScope>('local');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    getEventsScope().then((saved) => {
      if (active) {
        setScopeState(saved);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setScope = useCallback(async (next: EventsScope) => {
    setScopeState(next);
    await saveEventsScope(next);
  }, []);

  return { scope, setScope, ready };
}

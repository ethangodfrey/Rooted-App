import { useEffect, useState } from 'react';

import type { EventsScope } from '@/lib/events-list';

const SCOPE_KEY = 'rooted-events-scope';

export function useEventsScope() {
  const [scope, setScopeState] = useState<EventsScope>('local');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SCOPE_KEY);
      if (stored === 'local' || stored === 'nationwide') {
        setScopeState(stored);
      }
    } catch {
      // Private browsing or storage restrictions — keep default scope.
    }
    setReady(true);
  }, []);

  const setScope = (next: EventsScope) => {
    setScopeState(next);
    try {
      localStorage.setItem(SCOPE_KEY, next);
    } catch {
      // Ignore quota / privacy mode write failures.
    }
  };

  return { scope, setScope, ready };
}

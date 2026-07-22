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
      // Private browsing / storage quota — keep default scope.
    }
    setReady(true);
  }, []);

  const setScope = (next: EventsScope) => {
    setScopeState(next);
    try {
      localStorage.setItem(SCOPE_KEY, next);
    } catch {
      // Ignore write failures; in-memory scope still updates.
    }
  };

  return { scope, setScope, ready };
}

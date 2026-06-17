import { useEffect, useState } from 'react';

import type { EventsScope } from '@/lib/events-list';

const SCOPE_KEY = 'rooted-events-scope';

export function useEventsScope() {
  const [scope, setScopeState] = useState<EventsScope>('local');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SCOPE_KEY);
    if (stored === 'local' || stored === 'nationwide') {
      setScopeState(stored);
    }
    setReady(true);
  }, []);

  const setScope = (next: EventsScope) => {
    setScopeState(next);
    localStorage.setItem(SCOPE_KEY, next);
  };

  return { scope, setScope, ready };
}

import { formatCurrentClock } from '@/lib/format';
import { useNow } from '@/hooks/use-now';

export function EventLiveClock({ compact = false }: { compact?: boolean }) {
  const now = useNow();

  return (
    <div className={`event-live-clock${compact ? ' event-live-clock--compact' : ''}`} aria-live="polite">
      <span className="event-live-clock__icon" aria-hidden="true">
        ◷
      </span>
      <span className="event-live-clock__label">Now</span>
      <time className="event-live-clock__time" dateTime={now.toISOString()}>
        {formatCurrentClock(now)}
      </time>
    </div>
  );
}

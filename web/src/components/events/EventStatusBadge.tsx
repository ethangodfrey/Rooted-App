import {
  EVENT_RUNTIME_LABEL,
  EVENT_RUNTIME_SYMBOL,
  eventRuntimeHint,
  eventRuntimePhase,
  type EventRuntimeFields,
} from '@/lib/event-runtime';
import { useNow } from '@/hooks/use-now';

interface EventStatusBadgeProps {
  event: EventRuntimeFields;
  showHint?: boolean;
  size?: 'sm' | 'md';
  /** Pass from list/map parents to avoid hundreds of live timers. */
  now?: Date;
}

function EventStatusBadgeView({
  event,
  showHint = false,
  size = 'sm',
  now,
}: EventStatusBadgeProps & { now: Date }) {
  const phase = eventRuntimePhase(event, now);
  const hint = showHint ? eventRuntimeHint(event, now) : null;

  return (
    <span className="event-status-wrap">
      <span
        className={`event-status-badge event-status-badge--${phase} event-status-badge--${size}`}
        title={hint ?? undefined}
      >
        <span className="event-status-badge__symbol" aria-hidden="true">
          {EVENT_RUNTIME_SYMBOL[phase]}
        </span>
        {EVENT_RUNTIME_LABEL[phase]}
      </span>
      {hint ? <span className="event-status-hint">{hint}</span> : null}
    </span>
  );
}

function EventStatusBadgeLive(props: Omit<EventStatusBadgeProps, 'now'>) {
  const now = useNow();
  return <EventStatusBadgeView {...props} now={now} />;
}

export function EventStatusBadge({ now, ...props }: EventStatusBadgeProps) {
  if (now) {
    return <EventStatusBadgeView {...props} now={now} />;
  }
  return <EventStatusBadgeLive {...props} />;
}

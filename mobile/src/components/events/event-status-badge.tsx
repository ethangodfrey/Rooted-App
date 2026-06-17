import { View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import {
  EVENT_RUNTIME_LABEL,
  eventRuntimeHint,
  eventRuntimePhase,
  type EventRuntimeFields,
  type EventRuntimePhase,
} from '@/src/lib/event-runtime';
import { useNow } from '@/src/hooks/use-now';
import { colors } from '@/src/theme/colors';

const PHASE_STYLE: Record<
  EventRuntimePhase,
  { bg: string; text: string; border: string; symbol: string }
> = {
  live: {
    bg: '#E8F8E8',
    text: colors.primary,
    border: 'rgba(34, 139, 34, 0.35)',
    symbol: '●',
  },
  upcoming: {
    bg: '#F3F7F3',
    text: '#2F6B2F',
    border: 'rgba(34, 139, 34, 0.2)',
    symbol: '◷',
  },
  closed: {
    bg: '#F4F4F5',
    text: colors.muted,
    border: 'rgba(107, 114, 128, 0.25)',
    symbol: '◼',
  },
  cancelled: {
    bg: '#FEF2F2',
    text: '#B91C1C',
    border: 'rgba(185, 28, 28, 0.25)',
    symbol: '✕',
  },
};

interface EventStatusBadgeProps {
  event: EventRuntimeFields;
  showHint?: boolean;
  /** Pass from list/map parents to avoid extra subscriptions. */
  now?: Date;
}

function EventStatusBadgeView({
  event,
  showHint = false,
  now,
}: EventStatusBadgeProps & { now: Date }) {
  const phase = eventRuntimePhase(event, now);
  const hint = showHint ? eventRuntimeHint(event, now) : null;
  const style = PHASE_STYLE[phase];

  return (
    <View>
      <View
        className="self-start flex-row items-center gap-1.5 rounded-full border px-2.5 py-1"
        style={{ backgroundColor: style.bg, borderColor: style.border }}>
        <Text style={{ fontSize: 10, color: style.text }}>{style.symbol}</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: style.text }}>
          {EVENT_RUNTIME_LABEL[phase]}
        </Text>
      </View>
      {hint ? (
        <Text variant="caption" className="mt-1">
          {hint}
        </Text>
      ) : null}
    </View>
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

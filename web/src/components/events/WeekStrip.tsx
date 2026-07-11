import { useMemo, useState } from 'react';

const STRIP_DAYS = 21;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

interface WeekStripProps {
  eventDates?: string[];
  now?: Date;
  selectedDate?: Date;
  onSelectDate?: (date: Date) => void;
}

export function WeekStrip({
  eventDates = [],
  now = new Date(),
  selectedDate: selectedDateProp,
  onSelectDate,
}: WeekStripProps) {
  const [internalSelected, setInternalSelected] = useState(() => {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const selectedDate = selectedDateProp ?? internalSelected;

  const days = useMemo(() => {
    const weekStart = startOfWeek(now);
    const eventDaySet = new Set(
      eventDates.map((iso) => dayKey(new Date(iso))),
    );

    return Array.from({ length: STRIP_DAYS }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return {
        date: d,
        num: d.getDate(),
        weekday: WEEKDAY_LABELS[d.getDay()],
        isToday: sameDay(d, now),
        isSelected: sameDay(d, selectedDate),
        hasEvent: eventDaySet.has(dayKey(d)),
      };
    });
  }, [eventDates, now, selectedDate]);

  const handleSelect = (date: Date) => {
    if (onSelectDate) {
      onSelectDate(date);
    } else {
      setInternalSelected(date);
    }
  };

  return (
    <div className="app-week-strip-wrap">
      <div className="app-week-strip" role="list" aria-label="Upcoming dates">
        {days.map((day) => (
          <button
            key={day.date.toISOString()}
            type="button"
            role="listitem"
            className={[
              'app-week-day',
              day.isSelected ? 'app-week-day--selected' : '',
              day.isToday && !day.isSelected ? 'app-week-day--today' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={`${day.weekday}, ${day.date.toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
            })}${day.hasEvent ? ', has markets' : ''}${day.isToday ? ', today' : ''}${day.isSelected ? ', selected' : ''}`}
            aria-pressed={day.isSelected}
            onClick={() => handleSelect(day.date)}
          >
            <span className="app-week-day__weekday">{day.weekday}</span>
            <span className="app-week-day__circle">
              <span className="app-week-day__num">{day.num}</span>
            </span>
            <span
              className={`app-week-day__dot${day.hasEvent ? ' app-week-day__dot--visible' : ''}`}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

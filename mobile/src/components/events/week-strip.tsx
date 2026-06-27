import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import { colors } from '@/src/theme/colors';

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
    const eventDaySet = new Set(eventDates.map((iso) => dayKey(new Date(iso))));

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
    <View
      className="mb-5 rounded-card px-3 py-3"
      style={{ backgroundColor: colors.warmSage }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
        {days.map((day) => {
          const isSelected = day.isSelected;
          const isTodayRing = day.isToday && !isSelected;

          return (
            <Pressable
              key={day.date.toISOString()}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => handleSelect(day.date)}
              style={{ alignItems: 'center', width: 44, paddingVertical: 2 }}>
              <Text
                variant="caption"
                className="mb-1 text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: colors.muted, lineHeight: 14 }}>
                {day.weekday}
              </Text>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected ? colors.terracotta : 'transparent',
                  borderWidth: isTodayRing ? 1.5 : 0,
                  borderColor: isTodayRing ? colors.terracotta : 'transparent',
                }}>
                <Text
                  variant="body"
                  className="font-bold"
                  style={{
                    color: isSelected ? colors.surface : colors.text,
                    lineHeight: 20,
                    fontSize: 15,
                  }}>
                  {day.num}
                </Text>
              </View>
              <View
                style={{
                  marginTop: 6,
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: day.hasEvent ? colors.garden : 'transparent',
                }}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

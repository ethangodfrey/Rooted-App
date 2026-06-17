import { parseOsmOpeningHours } from './market-schedule.util';

export interface ResolvedSchedule {
  dayOfWeek: string;
  startHour: number;
  endHour: number;
}

/** Read recurring schedule from sync metadata or OSM opening_hours. */
export function resolveSchedule(metadata: Record<string, unknown>): ResolvedSchedule {
  const openingHours =
    typeof metadata.opening_hours === 'string' ? metadata.opening_hours : null;
  const parsed = parseOsmOpeningHours(openingHours);

  const day =
    typeof metadata.typical_day === 'string'
      ? metadata.typical_day.toLowerCase()
      : parsed?.dayOfWeek ?? 'saturday';

  const startHour =
    typeof metadata.start_hour === 'number'
      ? metadata.start_hour
      : parsed?.startHour ?? 8;

  const endHour =
    typeof metadata.end_hour === 'number' ? metadata.end_hour : parsed?.endHour ?? 13;

  return { dayOfWeek: day, startHour, endHour };
}

export const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

const DAY_TO_OSM: Record<Weekday, string> = {
  sunday: 'Su',
  monday: 'Mo',
  tuesday: 'Tu',
  wednesday: 'We',
  thursday: 'Th',
  friday: 'Fr',
  saturday: 'Sa',
};

export interface UsdaMarketSession {
  day: Weekday;
  startHour: number;
  endHour: number;
  label: string;
}

export interface UsdaParsedSchedule {
  runsOnDays: Weekday[];
  typicalDay: Weekday;
  startHour: number;
  endHour: number;
  hoursSummary: string;
  openingHours: string;
  seasonalSchedule: string | null;
  source: 'usda_detail' | 'market_name' | 'default';
}

export function capitalizeDay(day: Weekday): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export function inferDayFromMarketName(name: string): Weekday | null {
  const text = name.toLowerCase();

  const rules: [RegExp, Weekday][] = [
    [/\bsundays?\b/, 'sunday'],
    [/\bmondays?\b/, 'monday'],
    [/\btuesdays?\b/, 'tuesday'],
    [/\bwednesdays?\b/, 'wednesday'],
    [/\bthursdays?\b/, 'thursday'],
    [/\bfridays?\b/, 'friday'],
    [/\bsaturdays?\b/, 'saturday'],
  ];

  for (const [pattern, day] of rules) {
    if (pattern.test(text)) return day;
  }

  return null;
}

function to24Hour(hour: number, ampm: string): number {
  const normalized = ampm.toUpperCase();
  let h = hour % 12;
  if (normalized === 'PM') h += 12;
  if (normalized === 'AM' && hour === 12) h = 0;
  return h;
}

function formatHourLabel(hour: number): string {
  const suffix = hour >= 12 ? 'pm' : 'am';
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}${suffix}`;
}

export function parseUsdaSeasonProducts(html: string | null | undefined): UsdaMarketSession[] {
  if (!html?.trim()) return [];

  const sessions: UsdaMarketSession[] = [];
  const pattern =
    /(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s*:\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/gi;

  for (const match of html.matchAll(pattern)) {
    const day = match[1].toLowerCase() as Weekday;
    if (!WEEKDAYS.includes(day)) continue;

    const startHour = to24Hour(Number(match[2]), match[4]);
    const endHour = to24Hour(Number(match[5]), match[7]);
    const label = `${capitalizeDay(day)}: ${match[2]}:${match[3]} ${match[4]} – ${match[5]}:${match[6]} ${match[7]}`;

    sessions.push({ day, startHour, endHour, label });
  }

  return sessions;
}

export function parseUsdaSeasonLabel(html: string | null | undefined): string | null {
  if (!html?.trim()) return null;
  const match = html.match(/Season\(s\)<\/div><div><div class='mytext'>([^<]+)</);
  return match?.[1]?.trim() ?? null;
}

export function buildScheduleFromSessions(
  sessions: UsdaMarketSession[],
  seasonalSchedule: string | null = null,
): UsdaParsedSchedule | null {
  if (sessions.length === 0) return null;

  const runsOnDays = [...new Set(sessions.map((session) => session.day))];
  const primary = sessions[0];
  const hoursSummary = sessions.map((session) => session.label).join('; ');
  const openingHours = sessions
    .map(
      (session) =>
        `${DAY_TO_OSM[session.day]} ${String(session.startHour).padStart(2, '0')}:00-${String(session.endHour).padStart(2, '0')}:00`,
    )
    .join('; ');

  return {
    runsOnDays,
    typicalDay: primary.day,
    startHour: primary.startHour,
    endHour: primary.endHour,
    hoursSummary,
    openingHours,
    seasonalSchedule,
    source: 'usda_detail',
  };
}

export function defaultSchedule(): UsdaParsedSchedule {
  return {
    runsOnDays: ['saturday'],
    typicalDay: 'saturday',
    startHour: 8,
    endHour: 13,
    hoursSummary: 'Saturdays 8am–1pm (confirm with organizer)',
    openingHours: 'Sa 08:00-13:00',
    seasonalSchedule: null,
    source: 'default',
  };
}

export function resolveUsdaSchedule(input: {
  name: string;
  seasonProductsHtml?: string | null;
}): UsdaParsedSchedule {
  const seasonalSchedule = parseUsdaSeasonLabel(input.seasonProductsHtml);
  const fromDetail = buildScheduleFromSessions(
    parseUsdaSeasonProducts(input.seasonProductsHtml),
    seasonalSchedule,
  );
  if (fromDetail) return fromDetail;

  const inferredDay = inferDayFromMarketName(input.name);
  if (inferredDay) {
    const schedule = defaultSchedule();
    return {
      ...schedule,
      runsOnDays: [inferredDay],
      typicalDay: inferredDay,
      hoursSummary: `${capitalizeDay(inferredDay)}s ${formatHourLabel(schedule.startHour)}–${formatHourLabel(schedule.endHour)} (confirm with organizer)`,
      openingHours: `${DAY_TO_OSM[inferredDay]} ${String(schedule.startHour).padStart(2, '0')}:00-${String(schedule.endHour).padStart(2, '0')}:00`,
      source: 'market_name',
    };
  }

  return defaultSchedule();
}

export const USDA_REQUEST_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.usdalocalfoodportal.com/',
};

export async function fetchUsdaListingDetail(
  listingId: string,
  directoryType: string = 'farmersmarket',
): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(
      `https://www.usdalocalfoodportal.com/api/listinginfo/?lid=${encodeURIComponent(listingId)}&directory_type=${encodeURIComponent(directoryType)}`,
      { headers: USDA_REQUEST_HEADERS },
    );
    if (!res.ok) return null;
    return (await res.json()) as Record<string, string>;
  } catch {
    return null;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Event, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { nextMarketWindow } from './market-schedule.util';
import {
  clampHour,
  hasSuspiciousLocalStartHour,
  normalizeDays,
  sanitizeMarketHours,
} from './schedule-hour.util';
import { resolveTimezone } from './timezone.util';
import { timezoneAbbreviation } from './us-state-timezones';
import {
  fetchUsdaListingDetail,
  resolveUsdaSchedule,
  type UsdaParsedSchedule,
} from './usda-schedule.util';
import { MARKETS_ENRICHMENT_VERSION } from './markets.types';

export const SCHEDULE_AI_VERSION = '1';

export interface ScheduleEnrichResult {
  processed: number;
  updated: number;
  fromUsda: number;
  fromAi: number;
  fromRules: number;
  skipped: number;
  remaining: number;
  errors: string[];
}

export interface ResolvedMarketSchedule {
  runsOnDays: string[];
  typicalDayOfWeek: string;
  typicalStartHour: number;
  typicalEndHour: number;
  hoursSummary: string;
  openingHours: string | null;
  seasonalSchedule: string | null;
  scheduleSource: 'usda_detail' | 'ai' | 'market_name' | 'default' | 'existing';
  confidence: 'high' | 'medium' | 'low';
}

@Injectable()
export class MarketsScheduleAiService {
  private readonly logger = new Logger(MarketsScheduleAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get aiEnabled(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY', '').trim());
  }

  private pendingWhereClause(forceAll: boolean): Prisma.EventWhereInput {
    if (forceAll) {
      return { visibilityStatus: 'public', externalSource: 'usda' };
    }

    return {
      visibilityStatus: 'public',
      externalSource: 'usda',
      OR: [
        { timezone: null },
        {
          syncMetadata: {
            path: ['schedule_ai_version'],
            not: SCHEDULE_AI_VERSION,
          },
        },
        {
          syncMetadata: {
            path: ['schedule_source'],
            equals: 'default',
          },
        },
        {
          syncMetadata: {
            path: ['schedule_source'],
            equals: 'market_name',
          },
        },
      ],
    };
  }

  async countPending(forceAll = false): Promise<number> {
    return this.prisma.event.count({ where: this.pendingWhereClause(forceAll) });
  }

  async enrichPendingBatch(
    batchSize = 50,
    options: { forceAll?: boolean; useAi?: boolean } = {},
  ): Promise<ScheduleEnrichResult> {
    const useAi = options.useAi ?? this.aiEnabled;
    const forceAll = options.forceAll ?? false;
    const delayMs = Number(this.config.get<string>('MARKETS_SCHEDULE_AI_DELAY_MS', '200')) || 200;

    const events = await this.prisma.event.findMany({
      where: this.pendingWhereClause(forceAll),
      take: batchSize,
      orderBy: { id: 'asc' },
    });

    let updated = 0;
    let fromUsda = 0;
    let fromAi = 0;
    let fromRules = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const result = await this.enrichEventSchedule(event, useAi);
        if (result === 'updated') updated += 1;
        else if (result === 'skipped') skipped += 1;
        else if (result === 'usda') {
          updated += 1;
          fromUsda += 1;
        } else if (result === 'ai') {
          updated += 1;
          fromAi += 1;
        } else if (result === 'rules') {
          updated += 1;
          fromRules += 1;
        }
      } catch (err) {
        errors.push(`${event.id}: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (useAi) await this.sleep(delayMs);
    }

    const remaining = await this.countPending(forceAll);

    this.logger.log(
      `Schedule AI batch: processed=${events.length} updated=${updated} usda=${fromUsda} ai=${fromAi} rules=${fromRules} remaining=${remaining}`,
    );

    return {
      processed: events.length,
      updated,
      fromUsda,
      fromAi,
      fromRules,
      skipped,
      remaining,
      errors,
    };
  }

  needsScheduleEnrichment(event: {
    startDatetime: Date;
    timezone: string | null;
    syncMetadata: Prisma.JsonValue;
  }): boolean {
    const metadata = (event.syncMetadata ?? {}) as Record<string, unknown>;
    const scheduleVersion = metadata.schedule_ai_version;
    if (scheduleVersion !== SCHEDULE_AI_VERSION) return true;

    const scheduleSource = metadata.schedule_source;
    if (scheduleSource === 'default' || scheduleSource === 'market_name') return true;

    const timezone =
      event.timezone ??
      (typeof metadata.timezone === 'string' ? metadata.timezone : null) ??
      'America/New_York';
    const startHour =
      typeof metadata.start_hour === 'number' ? metadata.start_hour : undefined;

    return hasSuspiciousLocalStartHour(event.startDatetime, timezone, startHour);
  }

  private async enrichEventSchedule(
    event: Event,
    useAi: boolean,
  ): Promise<'updated' | 'skipped' | 'usda' | 'ai' | 'rules'> {
    const metadata = (event.syncMetadata ?? {}) as Record<string, unknown>;
    const timezone = resolveTimezone(
      Number(event.latitude),
      Number(event.longitude),
      event.state,
    );

    const resolved = await this.resolveScheduleForEvent(event, metadata, timezone, useAi);
    const { startHour, endHour } = sanitizeMarketHours(
      resolved.typicalStartHour,
      resolved.typicalEndHour,
      event.marketType,
    );

    const { start, end } = nextMarketWindow(
      resolved.typicalDayOfWeek,
      startHour,
      endHour,
      timezone,
    );

    const changed =
      event.startDatetime.getTime() !== start.getTime() ||
      event.endDatetime.getTime() !== end.getTime() ||
      event.timezone !== timezone ||
      event.hoursSummary !== resolved.hoursSummary ||
      metadata.schedule_source !== resolved.scheduleSource;

    if (!changed && metadata.schedule_ai_version === SCHEDULE_AI_VERSION) {
      return 'skipped';
    }

    await this.prisma.event.update({
      where: { id: event.id },
      data: {
        startDatetime: start,
        endDatetime: end,
        timezone,
        hoursSummary: resolved.hoursSummary,
        syncMetadata: {
          ...metadata,
          opening_hours: resolved.openingHours ?? metadata.opening_hours,
          typical_day: resolved.typicalDayOfWeek,
          runs_on_days: resolved.runsOnDays,
          start_hour: startHour,
          end_hour: endHour,
          seasonal_schedule: resolved.seasonalSchedule,
          schedule_source: resolved.scheduleSource,
          schedule_ai_version: SCHEDULE_AI_VERSION,
          schedule_confidence: resolved.confidence,
          enrichment_version: MARKETS_ENRICHMENT_VERSION,
        } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    if (resolved.scheduleSource === 'usda_detail') return 'usda';
    if (resolved.scheduleSource === 'ai') return 'ai';
    return 'rules';
  }

  private async resolveScheduleForEvent(
    event: Event,
    metadata: Record<string, unknown>,
    timezone: string,
    useAi: boolean,
  ): Promise<ResolvedMarketSchedule> {
    const usdaSchedule = await this.fetchUsdaSchedule(event);
    if (usdaSchedule && usdaSchedule.source === 'usda_detail') {
      return this.fromUsdaParsed(usdaSchedule);
    }

    if (useAi && this.aiEnabled) {
      const aiSchedule = await this.resolveWithAi(event, metadata, timezone, usdaSchedule);
      if (aiSchedule) return aiSchedule;
    }

    if (usdaSchedule) return this.fromUsdaParsed(usdaSchedule);

    return this.fromExistingMetadata(event, metadata);
  }

  private async fetchUsdaSchedule(event: Event): Promise<UsdaParsedSchedule | null> {
    if (event.externalSource !== 'usda' || !event.externalId) return null;

    const externalId = event.externalId;
    const colon = externalId.indexOf(':');
    const directory = colon > 0 ? externalId.slice(0, colon) : 'farmersmarket';
    const listingId = colon > 0 ? externalId.slice(colon + 1) : externalId;

    const detail = await fetchUsdaListingDetail(listingId, directory);
    if (!detail) return null;

    return resolveUsdaSchedule({
      name: event.name,
      seasonProductsHtml: detail.seasonproducts,
    });
  }

  private fromUsdaParsed(schedule: UsdaParsedSchedule): ResolvedMarketSchedule {
    const { startHour, endHour } = sanitizeMarketHours(schedule.startHour, schedule.endHour);
    return {
      runsOnDays: [...schedule.runsOnDays],
      typicalDayOfWeek: schedule.typicalDay,
      typicalStartHour: startHour,
      typicalEndHour: endHour,
      hoursSummary: schedule.hoursSummary,
      openingHours: schedule.openingHours,
      seasonalSchedule: schedule.seasonalSchedule,
      scheduleSource: schedule.source,
      confidence: schedule.source === 'usda_detail' ? 'high' : 'medium',
    };
  }

  private fromExistingMetadata(
    event: Event,
    metadata: Record<string, unknown>,
  ): ResolvedMarketSchedule {
    const runsOnDays = normalizeDays(
      Array.isArray(metadata.runs_on_days)
        ? (metadata.runs_on_days as string[])
        : undefined,
    );
    const typicalDay =
      typeof metadata.typical_day === 'string'
        ? metadata.typical_day.toLowerCase()
        : runsOnDays[0];
    const startHour = clampHour(metadata.start_hour, 8);
    const endHour = clampHour(metadata.end_hour, 13);
    const { startHour: s, endHour: e } = sanitizeMarketHours(startHour, endHour, event.marketType);

    return {
      runsOnDays,
      typicalDayOfWeek: typicalDay,
      typicalStartHour: s,
      typicalEndHour: e,
      hoursSummary:
        event.hoursSummary?.trim() ||
        `Typically ${typicalDay}s — confirm with organizer`,
      openingHours:
        typeof metadata.opening_hours === 'string' ? metadata.opening_hours : null,
      seasonalSchedule:
        typeof metadata.seasonal_schedule === 'string' ? metadata.seasonal_schedule : null,
      scheduleSource:
        (metadata.schedule_source as ResolvedMarketSchedule['scheduleSource']) ?? 'existing',
      confidence: 'low',
    };
  }

  private async resolveWithAi(
    event: Event,
    metadata: Record<string, unknown>,
    timezone: string,
    usdaFallback: UsdaParsedSchedule | null,
  ): Promise<ResolvedMarketSchedule | null> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    const model = this.config.get<string>('MARKETS_SCHEDULE_AI_MODEL', 'gpt-4o-mini');
    const tzLabel = timezoneAbbreviation(timezone);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a US farmers market schedule researcher. Determine accurate LOCAL wall-clock hours.

Return JSON only:
{
  "runsOnDays": ["saturday"],
  "typicalDayOfWeek": "saturday",
  "typicalStartHour": 8,
  "typicalEndHour": 13,
  "hoursSummary": "Saturdays 8:00 AM – 1:00 PM CT",
  "openingHours": "Sa 08:00-13:00",
  "seasonalSchedule": "May–October or year-round or null",
  "confidence": "high|medium|low",
  "reasoning": "one sentence"
}

CRITICAL RULES:
- typicalStartHour and typicalEndHour are LOCAL 24-hour integers in ${tzLabel} (${timezone}).
- US farmers markets almost NEVER open at 1am–5am. Typical starts: 7–10. Typical ends: 12–15.
- If USDA HTML or website shows AM hours, never return start hours 0–4 unless it is a night market (rare).
- Prefer USDA seasonproducts HTML when present. Parse days like "Saturday: 8:00 AM – 1:00 PM".
- If market name includes a weekday (e.g. "Sunday Farmers Market"), that day is primary.
- hoursSummary must include timezone abbreviation (${tzLabel}).
- openingHours uses OSM format e.g. "Sa 08:00-13:00" for primary day.
- Do not invent evening hours for morning markets.`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              name: event.name,
              city: event.city,
              state: event.state,
              address: event.address,
              website: event.websiteUrl,
              marketType: event.marketType,
              timezone,
              currentHoursSummary: event.hoursSummary,
              currentMetadata: {
                typical_day: metadata.typical_day,
                start_hour: metadata.start_hour,
                end_hour: metadata.end_hour,
                opening_hours: metadata.opening_hours,
                schedule_source: metadata.schedule_source,
              },
              usdaParsed: usdaFallback,
              organizerName: event.organizerName,
            }),
          },
        ],
      }),
    });

    if (!res.ok) return null;

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = payload.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(text) as Partial<ResolvedMarketSchedule> & {
      typicalStartHour?: number;
      typicalEndHour?: number;
      confidence?: string;
    };

    const runsOnDays = normalizeDays(parsed.runsOnDays);
    const typicalDay = parsed.typicalDayOfWeek?.toLowerCase() ?? runsOnDays[0];
    const { startHour, endHour } = sanitizeMarketHours(
      clampHour(parsed.typicalStartHour, 8),
      clampHour(parsed.typicalEndHour, 13),
      event.marketType,
    );

    const confidence =
      parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
        ? parsed.confidence
        : 'medium';

    return {
      runsOnDays,
      typicalDayOfWeek: typicalDay,
      typicalStartHour: startHour,
      typicalEndHour: endHour,
      hoursSummary:
        parsed.hoursSummary?.trim() ||
        usdaFallback?.hoursSummary ||
        event.hoursSummary ||
        `Typically ${typicalDay}s — confirm with organizer`,
      openingHours: parsed.openingHours?.trim() || usdaFallback?.openingHours || null,
      seasonalSchedule:
        parsed.seasonalSchedule?.trim() || usdaFallback?.seasonalSchedule || null,
      scheduleSource: 'ai',
      confidence,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

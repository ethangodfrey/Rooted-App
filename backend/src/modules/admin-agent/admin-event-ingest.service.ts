import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';

export type IngestEventType =
  | 'FESTIVAL'
  | 'POP_UP'
  | 'CITY_MARKET'
  | 'FARMERS_MARKET';

export type IngestedEventDraft = {
  title: string;
  description: string;
  event_type: IngestEventType;
  latitude: number;
  longitude: number;
  start_time: string;
  end_time: string;
  source_url?: string;
  source_snippet?: string;
  scrape_confidence?: number;
};

export type IngestEventsRequest = {
  query?: string;
  region?: string;
  rawText?: string;
  limit?: number;
};

export type IngestEventsResult = {
  ingested: number;
  source: 'openai' | 'simulated';
  query: string;
  eventIds: string[];
  events: Array<{
    id: string;
    title: string;
    event_type: string;
    verification_status: string;
    is_ai_ingested: boolean;
  }>;
};

const EVENT_TYPES = new Set<string>([
  'FESTIVAL',
  'POP_UP',
  'CITY_MARKET',
  'FARMERS_MARKET',
]);

@Injectable()
export class AdminEventIngestService {
  private readonly logger = new Logger(AdminEventIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY', '').trim());
  }

  async ingest(
    adminUserId: string,
    body: IngestEventsRequest = {},
  ): Promise<IngestEventsResult> {
    if (!adminUserId) {
      throw new BadRequestException('Admin user required');
    }

    const query =
      body.query?.trim() ||
      body.rawText?.trim() ||
      'community festivals holiday markets pop-up events near Denver Colorado';
    const region = body.region?.trim() || 'Denver, CO';
    const limit = Math.min(Math.max(body.limit ?? 5, 1), 12);

    let drafts: IngestedEventDraft[] = [];
    let source: 'openai' | 'simulated' = 'simulated';

    if (this.enabled) {
      try {
        drafts = await this.parseWithOpenAi({
          query,
          region,
          rawText: body.rawText?.trim() || '',
          limit,
        });
        source = 'openai';
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`OpenAI ingest failed, using simulated drafts: ${message}`);
        drafts = this.simulatedDrafts(query, region, limit);
      }
    } else {
      drafts = this.simulatedDrafts(query, region, limit);
    }

    const eventIds: string[] = [];
    const events: IngestEventsResult['events'] = [];

    for (const draft of drafts.slice(0, limit)) {
      const normalized = this.normalizeDraft(draft);
      if (!normalized) continue;

      const metadata = {
        tracking_urls: normalized.source_url ? [normalized.source_url] : [],
        source_snippets: normalized.source_snippet
          ? [normalized.source_snippet]
          : [],
        scraping_confidence:
          typeof normalized.scrape_confidence === 'number'
            ? normalized.scrape_confidence
            : 0.55,
        worker_query: query,
        worker_region: region,
        ingested_at: new Date().toISOString(),
        ingest_source: source,
        ingested_by_admin_id: adminUserId,
      };

      const metadataJson = JSON.stringify(metadata);
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          event_type: string;
          verification_status: string;
          is_ai_ingested: boolean;
        }>
      >`
        insert into community_events (
          creator_id,
          title,
          description,
          event_type,
          latitude,
          longitude,
          start_time,
          end_time,
          is_ai_ingested,
          verification_status,
          ai_source_metadata
        )
        values (
          null,
          ${normalized.title},
          ${normalized.description},
          ${normalized.event_type}::community_event_type,
          ${normalized.latitude},
          ${normalized.longitude},
          ${normalized.start_time}::timestamptz,
          ${normalized.end_time}::timestamptz,
          true,
          'pending'::community_event_verification_status,
          ${metadataJson}::jsonb
        )
        returning
          id,
          title,
          event_type::text as event_type,
          verification_status::text as verification_status,
          is_ai_ingested
      `;

      const row = rows[0];
      if (!row) continue;
      eventIds.push(row.id);
      events.push({
        id: row.id,
        title: row.title,
        event_type: row.event_type,
        verification_status: row.verification_status,
        is_ai_ingested: Boolean(row.is_ai_ingested),
      });
    }

    return {
      ingested: events.length,
      source,
      query,
      eventIds,
      events,
    };
  }

  private async parseWithOpenAi(input: {
    query: string;
    region: string;
    rawText: string;
    limit: number;
  }): Promise<IngestedEventDraft[]> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    const model = this.config.get<string>(
      'ADMIN_EVENT_INGEST_AI_MODEL',
      'gpt-4o-mini',
    );

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are Vendorly's local event discovery worker.
Parse search notes / web snippets into clean community event schemas for a live shopper map.
Return JSON only in this exact shape:
{
  "events": [
    {
      "title": "UPPERCASE EVENT TITLE",
      "description": "short plain description",
      "event_type": "FESTIVAL|POP_UP|CITY_MARKET|FARMERS_MARKET",
      "latitude": 39.7392,
      "longitude": -104.9903,
      "start_time": "ISO-8601 timestamptz",
      "end_time": "ISO-8601 timestamptz",
      "source_url": "https://...",
      "source_snippet": "short quote from source",
      "scrape_confidence": 0.0
    }
  ]
}
Rules:
- title MUST be uppercase text
- invent plausible but realistic local festivals, holiday markets, and pop-ups only when raw text is thin
- coordinates must be near the requested region
- end_time must be after start_time
- never include emoji
- return at most ${input.limit} events`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              query: input.query,
              region: input.region,
              rawText: input.rawText,
              limit: input.limit,
            }),
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI HTTP ${res.status}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty OpenAI response');

    const parsed = JSON.parse(content) as { events?: IngestedEventDraft[] };
    if (!Array.isArray(parsed.events)) {
      throw new Error('OpenAI response missing events array');
    }
    return parsed.events;
  }

  private simulatedDrafts(
    query: string,
    region: string,
    limit: number,
  ): IngestedEventDraft[] {
    const now = Date.now();
    const baseLat = region.toLowerCase().includes('denver') ? 39.7392 : 39.8283;
    const baseLng = region.toLowerCase().includes('denver') ? -104.9903 : -98.5795;
    const seeds: IngestedEventDraft[] = [
      {
        title: 'DENVER CHERRY CREEK FESTIVAL',
        description:
          'Seasonal street festival with makers, food stalls, and live community programming.',
        event_type: 'FESTIVAL',
        latitude: baseLat + 0.01,
        longitude: baseLng + 0.01,
        start_time: new Date(now + 3 * 86400000).toISOString(),
        end_time: new Date(now + 3 * 86400000 + 6 * 3600000).toISOString(),
        source_url: 'https://example.com/cherry-creek-festival',
        source_snippet: `Discovered via search for "${query}" in ${region}.`,
        scrape_confidence: 0.62,
      },
      {
        title: 'HOLIDAY NIGHT MARKET',
        description:
          'Evening pop-up market featuring local makers, seasonal produce, and warm drinks.',
        event_type: 'POP_UP',
        latitude: baseLat - 0.015,
        longitude: baseLng + 0.008,
        start_time: new Date(now + 7 * 86400000).toISOString(),
        end_time: new Date(now + 7 * 86400000 + 5 * 3600000).toISOString(),
        source_url: 'https://example.com/holiday-night-market',
        source_snippet: 'Holiday market listing from local events crawl.',
        scrape_confidence: 0.58,
      },
      {
        title: 'RIVER NORTH CITY MARKET',
        description:
          'Weekend city market with produce vendors, prepared foods, and craft booths.',
        event_type: 'CITY_MARKET',
        latitude: baseLat + 0.02,
        longitude: baseLng - 0.012,
        start_time: new Date(now + 10 * 86400000).toISOString(),
        end_time: new Date(now + 10 * 86400000 + 4 * 3600000).toISOString(),
        source_url: 'https://example.com/rino-city-market',
        source_snippet: 'City market schedule scraped from community calendar.',
        scrape_confidence: 0.7,
      },
      {
        title: 'HIGHLANDS FARMERS MARKET POP-UP',
        description:
          'Neighborhood farmers market pop-up with regional growers and specialty foods.',
        event_type: 'FARMERS_MARKET',
        latitude: baseLat - 0.008,
        longitude: baseLng - 0.02,
        start_time: new Date(now + 14 * 86400000).toISOString(),
        end_time: new Date(now + 14 * 86400000 + 4 * 3600000).toISOString(),
        source_url: 'https://example.com/highlands-farmers-market',
        source_snippet: 'Farmers market pop-up discovered by AI search worker.',
        scrape_confidence: 0.66,
      },
      {
        title: 'UNION STATION FOOD FESTIVAL',
        description:
          'Indoor/outdoor food festival highlighting local chefs and market vendors.',
        event_type: 'FESTIVAL',
        latitude: baseLat + 0.004,
        longitude: baseLng - 0.004,
        start_time: new Date(now + 18 * 86400000).toISOString(),
        end_time: new Date(now + 18 * 86400000 + 8 * 3600000).toISOString(),
        source_url: 'https://example.com/union-station-food-festival',
        source_snippet: 'Festival page matched by live search worker.',
        scrape_confidence: 0.6,
      },
    ];
    return seeds.slice(0, limit);
  }

  private normalizeDraft(draft: IngestedEventDraft): IngestedEventDraft | null {
    const title = String(draft.title ?? '')
      .trim()
      .toUpperCase();
    const description = String(draft.description ?? '').trim();
    let eventType = String(draft.event_type ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
    if (eventType === 'HOLIDAY_MARKET') eventType = 'POP_UP';
    if (!EVENT_TYPES.has(eventType)) eventType = 'FESTIVAL';

    const latitude = Number(draft.latitude);
    const longitude = Number(draft.longitude);
    const start = new Date(draft.start_time);
    const end = new Date(draft.end_time);

    if (!title || title.length < 4) return null;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (end <= start) return null;

    return {
      title,
      description: description || 'AI ingested local community event.',
      event_type: eventType as IngestEventType,
      latitude,
      longitude,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      source_url: draft.source_url?.trim(),
      source_snippet: draft.source_snippet?.trim(),
      scrape_confidence:
        typeof draft.scrape_confidence === 'number'
          ? Math.min(1, Math.max(0, draft.scrape_confidence))
          : undefined,
    };
  }
}

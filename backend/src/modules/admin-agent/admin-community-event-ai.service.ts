import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';

export type CommunityEventAiRecommendation = 'approve' | 'reject' | 'needs_review';

export type CommunityEventAiProfile = {
  id: string;
  title: string;
  description: string;
  eventType: string;
  latitude: number;
  longitude: number;
  startTime: Date;
  endTime: Date;
  isAiIngested: boolean;
  creatorId: string;
};

export type CommunityEventAiResult = {
  eventId: string;
  recommendation: CommunityEventAiRecommendation;
  confidence: number;
  summary: string;
  flags: string[];
  reasons: string[];
  source: 'rules' | 'openai';
};

type CommunityEventRow = {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  latitude: number;
  longitude: number;
  start_time: Date;
  end_time: Date;
  is_ai_ingested: boolean;
  creator_id: string;
};

const VALID = new Set(['approve', 'reject', 'needs_review']);

@Injectable()
export class AdminCommunityEventAiService {
  private readonly logger = new Logger(AdminCommunityEventAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY', '').trim());
  }

  reviewRules(event: CommunityEventAiProfile): Omit<CommunityEventAiResult, 'eventId' | 'source'> {
    const flags: string[] = [];
    const reasons: string[] = [];

    const title = event.title.trim();
    const description = event.description.trim();
    const durationHours =
      (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60 * 60);

    if (title.length < 4) {
      flags.push('title_too_short');
      reasons.push('Title is too short to identify the event.');
    }
    if (description.length < 20) {
      flags.push('thin_description');
      reasons.push('Description is thin — shoppers need more context.');
    }
    if (!Number.isFinite(event.latitude) || !Number.isFinite(event.longitude)) {
      flags.push('invalid_coordinates');
      reasons.push('Latitude/longitude are invalid.');
    }
    if (Math.abs(event.latitude) < 0.01 && Math.abs(event.longitude) < 0.01) {
      flags.push('null_island_coords');
      reasons.push('Coordinates look like a placeholder (near 0,0).');
    }
    if (event.endTime <= event.startTime) {
      flags.push('invalid_time_range');
      reasons.push('End time must be after start time.');
    }
    if (durationHours > 24 * 14) {
      flags.push('unusually_long');
      reasons.push('Event spans more than two weeks — confirm this is intentional.');
    }
    if (event.endTime.getTime() < Date.now()) {
      flags.push('already_ended');
      reasons.push('Event end time is already in the past.');
    }
    if (!['FESTIVAL', 'POP_UP', 'CITY_MARKET', 'FARMERS_MARKET'].includes(event.eventType)) {
      flags.push('unknown_type');
      reasons.push('Event type is not a recognized community listing type.');
    }

    const summaryBase = `${event.eventType.replace(/_/g, ' ')} · ${title}`;

    if (flags.includes('invalid_coordinates') || flags.includes('invalid_time_range')) {
      return {
        recommendation: 'reject',
        confidence: 0.8,
        summary: `${summaryBase} — hard validation failures; reject or ask host to fix.`,
        flags,
        reasons,
      };
    }

    if (flags.length === 0) {
      return {
        recommendation: 'approve',
        confidence: 0.75,
        summary: `${summaryBase} — listing looks complete for a local community event.`,
        flags: ['rules_complete'],
        reasons: [
          'Title, description, coordinates, and schedule look usable.',
          'Human admin should still spot-check the location on a map.',
        ],
      };
    }

    return {
      recommendation: 'needs_review',
      confidence: 0.65,
      summary: `${summaryBase} — needs admin attention before approval.`,
      flags,
      reasons,
    };
  }

  async verify(eventId: string): Promise<CommunityEventAiResult> {
    const rows = await this.prisma.$queryRaw<CommunityEventRow[]>`
      select
        id,
        title,
        description,
        event_type,
        latitude::float8 as latitude,
        longitude::float8 as longitude,
        start_time,
        end_time,
        is_ai_ingested,
        creator_id
      from community_events
      where id = ${eventId}::uuid
      limit 1
    `;

    const row = rows[0];
    if (!row) throw new NotFoundException('Community event not found');

    const profile: CommunityEventAiProfile = {
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      eventType: row.event_type,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      isAiIngested: Boolean(row.is_ai_ingested),
      creatorId: row.creator_id,
    };

    let result = this.reviewRules(profile);
    let source: 'rules' | 'openai' = 'rules';

    if (this.enabled) {
      try {
        const ai = await this.reviewWithOpenAi(profile, result);
        result = ai;
        source = 'openai';
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`AI community event verify failed for ${eventId}: ${message}`);
      }
    }

    const flagsJoined = result.flags.join('\u001f');
    await this.prisma.$executeRaw`
      update community_events
      set
        ai_recommendation = ${result.recommendation},
        ai_confidence = ${result.confidence},
        ai_summary = ${result.summary},
        ai_flags = coalesce(
          string_to_array(nullif(${flagsJoined}, ''), chr(31)),
          '{}'::text[]
        ),
        ai_reviewed_at = now(),
        updated_at = now()
      where id = ${eventId}::uuid
    `;

    return {
      eventId,
      ...result,
      source,
    };
  }

  private async reviewWithOpenAi(
    event: CommunityEventAiProfile,
    rules: Omit<CommunityEventAiResult, 'eventId' | 'source'>,
  ): Promise<Omit<CommunityEventAiResult, 'eventId' | 'source'>> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    const model = this.config.get<string>('ADMIN_COMMUNITY_EVENT_AI_MODEL', 'gpt-4o-mini');

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
            content: `You help Vendorly admins verify community events before they appear on the shopper map.
Return JSON only:
{
  "recommendation": "approve|reject|needs_review",
  "confidence": 0.0-1.0,
  "summary": "short reason",
  "flags": ["snake_case"],
  "reasons": ["short bullets"]
}
Rules:
- reject spam, scammy, or clearly fake coordinates/times
- needs_review when uncertain
- approve only when the listing looks like a real local festival, pop-up, city market, or farmers market
- never invent facts not present in the payload`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              event,
              rulesBaseline: rules,
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

    const parsed = JSON.parse(content) as {
      recommendation?: string;
      confidence?: number;
      summary?: string;
      flags?: string[];
      reasons?: string[];
    };

    const recommendation = VALID.has(parsed.recommendation ?? '')
      ? (parsed.recommendation as CommunityEventAiRecommendation)
      : rules.recommendation;

    return {
      recommendation,
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.min(1, Math.max(0, parsed.confidence))
          : rules.confidence,
      summary: parsed.summary?.trim() || rules.summary,
      flags: Array.isArray(parsed.flags) ? parsed.flags.map(String) : rules.flags,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : rules.reasons,
    };
  }
}

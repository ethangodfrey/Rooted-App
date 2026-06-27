import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Event, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CLASSIFY_AI_VERSION,
  classifyListingWithHeuristics,
  parseAiClassificationPayload,
  parseUsdaDirectory,
  type ClassificationResult,
} from './markets-classify.util';

export interface ClassifyEnrichResult {
  processed: number;
  updated: number;
  fromHeuristic: number;
  fromAi: number;
  relabeledBusiness: number;
  hiddenFromShopper: number;
  skipped: number;
  remaining: number;
  errors: string[];
}

@Injectable()
export class MarketsClassifyAiService {
  private readonly logger = new Logger(MarketsClassifyAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get aiEnabled(): boolean {
    return Boolean(this.config.get<string>('OPENAI_API_KEY', '').trim());
  }

  private pendingWhereClause(forceAll: boolean): Prisma.EventWhereInput {
    if (forceAll) {
      return { visibilityStatus: 'public' };
    }

    return {
      visibilityStatus: 'public',
      OR: [
        {
          syncMetadata: {
            path: ['classify_ai_version'],
            not: CLASSIFY_AI_VERSION,
          },
        },
        {
          syncMetadata: {
            path: ['classify_ai_version'],
            equals: Prisma.DbNull,
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
  ): Promise<ClassifyEnrichResult> {
    const useAi = options.useAi ?? this.aiEnabled;
    const forceAll = options.forceAll ?? false;
    const delayMs = Number(this.config.get<string>('MARKETS_CLASSIFY_AI_DELAY_MS', '150')) || 150;

    const events = await this.prisma.event.findMany({
      where: this.pendingWhereClause(forceAll),
      take: batchSize,
      orderBy: { id: 'asc' },
    });

    let updated = 0;
    let fromHeuristic = 0;
    let fromAi = 0;
    let relabeledBusiness = 0;
    let hiddenFromShopper = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const outcome = await this.classifyEvent(event, useAi);
        if (outcome.status === 'skipped') {
          skipped += 1;
        } else {
          updated += 1;
          if (outcome.status === 'heuristic') fromHeuristic += 1;
          if (outcome.status === 'ai') fromAi += 1;
          if (outcome.category === 'local_business') relabeledBusiness += 1;
          if (!outcome.isShopperMarket) hiddenFromShopper += 1;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${event.id}: ${message}`);
        this.logger.warn(`Classify failed for ${event.id}: ${message}`);
      }

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    const remaining = await this.countPending(forceAll);

    return {
      processed: events.length,
      updated,
      fromHeuristic,
      fromAi,
      relabeledBusiness,
      hiddenFromShopper,
      skipped,
      remaining,
      errors,
    };
  }

  private async classifyEvent(
    event: Event,
    useAi: boolean,
  ): Promise<
    | { status: 'skipped' }
    | { status: 'heuristic' | 'ai'; category: string; isShopperMarket: boolean }
  > {
    const metadata = (event.syncMetadata ?? {}) as Record<string, unknown>;
    const input = {
      name: event.name,
      city: event.city,
      state: event.state,
      address: event.address,
      description: event.description,
      hoursSummary: event.hoursSummary,
      extraInfo: event.extraInfo,
      websiteUrl: event.websiteUrl,
      externalSource: event.externalSource,
      externalId: event.externalId,
      currentMarketType: event.marketType,
    };

    let classification = classifyListingWithHeuristics(input);
    let updateSource: 'heuristic' | 'ai' = 'heuristic';

    const needsAi =
      useAi &&
      this.aiEnabled &&
      (classification.confidence === 'low' ||
        classification.category === 'unknown' ||
        (parseUsdaDirectory(event.externalId) === 'farmersmarket' &&
          !classification.isShopperMarket &&
          classification.category !== 'local_business'));

    if (needsAi) {
      const aiResult = await this.classifyWithAi(event, metadata);
      if (aiResult) {
        classification = { ...aiResult, source: 'ai' };
        updateSource = 'ai';
      }
    }

    const changed =
      event.marketType !== classification.category ||
      metadata.classify_ai_version !== CLASSIFY_AI_VERSION ||
      metadata.classify_category !== classification.category ||
      metadata.is_shopper_market !== classification.isShopperMarket;

    if (!changed) return { status: 'skipped' };

    await this.prisma.event.update({
      where: { id: event.id },
      data: {
        marketType: classification.category,
        syncMetadata: {
          ...metadata,
          classify_ai_version: CLASSIFY_AI_VERSION,
          classify_category: classification.category,
          classify_confidence: classification.confidence,
          classify_source: classification.source,
          classify_reasoning: classification.reasoning,
          is_shopper_market: classification.isShopperMarket,
          usda_directory: parseUsdaDirectory(event.externalId),
        } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return {
      status: updateSource,
      category: classification.category,
      isShopperMarket: classification.isShopperMarket,
    };
  }

  private async classifyWithAi(
    event: Event,
    metadata: Record<string, unknown>,
  ): Promise<ClassificationResult | null> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '').trim();
    const model = this.config.get<string>('MARKETS_CLASSIFY_AI_MODEL', 'gpt-4o-mini');
    const directory = parseUsdaDirectory(event.externalId);

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
            content: `You classify US local food listings for a shoppers app focused on weekend farmers markets.

Return JSON only:
{
  "category": "farmers_market|on_farm_market|csa|food_hub|agritourism|farm_stand|flea_market|craft_market|public_market|local_business|mixed|unknown",
  "confidence": "high|medium|low",
  "reasoning": "one sentence",
  "isShopperMarket": true
}

DEFINITIONS:
- farmers_market: Recurring multi-vendor outdoor/indoor market (often weekend) where shoppers buy produce directly.
- on_farm_market / farm_stand: Single-farm direct sales, not a community farmers market.
- csa: Community Supported Agriculture subscription/share program.
- food_hub: Wholesale aggregation/distribution for institutions or stores.
- agritourism: Farm tours, u-pick, corn mazes, farm stays — not a recurring market.
- local_business: Restaurant, cafe, grocery, butcher shop, garden center, etc. even if USDA listed it.
- flea_market / craft_market / public_market: Other recurring markets (not necessarily farm-focused).
- mixed: Recurring market with diverse vendors including some local food.
- unknown: Genuinely unclear.

isShopperMarket = true ONLY for recurring markets shoppers would visit (farmers_market, flea_market, craft_market, public_market, mixed).
isShopperMarket = false for local_business, csa, food_hub, agritourism, on_farm_market, farm_stand.

IMPORTANT:
- A name containing "Market" does NOT automatically mean farmers_market. "Meat Market", "Fish Market", "Garden Market nursery", "Whole Foods Market" = local_business.
- USDA farmersmarket directory can include misclassified businesses — scrutinize the name.
- When in doubt between farmers_market and local_business, prefer local_business if hours sound like daily retail.`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              name: event.name,
              city: event.city,
              state: event.state,
              address: event.address,
              description: event.description,
              hoursSummary: event.hoursSummary,
              extraInfo: event.extraInfo,
              website: event.websiteUrl,
              usdaDirectory: directory,
              currentMarketType: event.marketType,
              heuristicHint: classifyListingWithHeuristics({
                name: event.name,
                city: event.city,
                state: event.state,
                address: event.address,
                description: event.description,
                hoursSummary: event.hoursSummary,
                extraInfo: event.extraInfo,
                websiteUrl: event.websiteUrl,
                externalSource: event.externalSource,
                externalId: event.externalId,
                currentMarketType: event.marketType,
              }),
              syncMetadata: {
                schedule_source: metadata.schedule_source,
                runs_on_days: metadata.runs_on_days,
                opening_hours: metadata.opening_hours,
              },
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
    const parsed = parseAiClassificationPayload(JSON.parse(text));
    if (!parsed) return null;

    return {
      category: parsed.category,
      confidence: parsed.confidence,
      source: 'ai',
      reasoning: parsed.reasoning,
      isShopperMarket: parsed.isShopperMarket,
    };
  }
}

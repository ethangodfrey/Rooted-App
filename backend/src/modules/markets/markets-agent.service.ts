import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { nextMarketWindow } from './market-schedule.util';
import { resolveTimezone } from './timezone.util';
import { normalizeWebsiteUrl } from './website.util';
import { MarketsAiService } from './markets-ai.service';
import { MarketsDiscoveryService } from './markets-discovery.service';
import { MarketsEnrichmentService } from './markets-enrichment.service';
import { MarketsImageService } from './markets-image.service';
import type { DiscoveredMarket, EnrichedMarketProfile, MarketAgentRunResult } from './markets.types';
import { MARKETS_ENRICHMENT_VERSION } from './markets.types';

const AGENT_VERSION = '3.0.0';

@Injectable()
export class MarketsAgentService {
  private readonly logger = new Logger(MarketsAgentService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: MarketsDiscoveryService,
    private readonly enrichment: MarketsEnrichmentService,
    private readonly images: MarketsImageService,
    private readonly ai: MarketsAiService,
    private readonly config: ConfigService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>('MARKETS_AGENT_ENABLED', 'false').toLowerCase() === 'true';
  }

  async run(trigger: 'scheduled' | 'manual' = 'scheduled'): Promise<MarketAgentRunResult> {
    if (this.running) {
      throw new Error('Market agent is already running');
    }

    this.running = true;
    const errors: string[] = [];
    let discovered = 0;
    let inserted = 0;
    let updated = 0;
    let enriched = 0;
    let skipped = 0;

    const run = await this.prisma.marketSyncRun.create({
      data: {
        status: 'running',
        agentVersion: AGENT_VERSION,
        notes: `trigger=${trigger}`,
      },
    });

    try {
      this.logger.log(`Market agent run ${run.id} started (${trigger})`);

      const discoveryEnabled =
        this.config.get<string>('MARKETS_DISCOVERY_ENABLED', 'true').toLowerCase() === 'true';
      const enrichWithAi =
        this.config.get<string>('MARKETS_AI_ENRICH', 'true').toLowerCase() === 'true';

      if (discoveryEnabled) {
        const markets = await this.discovery.discoverFromOpenStreetMap();
        discovered = markets.length;

        for (const market of markets) {
          try {
            const result = await this.upsertMarket(market, enrichWithAi);
            if (result === 'inserted') inserted += 1;
            else if (result === 'updated') updated += 1;
            else skipped += 1;
            if (result !== 'skipped') enriched += 1;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`${market.externalId}: ${message}`);
          }
        }
      }

      const refreshed = await this.refreshExistingMarkets(enrichWithAi, errors);
      enriched += refreshed;
      updated += refreshed;

      const catalog = await this.enrichment.enrichPending(errors);
      enriched += catalog.enriched;
      updated += catalog.enriched;

      const status = errors.length > 0 ? (inserted + updated > 0 ? 'partial' : 'failed') : 'success';
      await this.prisma.marketSyncRun.update({
        where: { id: run.id },
        data: {
          status,
          finishedAt: new Date(),
          discovered,
          inserted,
          updated,
          skipped,
          errors,
        },
      });

      this.logger.log(
        `Market agent run ${run.id} finished: discovered=${discovered} inserted=${inserted} updated=${updated} enriched=${enriched} catalogRemaining=${catalog.remaining} skipped=${skipped} errors=${errors.length}`,
      );

      return {
        runId: run.id,
        discovered,
        inserted,
        updated,
        enriched,
        catalogEnriched: catalog.enriched,
        catalogRemaining: catalog.remaining,
        skipped,
        errors,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      await this.prisma.marketSyncRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          discovered,
          inserted,
          updated,
          skipped,
          errors,
        },
      });
      throw err;
    } finally {
      this.running = false;
    }
  }

  /** Re-enrich agent-managed markets not synced in the last 24 hours. */
  private async refreshExistingMarkets(enrichWithAi: boolean, errors: string[]): Promise<number> {
    const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const batchSize = Number(this.config.get<string>('MARKETS_REFRESH_BATCH', '500')) || 500;
    let refreshed = 0;

    for (;;) {
      const stale = await this.prisma.event.findMany({
        where: {
          externalSource: { not: null },
          OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: staleBefore } }],
        },
        take: batchSize,
      });

      if (stale.length === 0) break;

      for (const event of stale) {
        try {
          const metadata = (event.syncMetadata ?? {}) as Record<string, unknown>;
          const rediscovered: DiscoveredMarket = {
            externalSource: event.externalSource ?? 'openstreetmap',
            externalId: event.externalId ?? event.id,
            name: event.name,
            description: event.description ?? '',
            organizerName: event.organizerName,
            address: event.address,
            city: event.city ?? '',
            state: event.state ?? '',
            zipcode: null,
            latitude: Number(event.latitude),
            longitude: Number(event.longitude),
            parkingInfo: event.parkingInfo,
            admissionInfo: event.admissionInfo ?? 'Free admission.',
            openingHours: typeof metadata.opening_hours === 'string' ? metadata.opening_hours : null,
            website:
              event.websiteUrl ??
              (typeof metadata.website === 'string' ? metadata.website : null),
            rawTags: (metadata.raw_tags as Record<string, string>) ?? {},
          };

          const profile = enrichWithAi
            ? await this.ai.enrich(rediscovered)
            : this.profileFromEvent(event, rediscovered);

          const timezone = resolveTimezone(
            Number(event.latitude),
            Number(event.longitude),
            event.state,
          );

          const { start, end } = nextMarketWindow(
            profile.typicalDayOfWeek,
            profile.typicalStartHour,
            profile.typicalEndHour,
            timezone,
          );

          await this.prisma.event.update({
            where: { id: event.id },
            data: { ...this.buildEventData(rediscovered, profile, start, end), timezone },
          });
          refreshed += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`refresh:${event.id}: ${message}`);
        }
      }

    }

    return refreshed;
  }

  private profileFromEvent(
    event: {
      description: string | null;
      marketHistory: string | null;
      whatToLookFor: string | null;
      marketHighlights: string | null;
      parkingInfo: string | null;
      admissionInfo: string | null;
      marketType: string | null;
      hoursSummary: string | null;
      websiteUrl: string | null;
      extraInfo: string | null;
      organizerName: string | null;
      bannerUrl: string | null;
      timezone: string | null;
      state: string | null;
    },
    market: DiscoveredMarket,
  ): EnrichedMarketProfile {
    return {
      description: event.description ?? market.description,
      marketHistory: event.marketHistory,
      marketType: (event.marketType as EnrichedMarketProfile['marketType']) ?? 'unknown',
      hoursSummary: event.hoursSummary ?? 'Typically Saturdays morning; confirm with organizer.',
      runsOnDays: ['saturday'],
      seasonalSchedule: null,
      parkingInfo: event.parkingInfo,
      admissionInfo: event.admissionInfo ?? market.admissionInfo,
      vendorTypes: null,
      paymentMethods: null,
      extraInfo: event.extraInfo,
      whatToLookFor: event.whatToLookFor,
      marketHighlights: event.marketHighlights,
      featuredVendorCategories: [],
      shopperTips: [],
      websiteUrl: event.websiteUrl ?? market.website,
      organizerName: event.organizerName ?? market.organizerName,
      wikipediaTitle: null,
      bannerUrl: event.bannerUrl ?? null,
      imageSource: null,
      timezone: event.timezone ?? resolveTimezone(market.latitude, market.longitude, market.state),
      typicalDayOfWeek: 'saturday',
      typicalStartHour: 8,
      typicalEndHour: 13,
      enrichedBy: 'rules',
    };
  }

  private async upsertMarket(
    market: DiscoveredMarket,
    enrichWithAi: boolean,
  ): Promise<'inserted' | 'updated' | 'skipped'> {
    const now = new Date();

    const syncMetadata = {
      opening_hours: market.openingHours,
      website: market.website,
      raw_tags: market.rawTags,
      zipcode: market.zipcode,
    };

    const existing = await this.prisma.event.findUnique({
      where: {
        externalSource_externalId: {
          externalSource: market.externalSource,
          externalId: market.externalId,
        },
      },
      select: { id: true, lastSyncedAt: true },
    });

    const shouldEnrich =
      enrichWithAi &&
      (!existing ||
        this.config.get<string>('MARKETS_AI_ENRICH_ALWAYS', 'false').toLowerCase() === 'true' ||
        !existing.lastSyncedAt ||
        existing.lastSyncedAt.getTime() < Date.now() - 24 * 60 * 60 * 1000);

    if (existing && !shouldEnrich) {
      return 'skipped';
    }

    const profile = shouldEnrich ? await this.ai.enrich(market) : this.ai.enrichRules(market);

    const timezone = resolveTimezone(market.latitude, market.longitude, market.state);

    const { start, end } = nextMarketWindow(
      profile.typicalDayOfWeek,
      profile.typicalStartHour,
      profile.typicalEndHour,
      timezone,
    );

    const data = { ...this.buildEventData(market, profile, start, end, syncMetadata, now), timezone };

    if (existing) {
      await this.prisma.event.update({
        where: { id: existing.id },
        data,
      });
      await this.attachImage(existing.id, market, profile.wikipediaTitle);
      return 'updated';
    }

    const created = await this.prisma.event.create({
      data: {
        ...data,
        externalSource: market.externalSource,
        externalId: market.externalId,
      },
    });
    await this.attachImage(created.id, market, profile.wikipediaTitle);
    return 'inserted';
  }

  private async attachImage(
    eventId: string,
    market: DiscoveredMarket,
    wikipediaTitle: string | null,
  ): Promise<void> {
    const image = await this.images.findImage(market, { eventId, wikipediaTitle });
    if (!image) return;

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { syncMetadata: true },
    });
    const metadata = (event?.syncMetadata ?? {}) as Record<string, unknown>;

    await this.prisma.event.update({
      where: { id: eventId },
      data: {
        bannerUrl: image.url,
        syncMetadata: {
          ...metadata,
          image_source: image.source,
          image_verified: image.imageVerified ?? true,
          ...(image.wikipediaFromOsm ? { wikipedia_from_osm: true } : {}),
          ...(typeof image.visionConfidence === 'number'
            ? { vision_confidence: image.visionConfidence }
            : {}),
          ...(image.visionReason ? { vision_reason: image.visionReason } : {}),
          ...(image.googlePhotoReference
            ? {
                google_photo_reference: image.googlePhotoReference,
                google_place_id: image.googlePlaceId,
                google_place_name: image.googlePlaceName,
              }
            : {}),
        } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
  }

  private buildEventData(
    market: DiscoveredMarket,
    profile: EnrichedMarketProfile,
    start: Date,
    end: Date,
    syncMetadata?: Prisma.InputJsonValue,
    now = new Date(),
  ) {
    const metadata: Prisma.InputJsonValue =
      syncMetadata ??
      ({
        opening_hours: market.openingHours,
        website: market.website,
        raw_tags: market.rawTags,
        zipcode: market.zipcode,
        enriched_by: profile.enrichedBy,
        enrichment_version: MARKETS_ENRICHMENT_VERSION,
        runs_on_days: profile.runsOnDays,
        typical_day: profile.typicalDayOfWeek,
        start_hour: profile.typicalStartHour,
        end_hour: profile.typicalEndHour,
        seasonal_schedule: profile.seasonalSchedule,
        vendor_types: profile.vendorTypes,
        payment_methods: profile.paymentMethods,
        image_source: profile.imageSource,
        wikipedia_title: profile.wikipediaTitle,
      } as Prisma.InputJsonValue);

    return {
      name: market.name,
      description: profile.description,
      marketHistory: profile.marketHistory,
      bannerUrl: profile.bannerUrl,
      organizerName: profile.organizerName ?? market.organizerName,
      address: market.address,
      city: market.city,
      state: market.state,
      latitude: new Prisma.Decimal(market.latitude),
      longitude: new Prisma.Decimal(market.longitude),
      startDatetime: start,
      endDatetime: end,
      eventStatus: 'upcoming',
      visibilityStatus: 'public',
      parkingInfo: profile.parkingInfo,
      admissionInfo: profile.admissionInfo,
      marketType: profile.marketType,
      hoursSummary: profile.hoursSummary,
      websiteUrl: normalizeWebsiteUrl(profile.websiteUrl),
      extraInfo: profile.extraInfo,
      lastSyncedAt: now,
      syncMetadata: metadata,
      updatedAt: now,
    };
  }
}

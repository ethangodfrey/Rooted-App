import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Event, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { nextMarketWindow } from './market-schedule.util';
import { MarketsAiService } from './markets-ai.service';
import { MarketsImageService } from './markets-image.service';
import { MarketsNominatimService } from './markets-nominatim.service';
import type { DiscoveredMarket, MarketEnrichResult } from './markets.types';
import { MARKETS_ENRICHMENT_VERSION } from './markets.types';
import { resolveSchedule } from './schedule-metadata.util';
import { resolveTimezone } from './timezone.util';
import { extractWebsite } from './website.util';
import {
  extractMarketLinks,
  normalizeMarketWebsiteUrl,
} from './market-links.util';

export interface TimesWebsiteBackfillResult {
  processed: number;
  updated: number;
  remaining: number;
  lastId: string | null;
  errors: string[];
}

@Injectable()
export class MarketsEnrichmentService {
  private readonly logger = new Logger(MarketsEnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: MarketsAiService,
    private readonly nominatim: MarketsNominatimService,
    private readonly images: MarketsImageService,
    private readonly config: ConfigService,
  ) {}

  async countPending(): Promise<number> {
    return this.prisma.event.count({ where: this.pendingWhere() });
  }

  async enrichPending(errors: string[] = [], limit?: number): Promise<MarketEnrichResult> {
    const batchSize =
      limit ?? (Number(this.config.get<string>('MARKETS_ENRICH_BATCH', '50')) || 50);
    const enrichWithAi =
      this.config.get<string>('MARKETS_AI_ENRICH', 'true').toLowerCase() === 'true';
    const aiDelay = Number(this.config.get<string>('MARKETS_ENRICH_DELAY_MS', '300')) || 300;

    const pending = await this.prisma.event.findMany({
      where: this.pendingWhere(),
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    let enriched = 0;
    let skipped = 0;
    const localErrors: string[] = [];

    for (const event of pending) {
      try {
        const didEnrich = await this.enrichEvent(event, enrichWithAi);
        if (didEnrich) enriched += 1;
        else skipped += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        localErrors.push(`${event.id}: ${message}`);
      }

      if (enrichWithAi && this.ai.enabled) {
        await this.sleep(aiDelay);
      }
    }

    errors.push(...localErrors);

    const remaining = await this.countPending();
    this.logger.log(
      `Catalog enrich batch: processed=${pending.length} enriched=${enriched} skipped=${skipped} remaining=${remaining}`,
    );

    return {
      processed: pending.length,
      enriched,
      skipped,
      remaining,
      errors: localErrors,
    };
  }

  /**
   * Fast backfill: correct local timezone + start/end times + website for every event.
   * No AI calls — uses coordinates, stored schedule metadata, and OSM tags.
   */
  async backfillTimesAndWebsites(
    batchSize = 100,
    afterId?: string,
  ): Promise<TimesWebsiteBackfillResult> {
    const events = await this.prisma.event.findMany({
      where: afterId ? { id: { gt: afterId } } : undefined,
      take: batchSize,
      orderBy: { id: 'asc' },
    });

    let updated = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const didUpdate = await this.applyTimesAndWebsite(event);
        if (didUpdate) updated += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${event.id}: ${message}`);
      }
    }

    const lastId = events.length > 0 ? events[events.length - 1].id : afterId ?? null;
    const remaining = lastId
      ? await this.prisma.event.count({ where: { id: { gt: lastId } } })
      : 0;

    this.logger.log(
      `Times/website backfill: processed=${events.length} updated=${updated} remaining=${remaining}`,
    );

    return { processed: events.length, updated, remaining, lastId, errors };
  }

  /** Backfill banner images for events missing photos (Wikipedia/OSM/Wikimedia). */
  async backfillImages(batchSize = 50, afterId?: string) {
    const events = await this.prisma.event.findMany({
      where: {
        bannerUrl: null,
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      take: batchSize,
      orderBy: { id: 'asc' },
    });

    let updated = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const market = this.eventToDiscoveredMarket(event);
        const metadata = (event.syncMetadata ?? {}) as Record<string, unknown>;
        const wikipediaTitle =
          typeof metadata.wikipedia_title === 'string' ? metadata.wikipedia_title : null;

        const image = await this.images.findImage(market, {
          wikipediaTitle,
          eventId: event.id,
        });
        if (!image) continue;

        await this.prisma.event.update({
          where: { id: event.id },
          data: {
            bannerUrl: image.url,
            syncMetadata: this.mergeImageMetadata(metadata, image),
            updatedAt: new Date(),
          },
        });
        updated += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${event.id}: ${message}`);
      }
      await this.sleep(300);
    }

    const lastId = events.length > 0 ? events[events.length - 1].id : afterId ?? null;
    const remaining = await this.prisma.event.count({ where: { bannerUrl: null } });

    this.logger.log(`Image backfill: processed=${events.length} updated=${updated} remaining=${remaining}`);

    return { processed: events.length, updated, remaining, lastId, errors };
  }

  /** Backfill photos via Google Places for events missing banners (or all when replace=true). */
  async backfillGooglePlacesImages(batchSize = 30, afterId?: string, replace = false) {
    const events = await this.prisma.event.findMany({
      where: {
        ...(replace
          ? {}
          : { bannerUrl: null }),
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      take: batchSize,
      orderBy: { id: 'asc' },
    });

    let updated = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const metadata = (event.syncMetadata ?? {}) as Record<string, unknown>;
        if (!replace && metadata.image_source === 'google_places') continue;

        const market = this.eventToDiscoveredMarket(event);
        const image = await this.images.findImage(market, {
          eventId: event.id,
          googleOnly: true,
        });
        if (!image) continue;

        await this.prisma.event.update({
          where: { id: event.id },
          data: {
            bannerUrl: image.url,
            syncMetadata: this.mergeImageMetadata(metadata, image),
            updatedAt: new Date(),
          },
        });
        updated += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${event.id}: ${message}`);
      }
      await this.sleep(350);
    }

    const lastId = events.length > 0 ? events[events.length - 1].id : afterId ?? null;
    const remaining = await this.prisma.event.count({
      where: replace ? {} : { bannerUrl: null },
    });

    this.logger.log(
      `Google Places image backfill: processed=${events.length} updated=${updated} remaining=${remaining}`,
    );

    return { processed: events.length, updated, remaining, lastId, errors };
  }

  /** Remove banner images that are not verified for the specific market. */
  async purgeUntrustedEventImages(batchSize = 100, afterId?: string) {
    const events = await this.prisma.event.findMany({
      where: {
        bannerUrl: { not: null },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      take: batchSize,
      orderBy: { id: 'asc' },
      select: { id: true, bannerUrl: true, syncMetadata: true },
    });

    let purged = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const metadata = (event.syncMetadata ?? {}) as Record<string, unknown>;
        const source =
          typeof metadata.image_source === 'string' ? metadata.image_source : null;

        const verified =
          metadata.image_verified === true ||
          (source === 'osm_image' ||
            source === 'wikimedia_commons' ||
            source === 'wikidata' ||
            source === 'google_places' ||
            (source === 'wikipedia' && metadata.wikipedia_from_osm === true));

        if (verified) continue;

        await this.prisma.event.update({
          where: { id: event.id },
          data: {
            bannerUrl: null,
            syncMetadata: {
              ...metadata,
              image_source: null,
              image_verified: false,
              image_purged_at: new Date().toISOString(),
            } as Prisma.InputJsonValue,
            updatedAt: new Date(),
          },
        });
        purged += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${event.id}: ${message}`);
      }
    }

    const lastId = events.length > 0 ? events[events.length - 1].id : afterId ?? null;
    const remaining = lastId
      ? await this.prisma.event.count({
          where: { bannerUrl: { not: null }, id: { gt: lastId } },
        })
      : 0;

    this.logger.log(
      `Untrusted image purge: processed=${events.length} purged=${purged} remaining=${remaining}`,
    );

    return { processed: events.length, purged, remaining, lastId, errors };
  }

  async enrichEvent(event: Event, enrichWithAi = true): Promise<boolean> {
    if (!this.needsEnrichment(event) && event.lastSyncedAt) {
      return false;
    }

    let market = this.eventToDiscoveredMarket(event);

    if (this.shouldLookupNominatim(event)) {
      const lookup = await this.nominatim.lookupByName(
        event.name,
        event.city ?? '',
        event.state ?? '',
        Number(event.latitude),
        Number(event.longitude),
      );
      if (lookup) {
        market = { ...market, ...lookup, name: event.name };
      }
    }

    const profile = enrichWithAi
      ? await this.ai.enrich(market)
      : this.ai.enrichRules(market);

    const image = await this.images.findImage(market, {
      wikipediaTitle: profile.wikipediaTitle,
      eventId: event.id,
    });
    if (image) {
      profile.bannerUrl = image.url;
      profile.imageSource = image.source;
    }

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

    const resolvedLinks = extractMarketLinks({
      websiteUrl: profile.websiteUrl ?? extractWebsite(market.rawTags, {}, market.website),
      extraInfo: event.extraInfo,
      syncMetadata: (event.syncMetadata ?? {}) as Record<string, unknown>,
    });
    const websiteUrl = resolvedLinks.website;

    const metadata = (event.syncMetadata ?? {}) as Record<string, unknown>;
    const baseMetadata = {
      ...metadata,
      opening_hours: market.openingHours ?? metadata.opening_hours,
      website: websiteUrl ?? metadata.website,
      facebook_url: resolvedLinks.facebook ?? metadata.facebook_url,
      instagram_url: resolvedLinks.instagram ?? metadata.instagram_url,
      raw_tags: market.rawTags,
      enriched_by: profile.enrichedBy,
      enrichment_version: MARKETS_ENRICHMENT_VERSION,
      runs_on_days: profile.runsOnDays,
      typical_day: profile.typicalDayOfWeek,
      start_hour: profile.typicalStartHour,
      end_hour: profile.typicalEndHour,
      seasonal_schedule: profile.seasonalSchedule,
      vendor_types: profile.vendorTypes,
      payment_methods: profile.paymentMethods,
      featured_vendor_categories: profile.featuredVendorCategories,
      shopper_tips: profile.shopperTips,
      wikipedia_title: profile.wikipediaTitle,
    };
    const syncMetadata = image
      ? this.mergeImageMetadata(baseMetadata, image)
      : ({
          ...baseMetadata,
          image_source: profile.imageSource,
        } as Prisma.InputJsonValue);

    await this.prisma.event.update({
      where: { id: event.id },
      data: {
        name: market.name,
        description: profile.description,
        marketHistory: profile.marketHistory,
        bannerUrl: profile.bannerUrl,
        organizerName: profile.organizerName ?? event.organizerName,
        address: market.address ?? event.address,
        startDatetime: start,
        endDatetime: end,
        eventStatus: 'upcoming',
        parkingInfo: profile.parkingInfo,
        admissionInfo: profile.admissionInfo,
        marketType: profile.marketType,
        hoursSummary: profile.hoursSummary,
        websiteUrl,
        extraInfo: profile.extraInfo,
        whatToLookFor: profile.whatToLookFor,
        marketHighlights: profile.marketHighlights,
        timezone,
        lastSyncedAt: new Date(),
        syncMetadata,
        updatedAt: new Date(),
      },
    });

    return true;
  }

  private async applyTimesAndWebsite(event: Event): Promise<boolean> {
    const metadata = (event.syncMetadata ?? {}) as Record<string, unknown>;
    const rawTags = (metadata.raw_tags as Record<string, string>) ?? {};
    const schedule = resolveSchedule(metadata);

    const timezone = resolveTimezone(
      Number(event.latitude),
      Number(event.longitude),
      event.state,
    );

    const { start, end } = nextMarketWindow(
      schedule.dayOfWeek,
      schedule.startHour,
      schedule.endHour,
      timezone,
    );

    const websiteUrl = normalizeMarketWebsiteUrl(
      extractWebsite(rawTags, metadata, event.websiteUrl),
    );

    const timezoneChanged = event.timezone !== timezone;
    const timesChanged =
      event.startDatetime.getTime() !== start.getTime() ||
      event.endDatetime.getTime() !== end.getTime();
    const websiteChanged = (event.websiteUrl ?? null) !== websiteUrl;

    if (!timezoneChanged && !timesChanged && !websiteChanged) {
      return false;
    }

    await this.prisma.event.update({
      where: { id: event.id },
      data: {
        timezone,
        startDatetime: start,
        endDatetime: end,
        websiteUrl,
        syncMetadata: {
          ...metadata,
          website: websiteUrl ?? metadata.website,
          typical_day: schedule.dayOfWeek,
          start_hour: schedule.startHour,
          end_hour: schedule.endHour,
          enrichment_version: MARKETS_ENRICHMENT_VERSION,
        } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return true;
  }

  private pendingWhere(): Prisma.EventWhereInput {
    const forceAll =
      this.config.get<string>('MARKETS_AI_ENRICH_ALWAYS', 'false').toLowerCase() === 'true';

    if (forceAll) {
      return {};
    }

    return {
      OR: [
        { hoursSummary: null },
        { marketType: null },
        { marketHistory: null },
        { whatToLookFor: null },
        { marketHighlights: null },
        { timezone: null },
        { bannerUrl: null },
        { websiteUrl: null },
        { lastSyncedAt: null },
      ],
    };
  }

  private needsEnrichment(event: Event): boolean {
    const forceAll =
      this.config.get<string>('MARKETS_AI_ENRICH_ALWAYS', 'false').toLowerCase() === 'true';
    if (forceAll) return true;
    return (
      !event.hoursSummary ||
      !event.marketType ||
      !event.marketHistory ||
      !event.whatToLookFor ||
      !event.marketHighlights ||
      !event.timezone ||
      !event.lastSyncedAt
    );
  }

  private shouldLookupNominatim(event: Event): boolean {
    const enabled =
      this.config.get<string>('MARKETS_CATALOG_NOMINATIM', 'false').toLowerCase() === 'true';
    if (!enabled) return false;

    const city = (event.city ?? '').trim();
    const name = event.name.trim();
    if (!city || !name) return false;

    const placeholder = new RegExp(`^${city}\\s+Farmers\\s+Market$`, 'i');
    return !placeholder.test(name);
  }

  private mergeImageMetadata(
    metadata: Record<string, unknown>,
    image: {
      source: string | null;
      imageVerified?: boolean;
      wikipediaFromOsm?: boolean;
      visionConfidence?: number;
      visionReason?: string;
      googlePhotoReference?: string;
      googlePlaceId?: string;
      googlePlaceName?: string;
    },
  ): Prisma.InputJsonValue {
    return {
      ...metadata,
      image_source: image.source,
      image_verified: image.imageVerified ?? false,
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
    } as Prisma.InputJsonValue;
  }

  private eventToDiscoveredMarket(event: Event): DiscoveredMarket {
    const metadata = (event.syncMetadata ?? {}) as Record<string, unknown>;
    const rawTags = (metadata.raw_tags as Record<string, string>) ?? {};

    return {
      externalSource: event.externalSource ?? 'catalog',
      externalId: event.externalId ?? event.id,
      name: event.name,
      description: event.description ?? '',
      organizerName: event.organizerName,
      address: event.address,
      city: event.city ?? '',
      state: event.state ?? '',
      zipcode: typeof metadata.zipcode === 'string' ? metadata.zipcode : null,
      latitude: Number(event.latitude),
      longitude: Number(event.longitude),
      parkingInfo: event.parkingInfo,
      admissionInfo: event.admissionInfo ?? 'Free admission.',
      openingHours:
        typeof metadata.opening_hours === 'string' ? metadata.opening_hours : null,
      website: extractWebsite(rawTags, metadata, event.websiteUrl),
      rawTags,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

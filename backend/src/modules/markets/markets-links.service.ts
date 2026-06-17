import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Event, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { validateMarketUrl } from './market-link-validate.util';
import {
  extractMarketLinks,
  hasAnyMarketLink,
  normalizeFacebookUrl,
  normalizeInstagramUrl,
  normalizeMarketWebsiteUrl,
  type MarketLinks,
} from './market-links.util';
import { MarketsGooglePlacesService } from './markets-google-places.service';
import type { DiscoveredMarket } from './markets.types';

export interface MarketLinksBackfillResult {
  processed: number;
  updated: number;
  remaining: number;
  lastId: string | null;
  errors: string[];
}

@Injectable()
export class MarketsLinksService {
  private readonly logger = new Logger(MarketsLinksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googlePlaces: MarketsGooglePlacesService,
    private readonly config: ConfigService,
  ) {}

  async backfillLinks(batchSize = 50, afterId?: string): Promise<MarketLinksBackfillResult> {
    const validateLinks =
      this.config.get<string>('MARKETS_VALIDATE_LINKS', 'true').toLowerCase() === 'true';
    const discoverMissing =
      this.config.get<string>('MARKETS_DISCOVER_LINKS', 'true').toLowerCase() === 'true';

    const events = await this.prisma.event.findMany({
      where: {
        visibilityStatus: 'public',
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      take: batchSize,
      orderBy: { id: 'asc' },
    });

    let updated = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const didUpdate = await this.resolveEventLinks(event, {
          validateLinks,
          discoverMissing,
        });
        if (didUpdate) updated += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${event.id}: ${message}`);
      }
      await this.sleep(150);
    }

    const lastId = events.length > 0 ? events[events.length - 1].id : afterId ?? null;
    const remaining = lastId
      ? await this.prisma.event.count({
          where: { visibilityStatus: 'public', id: { gt: lastId } },
        })
      : 0;

    this.logger.log(
      `Market links backfill: processed=${events.length} updated=${updated} remaining=${remaining}`,
    );

    return { processed: events.length, updated, remaining, lastId, errors };
  }

  async resolveEventLinks(
    event: Event,
    options: { validateLinks?: boolean; discoverMissing?: boolean } = {},
  ): Promise<boolean> {
    const validateLinks = options.validateLinks ?? true;
    const discoverMissing = options.discoverMissing ?? true;
    const metadata = (event.syncMetadata ?? {}) as Record<string, unknown>;

    let links = extractMarketLinks({
      websiteUrl: event.websiteUrl,
      extraInfo: event.extraInfo,
      syncMetadata: metadata,
    });

    if (validateLinks) {
      links = await this.validateLinks(links);
    }

    if (discoverMissing && !links.website && this.googlePlaces.enabled) {
      const discovered = await this.googlePlaces.findWebsite(this.eventToDiscoveredMarket(event));
      if (discovered) {
        const valid = validateLinks ? await this.isValidUrl(discovered) : true;
        if (valid) links = { ...links, website: discovered };
      }
    }

    const nextWebsite = links.website;
    const nextFacebook = links.facebook;
    const nextInstagram = links.instagram;

    const websiteChanged = (event.websiteUrl ?? null) !== nextWebsite;
    const facebookChanged = readMetaString(metadata, 'facebook_url') !== nextFacebook;
    const instagramChanged = readMetaString(metadata, 'instagram_url') !== nextInstagram;

    if (!websiteChanged && !facebookChanged && !instagramChanged) {
      return false;
    }

    await this.prisma.event.update({
      where: { id: event.id },
      data: {
        websiteUrl: nextWebsite,
        syncMetadata: {
          ...metadata,
          website: nextWebsite,
          facebook_url: nextFacebook,
          instagram_url: nextInstagram,
          links_validated_at: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return true;
  }

  private async validateLinks(links: MarketLinks): Promise<MarketLinks> {
    const website =
      links.website && (await this.isValidUrl(links.website)) ? links.website : null;
    const facebook =
      links.facebook && (await this.isValidUrl(links.facebook)) ? links.facebook : null;
    const instagram =
      links.instagram && (await this.isValidUrl(links.instagram)) ? links.instagram : null;

    return { website, facebook, instagram };
  }

  private async isValidUrl(url: string): Promise<boolean> {
    const normalized =
      normalizeMarketWebsiteUrl(url) ??
      normalizeFacebookUrl(url) ??
      normalizeInstagramUrl(url);
    if (!normalized) return false;
    return validateMarketUrl(normalized);
  }

  private eventToDiscoveredMarket(event: Event): DiscoveredMarket {
    const metadata = (event.syncMetadata ?? {}) as Record<string, unknown>;
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
      website: event.websiteUrl,
      rawTags: (metadata.raw_tags as Record<string, string>) ?? {},
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

function readMetaString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export { hasAnyMarketLink };

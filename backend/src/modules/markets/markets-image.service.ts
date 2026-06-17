import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { fetchCommonsGeosearchCandidates } from './commons-geosearch.util';
import { commonsFileUrl, normalizeImageUrl } from './image.util';
import {
  parseOsmWikipediaTitle,
  titleMatchesMarket,
} from './market-image-match.util';
import { MarketsGooglePlacesService } from './markets-google-places.service';
import { MarketsImageVerifyService } from './markets-image-verify.service';
import type { DiscoveredMarket, MarketImageSource } from './markets.types';
import { fetchWebsiteOgImage } from './website-image.util';

const USER_AGENT = 'RootedMarketsAgent/1.0 (market image lookup)';

export interface MarketImageResult {
  url: string;
  source: MarketImageSource;
  imageVerified?: boolean;
  wikipediaFromOsm?: boolean;
  visionConfidence?: number;
  visionReason?: string;
  googlePhotoReference?: string;
  googlePlaceId?: string;
  googlePlaceName?: string;
}

export interface FindImageOptions {
  wikipediaTitle?: string | null;
  eventId?: string;
  googleOnly?: boolean;
}

@Injectable()
export class MarketsImageService {
  private readonly logger = new Logger(MarketsImageService.name);

  constructor(
    private readonly googlePlaces: MarketsGooglePlacesService,
    private readonly imageVerify: MarketsImageVerifyService,
    private readonly config: ConfigService,
  ) {}

  proxyPhotoUrl(eventId: string): string {
    const base = this.publicBaseUrl();
    return `${base}/public/markets/${eventId}/photo`;
  }

  async findImage(
    market: DiscoveredMarket,
    options: FindImageOptions = {},
  ): Promise<MarketImageResult | null> {
    const { wikipediaTitle, eventId, googleOnly = false } = options;

    if (googleOnly) {
      return this.fromGooglePlaces(market, eventId);
    }

    const fromOsm = this.fromOsmTags(market.rawTags);
    if (fromOsm) {
      return { ...fromOsm, imageVerified: true };
    }

    const wikidataId = market.rawTags.wikidata?.trim();
    if (wikidataId) {
      const fromWikidata = await this.fromWikidata(wikidataId);
      if (fromWikidata) return { ...fromWikidata, imageVerified: true };
    }

    const osmWikipediaTitle = parseOsmWikipediaTitle(market.rawTags);
    const validatedTitle =
      osmWikipediaTitle ??
      (wikipediaTitle?.trim() && titleMatchesMarket(wikipediaTitle.trim(), market)
        ? wikipediaTitle.trim()
        : null);

    if (validatedTitle) {
      const fromTitle = await this.fromWikipediaTitle(validatedTitle);
      if (fromTitle) {
        if (osmWikipediaTitle) {
          return {
            ...fromTitle,
            imageVerified: true,
            wikipediaFromOsm: true,
          };
        }

        const verified = await this.verifyCandidate(market, fromTitle.url);
        if (verified) {
          return {
            ...fromTitle,
            imageVerified: true,
            wikipediaFromOsm: false,
            visionConfidence: verified.confidence,
            visionReason: verified.reason,
          };
        }
      }
    }

    const fromCommons = await this.fromCommonsGeosearch(market);
    if (fromCommons) return fromCommons;

    const fromWebsite = await this.fromWebsiteOg(market);
    if (fromWebsite) return fromWebsite;

    if (this.shouldUseGoogleFallback()) {
      const google = await this.fromGooglePlaces(market, eventId);
      if (google) return { ...google, imageVerified: true };
    }

    return null;
  }

  private shouldUseGoogleFallback(): boolean {
    if (!this.googlePlaces.enabled) return false;
    return (
      this.config.get<string>('MARKETS_GOOGLE_PLACES_FALLBACK', 'true').toLowerCase() === 'true'
    );
  }

  private async fromGooglePlaces(
    market: DiscoveredMarket,
    eventId?: string,
  ): Promise<MarketImageResult | null> {
    const hit = await this.googlePlaces.findPhoto(market);
    if (!hit || !eventId) return null;

    return {
      url: this.proxyPhotoUrl(eventId),
      source: 'google_places',
      imageVerified: true,
      googlePhotoReference: hit.photoReference,
      googlePlaceId: hit.placeId,
      googlePlaceName: hit.placeName,
    };
  }

  private fromOsmTags(tags: Record<string, string>): MarketImageResult | null {
    const direct = normalizeImageUrl(tags.image ?? tags['image:url']);
    if (direct) return { url: direct, source: 'osm_image' };

    const commons = tags.wikimedia_commons ?? tags['wikimedia:commons'];
    if (commons) {
      const url = commonsFileUrl(commons);
      if (url) return { url, source: 'wikimedia_commons' };
    }

    return null;
  }

  private async fromWikidata(id: string): Promise<MarketImageResult | null> {
    const qid = id.startsWith('Q') ? id : `Q${id}`;
    try {
      const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (!res.ok) return null;

      const payload = (await res.json()) as {
        entities?: Record<string, { claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } }>;
      };
      const entity = payload.entities?.[qid];
      const filename = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (!filename) return null;

      const url = commonsFileUrl(`File:${filename}`);
      if (!url) return null;
      return { url, source: 'wikidata' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Wikidata image ${qid}: ${message}`);
      return null;
    }
  }

  private async fromWikipediaTitle(title: string): Promise<MarketImageResult | null> {
    const url = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: '1200',
      format: 'json',
      origin: '*',
    })}`;

    return this.parseWikiPageImages(url);
  }

  private async fromCommonsGeosearch(market: DiscoveredMarket): Promise<MarketImageResult | null> {
    const candidates = await fetchCommonsGeosearchCandidates(market);
    for (const url of candidates) {
      const verified = await this.verifyCandidate(market, url);
      if (!verified) continue;

      return {
        url,
        source: 'commons_geosearch',
        imageVerified: true,
        visionConfidence: verified.confidence,
        visionReason: verified.reason,
      };
    }

    return null;
  }

  private async fromWebsiteOg(market: DiscoveredMarket): Promise<MarketImageResult | null> {
    const website = market.website?.trim();
    if (!website) return null;

    const url = await fetchWebsiteOgImage(website);
    if (!url) return null;

    const verified = await this.verifyCandidate(market, url);
    if (!verified) return null;

    return {
      url,
      source: 'website_og',
      imageVerified: true,
      visionConfidence: verified.confidence,
      visionReason: verified.reason,
    };
  }

  private async verifyCandidate(
    market: DiscoveredMarket,
    imageUrl: string,
  ): Promise<{ confidence: number; reason: string } | null> {
    const result = await this.imageVerify.verify(market, imageUrl);
    if (!result.approved) return null;
    return { confidence: result.confidence, reason: result.reason };
  }

  private async parseWikiPageImages(apiUrl: string): Promise<MarketImageResult | null> {
    try {
      const res = await fetch(apiUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (!res.ok) return null;

      const payload = (await res.json()) as {
        query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
      };

      for (const page of Object.values(payload.query?.pages ?? {})) {
        const thumb = normalizeImageUrl(page.thumbnail?.source);
        if (thumb) return { url: thumb, source: 'wikipedia' };
      }

      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Wikipedia image: ${message}`);
      return null;
    }
  }

  private publicBaseUrl(): string {
    const configured = this.config.get<string>('PUBLIC_BASE_URL', '').trim();
    if (configured) return configured.replace(/\/$/, '');

    const port = this.config.get<string>('PORT', '4000');
    return `http://localhost:${port}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

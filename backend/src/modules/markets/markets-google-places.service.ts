import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { DiscoveredMarket } from './markets.types';
import { placeNameMatchesMarket } from './market-image-match.util';
import { normalizeMarketWebsiteUrl } from './market-links.util';

export interface GooglePlacePhoto {
  photoReference: string;
  placeId: string;
  placeName: string;
}

export interface GooglePlaceMatch {
  placeId: string;
  placeName: string;
  website: string | null;
}

@Injectable()
export class MarketsGooglePlacesService {
  private readonly logger = new Logger(MarketsGooglePlacesService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    const key = this.config.get<string>('GOOGLE_PLACES_API_KEY', '').trim();
    const flag =
      this.config.get<string>('MARKETS_GOOGLE_PLACES_ENABLED', 'true').toLowerCase() === 'true';
    return Boolean(key) && flag;
  }

  async findPhoto(market: DiscoveredMarket): Promise<GooglePlacePhoto | null> {
    const match = await this.findPlaceMatch(market);
    if (!match) return null;

    const photo = await this.fetchPlacePhoto(match.placeId, market, '');
    if (!photo) return null;

    return {
      photoReference: photo.photoReference,
      placeId: match.placeId,
      placeName: match.placeName,
    };
  }

  async findWebsite(market: DiscoveredMarket): Promise<string | null> {
    const match = await this.findPlaceMatch(market);
    if (!match?.website) return null;
    return normalizeMarketWebsiteUrl(match.website);
  }

  async findPlaceMatch(market: DiscoveredMarket): Promise<GooglePlaceMatch | null> {
    if (!this.enabled) return null;

    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY', '').trim();
    const queries = [
      `${market.name} farmers market ${market.city} ${market.state}`,
      `${market.name} ${market.city} ${market.state}`,
      `${market.city} farmers market ${market.state}`,
    ];

    for (const query of queries) {
      const hit = await this.textSearch(query, market, apiKey);
      if (hit) return hit;
      await this.sleep(200);
    }

    return null;
  }

  private async fetchPlacePhoto(
    placeId: string,
    market: DiscoveredMarket,
    apiKey: string,
  ): Promise<{ photoReference: string } | null> {
    const key = apiKey || this.config.get<string>('GOOGLE_PLACES_API_KEY', '').trim();
    try {
      const details = await this.fetchPlaceDetails(placeId, key);
      const photoRef = details?.photos?.[0]?.photo_reference;
      if (!photoRef) return null;
      return { photoReference: photoRef };
    } catch {
      return null;
    }
  }

  private async fetchPlaceDetails(placeId: string, apiKey: string) {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?${new URLSearchParams({
      place_id: placeId,
      fields: 'name,website,url,photos,types',
      key: apiKey,
    })}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const payload = (await res.json()) as {
      status?: string;
      error_message?: string;
      result?: {
        name?: string;
        website?: string;
        url?: string;
        photos?: { photo_reference?: string }[];
        types?: string[];
      };
    };

    if (payload.status && payload.status !== 'OK') {
      throw new Error(`${payload.status}: ${payload.error_message ?? 'unknown'}`);
    }

    return payload.result ?? null;
  }

  photoFetchUrl(photoReference: string): string {
    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY', '').trim();
    return `https://maps.googleapis.com/maps/api/place/photo?${new URLSearchParams({
      maxwidth: '1200',
      photo_reference: photoReference,
      key: apiKey,
    })}`;
  }

  private async textSearch(
    query: string,
    market: DiscoveredMarket,
    apiKey: string,
  ): Promise<GooglePlaceMatch | null> {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${new URLSearchParams({
        query,
        location: `${market.latitude},${market.longitude}`,
        radius: '20000',
        key: apiKey,
      })}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const payload = (await res.json()) as {
        status?: string;
        error_message?: string;
        results?: {
          place_id?: string;
          name?: string;
          types?: string[];
          photos?: { photo_reference?: string }[];
        }[];
      };

      if (payload.status && !['OK', 'ZERO_RESULTS'].includes(payload.status)) {
        throw new Error(`${payload.status}: ${payload.error_message ?? 'unknown'}`);
      }

      for (const place of payload.results ?? []) {
        if (!place.place_id) continue;
        if (!this.isLikelyMarket(place, query)) continue;
        if (!placeNameMatchesMarket(place.name ?? '', market)) continue;

        const details = await this.fetchPlaceDetails(place.place_id, apiKey);
        const website = normalizeMarketWebsiteUrl(details?.website ?? null);

        return {
          placeId: place.place_id,
          placeName: place.name ?? query,
          website,
        };
      }

      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Places search "${query}": ${message}`);
      return null;
    }
  }

  private isLikelyMarket(
    place: { name?: string; types?: string[] },
    query: string,
  ): boolean {
    const name = (place.name ?? '').toLowerCase();
    const q = query.toLowerCase();
    if (/farmers?\s*market|farm\s*market|green\s*market|greenmarket|public\s*market/.test(name)) {
      return true;
    }
    if (q.includes('farmers market') && name.includes('market')) return true;
    if (place.types?.includes('point_of_interest') && /market/.test(name)) return true;
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

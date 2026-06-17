import { Injectable, Logger } from '@nestjs/common';

import { METRO_CITIES } from './metro-priority';
import type { DiscoveredMarket } from './markets.types';
import type { StateBbox } from './us-state-bboxes';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'RootedMarketsAgent/2.0';
const DELAY_MS = 1100;

const STATE_QUERIES = [
  'farmers market',
  "farmers' market",
  'greenmarket',
  'public market',
  'produce market',
];

interface NominatimHit {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    road?: string;
    house_number?: string;
  };
}

@Injectable()
export class MarketsNominatimService {
  private readonly logger = new Logger(MarketsNominatimService.name);

  /** Look up a single market by name near its coordinates (1 Nominatim request). */
  async lookupByName(
    name: string,
    city: string,
    state: string,
    latitude: number,
    longitude: number,
  ): Promise<Partial<DiscoveredMarket> | null> {
    const delta = 0.25;
    const viewbox = `${longitude - delta},${latitude + delta},${longitude + delta},${latitude - delta}`;
    const query = `${name}, ${city}, ${state}, USA`;

    try {
      const hits = await this.search(query, viewbox, '5');
      const best = hits.find((hit) => this.nameMatches(name, hit)) ?? hits[0];
      if (!best) return null;

      const mapped = this.mapHit(best, state, city);
      if (!mapped) return null;

      return {
        address: mapped.address,
        openingHours: mapped.openingHours,
        website: mapped.website,
        rawTags: mapped.rawTags,
        zipcode: mapped.zipcode,
        latitude: mapped.latitude,
        longitude: mapped.longitude,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Nominatim lookup "${name}": ${message}`);
      return null;
    } finally {
      await this.sleep(DELAY_MS);
    }
  }

  async discoverState(state: StateBbox): Promise<DiscoveredMarket[]> {
    const viewbox = `${state.west},${state.north},${state.east},${state.south}`;
    const rows: DiscoveredMarket[] = [];

    for (const query of STATE_QUERIES) {
      try {
        const hits = await this.search(`${query}, ${state.name}, USA`, viewbox);
        for (const hit of hits) {
          const row = this.mapHit(hit, state.abbr, '');
          if (row) rows.push(row);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`${state.abbr} nominatim "${query}": ${message}`);
      }
      await this.sleep(DELAY_MS);
    }

    const metros = METRO_CITIES[state.abbr] ?? [];
    for (const city of metros) {
      try {
        const hits = await this.search(`farmers market, ${city}, ${state.abbr}, USA`, viewbox);
        for (const hit of hits) {
          const row = this.mapHit(hit, state.abbr, city);
          if (row) rows.push(row);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`${state.abbr} nominatim ${city}: ${message}`);
      }
      await this.sleep(DELAY_MS);
    }

    return rows;
  }

  private nameMatches(target: string, hit: NominatimHit): boolean {
    const hitName = (hit.name ?? hit.display_name.split(',')[0] ?? '').toLowerCase();
    const needle = target.toLowerCase();
    return hitName.includes(needle) || needle.includes(hitName);
  }

  private async search(q: string, viewbox: string, limit = '40'): Promise<NominatimHit[]> {
    const url = `${NOMINATIM_URL}?${new URLSearchParams({
      q,
      format: 'json',
      countrycodes: 'us',
      viewbox,
      bounded: '1',
      limit,
      addressdetails: '1',
    }).toString()}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as NominatimHit[];
  }

  private mapHit(hit: NominatimHit, stateAbbr: string, fallbackCity: string): DiscoveredMarket | null {
    if (!this.isFarmersMarketHit(hit)) return null;

    const name = (hit.name ?? hit.display_name.split(',')[0] ?? '').trim();
    const city =
      hit.address?.city ?? hit.address?.town ?? hit.address?.village ?? fallbackCity;
    const state = this.normalizeState(hit.address?.state ?? stateAbbr);
    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);
    if (!name || !city || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const address = [hit.address?.house_number, hit.address?.road].filter(Boolean).join(' ');

    return {
      externalSource: 'nominatim',
      externalId: String(hit.place_id),
      name,
      description: `Farmers market in ${city}, ${state}. Confirm hours with the organizer.`,
      organizerName: null,
      address: address || null,
      city,
      state,
      zipcode: hit.address?.postcode?.trim() || null,
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      parkingInfo: null,
      admissionInfo: 'Free admission.',
      openingHours: null,
      website: null,
      rawTags: { source: 'nominatim', display_name: hit.display_name },
    };
  }

  private isFarmersMarketHit(hit: NominatimHit): boolean {
    const name = (hit.name ?? hit.display_name ?? '').toLowerCase();
    return (
      /farmers?\s*market|farmers'?\s*market|farm\s*market|green\s*market|greenmarket|produce\s*market/.test(
        name,
      ) || (hit.class === 'amenity' && hit.type === 'marketplace' && name.length > 0)
    );
  }

  private normalizeState(value: string): string {
    const raw = value.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(raw)) return raw;
    return raw.slice(0, 2);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

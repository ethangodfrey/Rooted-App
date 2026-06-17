import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MarketsNominatimService } from './markets-nominatim.service';
import type { DiscoveredMarket } from './markets.types';
import { US_STATE_BBOXES, type StateBbox } from './us-state-bboxes';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const USER_AGENT = 'RootedMarketsAgent/2.0';
const REQUEST_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 90_000;

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface Bbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

@Injectable()
export class MarketsDiscoveryService {
  private readonly logger = new Logger(MarketsDiscoveryService.name);

  constructor(
    private readonly nominatim: MarketsNominatimService,
    private readonly config: ConfigService,
  ) {}

  async discoverFromOpenStreetMap(): Promise<DiscoveredMarket[]> {
    const mode = this.config.get<string>('MARKETS_DISCOVERY_MODE', 'deep').toLowerCase();
    const all: DiscoveredMarket[] = [];

    for (const state of US_STATE_BBOXES) {
      try {
        const osmRows =
          mode === 'fast' ? await this.fetchState(state) : await this.fetchStateTiled(state);
        all.push(...osmRows);
        this.logger.log(`${state.abbr} OSM: ${osmRows.length} markets`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`${state.abbr} OSM failed (${message})`);
      }

      if (mode === 'deep') {
        try {
          const nomRows = await this.nominatim.discoverState(state);
          all.push(...nomRows);
          this.logger.log(`${state.abbr} Nominatim: ${nomRows.length} markets`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`${state.abbr} Nominatim failed (${message})`);
        }
      }

      await this.sleep(REQUEST_DELAY_MS);
    }

    return this.dedupe(all);
  }

  private async fetchStateTiled(state: StateBbox): Promise<DiscoveredMarket[]> {
    const tiles = this.tileBbox(state, 2, 2);
    const rows: DiscoveredMarket[] = [];

    for (const tile of tiles) {
      try {
        const part = await this.fetchBbox(tile, state.abbr);
        rows.push(...part);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`${state.abbr} tile failed (${message})`);
      }
      await this.sleep(800);
    }

    return rows;
  }

  private async fetchState(state: StateBbox): Promise<DiscoveredMarket[]> {
    return this.fetchBbox(state, state.abbr);
  }

  private async fetchBbox(
    bbox: Bbox,
    stateAbbr: string,
  ): Promise<DiscoveredMarket[]> {
    const { south, west, north, east } = bbox;
    const query = `
[out:json][timeout:60];
(
  node["amenity"="marketplace"]["name"](${south},${west},${north},${east});
  way["amenity"="marketplace"]["name"](${south},${west},${north},${east});
  node["amenity"="marketplace"]["marketplace"="farmers_market"](${south},${west},${north},${east});
  way["amenity"="marketplace"]["marketplace"="farmers_market"](${south},${west},${north},${east});
  node["name"~"Farmers.?Market",i](${south},${west},${north},${east});
  way["name"~"Farmers.?Market",i](${south},${west},${north},${east});
);
out center tags;
`.trim();

    let lastError = 'unknown';

    for (const endpoint of OVERPASS_ENDPOINTS) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': USER_AGENT,
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          lastError = `HTTP ${res.status}`;
          continue;
        }

        const payload = (await res.json()) as { elements?: OsmElement[] };
        const rows: DiscoveredMarket[] = [];
        for (const el of payload.elements ?? []) {
          const row = this.mapElement(el, stateAbbr);
          if (row) rows.push(row);
        }
        return rows;
      } catch (err) {
        clearTimeout(timeout);
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    throw new Error(lastError);
  }

  private mapElement(el: OsmElement, stateAbbr: string): DiscoveredMarket | null {
    const tags = el.tags ?? {};
    if (!this.isFarmersMarket(tags)) return null;

    const coords = this.coords(el);
    if (!coords) return null;

    const name = (tags.name ?? '').trim();
    const city = this.pickCity(tags);
    if (!name || !city) return null;

    const state = this.normalizeState(tags['addr:state'] ?? stateAbbr);
    const website = tags.website ?? tags['contact:website'] ?? null;
    const openingHours = tags.opening_hours ?? null;

    return {
      externalSource: 'openstreetmap',
      externalId: `${el.type}/${el.id}`,
      name,
      description:
        tags.description?.trim() ||
        `Farmers market in ${city}, ${state}. Hours and vendors may vary — confirm with the organizer.`,
      organizerName: tags.operator?.trim() || null,
      address: this.pickAddress(tags) || null,
      city,
      state,
      zipcode: tags['addr:postcode']?.trim() || null,
      latitude: Number(coords.lat.toFixed(6)),
      longitude: Number(coords.lon.toFixed(6)),
      parkingInfo: null,
      admissionInfo: 'Free admission.',
      openingHours,
      website,
      rawTags: tags,
    };
  }

  private tileBbox(bbox: Bbox, cols: number, rows: number): Bbox[] {
    const latStep = (bbox.north - bbox.south) / rows;
    const lonStep = (bbox.east - bbox.west) / cols;
    const tiles: Bbox[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        tiles.push({
          south: bbox.south + row * latStep,
          west: bbox.west + col * lonStep,
          north: bbox.south + (row + 1) * latStep,
          east: bbox.west + (col + 1) * lonStep,
        });
      }
    }

    return tiles;
  }

  private isFarmersMarket(tags: Record<string, string>): boolean {
    const name = (tags.name ?? '').toLowerCase();
    if (!name) return false;
    if (tags.marketplace === 'farmers_market') return true;
    if (tags.amenity === 'marketplace' && /farmers?\s*market|farm\s*market/.test(name)) return true;
    if (/farmers?\s*market|farm\s*market/.test(name)) return true;
    return false;
  }

  private coords(el: OsmElement): { lat: number; lon: number } | null {
    if (typeof el.lat === 'number' && typeof el.lon === 'number') {
      return { lat: el.lat, lon: el.lon };
    }
    if (el.center) return { lat: el.center.lat, lon: el.center.lon };
    return null;
  }

  private pickCity(tags: Record<string, string>): string {
    return (
      tags['addr:city'] ??
      tags['addr:town'] ??
      tags['addr:village'] ??
      tags['addr:hamlet'] ??
      tags['addr:county']?.replace(/ County$/i, '') ??
      ''
    ).trim();
  }

  private pickAddress(tags: Record<string, string>): string {
    return [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ').trim();
  }

  private normalizeState(value: string): string {
    const raw = value.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(raw)) return raw;
    return raw.slice(0, 2);
  }

  private dedupe(rows: DiscoveredMarket[]): DiscoveredMarket[] {
    const seen = new Set<string>();
    const out: DiscoveredMarket[] = [];
    for (const row of rows) {
      const key = `${row.externalSource}:${row.externalId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    return out;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

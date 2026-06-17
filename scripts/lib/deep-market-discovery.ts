import { tileBbox } from './bbox-tiles';
import { fetchNominatimDeep } from './nominatim-fetch';
import { dedupeMarkets, type MarketCsvRow } from './market-csv';
import {
  buildFastOverpassQuery,
  fetchOverpassElements,
  type OsmElement,
} from './overpass-fetch';
import { normalizeState } from './market-csv';

export type DiscoveryMode = 'fast' | 'deep';

export interface DiscoveryOptions {
  mode: DiscoveryMode;
  timeoutMs: number;
  overpassTiles: number;
  citiesPerState: number;
  tryOverpass: boolean;
  onStatus?: (msg: string) => void;
}

function isFarmersMarket(tags: Record<string, string>): boolean {
  const name = (tags.name ?? '').toLowerCase();
  if (!name) return false;
  if (tags.marketplace === 'farmers_market') return true;
  if (tags.amenity === 'marketplace' && /farmers?\s*market|farm\s*market|greenmarket/.test(name)) {
    return true;
  }
  if (/farmers?\s*market|farm\s*market|greenmarket|produce\s*market/.test(name)) return true;
  return false;
}

function pickCity(tags: Record<string, string>): string {
  return (
    tags['addr:city'] ??
    tags['addr:town'] ??
    tags['addr:village'] ??
    tags['addr:hamlet'] ??
    tags['addr:county']?.replace(/ County$/i, '') ??
    ''
  ).trim();
}

function mapOsmElement(el: OsmElement, stateAbbr: string): MarketCsvRow | null {
  const tags = el.tags ?? {};
  if (!isFarmersMarket(tags)) return null;

  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;

  const name = (tags.name ?? '').trim();
  const city = pickCity(tags);
  if (!name || !city) return null;

  const website = tags.website ?? tags['contact:website'] ?? '';

  return {
    external_id: `osm:${el.type}/${el.id}`,
    name,
    description: tags.description?.trim() || `Farmers market in ${city}, ${normalizeState(stateAbbr)}.`,
    organizer_name: tags.operator?.trim() || '',
    address: [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    city,
    state: normalizeState(tags['addr:state'] ?? stateAbbr),
    zipcode: (tags['addr:postcode'] ?? '').trim(),
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lon.toFixed(6)),
    day_of_week: 'saturday',
    start_hour: 8,
    end_hour: 13,
    parking_info: '',
    admission_info: 'Free admission.',
    source: website ? `openstreetmap|${website}` : 'openstreetmap',
  };
}

async function fetchOverpassTiled(
  state: { abbr: string; south: number; west: number; north: number; east: number },
  options: DiscoveryOptions,
): Promise<MarketCsvRow[]> {
  const grid = options.overpassTiles;
  const tiles = tileBbox(state, grid, grid);
  const rows: MarketCsvRow[] = [];
  const timeoutSec = Math.max(15, Math.floor(options.timeoutMs / 1000));

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    options.onStatus?.(`Overpass tile ${i + 1}/${tiles.length}`);
    try {
      const query = buildFastOverpassQuery(tile, timeoutSec);
      const elements = await fetchOverpassElements(query, {
        timeoutMs: options.timeoutMs,
        retries: 1,
      });
      for (const el of elements) {
        const row = mapOsmElement(el, state.abbr);
        if (row) rows.push(row);
      }
    } catch {
      // Tile failed — continue; Nominatim will backfill.
    }
  }

  return rows;
}

export async function discoverMarketsForState(
  state: {
    abbr: string;
    name: string;
    south: number;
    west: number;
    north: number;
    east: number;
  },
  options: DiscoveryOptions,
): Promise<MarketCsvRow[]> {
  const collected: MarketCsvRow[] = [];

  if (options.tryOverpass) {
    options.onStatus?.(`Overpass ${options.overpassTiles}x${options.overpassTiles} grid...`);
    const osm = await fetchOverpassTiled(state, options);
    collected.push(...osm);
    options.onStatus?.(`Overpass found ${osm.length} so far`);
  }

  const citiesPerState =
    options.mode === 'deep' ? options.citiesPerState : Math.min(8, options.citiesPerState);

  const gridCells = options.mode === 'deep' ? 4 : 0;

  const nominatim = await fetchNominatimDeep(state.abbr, state.name, state, {
    citiesPerState,
    stateQueries: true,
    gridCells,
    onStatus: options.onStatus,
  });
  collected.push(...nominatim);

  return dedupeMarkets(collected);
}

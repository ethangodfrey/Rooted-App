import { cityViewbox, tileBbox, type Bbox } from './bbox-tiles';
import { citiesForState } from './city-index';
import { normalizeState, type MarketCsvRow } from './market-csv';
import { OVERPASS_USER_AGENT } from './overpass-fetch';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_DELAY_MS = 1100;

const STATE_QUERIES = [
  'farmers market',
  "farmers' market",
  'farmers market USA',
  'greenmarket',
  'public market',
  'produce market',
  'farm market',
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isFarmersMarketHit(hit: NominatimHit): boolean {
  const name = (hit.name ?? hit.display_name ?? '').toLowerCase();
  return (
    /farmers?\s*market|farmers'?\s*market|farm\s*market|green\s*market|greenmarket|produce\s*market/.test(
      name,
    ) || (hit.class === 'amenity' && hit.type === 'marketplace' && name.length > 0)
  );
}

function mapHit(hit: NominatimHit, stateAbbr: string, fallbackCity: string): MarketCsvRow | null {
  if (!isFarmersMarketHit(hit)) return null;

  const name = (hit.name ?? hit.display_name.split(',')[0] ?? '').trim();
  const city =
    hit.address?.city ??
    hit.address?.town ??
    hit.address?.village ??
    fallbackCity;
  const state = normalizeState(hit.address?.state ?? stateAbbr);
  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const address = [hit.address?.house_number, hit.address?.road].filter(Boolean).join(' ');

  return {
    external_id: `nominatim:${hit.place_id}`,
    name,
    description: `Farmers market in ${city}, ${state}. Confirm hours with the organizer.`,
    organizer_name: '',
    address,
    city,
    state,
    zipcode: hit.address?.postcode ?? '',
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    day_of_week: 'saturday',
    start_hour: 8,
    end_hour: 13,
    parking_info: '',
    admission_info: 'Free admission.',
    source: 'nominatim',
  };
}

async function nominatimSearch(params: Record<string, string>): Promise<NominatimHit[]> {
  const url = `${NOMINATIM_URL}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': OVERPASS_USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Nominatim HTTP ${res.status}`);
  }

  return (await res.json()) as NominatimHit[];
}

async function searchOnce(
  query: string,
  stateAbbr: string,
  stateName: string,
  viewbox: string,
  onStatus?: (msg: string) => void,
): Promise<MarketCsvRow[]> {
  onStatus?.(`Nominatim: "${query}"`);
  const hits = await nominatimSearch({
    q: `${query}, ${stateName}, USA`,
    format: 'json',
    countrycodes: 'us',
    viewbox,
    bounded: '1',
    limit: '50',
    addressdetails: '1',
  });

  const rows: MarketCsvRow[] = [];
  for (const hit of hits) {
    const row = mapHit(hit, stateAbbr, stateName);
    if (row) rows.push(row);
  }
  await sleep(NOMINATIM_DELAY_MS);
  return rows;
}

async function searchCity(
  city: string,
  stateAbbr: string,
  stateName: string,
  lat: number,
  lon: number,
  onStatus?: (msg: string) => void,
): Promise<MarketCsvRow[]> {
  onStatus?.(`Nominatim city: ${city}`);
  const hits = await nominatimSearch({
    q: `farmers market, ${city}, ${stateName}`,
    format: 'json',
    countrycodes: 'us',
    viewbox: cityViewbox(lat, lon),
    bounded: '1',
    limit: '25',
    addressdetails: '1',
  });

  const rows: MarketCsvRow[] = [];
  for (const hit of hits) {
    const row = mapHit(hit, stateAbbr, city);
    if (row) rows.push(row);
  }
  await sleep(NOMINATIM_DELAY_MS);
  return rows;
}

export interface DeepNominatimOptions {
  citiesPerState: number;
  stateQueries: boolean;
  gridCells?: number;
  onStatus?: (msg: string) => void;
}

async function searchGrid(
  bbox: Bbox,
  stateAbbr: string,
  stateName: string,
  gridCells: number,
  onStatus?: (msg: string) => void,
): Promise<MarketCsvRow[]> {
  const tiles = tileBbox(bbox, gridCells, gridCells);
  const all: MarketCsvRow[] = [];

  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    const lat = (t.south + t.north) / 2;
    const lon = (t.west + t.east) / 2;
    onStatus?.(`Nominatim grid ${i + 1}/${tiles.length}`);
    const hits = await nominatimSearch({
      q: 'farmers market',
      format: 'json',
      countrycodes: 'us',
      viewbox: cityViewbox(lat, lon, 0.55),
      bounded: '1',
      limit: '30',
      addressdetails: '1',
    });
    for (const hit of hits) {
      const row = mapHit(hit, stateAbbr, stateName);
      if (row) all.push(row);
    }
    await sleep(NOMINATIM_DELAY_MS);
  }

  return all;
}

/** Wide Nominatim sweep — multiple state queries + per-city lookups. */
export async function fetchNominatimDeep(
  stateAbbr: string,
  stateName: string,
  bbox: { south: number; west: number; north: number; east: number },
  options: DeepNominatimOptions,
): Promise<MarketCsvRow[]> {
  const viewbox = `${bbox.west},${bbox.north},${bbox.east},${bbox.south}`;
  const all: MarketCsvRow[] = [];

  if (options.stateQueries) {
    for (const phrase of STATE_QUERIES) {
      const rows = await searchOnce(phrase, stateAbbr, stateName, viewbox, options.onStatus);
      all.push(...rows);
    }
  }

  const cities = citiesForState(stateAbbr, options.citiesPerState);
  for (const city of cities) {
    const rows = await searchCity(
      city.city,
      stateAbbr,
      stateName,
      city.latitude,
      city.longitude,
      options.onStatus,
    );
    all.push(...rows);
  }

  if (options.gridCells && options.gridCells > 0) {
    const gridRows = await searchGrid(bbox, stateAbbr, stateName, options.gridCells, options.onStatus);
    all.push(...gridRows);
  }

  return all;
}

/** Single quick state query (legacy / fast mode). */
export async function fetchNominatimForState(
  stateAbbr: string,
  stateName: string,
  bbox: { south: number; west: number; north: number; east: number },
  onStatus?: (msg: string) => void,
): Promise<MarketCsvRow[]> {
  return fetchNominatimDeep(stateAbbr, stateName, bbox, {
    citiesPerState: 0,
    stateQueries: true,
    onStatus,
  });
}

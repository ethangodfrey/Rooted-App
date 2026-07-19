/**
 * Multi-region structural seed data for public.markets + public.regions.
 * Indexed city/state + lat/lng + directory_slug for nationwide geo routing.
 *
 * Covers all 50 US states via US_STATE_GEO_FIXTURES plus denser metro rows
 * for high-traffic corridors. No emoji.
 */

import {
  US_STATE_GEO_FIXTURES,
  type UsStateGeoFixture,
} from '@vendorly/env-config';

export type NationwideRegionSeed = {
  name: string;
  slug: string;
  timezone: string;
  geographicBounds: {
    type: 'bbox';
    north: number;
    south: number;
    east: number;
    west: number;
  };
};

export type NationwideMarketSeed = {
  regionSlug: string;
  name: string;
  slug: string;
  directorySlug: string;
  locationAddress: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  operatingHours: string;
};

function stateRegionSlug(abbr: string): string {
  return `us-${abbr.toLowerCase()}`;
}

function buildStateRegions(): NationwideRegionSeed[] {
  return US_STATE_GEO_FIXTURES.map((row) => ({
    name: `${row.NAME} Markets`,
    slug: stateRegionSlug(row.ABBR),
    timezone: row.TIMEZONE,
    geographicBounds: {
      type: 'bbox',
      // Pure coordinate pads — not used to clip nearby queries.
      north: Math.min(90, row.LATITUDE + 1.5),
      south: Math.max(-90, row.LATITUDE - 1.5),
      east: Math.min(180, row.LONGITUDE + 1.5),
      west: Math.max(-180, row.LONGITUDE - 1.5),
    },
  }));
}

function buildStateMarkets(): NationwideMarketSeed[] {
  return US_STATE_GEO_FIXTURES.map((row: UsStateGeoFixture) => {
    const citySlug = row.TENANT_SLUG;
    return {
      regionSlug: stateRegionSlug(row.ABBR),
      name: `${row.CITY} Farmers Market`,
      slug: `${citySlug}-central`,
      directorySlug: `${row.ABBR.toLowerCase()}-${citySlug}`,
      locationAddress: `${row.CITY} Market Square`,
      city: row.CITY,
      state: row.ABBR,
      latitude: row.LATITUDE,
      longitude: row.LONGITUDE,
      operatingHours: 'Sat 8:00-14:00',
    };
  });
}

/** Dense metro extras (additional markets beyond the 50-state baseline). */
const METRO_EXTRA_REGIONS: NationwideRegionSeed[] = [
  {
    name: 'Colorado Front Range Metro',
    slug: 'co-front-range-metro',
    timezone: 'America/Denver',
    geographicBounds: {
      type: 'bbox',
      north: 40.2,
      south: 39.4,
      east: -104.6,
      west: -105.3,
    },
  },
];

const METRO_EXTRA_MARKETS: NationwideMarketSeed[] = [
  {
    regionSlug: 'co-front-range-metro',
    name: 'Boulder County Farmers Market',
    slug: 'boulder-county',
    directorySlug: 'co-boulder-county',
    locationAddress: '1900 13th St',
    city: 'Boulder',
    state: 'CO',
    latitude: 40.0176,
    longitude: -105.2797,
    operatingHours: 'Wed & Sat mornings',
  },
  {
    regionSlug: stateRegionSlug('CA'),
    name: 'Ferry Plaza Farmers Market',
    slug: 'ferry-plaza',
    directorySlug: 'ca-sf-ferry-plaza',
    locationAddress: '1 Ferry Building',
    city: 'San Francisco',
    state: 'CA',
    latitude: 37.7955,
    longitude: -122.3937,
    operatingHours: 'Tue Thu Sat 8:00-14:00',
  },
  {
    regionSlug: stateRegionSlug('NY'),
    name: 'Union Square Greenmarket',
    slug: 'union-square',
    directorySlug: 'ny-union-square-greenmarket',
    locationAddress: 'E 17th St & Broadway',
    city: 'New York',
    state: 'NY',
    latitude: 40.7359,
    longitude: -73.9901,
    operatingHours: 'Mon Wed Fri Sat 8:00-18:00',
  },
  {
    regionSlug: stateRegionSlug('TX'),
    name: 'Houston Downtown Farmers Market',
    slug: 'houston-downtown',
    directorySlug: 'tx-houston-downtown',
    locationAddress: '1400 Travis St',
    city: 'Houston',
    state: 'TX',
    latitude: 29.753,
    longitude: -95.3662,
    operatingHours: 'Sat 8:00-13:00',
  },
  {
    regionSlug: stateRegionSlug('IL'),
    name: 'Green City Market Lincoln Park',
    slug: 'green-city-lincoln-park',
    directorySlug: 'il-chicago-green-city',
    locationAddress: '1750 N Clark St',
    city: 'Chicago',
    state: 'IL',
    latitude: 41.9142,
    longitude: -87.6345,
    operatingHours: 'Wed Sat 7:00-13:00',
  },
  {
    regionSlug: stateRegionSlug('WA'),
    name: 'Pike Place Market Daystalls',
    slug: 'pike-place',
    directorySlug: 'wa-seattle-pike-place',
    locationAddress: '85 Pike St',
    city: 'Seattle',
    state: 'WA',
    latitude: 47.6097,
    longitude: -122.3425,
    operatingHours: 'Daily 9:00-18:00',
  },
  {
    regionSlug: stateRegionSlug('FL'),
    name: 'Lincoln Road Farmers Market',
    slug: 'lincoln-road',
    directorySlug: 'fl-miami-lincoln-road',
    locationAddress: 'Lincoln Rd',
    city: 'Miami Beach',
    state: 'FL',
    latitude: 25.7907,
    longitude: -80.13,
    operatingHours: 'Sun 9:00-18:00',
  },
  {
    regionSlug: stateRegionSlug('ME'),
    name: 'Portland Maine Farmers Market',
    slug: 'portland-monument-square',
    directorySlug: 'me-portland-monument-square',
    locationAddress: 'Monument Square',
    city: 'Portland',
    state: 'ME',
    latitude: 43.6575,
    longitude: -70.2589,
    operatingHours: 'Wed Sat 7:00-13:00',
  },
];

export const NATIONWIDE_REGIONS: NationwideRegionSeed[] = [
  ...buildStateRegions(),
  ...METRO_EXTRA_REGIONS,
];

export const NATIONWIDE_MARKETS: NationwideMarketSeed[] = [
  ...buildStateMarkets(),
  ...METRO_EXTRA_MARKETS,
];

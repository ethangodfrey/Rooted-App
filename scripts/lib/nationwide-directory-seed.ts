/**
 * Multi-region structural seed data for public.markets + public.regions.
 * Indexed city/state + lat/lng + directory_slug for nationwide geo routing.
 */

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

export const NATIONWIDE_REGIONS: NationwideRegionSeed[] = [
  {
    name: 'Colorado Front Range',
    slug: 'co-front-range',
    timezone: 'America/Denver',
    geographicBounds: {
      type: 'bbox',
      north: 40.2,
      south: 39.4,
      east: -104.6,
      west: -105.3,
    },
  },
  {
    name: 'California Bay Area',
    slug: 'ca-bay-area',
    timezone: 'America/Los_Angeles',
    geographicBounds: {
      type: 'bbox',
      north: 38.0,
      south: 37.2,
      east: -121.7,
      west: -122.6,
    },
  },
  {
    name: 'New York Metro',
    slug: 'ny-metro',
    timezone: 'America/New_York',
    geographicBounds: {
      type: 'bbox',
      north: 41.0,
      south: 40.5,
      east: -73.7,
      west: -74.3,
    },
  },
  {
    name: 'Texas Triangle',
    slug: 'tx-triangle',
    timezone: 'America/Chicago',
    geographicBounds: {
      type: 'bbox',
      north: 30.5,
      south: 29.5,
      east: -95.0,
      west: -98.0,
    },
  },
  {
    name: 'Illinois Chicago',
    slug: 'il-chicago',
    timezone: 'America/Chicago',
    geographicBounds: {
      type: 'bbox',
      north: 42.1,
      south: 41.6,
      east: -87.5,
      west: -87.9,
    },
  },
];

export const NATIONWIDE_MARKETS: NationwideMarketSeed[] = [
  {
    regionSlug: 'co-front-range',
    name: 'Denver Union Station Farmers Market',
    slug: 'denver-union-station',
    directorySlug: 'co-denver-union-station',
    locationAddress: '1701 Wynkoop St',
    city: 'Denver',
    state: 'CO',
    latitude: 39.7527,
    longitude: -105.0002,
    operatingHours: 'Sat 9:00-14:00',
  },
  {
    regionSlug: 'co-front-range',
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
    regionSlug: 'ca-bay-area',
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
    regionSlug: 'ca-bay-area',
    name: 'Berkeley Farmers Market',
    slug: 'berkeley-center',
    directorySlug: 'ca-berkeley-center',
    locationAddress: 'Center St at Martin Luther King Jr Way',
    city: 'Berkeley',
    state: 'CA',
    latitude: 37.8705,
    longitude: -122.2727,
    operatingHours: 'Sat 10:00-15:00',
  },
  {
    regionSlug: 'ny-metro',
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
    regionSlug: 'ny-metro',
    name: 'Brooklyn Borough Hall Greenmarket',
    slug: 'brooklyn-borough-hall',
    directorySlug: 'ny-brooklyn-borough-hall',
    locationAddress: '209 Joralemon St',
    city: 'Brooklyn',
    state: 'NY',
    latitude: 40.6928,
    longitude: -73.9903,
    operatingHours: 'Tue Thu Sat 8:00-18:00',
  },
  {
    regionSlug: 'tx-triangle',
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
    regionSlug: 'tx-triangle',
    name: 'Austin Farmers Market Downtown',
    slug: 'austin-republic-square',
    directorySlug: 'tx-austin-republic-square',
    locationAddress: '422 Guadalupe St',
    city: 'Austin',
    state: 'TX',
    latitude: 30.2678,
    longitude: -97.7467,
    operatingHours: 'Sat 9:00-13:00',
  },
  {
    regionSlug: 'il-chicago',
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
    regionSlug: 'il-chicago',
    name: 'Chicago French Market',
    slug: 'chicago-french-market',
    directorySlug: 'il-chicago-french-market',
    locationAddress: '131 N Clinton St',
    city: 'Chicago',
    state: 'IL',
    latitude: 41.8845,
    longitude: -87.6412,
    operatingHours: 'Tue-Fri 7:00-19:00 Sat 7:00-18:00',
  },
];

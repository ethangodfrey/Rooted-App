export interface DiscoveredMarket {
  externalSource: string;
  externalId: string;
  name: string;
  description: string;
  organizerName: string | null;
  address: string | null;
  city: string;
  state: string;
  zipcode: string | null;
  latitude: number;
  longitude: number;
  parkingInfo: string | null;
  admissionInfo: string;
  openingHours: string | null;
  website: string | null;
  rawTags: Record<string, string>;
}

export type MarketType =
  | 'farmers_market'
  | 'flea_market'
  | 'public_market'
  | 'craft_market'
  | 'mixed'
  | 'unknown';

export type MarketImageSource =
  | 'osm_image'
  | 'wikimedia_commons'
  | 'wikidata'
  | 'wikipedia'
  | 'commons_geosearch'
  | 'website_og'
  | 'google_places'
  | null;

export interface EnrichedMarketProfile {
  description: string;
  marketHistory: string | null;
  marketType: MarketType;
  hoursSummary: string;
  runsOnDays: string[];
  seasonalSchedule: string | null;
  parkingInfo: string | null;
  admissionInfo: string;
  vendorTypes: string | null;
  paymentMethods: string | null;
  extraInfo: string | null;
  whatToLookFor: string | null;
  marketHighlights: string | null;
  featuredVendorCategories: string[];
  shopperTips: string[];
  websiteUrl: string | null;
  organizerName: string | null;
  timezone: string;
  wikipediaTitle: string | null;
  bannerUrl: string | null;
  imageSource: MarketImageSource;
  typicalDayOfWeek: string;
  typicalStartHour: number;
  typicalEndHour: number;
  enrichedBy: 'ai' | 'rules';
}

export const MARKETS_ENRICHMENT_VERSION = '7';

export interface MarketEnrichResult {
  processed: number;
  enriched: number;
  skipped: number;
  remaining: number;
  errors: string[];
}

export interface MarketAgentRunResult {
  runId: string;
  discovered: number;
  inserted: number;
  updated: number;
  enriched: number;
  catalogEnriched: number;
  catalogRemaining: number;
  skipped: number;
  errors: string[];
}

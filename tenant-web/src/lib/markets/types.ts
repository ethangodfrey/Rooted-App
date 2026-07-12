export interface NearbyNationalMarket {
  id: string;
  marketName: string;
  streetAddress: string | null;
  city: string;
  state: string;
  zipCode: string | null;
  operatingSchedules: unknown[];
  latitude: number | null;
  longitude: number | null;
  distanceMiles: number;
}

export interface NearbyMarketsApiResponse {
  markets: NearbyNationalMarket[];
  meta: {
    latitude: number;
    longitude: number;
    radiusMiles: number;
    count: number;
  };
}

export interface NearbyMarketsApiError {
  error: string;
}

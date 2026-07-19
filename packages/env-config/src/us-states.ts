/**
 * Nationwide US state validation fixtures for tenant routing + geo audits.
 * No emoji. Structural coords only — not a state allowlist for middleware.
 */

export type UsStateAbbr =
  | 'AL'
  | 'AK'
  | 'AZ'
  | 'AR'
  | 'CA'
  | 'CO'
  | 'CT'
  | 'DE'
  | 'FL'
  | 'GA'
  | 'HI'
  | 'ID'
  | 'IL'
  | 'IN'
  | 'IA'
  | 'KS'
  | 'KY'
  | 'LA'
  | 'ME'
  | 'MD'
  | 'MA'
  | 'MI'
  | 'MN'
  | 'MS'
  | 'MO'
  | 'MT'
  | 'NE'
  | 'NV'
  | 'NH'
  | 'NJ'
  | 'NM'
  | 'NY'
  | 'NC'
  | 'ND'
  | 'OH'
  | 'OK'
  | 'OR'
  | 'PA'
  | 'RI'
  | 'SC'
  | 'SD'
  | 'TN'
  | 'TX'
  | 'UT'
  | 'VT'
  | 'VA'
  | 'WA'
  | 'WV'
  | 'WI'
  | 'WY';

export type UsStateGeoFixture = {
  ABBR: UsStateAbbr;
  NAME: string;
  /** Representative city used for tenant subdomain examples. */
  CITY: string;
  /** DNS-safe city/state tenant subdomain (no allowlist — validation only). */
  TENANT_SLUG: string;
  LATITUDE: number;
  LONGITUDE: number;
  TIMEZONE: string;
};

/**
 * All 50 states with a representative marketplace coordinate.
 * Used by seed manifests and E2E geo/routing audits — middleware must NOT
 * consult this list when rewriting `*.vendorlymarketplace.com`.
 */
export const US_STATE_GEO_FIXTURES: readonly UsStateGeoFixture[] = [
  { ABBR: 'AL', NAME: 'Alabama', CITY: 'Birmingham', TENANT_SLUG: 'birmingham', LATITUDE: 33.5207, LONGITUDE: -86.8025, TIMEZONE: 'America/Chicago' },
  { ABBR: 'AK', NAME: 'Alaska', CITY: 'Anchorage', TENANT_SLUG: 'anchorage', LATITUDE: 61.2181, LONGITUDE: -149.9003, TIMEZONE: 'America/Anchorage' },
  { ABBR: 'AZ', NAME: 'Arizona', CITY: 'Phoenix', TENANT_SLUG: 'phoenix', LATITUDE: 33.4484, LONGITUDE: -112.074, TIMEZONE: 'America/Phoenix' },
  { ABBR: 'AR', NAME: 'Arkansas', CITY: 'Little Rock', TENANT_SLUG: 'little-rock', LATITUDE: 34.7465, LONGITUDE: -92.2896, TIMEZONE: 'America/Chicago' },
  { ABBR: 'CA', NAME: 'California', CITY: 'San Francisco', TENANT_SLUG: 'san-francisco', LATITUDE: 37.7749, LONGITUDE: -122.4194, TIMEZONE: 'America/Los_Angeles' },
  { ABBR: 'CO', NAME: 'Colorado', CITY: 'Denver', TENANT_SLUG: 'denver', LATITUDE: 39.7392, LONGITUDE: -104.9903, TIMEZONE: 'America/Denver' },
  { ABBR: 'CT', NAME: 'Connecticut', CITY: 'Hartford', TENANT_SLUG: 'hartford', LATITUDE: 41.7658, LONGITUDE: -72.6734, TIMEZONE: 'America/New_York' },
  { ABBR: 'DE', NAME: 'Delaware', CITY: 'Wilmington', TENANT_SLUG: 'wilmington', LATITUDE: 39.7391, LONGITUDE: -75.5398, TIMEZONE: 'America/New_York' },
  { ABBR: 'FL', NAME: 'Florida', CITY: 'Miami', TENANT_SLUG: 'miami', LATITUDE: 25.7617, LONGITUDE: -80.1918, TIMEZONE: 'America/New_York' },
  { ABBR: 'GA', NAME: 'Georgia', CITY: 'Atlanta', TENANT_SLUG: 'atlanta', LATITUDE: 33.749, LONGITUDE: -84.388, TIMEZONE: 'America/New_York' },
  { ABBR: 'HI', NAME: 'Hawaii', CITY: 'Honolulu', TENANT_SLUG: 'honolulu', LATITUDE: 21.3069, LONGITUDE: -157.8583, TIMEZONE: 'Pacific/Honolulu' },
  { ABBR: 'ID', NAME: 'Idaho', CITY: 'Boise', TENANT_SLUG: 'boise', LATITUDE: 43.615, LONGITUDE: -116.2023, TIMEZONE: 'America/Boise' },
  { ABBR: 'IL', NAME: 'Illinois', CITY: 'Chicago', TENANT_SLUG: 'chicago', LATITUDE: 41.8781, LONGITUDE: -87.6298, TIMEZONE: 'America/Chicago' },
  { ABBR: 'IN', NAME: 'Indiana', CITY: 'Indianapolis', TENANT_SLUG: 'indianapolis', LATITUDE: 39.7684, LONGITUDE: -86.1581, TIMEZONE: 'America/Indiana/Indianapolis' },
  { ABBR: 'IA', NAME: 'Iowa', CITY: 'Des Moines', TENANT_SLUG: 'des-moines', LATITUDE: 41.5868, LONGITUDE: -93.625, TIMEZONE: 'America/Chicago' },
  { ABBR: 'KS', NAME: 'Kansas', CITY: 'Kansas City', TENANT_SLUG: 'kansas-city-ks', LATITUDE: 39.1141, LONGITUDE: -94.6275, TIMEZONE: 'America/Chicago' },
  { ABBR: 'KY', NAME: 'Kentucky', CITY: 'Louisville', TENANT_SLUG: 'louisville', LATITUDE: 38.2527, LONGITUDE: -85.7585, TIMEZONE: 'America/New_York' },
  { ABBR: 'LA', NAME: 'Louisiana', CITY: 'New Orleans', TENANT_SLUG: 'new-orleans', LATITUDE: 29.9511, LONGITUDE: -90.0715, TIMEZONE: 'America/Chicago' },
  { ABBR: 'ME', NAME: 'Maine', CITY: 'Portland', TENANT_SLUG: 'portland-me', LATITUDE: 43.6591, LONGITUDE: -70.2568, TIMEZONE: 'America/New_York' },
  { ABBR: 'MD', NAME: 'Maryland', CITY: 'Baltimore', TENANT_SLUG: 'baltimore', LATITUDE: 39.2904, LONGITUDE: -76.6122, TIMEZONE: 'America/New_York' },
  { ABBR: 'MA', NAME: 'Massachusetts', CITY: 'Boston', TENANT_SLUG: 'boston', LATITUDE: 42.3601, LONGITUDE: -71.0589, TIMEZONE: 'America/New_York' },
  { ABBR: 'MI', NAME: 'Michigan', CITY: 'Detroit', TENANT_SLUG: 'detroit', LATITUDE: 42.3314, LONGITUDE: -83.0458, TIMEZONE: 'America/Detroit' },
  { ABBR: 'MN', NAME: 'Minnesota', CITY: 'Minneapolis', TENANT_SLUG: 'minneapolis', LATITUDE: 44.9778, LONGITUDE: -93.265, TIMEZONE: 'America/Chicago' },
  { ABBR: 'MS', NAME: 'Mississippi', CITY: 'Jackson', TENANT_SLUG: 'jackson', LATITUDE: 32.2988, LONGITUDE: -90.1848, TIMEZONE: 'America/Chicago' },
  { ABBR: 'MO', NAME: 'Missouri', CITY: 'Kansas City', TENANT_SLUG: 'kansas-city-mo', LATITUDE: 39.0997, LONGITUDE: -94.5786, TIMEZONE: 'America/Chicago' },
  { ABBR: 'MT', NAME: 'Montana', CITY: 'Billings', TENANT_SLUG: 'billings', LATITUDE: 45.7833, LONGITUDE: -108.5007, TIMEZONE: 'America/Denver' },
  { ABBR: 'NE', NAME: 'Nebraska', CITY: 'Omaha', TENANT_SLUG: 'omaha', LATITUDE: 41.2565, LONGITUDE: -95.9345, TIMEZONE: 'America/Chicago' },
  { ABBR: 'NV', NAME: 'Nevada', CITY: 'Las Vegas', TENANT_SLUG: 'las-vegas', LATITUDE: 36.1699, LONGITUDE: -115.1398, TIMEZONE: 'America/Los_Angeles' },
  { ABBR: 'NH', NAME: 'New Hampshire', CITY: 'Manchester', TENANT_SLUG: 'manchester-nh', LATITUDE: 42.9956, LONGITUDE: -71.4548, TIMEZONE: 'America/New_York' },
  { ABBR: 'NJ', NAME: 'New Jersey', CITY: 'Newark', TENANT_SLUG: 'newark', LATITUDE: 40.7357, LONGITUDE: -74.1724, TIMEZONE: 'America/New_York' },
  { ABBR: 'NM', NAME: 'New Mexico', CITY: 'Albuquerque', TENANT_SLUG: 'albuquerque', LATITUDE: 35.0844, LONGITUDE: -106.6504, TIMEZONE: 'America/Denver' },
  { ABBR: 'NY', NAME: 'New York', CITY: 'New York', TENANT_SLUG: 'new-york', LATITUDE: 40.7128, LONGITUDE: -74.006, TIMEZONE: 'America/New_York' },
  { ABBR: 'NC', NAME: 'North Carolina', CITY: 'Charlotte', TENANT_SLUG: 'charlotte', LATITUDE: 35.2271, LONGITUDE: -80.8431, TIMEZONE: 'America/New_York' },
  { ABBR: 'ND', NAME: 'North Dakota', CITY: 'Fargo', TENANT_SLUG: 'fargo', LATITUDE: 46.8772, LONGITUDE: -96.7898, TIMEZONE: 'America/Chicago' },
  { ABBR: 'OH', NAME: 'Ohio', CITY: 'Columbus', TENANT_SLUG: 'columbus', LATITUDE: 39.9612, LONGITUDE: -82.9988, TIMEZONE: 'America/New_York' },
  { ABBR: 'OK', NAME: 'Oklahoma', CITY: 'Oklahoma City', TENANT_SLUG: 'oklahoma-city', LATITUDE: 35.4676, LONGITUDE: -97.5164, TIMEZONE: 'America/Chicago' },
  { ABBR: 'OR', NAME: 'Oregon', CITY: 'Portland', TENANT_SLUG: 'portland-or', LATITUDE: 45.5152, LONGITUDE: -122.6784, TIMEZONE: 'America/Los_Angeles' },
  { ABBR: 'PA', NAME: 'Pennsylvania', CITY: 'Philadelphia', TENANT_SLUG: 'philadelphia', LATITUDE: 39.9526, LONGITUDE: -75.1652, TIMEZONE: 'America/New_York' },
  { ABBR: 'RI', NAME: 'Rhode Island', CITY: 'Providence', TENANT_SLUG: 'providence', LATITUDE: 41.824, LONGITUDE: -71.4128, TIMEZONE: 'America/New_York' },
  { ABBR: 'SC', NAME: 'South Carolina', CITY: 'Charleston', TENANT_SLUG: 'charleston', LATITUDE: 32.7765, LONGITUDE: -79.9311, TIMEZONE: 'America/New_York' },
  { ABBR: 'SD', NAME: 'South Dakota', CITY: 'Sioux Falls', TENANT_SLUG: 'sioux-falls', LATITUDE: 43.5446, LONGITUDE: -96.7311, TIMEZONE: 'America/Chicago' },
  { ABBR: 'TN', NAME: 'Tennessee', CITY: 'Nashville', TENANT_SLUG: 'nashville', LATITUDE: 36.1627, LONGITUDE: -86.7816, TIMEZONE: 'America/Chicago' },
  { ABBR: 'TX', NAME: 'Texas', CITY: 'Austin', TENANT_SLUG: 'austin', LATITUDE: 30.2672, LONGITUDE: -97.7431, TIMEZONE: 'America/Chicago' },
  { ABBR: 'UT', NAME: 'Utah', CITY: 'Salt Lake City', TENANT_SLUG: 'salt-lake-city', LATITUDE: 40.7608, LONGITUDE: -111.891, TIMEZONE: 'America/Denver' },
  { ABBR: 'VT', NAME: 'Vermont', CITY: 'Burlington', TENANT_SLUG: 'burlington', LATITUDE: 44.4759, LONGITUDE: -73.2121, TIMEZONE: 'America/New_York' },
  { ABBR: 'VA', NAME: 'Virginia', CITY: 'Richmond', TENANT_SLUG: 'richmond', LATITUDE: 37.5407, LONGITUDE: -77.436, TIMEZONE: 'America/New_York' },
  { ABBR: 'WA', NAME: 'Washington', CITY: 'Seattle', TENANT_SLUG: 'seattle', LATITUDE: 47.6062, LONGITUDE: -122.3321, TIMEZONE: 'America/Los_Angeles' },
  { ABBR: 'WV', NAME: 'West Virginia', CITY: 'Charleston', TENANT_SLUG: 'charleston-wv', LATITUDE: 38.3498, LONGITUDE: -81.6326, TIMEZONE: 'America/New_York' },
  { ABBR: 'WI', NAME: 'Wisconsin', CITY: 'Milwaukee', TENANT_SLUG: 'milwaukee', LATITUDE: 43.0389, LONGITUDE: -87.9065, TIMEZONE: 'America/Chicago' },
  { ABBR: 'WY', NAME: 'Wyoming', CITY: 'Cheyenne', TENANT_SLUG: 'cheyenne', LATITUDE: 41.14, LONGITUDE: -104.8202, TIMEZONE: 'America/Denver' },
] as const;

/** Randomized nationwide cross-section used by geo audits (not an allowlist). */
export const NATIONWIDE_GEO_CROSS_SECTION: readonly UsStateAbbr[] = [
  'WA',
  'FL',
  'ME',
  'CA',
  'TX',
  'IL',
  'CO',
  'NY',
] as const;

export const US_STATE_COUNT = 50;

export function assertUsStateFixtureCoverage(): {
  OK: true;
  COUNT: number;
} | {
  OK: false;
  ERROR: string;
} {
  if (US_STATE_GEO_FIXTURES.length !== US_STATE_COUNT) {
    return {
      OK: false,
      ERROR: `STATE_VALIDATION_FAIL EXPECTED=${US_STATE_COUNT} GOT=${US_STATE_GEO_FIXTURES.length}`,
    };
  }
  const seen = new Set<string>();
  for (const row of US_STATE_GEO_FIXTURES) {
    if (seen.has(row.ABBR)) {
      return { OK: false, ERROR: `STATE_VALIDATION_FAIL DUPLICATE=${row.ABBR}` };
    }
    seen.add(row.ABBR);
    if (
      !Number.isFinite(row.LATITUDE) ||
      !Number.isFinite(row.LONGITUDE) ||
      row.LATITUDE < -90 ||
      row.LATITUDE > 90 ||
      row.LONGITUDE < -180 ||
      row.LONGITUDE > 180
    ) {
      return { OK: false, ERROR: `STATE_VALIDATION_FAIL COORDS=${row.ABBR}` };
    }
  }
  return { OK: true, COUNT: seen.size };
}

export function getStateGeoFixture(abbr: string): UsStateGeoFixture | null {
  const normalized = abbr.trim().toUpperCase();
  return US_STATE_GEO_FIXTURES.find((row) => row.ABBR === normalized) ?? null;
}

export function getNationwideCrossSectionFixtures(): UsStateGeoFixture[] {
  return NATIONWIDE_GEO_CROSS_SECTION.map((abbr) => {
    const row = getStateGeoFixture(abbr);
    if (!row) {
      throw new Error(`STATE_VALIDATION_FAIL MISSING_CROSS_SECTION=${abbr}`);
    }
    return row;
  });
}

/**
 * DNS-safe single-label tenant subdomain pattern.
 * City/state names map through this shape — no regional allowlist.
 */
export const TENANT_SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function isValidTenantSubdomainSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return false;
  return TENANT_SUBDOMAIN_PATTERN.test(normalized);
}

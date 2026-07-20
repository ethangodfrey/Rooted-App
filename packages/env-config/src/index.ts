import { z } from 'zod';

import { MAX_PUBLIC_URL_LENGTH } from './domains';

export type EnvRecord = Record<string, string | undefined>;

export type ServerEnv = {
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
};

export type ClientEnv = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
};

export {
  CANONICAL_API_HOST,
  CANONICAL_API_ORIGIN,
  CANONICAL_APP_HOST,
  CANONICAL_APP_ORIGIN,
  CANONICAL_WWW_ORIGIN,
  LEGACY_API_HOST,
  LEGACY_APP_HOST,
  MAX_PUBLIC_URL_LENGTH,
} from './domains';

export {
  parseVendorConnectionRequest,
  parseVendorPeerRequestCreate,
  parseVendorPeerRequestUpdate,
  parseWholesaleInvoiceReconcile,
  parseWholesaleOrderDraftCreate,
  parseWholesaleOrderFulfillment,
  parseWholesaleOrderSettlement,
  parseWholesaleProductCreate,
  vendorBusinessConnectionStatusSchema,
  vendorConnectionRequestSchema,
  vendorPeerConnectionStatusSchema,
  vendorPeerRequestCreateSchema,
  vendorPeerRequestUpdateSchema,
  wholesaleInvoiceReconcileSchema,
  wholesaleOrderDraftCreateSchema,
  wholesaleOrderFulfillmentSchema,
  wholesaleOrderSettlementSchema,
  wholesaleProductCreateSchema,
  type VendorBusinessConnectionStatus,
  type VendorConnectionRequestInput,
  type VendorConnectionRequestParseResult,
  type VendorPeerConnectionStatus,
  type VendorPeerRequestCreateInput,
  type VendorPeerRequestCreateParseResult,
  type VendorPeerRequestUpdateInput,
  type VendorPeerRequestUpdateParseResult,
  type WholesaleInvoiceReconcileInput,
  type WholesaleInvoiceReconcileParseResult,
  type WholesaleOrderDraftCreateInput,
  type WholesaleOrderDraftCreateParseResult,
  type WholesaleOrderFulfillmentInput,
  type WholesaleOrderFulfillmentParseResult,
  type WholesaleOrderSettlementInput,
  type WholesaleOrderSettlementParseResult,
  type WholesaleProductCreateInput,
  type WholesaleProductCreateParseResult,
} from './b2b';

export {
  DEFAULT_NEARBY_LIMIT,
  DEFAULT_NEARBY_RADIUS_MILES,
  MAX_NEARBY_LIMIT,
  MAX_NEARBY_RADIUS_MILES,
  boundingBoxDegrees,
  nearbyMarketsQuerySchema,
  parseNearbyMarketsQuery,
  parseNearbyMarketsQuerySafe,
  parseWholesaleProximitySearchQuerySafe,
  pointInBoundingBox,
  wholesaleProximitySearchQuerySchema,
  type GeoBoundingBox,
  type NearbyMarketsQuery,
  type NearbyMarketsQueryParseResult,
  type WholesaleProximitySearchParseResult,
  type WholesaleProximitySearchQuery,
} from './geo';

export {
  NATIONWIDE_GEO_CROSS_SECTION,
  TENANT_SUBDOMAIN_PATTERN,
  US_STATE_COUNT,
  US_STATE_GEO_FIXTURES,
  assertUsStateFixtureCoverage,
  getNationwideCrossSectionFixtures,
  getStateGeoFixture,
  isValidTenantSubdomainSlug,
  type UsStateAbbr,
  type UsStateGeoFixture,
} from './us-states';

const MIN_ANON_KEY_LENGTH = 32;

/**
 * Public HTTPS URL parser for app/API origins.
 * Explicit max length keeps longer marketplace hosts
 * (vendorlymarketplace.com / api.vendorlymarketplace.app) valid.
 */
export const publicHttpsUrlSchema = z
  .string()
  .trim()
  .min(1, 'ENV_VALIDATION_ERROR: PUBLIC_URL REQUIRED')
  .max(
    MAX_PUBLIC_URL_LENGTH,
    `ENV_VALIDATION_ERROR: PUBLIC_URL EXCEEDS ${MAX_PUBLIC_URL_LENGTH} CHARS`,
  )
  .url('ENV_VALIDATION_ERROR: PUBLIC_URL MUST BE A VALID URL')
  .refine(
    (value) => value.toLowerCase().startsWith('https://'),
    'ENV_VALIDATION_ERROR: PUBLIC_URL MUST BE HTTPS',
  );

const databaseUrlSchema = z
  .string({
    required_error: 'MISSING_PARAMETER: DATABASE_URL',
    invalid_type_error: 'MISSING_PARAMETER: DATABASE_URL',
  })
  .trim()
  .min(1, 'MISSING_PARAMETER: DATABASE_URL')
  .refine(
    (value) => /^(postgres|postgresql):\/\//i.test(value),
    'ENV_VALIDATION_ERROR: DATABASE_URL MUST USE POSTGRES OR POSTGRESQL PROTOCOL',
  );

const supabaseUrlSchema = z
  .string({
    required_error: 'MISSING_PARAMETER: SUPABASE_URL',
    invalid_type_error: 'MISSING_PARAMETER: SUPABASE_URL',
  })
  .trim()
  .min(1, 'MISSING_PARAMETER: SUPABASE_URL')
  .max(
    MAX_PUBLIC_URL_LENGTH,
    `ENV_VALIDATION_ERROR: SUPABASE_URL EXCEEDS ${MAX_PUBLIC_URL_LENGTH} CHARS`,
  )
  .url('ENV_VALIDATION_ERROR: SUPABASE_URL MUST BE A VALID URL')
  .refine(
    (value) => value.toLowerCase().startsWith('https://'),
    'ENV_VALIDATION_ERROR: SUPABASE_URL MUST BE HTTPS',
  );

const supabaseAnonKeySchema = z
  .string({
    required_error: 'MISSING_PARAMETER: SUPABASE_ANON_KEY',
    invalid_type_error: 'MISSING_PARAMETER: SUPABASE_ANON_KEY',
  })
  .trim()
  .min(1, 'MISSING_PARAMETER: SUPABASE_ANON_KEY')
  .refine(
    (value) => value.length >= MIN_ANON_KEY_LENGTH,
    `ENV_VALIDATION_ERROR: SUPABASE_ANON_KEY TOKEN TOO SHORT (MIN ${MIN_ANON_KEY_LENGTH})`,
  );

const serverEnvSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  SUPABASE_URL: supabaseUrlSchema,
  SUPABASE_ANON_KEY: supabaseAnonKeySchema,
});

const clientEnvSchema = z.object({
  SUPABASE_URL: supabaseUrlSchema,
  SUPABASE_ANON_KEY: supabaseAnonKeySchema,
});

function readString(env: EnvRecord, key: string): string | undefined {
  const raw = env[key];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function firstPresent(env: EnvRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readString(env, key);
    if (value !== undefined) return value;
  }
  return undefined;
}

function shouldSkipValidation(env: EnvRecord): boolean {
  const skip = readString(env, 'ENV_VALIDATION_SKIP');
  if (skip && /^(1|true|yes)$/i.test(skip)) return true;
  const nodeEnv = readString(env, 'NODE_ENV');
  return nodeEnv === 'test';
}

function formatIssues(error: z.ZodError): string[] {
  const messages = new Set<string>();
  for (const issue of error.issues) {
    const message = issue.message.trim().toUpperCase();
    if (message) messages.add(message);
  }
  if (messages.size === 0) {
    messages.add('ENV_VALIDATION_ERROR: UNKNOWN SCHEMA FAILURE');
  }
  return [...messages];
}

function abortWithEnvError(issues: string[]): never {
  const lines = [
    'CRITICAL CONFIGURATION ERROR: INVALID RUNTIME ENVIRONMENT PARAMS',
    ...issues,
  ];
  for (const line of lines) {
    // Uppercase monospaced telemetry only — no emoji.
    console.error(line);
  }
  throw new Error(lines.join(' | '));
}

/**
 * Server runtime contract: DATABASE_URL + SUPABASE_URL + SUPABASE_ANON_KEY.
 * Blocks boot when required parameters are missing or malformed.
 */
export function validateServerEnv(
  env: EnvRecord = process.env as EnvRecord,
): ServerEnv {
  if (shouldSkipValidation(env)) {
    return {
      DATABASE_URL: readString(env, 'DATABASE_URL') ?? '',
      SUPABASE_URL:
        firstPresent(env, ['SUPABASE_URL', 'VITE_SUPABASE_URL']) ?? '',
      SUPABASE_ANON_KEY:
        firstPresent(env, [
          'SUPABASE_ANON_KEY',
          'VITE_SUPABASE_ANON_KEY',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        ]) ?? '',
    };
  }

  const candidate = {
    DATABASE_URL: readString(env, 'DATABASE_URL'),
    SUPABASE_URL: firstPresent(env, [
      'SUPABASE_URL',
      'VITE_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
    ]),
    SUPABASE_ANON_KEY: firstPresent(env, [
      'SUPABASE_ANON_KEY',
      'VITE_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]),
  };

  const parsed = serverEnvSchema.safeParse(candidate);
  if (!parsed.success) {
    abortWithEnvError(formatIssues(parsed.error));
  }
  return parsed.data;
}

/**
 * Client / edge runtime contract: SUPABASE_URL + SUPABASE_ANON_KEY.
 * Accepts VITE_ / NEXT_PUBLIC_ aliases for monorepo web surfaces.
 */
export function validateClientEnv(
  env: EnvRecord = process.env as EnvRecord,
): ClientEnv {
  if (shouldSkipValidation(env)) {
    return {
      SUPABASE_URL:
        firstPresent(env, [
          'SUPABASE_URL',
          'VITE_SUPABASE_URL',
          'NEXT_PUBLIC_SUPABASE_URL',
        ]) ?? '',
      SUPABASE_ANON_KEY:
        firstPresent(env, [
          'SUPABASE_ANON_KEY',
          'VITE_SUPABASE_ANON_KEY',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        ]) ?? '',
    };
  }

  const candidate = {
    SUPABASE_URL: firstPresent(env, [
      'SUPABASE_URL',
      'VITE_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
    ]),
    SUPABASE_ANON_KEY: firstPresent(env, [
      'SUPABASE_ANON_KEY',
      'VITE_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]),
  };

  const parsed = clientEnvSchema.safeParse(candidate);
  if (!parsed.success) {
    abortWithEnvError(formatIssues(parsed.error));
  }
  return parsed.data;
}

/** NestJS ConfigModule.validate adapter — returns the original config bag on success. */
export function nestConfigValidate<T extends Record<string, unknown>>(
  config: T,
): T {
  validateServerEnv(config as EnvRecord);
  return config;
}

/** Optional PUBLIC_BASE_URL / VITE_APP_URL style HTTPS origin check. */
export function validatePublicHttpsUrl(value: string): string {
  const parsed = publicHttpsUrlSchema.safeParse(value);
  if (!parsed.success) {
    abortWithEnvError(formatIssues(parsed.error));
  }
  return parsed.data;
}

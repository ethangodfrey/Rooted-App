/**
 * Strict production environment schema (Zod).
 *
 * Third-party keys: Stripe, Twilio, SendGrid, Supabase, Mux.
 *
 * Telemetry (uppercase, no emoji):
 *   ENV_VALIDATION_PASSED
 *   MISSING_ENV_VARIABLE
 */

import { z } from 'zod';

export type EnvRecord = Record<string, string | undefined>;

const nonEmpty = (key: string) =>
  z
    .string({
      required_error: `MISSING_ENV_VARIABLE ${key}`,
      invalid_type_error: `MISSING_ENV_VARIABLE ${key}`,
    })
    .trim()
    .min(1, `MISSING_ENV_VARIABLE ${key}`);

const httpsUrl = (key: string) =>
  nonEmpty(key)
    .url(`ENV_VALIDATION_ERROR: ${key} MUST BE A VALID URL`)
    .refine(
      (value) => value.toLowerCase().startsWith('https://'),
      `ENV_VALIDATION_ERROR: ${key} MUST BE HTTPS`,
    );

/**
 * Production / strict deploy contract — all third-party API keys required.
 */
export const productionEnvSchema = z.object({
  NODE_ENV: z.literal('production').or(z.string().optional()),

  // Core
  DATABASE_URL: nonEmpty('DATABASE_URL').refine(
    (value) => /^(postgres|postgresql):\/\//i.test(value),
    'ENV_VALIDATION_ERROR: DATABASE_URL MUST USE POSTGRES OR POSTGRESQL PROTOCOL',
  ),

  // Supabase
  SUPABASE_URL: httpsUrl('SUPABASE_URL'),
  SUPABASE_ANON_KEY: nonEmpty('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty('SUPABASE_SERVICE_ROLE_KEY'),

  // Stripe
  STRIPE_SECRET_KEY: nonEmpty('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: nonEmpty('STRIPE_WEBHOOK_SECRET'),

  // Twilio (SMS)
  TWILIO_ACCOUNT_SID: nonEmpty('TWILIO_ACCOUNT_SID'),
  TWILIO_AUTH_TOKEN: nonEmpty('TWILIO_AUTH_TOKEN'),

  // SendGrid (email)
  SENDGRID_API_KEY: nonEmpty('SENDGRID_API_KEY'),

  // Mux (creator media streaming)
  MUX_TOKEN_ID: nonEmpty('MUX_TOKEN_ID'),
  MUX_TOKEN_SECRET: nonEmpty('MUX_TOKEN_SECRET'),
});

export type ProductionEnv = z.infer<typeof productionEnvSchema>;

/** Keys that must be present for a production deploy. */
export const REQUIRED_PRODUCTION_ENV_KEYS = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'SENDGRID_API_KEY',
  'MUX_TOKEN_ID',
  'MUX_TOKEN_SECRET',
] as const;

export type RequiredProductionEnvKey = (typeof REQUIRED_PRODUCTION_ENV_KEYS)[number];

function readString(env: EnvRecord, key: string): string | undefined {
  const raw = env[key];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isTruthyFlag(value: string | undefined): boolean {
  return Boolean(value && /^(1|true|yes)$/i.test(value));
}

export function shouldSkipEnvValidation(env: EnvRecord = process.env as EnvRecord): boolean {
  if (isTruthyFlag(readString(env, 'ENV_VALIDATION_SKIP'))) return true;
  return readString(env, 'NODE_ENV') === 'test';
}

export function isStrictEnvValidation(env: EnvRecord = process.env as EnvRecord): boolean {
  if (isTruthyFlag(readString(env, 'STRICT_ENV_VALIDATION'))) return true;
  return readString(env, 'NODE_ENV') === 'production';
}

export function collectMissingEnvKeys(
  env: EnvRecord = process.env as EnvRecord,
): RequiredProductionEnvKey[] {
  return REQUIRED_PRODUCTION_ENV_KEYS.filter((key) => !readString(env, key));
}

function pickProductionEnv(env: EnvRecord): Record<string, string | undefined> {
  return {
    NODE_ENV: readString(env, 'NODE_ENV'),
    DATABASE_URL: readString(env, 'DATABASE_URL'),
    SUPABASE_URL: readString(env, 'SUPABASE_URL'),
    SUPABASE_ANON_KEY: readString(env, 'SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: readString(env, 'SUPABASE_SERVICE_ROLE_KEY'),
    STRIPE_SECRET_KEY: readString(env, 'STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: readString(env, 'STRIPE_WEBHOOK_SECRET'),
    TWILIO_ACCOUNT_SID: readString(env, 'TWILIO_ACCOUNT_SID'),
    TWILIO_AUTH_TOKEN: readString(env, 'TWILIO_AUTH_TOKEN'),
    SENDGRID_API_KEY: readString(env, 'SENDGRID_API_KEY'),
    MUX_TOKEN_ID: readString(env, 'MUX_TOKEN_ID'),
    MUX_TOKEN_SECRET: readString(env, 'MUX_TOKEN_SECRET'),
  };
}

function abortMissing(keys: string[]): never {
  const unique = [...new Set(keys)].sort();
  const line = `MISSING_ENV_VARIABLE KEYS=${unique.join(',')}`;
  // eslint-disable-next-line no-console
  console.error(line);
  for (const key of unique) {
    // eslint-disable-next-line no-console
    console.error(`MISSING_ENV_VARIABLE ${key}`);
  }
  throw new Error(line);
}

/**
 * Parse `process.env` against the production third-party schema.
 *
 * - production / STRICT_ENV_VALIDATION=1 → fail-fast on any missing key
 * - development → skips third-party hard fail (logs ENV_VALIDATION_PASSED MODE=DEV)
 * - test / ENV_VALIDATION_SKIP → skip
 */
export function validateEnv(
  env: EnvRecord = process.env as EnvRecord,
): ProductionEnv | null {
  if (shouldSkipEnvValidation(env)) {
    // eslint-disable-next-line no-console
    console.log('ENV_VALIDATION_PASSED MODE=SKIP');
    return null;
  }

  if (!isStrictEnvValidation(env)) {
    // eslint-disable-next-line no-console
    console.log('ENV_VALIDATION_PASSED MODE=DEV');
    return null;
  }

  const missing = collectMissingEnvKeys(env);
  if (missing.length > 0) {
    abortMissing(missing);
  }

  const parsed = productionEnvSchema.safeParse(pickProductionEnv(env));
  if (!parsed.success) {
    const fromZod = parsed.error.issues
      .map((issue) => {
        const match = issue.message.match(/MISSING_ENV_VARIABLE\s+(\w+)/);
        if (match?.[1]) return match[1];
        if (issue.path[0]) return String(issue.path[0]);
        return null;
      })
      .filter((key): key is string => Boolean(key));
    abortMissing(fromZod.length > 0 ? fromZod : collectMissingEnvKeys(env));
  }

  // eslint-disable-next-line no-console
  console.log('ENV_VALIDATION_PASSED');
  return parsed.data;
}

/** Alias for bootstrap / deploy scripts. */
export const assertEnv = validateEnv;

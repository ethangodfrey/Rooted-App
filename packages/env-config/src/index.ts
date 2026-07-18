import { z } from 'zod';

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

const MIN_ANON_KEY_LENGTH = 32;

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

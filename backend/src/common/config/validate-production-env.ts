import type { ConfigService } from '@nestjs/config';

import {
  collectMissingEnvKeys,
  isStrictEnvValidation,
  validateEnv,
} from '../../config/env';

export interface ProductionEnvAudit {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

const RECOMMENDED_IN_PRODUCTION = [
  'CORS_ORIGINS',
  'PUBLIC_BASE_URL',
  'WEB_APP_URL',
  'POS_CREDENTIAL_KEY',
] as const;

/**
 * Audits production-only env without mutating development defaults.
 * Prefer `validateEnv()` from `src/config/env.ts` at bootstrap for fail-fast.
 */
export function auditProductionEnv(config: ConfigService): ProductionEnvAudit {
  const bag: Record<string, string | undefined> = {
    NODE_ENV: config.get<string>('NODE_ENV'),
    DATABASE_URL: config.get<string>('DATABASE_URL'),
    SUPABASE_URL: config.get<string>('SUPABASE_URL'),
    SUPABASE_ANON_KEY: config.get<string>('SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: config.get<string>('SUPABASE_SERVICE_ROLE_KEY'),
    STRIPE_SECRET_KEY: config.get<string>('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: config.get<string>('STRIPE_WEBHOOK_SECRET'),
    TWILIO_ACCOUNT_SID: config.get<string>('TWILIO_ACCOUNT_SID'),
    TWILIO_AUTH_TOKEN: config.get<string>('TWILIO_AUTH_TOKEN'),
    SENDGRID_API_KEY: config.get<string>('SENDGRID_API_KEY'),
    MUX_TOKEN_ID: config.get<string>('MUX_TOKEN_ID'),
    MUX_TOKEN_SECRET: config.get<string>('MUX_TOKEN_SECRET'),
  };

  const missing = isStrictEnvValidation(bag) ? collectMissingEnvKeys(bag) : [];
  const warnings: string[] = [];

  for (const key of RECOMMENDED_IN_PRODUCTION) {
    if (!config.get<string>(key, '').trim()) {
      warnings.push(key);
    }
  }

  const webAppUrl = config.get<string>('WEB_APP_URL', '').trim();
  if (webAppUrl.startsWith('http://localhost')) {
    warnings.push('WEB_APP_URL points at localhost in production');
  }

  const publicBase = config.get<string>('PUBLIC_BASE_URL', '').trim();
  if (publicBase && !publicBase.startsWith('https://')) {
    warnings.push('PUBLIC_BASE_URL should use HTTPS in production');
  }

  return { ok: missing.length === 0, missing, warnings };
}

/** @deprecated Prefer validateEnv() from src/config/env.ts */
export function assertProductionEnv(config: ConfigService): void {
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  if (nodeEnv !== 'production') return;

  // Delegate to Zod fail-fast schema (MISSING_ENV_VARIABLE / ENV_VALIDATION_PASSED).
  const bag: Record<string, string | undefined> = {
    NODE_ENV: nodeEnv,
    DATABASE_URL: config.get<string>('DATABASE_URL'),
    SUPABASE_URL: config.get<string>('SUPABASE_URL'),
    SUPABASE_ANON_KEY: config.get<string>('SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE_KEY: config.get<string>('SUPABASE_SERVICE_ROLE_KEY'),
    STRIPE_SECRET_KEY: config.get<string>('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: config.get<string>('STRIPE_WEBHOOK_SECRET'),
    TWILIO_ACCOUNT_SID: config.get<string>('TWILIO_ACCOUNT_SID'),
    TWILIO_AUTH_TOKEN: config.get<string>('TWILIO_AUTH_TOKEN'),
    SENDGRID_API_KEY: config.get<string>('SENDGRID_API_KEY'),
    MUX_TOKEN_ID: config.get<string>('MUX_TOKEN_ID'),
    MUX_TOKEN_SECRET: config.get<string>('MUX_TOKEN_SECRET'),
  };
  validateEnv(bag);

  const audit = auditProductionEnv(config);
  if (audit.warnings.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[production-env] warnings: ${audit.warnings.join(', ')}`);
  }
}

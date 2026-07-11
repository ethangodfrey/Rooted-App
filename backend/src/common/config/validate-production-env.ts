import type { ConfigService } from '@nestjs/config';

export interface ProductionEnvAudit {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'PUBLIC_BASE_URL',
  'WEB_APP_URL',
  'SUPABASE_URL',
] as const;

const RECOMMENDED_IN_PRODUCTION = [
  'CORS_ORIGINS',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'POS_CREDENTIAL_KEY',
] as const;

/** Audits production-only env without mutating development defaults. */
export function auditProductionEnv(config: ConfigService): ProductionEnvAudit {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!config.get<string>(key, '').trim()) {
      missing.push(key);
    }
  }

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

export function assertProductionEnv(config: ConfigService): void {
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  if (nodeEnv !== 'production') return;

  const audit = auditProductionEnv(config);
  if (!audit.ok) {
    throw new Error(
      `Production startup blocked — missing required env: ${audit.missing.join(', ')}`,
    );
  }

  if (audit.warnings.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[production-env] warnings: ${audit.warnings.join(', ')}`,
    );
  }
}

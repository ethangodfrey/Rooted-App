/**
 * Production gate helpers for MarketNotificationScheduler.
 * Telemetry: NOTIFICATION_SYSTEM_DEPLOYED
 */

export const MARKET_ALERT_CRON_EXPRESSION = '*/5 * * * *' as const;

export function resolveMarketAlertCronEnabled(input: {
  envFlag?: string | null;
  nodeEnv?: string | null;
}): boolean {
  const raw = (input.envFlag ?? '').trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return (input.nodeEnv ?? 'development').trim().toLowerCase() === 'production';
}

export function formatNotificationSystemDeployedLog(input: {
  enabled: boolean;
  nodeEnv: string;
  cron: string;
}): string {
  return `NOTIFICATION_SYSTEM_DEPLOYED SERVICE=MarketNotificationService CRON=${input.cron} ENABLED=${input.enabled ? '1' : '0'} NODE_ENV=${input.nodeEnv.toUpperCase()}`;
}

export function assertProductionCronEnabled(input: {
  envFlag?: string | null;
  nodeEnv?: string | null;
}): void {
  const nodeEnv = (input.nodeEnv ?? 'development').trim().toLowerCase();
  if (nodeEnv !== 'production') return;
  const enabled = resolveMarketAlertCronEnabled(input);
  if (!enabled) {
    throw new Error(
      'NOTIFICATION_SYSTEM_DEPLOY_FAIL MARKET_ALERT_CRON_ENABLED_FALSE_IN_PRODUCTION',
    );
  }
}

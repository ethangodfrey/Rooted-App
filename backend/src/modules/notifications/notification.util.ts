/**
 * Notification Engine helpers.
 * Telemetry: NOTIFICATION_ENGINE_ACTIVE, EVENT_DISPATCHED
 */

export type NotificationChannel = 'EMAIL' | 'SMS';
export type NotificationStatus = 'SENT' | 'FAILED';

export type NotificationPreferences = {
  emailEnabled: boolean;
  smsEnabled: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  smsEnabled: true,
};

export function formatNotificationEngineActiveLog(input?: {
  channel?: NotificationChannel;
  eventType?: string;
}): string {
  const parts = ['NOTIFICATION_ENGINE_ACTIVE'];
  if (input?.channel) parts.push(`CHANNEL=${input.channel}`);
  if (input?.eventType) parts.push(`EVENT=${input.eventType}`);
  return parts.join(' ');
}

export function formatEventDispatchedLog(input?: {
  channel?: NotificationChannel;
  eventType?: string;
  status?: NotificationStatus;
  userId?: string;
}): string {
  const parts = ['EVENT_DISPATCHED'];
  if (input?.channel) parts.push(`CHANNEL=${input.channel}`);
  if (input?.eventType) parts.push(`EVENT=${input.eventType}`);
  if (input?.status) parts.push(`STATUS=${input.status}`);
  if (input?.userId) parts.push(`USER=${input.userId}`);
  return parts.join(' ');
}

export function normalizeNotificationPreferences(
  value: unknown,
): NotificationPreferences {
  const raw =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const emailEnabled =
    typeof raw.emailEnabled === 'boolean'
      ? raw.emailEnabled
      : typeof raw.email === 'boolean'
        ? raw.email
        : DEFAULT_NOTIFICATION_PREFERENCES.emailEnabled;
  const smsEnabled =
    typeof raw.smsEnabled === 'boolean'
      ? raw.smsEnabled
      : typeof raw.sms === 'boolean'
        ? raw.sms
        : DEFAULT_NOTIFICATION_PREFERENCES.smsEnabled;
  return { emailEnabled, smsEnabled };
}

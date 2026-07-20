import { api } from '@/lib/api';

/**
 * Phase 9 Notification Engine client.
 * Telemetry: NOTIFICATION_ENGINE_ACTIVE, EVENT_DISPATCHED
 */

export type NotificationPreferences = {
  emailEnabled: boolean;
  smsEnabled: boolean;
};

export type NotificationPreferencesResponse = {
  STATUS: string;
  USER_ID: string;
  EMAIL_ENABLED: boolean;
  SMS_ENABLED: boolean;
  PREFERENCES: NotificationPreferences;
};

export function formatNotificationEngineActiveLog(): string {
  return 'NOTIFICATION_ENGINE_ACTIVE SERVICE=NotificationService';
}

export function formatEventDispatchedLog(input?: {
  channel?: string;
  eventType?: string;
}): string {
  const parts = ['EVENT_DISPATCHED'];
  if (input?.channel) parts.push(`CHANNEL=${input.channel}`);
  if (input?.eventType) parts.push(`EVENT=${input.eventType}`);
  return parts.join(' ');
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferencesResponse> {
  return api.get('/api/notifications/preferences');
}

export async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<NotificationPreferencesResponse> {
  return api.patch('/api/notifications/preferences', prefs);
}

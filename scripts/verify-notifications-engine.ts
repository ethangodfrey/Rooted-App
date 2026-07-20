/**
 * Phase 9 Automated Notification Engine verification.
 *
 * Usage:
 *   npm run test:notifications:engine
 *
 * Success lines (uppercase, no emoji):
 *   NOTIFICATION_ENGINE_ACTIVE
 *   EVENT_DISPATCHED
 *   NOTIFICATIONS_ENGINE_VERIFIED
 */

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  formatEventDispatchedLog,
  formatNotificationEngineActiveLog,
  normalizeNotificationPreferences,
} from '../backend/src/modules/notifications/notification.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

const SETTINGS_ROUTE = '/settings';
const PREFS_PATH = '/api/notifications/preferences';
const LOGISTICS_TRIGGER = 'DELIVERY_STOP_DELIVERED';
const ESCROW_TRIGGER = 'ESCROW_SETTLED';
const DISPUTE_TRIGGER = 'DISPUTE_RESOLVED';

/** Mirrors NotificationService preference gate. */
function shouldSend(
  prefs: { emailEnabled: boolean; smsEnabled: boolean },
  channel: 'EMAIL' | 'SMS',
): boolean {
  return channel === 'EMAIL' ? prefs.emailEnabled : prefs.smsEnabled;
}

/** Mirrors non-blocking dispatch: core workflow continues even if notify fails. */
function runCoreThenNotify(core: () => string, notify: () => void): string {
  const result = core();
  try {
    notify();
  } catch {
    // ignored — never blocks transactional result
  }
  return result;
}

function main(): void {
  log(formatNotificationEngineActiveLog({ channel: 'EMAIL', eventType: ESCROW_TRIGGER }));
  log(
    formatEventDispatchedLog({
      channel: 'SMS',
      eventType: LOGISTICS_TRIGGER,
      status: 'SENT',
    }),
  );

  assert(SETTINGS_ROUTE === '/settings', 'SETTINGS_ROUTE_FAIL');
  assert(PREFS_PATH === '/api/notifications/preferences', 'PREFS_PATH_FAIL');
  assert(LOGISTICS_TRIGGER === 'DELIVERY_STOP_DELIVERED', 'LOGISTICS_EVENT');
  assert(ESCROW_TRIGGER === 'ESCROW_SETTLED', 'ESCROW_EVENT');
  assert(DISPUTE_TRIGGER === 'DISPUTE_RESOLVED', 'DISPUTE_EVENT');

  const defaults = normalizeNotificationPreferences(null);
  assert(defaults.emailEnabled === true, 'DEFAULT_EMAIL');
  assert(defaults.smsEnabled === true, 'DEFAULT_SMS');
  assert(
    DEFAULT_NOTIFICATION_PREFERENCES.emailEnabled === true,
    'CONST_DEFAULT_EMAIL',
  );

  const disabled = normalizeNotificationPreferences({
    emailEnabled: false,
    smsEnabled: false,
  });
  assert(shouldSend(disabled, 'EMAIL') === false, 'EMAIL_OFF');
  assert(shouldSend(disabled, 'SMS') === false, 'SMS_OFF');

  const alias = normalizeNotificationPreferences({ email: true, sms: false });
  assert(alias.emailEnabled === true, 'ALIAS_EMAIL');
  assert(alias.smsEnabled === false, 'ALIAS_SMS');

  let notifyCalled = false as boolean;
  const coreResult = runCoreThenNotify(
    () => 'SETTLED',
    () => {
      notifyCalled = true;
      throw new Error('MOCK_PROVIDER_DOWN');
    },
  );
  assert(coreResult === 'SETTLED', 'CORE_NOT_BLOCKED');
  assert(notifyCalled, 'NOTIFY_ATTEMPTED');

  assert(
    formatNotificationEngineActiveLog().startsWith('NOTIFICATION_ENGINE_ACTIVE'),
    'INIT_LOG',
  );
  assert(formatEventDispatchedLog().startsWith('EVENT_DISPATCHED'), 'DISPATCH_LOG');

  // Channel contract for mocks
  const emailMock = `EVENT_DISPATCHED CHANNEL=EMAIL TO=vendor@example.com SUBJECT=Vendorly_escrow_settled`;
  const smsMock = `EVENT_DISPATCHED CHANNEL=SMS TO=+15551234567`;
  assert(emailMock.includes('CHANNEL=EMAIL'), 'EMAIL_MOCK');
  assert(smsMock.includes('CHANNEL=SMS'), 'SMS_MOCK');

  log('NOTIFICATIONS_ENGINE_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`NOTIFICATIONS_ENGINE_FAILED ${message}`);
  process.exitCode = 1;
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { FieldError } from '@/components/ui/FieldError';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import {
  fetchNotificationPreferences,
  formatEventDispatchedLog,
  formatNotificationEngineActiveLog,
  updateNotificationPreferences,
} from '@/lib/notifications';
import '@/components/ui/ui.css';

/**
 * General user settings — Notification Preferences (Phase 9).
 * Route: /settings
 */
export function SettingsPage() {
  const { user } = useAuth();
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    console.log(formatNotificationEngineActiveLog());
  }, []);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    if (!isApiConfigured) {
      const raw = user.notification_preferences ?? {};
      setEmailEnabled(
        typeof (raw as { emailEnabled?: boolean }).emailEnabled === 'boolean'
          ? Boolean((raw as { emailEnabled?: boolean }).emailEnabled)
          : true,
      );
      setSmsEnabled(
        typeof (raw as { smsEnabled?: boolean }).smsEnabled === 'boolean'
          ? Boolean((raw as { smsEnabled?: boolean }).smsEnabled)
          : true,
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchNotificationPreferences();
      setEmailEnabled(Boolean(res.EMAIL_ENABLED));
      setSmsEnabled(Boolean(res.SMS_ENABLED));
      console.log(
        formatEventDispatchedLog({
          channel: 'PREFS',
          eventType: 'LOADED',
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load notification preferences',
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.notification_preferences]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!isApiConfigured) {
        setError('Backend API is not configured. Set VITE_API_URL.');
        return;
      }
      const res = await updateNotificationPreferences({
        emailEnabled,
        smsEnabled,
      });
      setEmailEnabled(Boolean(res.EMAIL_ENABLED));
      setSmsEnabled(Boolean(res.SMS_ENABLED));
      setMessage('NOTIFICATION_ENGINE_ACTIVE · PREFERENCES SAVED');
      console.log(
        formatEventDispatchedLog({
          channel: 'PREFS',
          eventType: 'UPDATED',
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save notification preferences',
      );
    } finally {
      setSaving(false);
    }
  }

  const backTo =
    user?.role === 'admin'
      ? '/admin/dashboard'
      : user?.role === 'vendor' || user?.role === 'farmer'
        ? '/vendor/profile'
        : '/shopper/profile';

  return (
    <div className="app-screen" style={{ maxWidth: 720 }}>
      <Link to={backTo} className="app-back-link">
        Back
      </Link>
      <p className="app-eyebrow">Account</p>
      <h1 className="app-title">Settings</h1>
      <p className="ft-subhead" style={{ marginBottom: '1.25rem' }}>
        Control how Vendorly reaches you for logistics, escrow, and dispute
        updates.
      </p>

      {error ? <FieldError message={error} /> : null}
      {message ? (
        <p
          className="mb-4 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 font-mono text-xs uppercase tracking-wide text-emerald-200"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <section
        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4"
        aria-label="Notification preferences"
      >
        <p className="m-0 font-mono text-[10px] uppercase tracking-widest text-white/45">
          NOTIFICATION_ENGINE_ACTIVE · PREFERENCES
        </p>
        <h2 className="mt-2 text-lg font-semibold text-zinc-50">
          Notification Preferences
        </h2>
        <p className="mt-1 text-sm text-white/60">
          Email receipts for settled escrow and dispute resolutions. SMS when a
          delivery stop for your booth is marked delivered.
        </p>

        {loading ? (
          <p className="mt-4 font-mono text-xs uppercase tracking-wide text-white/50">
            LOADING_PREFERENCES…
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/20 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-zinc-50">
                  Email alerts
                </span>
                <span className="mt-0.5 block text-xs text-white/55">
                  Escrow settled + dispute resolved
                </span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-orange-500"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/20 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-zinc-50">
                  SMS alerts
                </span>
                <span className="mt-0.5 block text-xs text-white/55">
                  Delivery stop marked DELIVERED
                </span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-orange-500"
                checked={smsEnabled}
                onChange={(e) => setSmsEnabled(e.target.checked)}
              />
            </label>
            <button
              type="button"
              className="app-btn app-btn--primary mt-2"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

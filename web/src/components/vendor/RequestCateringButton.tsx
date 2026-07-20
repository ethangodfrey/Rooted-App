import { useState } from 'react';

import { FieldError } from '@/components/ui/FieldError';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import { submitCateringInquiry } from '@/lib/vendor-catering';
import '@/components/vendor/catering-settings.css';

type RequestCateringButtonProps = {
  vendorId: string;
  vendorName?: string | null;
};

export function RequestCateringButton({
  vendorId,
  vendorName,
}: RequestCateringButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!user?.id) {
      setError('Sign in to request catering.');
      return;
    }
    if (!message.trim()) {
      setError('Message is required.');
      return;
    }
    if (!isApiConfigured) {
      setError('API is not configured.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await submitCateringInquiry({
        vendorId,
        message: message.trim(),
        guestCount: guestCount ? Number(guestCount) : null,
        eventDate: eventDate || null,
      });
      setDone(true);
      console.log(`VENDOR_SERVICES_UPDATED ACTION=INQUIRY VENDOR=${vendorId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send inquiry.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="catering-request-btn"
        onClick={() => {
          setOpen(true);
          setDone(false);
          setError(null);
        }}
      >
        Request Catering
      </button>

      {open ? (
        <div
          className="catering-inquiry-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="catering-inquiry-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Request catering"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Request catering{vendorName ? ` · ${vendorName}` : ''}</h2>
            {done ? (
              <p className="catering-saved">Inquiry sent</p>
            ) : (
              <>
                <div className="app-input-group">
                  <label>Message</label>
                  <textarea
                    className="app-textarea"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Event details, menu preferences, location…"
                  />
                </div>
                <div className="catering-capacity-row">
                  <div className="app-input-group">
                    <label>Guest count</label>
                    <input
                      className="app-input"
                      type="number"
                      min={1}
                      value={guestCount}
                      onChange={(e) => setGuestCount(e.target.value)}
                    />
                  </div>
                  <div className="app-input-group">
                    <label>Event date</label>
                    <input
                      className="app-input"
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </div>
                </div>
                {error ? <FieldError message={error} /> : null}
                <button
                  type="button"
                  className="catering-request-btn"
                  disabled={saving}
                  onClick={() => void handleSubmit()}
                >
                  {saving ? 'Sending…' : 'Send inquiry'}
                </button>
              </>
            )}
            <button
              type="button"
              className="app-back-link"
              style={{ marginTop: '0.75rem', display: 'inline-block' }}
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

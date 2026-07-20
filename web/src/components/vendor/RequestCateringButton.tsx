import { useEffect, useMemo, useState } from 'react';

import { FieldError } from '@/components/ui/FieldError';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import {
  checkVendorAvailability,
  fetchVendorAvailabilityBlocks,
} from '@/lib/vendor-availability';
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
  const [doneNote, setDoneNote] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [dateWarning, setDateWarning] = useState<string | null>(null);

  const range = useMemo(() => {
    const from = new Date().toISOString().slice(0, 10);
    const toDate = new Date();
    toDate.setUTCMonth(toDate.getUTCMonth() + 4);
    const to = toDate.toISOString().slice(0, 10);
    return { from, to };
  }, []);

  useEffect(() => {
    if (!open || !isApiConfigured) return;
    let active = true;
    void (async () => {
      try {
        const res = await fetchVendorAvailabilityBlocks(
          vendorId,
          range.from,
          range.to,
        );
        if (!active) return;
        setBlockedDates(new Set((res.ITEMS ?? []).map((b) => b.blockedDate)));
        console.log(
          `AVAILABILITY_SYNC_ACTIVE VENDOR=${vendorId} COUNT=${res.COUNT ?? 0}`,
        );
      } catch {
        if (active) setBlockedDates(new Set());
      }
    })();
    return () => {
      active = false;
    };
  }, [open, vendorId, range.from, range.to]);

  useEffect(() => {
    if (!eventDate) {
      setDateWarning(null);
      return;
    }
    if (blockedDates.has(eventDate)) {
      setDateWarning('Conflict Detected — this date is blocked on the vendor calendar.');
      return;
    }
    if (!isApiConfigured) {
      setDateWarning(null);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const check = await checkVendorAvailability(vendorId, eventDate);
        if (!active) return;
        setDateWarning(
          check.BLOCKED
            ? check.CONFLICT_WARNING ?? 'Conflict Detected'
            : null,
        );
      } catch {
        if (active) setDateWarning(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [eventDate, blockedDates, vendorId]);

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
      const result = await submitCateringInquiry({
        vendorId,
        message: message.trim(),
        guestCount: guestCount ? Number(guestCount) : null,
        eventDate: eventDate || null,
      });
      setDone(true);
      setDoneNote(
        result.CONFLICT_DETECTED
          ? result.CONFLICT_WARNING ??
              'Conflict Detected — inquiry flagged PENDING_REVIEW for the vendor.'
          : null,
      );
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
          setDoneNote(null);
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
              <>
                <p className="catering-saved">Inquiry sent</p>
                {doneNote ? (
                  <p className="font-mono text-xs uppercase tracking-wide text-rose-300">
                    {doneNote}
                  </p>
                ) : null}
              </>
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
                {dateWarning ? (
                  <p
                    className="font-mono text-xs uppercase tracking-wide text-rose-300"
                    role="status"
                  >
                    {dateWarning}
                  </p>
                ) : null}
                {blockedDates.size > 0 ? (
                  <p className="text-xs text-white/55">
                    Vendor has {blockedDates.size} blocked date
                    {blockedDates.size === 1 ? '' : 's'} in the next months.
                    Selecting a blocked date flags the inquiry for vendor review.
                  </p>
                ) : null}
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

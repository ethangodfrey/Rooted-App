import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { FieldError } from '@/components/ui/FieldError';
import {
  VendorHero,
  VendorPrimaryButton,
  VendorScreen,
  VendorSection,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { isApiConfigured } from '@/lib/api';
import {
  fetchVendorAvailabilityBlocks,
  setVendorAvailabilityBlock,
  type AvailabilityBlock,
} from '@/lib/vendor-availability';
import {
  fetchVendorCateringInquiries,
  type CateringInquiryItem,
} from '@/lib/vendor-catering';
import '@/components/ui/ui.css';

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function VendorAvailabilityPage() {
  const { vendor } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [monthAnchor, setMonthAnchor] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [inquiries, setInquiries] = useState<CateringInquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('SCHEDULING_ENGINE_INITIALIZED SURFACE=VENDOR_CALENDAR');
  }, []);

  const monthEnd = useMemo(() => {
    const d = new Date(`${monthAnchor}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0);
    return d.toISOString().slice(0, 10);
  }, [monthAnchor]);

  const daysInMonth = useMemo(() => {
    const days: string[] = [];
    let cursor = monthAnchor;
    while (cursor <= monthEnd) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [monthAnchor, monthEnd]);

  const load = useCallback(async () => {
    if (!vendor?.id) {
      setLoading(false);
      return;
    }
    if (!isApiConfigured) {
      setError('Backend API is not configured. Set VITE_API_URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [blockRes, inquiryRes] = await Promise.all([
        fetchVendorAvailabilityBlocks(vendor.id, monthAnchor, monthEnd),
        fetchVendorCateringInquiries(vendor.id),
      ]);
      setBlocks(blockRes.ITEMS ?? []);
      setInquiries(inquiryRes.ITEMS ?? []);
      console.log(
        `AVAILABILITY_SYNC_ACTIVE VENDOR=${vendor.id} COUNT=${blockRes.COUNT ?? 0}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load availability');
    } finally {
      setLoading(false);
    }
  }, [vendor?.id, monthAnchor, monthEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const reasonsForSelected = useMemo(() => {
    return new Set(
      blocks
        .filter((b) => b.blockedDate === selectedDate)
        .map((b) => b.reason),
    );
  }, [blocks, selectedDate]);

  async function toggleReason(reason: 'CATERING' | 'MARKET') {
    if (!vendor?.id) return;
    const blocked = !reasonsForSelected.has(reason);
    setSaving(true);
    setError(null);
    try {
      await setVendorAvailabilityBlock({
        vendorId: vendor.id,
        date: selectedDate,
        reason,
        blocked,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update block');
    } finally {
      setSaving(false);
    }
  }

  function shiftMonth(delta: number) {
    const d = new Date(`${monthAnchor}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + delta);
    const next = d.toISOString().slice(0, 10);
    setMonthAnchor(startOfMonth(next));
    setSelectedDate(startOfMonth(next));
  }

  const conflictInquiries = inquiries.filter(
    (i) => i.conflictDetected || i.status === 'PENDING_REVIEW',
  );

  return (
    <VendorScreen>
      <VendorHero
        eyebrow="Phase 2 scheduling"
        title="Availability Calendar"
        subtitle="Block out dates for catering jobs or market days. Conflicts auto-flag new catering inquiries as PENDING_REVIEW."
        pill="AVAILABILITY_SYNC_ACTIVE"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link to="/vendor/catering" className="app-btn app-btn--secondary app-btn--small">
          Catering settings
        </Link>
      </div>

      {error ? <FieldError message={error} /> : null}

      <VendorSection title="Calendar">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            className="app-btn app-btn--secondary app-btn--small"
            onClick={() => shiftMonth(-1)}
          >
            Prev
          </button>
          <p className="m-0 font-mono text-xs uppercase tracking-widest text-orange-300">
            {monthAnchor.slice(0, 7)}
          </p>
          <button
            type="button"
            className="app-btn app-btn--secondary app-btn--small"
            onClick={() => shiftMonth(1)}
          >
            Next
          </button>
        </div>

        {loading ? (
          <p className="app-subtitle">Loading calendar…</p>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {daysInMonth.map((day) => {
              const dayReasons = blocks
                .filter((b) => b.blockedDate === day)
                .map((b) => b.reason);
              const isSelected = day === selectedDate;
              const isBlocked = dayReasons.length > 0;
              return (
                <button
                  key={day}
                  type="button"
                  className="rounded-lg border px-1 py-2 text-center font-mono text-[10px] uppercase"
                  style={{
                    borderColor: isSelected
                      ? 'rgba(249,115,22,0.7)'
                      : 'rgba(255,255,255,0.1)',
                    background: isBlocked
                      ? 'rgba(244,63,94,0.18)'
                      : isSelected
                        ? 'rgba(249,115,22,0.15)'
                        : 'rgba(255,255,255,0.03)',
                    color: '#fafafa',
                  }}
                  onClick={() => setSelectedDate(day)}
                >
                  <div>{day.slice(8)}</div>
                  {dayReasons.includes('CATERING') ? <div>C</div> : null}
                  {dayReasons.includes('MARKET') ? <div>M</div> : null}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="m-0 font-mono text-xs uppercase tracking-wide text-orange-300">
            Selected {selectedDate}
          </p>
          <p className="mt-2 text-sm text-white/70">
            Toggle block-out reasons for this date. Changes sync immediately to the public
            Request Catering modal.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <VendorPrimaryButton
              type="button"
              disabled={saving}
              onClick={() => void toggleReason('CATERING')}
            >
              {reasonsForSelected.has('CATERING')
                ? 'Clear catering block'
                : 'Block for catering'}
            </VendorPrimaryButton>
            <VendorPrimaryButton
              type="button"
              disabled={saving}
              className="!bg-transparent"
              onClick={() => void toggleReason('MARKET')}
            >
              {reasonsForSelected.has('MARKET')
                ? 'Clear market block'
                : 'Block for market'}
            </VendorPrimaryButton>
          </div>
        </div>
      </VendorSection>

      <VendorSection title="Conflict Detected inquiries">
        {conflictInquiries.length === 0 ? (
          <p className="app-subtitle">
            No PENDING_REVIEW conflicts. Inquiries that land on blocked dates appear here.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {conflictInquiries.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-3"
              >
                <p className="m-0 font-mono text-[11px] font-bold uppercase tracking-widest text-rose-300">
                  {row.conflictWarning ?? 'Conflict Detected'} · {row.status}
                </p>
                <p className="m-0 mt-1 text-sm text-zinc-50">
                  {row.eventDate ? `Event ${row.eventDate} · ` : ''}
                  {row.message.slice(0, 140)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </VendorSection>
    </VendorScreen>
  );
}

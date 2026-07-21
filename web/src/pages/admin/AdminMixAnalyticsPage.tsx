import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import {
  buildMixRecommendations,
  buildMixSlices,
  MIX_BUCKET_COLORS,
  neededBucketsFromRecommendations,
  pickInviteCandidates,
  type InviteCandidate,
  type MixRecommendation,
  type MixSlice,
} from '@/lib/mix-analytics';
import { formatEventDisplayDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import '@/components/ui/ui.css';

interface FocusEvent {
  id: string;
  name: string;
  start_datetime: string;
  end_datetime?: string | null;
  timezone?: string | null;
  hours_summary?: string | null;
  sync_metadata?: Record<string, unknown>;
  state?: string | null;
  city?: string | null;
}

interface AttendingVendor {
  id: string;
  business_name: string | null;
  category: string | null;
  product_summary: string | null;
}

const OUTLINE_BTN =
  'inline-flex shrink-0 items-center justify-center rounded-xl border border-orange-500/45 bg-transparent px-4 py-3 text-sm font-semibold tracking-wide text-orange-400 transition-all duration-200 hover:border-orange-400 hover:bg-orange-500/15 hover:text-orange-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

function MixTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: MixSlice }>;
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0]?.payload;
  if (!slice) return null;
  return (
    <div className="rounded-xl border border-orange-500/30 bg-[#0b1228]/95 px-3 py-2 text-zinc-50 shadow-none backdrop-blur-md">
      <p className="m-0 text-[11px] font-bold uppercase tracking-widest text-orange-400">
        {slice.bucket}
      </p>
      <p className="m-0 mt-1 font-mono text-sm font-semibold tabular-nums">
        {slice.count} vendor{slice.count === 1 ? '' : 's'}
      </p>
    </div>
  );
}

export function AdminMixAnalyticsPage() {
  const [events, setEvents] = useState<FocusEvent[]>([]);
  const [eventId, setEventId] = useState('');
  const [attending, setAttending] = useState<AttendingVendor[]>([]);
  const [candidates, setCandidates] = useState<InviteCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(() => new Set());
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const focusEvent = useMemo(
    () => events.find((ev) => ev.id === eventId) ?? events[0] ?? null,
    [events, eventId],
  );

  const slices = useMemo(() => buildMixSlices(attending), [attending]);
  const recommendations: MixRecommendation[] = useMemo(
    () => buildMixRecommendations(slices, attending.length, focusEvent?.name),
    [slices, attending.length, focusEvent?.name],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadEvents() {
      const nowIso = new Date().toISOString();
      const { data: eventRows, error: eventError } = await supabase
        .from('events')
        .select(
          'id, name, start_datetime, end_datetime, timezone, hours_summary, sync_metadata, state, city',
        )
        .gte('end_datetime', nowIso)
        .order('start_datetime', { ascending: true })
        .limit(24);

      if (cancelled) return;
      if (eventError) {
        setError(eventError.message);
        setLoading(false);
        return;
      }
      const upcoming = (eventRows ?? []) as FocusEvent[];
      setEvents(upcoming);
      setEventId((prev) => (prev && upcoming.some((e) => e.id === prev) ? prev : upcoming[0]?.id ?? ''));
      if (upcoming.length === 0) setLoading(false);
    }
    void loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRoster() {
      if (!eventId) {
        setAttending([]);
        setCandidates([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [rosterRes, approvedRes] = await Promise.all([
        supabase
          .from('vendor_events')
          .select('vendor:vendors(id, business_name, category, product_summary, approval_status)')
          .eq('event_id', eventId)
          .eq('participation_status', 'approved'),
        supabase
          .from('vendors')
          .select('id, business_name, category, product_summary, sell_city, sell_state')
          .eq('approval_status', 'approved')
          .order('business_name', { ascending: true })
          .limit(200),
      ]);

      if (cancelled) return;

      if (rosterRes.error) {
        setError(rosterRes.error.message);
        setLoading(false);
        return;
      }

      const roster: AttendingVendor[] = ((rosterRes.data ?? []) as unknown as Array<{
        vendor: (AttendingVendor & { approval_status?: string }) | null;
      }>)
        .map((row) => row.vendor)
        .filter((v): v is AttendingVendor & { approval_status?: string } => Boolean(v))
        .filter((v) => v.approval_status === 'approved')
        .map((vendor) => ({
          id: vendor.id,
          business_name: vendor.business_name,
          category: vendor.category,
          product_summary: vendor.product_summary,
        }));

      setAttending(roster);

      const attendingIds = new Set(roster.map((v) => v.id));
      const mixSlices = buildMixSlices(roster);
      const eventName = events.find((e) => e.id === eventId)?.name;
      const recs = buildMixRecommendations(mixSlices, roster.length, eventName);
      const needed = neededBucketsFromRecommendations(recs);

      const approved = (approvedRes.data ?? []) as Array<{
        id: string;
        business_name: string | null;
        category: string | null;
        product_summary: string | null;
        sell_city: string | null;
        sell_state: string | null;
      }>;

      setCandidates(pickInviteCandidates(approved, attendingIds, needed));
      setLoading(false);
    }

    void loadRoster();
    return () => {
      cancelled = true;
    };
  }, [eventId, events]);

  async function sendInvite(candidate: InviteCandidate) {
    if (!focusEvent) return;
    setInvitingId(candidate.id);
    setInviteMessage(null);
    setError(null);

    const { error: upsertError } = await supabase.from('vendor_events').upsert(
      {
        vendor_id: candidate.id,
        event_id: focusEvent.id,
        participation_status: 'requested',
        setup_notes: `Admin mix invite · seeking ${candidate.bucket} balance`,
      },
      { onConflict: 'vendor_id,event_id' },
    );

    setInvitingId(null);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setInvitedIds((prev) => new Set(prev).add(candidate.id));
    setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
    setInviteMessage(`Invite sent to ${candidate.businessName}`);
  }

  const chartData = slices.length > 0 ? slices : [{ bucket: 'Other' as const, count: 1, fill: '#334155' }];
  const total = attending.length;

  return (
    <div className="mix-analytics">
      <header className="mix-analytics__header">
        <p className="mix-analytics__kicker">Admin · Matchmaking</p>
        <h1 className="mix-analytics__title">Mix analytics</h1>
        <p className="mix-analytics__sub">
          Balance market catalogs so shoppers see variety — not six cookie booths in a row.
        </p>

        {events.length > 0 ? (
          <label className="mix-analytics__event">
            <span>Focus market</span>
            <select
              value={focusEvent?.id ?? ''}
              onChange={(e) => setEventId(e.target.value)}
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} · {formatEventDisplayDate(ev)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      {error ? <p className="app-error mb-4">{error}</p> : null}
      {inviteMessage ? (
        <p className="mb-4 text-sm font-semibold text-orange-400" role="status">
          {inviteMessage}
        </p>
      ) : null}

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : (
        <>
          <div className="mix-bento">
            <section className="mix-bento__chart" aria-label="Category distribution">
              <p className="mix-analytics__kicker">Category mix</p>
              <h2 className="mix-bento__heading">
                {focusEvent?.name ?? 'Upcoming market'}
              </h2>
              <p className="mix-analytics__sub" style={{ marginTop: '0.35rem' }}>
                {total} approved booth{total === 1 ? '' : 's'} on roster
              </p>

              <div className="mix-bento__chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="count"
                      nameKey="bucket"
                      innerRadius="58%"
                      outerRadius="82%"
                      paddingAngle={2}
                      stroke="none"
                    >
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.bucket}
                          fill={attending.length === 0 ? '#334155' : entry.fill}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<MixTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mix-bento__chart-center" aria-hidden>
                  <span className="mix-bento__chart-total">{total}</span>
                  <span className="mix-bento__chart-label">Booths</span>
                </div>
              </div>

              <ul className="mix-legend">
                {slices.map((slice) => (
                  <li key={slice.bucket}>
                    <span
                      className="mix-legend__swatch"
                      style={{ background: MIX_BUCKET_COLORS[slice.bucket] }}
                    />
                    <span className="mix-legend__name">{slice.bucket}</span>
                    <span className="mix-legend__count">{slice.count}</span>
                  </li>
                ))}
                {slices.length === 0 ? (
                  <li className="mix-legend__empty">No category data for this market yet.</li>
                ) : null}
              </ul>
            </section>

            <aside className="mix-bento__feed" aria-label="Mix recommendations">
              <p className="mix-analytics__kicker">Recommendations</p>
              <h2 className="mix-bento__heading">Auto alerts</h2>
              <ul className="mix-feed">
                {recommendations.map((rec) => (
                  <li
                    key={rec.id}
                    className={`mix-feed__item mix-feed__item--${rec.severity}`}
                  >
                    <p className="mix-feed__title">{rec.title}</p>
                    <p className="mix-feed__body">{rec.body}</p>
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          <section className="mix-invite" aria-labelledby="auto-invite-heading">
            <p className="mix-analytics__kicker">Auto-invite</p>
            <h2 id="auto-invite-heading" className="mix-bento__heading">
              Off-duty vendors to balance the mix
            </h2>
            <p className="mix-analytics__sub" style={{ marginTop: '0.35rem', marginBottom: '1rem' }}>
              Local approved vendors not yet on this market who match under-served categories.
            </p>

            {!focusEvent ? (
              <p className="mix-invite__empty">No upcoming markets to invite into.</p>
            ) : candidates.length === 0 ? (
              <p className="mix-invite__empty">
                No off-duty matches right now — every fitting vendor is already on the roster.
              </p>
            ) : (
              <ul className="mix-invite__list" role="list">
                {candidates.map((candidate) => {
                  const invited = invitedIds.has(candidate.id);
                  const place = [candidate.city, candidate.state].filter(Boolean).join(', ');
                  return (
                    <li key={candidate.id} className="mix-invite__row">
                      <div className="mix-invite__meta">
                        <p className="mix-invite__name">{candidate.businessName}</p>
                        <p className="mix-invite__detail">
                          {candidate.bucket}
                          {candidate.category ? ` · ${candidate.category}` : ''}
                          {place ? ` · ${place}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={OUTLINE_BTN}
                        disabled={invited || invitingId === candidate.id || !focusEvent}
                        onClick={() => void sendInvite(candidate)}
                      >
                        {invited
                          ? 'Invite sent'
                          : invitingId === candidate.id
                            ? 'Sending…'
                            : 'Send Instant Invite'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

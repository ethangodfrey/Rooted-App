'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import {
  MIX_BUCKET_COLORS,
  type InviteCandidate,
  type MixRecommendation,
  type MixSlice,
} from '@/lib/mix-analytics';

export interface MixAnalyticsDashboardProps {
  accessToken?: string | null;
  apiBaseUrl?: string;
}

interface MixApiResponse {
  events: Array<{ id: string; name: string; start_datetime: string }>;
  eventId: string | null;
  slices: MixSlice[];
  recommendations: MixRecommendation[];
  candidates: InviteCandidate[];
  attending?: unknown[];
  error?: string;
}

const OUTLINE_BTN =
  'inline-flex shrink-0 items-center justify-center rounded-xl border border-orange-500/45 bg-transparent px-4 py-3 text-sm font-semibold tracking-wide text-orange-400 transition-all duration-200 hover:border-orange-400 hover:bg-orange-500/15 hover:text-orange-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

function MixTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: MixSlice }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const slice = payload[0].payload;
  return (
    <div className="rounded-xl border border-orange-500/30 bg-[#0b1228]/95 px-3 py-2 text-zinc-50">
      <p className="m-0 text-[11px] font-bold uppercase tracking-widest text-orange-400">
        {slice.bucket}
      </p>
      <p className="m-0 mt-1 font-mono text-sm font-semibold tabular-nums">
        {slice.count} vendor{slice.count === 1 ? '' : 's'}
      </p>
    </div>
  );
}

export function MixAnalyticsDashboard({
  accessToken,
  apiBaseUrl = '',
}: MixAnalyticsDashboardProps) {
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState<MixApiResponse['events']>([]);
  const [slices, setSlices] = useState<MixSlice[]>([]);
  const [recommendations, setRecommendations] = useState<MixRecommendation[]>([]);
  const [candidates, setCandidates] = useState<InviteCandidate[]>([]);
  const [attendingCount, setAttendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(() => new Set());
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const authHeaders = useCallback((): HeadersInit => {
    const headers: HeadersInit = { Accept: 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return headers;
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const qs = eventId ? `?eventId=${encodeURIComponent(eventId)}` : '';
        const res = await fetch(`${apiBaseUrl}/api/admin/mix-analytics${qs}`, {
          headers: authHeaders(),
        });
        const body = (await res.json().catch(() => null)) as MixApiResponse | null;
        if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
        if (cancelled) return;
        setEvents(body?.events ?? []);
        setSlices(body?.slices ?? []);
        setRecommendations(body?.recommendations ?? []);
        setCandidates(body?.candidates ?? []);
        setAttendingCount(Array.isArray(body?.attending) ? body.attending.length : 0);
        if (!eventId && body?.eventId) setEventId(body.eventId);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load mix analytics');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, authHeaders, eventId]);

  async function sendInvite(candidate: InviteCandidate) {
    if (!eventId) return;
    setInvitingId(candidate.id);
    setInviteMessage(null);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/mix-analytics`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          vendorId: candidate.id,
          bucket: candidate.bucket,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error || `Invite failed (${res.status})`);
      setInvitedIds((prev) => new Set(prev).add(candidate.id));
      setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
      setInviteMessage(`Invite sent to ${candidate.businessName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send invite');
    } finally {
      setInvitingId(null);
    }
  }

  const focusName = useMemo(
    () => events.find((e) => e.id === eventId)?.name ?? 'Upcoming market',
    [events, eventId],
  );

  const chartData =
    slices.length > 0 ? slices : [{ bucket: 'Other' as const, count: 1, fill: '#334155' }];

  if (loading) {
    return (
      <section className="mx-auto min-h-dvh max-w-5xl bg-[#0B1228] px-4 py-10" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-8 grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="h-80 animate-pulse rounded-xl bg-white/10" />
          <div className="h-80 animate-pulse rounded-xl bg-white/10" />
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-dvh max-w-5xl bg-[#0B1228] px-4 py-10 font-sans text-zinc-50">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-400">
        Admin · Matchmaking
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl">Mix analytics</h1>
      <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-white/70">
        Balance market catalogs so shoppers see variety — not six cookie booths in a row.
      </p>

      {events.length > 0 ? (
        <label className="mt-5 flex max-w-md flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-orange-400">
            Focus market
          </span>
          <select
            className="rounded-xl border border-orange-500/35 bg-[#121a36] px-4 py-3.5 text-sm font-semibold text-zinc-50 outline-none"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      {inviteMessage ? (
        <p className="mt-4 text-sm font-semibold text-orange-400" role="status">
          {inviteMessage}
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 md:grid-cols-[2fr_1fr]">
        <article className="rounded-2xl border border-orange-500/30 bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgba(249,115,22,0.22),transparent_55%),#121a36] px-5 py-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-400">
            Category mix
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">{focusName}</h2>
          <p className="mt-1 text-sm font-medium text-white/65">
            {attendingCount} approved booth{attendingCount === 1 ? '' : 's'} on roster
          </p>
          <div className="relative mt-3 h-72 w-full sm:h-80">
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
                      fill={attendingCount === 0 ? '#334155' : entry.fill}
                    />
                  ))}
                </Pie>
                <Tooltip content={<MixTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold tabular-nums">{attendingCount}</span>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/55">
                Booths
              </span>
            </div>
          </div>
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {slices.map((slice) => (
              <li key={slice.bucket} className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: MIX_BUCKET_COLORS[slice.bucket] }}
                />
                <span className="min-w-0 flex-1 truncate text-white/85">{slice.bucket}</span>
                <span className="font-extrabold tabular-nums text-orange-400">{slice.count}</span>
              </li>
            ))}
          </ul>
        </article>

        <aside className="rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_70%_60%_at_0%_0%,rgba(251,191,36,0.12),transparent_50%),#0b1228] px-5 py-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-400">
            Recommendations
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">Auto alerts</h2>
          <ul className="mt-4 flex list-none flex-col gap-2.5 p-0">
            {recommendations.map((rec) => (
              <li
                key={rec.id}
                className={`rounded-xl border px-4 py-3 ${
                  rec.severity === 'warn'
                    ? 'border-orange-500/40 bg-orange-500/10'
                    : rec.severity === 'ok'
                      ? 'border-emerald-500/35 bg-emerald-500/10'
                      : 'border-white/10 bg-white/[0.04]'
                }`}
              >
                <p className="m-0 text-sm font-extrabold tracking-tight">{rec.title}</p>
                <p className="m-0 mt-1 text-xs font-medium leading-relaxed text-white/70">
                  {rec.body}
                </p>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="mt-8">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-400">
          Auto-invite
        </p>
        <h2 className="mt-1 text-xl font-extrabold tracking-tight">
          Off-duty vendors to balance the mix
        </h2>
        <p className="mt-2 text-sm font-medium text-white/65">
          Local approved vendors not yet on this market who match under-served categories.
        </p>

        {candidates.length === 0 ? (
          <p className="mt-6 text-sm font-medium text-white/55">
            No off-duty matches right now — every fitting vendor is already on the roster.
          </p>
        ) : (
          <ul className="mt-4 list-none p-0">
            {candidates.map((candidate) => {
              const invited = invitedIds.has(candidate.id);
              const place = [candidate.city, candidate.state].filter(Boolean).join(', ');
              return (
                <li
                  key={candidate.id}
                  className="flex flex-col items-stretch justify-between gap-3 border-b border-white/10 py-4 last:border-b-0 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="m-0 truncate text-base font-bold tracking-tight">
                      {candidate.businessName}
                    </p>
                    <p className="m-0 mt-1 truncate text-sm font-medium text-white/60">
                      {candidate.bucket}
                      {candidate.category ? ` · ${candidate.category}` : ''}
                      {place ? ` · ${place}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`${OUTLINE_BTN} w-full sm:w-auto`}
                    disabled={invited || invitingId === candidate.id || !eventId}
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
    </section>
  );
}

export default MixAnalyticsDashboard;

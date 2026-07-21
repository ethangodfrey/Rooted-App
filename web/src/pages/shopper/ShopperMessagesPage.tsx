import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { RealtimeChatThread } from '@/components/messaging/RealtimeChatThread';
import '@/components/messaging/messaging.css';
import { useAuth } from '@/hooks/use-auth';
import { useRealtimeChatThread } from '@/hooks/use-chat-thread';
import { useCustomerMessageInbox } from '@/hooks/use-message-inbox';
import {
  MARKET_DAY_QUICK_REPLIES,
  ensureVendorThread,
  formatThreadTime,
  previewMessageBody,
  type InboxThread,
} from '@/lib/messaging';
import { supabase } from '@/lib/supabase';

interface StarterVendor {
  vendorId: string;
  orderId: string;
  name: string;
  logoUrl: string | null;
  pickupCode: string | null;
}

function groupThreadsByVendor(threads: InboxThread[]): Array<{
  vendorId: string;
  vendorName: string;
  logoUrl: string | null;
  threads: InboxThread[];
}> {
  const map = new Map<
    string,
    { vendorId: string; vendorName: string; logoUrl: string | null; threads: InboxThread[] }
  >();

  for (const thread of threads) {
    const vendorId = thread.vendor_id;
    if (!vendorId) continue;
    const existing = map.get(vendorId);
    const vendorName = thread.vendor?.business_name?.trim() || 'Vendor';
    const logoUrl = thread.vendor?.logo_url ?? null;
    if (existing) {
      existing.threads.push(thread);
    } else {
      map.set(vendorId, { vendorId, vendorName, logoUrl, threads: [thread] });
    }
  }

  return [...map.values()];
}

export function ShopperMessagesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const threadParam = searchParams.get('thread');
  const { threads, loading, error, refresh } = useCustomerMessageInbox(user?.id);
  const [selectedId, setSelectedId] = useState<string | null>(threadParam);
  const [draft, setDraft] = useState('');
  const [starters, setStarters] = useState<StarterVendor[]>([]);
  const [starting, setStarting] = useState(false);

  const {
    messages,
    loading: messagesLoading,
    sending,
    error: chatError,
    send,
  } = useRealtimeChatThread(selectedId, user?.id ?? null);

  useEffect(() => {
    if (threadParam) setSelectedId(threadParam);
  }, [threadParam]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function loadStarters() {
      const { data: shopper } = await supabase
        .from('shoppers')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (!shopper?.id || cancelled) return;

      const { data } = await supabase
        .from('orders')
        .select(
          'id, pickup_code, vendor_id, vendor:vendors(id, business_name, logo_url)',
        )
        .eq('shopper_id', shopper.id)
        .not('vendor_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(12);

      if (cancelled) return;

      const seen = new Set<string>();
      const next: StarterVendor[] = [];
      for (const row of data ?? []) {
        const vendor = Array.isArray(row.vendor) ? row.vendor[0] : row.vendor;
        const vendorId = (row.vendor_id as string | null) ?? vendor?.id;
        if (!vendorId || seen.has(vendorId)) continue;
        seen.add(vendorId);
        next.push({
          vendorId,
          orderId: row.id as string,
          name: vendor?.business_name?.trim() || 'Vendor',
          logoUrl: vendor?.logo_url ?? null,
          pickupCode: (row.pickup_code as string | null) ?? null,
        });
      }
      setStarters(next);
    }

    void loadStarters();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const groups = useMemo(() => groupThreadsByVendor(threads), [threads]);
  const selected = threads.find((t) => t.id === selectedId) ?? null;
  const selectedTitle =
    selected?.vendor?.business_name?.trim() ||
    starters.find((s) => s.vendorId === selected?.vendor_id)?.name ||
    'Conversation';

  function openThread(id: string) {
    setSelectedId(id);
    setSearchParams({ thread: id }, { replace: true });
  }

  async function startWithVendor(starter: StarterVendor) {
    if (!user?.id) return;
    setStarting(true);
    try {
      const threadId = await ensureVendorThread({
        customerUserId: user.id,
        vendorId: starter.vendorId,
        orderId: starter.orderId,
        subject: starter.pickupCode ? `Order ${starter.pickupCode}` : null,
      });
      await refresh();
      openThread(threadId);
    } finally {
      setStarting(false);
    }
  }

  async function handleQuickReply(text: string) {
    if (!selectedId) {
      setDraft(text);
      return;
    }
    setDraft('');
    try {
      await send(text);
      await refresh();
    } catch {
      setDraft(text);
    }
  }

  return (
    <div className="app-screen app-screen--narrow msg-shell">
      <header>
        <p className="m-0 text-[11px] font-bold tracking-[0.16em] text-orange-400 uppercase">
          Inbox
        </p>
        <h1 className="m-0 mt-1 text-3xl font-extrabold tracking-tight text-white">Messages</h1>
        <p className="m-0 mt-2 text-sm font-medium text-white/60">
          Chat with vendors about booth pickup, substitutions, and market-day timing.
        </p>
      </header>

      <div>
        <p className="m-0 mb-2 text-[11px] font-bold tracking-widest text-white/45 uppercase">
          Quick replies
        </p>
        <div className="msg-quick" role="group" aria-label="Market-day quick replies">
          {MARKET_DAY_QUICK_REPLIES.map((reply) => (
            <button
              key={reply}
              type="button"
              className="msg-quick__chip"
              disabled={sending}
              onClick={() => void handleQuickReply(reply)}
            >
              {reply}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="m-0 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:min-h-[28rem]">
        <section className="rounded-2xl border border-white/10 bg-[#121A36]/70 p-3">
          <p className="mb-2 px-1 text-[11px] font-bold tracking-widest text-orange-400 uppercase">
            Vendors
          </p>

          {loading ? (
            <p className="px-2 py-8 text-center text-sm text-white/55">Loading threads…</p>
          ) : null}

          {!loading && groups.length === 0 ? (
            <div className="px-2 py-4">
              <p className="m-0 text-sm font-semibold text-white">No active threads yet</p>
              <p className="mt-1 text-sm text-white/55">
                Start from a recent reservation, or message a vendor from an order.
              </p>
              {starters.length > 0 ? (
                <ul className="msg-thread-list mt-3">
                  {starters.map((starter) => (
                    <li key={starter.vendorId}>
                      <button
                        type="button"
                        className="msg-thread-btn"
                        disabled={starting}
                        onClick={() => void startWithVendor(starter)}
                      >
                        <span className="msg-avatar">
                          {starter.logoUrl ? (
                            <img src={starter.logoUrl} alt="" />
                          ) : (
                            starter.name.slice(0, 1).toUpperCase()
                          )}
                        </span>
                        <span className="msg-thread-meta">
                          <span className="msg-thread-top">
                            <p className="msg-thread-name">
                              {starter.name}
                              {starter.pickupCode ? (
                                <span className="msg-code">{starter.pickupCode}</span>
                              ) : null}
                            </p>
                          </span>
                          <p className="msg-thread-preview">Tap to message about pickup</p>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Link
                  to="/shopper/orders"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-orange-600 px-6 py-4 text-sm font-semibold tracking-wide text-white no-underline shadow-lg transition-all hover:bg-orange-500 active:scale-[0.98]"
                >
                  View reservations
                </Link>
              )}
            </div>
          ) : null}

          {groups.map((group) => (
            <div key={group.vendorId} className="mb-3">
              <div className="mb-1 flex items-center gap-2 px-2">
                <span className="msg-avatar" style={{ width: '2rem', height: '2rem' }}>
                  {group.logoUrl ? (
                    <img src={group.logoUrl} alt="" />
                  ) : (
                    group.vendorName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <p className="m-0 text-xs font-bold tracking-wide text-white/70 uppercase">
                  {group.vendorName}
                </p>
              </div>
              <ul className="msg-thread-list">
                {group.threads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      type="button"
                      className={`msg-thread-btn${selectedId === thread.id ? ' msg-thread-btn--active' : ''}`}
                      onClick={() => openThread(thread.id)}
                    >
                      <span className="msg-avatar">
                        {group.logoUrl ? (
                          <img src={group.logoUrl} alt="" />
                        ) : (
                          group.vendorName.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span className="msg-thread-meta">
                        <span className="msg-thread-top">
                          <p className="msg-thread-name">
                            {group.vendorName}
                            {thread.order?.pickup_code ? (
                              <span className="msg-code">{thread.order.pickup_code}</span>
                            ) : null}
                          </p>
                          <span className="msg-thread-time">
                            {formatThreadTime(thread.last_message_at)}
                          </span>
                        </span>
                        <p className="msg-thread-preview">
                          {previewMessageBody(thread.last_message?.body)}
                        </p>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="flex min-h-[22rem] flex-col md:min-h-0">
          {selectedId ? (
            <>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="m-0 truncate text-lg font-extrabold text-white">{selectedTitle}</h2>
                {selected?.order?.pickup_code ? (
                  <span className="msg-code">{selected.order.pickup_code}</span>
                ) : null}
              </div>
              <RealtimeChatThread
                messages={messages}
                currentUserId={user?.id ?? ''}
                loading={messagesLoading}
                sending={sending}
                error={chatError}
                draft={draft}
                onDraftChange={setDraft}
                onSend={async (body) => {
                  await send(body);
                  await refresh();
                }}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#121A36]/40 px-6 py-16 text-center">
              <div>
                <p className="m-0 text-lg font-bold text-white">Open a thread</p>
                <p className="mt-2 text-sm text-white/55">
                  Pick a vendor conversation — or use a quick reply after selecting one.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

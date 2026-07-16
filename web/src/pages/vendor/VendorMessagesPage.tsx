import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ChatThread } from '@/components/messaging/ChatThread';
import '@/components/messaging/messaging.css';
import {
  VendorEmpty,
  VendorHero,
  VendorScreen,
} from '@/components/vendor/vendor-ui';
import { useAuth } from '@/hooks/use-auth';
import { useChatThread } from '@/hooks/use-chat-thread';
import { useVendorMessageInbox } from '@/hooks/use-message-inbox';
import {
  formatThreadTime,
  previewMessageBody,
  type InboxThread,
} from '@/lib/messaging';

function ThreadList({
  threads,
  selectedId,
  onSelect,
}: {
  threads: InboxThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (threads.length === 0) {
    return <VendorEmpty message="No shopper threads yet. They’ll appear when customers message you." />;
  }

  return (
    <ul className="msg-thread-list">
      {threads.map((thread) => {
        const name = thread.customer?.name?.trim() || 'Shopper';
        const code = thread.order?.pickup_code;
        const initial = name.slice(0, 1).toUpperCase();
        return (
          <li key={thread.id}>
            <button
              type="button"
              className={`msg-thread-btn${selectedId === thread.id ? ' msg-thread-btn--active' : ''}`}
              onClick={() => onSelect(thread.id)}
            >
              <span className="msg-avatar">
                {thread.customer?.profile_photo ? (
                  <img src={thread.customer.profile_photo} alt="" />
                ) : (
                  initial
                )}
              </span>
              <span className="msg-thread-meta">
                <span className="msg-thread-top">
                  <p className="msg-thread-name">
                    {name}
                    {code ? <span className="msg-code">{code}</span> : null}
                  </p>
                  <span className="msg-thread-time">{formatThreadTime(thread.last_message_at)}</span>
                </span>
                <p className="msg-thread-preview">{previewMessageBody(thread.last_message?.body)}</p>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function VendorMessagesPage() {
  const { user, vendor } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const threadParam = searchParams.get('thread');
  const { threads, loading, error, refresh } = useVendorMessageInbox(vendor?.id);
  const [selectedId, setSelectedId] = useState<string | null>(threadParam);
  const [mobileOpen, setMobileOpen] = useState(Boolean(threadParam));

  const selected = useMemo(
    () => threads.find((thread) => thread.id === selectedId) ?? null,
    [threads, selectedId],
  );

  const {
    messages,
    loading: messagesLoading,
    sending,
    error: chatError,
    send,
  } = useChatThread(selectedId, user?.id ?? null);

  useEffect(() => {
    if (threadParam) {
      setSelectedId(threadParam);
      setMobileOpen(true);
    }
  }, [threadParam]);

  function openThread(id: string) {
    setSelectedId(id);
    setMobileOpen(true);
    setSearchParams({ thread: id }, { replace: true });
  }

  function closeMobileDrawer() {
    setMobileOpen(false);
  }

  const workspaceTitle = selected
    ? `${selected.customer?.name?.trim() || 'Shopper'}${
        selected.order?.pickup_code ? ` · ${selected.order.pickup_code}` : ''
      }`
    : 'Select a shopper';

  return (
    <VendorScreen>
      <VendorHero
        eyebrow="Support"
        title="Messages"
        subtitle="Handle booth questions fast — threads are tagged with pickup codes for market day."
        pill={`${threads.length} thread${threads.length === 1 ? '' : 's'}`}
      />

      {error ? (
        <p className="mb-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
          {error}
        </p>
      ) : null}

      <div className="msg-vendor-split">
        <aside className="msg-vendor-pane">
          <div className="msg-vendor-pane__head">
            <h2>Shopper threads</h2>
            <p className="m-0 mt-1 text-xs font-medium text-white/50">
              Pickup codes shown next to names
            </p>
          </div>
          <div className="msg-vendor-pane__body">
            {loading ? (
              <p className="px-2 py-8 text-center text-sm text-white/55">Loading inbox…</p>
            ) : (
              <ThreadList threads={threads} selectedId={selectedId} onSelect={openThread} />
            )}
          </div>
        </aside>

        <section className="msg-vendor-workspace msg-vendor-workspace--desktop">
          {selectedId && selected ? (
            <>
              <div className="msg-vendor-workspace__bar">
                <div className="min-w-0">
                  <p className="m-0 text-[11px] font-bold tracking-widest text-orange-400 uppercase">
                    Active thread
                  </p>
                  <h2 className="m-0 truncate text-xl font-extrabold text-white">{workspaceTitle}</h2>
                </div>
                {selected.order?.pickup_code ? (
                  <span className="msg-code text-sm tracking-[0.16em]">
                    {selected.order.pickup_code}
                  </span>
                ) : null}
              </div>
              <ChatThread
                messages={messages}
                currentUserId={user?.id ?? ''}
                loading={messagesLoading}
                sending={sending}
                error={chatError}
                emptyLabel="No messages yet — reply when the shopper checks in."
                onSend={async (body) => {
                  await send(body);
                  await refresh();
                }}
              />
            </>
          ) : (
            <div className="flex min-h-[22rem] flex-1 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#121A36]/40 px-6 text-center">
              <div>
                <p className="m-0 text-lg font-bold text-white">Pick a shopper thread</p>
                <p className="mt-2 text-sm text-white/55">
                  Desktop keeps the list and chat side-by-side for busy market days.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {mobileOpen && selectedId ? (
        <>
          <button
            type="button"
            className="msg-drawer-backdrop"
            aria-label="Close conversation"
            onClick={closeMobileDrawer}
          />
          <div className="msg-drawer" role="dialog" aria-modal="true" aria-label="Conversation">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-bold tracking-widest text-orange-400 uppercase">
                  Conversation
                </p>
                <h2 className="m-0 truncate text-lg font-extrabold text-white">{workspaceTitle}</h2>
              </div>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white"
                onClick={closeMobileDrawer}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <ChatThread
              messages={messages}
              currentUserId={user?.id ?? ''}
              loading={messagesLoading}
              sending={sending}
              error={chatError}
              onSend={async (body) => {
                await send(body);
                await refresh();
              }}
            />
          </div>
        </>
      ) : null}
    </VendorScreen>
  );
}

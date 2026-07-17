import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ChatThread } from '@/components/messaging/ChatThread';
import { useAuth } from '@/hooks/use-auth';
import { resolveMessageThreadForPeer } from '@/lib/network-connections';
import { supabase } from '@/lib/supabase';
import type { ProfileRole } from '@/types/profiles';
import '@/components/ui/ui.css';

type MessageRow = {
  id: string;
  body: string;
  sender_user_id: string;
  created_at: string;
};

export function VendorB2bChatPage() {
  const { peerId } = useParams<{ peerId: string }>();
  const { user, session } = useAuth();
  const profileId = user?.id ?? session?.user?.id ?? null;

  const [threadId, setThreadId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState('Network peer');
  const [peerRole, setPeerRole] = useState<ProfileRole | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!profileId || !peerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void (async () => {
      try {
        const id = await resolveMessageThreadForPeer(profileId, peerId);
        if (!active) return;
        if (!id) {
          setError('Connect with this peer before messaging.');
          setLoading(false);
          return;
        }
        setThreadId(id);

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', peerId)
          .maybeSingle();
        setPeerRole((profile?.role as ProfileRole | null) ?? null);

        const { data: vendor } = await supabase
          .from('vendors')
          .select('business_name')
          .eq('user_id', peerId)
          .maybeSingle();
        const { data: farmer } = await supabase
          .from('farmers')
          .select('farm_name')
          .eq('user_id', peerId)
          .maybeSingle();
        setPeerName(vendor?.business_name || farmer?.farm_name || 'Network peer');

        const { data: rows, error: msgError } = await supabase
          .from('messages')
          .select('id, body, sender_user_id, created_at')
          .eq('thread_id', id)
          .order('created_at', { ascending: true });
        if (msgError) throw new Error(msgError.message);
        if (!active) return;
        setMessages((rows as MessageRow[]) ?? []);
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to open chat');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [profileId, peerId]);

  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`b2b-messages:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId]);

  async function sendMessage() {
    if (!threadId || !profileId || !draft.trim()) return;
    setSending(true);
    setError(null);
    const body = draft.trim();
    setDraft('');
    const { data, error: sendError } = await supabase
      .from('messages')
      .insert({
        thread_id: threadId,
        sender_user_id: profileId,
        body,
      })
      .select('id, body, sender_user_id, created_at')
      .single();
    setSending(false);
    if (sendError) {
      setError(sendError.message);
      setDraft(body);
      return;
    }
    if (data) {
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as MessageRow]));
    }
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    );
  }

  return (
    <div className="app-screen app-screen--narrow">
      <Link
        to="/vendor/inbox"
        className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 no-underline"
      >
        Back to inbox
      </Link>

      {error ? <div className="app-empty mb-4">{error}</div> : null}

      <ChatThread title={peerName} role={peerRole} subtitle="B2B network thread" emptyLabel="No messages yet.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {messages.map((m) => {
            const mine = m.sender_user_id === profileId;
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: mine ? 'rgba(99,102,241,0.22)' : 'rgba(24,32,58,0.9)',
                  fontSize: '0.875rem',
                  color: '#e2e8f0',
                }}
              >
                {m.body}
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void sendMessage();
              }}
              placeholder="Write a message…"
              style={{
                flex: 1,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(15,23,42,0.8)',
                color: '#e2e8f0',
                padding: '0.65rem 0.85rem',
                fontSize: '0.875rem',
              }}
            />
            <button
              type="button"
              disabled={sending || !draft.trim()}
              onClick={() => void sendMessage()}
              className="rounded-md border border-orange-500/40 bg-orange-500/15 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-orange-200 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </ChatThread>
    </div>
  );
}

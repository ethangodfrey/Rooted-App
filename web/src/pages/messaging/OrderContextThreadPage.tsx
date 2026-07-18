import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ChatThread } from '@/components/messaging/ChatThread'
import { ChatOrderContextCard } from '@/components/ui/ChatOrderContextCard'
import { useAuth } from '@/hooks/use-auth'
import {
  fetchThreadMessages,
  fetchThreadMeta,
  resolveAssociatedOrderId,
  sendMessageWithOrderContext,
  type ThreadMessageRow,
} from '@/lib/chat-order-context'
import { supabase } from '@/lib/supabase'
import '@/components/ui/ui.css'

type Props = {
  viewerRole: 'vendor' | 'shopper'
  backTo: string
}

export function OrderContextThreadPage({ viewerRole, backTo }: Props) {
  const { threadId } = useParams<{ threadId: string }>()
  const { user, session } = useAuth()
  const profileId = user?.id ?? session?.user?.id ?? null

  const [subject, setSubject] = useState('PRE-ORDER CONTEXT')
  const [threadOrderId, setThreadOrderId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ThreadMessageRow[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [peerLabel, setPeerLabel] = useState('Thread')

  const contextOrderId = useMemo(
    () =>
      resolveAssociatedOrderId(
        threadOrderId,
        messages.map((m) => m.associated_order_id),
      ),
    [threadOrderId, messages],
  )

  useEffect(() => {
    let active = true
    if (!threadId || !profileId) {
      setLoading(false)
      return
    }

    setLoading(true)
    void (async () => {
      try {
        const meta = await fetchThreadMeta(threadId)
        if (!active) return
        if (!meta) {
          setError('THREAD_NOT_FOUND')
          setLoading(false)
          return
        }
        setThreadOrderId(meta.associated_order_id)
        setSubject(meta.subject || 'PRE-ORDER CONTEXT')

        if (viewerRole === 'shopper' && meta.vendor_id) {
          const { data: vendor } = await supabase
            .from('vendors')
            .select('business_name')
            .eq('id', meta.vendor_id)
            .maybeSingle()
          setPeerLabel(vendor?.business_name || 'Vendor')
        } else {
          const { data: shopper } = await supabase
            .from('users')
            .select('name, email')
            .eq('id', meta.customer_user_id)
            .maybeSingle()
          setPeerLabel(
            (shopper?.name as string | null) ||
              (shopper?.email as string | null) ||
              'Shopper',
          )
        }

        const rows = await fetchThreadMessages(threadId)
        if (!active) return
        setMessages(rows)
        setError(null)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'THREAD_LOAD_FAILED')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [threadId, profileId, viewerRole])

  useEffect(() => {
    if (!threadId) return
    const channel = supabase
      .channel(`order-context-messages:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as ThreadMessageRow
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
          if (row.associated_order_id) {
            setThreadOrderId((prev) => prev ?? row.associated_order_id)
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_threads',
          filter: `id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as { associated_order_id?: string | null; subject?: string | null }
          if (row.associated_order_id !== undefined) {
            setThreadOrderId(row.associated_order_id)
          }
          if (row.subject) setSubject(row.subject)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [threadId])

  async function sendMessage() {
    if (!threadId || !profileId || !draft.trim()) return
    setSending(true)
    setError(null)
    const body = draft.trim()
    setDraft('')
    try {
      const row = await sendMessageWithOrderContext({
        threadId,
        senderUserId: profileId,
        body,
        associatedOrderId: contextOrderId,
      })
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SEND_FAILED')
      setDraft(body)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
      </div>
    )
  }

  return (
    <div className="app-screen app-screen--narrow">
      <Link
        to={backTo}
        className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 no-underline"
      >
        Back to inbox
      </Link>

      {error ? <div className="app-empty mb-4">{error}</div> : null}

      <ChatThread
        title={peerLabel}
        subtitle={subject}
        emptyLabel="No messages yet."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {contextOrderId ? (
            <ChatOrderContextCard orderId={contextOrderId} viewerRole={viewerRole} />
          ) : (
            <div className="border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] uppercase tracking-wide text-zinc-500">
              ORDER_CONTEXT · NONE
            </div>
          )}

          {messages.map((m) => {
            const mine = m.sender_user_id === profileId
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {m.associated_order_id && m.associated_order_id !== contextOrderId ? (
                  <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                    ORDER_CONTEXT · ATTACHED
                  </div>
                ) : null}
                <div
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
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void sendMessage()
              }}
              placeholder="Write a message"
              aria-label="Message"
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
              className="rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-100 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </ChatThread>
    </div>
  )
}

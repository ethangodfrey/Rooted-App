import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { completePreorderHandoff } from '@/lib/preorders'
import {
  fetchChatOrderContext,
  fulfillmentStatusLabel,
  paymentStatusLabel,
  type ChatOrderContext,
} from '@/lib/chat-order-context'
import { supabase } from '@/lib/supabase'

type Props = {
  orderId: string
  /** When true, show vendor hand-off control. When false, shopper pickup code action. */
  viewerRole: 'vendor' | 'shopper'
  className?: string
  onOrderUpdated?: (ctx: ChatOrderContext) => void
}

const CARD_CLASS =
  'border border-zinc-800 bg-zinc-950 p-3 text-[11px] tracking-wide font-mono uppercase'

export function ChatOrderContextCard({
  orderId,
  viewerRole,
  className = '',
  onOrderUpdated,
}: Props) {
  const [ctx, setCtx] = useState<ChatOrderContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [revealCode, setRevealCode] = useState(false)
  const [handoffCode, setHandoffCode] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchChatOrderContext(orderId)
      if (!next) {
        setCtx(null)
        setError('ORDER_CONTEXT_NOT_FOUND')
        return
      }
      setCtx(next)
      onOrderUpdated?.(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ORDER_CONTEXT_LOAD_FAILED')
      setCtx(null)
    } finally {
      setLoading(false)
    }
  }, [orderId, onOrderUpdated])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`chat-order-context-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'preorder_orders',
          filter: `id=eq.${orderId}`,
        },
        () => {
          void load()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orderId, load])

  const onCompleteHandoff = async () => {
    if (!ctx || ctx.fulfillmentStatus !== 'PENDING_PICKUP') return
    const code = (handoffCode.trim() || ctx.pickupCode).toUpperCase()
    if (!code) {
      setError('ENTER_PICKUP_CODE')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await completePreorderHandoff(ctx.id, code)
      setHandoffCode('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'HANDOFF_FAILED')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !ctx) {
    return (
      <div className={`${CARD_CLASS} text-zinc-500 ${className}`.trim()}>
        <div>ORDER_CONTEXT</div>
        <div className="mt-1 text-zinc-600">LOADING</div>
      </div>
    )
  }

  if (!ctx) {
    return (
      <div className={`${CARD_CLASS} text-zinc-500 ${className}`.trim()}>
        <div>ORDER_CONTEXT</div>
        <div className="mt-1 text-red-400">{error ?? 'UNAVAILABLE'}</div>
      </div>
    )
  }

  const pending = ctx.fulfillmentStatus === 'PENDING_PICKUP'

  return (
    <div className={`${CARD_CLASS} text-zinc-100 ${className}`.trim()}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-zinc-400">ORDER_CONTEXT</span>
        <span className="text-zinc-200">{ctx.pickupCode || '—'}</span>
      </div>

      <div className="mt-2 grid gap-1 text-zinc-300 sm:grid-cols-2">
        <div>
          <span className="text-zinc-500">PAYMENT </span>
          {paymentStatusLabel(ctx.paymentStatus)}
        </div>
        <div>
          <span className="text-zinc-500">FULFILLMENT </span>
          {fulfillmentStatusLabel(ctx.fulfillmentStatus)}
        </div>
      </div>

      {error ? <p className="mt-2 text-red-400">{error}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {viewerRole === 'vendor' && pending ? (
          <>
            <input
              value={handoffCode}
              onChange={(e) => setHandoffCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              aria-label="PICKUP CODE"
              className="w-24 border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] tracking-wide text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCompleteHandoff()}
              className="border border-zinc-600 px-2 py-1 text-[11px] tracking-wide text-zinc-100 hover:border-zinc-400 disabled:opacity-50"
            >
              {busy ? '[ WORKING ]' : '[ COMPLETE HAND-OFF ]'}
            </button>
          </>
        ) : null}

        {viewerRole === 'shopper' ? (
          <>
            <button
              type="button"
              onClick={() => setRevealCode((v) => !v)}
              className="border border-zinc-600 px-2 py-1 text-[11px] tracking-wide text-zinc-100 hover:border-zinc-400"
            >
              [ VIEW PICKUP CODE ]
            </button>
            {revealCode ? (
              <span className="border border-zinc-700 px-2 py-1 text-zinc-100">
                CODE {ctx.pickupCode}
              </span>
            ) : null}
          </>
        ) : null}

        {viewerRole === 'vendor' && !pending ? (
          <Link
            to="/vendor/handoffs"
            className="border border-zinc-700 px-2 py-1 text-[11px] tracking-wide text-zinc-400 no-underline hover:text-zinc-200"
          >
            [ HANDOFFS ]
          </Link>
        ) : null}
      </div>
    </div>
  )
}

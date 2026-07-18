import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '@/hooks/use-auth'
import { listShopperInboxThreads, type InboxThreadRow } from '@/lib/chat-order-context'
import { supabase } from '@/lib/supabase'
import '@/components/ui/ui.css'

export function ShopperInboxPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [threads, setThreads] = useState<InboxThreadRow[]>([])
  const [vendorNames, setVendorNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    void (async () => {
      try {
        const rows = await listShopperInboxThreads(user.id)
        if (!active) return
        setThreads(rows)

        const vendorIds = [...new Set(rows.map((r) => r.vendor_id).filter(Boolean))] as string[]
        if (vendorIds.length > 0) {
          const { data } = await supabase
            .from('vendors')
            .select('id, business_name')
            .in('id', vendorIds)
          if (!active) return
          const map: Record<string, string> = {}
          for (const v of data ?? []) {
            map[v.id as string] = (v.business_name as string | null) || 'Vendor'
          }
          setVendorNames(map)
        }
        setError(null)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'INBOX_LOAD_FAILED')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [user?.id])

  return (
    <div className="app-screen app-screen--narrow">
      <h1 className="app-title">Inbox</h1>
      <p className="app-subtitle">Chats with vendors and market hosts.</p>

      {loading ? (
        <div className="app-loading">
          <div className="app-spinner" />
        </div>
      ) : error ? (
        <div className="app-empty">{error}</div>
      ) : threads.length === 0 ? (
        <>
          <div className="app-empty" style={{ textAlign: 'left' }}>
            <p style={{ margin: '0 0 0.75rem' }}>No conversations yet.</p>
            <p className="app-row-meta" style={{ margin: 0 }}>
              Message a vendor from a product pre-order to start a thread with ORDER_CONTEXT.
            </p>
          </div>
          <div className="mt-6">
            <Link to="/explore" className="app-btn app-btn--primary">
              Explore markets
            </Link>
          </div>
        </>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {threads.map((thread) => (
            <li key={thread.id} className="app-card" style={{ marginBottom: '0.75rem' }}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="app-row-title" style={{ margin: 0 }}>
                    {thread.vendor_id
                      ? vendorNames[thread.vendor_id] ?? 'Vendor'
                      : thread.subject || 'Thread'}
                  </p>
                  <p className="app-row-meta" style={{ margin: '0.25rem 0 0', fontFamily: 'monospace' }}>
                    {thread.associated_order_id ? 'ORDER_CONTEXT' : 'THREAD'}
                    {thread.subject ? ` · ${thread.subject}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-100"
                  onClick={() => navigate(`/inbox/thread/${thread.id}`)}
                >
                  [ OPEN ]
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

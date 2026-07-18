import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchNotificationLogs,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationLog,
} from '@/lib/notifications'
import { supabase } from '@/lib/supabase'

export type LiveNotificationAlert = {
  id: string
  title: string
  body: string
  notification_type: NotificationLog['notification_type']
}

export function useNotificationCenter(userId: string | null | undefined) {
  const [items, setItems] = useState<NotificationLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [liveAlert, setLiveAlert] = useState<LiveNotificationAlert | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchNotificationLogs(userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'NOTIFICATION_LOAD_FAILED')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notification-logs:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_logs',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationLog
          setItems((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev]))
          setLiveAlert({
            id: row.id,
            title: row.title,
            body: row.body,
            notification_type: row.notification_type,
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notification_logs',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationLog
          setItems((prev) => prev.map((n) => (n.id === row.id ? row : n)))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  useEffect(() => {
    if (!liveAlert) return
    const timer = window.setTimeout(() => setLiveAlert(null), 6000)
    return () => window.clearTimeout(timer)
  }, [liveAlert])

  const unreadCount = useMemo(
    () => items.reduce((count, item) => count + (item.is_read ? 0 : 1), 0),
    [items],
  )

  const dismissLiveAlert = useCallback(() => setLiveAlert(null), [])

  const markOneRead = useCallback(async (id: string) => {
    await markNotificationRead(id)
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
    )
  }, [])

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead()
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })))
  }, [])

  return {
    items,
    loading,
    error,
    unreadCount,
    liveAlert,
    dismissLiveAlert,
    refresh,
    markOneRead,
    markAllRead,
  }
}

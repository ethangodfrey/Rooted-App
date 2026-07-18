import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'

import { NotificationLiveBanner } from '@/components/ui/NotificationLiveBanner'
import {
  useNotificationCenter,
  type LiveNotificationAlert,
} from '@/hooks/use-notification-center'
import type { NotificationLog } from '@/lib/notifications'

type NotificationContextValue = {
  items: NotificationLog[]
  loading: boolean
  error: string | null
  unreadCount: number
  liveAlert: LiveNotificationAlert | null
  dismissLiveAlert: () => void
  markAllRead: () => Promise<void>
  markOneRead: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

type Props = {
  userId: string | null | undefined
  children: ReactNode
}

/**
 * Binds a Supabase realtime channel on `notification_logs` for the signed-in user.
 * Mount from shopper / creator (vendor) layouts so inserts stream a live banner
 * without page refresh.
 */
export function NotificationProvider({ userId, children }: Props) {
  const {
    items,
    loading,
    error,
    unreadCount,
    liveAlert,
    dismissLiveAlert,
    markAllRead,
    markOneRead,
    refresh,
  } = useNotificationCenter(userId)

  const value = useMemo<NotificationContextValue>(
    () => ({
      items,
      loading,
      error,
      unreadCount,
      liveAlert,
      dismissLiveAlert,
      markAllRead,
      markOneRead,
      refresh,
    }),
    [
      items,
      loading,
      error,
      unreadCount,
      liveAlert,
      dismissLiveAlert,
      markAllRead,
      markOneRead,
      refresh,
    ],
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationLiveBanner alert={liveAlert} onDismiss={dismissLiveAlert} />
    </NotificationContext.Provider>
  )
}

export function useNotificationContext(): NotificationContextValue | null {
  return useContext(NotificationContext)
}

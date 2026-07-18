import { NotificationDropdown } from '@/components/ui/NotificationDropdown'
import { NotificationLiveBanner } from '@/components/ui/NotificationLiveBanner'
import { useNotificationCenter } from '@/hooks/use-notification-center'

type Props = {
  userId: string
}

/** Realtime notification feed + live insert banner for shopper/vendor shells. */
export function NotificationCenter({ userId }: Props) {
  const {
    items,
    loading,
    error,
    unreadCount,
    liveAlert,
    dismissLiveAlert,
    markAllRead,
    markOneRead,
  } = useNotificationCenter(userId)

  return (
    <>
      <NotificationDropdown
        items={items}
        unreadCount={unreadCount}
        loading={loading}
        error={error}
        onMarkAllRead={markAllRead}
        onMarkOneRead={markOneRead}
      />
      <NotificationLiveBanner alert={liveAlert} onDismiss={dismissLiveAlert} />
    </>
  )
}

import { NotificationDropdown } from '@/components/ui/NotificationDropdown'
import { useNotificationContext } from '@/providers/notification-provider'

/**
 * Top-bar feed control. Requires NotificationProvider from shopper/creator layouts.
 * Falls back to null when the provider is not mounted (e.g. admin/chef shells).
 */
export function NotificationCenter() {
  const center = useNotificationContext()
  if (!center) return null

  return (
    <NotificationDropdown
      items={center.items}
      unreadCount={center.unreadCount}
      loading={center.loading}
      error={center.error}
      onMarkAllRead={center.markAllRead}
      onMarkOneRead={center.markOneRead}
    />
  )
}

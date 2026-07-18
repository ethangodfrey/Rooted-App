import type { LiveNotificationAlert } from '@/hooks/use-notification-center'

import './notification-center.css'

type Props = {
  alert: LiveNotificationAlert | null
  onDismiss: () => void
}

export function NotificationLiveBanner({ alert, onDismiss }: Props) {
  if (!alert) return null

  return (
    <div className="notification-live-banner" role="status" aria-live="polite">
      <div className="notification-live-banner__inner">
        <p className="notification-live-banner__eyebrow">NOTIFICATION</p>
        <p className="notification-live-banner__type">{alert.notification_type}</p>
        <p className="notification-live-banner__title">{alert.title}</p>
        <p className="notification-live-banner__body">{alert.body}</p>
        <button
          type="button"
          className="notification-live-banner__dismiss"
          onClick={onDismiss}
        >
          [ DISMISS ]
        </button>
      </div>
    </div>
  )
}

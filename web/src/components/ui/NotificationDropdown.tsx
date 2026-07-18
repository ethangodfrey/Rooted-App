import { useEffect, useRef, useState } from 'react'

import {
  formatNotificationTimestamp,
  type NotificationLog,
} from '@/lib/notifications'

import './notification-center.css'

type Props = {
  items: NotificationLog[]
  unreadCount: number
  loading?: boolean
  error?: string | null
  onMarkAllRead: () => Promise<void> | void
  onMarkOneRead?: (id: string) => Promise<void> | void
}

export function NotificationDropdown({
  items,
  unreadCount,
  loading = false,
  error = null,
  onMarkAllRead,
  onMarkOneRead,
}: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleMarkAll() {
    setBusy(true)
    try {
      await onMarkAllRead()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="notification-dropdown" ref={rootRef}>
      <button
        type="button"
        className="notification-dropdown__toggle"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="NOTIFICATION"
        onClick={() => setOpen((prev) => !prev)}
      >
        NOTIFICATION
        {unreadCount > 0 ? (
          <span className="notification-dropdown__badge">{unreadCount}</span>
        ) : null}
      </button>

      {open ? (
        <div className="notification-dropdown__panel" role="dialog" aria-label="NOTIFICATION">
          <div className="notification-dropdown__header">
            <p className="notification-dropdown__eyebrow">NOTIFICATION</p>
            <button
              type="button"
              className="notification-dropdown__mark-all"
              disabled={busy || unreadCount === 0}
              onClick={() => void handleMarkAll()}
            >
              {busy ? '[ WORKING ]' : '[ MARK ALL AS READ ]'}
            </button>
          </div>

          {loading ? (
            <p className="notification-dropdown__empty">LOADING</p>
          ) : error ? (
            <p className="notification-dropdown__empty notification-dropdown__empty--error">
              {error}
            </p>
          ) : items.length === 0 ? (
            <p className="notification-dropdown__empty">NO NOTIFICATIONS</p>
          ) : (
            <ul className="notification-dropdown__list">
              {items.map((item) => (
                <li key={item.id} className="notification-dropdown__item">
                  <div className="notification-dropdown__item-top">
                    <span className="notification-dropdown__type">
                      {item.notification_type}
                    </span>
                    {!item.is_read ? (
                      <span className="notification-dropdown__unread">UNREAD</span>
                    ) : null}
                  </div>
                  <p className="notification-dropdown__title">{item.title}</p>
                  <p className="notification-dropdown__body">{item.body}</p>
                  <div className="notification-dropdown__item-foot">
                    <time dateTime={item.created_at}>
                      {formatNotificationTimestamp(item.created_at)}
                    </time>
                    {!item.is_read && onMarkOneRead ? (
                      <button
                        type="button"
                        className="notification-dropdown__mark-one"
                        onClick={() => void onMarkOneRead(item.id)}
                      >
                        [ MARK AS READ ]
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

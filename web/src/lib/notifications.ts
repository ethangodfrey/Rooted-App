import { supabase } from '@/lib/supabase'

export type NotificationType =
  | 'ORDER_STATUS'
  | 'CONNECTION_REQUEST'
  | 'SYSTEM_ALERT'
  | 'CONTENT_CONTRIBUTION'

export type NotificationLog = {
  id: string
  user_id: string
  title: string
  body: string
  notification_type: NotificationType
  is_read: boolean
  created_at: string
}

export async function fetchNotificationLogs(
  userId: string,
  limit = 40,
): Promise<NotificationLog[]> {
  const { data, error } = await supabase
    .from('notification_logs')
    .select('id, user_id, title, body, notification_type, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as NotificationLog[]
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notification_logs')
    .update({ is_read: true })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data, error } = await supabase.rpc('mark_all_notifications_read')
  if (error) throw new Error(error.message)
  return typeof data === 'number' ? data : 0
}

export function formatNotificationTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'UNKNOWN TIME'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).toUpperCase()
}

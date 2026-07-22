import { api } from '@/lib/api'
import { marketPath, vendorPath } from '@/lib/market-routes'
import { supabase } from '@/lib/supabase'

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PREFS'
export type NotificationStatus = 'SENT' | 'FAILED'

export type NotificationPreferences = {
  emailEnabled: boolean
  smsEnabled: boolean
}

type NotificationPreferencesResponse = {
  EMAIL_ENABLED: boolean
  SMS_ENABLED: boolean
  PREFERENCES?: NotificationPreferences
}

export function formatNotificationEngineActiveLog(input?: {
  channel?: NotificationChannel
  eventType?: string
}): string {
  const parts = ['NOTIFICATION_ENGINE_ACTIVE']
  if (input?.channel) parts.push(`CHANNEL=${input.channel}`)
  if (input?.eventType) parts.push(`EVENT=${input.eventType}`)
  return parts.join(' ')
}

export function formatEventDispatchedLog(input?: {
  channel?: NotificationChannel
  eventType?: string
  status?: NotificationStatus
  userId?: string
}): string {
  const parts = ['EVENT_DISPATCHED']
  if (input?.channel) parts.push(`CHANNEL=${input.channel}`)
  if (input?.eventType) parts.push(`EVENT=${input.eventType}`)
  if (input?.status) parts.push(`STATUS=${input.status}`)
  if (input?.userId) parts.push(`USER=${input.userId}`)
  return parts.join(' ')
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferencesResponse> {
  return api.get<NotificationPreferencesResponse>('/api/notifications/preferences')
}

export async function updateNotificationPreferences(
  prefs: NotificationPreferences,
): Promise<NotificationPreferencesResponse> {
  return api.patch<NotificationPreferencesResponse>('/api/notifications/preferences', prefs)
}

export type NotificationType =
  | 'ORDER_STATUS'
  | 'CONNECTION_REQUEST'
  | 'SYSTEM_ALERT'
  | 'MARKET_ALERT'

export type NotificationLog = {
  id: string
  user_id: string
  title: string
  body: string
  notification_type: NotificationType
  is_read: boolean
  created_at: string
  market_id?: string | null
  deep_link?: string | null
  payload?: Record<string, unknown> | null
}

export async function fetchNotificationLogs(
  userId: string,
  limit = 40,
): Promise<NotificationLog[]> {
  const { data, error } = await supabase
    .from('notification_logs')
    .select(
      'id, user_id, title, body, notification_type, is_read, created_at, market_id, deep_link, payload',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    // Backward compatible select when phase69 columns are not applied yet.
    const fallback = await supabase
      .from('notification_logs')
      .select('id, user_id, title, body, notification_type, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (fallback.error) throw new Error(fallback.error.message)
    return (fallback.data ?? []) as NotificationLog[]
  }
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

/** Resolve deep link for notification interaction (prefers market_id payload). */
export function resolveNotificationDeepLink(item: NotificationLog): string | null {
  if (item.deep_link && item.deep_link.startsWith('/')) {
    return item.deep_link
  }
  const payloadMarket =
    item.payload && typeof item.payload.market_id === 'string'
      ? item.payload.market_id
      : null
  const marketId = item.market_id ?? payloadMarket
  if (marketId) return marketPath(marketId)

  const payloadVendor =
    item.payload && typeof item.payload.vendor_id === 'string'
      ? item.payload.vendor_id
      : null
  if (payloadVendor) return vendorPath(payloadVendor, marketId ?? undefined)

  return null
}

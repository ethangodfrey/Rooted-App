import { supabase } from '@/lib/supabase'
import type { PreorderPaymentStatus, PreorderStatus } from '@/lib/preorders'

export type ChatOrderContext = {
  id: string
  pickupCode: string
  paymentStatus: PreorderPaymentStatus
  fulfillmentStatus: PreorderStatus
  vendorProfileId: string
  shopperUserId: string
  vendorRowId: string | null
}

export function paymentStatusLabel(status: PreorderPaymentStatus): string {
  return status === 'PAID' ? 'PAID' : 'PENDING'
}

export function fulfillmentStatusLabel(status: PreorderStatus): string {
  if (status === 'PENDING_PICKUP') return 'PENDING_PICKUP'
  if (status === 'COMPLETED') return 'COMPLETED'
  return 'CANCELLED'
}

export async function fetchChatOrderContext(orderId: string): Promise<ChatOrderContext | null> {
  const { data, error } = await supabase
    .from('preorder_orders')
    .select('id, pickup_code, payment_status, status, vendor_id, shopper_id')
    .eq('id', orderId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .select('id')
    .eq('user_id', data.vendor_id)
    .maybeSingle()

  if (vendorError) throw vendorError

  return {
    id: data.id as string,
    pickupCode: String(data.pickup_code ?? ''),
    paymentStatus: data.payment_status as PreorderPaymentStatus,
    fulfillmentStatus: data.status as PreorderStatus,
    vendorProfileId: data.vendor_id as string,
    shopperUserId: data.shopper_id as string,
    vendorRowId: (vendor?.id as string | null) ?? null,
  }
}

/** Resolve sticky thread order id, else scan messages (newest first) for associated_order_id. */
export function resolveAssociatedOrderId(
  threadAssociatedOrderId: string | null | undefined,
  messageOrderIds: Array<string | null | undefined>,
): string | null {
  if (threadAssociatedOrderId) return threadAssociatedOrderId
  for (let i = messageOrderIds.length - 1; i >= 0; i -= 1) {
    const id = messageOrderIds[i]
    if (id) return id
  }
  return null
}

export async function ensurePreorderConversationThread(preorderId: string): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_preorder_conversation_thread', {
    p_preorder_id: preorderId,
  })
  if (error) throw error
  if (!data || typeof data !== 'string') {
    throw new Error('ORDER_CONTEXT_THREAD_FAILED')
  }
  return data
}

export async function sendMessageWithOrderContext(input: {
  threadId: string
  senderUserId: string
  body: string
  associatedOrderId?: string | null
}): Promise<{
  id: string
  thread_id: string
  sender_user_id: string
  body: string
  created_at: string
  associated_order_id: string | null
}> {
  const payload: Record<string, unknown> = {
    thread_id: input.threadId,
    sender_user_id: input.senderUserId,
    body: input.body.trim(),
  }
  if (input.associatedOrderId) {
    payload.associated_order_id = input.associatedOrderId
  }

  const { data, error } = await supabase
    .from('messages')
    .insert(payload)
    .select('id, thread_id, sender_user_id, body, created_at, associated_order_id')
    .single()

  if (error) throw error

  await supabase
    .from('conversation_threads')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', input.threadId)

  return data as {
    id: string
    thread_id: string
    sender_user_id: string
    body: string
    created_at: string
    associated_order_id: string | null
  }
}

export type InboxThreadRow = {
  id: string
  subject: string | null
  last_message_at: string
  associated_order_id: string | null
  vendor_id: string | null
  customer_user_id: string
  b2b_peer_user_id: string | null
}

export async function listShopperInboxThreads(userId: string): Promise<InboxThreadRow[]> {
  const { data, error } = await supabase
    .from('conversation_threads')
    .select(
      'id, subject, last_message_at, associated_order_id, vendor_id, customer_user_id, b2b_peer_user_id',
    )
    .eq('customer_user_id', userId)
    .order('last_message_at', { ascending: false })
    .limit(80)

  if (error) throw error
  return (data ?? []) as InboxThreadRow[]
}

export async function listVendorShopperThreads(vendorRowId: string): Promise<InboxThreadRow[]> {
  const { data, error } = await supabase
    .from('conversation_threads')
    .select(
      'id, subject, last_message_at, associated_order_id, vendor_id, customer_user_id, b2b_peer_user_id',
    )
    .eq('vendor_id', vendorRowId)
    .is('b2b_peer_user_id', null)
    .order('last_message_at', { ascending: false })
    .limit(80)

  if (error) throw error
  return (data ?? []) as InboxThreadRow[]
}

export type ThreadMessageRow = {
  id: string
  thread_id: string
  sender_user_id: string
  body: string
  created_at: string
  associated_order_id: string | null
}

export async function fetchThreadMessages(threadId: string): Promise<ThreadMessageRow[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, thread_id, sender_user_id, body, created_at, associated_order_id')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) throw error
  return (data ?? []) as ThreadMessageRow[]
}

export async function fetchThreadMeta(threadId: string): Promise<{
  id: string
  associated_order_id: string | null
  vendor_id: string | null
  customer_user_id: string
  subject: string | null
} | null> {
  const { data, error } = await supabase
    .from('conversation_threads')
    .select('id, associated_order_id, vendor_id, customer_user_id, subject')
    .eq('id', threadId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return data as {
    id: string
    associated_order_id: string | null
    vendor_id: string | null
    customer_user_id: string
    subject: string | null
  }
}

export async function openPreorderChatSession(input: {
  preorderId: string
  senderUserId: string
  initialBody?: string
}): Promise<string> {
  const threadId = await ensurePreorderConversationThread(input.preorderId)
  const body =
    input.initialBody?.trim() ||
    'PRE-ORDER CONTEXT ATTACHED. MESSAGE OPENED FROM PRODUCT PRE-ORDER.'
  await sendMessageWithOrderContext({
    threadId,
    senderUserId: input.senderUserId,
    body,
    associatedOrderId: input.preorderId,
  })
  return threadId
}

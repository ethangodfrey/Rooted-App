import { supabase } from '@/lib/supabase';
import type { ConversationThread, Message } from '@/types/database';

export const MARKET_DAY_QUICK_REPLIES = [
  'Running late!',
  'Which booth are you at?',
  'Can I substitute an item?',
] as const;

export interface ThreadVendor {
  id: string;
  business_name: string | null;
  logo_url: string | null;
}

export interface ThreadCustomer {
  id: string;
  name: string | null;
  profile_photo: string | null;
}

export interface ThreadOrder {
  id: string;
  pickup_code: string | null;
}

export interface InboxThread extends ConversationThread {
  vendor: ThreadVendor | null;
  customer: ThreadCustomer | null;
  order: ThreadOrder | null;
  last_message: Pick<Message, 'id' | 'body' | 'created_at' | 'sender_user_id'> | null;
}

type ThreadRow = ConversationThread & {
  vendor: ThreadVendor | ThreadVendor[] | null;
  customer: ThreadCustomer | ThreadCustomer[] | null;
  order: ThreadOrder | ThreadOrder[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeThread(row: ThreadRow): InboxThread {
  return {
    ...row,
    vendor: one(row.vendor),
    customer: one(row.customer),
    order: one(row.order),
    last_message: null,
  };
}

async function attachLastMessages(threads: InboxThread[]): Promise<InboxThread[]> {
  if (threads.length === 0) return threads;
  const ids = threads.map((t) => t.id);
  const { data, error } = await supabase
    .from('messages')
    .select('id, thread_id, body, created_at, sender_user_id')
    .in('thread_id', ids)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const latest = new Map<string, Pick<Message, 'id' | 'body' | 'created_at' | 'sender_user_id'>>();
  for (const row of data ?? []) {
    const threadId = row.thread_id as string;
    if (!latest.has(threadId)) {
      latest.set(threadId, {
        id: row.id as string,
        body: row.body as string,
        created_at: row.created_at as string,
        sender_user_id: row.sender_user_id as string,
      });
    }
  }

  return threads.map((thread) => ({
    ...thread,
    last_message: latest.get(thread.id) ?? null,
  }));
}

const THREAD_SELECT = `
  id, customer_user_id, vendor_id, chef_id, order_id, booking_id, subject, last_message_at, created_at,
  vendor:vendors(id, business_name, logo_url),
  customer:users!customer_user_id(id, name, profile_photo),
  order:orders(id, pickup_code)
`;

export async function fetchCustomerThreads(customerUserId: string): Promise<InboxThread[]> {
  const { data, error } = await supabase
    .from('conversation_threads')
    .select(THREAD_SELECT)
    .eq('customer_user_id', customerUserId)
    .not('vendor_id', 'is', null)
    .order('last_message_at', { ascending: false });

  if (error) throw new Error(error.message);
  const threads = ((data ?? []) as unknown as ThreadRow[]).map(normalizeThread);
  return attachLastMessages(threads);
}

export async function fetchVendorThreads(vendorId: string): Promise<InboxThread[]> {
  const { data, error } = await supabase
    .from('conversation_threads')
    .select(THREAD_SELECT)
    .eq('vendor_id', vendorId)
    .order('last_message_at', { ascending: false });

  if (error) throw new Error(error.message);
  const threads = ((data ?? []) as unknown as ThreadRow[]).map(normalizeThread);
  return attachLastMessages(threads);
}

export async function fetchThreadMessages(threadId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, thread_id, sender_user_id, body, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Message[];
}

export async function sendThreadMessage(input: {
  threadId: string;
  senderUserId: string;
  body: string;
}): Promise<Message> {
  const body = input.body.trim();
  if (!body) throw new Error('Message cannot be empty.');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      thread_id: input.threadId,
      sender_user_id: input.senderUserId,
      body,
    })
    .select('id, thread_id, sender_user_id, body, created_at')
    .single();

  if (error) throw new Error(error.message);
  return data as Message;
}

/** Find or create a shopper↔vendor thread, optionally tied to an order. */
export async function ensureVendorThread(input: {
  customerUserId: string;
  vendorId: string;
  orderId?: string | null;
  subject?: string | null;
}): Promise<string> {
  if (input.orderId) {
    const byOrder = await supabase
      .from('conversation_threads')
      .select('id')
      .eq('customer_user_id', input.customerUserId)
      .eq('vendor_id', input.vendorId)
      .eq('order_id', input.orderId)
      .maybeSingle();
    if (byOrder.error) throw new Error(byOrder.error.message);
    if (byOrder.data?.id) return byOrder.data.id as string;
  }

  const existing = await supabase
    .from('conversation_threads')
    .select('id')
    .eq('customer_user_id', input.customerUserId)
    .eq('vendor_id', input.vendorId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) return existing.data.id as string;

  const { data, error } = await supabase
    .from('conversation_threads')
    .insert({
      customer_user_id: input.customerUserId,
      vendor_id: input.vendorId,
      order_id: input.orderId ?? null,
      subject: input.subject ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export function subscribeToThreadMessages(
  threadId: string,
  onInsert: (message: Message) => void,
): () => void {
  const channel = supabase
    .channel(`messages:${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        const row = payload.new as Message | null;
        if (!row?.id) return;
        onInsert(row);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Inbox refresh when any visible message arrives (RLS-scoped). */
export function subscribeToInboxMessages(onChange: () => void): () => void {
  const channel = supabase
    .channel(`messages-inbox-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function previewMessageBody(body: string | null | undefined, max = 72): string {
  const text = body?.replace(/\s+/g, ' ').trim() ?? '';
  if (!text) return 'No messages yet';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function formatThreadTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchThreadMessages,
  sendThreadMessage,
  subscribeToThreadMessages,
} from '@/lib/messaging';
import type { Message } from '@/types/database';

export function useChatThread(threadId: string | null, currentUserId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!threadId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchThreadMessages(threadId);
      if (requestId !== requestRef.current) return;
      setMessages(rows);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err instanceof Error ? err.message : 'Unable to load messages');
      setMessages([]);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!threadId) return;
    return subscribeToThreadMessages(threadId, (message) => {
      setMessages((prev) => {
        if (prev.some((row) => row.id === message.id)) return prev;
        return [...prev, message];
      });
    });
  }, [threadId]);

  const send = useCallback(
    async (body: string) => {
      if (!threadId || !currentUserId) return;
      setSending(true);
      setError(null);
      try {
        const message = await sendThreadMessage({
          threadId,
          senderUserId: currentUserId,
          body,
        });
        setMessages((prev) => {
          if (prev.some((row) => row.id === message.id)) return prev;
          return [...prev, message];
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to send message');
        throw err;
      } finally {
        setSending(false);
      }
    },
    [threadId, currentUserId],
  );

  return { messages, loading, sending, error, send, refresh: load };
}

export { useChatThread as useRealtimeChatThread };

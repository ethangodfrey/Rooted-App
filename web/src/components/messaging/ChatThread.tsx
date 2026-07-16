import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { Message } from '@/types/database';
import './messaging.css';

export interface ChatThreadProps {
  messages: Message[];
  currentUserId: string;
  loading?: boolean;
  sending?: boolean;
  error?: string | null;
  placeholder?: string;
  emptyLabel?: string;
  onSend: (body: string) => Promise<void> | void;
  /** Optional controlled draft (e.g. quick-reply fill). */
  draft?: string;
  onDraftChange?: (value: string) => void;
}

function formatBubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Shared realtime chat surface — indigo canvas, orange “mine” bubbles, tactile send.
 */
export function ChatThread({
  messages,
  currentUserId,
  loading = false,
  sending = false,
  error = null,
  placeholder = 'Write a message…',
  emptyLabel = 'No messages yet. Say hello.',
  onSend,
  draft,
  onDraftChange,
}: ChatThreadProps) {
  const [localDraft, setLocalDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const value = draft ?? localDraft;

  function setValue(next: string) {
    if (onDraftChange) onDraftChange(next);
    else setLocalDraft(next);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const body = value.trim();
    if (!body || sending) return;
    setValue('');
    await onSend(body);
  }

  return (
    <div className="chat-thread">
      <div className="chat-thread__scroller" role="log" aria-live="polite" aria-relevant="additions">
        {loading && messages.length === 0 ? (
          <div className="chat-thread__empty">
            <div className="chat-thread__spinner" aria-hidden />
            <p>Loading conversation…</p>
          </div>
        ) : null}

        {!loading && messages.length === 0 ? (
          <div className="chat-thread__empty">
            <p>{emptyLabel}</p>
          </div>
        ) : null}

        <ul className="chat-thread__list">
          {messages.map((message) => {
            const mine = message.sender_user_id === currentUserId;
            return (
              <li
                key={message.id}
                className={`chat-thread__row${mine ? ' chat-thread__row--mine' : ''}`}
              >
                <div
                  className={`chat-thread__bubble${mine ? ' chat-thread__bubble--mine' : ' chat-thread__bubble--theirs'}`}
                >
                  <p className="chat-thread__body">{message.body}</p>
                  <time className="chat-thread__time" dateTime={message.created_at}>
                    {formatBubbleTime(message.created_at)}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="chat-thread__error" role="alert">
          {error}
        </p>
      ) : null}

      <form className="chat-thread__composer" onSubmit={(e) => void handleSubmit(e)}>
        <label className="sr-only" htmlFor="chat-thread-input">
          Message
        </label>
        <input
          id="chat-thread-input"
          className="chat-thread__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          disabled={sending}
        />
        <button
          type="submit"
          className="chat-thread__send"
          disabled={sending || !value.trim()}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState } from 'react';

type Listener = () => void;

interface NowBucket {
  now: Date;
  listeners: Set<Listener>;
  timer: number;
}

const buckets = new Map<number, NowBucket>();

function ensureBucket(intervalMs: number): NowBucket {
  let bucket = buckets.get(intervalMs);
  if (!bucket) {
    bucket = {
      now: new Date(),
      listeners: new Set(),
      timer: window.setInterval(() => {
        bucket!.now = new Date();
        bucket!.listeners.forEach((listener) => listener());
      }, intervalMs),
    };
    buckets.set(intervalMs, bucket);
  }
  return bucket;
}

/** Shared ticking clock — one timer per interval for the whole app. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => ensureBucket(intervalMs).now);

  useEffect(() => {
    const bucket = ensureBucket(intervalMs);
    const listener = () => setNow(bucket.now);
    bucket.listeners.add(listener);
    setNow(bucket.now);
    return () => {
      bucket.listeners.delete(listener);
      if (bucket.listeners.size === 0) {
        window.clearInterval(bucket.timer);
        buckets.delete(intervalMs);
      }
    };
  }, [intervalMs]);

  return now;
}

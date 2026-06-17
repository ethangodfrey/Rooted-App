/** Local calendar date for HTML-style date inputs: YYYY-MM-DD */
export function toDateInput(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local time for HTML-style time inputs: HH:MM */
export function toTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Combine local date + time into an ISO string, or null when invalid. */
export function combineDateTime(date: string, time: string): string | null {
  const trimmedDate = date.trim();
  const trimmedTime = time.trim();
  if (!trimmedDate || !trimmedTime) return null;

  const parsed = new Date(`${trimmedDate}T${trimmedTime}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

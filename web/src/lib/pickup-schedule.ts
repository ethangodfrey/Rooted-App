import { useMemo } from 'react';

import { formatEventDisplayFullDate } from '@/lib/format';
import type { PresaleCart, PresaleCartMarket } from '@/lib/presale-cart';

export interface PickupScheduleFields {
  id?: string;
  name: string;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  start_datetime: string;
  end_datetime?: string | null;
  timezone?: string | null;
  hours_summary?: string | null;
  sync_metadata?: Record<string, unknown> | null;
}

/** Human-readable pickup label, e.g. "Pickup Sunday, July 12th at Lot Twenty Eight". */
export function formatPickupSummary(
  market: PickupScheduleFields,
  now: Date = new Date(),
): string {
  const dateLabel = formatEventDisplayFullDate(
    {
      start_datetime: market.start_datetime,
      timezone: market.timezone,
      state: market.state,
      hours_summary: market.hours_summary,
      sync_metadata: market.sync_metadata ?? undefined,
    },
    now,
  );

  const location = market.name?.trim() || 'your market';
  return `Pickup ${dateLabel} at ${location}`;
}

export function formatPickupLocation(market: PickupScheduleFields): string {
  const parts = [market.address, market.city, market.state].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return market.name;
}

export function pickupSummaryFromCart(cart: PresaleCart, now: Date = new Date()): string {
  return formatPickupSummary(
    {
      name: cart.marketName,
      city: cart.marketCity,
      state: cart.marketState,
      address: cart.marketAddress,
      start_datetime: cart.pickupSchedule.start_datetime,
      end_datetime: cart.pickupSchedule.end_datetime,
      timezone: cart.pickupSchedule.timezone,
      hours_summary: cart.pickupSchedule.hours_summary,
      sync_metadata: cart.pickupSchedule.sync_metadata,
    },
    now,
  );
}

export function pickupSummaryFromMarket(market: PresaleCartMarket, now: Date = new Date()): string {
  return formatPickupSummary(market, now);
}

/** Hook-friendly memo wrapper for pickup copy in drawer components. */
export function usePickupSummary(market: PickupScheduleFields | null, now: Date): string | null {
  return useMemo(() => (market ? formatPickupSummary(market, now) : null), [market, now]);
}

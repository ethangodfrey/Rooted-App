import { isApiConfigured } from '@/lib/api';
import { posApi } from '@/lib/pos-api';
import { supabase } from '@/lib/supabase';
import type { OrderStatus } from '@/types/database';
import type { PosImportedTransaction } from '@/types/pos';

export type AnalyticsRange = 7 | 30 | 90 | 365;

export interface DailyRevenuePoint {
  date: string;
  label: string;
  reservations: number;
  inPerson: number;
  cardSales: number;
  total: number;
}

export interface DailyUnitsPoint {
  date: string;
  label: string;
  units: number;
}

export interface ProductBreakdown {
  name: string;
  units: number;
  revenue: number;
}

export interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

export interface VendorAnalyticsData {
  range: AnalyticsRange;
  rangeLabel: string;
  reservationRevenue: number;
  inPersonRevenue: number;
  cardSalesRevenue: number;
  cardSalesCount: number;
  unitsSold: number;
  totalRevenue: number;
  ordersByStatus: { status: OrderStatus; count: number }[];
  topProducts: ProductBreakdown[];
  dailyRevenue: DailyRevenuePoint[];
  dailyUnits: DailyUnitsPoint[];
  revenueBySource: ChartSlice[];
  recentPosSales: PosImportedTransaction[];
  unmappedPosLineItems: number;
  posDataLoaded: boolean;
}

export const ANALYTICS_COLORS = {
  reservations: '#228B22',
  inPerson: '#50C878',
  cardSales: '#d97706',
  units: '#52b788',
  muted: '#9CAF88',
  status: ['#228B22', '#50C878', '#9CAF88', '#74c69d', '#95d5b2', '#b7e4c7', '#F0FFF0'],
} as const;

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  7: 'Last 7 days',
  30: 'Last 30 days',
  90: 'Last 90 days',
  365: 'Last year',
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function inRange(iso: string, start: Date, end: Date, allTime = false): boolean {
  if (allTime) return true;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime() + 86_399_999;
}

function buildDaySeries(range: AnalyticsRange): DailyRevenuePoint[] {
  const end = startOfDay(new Date());
  const start = new Date(end);
  start.setDate(start.getDate() - (range - 1));
  const days: DailyRevenuePoint[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const dateObj = new Date(cursor);
    days.push({
      date: toDateKey(dateObj),
      label: dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      reservations: 0,
      inPerson: 0,
      cardSales: 0,
      total: 0,
    });
  }
  return days;
}

function indexByDate(days: DailyRevenuePoint[]): Map<string, DailyRevenuePoint> {
  return new Map(days.map((d) => [d.date, d]));
}

function ensureDayBucket(map: Map<string, DailyRevenuePoint>, key: string): DailyRevenuePoint {
  const existing = map.get(key);
  if (existing) return existing;
  const [y, m, d] = key.split('-').map(Number);
  const labelDate = new Date(y, m - 1, d);
  const point: DailyRevenuePoint = {
    date: key,
    label: labelDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    reservations: 0,
    inPerson: 0,
    cardSales: 0,
    total: 0,
  };
  map.set(key, point);
  return point;
}

function addRevenue(
  map: Map<string, DailyRevenuePoint>,
  iso: string,
  field: 'reservations' | 'inPerson' | 'cardSales',
  cents: number,
) {
  if (cents <= 0) return;
  const key = toDateKey(new Date(iso));
  const day = ensureDayBucket(map, key);
  day[field] += cents;
  day.total += cents;
}

function chartLabel(label: string, range: AnalyticsRange): string {
  if (range <= 30) return label;
  const parts = label.split(' ');
  return parts.length >= 2 ? `${parts[0]} ${parts[1].replace(',', '')}` : label;
}

function focusChartDays(
  revenue: DailyRevenuePoint[],
  units: DailyUnitsPoint[],
): { dailyRevenue: DailyRevenuePoint[]; dailyUnits: DailyUnitsPoint[] } {
  let firstIdx = -1;
  let lastIdx = -1;
  revenue.forEach((d, i) => {
    const unitCount = units[i]?.units ?? 0;
    if (d.total > 0 || unitCount > 0) {
      if (firstIdx < 0) firstIdx = i;
      lastIdx = i;
    }
  });

  if (firstIdx < 0) {
    const tail = Math.min(7, revenue.length);
    return {
      dailyRevenue: revenue.slice(-tail),
      dailyUnits: units.slice(-tail),
    };
  }

  const pad = 1;
  const start = Math.max(0, firstIdx - pad);
  const end = Math.min(revenue.length - 1, lastIdx + pad);
  return {
    dailyRevenue: revenue.slice(start, end + 1),
    dailyUnits: units.slice(start, end + 1),
  };
}

export async function loadVendorAnalytics(
  vendorId: string,
  range: AnalyticsRange | 'all' = 30,
): Promise<VendorAnalyticsData> {
  const end = startOfDay(new Date());
  end.setHours(23, 59, 59, 999);
  const start =
    range === 'all'
      ? new Date(0)
      : (() => {
          const s = new Date(end);
          s.setDate(s.getDate() - (range - 1));
          s.setHours(0, 0, 0, 0);
          return s;
        })();

  const chartRange: AnalyticsRange = range === 'all' ? 90 : range;
  const dailyRevenue = buildDaySeries(chartRange);
  const revenueByDate = indexByDate(dailyRevenue);
  const unitsByDate = new Map(dailyRevenue.map((d) => [d.date, 0]));
  const sortedDayKeys = () => [...revenueByDate.keys()].sort((a, b) => a.localeCompare(b));

  const [ordersRes, txRes] = await Promise.all([
    supabase
      .from('orders')
      .select('order_status, total, created_at, updated_at')
      .eq('vendor_id', vendorId),
    supabase
      .from('inventory_transactions')
      .select('transaction_type, quantity_change, created_at, product:products(name, price)')
      .eq('vendor_id', vendorId),
  ]);

  const orders =
    (ordersRes.data as {
      order_status: OrderStatus;
      total: number;
      created_at: string;
      updated_at: string;
    }[]) ?? [];

  const txs =
    (txRes.data as unknown as {
      transaction_type: string;
      quantity_change: number;
      created_at: string;
      product: { name: string; price: number } | null;
    }[]) ?? [];

  const statusCounts = new Map<OrderStatus, number>();
  let reservationRevenue = 0;
  let inPersonRevenue = 0;
  let unitsSold = 0;
  const productMap = new Map<string, ProductBreakdown>();

  const bumpProduct = (name: string, units: number, revenue: number) => {
    const existing = productMap.get(name) ?? { name, units: 0, revenue: 0 };
    existing.units += units;
    existing.revenue += revenue;
    productMap.set(name, existing);
  };

  const allTime = range === 'all';

  for (const o of orders) {
    if (!inRange(o.created_at, start, end, allTime)) continue;
    statusCounts.set(o.order_status, (statusCounts.get(o.order_status) ?? 0) + 1);
    if (o.order_status === 'fulfilled') {
      reservationRevenue += o.total;
      const when = o.updated_at ?? o.created_at;
      addRevenue(revenueByDate, when, 'reservations', o.total);
    }
  }

  let posLoaded = false;

  for (const tx of txs) {
    if (!inRange(tx.created_at, start, end, allTime)) continue;
    const isSale =
      tx.transaction_type === 'sale_digital' ||
      tx.transaction_type === 'sale_manual' ||
      tx.transaction_type === 'sale_pos';
    if (!isSale) continue;
    if (tx.transaction_type === 'sale_pos') continue;

    const units = Math.abs(tx.quantity_change);
    const price = tx.product?.price ?? 0;
    const name = tx.product?.name ?? 'Unknown';
    const revenue = units * price;

    unitsSold += units;
    bumpProduct(name, units, revenue);

    const dateKey = toDateKey(new Date(tx.created_at));
    unitsByDate.set(dateKey, (unitsByDate.get(dateKey) ?? 0) + units);

    if (tx.transaction_type === 'sale_manual') {
      inPersonRevenue += revenue;
      addRevenue(revenueByDate, tx.created_at, 'inPerson', revenue);
    }
  }

  let cardSalesRevenue = 0;
  let cardSalesCount = 0;
  let recentPosSales: PosImportedTransaction[] = [];
  let unmappedPosLineItems = 0;

  if (isApiConfigured) {
    try {
      const pos = await posApi.transactions({
        ...(allTime ? {} : { since: start.toISOString() }),
        limit: 200,
      });
      posLoaded = true;
      const inRangeTxns = pos.items.filter((txn) => allTime || inRange(txn.soldAt, start, end));
      cardSalesCount = inRangeTxns.length;
      for (const txn of inRangeTxns) {
        cardSalesRevenue += txn.netAmount ?? 0;
        addRevenue(revenueByDate, txn.soldAt, 'cardSales', txn.netAmount ?? 0);

        const dateKey = toDateKey(new Date(txn.soldAt));
        ensureDayBucket(revenueByDate, dateKey);
        unitsByDate.set(dateKey, unitsByDate.get(dateKey) ?? 0);
        for (const li of txn.lineItems ?? []) {
          unitsSold += li.quantity;
          unitsByDate.set(dateKey, (unitsByDate.get(dateKey) ?? 0) + li.quantity);
          if (!li.productId) unmappedPosLineItems += 1;
          const name = li.product?.name ?? li.name;
          bumpProduct(name, li.quantity, li.grossAmount);
        }
      }
      recentPosSales = inRangeTxns.slice(0, 10);
    } catch {
      // POS optional
    }
  }

  if (!posLoaded) {
    for (const tx of txs) {
      if (!inRange(tx.created_at, start, end, allTime) || tx.transaction_type !== 'sale_pos') continue;
      const units = Math.abs(tx.quantity_change);
      const price = tx.product?.price ?? 0;
      const name = tx.product?.name ?? 'Unknown';
      unitsSold += units;
      bumpProduct(name, units, units * price);
      const dateKey = toDateKey(new Date(tx.created_at));
      unitsByDate.set(dateKey, (unitsByDate.get(dateKey) ?? 0) + units);
    }
  }

  const totalRevenue = reservationRevenue + inPersonRevenue + cardSalesRevenue;

  const revenueBySource: ChartSlice[] = [
    { label: 'Reservations', value: reservationRevenue, color: ANALYTICS_COLORS.reservations },
    { label: 'In-person', value: inPersonRevenue, color: ANALYTICS_COLORS.inPerson },
    { label: 'Card (Square)', value: cardSalesRevenue, color: ANALYTICS_COLORS.cardSales },
  ].filter((s) => s.value > 0);

  const chartDays = sortedDayKeys().map((date) => revenueByDate.get(date)!);

  const dailyUnits: DailyUnitsPoint[] = chartDays.map((d) => ({
    date: d.date,
    label: chartLabel(d.label, chartRange),
    units: unitsByDate.get(d.date) ?? 0,
  }));

  const labeledDailyRevenue = chartDays.map((d) => ({
    ...d,
    label: chartLabel(d.label, chartRange),
  }));

  const focused = focusChartDays(labeledDailyRevenue, dailyUnits);

  return {
    range: chartRange,
    rangeLabel: range === 'all' ? 'All time' : RANGE_LABELS[range],
    reservationRevenue,
    inPersonRevenue,
    cardSalesRevenue,
    cardSalesCount,
    unitsSold,
    totalRevenue,
    ordersByStatus: [...statusCounts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    topProducts: [...productMap.values()]
      .sort((a, b) => b.units - a.units)
      .slice(0, 10),
    dailyRevenue: focused.dailyRevenue,
    dailyUnits: focused.dailyUnits,
    revenueBySource,
    recentPosSales,
    unmappedPosLineItems,
    posDataLoaded: posLoaded,
  };
}

export function centsToChartValue(cents: number): number {
  return Math.round((cents / 100) * 100) / 100;
}

export function maxChartValue(values: number[], floor = 1): number {
  const max = Math.max(...values, 0);
  return max > 0 ? max : floor;
}

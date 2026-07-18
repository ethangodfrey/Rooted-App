import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  PosAnalyticsWebhookService,
  type PosAnalyticsWebhookResult,
} from './pos-analytics-webhook.service';

export type SimulateSwipeResult = PosAnalyticsWebhookResult & {
  confirmation: string;
  product_sku: string | null;
  product_name: string | null;
};

@Injectable()
export class AdminSimulateSwipeService {
  private readonly logger = new Logger(AdminSimulateSwipeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsWebhooks: PosAnalyticsWebhookService,
  ) {}

  async simulate(input?: {
    provider?: string;
    amount?: number;
    vendorId?: string;
  }): Promise<SimulateSwipeResult> {
    const provider = this.analyticsWebhooks.parseProvider(input?.provider ?? 'square');
    const amount = Number(input?.amount ?? 75);

    const target = await this.pickSeededCatalogItem(input?.vendorId);
    if (!target) {
      throw new NotFoundException(
        'NO SEEDED VENDOR PRODUCT FOUND — RUN npm run db:seed:network',
      );
    }

    // Ensure stock for a successful smoke decrement.
    await this.prisma.$executeRaw`
      update public.products
      set stock = greatest(stock, 5), updated_at = now()
      where id = ${target.product_id}::uuid
    `;

    const result = await this.analyticsWebhooks.process(provider, {
      vendor_id: target.profile_id,
      amount,
      currency: 'USD',
      recorded_at: new Date().toISOString(),
      items: [
        {
          product_id: target.product_id,
          sku: target.sku ?? undefined,
          quantity: 1,
        },
      ],
      metadata: {
        simulation: true,
        label: 'SIMULATE_SWIPE',
        business_name: target.business_name,
      },
      event_id: `sim-${Date.now()}`,
    });

    const confirmation = [
      'SIMULATE_SWIPE COMPLETE',
      `${provider.toUpperCase()}_WEBHOOK`,
      `VENDOR=${target.business_name}`,
      `AMOUNT=$${amount.toFixed(2)}`,
      `SKU=${target.sku ?? 'NONE'}`,
      `METRIC=${result.metric_id}`,
      `STOCK_DECREMENT=${result.stock_decrements.length}`,
    ].join(' · ');

    this.logger.log(confirmation);

    return {
      ...result,
      confirmation,
      product_sku: target.sku,
      product_name: target.product_name,
    };
  }

  private async pickSeededCatalogItem(vendorId?: string): Promise<{
    profile_id: string;
    business_name: string;
    product_id: string;
    product_name: string;
    sku: string | null;
  } | null> {
    if (vendorId) {
      const rows = await this.prisma.$queryRaw<
        Array<{
          profile_id: string;
          business_name: string;
          product_id: string;
          product_name: string;
          sku: string | null;
        }>
      >`
        select
          u.id as profile_id,
          coalesce(v.business_name, u.name, u.email) as business_name,
          p.id as product_id,
          p.name as product_name,
          p.sku
        from public.users u
        join public.vendors v on v.user_id = u.id
        join public.products p on p.vendor_id = v.id and p.status = 'active'
        where u.id = ${vendorId}::uuid
        order by p.created_at asc
        limit 1
      `;
      return rows[0] ?? null;
    }

    const seeded = await this.prisma.$queryRaw<
      Array<{
        profile_id: string;
        business_name: string;
        product_id: string;
        product_name: string;
        sku: string | null;
      }>
    >`
      select
        u.id as profile_id,
        coalesce(v.business_name, u.name, u.email) as business_name,
        p.id as product_id,
        p.name as product_name,
        p.sku
      from public.users u
      join public.vendors v on v.user_id = u.id
      join public.products p on p.vendor_id = v.id and p.status = 'active'
      where u.email like '%@network-seed.vendorly.local'
      order by p.sku asc nulls last, p.created_at asc
      limit 1
    `;
    if (seeded[0]) return seeded[0];

    // Fallback: any approved vendor with an active product
    const any = await this.prisma.$queryRaw<
      Array<{
        profile_id: string;
        business_name: string;
        product_id: string;
        product_name: string;
        sku: string | null;
      }>
    >`
      select
        u.id as profile_id,
        coalesce(v.business_name, u.name, u.email) as business_name,
        p.id as product_id,
        p.name as product_name,
        p.sku
      from public.users u
      join public.vendors v on v.user_id = u.id
      join public.products p on p.vendor_id = v.id and p.status = 'active'
      where v.approval_status = 'approved'
      order by p.created_at desc
      limit 1
    `;
    return any[0] ?? null;
  }
}

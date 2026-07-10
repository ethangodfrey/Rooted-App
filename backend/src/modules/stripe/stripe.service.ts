import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { PrismaService } from '../../prisma/prisma.service';
import {
  STRIPE_CHECKOUT_CANCEL_PATH,
  STRIPE_CHECKOUT_SUCCESS_PATH,
  STRIPE_PLATFORM_FEE_BPS,
} from './stripe.constants';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly client: Stripe | null;
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY', '').trim();
    this.client = secretKey ? new Stripe(secretKey) : null;
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET', '').trim();
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  requireClient(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY in the backend environment.',
      );
    }
    return this.client;
  }

  /** Stripe Connect Express onboarding link for a vendor. */
  async createVendorConnectLink(vendorId: string, returnUrl: string, refreshUrl: string) {
    const stripe = this.requireClient();
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, businessName: true, stripeAccountId: true },
    });
    if (!vendor) {
      throw new BadRequestException('Vendor not found.');
    }

    let accountId = vendor.stripeAccountId ?? undefined;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: vendor.businessName
          ? { name: vendor.businessName }
          : undefined,
        metadata: { vendor_id: vendorId },
      });
      accountId = account.id;
      await this.prisma.vendor.update({
        where: { id: vendorId },
        data: { stripeAccountId: accountId },
      });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return { url: link.url, accountId, expiresAt: link.expires_at };
  }

  /** Returns Connect readiness flags stored on the vendor row. */
  async getVendorConnectStatus(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        payoutsEnabled: true,
      },
    });
    if (!vendor) {
      throw new BadRequestException('Vendor not found.');
    }

    if (!this.client || !vendor.stripeAccountId) {
      return {
        connected: false,
        accountId: vendor.stripeAccountId,
        chargesEnabled: vendor.stripeChargesEnabled,
        payoutsEnabled: vendor.stripePayoutsEnabled,
        marketplacePayoutsEnabled: vendor.payoutsEnabled,
      };
    }

    const account = await this.client.accounts.retrieve(vendor.stripeAccountId);
    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;

    if (
      chargesEnabled !== vendor.stripeChargesEnabled ||
      payoutsEnabled !== vendor.stripePayoutsEnabled ||
      payoutsEnabled !== vendor.payoutsEnabled
    ) {
      await this.prisma.vendor.update({
        where: { id: vendorId },
        data: {
          stripeChargesEnabled: chargesEnabled,
          stripePayoutsEnabled: payoutsEnabled,
          payoutsEnabled,
        },
      });
    }

    return {
      connected: chargesEnabled,
      accountId: vendor.stripeAccountId,
      chargesEnabled,
      payoutsEnabled,
      marketplacePayoutsEnabled: payoutsEnabled,
    };
  }

  /** Creates a Stripe Checkout Session for an existing order (vendor prepay). */
  async createOrderCheckoutSession(params: {
    orderId: string;
    customerUserId: string;
    successUrl?: string;
    cancelUrl?: string;
  }) {
    const stripe = this.requireClient();
    const webBase = this.config.get<string>('WEB_APP_URL', 'http://localhost:5173').replace(/\/$/, '');

    const order = await this.prisma.$queryRaw<
      Array<{
        id: string;
        total: number;
        payment_status: string;
        stripe_checkout_session_id: string | null;
        vendor_id: string;
        business_name: string | null;
        stripe_account_id: string | null;
        stripe_charges_enabled: boolean;
      }>
    >`
      select
        o.id,
        o.total,
        o.payment_status,
        o.stripe_checkout_session_id,
        o.vendor_id,
        v.business_name,
        v.stripe_account_id,
        v.stripe_charges_enabled
      from public.orders o
      join public.vendors v on v.id = o.vendor_id
      join public.shoppers s on s.id = o.shopper_id
      where o.id = ${params.orderId}::uuid
        and s.user_id = ${params.customerUserId}::uuid
      limit 1
    `;

    const row = order[0];
    if (!row) {
      throw new BadRequestException('Order not found for this customer.');
    }
    if (row.payment_status === 'paid_online' || row.payment_status === 'paid_at_pickup') {
      throw new BadRequestException('Order is already paid.');
    }
    if (!row.stripe_account_id || !row.stripe_charges_enabled) {
      throw new BadRequestException('Vendor has not completed Stripe onboarding.');
    }

    const applicationFee = Math.round((row.total * STRIPE_PLATFORM_FEE_BPS) / 10_000);
    const successUrl =
      params.successUrl ??
      `${webBase}${STRIPE_CHECKOUT_SUCCESS_PATH}/${row.id}?checkout=success`;
    const cancelUrl =
      params.cancelUrl ??
      `${webBase}${STRIPE_CHECKOUT_CANCEL_PATH}/${row.id}?checkout=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: row.total,
            product_data: {
              name: row.business_name
                ? `Order from ${row.business_name}`
                : 'Vendorly order',
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: { destination: row.stripe_account_id },
        metadata: { order_id: row.id, vendor_id: row.vendor_id },
      },
      metadata: { order_id: row.id, vendor_id: row.vendor_id },
    });

    await this.prisma.$executeRaw`
      update public.orders
      set
        stripe_checkout_session_id = ${session.id},
        payment_status = 'stripe_pending',
        updated_at = now()
      where id = ${row.id}::uuid
    `;

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  verifyWebhook(rawBody: Buffer | string, signature: string | undefined): Stripe.Event {
    const stripe = this.requireClient();
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException(
        'STRIPE_WEBHOOK_SECRET is not configured.',
      );
    }
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header.');
    }

    return stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }

  /** Handles Stripe webhooks used by checkout and Connect account onboarding. */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Stripe webhook received: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'account.updated':
        await this.onAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        break;
    }
  }

  private async onCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.order_id;
    if (!orderId) return;

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    const updatedOrders = await this.prisma.$queryRaw<
      Array<{
        id: string;
        transaction_id: string | null;
        vendor_id: string;
        total: number;
        platform_fee: number;
      }>
    >`
      update public.orders
      set
        payment_status = 'paid_online',
        stripe_payment_intent_id = ${paymentIntentId ?? null},
        updated_at = now()
      where id = ${orderId}::uuid
        and stripe_checkout_session_id = ${session.id}
      returning id, transaction_id, vendor_id, total, platform_fee
    `;

    for (const order of updatedOrders) {
      await this.recordSettlementAndTax(order, paymentIntentId ?? null);
    }
  }

  private async onAccountUpdated(account: Stripe.Account) {
    if (!account.metadata?.vendor_id && !account.id) return;

    await this.prisma.vendor.updateMany({
      where: { stripeAccountId: account.id },
      data: {
        stripeChargesEnabled: account.charges_enabled ?? false,
        stripePayoutsEnabled: account.payouts_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
      },
    });
  }

  private async recordSettlementAndTax(
    order: {
      id: string;
      transaction_id: string | null;
      vendor_id: string;
      total: number;
      platform_fee: number;
    },
    paymentIntentId: string | null,
  ): Promise<void> {
    const netAmount = Math.max(0, order.total - order.platform_fee);

    await this.prisma.$executeRaw`
      insert into public.vendor_settlements (
        order_id,
        transaction_id,
        vendor_id,
        stripe_payment_intent_id,
        gross_amount,
        platform_fee,
        net_amount,
        status,
        hold_until
      ) values (
        ${order.id}::uuid,
        ${order.transaction_id}::uuid,
        ${order.vendor_id}::uuid,
        ${paymentIntentId},
        ${order.total},
        ${order.platform_fee},
        ${netAmount},
        'pending',
        now() + interval '2 days'
      )
      on conflict (order_id) do update set
        stripe_payment_intent_id = excluded.stripe_payment_intent_id,
        gross_amount = excluded.gross_amount,
        platform_fee = excluded.platform_fee,
        net_amount = excluded.net_amount
    `;

    if (order.transaction_id) {
      await this.prisma.$executeRaw`
        update public.transactions
        set status = 'captured',
            stripe_payment_intent_id = coalesce(stripe_payment_intent_id, ${paymentIntentId})
        where id = ${order.transaction_id}::uuid
      `;
    }

    await this.refreshVendorTaxCompliance(order.vendor_id);
  }

  private async refreshVendorTaxCompliance(vendorId: string): Promise<void> {
    const year = new Date().getUTCFullYear();
    await this.prisma.$executeRaw`
      insert into public.vendor_tax_compliance (
        vendor_id,
        tax_year,
        gross_volume,
        transaction_count,
        needs_1099k,
        threshold_reason,
        updated_at
      )
      select
        ${vendorId}::uuid,
        ${year},
        coalesce(sum(gross_amount), 0)::integer,
        count(*)::integer,
        (coalesce(sum(gross_amount), 0) >= 2000000 or count(*) >= 200),
        case
          when coalesce(sum(gross_amount), 0) >= 2000000 and count(*) >= 200
            then 'gross_volume_and_transaction_count'
          when coalesce(sum(gross_amount), 0) >= 2000000
            then 'gross_volume'
          when count(*) >= 200
            then 'transaction_count'
          else null
        end,
        now()
      from public.vendor_settlements
      where vendor_id = ${vendorId}::uuid
        and extract(year from created_at)::integer = ${year}
        and status in ('pending', 'available', 'released')
      on conflict (vendor_id, tax_year) do update set
        gross_volume = excluded.gross_volume,
        transaction_count = excluded.transaction_count,
        needs_1099k = excluded.needs_1099k,
        threshold_reason = excluded.threshold_reason,
        updated_at = now()
    `;
  }
}

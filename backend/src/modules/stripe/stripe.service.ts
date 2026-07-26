import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, WholesaleInvoiceStatus, WholesaleOrderStatus } from '@prisma/client';
import Stripe from 'stripe';

import { PrismaService } from '../../prisma/prisma.service';
import { sanitizeWebhookErrorMessage } from '../../common/observability/sanitize-error.util';
import { computePlatformFeeCents, resolvePlatformFeeBps } from '../../common/settlement/platform-fee';
import { CheckoutInventoryService } from '../checkout/checkout-inventory.service';
import { SquareIntegrationService } from '../pos/services/square-integration.service';
import {
  formatPaymentWebhooksActiveLog,
  formatStripeGatewayInitializedLog,
} from './payments-gateway.util';
import {
  STRIPE_CHECKOUT_CANCEL_PATH,
  STRIPE_CHECKOUT_SUCCESS_PATH,
} from './stripe.constants';

export interface CheckoutStripeSessionResult {
  orderId: string;
  vendorId: string;
  vendorName: string | null;
  sessionId: string;
  url: string | null;
}

@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private readonly client: Stripe | null;
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly inventory: CheckoutInventoryService,
    private readonly square: SquareIntegrationService,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY', '').trim();
    this.client = secretKey ? new Stripe(secretKey) : null;
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET', '').trim();
  }

  onModuleInit(): void {
    this.logger.log(formatStripeGatewayInitializedLog());
    if (this.webhookSecret) {
      this.logger.log(formatPaymentWebhooksActiveLog());
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private platformFeeBps(): number {
    return resolvePlatformFeeBps(this.config.get<string>('STRIPE_PLATFORM_FEE_BPS'));
  }

  requireClient(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY in the backend environment.',
      );
    }
    return this.client;
  }

  /** Best-effort PaymentIntent refund for dispute resolution. */
  async refundPaymentIntent(
    paymentIntentId: string,
    amountCents?: number,
  ): Promise<{ id: string; status: string }> {
    const stripe = this.requireClient();
    const params: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
    };
    if (amountCents != null && Number.isFinite(amountCents) && amountCents > 0) {
      params.amount = Math.floor(amountCents);
    }
    const refund = await stripe.refunds.create(params);
    this.logger.log(
      `STRIPE_REFUND_CREATED REFUND=${refund.id} PI=${paymentIntentId} STATUS=${refund.status}`,
    );
    return { id: refund.id, status: refund.status ?? 'unknown' };
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

    this.logger.log(
      `STRIPE_ACCOUNT_LINKED VENDOR=${vendorId} ACCOUNT=${accountId}`,
    );

    return {
      STATUS: 'STRIPE_ACCOUNT_LINKED',
      url: link.url,
      accountId,
      expiresAt: link.expires_at,
    };
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

  /** Creates Stripe Checkout Sessions for every vendor sub-order in a transaction. */
  async createTransactionCheckoutSessions(params: {
    transactionId: string;
    customerUserId: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<CheckoutStripeSessionResult[]> {
    const orders = await this.prisma.$queryRaw<
      Array<{
        id: string;
        total: number;
        platform_fee: number;
        payment_status: string;
        vendor_id: string;
        business_name: string | null;
        stripe_account_id: string | null;
        stripe_charges_enabled: boolean;
      }>
    >`
      select
        o.id,
        o.total,
        o.platform_fee,
        o.payment_status,
        o.vendor_id,
        v.business_name,
        v.stripe_account_id,
        v.stripe_charges_enabled
      from public.orders o
      join public.vendors v on v.id = o.vendor_id
      join public.transactions t on t.id = o.transaction_id
      where o.transaction_id = ${params.transactionId}::uuid
        and t.customer_id = ${params.customerUserId}::uuid
        and o.payment_status = 'stripe_pending'
      order by o.created_at asc
    `;

    if (orders.length === 0) {
      throw new BadRequestException('No pending Stripe orders found for this transaction.');
    }

    const sessions: CheckoutStripeSessionResult[] = [];
    for (const row of orders) {
      const session = await this.createVendorCheckoutSession({
        orderId: row.id,
        transactionId: params.transactionId,
        customerUserId: params.customerUserId,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
        row,
      });
      sessions.push(session);
    }

    return sessions;
  }

  /** Creates a Stripe Checkout Session for an existing order (vendor prepay). */
  async createOrderCheckoutSession(params: {
    orderId: string;
    customerUserId: string;
    successUrl?: string;
    cancelUrl?: string;
  }) {
    const order = await this.loadOrderCheckoutRow(params.orderId, params.customerUserId);
    const session = await this.createVendorCheckoutSession({
      orderId: order.id,
      transactionId: order.transaction_id,
      customerUserId: params.customerUserId,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      row: order,
    });
    return { sessionId: session.sessionId, url: session.url };
  }

  private async loadOrderCheckoutRow(orderId: string, customerUserId: string) {
    const order = await this.prisma.$queryRaw<
      Array<{
        id: string;
        transaction_id: string | null;
        total: number;
        platform_fee: number;
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
        o.transaction_id,
        o.total,
        o.platform_fee,
        o.payment_status,
        o.stripe_checkout_session_id,
        o.vendor_id,
        v.business_name,
        v.stripe_account_id,
        v.stripe_charges_enabled
      from public.orders o
      join public.vendors v on v.id = o.vendor_id
      join public.shoppers s on s.id = o.shopper_id
      where o.id = ${orderId}::uuid
        and s.user_id = ${customerUserId}::uuid
      limit 1
    `;

    const row = order[0];
    if (!row) {
      throw new BadRequestException('Order not found for this customer.');
    }
    return row;
  }

  private async createVendorCheckoutSession(params: {
    orderId: string;
    transactionId: string | null;
    customerUserId: string;
    successUrl?: string;
    cancelUrl?: string;
    row: {
      id: string;
      total: number;
      platform_fee: number;
      payment_status: string;
      vendor_id: string;
      business_name: string | null;
      stripe_account_id: string | null;
      stripe_charges_enabled: boolean;
    };
  }): Promise<CheckoutStripeSessionResult> {
    const stripe = this.requireClient();
    const webBase = this.config.get<string>('WEB_APP_URL', 'http://localhost:5173').replace(/\/$/, '');
    const { row } = params;

    if (row.payment_status === 'paid_online' || row.payment_status === 'paid_at_pickup') {
      throw new BadRequestException('Order is already paid.');
    }
    if (!row.stripe_account_id || !row.stripe_charges_enabled) {
      throw new BadRequestException('Vendor has not completed Stripe onboarding.');
    }

    const applicationFee = Math.max(
      0,
      row.platform_fee > 0
        ? row.platform_fee
        : computePlatformFeeCents(row.total, this.platformFeeBps()),
    );

    const successUrl =
      params.successUrl ??
      `${webBase}/checkout/success?transactionId=${params.transactionId ?? row.id}`;
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
                ? `Presale order — ${row.business_name}`
                : 'Vendorly presale order',
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: { destination: row.stripe_account_id },
        metadata: {
          order_id: row.id,
          vendor_id: row.vendor_id,
          transaction_id: params.transactionId ?? '',
          customer_user_id: params.customerUserId,
        },
      },
      metadata: {
        order_id: row.id,
        vendor_id: row.vendor_id,
        transaction_id: params.transactionId ?? '',
        customer_user_id: params.customerUserId,
      },
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
      orderId: row.id,
      vendorId: row.vendor_id,
      vendorName: row.business_name,
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

  /**
   * Destination-charge PaymentIntent for a wholesale Net-30 invoice after delivery confirm.
   * Leaves PI in requires_payment_method until the buyer completes payment / webhook clears.
   */
  async createWholesaleInvoicePaymentIntent(params: {
    invoiceId: string;
    orderId: string;
    sellerVendorId: string;
    buyerVendorId: string;
    amountCents: number;
    currency?: string;
  }): Promise<{
    PAYMENT_INTENT_ID: string | null;
    PAYMENT_STATUS: string | null;
    CLIENT_SECRET: string | null;
    SKIPPED_REASON: string | null;
  }> {
    if (!this.client) {
      this.logger.log(
        `PAYMENT_INTENT_SKIPPED REASON=STRIPE_NOT_CONFIGURED INVOICE=${params.invoiceId}`,
      );
      return {
        PAYMENT_INTENT_ID: null,
        PAYMENT_STATUS: null,
        CLIENT_SECRET: null,
        SKIPPED_REASON: 'STRIPE_NOT_CONFIGURED',
      };
    }

    const seller = await this.prisma.vendor.findUnique({
      where: { id: params.sellerVendorId },
      select: {
        stripeAccountId: true,
        stripeChargesEnabled: true,
      },
    });

    if (!seller?.stripeAccountId || !seller.stripeChargesEnabled) {
      this.logger.log(
        `PAYMENT_INTENT_SKIPPED REASON=SELLER_NOT_CONNECTED INVOICE=${params.invoiceId} SELLER=${params.sellerVendorId}`,
      );
      return {
        PAYMENT_INTENT_ID: null,
        PAYMENT_STATUS: null,
        CLIENT_SECRET: null,
        SKIPPED_REASON: 'SELLER_NOT_CONNECTED',
      };
    }

    if (!Number.isFinite(params.amountCents) || params.amountCents <= 0) {
      this.logger.log(
        `PAYMENT_INTENT_SKIPPED REASON=INVALID_AMOUNT INVOICE=${params.invoiceId}`,
      );
      return {
        PAYMENT_INTENT_ID: null,
        PAYMENT_STATUS: null,
        CLIENT_SECRET: null,
        SKIPPED_REASON: 'INVALID_AMOUNT',
      };
    }

    const applicationFee = computePlatformFeeCents(
      params.amountCents,
      this.platformFeeBps(),
    );
    const currency = (params.currency || 'usd').toLowerCase();

    const intent = await this.client.paymentIntents.create({
      amount: params.amountCents,
      currency,
      automatic_payment_methods: { enabled: true },
      application_fee_amount: applicationFee,
      transfer_data: { destination: seller.stripeAccountId },
      metadata: {
        purpose: 'wholesale_net30',
        wholesale_invoice_id: params.invoiceId,
        wholesale_order_id: params.orderId,
        seller_vendor_id: params.sellerVendorId,
        buyer_vendor_id: params.buyerVendorId,
      },
    });

    await this.prisma.wholesaleInvoice.update({
      where: { id: params.invoiceId },
      data: {
        stripePaymentIntentId: intent.id,
        stripePaymentStatus: intent.status,
      },
    });

    this.logger.log(
      `PAYMENT_INTENT_CREATED ID=${intent.id} INVOICE=${params.invoiceId} ORDER=${params.orderId} AMOUNT_CENTS=${params.amountCents} STATUS=${intent.status}`,
    );

    return {
      PAYMENT_INTENT_ID: intent.id,
      PAYMENT_STATUS: intent.status,
      CLIENT_SECRET: intent.client_secret,
      SKIPPED_REASON: null,
    };
  }

  /** Marks wholesale invoice PAID + order PAYMENT_SETTLED when a wholesale PI succeeds. */
  async settleWholesaleInvoiceFromPaymentIntent(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const invoiceId = paymentIntent.metadata?.wholesale_invoice_id?.trim();
    const orderId = paymentIntent.metadata?.wholesale_order_id?.trim();
    if (!invoiceId || paymentIntent.metadata?.purpose !== 'wholesale_net30') {
      return;
    }

    const paidAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.wholesaleInvoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, status: true, orderId: true },
      });
      if (!invoice) return;

      if (invoice.status !== WholesaleInvoiceStatus.PAID) {
        await tx.wholesaleInvoice.update({
          where: { id: invoice.id },
          data: {
            status: WholesaleInvoiceStatus.PAID,
            paidAt,
            stripePaymentIntentId: paymentIntent.id,
            stripePaymentStatus: paymentIntent.status,
          },
        });
      } else {
        await tx.wholesaleInvoice.update({
          where: { id: invoice.id },
          data: {
            stripePaymentIntentId: paymentIntent.id,
            stripePaymentStatus: paymentIntent.status,
          },
        });
      }

      const targetOrderId = orderId || invoice.orderId;
      await tx.wholesaleOrder.updateMany({
        where: {
          id: targetOrderId,
          status: {
            in: [
              WholesaleOrderStatus.ORDER_DELIVERY_CONFIRMED,
              WholesaleOrderStatus.PAYMENT_SETTLED,
            ],
          },
        },
        data: { status: WholesaleOrderStatus.PAYMENT_SETTLED },
      });
    });

    this.logger.log(
      `FUNDS_SETTLED PAYMENT_INTENT=${paymentIntent.id} INVOICE=${invoiceId} ORDER=${orderId || 'UNKNOWN'}`,
    );
    this.logger.log(
      `PAYMENT_SETTLED INVOICE=${invoiceId} ORDER=${orderId || 'UNKNOWN'}`,
    );
  }

  /** Handles Stripe webhooks used by checkout and Connect account onboarding. */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Stripe webhook received: ${event.type} (${event.id})`);

    let alreadyProcessed: Array<{ id: string }> = [];
    try {
      alreadyProcessed = await this.prisma.$queryRaw<Array<{ id: string }>>`
        select id from public.stripe_webhook_events where stripe_event_id = ${event.id} limit 1
      `;
    } catch {
      alreadyProcessed = [];
    }

    if (alreadyProcessed.length > 0) {
      this.logger.log(`Stripe webhook ${event.id} already processed — skipping`);
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.onCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case 'checkout.session.expired':
          await this.onCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
          break;
        case 'account.updated':
          await this.onAccountUpdated(event.data.object as Stripe.Account);
          break;
        case 'payment_intent.succeeded':
          await this.settleWholesaleInvoiceFromPaymentIntent(
            event.data.object as Stripe.PaymentIntent,
          );
          break;
        case 'payment_intent.payment_failed': {
          const failed = event.data.object as Stripe.PaymentIntent;
          if (
            failed.metadata?.purpose === 'wholesale_net30' &&
            failed.metadata.wholesale_invoice_id
          ) {
            await this.prisma.wholesaleInvoice.updateMany({
              where: { id: failed.metadata.wholesale_invoice_id },
              data: { stripePaymentStatus: failed.status },
            });
            this.logger.log(
              `PAYMENT_INTENT_FAILED ID=${failed.id} INVOICE=${failed.metadata.wholesale_invoice_id}`,
            );
          }
          break;
        }
        default:
          break;
      }

      await this.recordWebhookEvent(event.id, event.type, 'processed');
    } catch (err) {
      await this.recordWebhookEvent(
        event.id,
        event.type,
        'failed',
        sanitizeWebhookErrorMessage(err),
      );
      throw err;
    }
  }

  private async recordWebhookEvent(
    eventId: string,
    eventType: string,
    status: 'processed' | 'failed',
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        insert into public.stripe_webhook_events (
          stripe_event_id, event_type, status, error_message
        ) values (
          ${eventId},
          ${eventType},
          ${status},
          ${errorMessage ?? null}
        )
        on conflict (stripe_event_id) do nothing
      `;
    } catch {
      // Table may not exist until migration applied — webhook still works without idempotency store.
    }
  }

  private async onCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.order_id;
    const customerUserId = session.metadata?.customer_user_id;
    if (!orderId || !customerUserId) return;

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    await this.prisma.$transaction(async (tx) => {
      const updatedOrders = await tx.$queryRaw<
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
          and payment_status = 'stripe_pending'
        returning id, transaction_id, vendor_id, total, platform_fee
      `;

      if (updatedOrders.length === 0) {
        return;
      }

      await this.inventory.finalizePaidOrder(tx, orderId, customerUserId);

      for (const order of updatedOrders) {
        await this.recordSettlementAndTax(tx, order, paymentIntentId ?? null);
      }

      const transactionId =
        session.metadata?.transaction_id || updatedOrders[0]?.transaction_id;
      if (transactionId) {
        await this.refreshTransactionCaptureStatus(tx, transactionId, paymentIntentId ?? null);
      }
    });

    // After digital stock finalize, mirror the sale onto physical Square inventory.
    await this.deductSquareForPaidOrder(orderId, session.metadata);
  }

  private async deductSquareForPaidOrder(
    orderId: string,
    metadata: Stripe.Metadata | null | undefined,
  ): Promise<void> {
    const metaLines = this.square.extractCheckoutDeductionLines(
      metadata as Record<string, string> | null | undefined,
    );
    if (metaLines.length > 0) {
      for (const line of metaLines) {
        try {
          await this.square.deductSquareInventory(
            line.vendorId,
            line.sku,
            line.quantity,
          );
        } catch (err) {
          this.logger.warn(
            `SQUARE_DEDUCT_FAILED ORDER=${orderId} SKU=${line.sku} ERR=${(err as Error).message}`,
          );
        }
      }
      return;
    }

    try {
      const items = await this.prisma.$queryRaw<
        Array<{ vendor_id: string; sku: string | null; quantity: number }>
      >`
        select o.vendor_id, p.sku, oi.quantity
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        join public.products p on p.id = oi.product_id
        where oi.order_id = ${orderId}::uuid
      `;
      for (const item of items) {
        const sku = item.sku?.trim();
        if (!sku) continue;
        await this.square.deductSquareInventory(
          item.vendor_id,
          sku,
          Number(item.quantity) || 1,
        );
      }
    } catch (err) {
      this.logger.warn(
        `SQUARE_DEDUCT_ORDER_LOOKUP_FAILED ORDER=${orderId} ERR=${(err as Error).message}`,
      );
    }
  }

  private async onCheckoutSessionExpired(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.order_id;
    const customerUserId = session.metadata?.customer_user_id;
    if (!orderId || !customerUserId) return;

    await this.prisma.$transaction(async (tx) => {
      const pending = await tx.$queryRaw<Array<{ id: string }>>`
        select id from public.orders
        where id = ${orderId}::uuid
          and stripe_checkout_session_id = ${session.id}
          and payment_status = 'stripe_pending'
        limit 1
      `;

      if (pending.length === 0) return;

      await this.inventory.compensateStripeCheckout(tx, orderId, customerUserId);
    });
  }

  private async refreshTransactionCaptureStatus(
    tx: Prisma.TransactionClient,
    transactionId: string,
    paymentIntentId: string | null,
  ): Promise<void> {
    const counts = await tx.$queryRaw<
      Array<{ pending_count: number; paid_count: number }>
    >`
      select
        count(*) filter (where payment_status = 'stripe_pending')::integer as pending_count,
        count(*) filter (where payment_status = 'paid_online')::integer as paid_count
      from public.orders
      where transaction_id = ${transactionId}::uuid
    `;

    const pending = counts[0]?.pending_count ?? 0;
    const status = pending === 0 ? 'captured' : 'pending_payment';

    await tx.$executeRaw`
      update public.transactions
      set
        status = ${status},
        stripe_payment_intent_id = coalesce(stripe_payment_intent_id, ${paymentIntentId})
      where id = ${transactionId}::uuid
    `;
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
    tx: Prisma.TransactionClient,
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

    await tx.$executeRaw`
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

    await this.refreshVendorTaxCompliance(tx, order.vendor_id);
  }

  private async refreshVendorTaxCompliance(
    tx: Prisma.TransactionClient,
    vendorId: string,
  ): Promise<void> {
    const year = new Date().getUTCFullYear();
    await tx.$executeRaw`
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

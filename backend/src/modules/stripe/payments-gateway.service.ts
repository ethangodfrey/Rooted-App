/**
 * PaymentsGatewayService — Stripe Checkout for escrow references + webhook sync.
 * Telemetry: STRIPE_GATEWAY_INITIALIZED, PAYMENT_WEBHOOKS_ACTIVE
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';

import { PrismaService } from '../../prisma/prisma.service';
import { PaymentClearingService } from '../financial/payment-clearing.service';
import {
  formatPaymentWebhooksActiveLog,
  formatStripeGatewayInitializedLog,
  normalizeCheckoutAmountCents,
} from './payments-gateway.util';
import { StripeService } from './stripe.service';

@Injectable()
export class PaymentsGatewayService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsGatewayService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly clearing: PaymentClearingService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatStripeGatewayInitializedLog());
    this.logger.log(formatPaymentWebhooksActiveLog());
  }

  /**
   * Create a Stripe Checkout Session for a catering inquiry or procurement request.
   * Returns the hosted Checkout URL.
   */
  async createCheckoutSession(input: {
    referenceId: string;
    amount: number;
    successUrl?: string;
    cancelUrl?: string;
  }) {
    if (!input.referenceId?.trim()) {
      throw new BadRequestException('REFERENCE_ID_REQUIRED');
    }

    let amountCents: number;
    try {
      amountCents = normalizeCheckoutAmountCents(input.amount);
    } catch {
      throw new BadRequestException('AMOUNT_INVALID');
    }

    const resolved = await this.resolveReference(input.referenceId.trim());
    const stripe = this.stripeService.requireClient();
    const webBase = this.config
      .get<string>('WEB_APP_URL', 'http://localhost:5173')
      .replace(/\/$/, '');

    const successUrl =
      input.successUrl?.trim() ||
      `${webBase}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      input.cancelUrl?.trim() || `${webBase}/checkout/cancel`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name:
                resolved.referenceType === 'CATERING'
                  ? 'Catering deposit'
                  : 'Wholesale procurement payment',
              description: `Reference ${resolved.referenceId}`,
            },
          },
        },
      ],
      metadata: {
        reference_id: resolved.referenceId,
        reference_type: resolved.referenceType,
        amount_cents: String(amountCents),
        purpose: 'ESCROW_HOLD',
      },
      payment_intent_data: {
        metadata: {
          reference_id: resolved.referenceId,
          reference_type: resolved.referenceType,
          purpose: 'ESCROW_HOLD',
        },
      },
    };

    if (resolved.stripeAccountId) {
      sessionParams.payment_intent_data = {
        ...sessionParams.payment_intent_data,
        application_fee_amount: Math.round(amountCents * 0.05),
        transfer_data: { destination: resolved.stripeAccountId },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.url) {
      throw new ServiceUnavailableException('CHECKOUT_SESSION_URL_MISSING');
    }

    this.logger.log(
      `STRIPE_GATEWAY_INITIALIZED ACTION=CHECKOUT_CREATED REF=${resolved.referenceId} SESSION=${session.id}`,
    );

    return {
      STATUS: 'STRIPE_GATEWAY_INITIALIZED',
      ACTION: 'CHECKOUT_CREATED',
      REFERENCE_ID: resolved.referenceId,
      REFERENCE_TYPE: resolved.referenceType,
      AMOUNT_CENTS: amountCents,
      SESSION_ID: session.id,
      URL: session.url,
    };
  }

  /**
   * Handle Stripe webhook events for escrow checkout sessions.
   * checkout.session.completed → PaymentClearingService.holdInEscrow
   */
  async handleWebhook(rawBody: Buffer | string, signature: string) {
    const event = this.stripeService.verifyWebhook(rawBody, signature);
    this.logger.log(formatPaymentWebhooksActiveLog({ eventType: event.type }));

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.onCheckoutSessionCompleted(session);
    }

    return {
      STATUS: 'PAYMENT_WEBHOOKS_ACTIVE',
      EVENT_TYPE: event.type,
      EVENT_ID: event.id,
    };
  }

  private async onCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const referenceId = session.metadata?.reference_id?.trim();
    if (!referenceId) {
      this.logger.warn(
        `PAYMENT_WEBHOOKS_ACTIVE SKIP=NO_REFERENCE SESSION=${session.id}`,
      );
      return;
    }

    const purpose = session.metadata?.purpose?.trim();
    if (purpose && purpose !== 'ESCROW_HOLD') {
      // Leave non-escrow checkouts to the legacy StripeService order handlers.
      return;
    }

    const amountFromMeta = Number(session.metadata?.amount_cents);
    const amountFromSession =
      typeof session.amount_total === 'number' ? session.amount_total : 0;
    const amountCents = Math.max(
      0,
      Number.isFinite(amountFromMeta) && amountFromMeta > 0
        ? Math.floor(amountFromMeta)
        : amountFromSession,
    );
    if (amountCents < 1) {
      throw new BadRequestException('WEBHOOK_AMOUNT_INVALID');
    }

    const escrow = await this.clearing.holdInEscrow(referenceId, amountCents);
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent && typeof session.payment_intent === 'object'
          ? session.payment_intent.id
          : null;
    const transactionId =
      escrow &&
      typeof escrow === 'object' &&
      'TRANSACTION_ID' in escrow &&
      typeof (escrow as { TRANSACTION_ID?: string }).TRANSACTION_ID === 'string'
        ? (escrow as { TRANSACTION_ID: string }).TRANSACTION_ID
        : null;
    if (paymentIntentId && transactionId) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public.financial_transactions
        SET
          metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
            stripe_payment_intent_id: paymentIntentId,
            stripe_checkout_session_id: session.id,
          })}::jsonb,
          updated_at = NOW()
        WHERE id = ${transactionId}::uuid
      `);
    }
    this.logger.log(
      formatPaymentWebhooksActiveLog({
        eventType: 'checkout.session.completed',
        referenceId,
      }),
    );

    return escrow;
  }

  private async resolveReference(referenceId: string): Promise<{
    referenceId: string;
    referenceType: 'CATERING' | 'B2B_PROCUREMENT';
    stripeAccountId: string | null;
  }> {
    const inquiry = await this.prisma.$queryRaw<
      Array<{ id: string; stripe_account_id: string | null }>
    >(Prisma.sql`
      SELECT i.id, v.stripe_account_id
      FROM public.catering_inquiries i
      JOIN public.vendors v ON v.id = i.vendor_id
      WHERE i.id = ${referenceId}::uuid
      LIMIT 1
    `);
    if (inquiry[0]) {
      return {
        referenceId: inquiry[0].id,
        referenceType: 'CATERING',
        stripeAccountId: inquiry[0].stripe_account_id,
      };
    }

    const procurement = await this.prisma.$queryRaw<
      Array<{ id: string; stripe_account_id: string | null }>
    >(Prisma.sql`
      SELECT r.id, f.stripe_account_id
      FROM public.b2b_procurement_requests r
      JOIN public.farmers f ON f.id = r.farmer_id
      WHERE r.id = ${referenceId}::uuid
      LIMIT 1
    `);
    if (procurement[0]) {
      return {
        referenceId: procurement[0].id,
        referenceType: 'B2B_PROCUREMENT',
        stripeAccountId: procurement[0].stripe_account_id,
      };
    }

    throw new NotFoundException('REFERENCE_NOT_FOUND');
  }
}

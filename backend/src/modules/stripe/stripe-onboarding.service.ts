/**
 * StripeOnboardingService — Connect Express Account Links for vendors & farmers.
 * Telemetry: STRIPE_ONBOARDING_ACTIVE, BANK_LINK_INITIALIZED
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  defaultOnboardingReturnPath,
  formatBankLinkInitializedLog,
  formatStripeOnboardingActiveLog,
  payoutsEnabledFromAccountId,
  type OnboardingActorRole,
} from './stripe-onboarding.util';
import { StripeService } from './stripe.service';

@Injectable()
export class StripeOnboardingService implements OnModuleInit {
  private readonly logger = new Logger(StripeOnboardingService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatStripeOnboardingActiveLog());
    this.logger.log(formatBankLinkInitializedLog());
  }

  /**
   * Create (or resume) a Stripe Connect Account Link for the signed-in vendor/farmer.
   */
  async createOnboardingLink(
    user: AuthenticatedUser,
    opts?: {
      returnUrl?: string;
      refreshUrl?: string;
      action?: 'ONBOARD' | 'REFRESH';
    },
  ) {
    const actor = await this.resolveActor(user);
    const webBase = this.config
      .get<string>('WEB_APP_URL', 'http://localhost:5173')
      .replace(/\/$/, '');
    const returnPath = defaultOnboardingReturnPath(actor.role);
    const returnUrl =
      opts?.returnUrl?.trim() || `${webBase}${returnPath}?stripe=return`;
    const refreshUrl =
      opts?.refreshUrl?.trim() || `${webBase}${returnPath}?stripe=refresh`;

    const accountId = await this.ensureConnectAccount(actor);
    const stripe = this.stripeService.requireClient();
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    const action = opts?.action ?? 'ONBOARD';
    this.logger.log(
      formatBankLinkInitializedLog({
        action,
        role: actor.role,
        accountId,
      }),
    );
    this.logger.log(
      formatStripeOnboardingActiveLog({ role: actor.role, accountId }),
    );

    return {
      STATUS: 'BANK_LINK_INITIALIZED',
      ACTION: action,
      ROLE: actor.role.toUpperCase(),
      ACTOR_ID: actor.id,
      ACCOUNT_ID: accountId,
      URL: link.url,
      EXPIRES_AT: link.expires_at,
      /** Alias for older Connect clients. */
      url: link.url,
      accountId,
      expiresAt: link.expires_at,
    };
  }

  /** Resume onboarding after the user drops off the hosted Stripe flow. */
  async refreshOnboardingLink(
    user: AuthenticatedUser,
    opts?: { returnUrl?: string; refreshUrl?: string },
  ) {
    return this.createOnboardingLink(user, {
      ...opts,
      action: 'REFRESH',
    });
  }

  async getOnboardingStatus(user: AuthenticatedUser) {
    const actor = await this.resolveActor(user);
    const payoutsEnabled = payoutsEnabledFromAccountId(actor.stripeAccountId);
    this.logger.log(
      formatStripeOnboardingActiveLog({
        role: actor.role,
        accountId: actor.stripeAccountId,
      }),
    );
    return {
      STATUS: payoutsEnabled
        ? 'STRIPE_ONBOARDING_ACTIVE'
        : 'BANK_LINK_REQUIRED',
      ROLE: actor.role.toUpperCase(),
      ACTOR_ID: actor.id,
      STRIPE_ACCOUNT_ID: actor.stripeAccountId,
      PAYOUTS_ENABLED: payoutsEnabled,
    };
  }

  private async resolveActor(user: AuthenticatedUser): Promise<{
    role: OnboardingActorRole;
    id: string;
    displayName: string | null;
    stripeAccountId: string | null;
  }> {
    if (user.role === 'farmer') {
      const farmer = await this.loadFarmerByUserId(user.id);
      return {
        role: 'farmer',
        id: farmer.id,
        displayName: farmer.farm_name,
        stripeAccountId: farmer.stripe_account_id,
      };
    }

    if (user.role === 'vendor' || user.role === 'admin') {
      const vendorId = user.vendorId;
      if (!vendorId) throw new BadRequestException('VENDOR_PROFILE_REQUIRED');
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: vendorId },
        select: {
          id: true,
          businessName: true,
          stripeAccountId: true,
        },
      });
      if (!vendor) throw new BadRequestException('VENDOR_NOT_FOUND');
      return {
        role: 'vendor',
        id: vendor.id,
        displayName: vendor.businessName,
        stripeAccountId: vendor.stripeAccountId,
      };
    }

    throw new BadRequestException('ONBOARDING_ROLE_UNSUPPORTED');
  }

  private async ensureConnectAccount(actor: {
    role: OnboardingActorRole;
    id: string;
    displayName: string | null;
    stripeAccountId: string | null;
  }): Promise<string> {
    if (actor.stripeAccountId?.trim()) {
      return actor.stripeAccountId.trim();
    }

    const stripe = this.stripeService.requireClient();
    const account = await stripe.accounts.create({
      type: 'express',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: actor.displayName
        ? { name: actor.displayName }
        : undefined,
      metadata:
        actor.role === 'farmer'
          ? { farmer_id: actor.id }
          : { vendor_id: actor.id },
    });

    if (actor.role === 'farmer') {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public.farmers
        SET stripe_account_id = ${account.id},
            updated_at = NOW()
        WHERE id = ${actor.id}::uuid
      `);
    } else {
      await this.prisma.vendor.update({
        where: { id: actor.id },
        data: { stripeAccountId: account.id },
      });
    }

    return account.id;
  }

  private async loadFarmerByUserId(userId: string): Promise<{
    id: string;
    farm_name: string | null;
    stripe_account_id: string | null;
  }> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        farm_name: string | null;
        stripe_account_id: string | null;
      }>
    >(Prisma.sql`
      SELECT id, farm_name, stripe_account_id
      FROM public.farmers
      WHERE user_id = ${userId}::uuid
      LIMIT 1
    `);
    if (!rows[0]) throw new BadRequestException('FARMER_PROFILE_REQUIRED');
    return rows[0];
  }
}

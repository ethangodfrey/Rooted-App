import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RedemptionRulesService } from './redemption-rules.service';
import {
  applyBoost,
  basePointsForAction,
  formatLoyaltyTickProcessedLog,
  formatLoyaltyUiActiveLog,
  formatRewardsLogicPrecisionSetLog,
  microFeeCents,
  nextRedemptionProgress,
  normalizeLoyaltyAction,
  type LoyaltyActionType,
} from './loyalty.util';

@Injectable()
export class PrecisionRewardsService implements OnModuleInit {
  private readonly logger = new Logger(PrecisionRewardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redemption: RedemptionRulesService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatRewardsLogicPrecisionSetLog());
  }

  async getBalanceForUser(userId: string) {
    const shopperId = await this.resolveShopperId(userId);
    const row = await this.ensureLoyaltyRow(shopperId);
    const progress = nextRedemptionProgress(row.pointsTotal);
    this.logger.log(formatLoyaltyUiActiveLog({ pointsTotal: row.pointsTotal }));
    return {
      STATUS: 'LOYALTY_UI_ACTIVE',
      SHOPPER_ID: shopperId,
      POINTS_TOTAL: row.pointsTotal,
      RSVP_POINTS: row.rsvpPoints,
      CATERING_POINTS: row.cateringPoints,
      COLLABORATION_POINTS: row.collaborationPoints,
      BOOSTED_POINTS: row.boostedPoints,
      LAST_ACTION_DATE: row.lastActionDate,
      TIERS: this.redemption.listTiers(),
      NEXT_TIER: progress.nextTier,
      NEXT_POINTS: progress.nextPoints,
      PROGRESS_RATIO: progress.progressRatio,
      NEXT_LABEL: progress.label,
    };
  }

  async processTick(input: {
    userId: string;
    actionRaw: string;
    vendorId?: string | null;
    referenceId?: string | null;
  }) {
    const action = normalizeLoyaltyAction(input.actionRaw);
    if (!action) throw new BadRequestException('LOYALTY_ACTION_INVALID');

    const shopperId = await this.resolveShopperId(input.userId);
    const base = basePointsForAction(action);
    const boost = input.vendorId
      ? await this.findActiveBoost(input.vendorId)
      : null;

    let awarded = base;
    let bonus = 0;
    let boostId: string | null = null;
    let feeCharged = 0;

    if (boost && input.vendorId) {
      const applied = applyBoost({
        basePoints: base,
        multiplier: boost.multiplier,
      });
      awarded = applied.awarded;
      bonus = applied.bonus;
      boostId = boost.id;
      feeCharged = microFeeCents({
        bonusPoints: bonus,
        centsPerBonusPoint: boost.microFeeCentsPerBonusPoint,
      });

      if (feeCharged > 0) {
        const charged = await this.chargeVendorBoostBalance(
          input.vendorId,
          feeCharged,
        );
        if (!charged) {
          // Insufficient vendor balance — award base only.
          awarded = base;
          bonus = 0;
          boostId = null;
          feeCharged = 0;
        }
      }
    }

    await this.ensureLoyaltyRow(shopperId);
    await this.applyPoints({
      shopperId,
      action,
      base,
      bonus,
      awarded,
      vendorId: input.vendorId ?? null,
      boostId,
      referenceId: input.referenceId ?? null,
      feeCharged,
    });

    this.logger.log(
      formatLoyaltyTickProcessedLog({
        shopperId,
        action,
        points: awarded,
        boosted: bonus > 0,
      }),
    );

    const balance = await this.ensureLoyaltyRow(shopperId);
    return {
      STATUS: 'LOYALTY_TICK_PROCESSED',
      ACTION: action,
      POINTS_AWARDED: awarded,
      BASE_POINTS: base,
      BONUS_POINTS: bonus,
      BOOST_FEE_CENTS: feeCharged,
      POINTS_TOTAL: balance.pointsTotal,
    };
  }

  async createBoost(input: {
    vendorId: string;
    endsAt: string;
    startsAt?: string | null;
    multiplier?: number;
    microFeeCentsPerBonusPoint?: number;
    label?: string;
  }) {
    const endsAt = new Date(input.endsAt);
    if (!Number.isFinite(endsAt.getTime())) {
      throw new BadRequestException('ENDS_AT_INVALID');
    }
    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    if (endsAt <= startsAt) throw new BadRequestException('BOOST_WINDOW_INVALID');

    const multiplier = Number(input.multiplier ?? 2);
    if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 5) {
      throw new BadRequestException('MULTIPLIER_INVALID');
    }
    const fee = Math.max(
      0,
      Math.floor(Number(input.microFeeCentsPerBonusPoint ?? 1)),
    );

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO public.vendor_rewards_boost (
        vendor_id, label, multiplier, micro_fee_cents_per_bonus_point,
        starts_at, ends_at, is_active
      ) VALUES (
        ${input.vendorId}::uuid,
        ${input.label?.trim() || 'DOUBLE_POINTS'},
        ${multiplier},
        ${fee},
        ${startsAt.toISOString()}::timestamptz,
        ${endsAt.toISOString()}::timestamptz,
        true
      )
      RETURNING id
    `);

    this.logger.log(
      `REWARDS_LOGIC_PRECISION_SET ACTION=BOOST_CREATED VENDOR=${input.vendorId} ID=${rows[0]?.id}`,
    );
    return {
      STATUS: 'REWARDS_LOGIC_PRECISION_SET',
      BOOST_ID: rows[0]?.id,
    };
  }

  async setRewardsOptIn(vendorId: string, enabled: boolean) {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.vendors
      SET rewards_opt_in = ${enabled}, updated_at = NOW()
      WHERE id = ${vendorId}::uuid
    `);
    return {
      STATUS: 'REWARDS_LOGIC_PRECISION_SET',
      REWARDS_OPT_IN: enabled,
    };
  }

  async fundBoostBalance(vendorId: string, cents: number) {
    const amount = Math.floor(Number(cents));
    if (!Number.isFinite(amount) || amount < 1) {
      throw new BadRequestException('FUND_AMOUNT_INVALID');
    }
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.vendors
      SET rewards_boost_balance_cents = rewards_boost_balance_cents + ${amount},
          updated_at = NOW()
      WHERE id = ${vendorId}::uuid
    `);
    return {
      STATUS: 'REWARDS_LOGIC_PRECISION_SET',
      FUNDED_CENTS: amount,
    };
  }

  async listActiveBoosts(limit = 40) {
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          vendor_id: string;
          label: string;
          multiplier: number | string;
          starts_at: Date;
          ends_at: Date;
          business_name: string | null;
        }>
      >(Prisma.sql`
        SELECT
          b.id,
          b.vendor_id,
          b.label,
          b.multiplier,
          b.starts_at,
          b.ends_at,
          v.business_name
        FROM public.vendor_rewards_boost b
        JOIN public.vendors v ON v.id = b.vendor_id
        WHERE b.is_active = true
          AND b.starts_at <= NOW()
          AND b.ends_at >= NOW()
          AND v.rewards_opt_in = true
        ORDER BY b.starts_at DESC
        LIMIT ${safeLimit}
      `);

      this.logger.log(`REWARDS_SYNC_VERIFIED BOOSTS=${rows.length}`);
      return {
        STATUS: 'REWARDS_SYNC_VERIFIED',
        ITEMS: rows.map((row) => ({
          id: row.id,
          vendorId: row.vendor_id,
          vendorName: row.business_name,
          label: row.label,
          multiplier: Number(row.multiplier) || 2,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
        })),
        COUNT: rows.length,
      };
    } catch {
      return { STATUS: 'REWARDS_SYNC_VERIFIED', ITEMS: [], COUNT: 0 };
    }
  }

  async getVendorRewardsStatus(vendorId: string) {
    const vendor = await this.prisma.$queryRaw<
      Array<{
        rewards_opt_in: boolean;
        rewards_boost_balance_cents: number | string;
      }>
    >(Prisma.sql`
      SELECT rewards_opt_in, rewards_boost_balance_cents
      FROM public.vendors
      WHERE id = ${vendorId}::uuid
      LIMIT 1
    `);
    if (!vendor[0]) throw new NotFoundException('VENDOR_NOT_FOUND');

    const active = await this.prisma.$queryRaw<
      Array<{
        id: string;
        label: string;
        multiplier: number | string;
        ends_at: Date;
      }>
    >(Prisma.sql`
      SELECT id, label, multiplier, ends_at
      FROM public.vendor_rewards_boost
      WHERE vendor_id = ${vendorId}::uuid
        AND is_active = true
        AND starts_at <= NOW()
        AND ends_at >= NOW()
      ORDER BY starts_at DESC
      LIMIT 5
    `);

    return {
      STATUS: 'LOYALTY_UI_ACTIVE',
      REWARDS_OPT_IN: Boolean(vendor[0].rewards_opt_in),
      BOOST_BALANCE_CENTS: Number(vendor[0].rewards_boost_balance_cents) || 0,
      BOOST_ACTIVE: active.length > 0,
      ACTIVE_BOOSTS: active.map((row) => ({
        id: row.id,
        label: row.label,
        multiplier: Number(row.multiplier) || 2,
        endsAt: row.ends_at,
      })),
    };
  }

  /**
   * Toggle Double Points boost window for vendor.
   * Activating creates a 14-day DOUBLE_POINTS boost (and opts vendor in).
   * Deactivating marks current active boosts inactive.
   */
  async toggleBoost(vendorId: string, enabled: boolean) {
    if (enabled) {
      await this.setRewardsOptIn(vendorId, true);
      const endsAt = new Date();
      endsAt.setUTCDate(endsAt.getUTCDate() + 14);
      const created = await this.createBoost({
        vendorId,
        endsAt: endsAt.toISOString(),
        startsAt: new Date().toISOString(),
        multiplier: 2,
        microFeeCentsPerBonusPoint: 1,
        label: 'DOUBLE_POINTS',
      });
      this.logger.log(`LOYALTY_UI_ACTIVE ACTION=BOOST_ON VENDOR=${vendorId}`);
      return {
        STATUS: 'LOYALTY_UI_ACTIVE',
        BOOST_ACTIVE: true,
        BOOST_ID: created.BOOST_ID,
      };
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.vendor_rewards_boost
      SET is_active = false, updated_at = NOW()
      WHERE vendor_id = ${vendorId}::uuid
        AND is_active = true
        AND ends_at >= NOW()
    `);
    this.logger.log(`LOYALTY_UI_ACTIVE ACTION=BOOST_OFF VENDOR=${vendorId}`);
    return {
      STATUS: 'LOYALTY_UI_ACTIVE',
      BOOST_ACTIVE: false,
    };
  }

  async findActiveVoucherRedemption(input: {
    shopperId: string;
    vendorId: string;
  }): Promise<{ id: string } | null> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id
        FROM public.loyalty_redemptions
        WHERE shopper_id = ${input.shopperId}::uuid
          AND vendor_id = ${input.vendorId}::uuid
          AND tier = 'VOUCHER_5'::public.loyalty_redemption_tier
          AND status = 'ACTIVE'
        ORDER BY created_at DESC
        LIMIT 1
      `);
      return rows[0] ?? null;
    } catch {
      return null;
    }
  }

  async markRedemptionUsed(redemptionId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.loyalty_redemptions
      SET status = 'USED', updated_at = NOW()
      WHERE id = ${redemptionId}::uuid
        AND status = 'ACTIVE'
    `);
  }

  async redeem(input: {
    userId: string;
    vendorId: string;
    tierRaw: string;
  }) {
    const quote = this.redemption.quote(input.tierRaw);
    const shopperId = await this.resolveShopperId(input.userId);

    const vendor = await this.prisma.$queryRaw<
      Array<{ id: string; rewards_opt_in: boolean }>
    >(Prisma.sql`
      SELECT id, rewards_opt_in
      FROM public.vendors
      WHERE id = ${input.vendorId}::uuid
      LIMIT 1
    `);
    if (!vendor[0]) throw new NotFoundException('VENDOR_NOT_FOUND');
    if (!vendor[0].rewards_opt_in) {
      throw new BadRequestException('VENDOR_NOT_IN_REWARDS_PROGRAM');
    }

    const loyalty = await this.ensureLoyaltyRow(shopperId);
    this.redemption.assertAffordable(loyalty.pointsTotal, quote.tier);

    const spent = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.shopper_loyalty
      SET
        points_total = points_total - ${quote.pointsRequired},
        last_action_date = (timezone('utc', now()))::date,
        updated_at = NOW()
      WHERE shopper_id = ${shopperId}::uuid
        AND points_total >= ${quote.pointsRequired}
    `);
    if (Number(spent) < 1) {
      throw new BadRequestException('INSUFFICIENT_LOYALTY_POINTS');
    }

    const inserted = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO public.loyalty_redemptions (
        shopper_id, vendor_id, tier, points_spent, status, metadata
      ) VALUES (
        ${shopperId}::uuid,
        ${input.vendorId}::uuid,
        ${quote.tier}::public.loyalty_redemption_tier,
        ${quote.pointsRequired},
        'ACTIVE',
        ${JSON.stringify({
          label: quote.label,
          voucherCents: quote.voucherCents,
        })}::jsonb
      )
      RETURNING id
    `);

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO public.loyalty_action_ledger (
        shopper_id, vendor_id, action_type,
        base_points, bonus_points, points_awarded, metadata
      ) VALUES (
        ${shopperId}::uuid,
        ${input.vendorId}::uuid,
        'REDEMPTION'::public.loyalty_action_type,
        ${-quote.pointsRequired},
        0,
        ${-quote.pointsRequired},
        ${JSON.stringify({ redemptionId: inserted[0]?.id, tier: quote.tier })}::jsonb
      )
    `);

    this.logger.log(
      formatLoyaltyTickProcessedLog({
        shopperId,
        action: 'REDEMPTION',
        points: -quote.pointsRequired,
        boosted: false,
      }),
    );

    const balance = await this.ensureLoyaltyRow(shopperId);
    return {
      STATUS: 'LOYALTY_TICK_PROCESSED',
      ACTION: 'REDEMPTION',
      REDEMPTION_ID: inserted[0]?.id,
      TIER: quote.tier,
      POINTS_SPENT: quote.pointsRequired,
      POINTS_TOTAL: balance.pointsTotal,
      LABEL: quote.label,
    };
  }

  private async resolveShopperId(userId: string): Promise<string> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM public.shoppers WHERE user_id = ${userId}::uuid LIMIT 1
    `);
    if (!rows[0]?.id) throw new NotFoundException('SHOPPER_NOT_FOUND');
    return rows[0].id;
  }

  private async ensureLoyaltyRow(shopperId: string): Promise<{
    pointsTotal: number;
    rsvpPoints: number;
    cateringPoints: number;
    collaborationPoints: number;
    boostedPoints: number;
    lastActionDate: string | null;
  }> {
    try {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO public.shopper_loyalty (shopper_id, points_total)
        VALUES (${shopperId}::uuid, 0)
        ON CONFLICT (shopper_id) DO NOTHING
      `);
      const rows = await this.prisma.$queryRaw<
        Array<{
          points_total: number | string;
          rsvp_points: number | string;
          catering_points: number | string;
          collaboration_points: number | string;
          boosted_points: number | string;
          last_action_date: Date | string | null;
        }>
      >(Prisma.sql`
        SELECT
          points_total, rsvp_points, catering_points,
          collaboration_points, boosted_points, last_action_date
        FROM public.shopper_loyalty
        WHERE shopper_id = ${shopperId}::uuid
        LIMIT 1
      `);
      const row = rows[0];
      return {
        pointsTotal: Number(row?.points_total) || 0,
        rsvpPoints: Number(row?.rsvp_points) || 0,
        cateringPoints: Number(row?.catering_points) || 0,
        collaborationPoints: Number(row?.collaboration_points) || 0,
        boostedPoints: Number(row?.boosted_points) || 0,
        lastActionDate:
          row?.last_action_date != null
            ? String(row.last_action_date).slice(0, 10)
            : null,
      };
    } catch {
      return {
        pointsTotal: 0,
        rsvpPoints: 0,
        cateringPoints: 0,
        collaborationPoints: 0,
        boostedPoints: 0,
        lastActionDate: null,
      };
    }
  }

  private async findActiveBoost(vendorId: string): Promise<{
    id: string;
    multiplier: number;
    microFeeCentsPerBonusPoint: number;
  } | null> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          multiplier: number | string;
          micro_fee_cents_per_bonus_point: number | string;
        }>
      >(Prisma.sql`
        SELECT id, multiplier, micro_fee_cents_per_bonus_point
        FROM public.vendor_rewards_boost
        WHERE vendor_id = ${vendorId}::uuid
          AND is_active = true
          AND starts_at <= NOW()
          AND ends_at >= NOW()
        ORDER BY starts_at DESC
        LIMIT 1
      `);
      if (!rows[0]) return null;
      return {
        id: rows[0].id,
        multiplier: Number(rows[0].multiplier) || 2,
        microFeeCentsPerBonusPoint:
          Number(rows[0].micro_fee_cents_per_bonus_point) || 1,
      };
    } catch {
      return null;
    }
  }

  private async chargeVendorBoostBalance(
    vendorId: string,
    cents: number,
  ): Promise<boolean> {
    try {
      const updated = await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public.vendors
        SET
          rewards_boost_balance_cents = rewards_boost_balance_cents - ${cents},
          updated_at = NOW()
        WHERE id = ${vendorId}::uuid
          AND rewards_boost_balance_cents >= ${cents}
      `);
      return Number(updated) > 0;
    } catch {
      return false;
    }
  }

  private async applyPoints(input: {
    shopperId: string;
    action: Exclude<LoyaltyActionType, 'REDEMPTION'>;
    base: number;
    bonus: number;
    awarded: number;
    vendorId: string | null;
    boostId: string | null;
    referenceId: string | null;
    feeCharged: number;
  }): Promise<void> {
    if (input.action === 'RSVP_MARKET_EVENT') {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public.shopper_loyalty
        SET
          points_total = points_total + ${input.awarded},
          boosted_points = boosted_points + ${input.bonus},
          rsvp_points = rsvp_points + ${input.base},
          last_action_date = (timezone('utc', now()))::date,
          updated_at = NOW()
        WHERE shopper_id = ${input.shopperId}::uuid
      `);
    } else if (input.action === 'CATERING_INQUIRY') {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public.shopper_loyalty
        SET
          points_total = points_total + ${input.awarded},
          boosted_points = boosted_points + ${input.bonus},
          catering_points = catering_points + ${input.base},
          last_action_date = (timezone('utc', now()))::date,
          updated_at = NOW()
        WHERE shopper_id = ${input.shopperId}::uuid
      `);
    } else {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public.shopper_loyalty
        SET
          points_total = points_total + ${input.awarded},
          boosted_points = boosted_points + ${input.bonus},
          collaboration_points = collaboration_points + ${input.base},
          last_action_date = (timezone('utc', now()))::date,
          updated_at = NOW()
        WHERE shopper_id = ${input.shopperId}::uuid
      `);
    }

    const vendorSql = input.vendorId
      ? Prisma.sql`${input.vendorId}::uuid`
      : Prisma.sql`NULL`;
    const boostSql = input.boostId
      ? Prisma.sql`${input.boostId}::uuid`
      : Prisma.sql`NULL`;
    const refSql = input.referenceId
      ? Prisma.sql`${input.referenceId}::uuid`
      : Prisma.sql`NULL`;

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO public.loyalty_action_ledger (
        shopper_id, vendor_id, action_type,
        base_points, bonus_points, points_awarded,
        boost_id, reference_id, metadata
      ) VALUES (
        ${input.shopperId}::uuid,
        ${vendorSql},
        ${input.action}::public.loyalty_action_type,
        ${input.base},
        ${input.bonus},
        ${input.awarded},
        ${boostSql},
        ${refSql},
        ${JSON.stringify({ feeChargedCents: input.feeCharged })}::jsonb
      )
    `);
  }
}

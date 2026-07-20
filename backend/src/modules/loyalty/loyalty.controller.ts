import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  OnModuleInit,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { formatRewardsLogicPrecisionSetLog } from './loyalty.util';
import { PrecisionRewardsService } from './precision-rewards.service';
import { RedemptionRulesService } from './redemption-rules.service';

@Controller('api/loyalty')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class LoyaltyController implements OnModuleInit {
  private readonly logger = new Logger(LoyaltyController.name);

  constructor(
    private readonly rewards: PrecisionRewardsService,
    private readonly redemption: RedemptionRulesService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatRewardsLogicPrecisionSetLog());
  }

  @Get('balance')
  @Roles('shopper', 'admin')
  async balance(@CurrentUser() user: AuthenticatedUser) {
    return this.rewards.getBalanceForUser(user.id);
  }

  @Get('tiers')
  @Roles('shopper', 'vendor', 'farmer', 'admin')
  async tiers() {
    return {
      STATUS: 'REWARDS_LOGIC_PRECISION_SET',
      TIERS: this.redemption.listTiers(),
    };
  }

  @Post('tick')
  @Roles('shopper', 'admin')
  async tick(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      action?: string;
      vendorId?: string | null;
      referenceId?: string | null;
    },
  ) {
    if (!body.action?.trim()) {
      throw new BadRequestException('ACTION_REQUIRED');
    }
    return this.rewards.processTick({
      userId: user.id,
      actionRaw: body.action,
      vendorId: body.vendorId ?? null,
      referenceId: body.referenceId ?? null,
    });
  }

  @Post('redeem')
  @Roles('shopper', 'admin')
  async redeem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { vendorId?: string; tier?: string },
  ) {
    if (!body.vendorId?.trim()) throw new BadRequestException('VENDOR_ID_REQUIRED');
    if (!body.tier?.trim()) throw new BadRequestException('TIER_REQUIRED');
    return this.rewards.redeem({
      userId: user.id,
      vendorId: body.vendorId,
      tierRaw: body.tier,
    });
  }

  @Put('vendor/opt-in')
  @Roles('vendor', 'farmer', 'admin')
  async optIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { enabled?: boolean },
  ) {
    if (!user.vendorId) throw new BadRequestException('VENDOR_REQUIRED');
    return this.rewards.setRewardsOptIn(user.vendorId, Boolean(body.enabled));
  }

  @Post('vendor/boost')
  @Roles('vendor', 'farmer', 'admin')
  async createBoost(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      endsAt?: string;
      startsAt?: string;
      multiplier?: number;
      microFeeCentsPerBonusPoint?: number;
      label?: string;
    },
  ) {
    if (!user.vendorId) throw new BadRequestException('VENDOR_REQUIRED');
    if (!body.endsAt?.trim()) throw new BadRequestException('ENDS_AT_REQUIRED');
    return this.rewards.createBoost({
      vendorId: user.vendorId,
      endsAt: body.endsAt,
      startsAt: body.startsAt,
      multiplier: body.multiplier,
      microFeeCentsPerBonusPoint: body.microFeeCentsPerBonusPoint,
      label: body.label,
    });
  }

  @Post('vendor/fund')
  @Roles('vendor', 'farmer', 'admin')
  async fund(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { cents?: number },
  ) {
    if (!user.vendorId) throw new BadRequestException('VENDOR_REQUIRED');
    return this.rewards.fundBoostBalance(user.vendorId, Number(body.cents));
  }
}

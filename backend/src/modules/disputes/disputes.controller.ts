import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  OnModuleInit,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { DisputeService } from './dispute.service';
import {
  formatDisputeEngineInitializedLog,
  formatEscrowFrozenActiveLog,
} from './dispute.util';

@Controller('api/disputes')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class DisputesController implements OnModuleInit {
  private readonly logger = new Logger(DisputesController.name);

  constructor(private readonly disputes: DisputeService) {}

  onModuleInit(): void {
    this.logger.log(formatDisputeEngineInitializedLog());
    this.logger.log(formatEscrowFrozenActiveLog());
  }

  /**
   * POST /api/disputes
   * Raise a dispute → freeze HELD_IN_ESCROW to FROZEN.
   */
  @Post()
  @Roles('vendor', 'farmer', 'shopper', 'admin')
  async raise(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      transaction_id?: string;
      transactionId?: string;
      reason?: string;
    },
  ) {
    const transactionId = (body.transaction_id ?? body.transactionId ?? '').trim();
    if (!transactionId) throw new BadRequestException('TRANSACTION_ID_REQUIRED');
    if (!body.reason?.trim()) throw new BadRequestException('REASON_REQUIRED');
    return this.disputes.raiseDispute({
      transactionId,
      reason: body.reason,
      initiatorId: user.id,
    });
  }
}

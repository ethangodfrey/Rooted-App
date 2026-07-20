import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  OnModuleInit,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import {
  formatEscrowLedgerActiveLog,
  formatFinancialEngineInitializedLog,
} from './financial.util';
import { PaymentClearingService } from './payment-clearing.service';

@Controller('api/financial')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class FinancialController implements OnModuleInit {
  private readonly logger = new Logger(FinancialController.name);

  constructor(private readonly clearing: PaymentClearingService) {}

  onModuleInit(): void {
    this.logger.log(formatFinancialEngineInitializedLog());
    this.logger.log(formatEscrowLedgerActiveLog());
  }

  /**
   * POST /api/financial/escrow/hold
   * Lock deposit when catering inquiry is accepted.
   */
  @Post('escrow/hold')
  @Roles('vendor', 'farmer', 'admin')
  async hold(
    @Body() body: { inquiryId?: string; amountCents?: number },
  ) {
    if (!body.inquiryId?.trim()) {
      throw new BadRequestException('INQUIRY_ID_REQUIRED');
    }
    if (body.amountCents == null) {
      throw new BadRequestException('AMOUNT_CENTS_REQUIRED');
    }
    return this.clearing.holdInEscrow(body.inquiryId, Number(body.amountCents));
  }

  /**
   * POST /api/financial/escrow/release
   * Disburse held funds after fulfillment.
   */
  @Post('escrow/release')
  @Roles('vendor', 'farmer', 'admin')
  async release(@Body() body: { inquiryId?: string }) {
    if (!body.inquiryId?.trim()) {
      throw new BadRequestException('INQUIRY_ID_REQUIRED');
    }
    return this.clearing.releaseEscrow(body.inquiryId);
  }

  @Get('vendors/:vendorId/balance')
  @Roles('vendor', 'farmer', 'admin')
  async balance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vendorId') vendorId: string,
  ) {
    if (!vendorId?.trim()) throw new BadRequestException('VENDOR_ID_REQUIRED');
    if (!user.vendorId || user.vendorId !== vendorId) {
      if (user.role !== 'admin') {
        throw new BadRequestException('VENDOR_MISMATCH');
      }
    }
    return this.clearing.getVendorBalance(vendorId);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  OnModuleInit,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AvailabilityService } from './availability.service';
import {
  formatAvailabilitySyncActiveLog,
  formatSchedulingEngineInitializedLog,
} from './availability.util';

@Controller('api/availability')
export class AvailabilityController implements OnModuleInit {
  private readonly logger = new Logger(AvailabilityController.name);

  constructor(private readonly availability: AvailabilityService) {}

  onModuleInit(): void {
    this.logger.log(formatSchedulingEngineInitializedLog());
    this.logger.log(formatAvailabilitySyncActiveLog());
  }

  /**
   * GET /api/availability/vendors/:vendorId/check?date=YYYY-MM-DD
   */
  @Get('vendors/:vendorId/check')
  async check(
    @Param('vendorId') vendorId: string,
    @Query('date') date?: string,
  ) {
    if (!vendorId?.trim()) throw new BadRequestException('VENDOR_ID_REQUIRED');
    if (!date?.trim()) throw new BadRequestException('DATE_REQUIRED');
    return this.availability.checkAvailability(vendorId, date);
  }

  /**
   * GET /api/availability/vendors/:vendorId/blocks
   * Public list of blocked dates (for Request Catering modal).
   */
  @Get('vendors/:vendorId/blocks')
  async listBlocks(
    @Param('vendorId') vendorId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!vendorId?.trim()) throw new BadRequestException('VENDOR_ID_REQUIRED');
    return this.availability.listBlocks(vendorId, from, to);
  }

  /**
   * PUT /api/availability/vendors/:vendorId/blocks
   * Vendor toggles a CATERING or MARKET block-out date.
   */
  @Put('vendors/:vendorId/blocks')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'farmer', 'admin')
  async setBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vendorId') vendorId: string,
    @Body() body: { date?: string; reason?: string; blocked?: boolean },
  ) {
    if (!vendorId?.trim()) throw new BadRequestException('VENDOR_ID_REQUIRED');
    if (!user.vendorId || user.vendorId !== vendorId) {
      if (user.role !== 'admin') {
        throw new BadRequestException('VENDOR_MISMATCH');
      }
    }
    if (!body.date?.trim()) throw new BadRequestException('DATE_REQUIRED');
    if (!body.reason?.trim()) throw new BadRequestException('REASON_REQUIRED');
    return this.availability.setBlock({
      vendorId,
      date: body.date,
      reason: body.reason,
      blocked: Boolean(body.blocked),
    });
  }
}

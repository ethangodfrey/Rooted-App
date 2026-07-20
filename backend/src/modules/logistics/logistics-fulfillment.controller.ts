import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  OnModuleInit,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { LogisticsFulfillmentService } from './logistics-fulfillment.service';
import {
  formatFleetTrackingActiveLog,
  formatLogisticsEngineInitializedLog,
} from './logistics.util';

@Controller('api/logistics')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class LogisticsFulfillmentController implements OnModuleInit {
  private readonly logger = new Logger(LogisticsFulfillmentController.name);

  constructor(private readonly fulfillment: LogisticsFulfillmentService) {}

  onModuleInit(): void {
    this.logger.log(formatLogisticsEngineInitializedLog());
    this.logger.log(formatFleetTrackingActiveLog());
  }

  /**
   * POST /api/logistics/routes
   * Farmer groups ACCEPTED wholesale orders into a delivery route.
   */
  @Post('routes')
  @Roles('farmer', 'admin')
  async createRoute(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      farmerId?: string;
      procurementRequestIds?: string[];
      dispatchDate?: string;
    },
  ) {
    let farmerId = body.farmerId?.trim();
    if (user.role === 'admin') {
      if (!farmerId) throw new BadRequestException('FARMER_ID_REQUIRED');
    } else {
      const ownId = await this.fulfillment.resolveFarmerIdForUser(user.id);
      if (farmerId && farmerId !== ownId) {
        throw new BadRequestException('FARMER_MISMATCH');
      }
      farmerId = ownId;
    }
    return this.fulfillment.createRouteFromAcceptedOrders({
      farmerId,
      procurementRequestIds: body.procurementRequestIds ?? [],
      dispatchDate: body.dispatchDate ?? new Date().toISOString().slice(0, 10),
    });
  }

  @Get('farmers/:farmerId/routes')
  @Roles('farmer', 'admin')
  async listRoutes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('farmerId') farmerId: string,
    @Query('limit') limit?: string,
  ) {
    if (!farmerId?.trim()) throw new BadRequestException('FARMER_ID_REQUIRED');
    if (user.role !== 'admin') {
      const ownId = await this.fulfillment.resolveFarmerIdForUser(user.id);
      if (ownId !== farmerId) throw new BadRequestException('FARMER_MISMATCH');
    }
    const parsed = limit ? Number(limit) : 20;
    return this.fulfillment.listRoutesForFarmer(
      farmerId,
      Number.isFinite(parsed) ? parsed : 20,
    );
  }

  /**
   * POST /api/logistics/stops/:stopId/confirm
   * Confirm dropoff → DELIVERED + PaymentClearingService.releaseEscrow.
   */
  @Post('stops/:stopId/confirm')
  @Roles('farmer', 'admin')
  async confirmDropoff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('stopId') stopId: string,
  ) {
    if (!stopId?.trim()) throw new BadRequestException('STOP_ID_REQUIRED');
    if (user.role !== 'admin') {
      // Ensures caller is a registered farmer before confirming dropoff.
      await this.fulfillment.resolveFarmerIdForUser(user.id);
    }
    return this.fulfillment.confirmDropoff(stopId);
  }
}

import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { Roles } from '../../../common/auth/decorators';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../common/auth/supabase-auth.guard';
import { AdminSimulateSwipeService } from '../services/admin-simulate-swipe.service';

type SimulateSwipeBody = {
  provider?: string;
  amount?: number;
  vendorId?: string;
};

/**
 * POST /admin/simulate-swipe
 * Admin-only smoke trigger that processes a mock Square/Toast charge
 * through the analytics webhook pipeline.
 */
@Controller('admin/simulate-swipe')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
export class AdminSimulateSwipeController {
  constructor(private readonly simulateSwipe: AdminSimulateSwipeService) {}

  @Post()
  async run(@Body() body: SimulateSwipeBody) {
    return this.simulateSwipe.simulate(body ?? {});
  }
}

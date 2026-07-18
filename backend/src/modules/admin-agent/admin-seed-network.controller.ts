import { Controller, Post, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { AdminSeedNetworkService } from './admin-seed-network.service';

@Controller('admin/seed-network')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
export class AdminSeedNetworkController {
  constructor(private readonly seedNetwork: AdminSeedNetworkService) {}

  /**
   * POST /admin/seed-network
   * Admin-only trigger for the Denver local network stress seed.
   */
  @Post()
  async run() {
    return this.seedNetwork.seed();
  }
}

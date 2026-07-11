import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { TenantCacheService } from './tenant-cache.service';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [PrismaModule],
  controllers: [TenantsController],
  providers: [TenantCacheService, TenantsService],
  exports: [TenantsService, TenantCacheService],
})
export class TenantsModule {}

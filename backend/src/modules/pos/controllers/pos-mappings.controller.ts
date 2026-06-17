import { BadRequestException, Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../../../common/auth/auth.types';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../common/auth/supabase-auth.guard';
import { UpsertProductMappingDto } from '../dto/upsert-product-mapping.dto';
import { PosMappingService } from '../services/pos-mapping.service';

@Controller('pos/mappings')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class PosMappingsController {
  constructor(private readonly mappings: PosMappingService) {}

  @Get('products')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.mappings.listForVendor(this.requireVendor(user));
  }

  @Put('products')
  upsert(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertProductMappingDto) {
    const vendorId = this.requireVendor(user);
    return this.mappings.upsertProductMapping(
      vendorId,
      dto.connectionId,
      dto.providerCatalogObjectId,
      dto.productId ?? null,
      dto.ignored ?? false,
    );
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw new BadRequestException('Authenticated user has no vendor profile.');
    }
    return user.vendorId;
  }
}

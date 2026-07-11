import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CreateVendorUploadDto } from './dto/create-vendor-upload.dto';
import { VendorMediaService } from './vendor-media.service';

@Controller('api/vendor/upload')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('vendor')
export class VendorMediaController {
  constructor(private readonly media: VendorMediaService) {}

  @Post()
  createUpload(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVendorUploadDto) {
    return this.media.createUpload(user, dto);
  }
}

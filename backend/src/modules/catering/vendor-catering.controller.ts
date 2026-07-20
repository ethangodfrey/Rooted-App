import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  OnModuleInit,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import {
  VendorCateringService,
  type AcceptInquiryBody,
  type CreateInquiryBody,
  type UpsertCateringBody,
} from './vendor-catering.service';
import { formatCateringModuleInitializedLog } from './vendor-catering.util';

@Controller('api/catering')
export class VendorCateringController implements OnModuleInit {
  private readonly logger = new Logger(VendorCateringController.name);

  constructor(private readonly catering: VendorCateringService) {}

  onModuleInit(): void {
    this.logger.log(formatCateringModuleInitializedLog());
  }

  @Get('providers')
  async listProviders(@Query('limit') limitRaw?: string) {
    const limit =
      limitRaw != null && limitRaw !== '' ? Number(limitRaw) : undefined;
    return this.catering.listCateringProviders(
      limit != null && Number.isFinite(limit) ? limit : 40,
    );
  }

  @Get('vendors/:vendorId')
  async getVendor(@Param('vendorId') vendorId: string) {
    if (!vendorId?.trim()) throw new BadRequestException('VENDOR_ID_REQUIRED');
    return this.catering.getForVendor(vendorId);
  }

  @Put('vendors/:vendorId')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'farmer', 'admin')
  async upsertVendor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vendorId') vendorId: string,
    @Body() body: UpsertCateringBody,
  ) {
    if (!user.vendorId || user.vendorId !== vendorId) {
      if (user.role !== 'admin') {
        throw new BadRequestException('VENDOR_MISMATCH');
      }
    }
    return this.catering.upsertForVendor(vendorId, body);
  }

  @Post('inquiries')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('shopper', 'vendor', 'farmer', 'admin')
  async createInquiry(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateInquiryBody,
  ) {
    return this.catering.createInquiry(user.id, body);
  }

  @Get('vendors/:vendorId/inquiries')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'farmer', 'admin')
  async listInquiries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vendorId') vendorId: string,
  ) {
    if (!vendorId?.trim()) throw new BadRequestException('VENDOR_ID_REQUIRED');
    if (!user.vendorId || user.vendorId !== vendorId) {
      if (user.role !== 'admin') {
        throw new BadRequestException('VENDOR_MISMATCH');
      }
    }
    return this.catering.listInquiriesForVendor(vendorId);
  }

  @Post('inquiries/:inquiryId/accept')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'farmer', 'admin')
  async acceptInquiry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('inquiryId') inquiryId: string,
    @Body() body: AcceptInquiryBody,
  ) {
    if (!user.vendorId) throw new BadRequestException('VENDOR_REQUIRED');
    if (!inquiryId?.trim()) throw new BadRequestException('INQUIRY_ID_REQUIRED');
    return this.catering.acceptInquiry(user.vendorId, inquiryId, body);
  }

  @Post('inquiries/:inquiryId/fulfill')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('vendor', 'farmer', 'admin')
  async fulfillInquiry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('inquiryId') inquiryId: string,
  ) {
    if (!user.vendorId) throw new BadRequestException('VENDOR_REQUIRED');
    if (!inquiryId?.trim()) throw new BadRequestException('INQUIRY_ID_REQUIRED');
    return this.catering.fulfillInquiry(user.vendorId, inquiryId);
  }
}

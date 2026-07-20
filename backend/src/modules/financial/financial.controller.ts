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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import {
  formatEscrowLedgerActiveLog,
  formatFinancialEngineInitializedLog,
  formatFinancialUiActiveLog,
  formatInvoicingEngineInitializedLog,
} from './financial.util';
import { GenerateInvoiceService } from './generate-invoice.service';
import { PaymentClearingService } from './payment-clearing.service';

@Controller('api/financial')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class FinancialController implements OnModuleInit {
  private readonly logger = new Logger(FinancialController.name);

  constructor(
    private readonly clearing: PaymentClearingService,
    private readonly invoices: GenerateInvoiceService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatFinancialEngineInitializedLog());
    this.logger.log(formatEscrowLedgerActiveLog());
    this.logger.log(formatFinancialUiActiveLog());
    this.logger.log(formatInvoicingEngineInitializedLog());
  }

  /**
   * POST /api/financial/escrow/hold
   * Lock deposit when catering inquiry is accepted.
   */
  @Post('escrow/hold')
  @Roles('vendor', 'farmer', 'admin')
  async hold(@Body() body: { inquiryId?: string; amountCents?: number }) {
    if (!body.inquiryId?.trim()) {
      throw new BadRequestException('INQUIRY_ID_REQUIRED');
    }
    if (body.amountCents == null) {
      throw new BadRequestException('AMOUNT_CENTS_REQUIRED');
    }
    return this.clearing.holdCateringEscrow(body.inquiryId, Number(body.amountCents));
  }

  /**
   * POST /api/financial/escrow/release
   * Disburse held funds after fulfillment.
   */
  @Post('escrow/release')
  @Roles('vendor', 'farmer', 'admin')
  async release(@Body() body: { inquiryId?: string; procurementRequestId?: string }) {
    if (!body.inquiryId?.trim() && !body.procurementRequestId?.trim()) {
      throw new BadRequestException('RELEASE_REF_REQUIRED');
    }
    return this.clearing.releaseEscrow({
      inquiryId: body.inquiryId,
      procurementRequestId: body.procurementRequestId,
    });
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

  @Get('vendors/:vendorId/transactions')
  @Roles('vendor', 'farmer', 'admin')
  async transactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vendorId') vendorId: string,
    @Query('limit') limit?: string,
  ) {
    if (!vendorId?.trim()) throw new BadRequestException('VENDOR_ID_REQUIRED');
    if (!user.vendorId || user.vendorId !== vendorId) {
      if (user.role !== 'admin') {
        throw new BadRequestException('VENDOR_MISMATCH');
      }
    }
    const parsed = limit ? Number(limit) : 40;
    return this.clearing.listTransactionsForVendor(
      vendorId,
      Number.isFinite(parsed) ? parsed : 40,
    );
  }

  @Get('invoices/catering/:inquiryId')
  @Roles('vendor', 'farmer', 'shopper', 'admin')
  async cateringInvoiceJson(@Param('inquiryId') inquiryId: string) {
    const invoice = await this.invoices.fromCateringInquiry(inquiryId);
    return {
      STATUS: 'INVOICING_ENGINE_INITIALIZED',
      INVOICE: invoice,
    };
  }

  @Get('invoices/catering/:inquiryId/html')
  @Roles('vendor', 'farmer', 'shopper', 'admin')
  async cateringInvoiceHtml(
    @Param('inquiryId') inquiryId: string,
    @Res() res: Response,
  ) {
    const invoice = await this.invoices.fromCateringInquiry(inquiryId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(invoice.HTML);
  }

  @Get('invoices/procurement/:requestId')
  @Roles('vendor', 'farmer', 'admin')
  async procurementInvoiceJson(@Param('requestId') requestId: string) {
    const invoice = await this.invoices.fromProcurementRequest(requestId);
    return {
      STATUS: 'INVOICING_ENGINE_INITIALIZED',
      INVOICE: invoice,
    };
  }

  @Get('invoices/procurement/:requestId/html')
  @Roles('vendor', 'farmer', 'admin')
  async procurementInvoiceHtml(
    @Param('requestId') requestId: string,
    @Res() res: Response,
  ) {
    const invoice = await this.invoices.fromProcurementRequest(requestId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(invoice.HTML);
  }
}

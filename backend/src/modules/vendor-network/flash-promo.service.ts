import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  clearFlashPromoFromTheme,
  createFlashPromoCampaign,
  mergeFlashPromoIntoTheme,
  parseFlashPromoCampaign,
  validateFlashPromoCampaign,
  type CreateFlashPromoInput,
  type FlashPromoCampaign,
} from './flash-promo.util';

@Injectable()
export class FlashPromoService {
  private readonly logger = new Logger(FlashPromoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getActiveCampaign(vendorId: string): Promise<FlashPromoCampaign | null> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { themeSettings: true },
    });
    if (!vendor) {
      throw new NotFoundException('FLASH_PROMO_ERROR: VENDOR_NOT_FOUND');
    }
    return parseFlashPromoCampaign(vendor.themeSettings);
  }

  async createCampaign(
    vendorId: string,
    input: CreateFlashPromoInput,
  ): Promise<FlashPromoCampaign> {
    let campaign: FlashPromoCampaign;
    try {
      campaign = createFlashPromoCampaign(input);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'FLASH_PROMO_INVALID';
      throw new BadRequestException(message);
    }

    const validation = validateFlashPromoCampaign(campaign);
    if (!validation.ok) {
      throw new BadRequestException(`FLASH_PROMO_INVALID: ${validation.reason}`);
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { themeSettings: true },
    });
    if (!vendor) {
      throw new NotFoundException('FLASH_PROMO_ERROR: VENDOR_NOT_FOUND');
    }

    const nextTheme = mergeFlashPromoIntoTheme(vendor.themeSettings, campaign);
    await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { themeSettings: nextTheme as Prisma.InputJsonValue },
    });

    this.logger.log(
      `FLASH_PROMO_CREATED VENDOR=${vendorId} PRODUCT=${campaign.productId} DISCOUNT=${campaign.discountPercent}`,
    );
    return campaign;
  }

  async clearCampaign(vendorId: string): Promise<void> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { themeSettings: true },
    });
    if (!vendor) {
      throw new NotFoundException('FLASH_PROMO_ERROR: VENDOR_NOT_FOUND');
    }

    const nextTheme = clearFlashPromoFromTheme(vendor.themeSettings);
    await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { themeSettings: nextTheme as Prisma.InputJsonValue },
    });
    this.logger.log(`FLASH_PROMO_CLEARED VENDOR=${vendorId}`);
  }
}

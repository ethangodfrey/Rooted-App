import { Controller, Get, HttpCode, NotFoundException, Param } from '@nestjs/common';

import { MarketsDirectoryService } from './markets-directory.service';

/**
 * Nationwide directory lookup for tenant subdomain theme injection.
 * GET /api/markets/directory/:slug
 */
@Controller('api/markets')
export class MarketsDirectoryController {
  constructor(private readonly directory: MarketsDirectoryService) {}

  @Get('directory/:slug')
  @HttpCode(200)
  async byDirectorySlug(@Param('slug') slug: string) {
    const market = await this.directory.findByDirectorySlug(slug);
    if (!market) {
      throw new NotFoundException('DIRECTORY_MISS');
    }

    return {
      STATUS: 'DIRECTORY_READY',
      MARKET: {
        ID: market.id,
        NAME: market.name,
        SLUG: market.slug,
        DIRECTORY_SLUG: market.directorySlug,
        DESCRIPTION: market.description,
        CITY: market.city,
        STATE: market.state,
        ADDRESS: market.locationAddress,
        OPERATING_HOURS: market.operatingHours,
        THEME_PRIMARY_COLOR: market.themePrimaryColor,
        THEME_ACCENT_COLOR: market.themeAccentColor,
        BANNER_URL: market.bannerUrl,
        EVENT_DESCRIPTION: market.eventDescription,
      },
    };
  }
}

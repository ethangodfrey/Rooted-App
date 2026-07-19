import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

export type MarketDirectoryContext = {
  id: string;
  name: string;
  slug: string;
  directorySlug: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  locationAddress: string | null;
  operatingHours: string | null;
  themePrimaryColor: string | null;
  themeAccentColor: string | null;
  bannerUrl: string | null;
  eventDescription: string | null;
};

@Injectable()
export class MarketsDirectoryService {
  private readonly logger = new Logger(MarketsDirectoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve an active Market directory row by nationwide directory_slug,
   * falling back to region-scoped slug when directory_slug is unset.
   */
  async findByDirectorySlug(slug: string): Promise<MarketDirectoryContext | null> {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) return null;

    const select = {
      id: true,
      name: true,
      slug: true,
      directorySlug: true,
      description: true,
      city: true,
      state: true,
      locationAddress: true,
      operatingHours: true,
      themePrimaryColor: true,
      themeAccentColor: true,
      event: {
        select: {
          description: true,
          bannerUrl: true,
        },
      },
    } as const;

    const market =
      (await this.prisma.market.findFirst({
        where: { status: 'ACTIVE', directorySlug: normalized },
        select,
      })) ??
      (await this.prisma.market.findFirst({
        where: { status: 'ACTIVE', slug: normalized },
        select,
      }));

    if (!market) {
      this.logger.log(`DIRECTORY_MISS SLUG=${normalized}`);
      return null;
    }

    this.logger.log(
      `DIRECTORY_HIT SLUG=${normalized} MARKET=${market.id} DIRECTORY_SLUG=${market.directorySlug ?? 'NONE'}`,
    );

    return {
      id: market.id,
      name: market.name,
      slug: market.slug,
      directorySlug: market.directorySlug,
      description: market.description,
      city: market.city,
      state: market.state,
      locationAddress: market.locationAddress,
      operatingHours: market.operatingHours,
      themePrimaryColor: market.themePrimaryColor,
      themeAccentColor: market.themeAccentColor,
      bannerUrl: market.event?.bannerUrl ?? null,
      eventDescription: market.event?.description ?? null,
    };
  }
}

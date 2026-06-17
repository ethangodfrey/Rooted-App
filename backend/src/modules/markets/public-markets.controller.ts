import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import { MarketsGooglePlacesService } from './markets-google-places.service';

/** Public market photo proxy — keeps Google API key server-side. */
@Controller('public/markets')
export class PublicMarketsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googlePlaces: MarketsGooglePlacesService,
    private readonly config: ConfigService,
  ) {}

  @Get(':eventId/photo')
  async photo(@Param('eventId') eventId: string, @Res() res: Response): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { bannerUrl: true, syncMetadata: true },
    });

    if (!event) throw new NotFoundException('Event not found');

    const metadata = (event.syncMetadata ?? {}) as Record<string, unknown>;
    const photoReference =
      typeof metadata.google_photo_reference === 'string'
        ? metadata.google_photo_reference
        : null;

    if (!photoReference) {
      if (event.bannerUrl && !event.bannerUrl.includes('/public/markets/')) {
        res.redirect(302, event.bannerUrl);
        return;
      }
      throw new NotFoundException('No photo for this market');
    }

    if (!this.googlePlaces.enabled) {
      throw new NotFoundException('Google Places is not configured');
    }

    const photoUrl = this.googlePlaces.photoFetchUrl(photoReference);
    const upstream = await fetch(photoUrl);

    if (!upstream.ok) {
      throw new NotFoundException('Photo unavailable');
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  }
}

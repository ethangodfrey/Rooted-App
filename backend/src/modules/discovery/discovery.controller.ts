import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  OnModuleInit,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { MeetTheMakersService } from './meet-the-makers.service';
import { formatDiscoveryInterfaceInitializedLog } from './meet-the-makers.ranking.util';
import { UserEventsService } from './user-events.service';

@Controller('api/discovery')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class DiscoveryController implements OnModuleInit {
  private readonly logger = new Logger(DiscoveryController.name);

  constructor(
    private readonly makers: MeetTheMakersService,
    private readonly userEvents: UserEventsService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatDiscoveryInterfaceInitializedLog());
  }

  /**
   * GET /api/discovery/meet-the-makers
   * Aggregates active US farmer-vendor partnership posts, ranked by
   * alert_radius_km + preferred categories, enriched via USDA directory.
   */
  @Get('meet-the-makers')
  @Roles('shopper', 'vendor', 'farmer', 'admin')
  async meetTheMakers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('latitude') latitudeRaw?: string,
    @Query('longitude') longitudeRaw?: string,
    @Query('alertRadiusKm') alertRadiusRaw?: string,
    @Query('categories') categoriesRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const latitude =
      latitudeRaw != null && latitudeRaw !== ''
        ? Number(latitudeRaw)
        : null;
    const longitude =
      longitudeRaw != null && longitudeRaw !== ''
        ? Number(longitudeRaw)
        : null;
    const alertRadiusKm =
      alertRadiusRaw != null && alertRadiusRaw !== ''
        ? Number(alertRadiusRaw)
        : null;
    const preferredCategories = (categoriesRaw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const limit =
      limitRaw != null && limitRaw !== '' ? Number(limitRaw) : undefined;

    return this.makers.getFeed({
      userId: user.id,
      latitude:
        latitude != null && Number.isFinite(latitude) ? latitude : null,
      longitude:
        longitude != null && Number.isFinite(longitude) ? longitude : null,
      alertRadiusKm:
        alertRadiusKm != null && Number.isFinite(alertRadiusKm)
          ? alertRadiusKm
          : null,
      preferredCategories,
      limit,
    });
  }

  @Get('meet-the-makers/collaboration/:profileId')
  @Roles('shopper', 'vendor', 'farmer', 'admin')
  async collaboration(@Param('profileId') profileId: string) {
    if (!profileId?.trim()) {
      throw new BadRequestException('PROFILE_ID_REQUIRED');
    }
    const [active, items] = await Promise.all([
      this.makers.hasActiveCollaboration(profileId),
      this.makers.listJointContentForProfile(profileId),
    ]);
    return {
      STATUS: 'PARTNERSHIP_FEED_SYNCED',
      ACTIVE_COLLABORATION: active,
      ITEMS: items,
    };
  }

  @Post('meet-the-makers/rsvp')
  @Roles('shopper', 'vendor', 'farmer', 'admin')
  async rsvp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { eventId?: string; postId?: string | null },
  ) {
    if (!body.eventId?.trim()) {
      throw new BadRequestException('EVENT_ID_REQUIRED');
    }
    const result = await this.userEvents.rsvp({
      userId: user.id,
      eventId: body.eventId,
      postId: body.postId ?? null,
    });
    return { STATUS: 'RSVP_RECORDED', ...result };
  }

  @Delete('meet-the-makers/rsvp/:eventId')
  @Roles('shopper', 'vendor', 'farmer', 'admin')
  async cancelRsvp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
  ) {
    return this.userEvents.cancelRsvp({ userId: user.id, eventId });
  }

  @Get('schedule')
  @Roles('shopper', 'vendor', 'farmer', 'admin')
  async schedule(@CurrentUser() user: AuthenticatedUser) {
    const items = await this.userEvents.listSchedule(user.id);
    return {
      STATUS: 'PARTNERSHIP_FEED_SYNCED',
      ITEMS: items,
      COUNT: items.length,
    };
  }
}

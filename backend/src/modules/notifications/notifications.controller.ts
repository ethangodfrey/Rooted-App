import {
  Body,
  Controller,
  Get,
  Logger,
  OnModuleInit,
  Patch,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser } from '../../common/auth/decorators';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { NotificationService } from './notification.service';
import {
  formatEventDispatchedLog,
  formatNotificationEngineActiveLog,
} from './notification.util';

@Controller('api/notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationsController implements OnModuleInit {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notifications: NotificationService) {}

  onModuleInit(): void {
    this.logger.log(formatNotificationEngineActiveLog());
    this.logger.log(formatEventDispatchedLog());
  }

  /** GET /api/notifications/preferences */
  @Get('preferences')
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    const prefs = await this.notifications.getPreferences(user.id);
    return {
      STATUS: 'NOTIFICATION_ENGINE_ACTIVE',
      USER_ID: user.id,
      EMAIL_ENABLED: prefs.emailEnabled,
      SMS_ENABLED: prefs.smsEnabled,
      PREFERENCES: prefs,
    };
  }

  /** PATCH /api/notifications/preferences */
  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      email?: boolean;
      sms?: boolean;
    },
  ) {
    const prefs = await this.notifications.updatePreferences(user.id, {
      emailEnabled:
        typeof body.emailEnabled === 'boolean'
          ? body.emailEnabled
          : typeof body.email === 'boolean'
            ? body.email
            : undefined,
      smsEnabled:
        typeof body.smsEnabled === 'boolean'
          ? body.smsEnabled
          : typeof body.sms === 'boolean'
            ? body.sms
            : undefined,
    });
    return {
      STATUS: 'NOTIFICATION_ENGINE_ACTIVE',
      ACTION: 'PREFS_UPDATED',
      USER_ID: user.id,
      EMAIL_ENABLED: prefs.emailEnabled,
      SMS_ENABLED: prefs.smsEnabled,
      PREFERENCES: prefs,
    };
  }
}

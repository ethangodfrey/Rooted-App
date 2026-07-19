import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import type { Response } from 'express';

import {
  HealthService,
  type ApiHealthPayload,
} from './health.service';

/**
 * Public production health probe for Railway / load balancers.
 * GET /api/health -> {"STATUS":"HEALTH_OK","TIMESTAMP":<unix>}
 */
@Controller('api/health')
export class ApiHealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @HttpCode(200)
  async check(@Res({ passthrough: true }) res: Response): Promise<ApiHealthPayload> {
    const probe = await this.health.productionProbe();
    if (!probe.ok) {
      res.status(503);
    }
    return this.health.toApiHealthPayload(probe);
  }
}

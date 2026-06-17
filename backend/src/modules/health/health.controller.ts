import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import type { Response } from 'express';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness: process is up. Always 200 unless the process is dead. */
  @Get('live')
  @HttpCode(200)
  live() {
    return { status: 'ok', uptime: process.uptime() };
  }

  /** Readiness: dependencies (DB + Redis) are reachable. 503 when degraded. */
  @Get()
  async overall(@Res({ passthrough: true }) res: Response) {
    return this.respondReadiness(res);
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    return this.respondReadiness(res);
  }

  private async respondReadiness(res: Response) {
    const result = await this.health.readiness();
    res.status(result.ok ? 200 : 503);
    return {
      status: result.ok ? 'ok' : 'degraded',
      db: result.db,
      redis: result.redis,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

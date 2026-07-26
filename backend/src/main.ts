import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, raw } from 'express';

import { AppModule } from './app.module';
import { assertProductionEnv } from './common/config/validate-production-env';
import { isCorsOriginAllowed } from './common/cors/origin-policy';
import { getLanIpv4Addresses } from './common/network.util';
import { posOAuthRedirectUri } from './modules/pos/pos-public-url';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  assertProductionEnv(config);

  const isDev = config.get<string>('NODE_ENV', 'development') !== 'production';

  const corsOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    ...config
      .get<string>('CORS_ORIGINS', '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ];
  const webAppUrl = config.get<string>('WEB_APP_URL', '').trim().replace(/\/$/, '');
  if (webAppUrl) corsOrigins.push(webAppUrl);

  const allowedOrigins = new Set(corsOrigins);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowed = isCorsOriginAllowed(origin, { isDev, allowedOrigins });
      callback(null, allowed);
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // Webhook routes need the raw body to verify provider signatures, so we
  // register a raw body parser scoped to the webhook path before the JSON
  // parser takes over everything else.
  app.use('/pos/webhooks', raw({ type: '*/*', limit: '2mb' }));
  app.use('/api/webhooks/square', raw({ type: '*/*', limit: '2mb' }));
  app.use('/webhooks/stripe', raw({ type: '*/*', limit: '2mb' }));
  app.use('/stripe/webhooks', raw({ type: '*/*', limit: '2mb' }));
  app.use('/api/webhooks/stripe', raw({ type: '*/*', limit: '2mb' }));
  app.use('/api/payments/webhook', raw({ type: '*/*', limit: '2mb' }));
  app.use(json({ limit: '2mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');

  const lan = getLanIpv4Addresses();
  // eslint-disable-next-line no-console
  console.log(`BOOT_SEQUENCE_COMPLETE PORT=${port}`);
  // eslint-disable-next-line no-console
  console.log(`LISTEN 0.0.0.0:${port}`);
  // eslint-disable-next-line no-console
  console.log(`LOCAL http://localhost:${port}`);
  for (const address of lan) {
    // eslint-disable-next-line no-console
    console.log(`NETWORK http://${address}:${port}`);
  }
  if (lan.length === 0) {
    // eslint-disable-next-line no-console
    console.log('NETWORK UNAVAILABLE');
  }
  // eslint-disable-next-line no-console
  console.log('HEALTH_PROBE /api/health');
  if (config.get<string>('SQUARE_APPLICATION_ID', '').trim()) {
    const squareRedirect = posOAuthRedirectUri(config, 'SQUARE');
    // eslint-disable-next-line no-console
    console.log(`SQUARE_OAUTH_REDIRECT ${squareRedirect}`);
  }
}

void bootstrap();

import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, raw } from 'express';

import { AppModule } from './app.module';
import { getLanIpv4Addresses, isDevLanOrigin } from './common/network.util';
import { posOAuthRedirectUri } from './modules/pos/pos-public-url';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

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
      if (!origin) {
        if (isDev) {
          callback(null, true);
          return;
        }
        callback(null, false);
        return;
      }
      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      if (isDev && isDevLanOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // Webhook routes need the raw body to verify provider signatures, so we
  // register a raw body parser scoped to the webhook path before the JSON
  // parser takes over everything else.
  app.use('/pos/webhooks', raw({ type: '*/*', limit: '2mb' }));
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
  console.log(`Rooted backend listening on 0.0.0.0:${port}`);
  // eslint-disable-next-line no-console
  console.log(`  Local:   http://localhost:${port}`);
  for (const address of lan) {
    // eslint-disable-next-line no-console
    console.log(`  Network: http://${address}:${port}`);
  }
  if (lan.length === 0) {
    // eslint-disable-next-line no-console
    console.log('  Network: (no LAN IPv4 detected — check Wi‑Fi / firewall)');
  }
  if (config.get<string>('SQUARE_APPLICATION_ID', '').trim()) {
    const squareRedirect = posOAuthRedirectUri(config, 'SQUARE');
    // eslint-disable-next-line no-console
    console.log(`Square OAuth redirect (register in Developer Dashboard): ${squareRedirect}`);
  }
}

void bootstrap();

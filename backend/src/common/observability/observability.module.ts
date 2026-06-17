import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { AllExceptionsFilter } from './all-exceptions.filter';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

/** Registers global request logging + a structured exception filter. */
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class ObservabilityModule {}

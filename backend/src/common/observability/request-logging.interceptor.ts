import { randomUUID } from 'node:crypto';

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logs one structured line per HTTP request (method, path, status, duration) and
 * assigns a correlation id (`x-request-id`) that the exception filter reuses.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const requestId =
      (typeof req.headers?.['x-request-id'] === 'string' && req.headers['x-request-id']) ||
      randomUUID();
    req.requestId = requestId;
    if (typeof res.setHeader === 'function') {
      res.setHeader('x-request-id', requestId);
    }

    const method: string = req.method;
    const url: string = req.originalUrl ?? req.url;
    const startedAt = Date.now();

    const log = (status: number, errored = false) => {
      const line = JSON.stringify({
        requestId,
        method,
        url,
        status,
        ms: Date.now() - startedAt,
      });
      if (errored || status >= 500) this.logger.error(line);
      else this.logger.log(line);
    };

    return next.handle().pipe(
      tap({
        next: () => log(res.statusCode ?? 200),
        error: (err) => log((err?.status as number) ?? 500, true),
      }),
    );
  }
}

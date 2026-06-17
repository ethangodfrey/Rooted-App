import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

/**
 * Catches every unhandled error, logs it with the request correlation id, and
 * returns a consistent JSON envelope. 5xx errors are logged at error level with
 * a stack — the natural hook point for an error tracker (e.g. Sentry).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();
    const requestId: string | undefined = req?.requestId;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const body: Record<string, unknown> =
      typeof raw === 'string' ? { message: raw } : { ...(raw as Record<string, unknown>) };
    body.statusCode = status;
    body.path = req?.originalUrl ?? req?.url;
    body.requestId = requestId;
    body.timestamp = new Date().toISOString();

    const label = `${req?.method} ${body.path} ${status} [${requestId ?? '-'}]`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(label, stack);
      // Error-tracker hook point: captureException(exception, { requestId }).
    } else {
      this.logger.warn(label);
    }

    if (typeof res.status === 'function') {
      res.status(status).json(body);
    }
  }
}

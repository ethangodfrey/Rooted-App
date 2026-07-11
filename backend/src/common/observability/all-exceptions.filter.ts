import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import {
  isWebhookRequestPath,
  sanitizeWebhookErrorMessage,
  webhookErrorCode,
  webhookErrorResponse,
} from './sanitize-error.util';

/**
 * Catches every unhandled error, logs it with the request correlation id, and
 * returns a consistent JSON envelope. Webhook routes receive sanitized bodies.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();
    const requestId: string | undefined = req?.requestId;
    const path = req?.originalUrl ?? req?.url;
    const isWebhook = isWebhookRequestPath(path);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    let body: Record<string, unknown> =
      typeof raw === 'string' ? { message: raw } : { ...(raw as Record<string, unknown>) };

    if (isWebhook) {
      const code = webhookErrorCode(exception);
      const webhookStatus =
        code === 'invalid_signature' || code === 'invalid_payload' || code === 'rejected'
          ? HttpStatus.BAD_REQUEST
          : code === 'service_unavailable' || code === 'webhook_not_configured'
            ? HttpStatus.SERVICE_UNAVAILABLE
            : HttpStatus.INTERNAL_SERVER_ERROR;
      body = webhookErrorResponse(exception, requestId);
      if (typeof res.status === 'function') {
        res.status(webhookStatus).json(body);
      }
      const label = `${req?.method} ${path} ${webhookStatus} [${requestId ?? '-'}] webhook=${sanitizeWebhookErrorMessage(exception)}`;
      if (webhookStatus >= HttpStatus.INTERNAL_SERVER_ERROR) {
        const stack = exception instanceof Error ? exception.stack : undefined;
        this.logger.error(label, stack);
      } else {
        this.logger.warn(label);
      }
      return;
    }

    body.statusCode = status;
    body.path = path;
    body.requestId = requestId;
    body.timestamp = new Date().toISOString();

    const label = `${req?.method} ${body.path} ${status} [${requestId ?? '-'}]`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(label, stack);
    } else {
      this.logger.warn(label);
    }

    if (typeof res.status === 'function') {
      res.status(status).json(body);
    }
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { readRequestId } from './request-id.middleware';

interface ErrorBody {
  message: string;
  code?: string;
  details?: unknown;
  requestId?: string;
}

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalErrorFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();
    const requestId = readRequestId(req);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const body: ErrorBody = normalize(raw, exception.message);
      body.requestId = requestId;
      res.status(status).json(body);
      return;
    }

    const err = exception as { message?: string; stack?: string };
    this.logger.error(
      { requestId, path: req.originalUrl, err: { message: err.message, stack: err.stack } },
      'unhandled exception',
    );
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: 'Internal server error', requestId } satisfies ErrorBody);
  }
}

function normalize(raw: unknown, fallback: string): ErrorBody {
  if (typeof raw === 'string') return { message: raw };
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return {
      message: typeof obj.message === 'string' ? obj.message : fallback,
      code: typeof obj.code === 'string' ? obj.code : undefined,
      details: 'details' in obj ? obj.details : undefined,
    };
  }
  return { message: fallback };
}

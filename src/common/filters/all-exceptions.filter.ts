import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpError } from '../exceptions/http-errors';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An error occurred, please try again later';
    let details: Record<string, unknown> = {};

    if (exception instanceof HttpError) {
      status = exception.getStatus();
      message = exception.message;
      details =
        exception.details && typeof exception.details === 'object'
          ? exception.details
          : {};
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (typeof resObj.message === 'string') {
          message = resObj.message;
        }
        for (const [key, value] of Object.entries(resObj)) {
          if (value !== undefined) {
            details[key] = value;
          }
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Handle duplicate key error (MongoDB) with type guards
    function extractCode(obj: unknown): number | undefined {
      if (obj && typeof obj === 'object' && 'code' in obj) {
        const val = (obj as Record<string, unknown>).code;
        if (typeof val === 'number') return val;
      }
      return undefined;
    }
    function extractKeyValue(obj: unknown): Record<string, unknown> {
      if (obj && typeof obj === 'object' && 'keyValue' in obj) {
        const val = (obj as Record<string, unknown>).keyValue;
        if (val && typeof val === 'object' && !Array.isArray(val))
          return val as Record<string, unknown>;
      }
      return {};
    }
    const code = extractCode(details) ?? extractCode(exception);
    const keyValue = extractKeyValue(details) ?? extractKeyValue(exception);
    if (code === 11000) {
      const field = Object.keys(keyValue).join(', ');
      message = `An account with that ${field} already exists.`;
      status = HttpStatus.CONFLICT;
    }

    Logger.error(
      `HTTP ${request.method} ${request.url}`,
      JSON.stringify({
        message,
        details: Object.keys(details).length ? details : undefined,
      }),
      'AllExceptionsFilter',
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      details: Object.keys(details).length ? details : undefined,
    });
  }
}

import { RpcError, RpcErrorDetailsType } from '@/common/exceptions/rpc-errors';
import { status as grpcStatus, Metadata } from '@grpc/grpc-js';
import {
  ArgumentsHost,
  Catch,
  Logger,
  RpcExceptionFilter
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';

@Catch(RpcException)
export class AllExceptionsFilter implements RpcExceptionFilter<RpcError> {
  catch(exception: RpcError, host: ArgumentsHost): Observable<void> {
    const ctx = host.switchToRpc();
    const request = ctx.getContext<Metadata>();

    let status = grpcStatus.INTERNAL;
    let message = 'An error occurred, please try again later';
    let details: RpcErrorDetailsType = {};

    if (exception instanceof RpcError) {
      status = exception.code;
      message = exception.message;
      details =
        exception.details && typeof exception.details === 'object'
          ? exception.details
          : {};
    }

    Logger.error(
      `gRPC`,
      // we should redact sensitive data from the request
      request.getMap(),
      JSON.stringify({
        status,
        message,
        details: Object.keys(details).length ? details : undefined,
      }),
      'AllExceptionsFilter',
    );

    return throwError(() => exception.getError());
    // response.status(status).json({
    //   success: false,
    //   statusCode: status,
    //   timestamp: new Date().toISOString(),
    //   path: request.url,
    //   message,
    //   details: Object.keys(details).length ? details : undefined,
    // });
  }
}

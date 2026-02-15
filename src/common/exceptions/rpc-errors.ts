import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';

export type RpcErrorDetailsType = Record<string, unknown>;

export class RpcError<T extends RpcErrorDetailsType = RpcErrorDetailsType> extends RpcException {
  public details: T;
  public code: status;

  constructor(
    status: status,
    message: string,
    details: T = {} as T,
  ) {
    super({ code: status, message, details });
    this.details = details;
    this.code = status;
  }

  getError(): { code: status, message: string, details: T } {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export class RpcBadRequestError<T extends RpcErrorDetailsType = RpcErrorDetailsType> extends RpcError<T> {
  constructor(message: string, details?: T) {
    super(status.INVALID_ARGUMENT, message, details);
  }
}

export class RpcNotFoundError<T extends RpcErrorDetailsType = RpcErrorDetailsType> extends RpcError<T> {
  constructor(message: string, details?: T) {
    super(status.NOT_FOUND, message, details);
  }
}

export class RpcUnauthorizedError<T extends RpcErrorDetailsType = RpcErrorDetailsType> extends RpcError<T> {
  constructor(message: string, details?: T) {
    super(status.UNAUTHENTICATED, message, details);
  }
}

export class RpcForbiddenError<T extends RpcErrorDetailsType = RpcErrorDetailsType> extends RpcError<T> {
  constructor(message: string, details?: T) {
    super(status.PERMISSION_DENIED, message, details);
  }
}

export class RpcTimeoutError<T extends RpcErrorDetailsType = RpcErrorDetailsType> extends RpcError<T> {
  constructor(message: string, details?: T) {
    super(status.DEADLINE_EXCEEDED, message, details);
  }
}

export class RpcExistsError<T extends RpcErrorDetailsType = RpcErrorDetailsType> extends RpcError<T> {
  constructor(message: string, details?: T) {
    super(status.ALREADY_EXISTS, message, details);
  }
}

export class RpcTooManyRequestsError<T extends RpcErrorDetailsType = RpcErrorDetailsType> extends RpcError<T> {
  constructor(message: string, details?: T) {
    super(status.RESOURCE_EXHAUSTED, message, details);
  }
}

export class RpcInternalServerErrorError<T extends RpcErrorDetailsType = RpcErrorDetailsType> extends RpcError<T> {
  constructor(message: string, details?: T) {
    super(status.INTERNAL, message, details);
  }
}

export class RpcPreconditionFailedError<T extends RpcErrorDetailsType = RpcErrorDetailsType> extends RpcError<T> {
  constructor(message: string, details?: T) {
    super(status.FAILED_PRECONDITION, message, details);
  }
}
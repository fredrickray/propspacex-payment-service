import { HttpException, HttpStatus } from '@nestjs/common';

export class HttpError extends HttpException {
  public details: Record<string, any>;
  public code: number;
  public keyValue: Record<string, any>;

  constructor(
    statusCode: number,
    message: string,
    details: Record<string, any> = {},
  ) {
    super(message, statusCode);
    this.details = details;
    this.code = (details as { code?: number })['code'] || 0;
    this.keyValue = (details as { keyValue?: object })['keyValue'] || {};
  }
}

export class BadRequest extends HttpError {
  constructor(message: string, details?: object) {
    super(HttpStatus.BAD_REQUEST, message, details);
  }
}

export class ResourceNotFound extends HttpError {
  constructor(message: string, details?: object) {
    super(HttpStatus.NOT_FOUND, message, details);
  }
}

export class Unauthorized extends HttpError {
  constructor(message: string, details?: object) {
    super(HttpStatus.UNAUTHORIZED, message, details);
  }
}

export class Forbidden extends HttpError {
  constructor(message: string, details?: object) {
    super(HttpStatus.FORBIDDEN, message, details);
  }
}

export class Timeout extends HttpError {
  constructor(message: string, details?: object) {
    super(HttpStatus.REQUEST_TIMEOUT, message, details);
  }
}

export class Conflict extends HttpError {
  constructor(message: string, details?: object) {
    super(HttpStatus.CONFLICT, message, details);
  }
}

export class InvalidInput extends HttpError {
  constructor(message: string, details?: object) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, message, details);
  }
}

export class TooManyRequests extends HttpError {
  constructor(message: string, details?: object) {
    super(HttpStatus.TOO_MANY_REQUESTS, message, details);
  }
}

export class ServerError extends HttpError {
  constructor(message: string, details?: object) {
    super(HttpStatus.INTERNAL_SERVER_ERROR, message, details);
  }
}

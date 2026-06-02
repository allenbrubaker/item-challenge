export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request') {
    super(message, 400);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Item not found') {
    super(message, 404);
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

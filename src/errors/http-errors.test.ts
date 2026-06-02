import { BadRequestError, HttpError, NotFoundError, UnauthorizedError, isHttpError } from './http-errors.js';

describe('HTTP errors', () => {
  it('sets names and status codes for custom errors', () => {
    expect(new HttpError('Conflict', 409)).toMatchObject({ name: 'HttpError', message: 'Conflict', statusCode: 409 });
    expect(new BadRequestError()).toMatchObject({ name: 'BadRequestError', message: 'Bad request', statusCode: 400 });
    expect(new UnauthorizedError()).toMatchObject({
      name: 'UnauthorizedError',
      message: 'Unauthorized',
      statusCode: 401
    });
    expect(new NotFoundError()).toMatchObject({ name: 'NotFoundError', message: 'Item not found', statusCode: 404 });
  });

  it('identifies HTTP errors', () => {
    expect(isHttpError(new BadRequestError())).toBe(true);
    expect(isHttpError(new Error('plain'))).toBe(false);
  });
});
